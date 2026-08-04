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

## Google Calendar (bidirectional, Events only)

- **Purpose:** mirror the owner's commitments both ways (FR-027..FR-030), decided by `documentation/60-decisions/ADR-0007-google-calendar-bidirectional-sync.md`.
- **Auth:** OAuth 2.0 user consent; the long-lived **refresh token is a Worker secret** (`GOOGLE_REFRESH_TOKEN`), never committed. The OAuth app must be in *published* status — in "Testing" the refresh token expires every 7 days.
- **Scope:** `calendar.events.readonly` for the read phase, upgraded to `calendar.events` at an explicit re-consent for write. **Never `calendar`** (it can delete whole calendars).
- **Transport:** polling on the existing `*/5` cron — **not** `events.watch` webhooks, which would need a public unauthenticated route (breaching ADR-0003 safeguard 4) and are not reliable enough to replace polling anyway.
- **Gotchas:** incremental pull uses `syncToken` with **frozen query parameters** and `showDeleted=true` (deletions arrive as `status: cancelled`); `410 GONE` is routine and recovers by full re-sync **as upsert with zero deletions**; writes carry `If-Match` (412 = conflict, never force) and a deterministic insert id so a retry yields 409 instead of a duplicate; the free-plan cron caps subrequests, so backfill is bounded and resumable with a persisted cursor.
- **Boundaries:** only Events cross; see `docs/anti-patterns.md` for the six rules this integration must not break.
