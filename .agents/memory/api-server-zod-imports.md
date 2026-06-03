---
name: API server zod imports
description: api-server esbuild cannot resolve zod/v4 subpath; use @workspace/api-zod for all validators.
---

## Rule
In `artifacts/api-server/src/routes/*.ts`, never `import { z } from "zod/v4"` or `import { z } from "zod"` directly. Always import pre-generated Zod validators from `@workspace/api-zod`.

**Why:** esbuild bundles the api-server and cannot resolve the `zod/v4` subpath export (it fails with "Could not resolve 'zod/v4'"). The lib packages (db, api-zod) compile separately via tsc and handle the subpath fine, but the bundled server artifact cannot.

**How to apply:** When adding a new route that needs request validation: run codegen first (`pnpm --filter @workspace/api-spec run codegen`), then import the generated validators from `@workspace/api-zod` (e.g. `CreateFormFieldBody`, `UpdateFormFieldBody`). If you need ad-hoc validation before codegen exists, do manual JS checks rather than importing zod.
