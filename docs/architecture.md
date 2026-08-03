# Architecture — developer view

> Workflow-focused companion to `docs/context/architecture.md` (rules) and `documentation/30-architecture/` (authoritative diagrams + drivers).

## The whole system in one paragraph

One Cloudflare Worker serves the React PWA's static assets, the Hono JSON API under `/api/*` (bearer token on every route), and a cron-triggered `scheduled()` handler that fires Reminders via Web Push. All data lives in one D1 database, reached through Drizzle. There is no second service, no queue, no sync engine — by decision, not omission (ADR-0003).

## Request paths

- **Interactive:** PWA (React SPA) → `fetch` with bearer token → Hono route → Drizzle → D1 → JSON back → React state.
- **Scheduled:** cron trigger → `scheduled()` → scan due Reminders in D1 → `web-push` (nodejs_compat) → installed PWA's `src/sw.ts` shows the notification. Also runs the export-snapshot job (FR-043).

## Where to add things

| You are adding… | It goes in… |
|---|---|
| A screen or component | `src/app/` |
| An API route | `src/worker/routes/` (wired in the Hono app) |
| A schema change | `src/worker/db/schema.ts` → `npm run db:generate` → migration in `migrations/` |
| Domain logic (dates, recurrence) | `src/shared/` as pure functions + unit tests |
| Push behavior | `src/worker/push/` (server side) and `src/sw.ts` (client side) |

## Non-negotiables while coding

- Never bypass the token middleware; only the PWA shell is public.
- Types flow from the Drizzle schema outward.
- No offline write path of any kind (see `docs/anti-patterns.md`).
