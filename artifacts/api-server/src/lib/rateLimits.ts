import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Request } from "express";

function normalizeIdentifier(req: Request): string {
  const value = req.body?.identifier ?? req.body?.email;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip ?? "unknown")}:${normalizeIdentifier(req)}`,
  message: { error: "Too many login attempts. Please try again later." },
});

export const publicRegistrationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});

export const eventRegistrantEmailRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registrant email attempts. Please try again later." },
});
