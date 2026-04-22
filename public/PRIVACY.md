# GAW ModTools — Privacy Policy

**Effective:** 2026-04-22
**Publisher:** GAW ModTools (an internal tool for greatawakening.win moderators)
**Contact:** catsfive@yahoo.com

## TL;DR

GAW ModTools is a moderator utility. It is only useful to logged-in moderators of `greatawakening.win`. It does not collect data from regular site visitors. It sends **no** data to third parties other than the services strictly required to run it (a private Cloudflare Worker and, for certain AI features, xAI's chat completion API — routed server-side through the Cloudflare Worker, never from the browser).

## What the extension reads

When an authenticated moderator is browsing `greatawakening.win`, the extension reads:

- Public content rendered by the site: usernames, post titles, comment text, timestamps, flair, modmail threads already visible to that moderator.
- The moderator's own session CSRF token (read from the page's existing cookie / meta / hidden form input), so that moderation actions the mod initiates can be submitted on the same terms the native site uses.
- The moderator's local extension settings (toggles, pattern lists, display preferences), which live in `chrome.storage.local` on the moderator's own machine.

The extension does **not** read or transmit the content of any user who is not already a moderator with legitimate access to that content.

## What the extension sends, and where

The extension communicates with exactly one backend:

- **Cloudflare Worker** (`https://gaw-mod-proxy.gaw-mods-a2f2d0e4.workers.dev`) — a private worker owned by the tool's maintainer. Mod actions, shared flags, modmail enrichment requests, and AI requests go here. All traffic is authenticated with a per-moderator token.

The worker may, on the moderator's behalf:

- Call **Cloudflare Workers AI** (Llama 3 family) for username scoring and ban-reply drafts. Data stays within Cloudflare.
- Call **xAI's chat completion API** (`api.x.ai`) for the same kinds of requests when the moderator has selected the Grok engine. The xAI API key lives only as a Cloudflare secret; it is never exposed to the browser.

The extension does not send analytics, does not phone home to any other host, and does not include any tracking SDKs.

## What is stored, and for how long

- **On the moderator's machine** (`chrome.storage.local`): the moderator's worker token, lead-mod token (if applicable), feature toggles, pattern lists, local cache of recently viewed profile intel. Removing the extension clears this.
- **On the Cloudflare Worker** (D1, KV, R2): team-shared flags, audit log of moderation actions, cached profile intel, modmail enrichment results, evidence snapshots captured at action time. Retention: audit log kept indefinitely; cached intel and modmail enrichment expire automatically; evidence snapshots kept for the duration of the moderation review and then purged.

Raw personal data — email addresses, phone numbers, payment details, government IDs — is **not** collected, processed, or stored. The extension has no access to such data because greatawakening.win does not expose it to moderators in the first place.

## What the extension does not do

- Does not access or transmit data from websites other than `greatawakening.win` and its subdomains.
- Does not track moderator browsing activity.
- Does not sell, share, or hand over data to advertisers, data brokers, or any third party beyond the two services listed above.
- Does not bypass authentication or access content a moderator is not already entitled to see.
- Does not inject scripts into the host page that modify its native network APIs.

## Rights and requests

Because the extension is used by a small team of moderators, any question, correction, or deletion request should be sent to the contact address above. Deletion of a moderator's audit-log entries on request is supported (the tool's maintainer can remove rows by moderator ID).

## v7.0 data categories

v7.0 introduces two new worker-side data classes:

- **Precedent entries.** Moderator-authored structured notes tagged to resolved cases (kind, signature, title, optional rule reference, action taken, optional reason, optional source permalink, authoring mod username, timestamp). Purpose: cross-mod consistency. Retention: same class as the audit log (indefinite). Deletable by a lead mod via `/precedent/delete` on request or when a mod leaves the team.

- **AI context payloads.** When a moderator clicks "Generate recommendation" in the Intel Drawer, the worker sends the subject kind (User/Thread/Post/QueueItem), subject id, and a minimal context object (username, recent audit events, or post title + excerpt) to xAI's Grok model via the worker proxy. The xAI API key never leaves the Cloudflare secret store. No PII beyond what a moderator already sees in the extension is transmitted. Responses are not stored.

The Intel Drawer itself reads and writes only from existing data classes (profiles, audit log, modmail threads); opening a drawer does not create new records beyond the optional precedent mark.

## Changes

This policy is versioned with the extension. Material changes will ship alongside a version bump and a release note. The current source of truth is the file at this URL.
