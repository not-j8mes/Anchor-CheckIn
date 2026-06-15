---
name: Vite dev server thread exhaustion fix
description: How to fix EAGAIN/newosproc crashes in this Replit container when running Vite + Tailwind v4 + esbuild
---

## The problem
Container nproc limit is ~5 OS threads per process. Running API server + mockup-sandbox + church-checkin concurrently exhausts the limit. Two components fail:

1. **esbuild** (Go binary) — needs ~4-5 OS threads for its runtime even with `GOMAXPROCS=1`. Crashes with `fatal error: newosproc` during Vite's `optimizeDeps` startup scan.
2. **`@tailwindcss/node`** — on ESM import calls `module.register()` which spawns a Node.js Worker thread (mandatory in Node 22+). Crashes with `Error: EAGAIN`.

## The fix (both must be in place)

### 1. Block @tailwindcss/node Worker thread — `disable-tw-esm-hook.cjs`
```js
const m = require('module');
const orig = m.register?.bind(m);
if (orig) {
  m.register = function(specifier, ...rest) {
    if (typeof specifier === 'string' && specifier.includes('tailwindcss')) return;
    return orig(specifier, ...rest);
  };
}
```
Load via `NODE_OPTIONS="--require /abs/path/disable-tw-esm-hook.cjs"` in the workflow command. Tailwind v4 falls back to `jiti` for config loading — works fine for standard setups.

### 2. Disable dep-scan esbuild in vite.config — prevents startup crash
```js
optimizeDeps: {
  noDiscovery: true,
  include: [],
},
```
With these two settings together Vite skips spawning esbuild for dependency pre-bundling entirely.

### 3. Use .mjs config (not .ts) — prevents a third esbuild spawn
Vite processes a `.ts` config file through esbuild. Rename `vite.config.ts` → `vite.config.mjs` so Vite loads it directly as ES module, no esbuild subprocess needed.

### 4. Thread env vars in workflow command
```
GOMAXPROCS=1 RAYON_NUM_THREADS=1 UV_THREADPOOL_SIZE=1
```
These reduce Go/Rust/libuv thread pool sizes but do NOT fix the problem alone — they're complementary.

**Why:** `module.register` in Node 22+ always spawns a Worker regardless of env vars. `GOMAXPROCS=1` does not eliminate the minimum ~4 Go system threads esbuild needs.

## Files changed
- `artifacts/church-checkin/disable-tw-esm-hook.cjs` — the preload patch
- `artifacts/church-checkin/vite.config.mjs` — replaces `vite.config.ts`; contains `optimizeDeps` fix
- `artifacts/church-checkin/.replit-artifact/artifact.toml` — workflow run command with `NODE_OPTIONS` + thread vars
