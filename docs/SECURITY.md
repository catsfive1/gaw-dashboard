# Security Policy — gaw-dashboard

## Reporting a vulnerability

This dashboard is a private-team tool published in a public repo. If you find a security issue
(exposed tokens, auth bypass, injected content):

- open a GitHub issue marked **[security]** at https://github.com/catsfive1/gaw-dashboard/issues, or
- contact the maintainer directly via GitHub.

Do not post exploit details publicly before a fix lands.

## Notes

- The dashboard uses token-based login: the mod/lead tokens are entered on the `/login`
  form and kept in the browser's `localStorage` (`gaw_dash_mod_token`, `gaw_dash_lead_token`),
  then sent as `x-mod-token` / `x-lead-token` headers. They are never placed in URLs.
  The only build-time env var is `VITE_WORKER_URL` (see `.env.example`); it holds no secret.
- If you find a committed credential in history, report it — it will be rotated and the history cleaned.
