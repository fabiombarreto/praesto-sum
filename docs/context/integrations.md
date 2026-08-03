# Integrations

> No secret values here — auth types only.

## Cloudflare (platform)

- **Purpose:** hosts everything — Workers (API + cron + static assets) and D1 (canonical data). Free plan.
- **Auth:** `wrangler login` (OAuth) for deploys and remote D1 migrations; local dev needs no account.
- **Surface used:** Workers runtime, D1 bindings, cron triggers, static assets with `single_page_application`.

## Web Push

- **Purpose:** deliver Reminder notifications to the installed PWA (FR-041).
- **Auth:** VAPID key pair — public key embedded in the client subscription flow, **private key stored as a Worker secret** (`.dev.vars` locally, `wrangler secret` in production). Never committed.
- **Library:** `web-push` under `nodejs_compat` (Cloudflare's documented path); `@pushforge/builder` is the edge-native fallback (ADR-0005).
- **Gotcha:** push failure is silent — a dedicated VAPID integration test is mandatory (ADR-0005).

## API auth (own surface)

- **Purpose:** single-user access control for `/api/*`.
- **Auth:** static bearer token (one user, no accounts — CON-002); stored as a Worker secret. Optionally hardened later with Cloudflare Access (ADR-0003 allows without superseding).

## Google Calendar (NOT integrated)

- Pending decision 4 in `documentation/60-decisions/index.md` — privacy × convenience trade-off the owner arbitrates near Phase 2. Do not build against it.
