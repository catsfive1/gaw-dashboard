# Security Policy — gaw-dashboard

## Reporting a vulnerability

This dashboard is a private-team tool published in a public repo. If you find a security issue
(exposed tokens, auth bypass, injected content):

- open a GitHub issue marked **[security]** at https://github.com/catsfive1/gaw-dashboard/issues, or
- contact the maintainer directly via GitHub.

Do not post exploit details publicly before a fix lands.

## Notes

- The dashboard uses token-based login; tokens live in env/config files that are never committed.
- If you find a committed credential in history, report it — it will be rotated and the history cleaned.
