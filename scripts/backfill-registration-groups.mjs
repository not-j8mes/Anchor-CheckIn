/**
 * Backfill script: assign registration_group_id to existing registrations.
 *
 * Grouping rule: registrations sharing the same (guardian_phone, event_id)
 * go into the same group. Registrations with no phone get their own individual
 * group each. Registrations that already have a group ID are skipped.
 */

import pg from "/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch all registrations without a group ID
    const { rows: ungrouped } = await client.query(`
      SELECT id, event_id, guardian_phone
      FROM registrations
      WHERE registration_group_id IS NULL
      ORDER BY id
    `);

    if (ungrouped.length === 0) {
      console.log("No ungrouped registrations found — nothing to do.");
      await client.query("ROLLBACK");
      return;
    }

    console.log(`Found ${ungrouped.length} ungrouped registrations.`);

    // Build groups by (event_id, normalized_phone)
    // Key: "eventId:normalizedPhone" → registrationGroupId to use
    const phoneGroupMap = new Map();
    // Also track registrations that need individual groups (no phone)
    const needsIndividualGroup = [];

    for (const reg of ungrouped) {
      const phone = reg.guardian_phone ? reg.guardian_phone.replace(/\D/g, "") : null;
      const eventId = reg.event_id;

      if (phone && eventId) {
        const key = `${eventId}:${phone}`;
        if (!phoneGroupMap.has(key)) {
          phoneGroupMap.set(key, { eventId, registrationIds: [], groupId: null });
        }
        phoneGroupMap.get(key).registrationIds.push(reg.id);
      } else {
        needsIndividualGroup.push({ id: reg.id, eventId });
      }
    }

    let groupsCreated = 0;
    let registrationsUpdated = 0;

    // Create groups for phone-matched families
    for (const [, entry] of phoneGroupMap.entries()) {
      const { rows: [group] } = await client.query(
        `INSERT INTO registration_groups (event_id, submitted_at, created_at, updated_at)
         VALUES ($1, NOW(), NOW(), NOW()) RETURNING id`,
        [entry.eventId]
      );
      groupsCreated++;

      await client.query(
        `UPDATE registrations SET registration_group_id = $1 WHERE id = ANY($2)`,
        [group.id, entry.registrationIds]
      );
      registrationsUpdated += entry.registrationIds.length;

      if (entry.registrationIds.length > 1) {
        console.log(`  Group ${group.id}: ${entry.registrationIds.length} children grouped together`);
      }
    }

    // Create individual groups for registrations with no phone
    for (const reg of needsIndividualGroup) {
      const { rows: [group] } = await client.query(
        `INSERT INTO registration_groups (event_id, submitted_at, created_at, updated_at)
         VALUES ($1, NOW(), NOW(), NOW()) RETURNING id`,
        [reg.eventId]
      );
      groupsCreated++;

      await client.query(
        `UPDATE registrations SET registration_group_id = $1 WHERE id = $2`,
        [group.id, reg.id]
      );
      registrationsUpdated++;
    }

    await client.query("COMMIT");
    console.log(`Done. Created ${groupsCreated} groups, updated ${registrationsUpdated} registrations.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Backfill failed, rolled back:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
