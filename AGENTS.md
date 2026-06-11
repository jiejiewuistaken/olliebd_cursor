# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single-package **Floating Cinema Gallery** — a client-only React Three Fiber 3D cinema scene. No backend, database, Docker, or env files.

### Services

| Service | Port | Command |
|---------|------|---------|
| Vite dev server | 5173 | `npm run dev` |

Only the Vite dev server is required for local development and manual testing.

### Commands (from repo root)

- **Install:** `npm ci` (or `npm install`)
- **Dev:** `npm run dev` — binds `0.0.0.0:5173` (see `package.json`)
- **Typecheck + build:** `npm run build` (`tsc --noEmit` then `vite build`)
- **Preview production build:** `npm run build` then `npm run preview` (also on port 5173 by default)

### Lint / tests

- No ESLint or Prettier config in the repo.
- `npm test` is a placeholder and exits with an error; there is no automated test suite. Use `npm run build` for typechecking and manual browser verification against the dev server.

### Dev server notes

- Use a **tmux** session for long-running `npm run dev` so the process survives across agent turns.
- The app needs **WebGL** in the browser; verify with drag-to-orbit and scroll-to-zoom on the canvas.
- HUD copy in the UI describes gift hint markers on seats — useful for smoke-testing that the scene rendered.

See `README.md` for user-facing controls and setup.
