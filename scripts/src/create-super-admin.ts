import { db, pool, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findOrCreateUser, normalizeEmail, requireEnv } from "./account-utils";

async function main() {
  const email = normalizeEmail(requireEnv("SUPER_ADMIN_EMAIL"));
  const firstName = requireEnv("SUPER_ADMIN_FIRST_NAME");
  const lastName = requireEnv("SUPER_ADMIN_LAST_NAME");
  const password = requireEnv("SUPER_ADMIN_PASSWORD");

  const { user, created } = await findOrCreateUser({
    email,
    firstName,
    lastName,
    password,
  });

  const [superAdmin] = await db
    .update(usersTable)
    .set({ isSuperAdmin: true, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning({ id: usersTable.id, email: usersTable.email });

  if (!superAdmin) throw new Error("Unable to enable super-admin access.");

  console.log(
    [
      "Platform super-admin account ready.",
      `User: ${superAdmin.email}${created ? " (created)" : " (existing)"}`,
      "Super admin: enabled",
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
