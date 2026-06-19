import { pool } from "@workspace/db";
import {
  backfillExistingData,
  ensureMembership,
  findOrCreateOrganization,
  findOrCreateUser,
  normalizeEmail,
  optionalEnv,
  requireEnv,
} from "./account-utils";

async function main() {
  const orgName = requireEnv("ORG_NAME");
  const ownerEmail = normalizeEmail(requireEnv("OWNER_EMAIL"));
  const ownerFirstName = requireEnv("OWNER_FIRST_NAME");
  const ownerLastName = requireEnv("OWNER_LAST_NAME");
  const ownerPassword = requireEnv("OWNER_PASSWORD");
  const plan = optionalEnv("PLAN", "basic");
  const subscriptionStatus = optionalEnv("SUBSCRIPTION_STATUS", "trialing");

  const { organization, created: orgCreated } = await findOrCreateOrganization({
    name: orgName,
    plan,
    subscriptionStatus,
  });

  const { user, created: userCreated } = await findOrCreateUser({
    email: ownerEmail,
    firstName: ownerFirstName,
    lastName: ownerLastName,
    password: ownerPassword,
  });

  const { created: membershipCreated } = await ensureMembership({
    userId: user.id,
    organizationId: organization.id,
    role: "owner",
  });

  await backfillExistingData(organization.id);

  console.log(
    [
      `Owner account ready.`,
      `Organization: ${organization.name}${orgCreated ? " (created)" : " (existing)"}`,
      `User: ${user.email}${userCreated ? " (created)" : " (existing)"}`,
      `Role: owner${membershipCreated ? " (membership created)" : " (membership already exists)"}`,
    ].join("\n"),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
