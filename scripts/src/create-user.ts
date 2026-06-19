import { pool } from "@workspace/db";
import {
  ALLOWED_ROLES,
  ensureMembership,
  findOrCreateUser,
  findOrganizationByName,
  normalizeEmail,
  requireEnv,
  type Role,
} from "./account-utils";

async function main() {
  const orgName = requireEnv("ORG_NAME");
  const userEmail = normalizeEmail(requireEnv("USER_EMAIL"));
  const userFirstName = requireEnv("USER_FIRST_NAME");
  const userLastName = requireEnv("USER_LAST_NAME");
  const userPassword = requireEnv("USER_PASSWORD");
  const role = requireEnv("ROLE") as Role;

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error(`ROLE must be one of: ${ALLOWED_ROLES.join(", ")}`);
  }

  const organization = await findOrganizationByName(orgName);
  if (!organization) {
    throw new Error(`Organization "${orgName}" does not exist.`);
  }

  const { user, created: userCreated } = await findOrCreateUser({
    email: userEmail,
    firstName: userFirstName,
    lastName: userLastName,
    password: userPassword,
  });

  const { created: membershipCreated } = await ensureMembership({
    userId: user.id,
    organizationId: organization.id,
    role,
  });

  console.log(
    [
      `User account ready.`,
      `Organization: ${organization.name}`,
      `User: ${user.email}${userCreated ? " (created)" : " (existing)"}`,
      `Role: ${role}${membershipCreated ? " (membership created)" : " (membership already exists)"}`,
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
