import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { isOriginAllowed, parseAllowedOrigins } from "./lib/httpGuards";
import { attachAuth, requireAuth } from "./lib/auth";

const app: Express = express();
const allowedOrigins = parseAllowedOrigins(process.env["CORS_ORIGIN"]);
const jsonBodyLimit = process.env["JSON_BODY_LIMIT"] || "1mb";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

function isPublicApiRoute(req: express.Request): boolean {
  if (req.path === "/healthz") return true;
  if (req.path === "/auth/login" || req.path === "/auth/logout") return true;
  if (req.method === "GET" && req.path === "/auth/me") return true;
  if (req.method === "GET" && /^\/forms\/by-slug\/[^/]+$/.test(req.path)) return true;
  if (req.method === "POST" && /^\/forms\/\d+\/register$/.test(req.path)) return true;
  if (req.method === "GET" && /^\/events\/\d+\/rooms$/.test(req.path)) return true;
  return false;
}

app.use("/api", attachAuth, (req, res, next) => {
  if (isPublicApiRoute(req)) {
    next();
    return;
  }
  requireAuth(req, res, next);
});
app.use("/api", router);

const staticDir = process.env["STATIC_DIR"];
if (staticDir) {
  app.use(express.static(staticDir));

  app.use((_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
