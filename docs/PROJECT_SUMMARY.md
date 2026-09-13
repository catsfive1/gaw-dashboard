# GAW ModTools Dashboard — Project Summary

- **Repo:** https://github.com/catsfive1/gaw-dashboard (branch `main`)
- **HEAD at documentation time:** `d32ddbc331e2c55bef6c3ff6fcad4c8ab070b3fa` (`docs: add PROJECT_SUMMARY and SECURITY policy`)
- **Version:** 0.3.0 (`package.json`)

## Purpose

A single-page web dashboard for moderators of greatawakening.win (GAW). It reads data collected by the GAW ModTools backend (a Cloudflare Worker backed by D1) and presents it behind token-based login:

- **Overview** — worker binding health (D1/KV/R2/AI), moderator audit actions in the last 24h, active bot polls, feature pipeline counts, firehose capture volume, modmail queue depth, "death row" armed count.
- **Features** — the Discord-bot feature-request pipeline: status filtering, search, pagination, and a detail drawer with tech spec, acceptance criteria, commander decisions, polls with vote tallies, AI cost audit, and the final generated prompt.
- **Agent Modules** — live installed/latest versions for the local C5/Hermes agent toolchain (7 modules), with one-click updates executed by a localhost helper daemon.

Source of truth for the user/privacy story: `public/PRIVACY.md` (the dashboard is part of GAW ModTools, an internal moderator utility; it collects nothing from regular visitors).

## Users

- **GAW moderators** — daily: overview, feature pipeline review, modmail/firehose awareness (the latter two are placeholder pages today).
- **Moderator leads** — pages gated on the optional lead token (`/mods`, currently a placeholder).
- **Operator (single workstation)** — the Agent Modules tab, which pairs with the localhost helper to keep the local agent toolchain current.

## Stack (from `package.json`, `tsconfig.json`, `vite.config.ts`)

| Layer | Choice |
|---|---|
| Bundler/dev server | Vite 5 (port 5173) |
| UI framework | React 18 + `react-router-dom` 6 |
| Language | TypeScript 5.6, `strict: true`, `noUnusedLocals`, `noUnusedParameters` |
| Styling | Tailwind CSS 3.4 (custom colors `ink`/`surface`/`muted` in `tailwind.config.ts`) + `clsx` |
| Data fetching | TanStack Query v5 (staleTime 30s, retry 1, no refetch on focus — `src/main.tsx`) |
| Misc deps | `date-fns` (declared; **not imported anywhere in `src/`** — see Known gaps) |

No test runner, linter, or CI is configured (see Known gaps).

## Modules / components (real paths)

### Entry & shell

| Path | Role |
|---|---|
| `src/main.tsx` | React root; QueryClient + BrowserRouter providers |
| `src/App.tsx` | Route table; `AuthGuard` wraps the layout, `LeadGuard` wraps `/mods` |
| `src/components/Layout.tsx` | Top nav (Home, Features, Agent Modules) + logout. Placeholder routes deliberately hidden from nav since v0.3.0 |
| `src/components/AuthGuard.tsx` | Redirects to `/login` when no mod token |
| `src/components/LeadGuard.tsx` | Renders a 403 panel when no lead token |
| `src/pages/Login.tsx` | Mod-token (required) + lead-token (optional) entry form |

### Feature pages

| Path | Role |
|---|---|
| `src/pages/Home.tsx` | Overview; polls `/dashboard/summary` every 60s; exports `StatusPill` shared with Features |
| `src/pages/Features.tsx` | Pipeline list (`limit`/`offset`/`status` query params, page size 50) + detail drawer per feature |
| `src/pages/AgentModules.tsx` | Module table, helper-online banner, update buttons, update output log |
| `src/pages/Placeholder.tsx` | Generic placeholder used by `/audit`, `/firehose`, `/modmail`, `/mods`, `*` |

### Libraries & data

| Path | Role |
|---|---|
| `src/lib/api.ts` | `apiFetch` — token headers, JSON envelope `{ok, data?, error?}`, `ApiError`, 401 → clear tokens + redirect |
| `src/lib/auth.ts` | localStorage token store (`gaw_dash_mod_token`, `gaw_dash_lead_token`), `isLead()` |
| `src/lib/format.ts` | Pure helpers: `timeAgo`/`timeAgoAny` (s/ms heuristic), `truncate`, `formatCents` |
| `src/lib/agentModules.ts` | Helper client (`127.0.0.1:8791`: `/health`, `/modules`, `/update`, `x-am-token`), npm-registry fallback, dotted-version compare |
| `src/data/agent-modules.json` | Canonical module manifest (7 modules: liteparse, wrangler, yt-dlp, firecrawl-py, sentence-transformers, zvec, playwright); read by both the tab and the helper; `updateCmd` is an execution allowlist |

### Tooling

