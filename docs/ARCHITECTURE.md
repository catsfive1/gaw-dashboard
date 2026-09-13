# GAW ModTools Dashboard — Architecture (C4-lite)

Scope: the `gaw-dashboard` SPA (this repo). The GAW ModTools Cloudflare Worker and its D1 database are external systems seen only through their HTTP contract (`/dashboard/*` endpoints). Everything not observable from this repo is marked **TODO: unknown**.

## Level 1 — System context

```mermaid
C4Context
title GAW ModTools Dashboard — System Context

Person(mod, "GAW Moderator", "greatawakening.win moderator / lead")
Person(op, "Operator", "Single-user workstation owner (Agent Modules tab)")

System(dash, "GAW Dashboard SPA", "React SPA on Cloudflare Pages; this repo")
System_Ext(worker, "GAW ModTools Worker", "Cloudflare Worker (gaw-mod-proxy); reads D1/KV/R2/AI bindings. TODO: unknown — separate repo")
System_Ext(d1, "Cloudflare D1", "ModTools datastore (bot/firehose/modmail/audit data). Table names: TODO: unknown")
System_Ext(helper, "Agent Modules Helper", "Localhost daemon 127.0.0.1:8791 (tools/agent-modules-helper.py)")
System_Ext(npm, "npm Registry", "registry.npmjs.org — latest-version fallback")

Rel(mod, dash, "Opens in browser, enters mod/lead tokens")
Rel(dash, worker, "GET /dashboard/* with x-mod-token / x-lead-token")
Rel(worker, d1, "Reads ModTools data")
Rel(op, helper, "Starts helper (pwsh launcher)")
Rel(dash, helper, "GET /health, GET /modules, POST /update (x-am-token)")
Rel(dash, npm, "GET /<pkg>/latest (helper offline fallback)")
```

Context facts (from this repo):

- The SPA is deployed to Cloudflare Pages (`public/_redirects` for SPA routing). Deployed URL/project name: **TODO: unknown**.
- Worker base URL comes from `VITE_WORKER_URL` (`.env.example` points at `https://gaw-mod-proxy.gaw-mods-a2f2d0e4.workers.dev`).
- The helper binds 127.0.0.1 only; CORS allows localhost dev origins and `*.pages.dev`; writes are gated by a per-run token echoed via `/health`.

## Level 2 — Containers (runtime pieces of this repo)

```mermaid
C4Container
title Containers in the browser and beside it

Container_Boundary(browser, "Browser") {
  Container(spa, "Dashboard SPA", "Vite + React 18 + TS + Tailwind + TanStack Query", "Routes: /login, /, /features, /modules + placeholders")
  ContainerStorage(ls, "localStorage", "gaw_dash_mod_token, gaw_dash_lead_token")
}

Container_Boundary(workstation, "Operator workstation") {
  Container(helperd, "Agent Modules Helper", "Python stdlib HTTP daemon", "127.0.0.1:8791; /health /modules /update")
  Container(manifest, "agent-modules.json", "src/data/agent-modules.json", "7-module registry + updateCmd allowlist; shared truth for tab and helper")
}

Rel(spa, ls, "read/write tokens")
Rel(spa, helperd, "version state + allowlisted updates")
Rel(helperd, manifest, "reads allowlisted updateCmd per id")
```

## Level 3 — Components (SPA internals, real paths)

