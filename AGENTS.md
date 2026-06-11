# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Single-package **Floating Cinema Gallery**: a Vite + React + React Three Fiber 3D cinema scene. There is no backend, database, or Docker stack. One dev server is enough for full local development.

### Services

| Service | Port | Start command |
|---------|------|---------------|
| Vite dev server | **5174** (fixed in `package.json`) | `npm run dev` |
| Vite preview (optional) | 4173 (default) | `npm run build` then `npm run preview` |

`predev` / `prebuild` run `npm run generate:media`, which scans `public/media/` and writes `public/media-manifest.json`. If you add media while the dev server is already running, run `npm run generate:media` and refresh the browser.

### Standard commands

See `README.md` for user-facing docs. Quick reference:

- **Install / refresh deps:** `npm install` (from repo root)
- **Dev:** `npm run dev` — binds `0.0.0.0:5174` with `--strictPort --force`
- **Typecheck:** `npx tsc --noEmit` (also runs as part of `npm run build`)
- **Build:** `npm run build`
- **Lint:** not configured (no ESLint/Prettier in repo)
- **Tests:** `npm test` is a placeholder and exits with code 1; no test framework is installed

### Gotchas

- **Blank page / Drei–Bloom export errors:** stop the dev server, restart `npm run dev`, and hard-refresh. The dev script uses `--force` to rebuild Vite’s optimized dependency cache; see `vite.config.ts` if issues persist.
- **Port 5174** is intentional to avoid stale preview state from older local servers.
- **No env vars or secrets** are required for local dev.

### Hello-world verification

1. `npm install` then `npm run dev`
2. Open `http://localhost:5174` (or the forwarded port in Cloud)
3. Use waypoint buttons or keys `1`–`4`, drag the canvas to orbit, and confirm the 3D cinema renders
