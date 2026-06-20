export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  nodeEnv = process.env["NODE_ENV"],
): boolean {
  if (!origin) return true;
  if (nodeEnv !== "production" && allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

export function isSameHostOrigin(
  origin: string | undefined,
  host: string | undefined,
): boolean {
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function hasAdminAccess(
  req: { header(name: string): string | undefined },
  adminToken = process.env["ADMIN_TOKEN"],
  nodeEnv = process.env["NODE_ENV"],
): boolean {
  if (nodeEnv !== "production" && !adminToken) return true;
  if (!adminToken) return false;

  const headerToken = req.header("x-admin-token");
  const authHeader = req.header("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  return headerToken === adminToken || bearerToken === adminToken;
}

export function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}
