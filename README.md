# GAW ModTools Dashboard

Web dashboard SPA for GAW moderators. Surfaces the worker's D1 data (audit, firehose, modmail, bot) behind token-based login.

## Stack
Vite + React 18 + TypeScript + Tailwind + TanStack Query v5 + React Router v6.

## Dev

```
npm install
cp .env.example .env
npm run dev
```

## Build

```
npm run build
```

Output is `dist/`. Deploy target is Cloudflare Pages (see `DASHBOARD_BUILD_PLAN.md`).

## Auth

Two tokens, stored in `localStorage`:

- `gaw_dash_mod_token` (required) -> injected as `x-mod-token`
- `gaw_dash_lead_token` (optional, required for `/mods`) -> injected as `x-lead-token`

Tokens are never placed in URLs. `401` responses clear tokens and redirect to `/login`.

## Routes

| Path | Guard |
|---|---|
| `/login` | none |
| `/` | mod |
| `/features` | mod |
| `/audit` | mod |
| `/firehose` | mod |
| `/modmail` | mod |
| `/mods` | lead |

Phase 1 renders placeholder pages; Phases 2-5 wire real data per the build plan.