```mermaid
C4Component
title SPA Components

ContainerDb(spa, "Dashboard SPA")

Component(shell, "App shell", "src/App.tsx, src/main.tsx, src/components/Layout.tsx", "Routing, guards, nav")
Component(authg, "AuthGuard / LeadGuard", "src/components/AuthGuard.tsx, LeadGuard.tsx", "Token presence checks")
Component(login, "Login", "src/pages/Login.tsx", "Token entry -> localStorage")
Component(home, "Home", "src/pages/Home.tsx", "/dashboard/summary, 60s poll")
Component(features, "Features", "src/pages/Features.tsx", "/dashboard/features list + /:id detail drawer")
Component(modules, "AgentModules", "src/pages/AgentModules.tsx", "helper + npm registry")
Component(placeholder, "Placeholder", "src/pages/Placeholder.tsx", "/audit /firehose /modmail /mods *")
Component(apilib, "api client", "src/lib/api.ts", "apiFetch, envelope {ok,data,error}, 401 handling")
Component(authlib, "auth store", "src/lib/auth.ts", "localStorage token store, isLead()")
Component(amlib, "agentModules client", "src/lib/agentModules.ts", "helper protocol, npm fallback, version compare")
Component(fmt, "formatters", "src/lib/format.ts", "timeAgo, truncate, formatCents")

Rel(shell, authg, "wraps layout/routes")
Rel(authg, authlib, "getModToken / isLead")
Rel(login, authlib, "saveTokens")
Rel(home, apilib, "GET /dashboard/summary")
Rel(features, apilib, "GET /dashboard/features, /dashboard/features/:id")
Rel(apilib, authlib, "token lookup, clearTokens on 401")
Rel(modules, amlib, "loadModuleStates / updateModule")
Rel(home, fmt, "timeAgoAny")
Rel(features, fmt, "timeAgoAny, truncate, formatCents")
```

## Data flow — request lifecycle

```mermaid
sequenceDiagram
    participant M as Moderator browser
    participant SPA as Dashboard SPA
    participant LS as localStorage
    participant W as GAW ModTools Worker
    participant D1 as Cloudflare D1

    M->>SPA: /login — enter mod (+ optional lead) token
    SPA->>LS: save gaw_dash_mod_token [/lead]
    Note over SPA: AuthGuard checks mod token on every route

    loop every 60s (Home)
        SPA->>W: GET /dashboard/summary (x-mod-token)
        W->>D1: aggregate bot_/firehose/modmail/audit views (TODO: unknown SQL)
        W-->>SPA: {ok, data:{health, actions_24h, firehose, modmail, bot, deathrow_armed}}
    end

    SPA->>W: GET /dashboard/features?limit=50&offset&status
    W-->>SPA: {ok, data:{rows, total}}
    SPA->>W: GET /dashboard/features/:id (on row select)
    W-->>SPA: {ok, data:{feature, polls, votes, decisions, ai_audit}}

    alt token invalid / expired
        W-->>SPA: 401
        SPA->>LS: clearTokens()
        SPA->>M: redirect to /login
    else non-ok envelope
        W-->>SPA: {ok:false, error}
        SPA->>M: inline error + Retry button
    end
```

## Agent Modules side channel

```mermaid
sequenceDiagram
    participant Tab as AgentModules tab
    participant H as Helper 127.0.0.1:8791
    participant N as registry.npmjs.org

    Tab->>H: GET /health
    H-->>Tab: {ok, name, version, token}  (token auto-adopted)
    Tab->>H: GET /modules (x-am-token)
    H-->>Tab: [{id, installed, latest, outdated} x7]
    Note over Tab: helper offline -> npm latest-only fallback (pip modules show "helper offline")

    Tab->>H: POST /update {id} (x-am-token)
    H->>H: run only the allowlisted updateCmd for id (from src/data/agent-modules.json)
    H-->>Tab: {ok, id, output, installed_after}
```

## Deployment shape

```mermaid
flowchart LR
    subgraph Cloudflare
        Pages[Cloudflare Pages<br/>dashboard SPA + _redirects SPA routing] --> Worker[gaw-mod-proxy Worker<br/>VITE_WORKER_URL]
        Worker --> D1[(D1)]
        Worker -.bindings.-> KV[KV]
        Worker -.bindings.-> R2[R2]
        Worker -.bindings.-> AI[Workers AI]
    end
    Browser[Moderator browser] --> Pages
    Browser -.localhost exempt from mixed-content.-> Helper[Helper 127.0.0.1:8791]
```

Notes and unknowns:

- Build output `dist/` is produced by `npm run build` (`tsc -b && vite build`); Pages project name and deployment pipeline: **TODO: unknown**.
- Worker-side CORS configuration for `/dashboard/*`: **TODO: unknown** (the SPA calls the workers.dev origin directly, cross-origin, with `content-type: application/json` + token headers).
- Where the D1 data originates (Discord bot ingestion, site crawler, modmail sync): **TODO: unknown** — owned by the ModTools Worker repo (location: **TODO: unknown**).
- `health.bindings{D1,KV,R2,AI}` is surfaced by `/dashboard/summary`; what each binding is used for server-side is **TODO: unknown**.