| Path | Role |
|---|---|
| `tools/agent-modules-helper.py` | Localhost-only daemon (binds 127.0.0.1:8791; CORS limited to localhost dev + `*.pages.dev`; per-run token gates writes; executes only allowlisted `updateCmd`s) |
| `tools/agent-modules-helper.ps1` | Launcher for the above |
| `public/_redirects` | Cloudflare Pages SPA routing |
| `public/PRIVACY.md` | Privacy policy, copied into `dist/` |

## Data flow (Worker endpoints the SPA actually calls)

All backend reads go through `src/lib/api.ts` against `VITE_WORKER_URL` (from `.env`; default points at the `gaw-mod-proxy` workers.dev deployment):

| Endpoint | Caller | Refresh | Returns |
|---|---|---|---|
| `GET /dashboard/summary` | `Home.tsx` | 60s interval | `health.bindings{D1,KV,R2,AI}`, `actions_24h`, `actions_sparkline`, `firehose{posts_24h, comments_24h, crawl_state[]}`, `modmail{open_threads, pending_enrichment}`, `bot{by_status, open_polls}`, `deathrow_armed` |
| `GET /dashboard/features?limit&offset&status` | `Features.tsx` | per query key | `{rows[], total, limit, offset}` |
| `GET /dashboard/features/:id` | `Features.tsx` drawer | on select | `{feature{...spec/acceptance/final_prompt}, polls[], votes[], decisions[], ai_audit{total_cost_cents, call_count}}` |

Side channel (no Worker involvement): `AgentModules.tsx` → localhost helper at `http://127.0.0.1:8791` (`/health`, `/modules`, `/update`), with fallback `GET https://registry.npmjs.org/<pkg>/latest`.

Auth headers: `x-mod-token` (all calls) or `x-lead-token` when `opts.lead` is set. The D1 table names/SQL behind these endpoints live in the ModTools Worker repo — TODO: unknown (not in this repo).

## How to run / build

```
npm install
cp .env.example .env      # set VITE_WORKER_URL
npm run dev               # http://localhost:5173
npm run build             # tsc -b && vite build -> dist/
npm run preview           # serve the production build
```

Optional, for the Agent Modules tab's update capability:

```
pwsh -NoProfile -ExecutionPolicy Bypass -File tools\agent-modules-helper.ps1
```

## Key files (quick index)

1. `src/App.tsx` — routes and guards
2. `src/lib/api.ts` — the single HTTP seam to the Worker
3. `src/lib/agentModules.ts` + `src/data/agent-modules.json` — helper protocol + manifest
4. `src/pages/Home.tsx` / `src/pages/Features.tsx` — the two real data pages
5. `public/_redirects` — Cloudflare Pages SPA routing
6. `.env.example` — the one required env var

## Recent work (git log -10, oldest → newest, as of this doc)

| SHA | Date | Subject |
|---|---|---|
| `1a300a4` | 2026-04-22 | dashboard 0.2.0: scaffold (0.1.0) + home + features pages wired to real /dashboard/* data |
| `ceebffe` | 2026-04-22 | chore: add _redirects for Cloudflare Pages SPA routing |
| `7acac02` | 2026-04-22 | v0.3.0: CWS cat-choir fixes (CRIT-03 + CRIT-09) |
| `6ca97a7` | 2026-04-22 | docs: v7.0 data categories section in PRIVACY.md |
| `d43ec3b` | 2026-04-22 | docs(privacy): add v7.1 data categories section |
| `ba77d64` | 2026-04-23 | docs(privacy): v7.2 platform hardening data categories section |
| `488e1da` | 2026-04-23 | docs: v8.0 team productivity data categories |
| `ebf5be4` | 2026-07-10 | chore: backup snapshot (9 file(s) changed) |

(Fewer than 10 commits exist in total; the repo history starts at `1a300a4`. HEAD before this doc's commit: `ebf5be4`.)

## Known gaps / TODO

- **Placeholder pages:** `/audit`, `/firehose`, `/modmail`, `/mods` render `Placeholder.tsx`; nav hides them (v0.3.0 CRIT-03 fix).
- **No tests, no lint, no CI:** `package.json` scripts are only `dev` / `build` / `preview`; no `.github/` workflows exist.
- **Unused dependency:** `date-fns` is declared in `package.json` but never imported in `src/` (time formatting is hand-rolled in `src/lib/format.ts`).
- **DASHBOARD_BUILD_PLAN.md:** referenced by the old README; not present in the repo (TODO: unknown — deleted or never committed).
- **D1 table names / worker internals:** not in this repo — TODO: unknown (owned by the ModTools Worker repo, location TODO: unknown).
- **Cloudflare Pages project name / deployed URL:** TODO: unknown (not in repo; only the workers.dev API URL in `.env.example`).
- **CORS handling** for `/dashboard/*` is worker-side — TODO: unknown from this repo.

## Documentation index

| Doc | Purpose |
|---|---|
| `README.md` | Dev/build/auth/routes quickstart |
| `docs/PROJECT_SUMMARY.md` | This file |
| `docs/ARCHITECTURE.md` | C4-lite context/container/component + data-flow diagrams |
| `public/PRIVACY.md` | Privacy policy (v8.0 data categories) |
