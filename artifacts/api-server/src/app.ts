import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  isOriginAllowed,
  isSameHostOrigin,
  parseAllowedOrigins,
} from "./lib/httpGuards";
import {
  attachAuth,
  hasOrganizationPermission,
  requireAuth,
  type OrganizationPermission,
} from "./lib/auth";

const app: Express = express();
const allowedOrigins = parseAllowedOrigins(process.env["CORS_ORIGIN"]);
const jsonBodyLimit = process.env["JSON_BODY_LIMIT"] || "1mb";

app.disable("x-powered-by");

function getBaseContentSecurityPolicyDirectives() {
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    fontSrc: ["'self'", "data:"],
    formAction: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    upgradeInsecureRequests:
      process.env["NODE_ENV"] === "production" ? [] : null,
  };
}

const defaultSecurityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      ...getBaseContentSecurityPolicyDirectives(),
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

const embeddablePublicFormSecurityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: getBaseContentSecurityPolicyDirectives(),
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false,
});

function isEmbeddablePublicFormPage(req: express.Request): boolean {
  return (
    (req.method === "GET" || req.method === "HEAD") &&
    /^\/register\/[^/]+\/?$/.test(req.path)
  );
}

app.use((req, res, next) => {
  const securityHeaders = isEmbeddablePublicFormPage(req)
    ? embeddablePublicFormSecurityHeaders
    : defaultSecurityHeaders;

  securityHeaders(req, res, next);
});

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
// CORS only applies to API traffic. Applying it globally can turn requests for
// static JS/CSS into 500 responses when the app is opened on a custom domain.
app.use("/api", (req, res, next) => {
  const origin = req.header("origin");
  if (
    origin &&
    !isSameHostOrigin(origin, req.get("host")) &&
    !isOriginAllowed(origin, allowedOrigins)
  ) {
    res.status(403).json({ error: "Origin is not allowed by CORS" });
    return;
  }

  cors({
    origin(origin, callback) {
      callback(
        null,
        isSameHostOrigin(origin, req.get("host")) ||
          isOriginAllowed(origin, allowedOrigins),
      );
    },
  })(req, res, next);
});
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

function isPublicApiRoute(req: express.Request): boolean {
  if (req.path === "/healthz") return true;
  if (req.path === "/auth/login" || req.path === "/auth/logout") return true;
  if (req.method === "GET" && req.path === "/auth/me") return true;
  if (req.method === "GET" && /^\/forms\/by-slug\/[^/]+$/.test(req.path))
    return true;
  if (req.method === "POST" && /^\/forms\/\d+\/register$/.test(req.path))
    return true;
  if (req.method === "GET" && /^\/events\/\d+\/rooms$/.test(req.path))
    return true;
  return false;
}

function permissionForApiRoute(
  req: express.Request,
): OrganizationPermission | null {
  const path = req.path;

  if (/^\/organizations\/current\/members(?:\/|$)/.test(path)) return null;
  if (path === "/organizations/current" && req.method === "PUT")
    return "org_settings";
  if (path === "/organizations/current") return null;
  if (/^\/checkins(?:\/|$)/.test(path)) return "checkin";
  if (/^\/forms\/\d+\/registrations(?:\/|$)/.test(path))
    return "registrations";
  if (
    /^\/(?:registrations|children|registration-groups)(?:\/|$)/.test(path)
  )
    return "registrations";
  if (/^\/events\/\d+\/rooms(?:\/|$)/.test(path)) return "rooms";
  if (/^\/events\/\d+\/staff(?:\/|$)/.test(path)) return "staff";
  if (
    /^\/(?:forms|questions|form-fields)(?:\/|$)/.test(path) ||
    /^\/forms\/\d+\/(?:questions|fields)(?:\/|$)/.test(path)
  )
    return "forms";
  if (path === "/stats/dashboard") return "events";
  if (/^\/stats(?:\/|$)/.test(path)) return "reports";
  if (
    /^\/admin(?:\/|$)/.test(path) ||
    (req.method !== "GET" && /^\/event-categories(?:\/|$)/.test(path)) ||
    (req.method !== "GET" && /^\/events(?:\/\d+)?\/?$/.test(path))
  )
    return "event_settings";
  if (/^\/event-categories(?:\/|$)/.test(path)) return "events";
  if (/^\/events(?:\/|$)/.test(path)) return "events";
  return null;
}

const EVENT_WORKSPACE_PERMISSIONS: OrganizationPermission[] = [
  "events",
  "checkin",
  "registrations",
  "rooms",
  "staff",
  "forms",
  "reports",
  "event_settings",
];

app.use("/api", attachAuth, (req, res, next) => {
  if (isPublicApiRoute(req)) {
    next();
    return;
  }
  requireAuth(req, res, () => {
    const permission = permissionForApiRoute(req);
    const canReadEventMetadata =
      permission === "events" &&
      req.method === "GET" &&
      /^\/events(?:\/\d+)?\/?$/.test(req.path) &&
      EVENT_WORKSPACE_PERMISSIONS.some((candidate) =>
        hasOrganizationPermission(req.auth, candidate),
      );
    if (
      permission &&
      !canReadEventMetadata &&
      !hasOrganizationPermission(req.auth, permission)
    ) {
      res.status(403).json({ error: "You do not have access to this area" });
      return;
    }
    next();
  });
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
