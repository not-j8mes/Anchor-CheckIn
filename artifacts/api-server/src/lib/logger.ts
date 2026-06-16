import pino from "pino";
import pinoPretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
  },
  isProduction ? undefined : pinoPretty({ colorize: true, sync: true })
);
