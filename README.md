# GAW ModTools Dashboard

Web dashboard SPA for GAW moderators (greatawakening.win). Surfaces the worker's D1 data (audit actions, firehose, modmail, bot features/polls) behind token-based login, plus an Agent Modules tab for one-click updates of the local agent toolchain.

Repo: https://github.com/catsfive1/gaw-dashboard (branch `main`). Version: see `package.json` (currently 0.3.0).

## Stack

Vite 5 + React 18 + TypeScript (strict) + Tailwind CSS 3 + TanStack Query v5 + React Router v6.

## Dev

```
npm install
cp .env.example .env
npm run dev
```

Dev server runs on port 5173 (`vite.config.ts`). `.env` needs `VITE_WORKER_URL` (the GAW ModTools Cloudflare Worker base URL; see `.env.example`).

## Build

```
npm run build
```

Output is `dist/`. Deploy target is Cloudflare Pages; `public/_redirects` provides SPA routing. `public/PRIVACY.md` ships with the build.

## Auth

Two tokens, stored in `localStorage`:

- `gaw_dash_mod_token` (required) -> injected as `x-mod-token`
- `gaw_dash_lead_token` (optional, required for `/mods`) -> injected as `x-lead-token`

Tokens are never placed in URLs. `401` responses clear tokens and redirect to `/login`.

## Routes

| Path | Guard | State |
|---|---|---|
| `/login` | none | token entry form |
| `/` | mod | real data — overview from `/dashboard/summary` (60s auto-refresh) |
| `/features` | mod | real data — feature-request pipeline from `/dashboard/features` + detail drawer |
| `/modules` | mod | real data — Agent Modules tab (local helper + npm registry fallback) |
| `/audit` | mod | placeholder |
| `/firehose` | mod | placeholder |
| `/modmail` | mod | placeholder |
| `/mods` | lead | placeholder |
| `*` | mod | Not found placeholder |

Since v0.3.0 the primary nav only links real pages (Home, Features, Agent Modules); placeholder routes remain registered so direct URLs still resolve.

## Agent Modules helper

The `/modules` tab reads installed/latest versions from a localhost-only helper daemon (`tools/agent-modules-helper.py`, launched via `tools/agent-modules-helper.ps1`, binds `127.0.0.1:8791`). The helper executes only the allowlisted `updateCmd` strings from `src/data/agent-modules.json`. When the helper is offline, the tab falls back to latest-version lookups from the public npm registry.

## Docs

- [docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md) — purpose, modules, data flow, key files, recent work
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — C4-lite architecture diagrams
- [public/PRIVACY.md](public/PRIVACY.md) — privacy policy (ships in the build)
