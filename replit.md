# Church Check-In

A full-stack church kid registration and check-in system. Churches can build custom registration forms, check children in/out, print name labels, and embed registration forms on their existing websites.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/church-checkin run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (organizations, forms, questions, registrations, answers, checkins)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/church-checkin/src/` — React frontend
- `artifacts/church-checkin/src/components/layout/AppLayout.tsx` — sidebar nav layout
- `artifacts/church-checkin/src/pages/` — page components

## Architecture decisions

- OpenAPI-first: spec in `lib/api-spec/openapi.yaml` generates both React Query hooks and Zod server validators via Orval
- Children are derived from registrations (no separate children table) — a child is a registration record
- Labels use a 6-char hex code generated server-side at check-in time; guardian stub duplicates the label for pickup security
- Embed slug is a random 12-char hex assigned at form creation; public forms at `/register/:embedSlug` require no auth

## Product

- Church admins build custom registration forms with a drag-and-drop builder
- Families submit registration via public form (embeddable on any website via iframe)
- Volunteers use the check-in kiosk to search children and print 2"×4" name labels
- Labels include child name, room, guardian, allergies, and a unique pickup security code
- Dashboard shows attendance trends and recent registrations

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after schema changes
- Re-run codegen after any change to `lib/api-spec/openapi.yaml`
- The sidebar uses `SidebarMenuItem` (not `SidebarItem`) from shadcn — there is no `SidebarItem` or `SidebarLabel` export

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
