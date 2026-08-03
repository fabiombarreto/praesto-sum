---
status: draft
last_updated: 2026-08-03
review_trigger: "a stack-related ADR is accepted, or any technology/version in use changes"
---

# Tech Stack

> **Purpose:** Snapshot of what the project currently runs on, with every row traceable to the ADR that introduced it.
> **Update when:** A stack-related ADR is accepted, a technology is added or replaced, or a version in use changes.

## Current stack

The stack is now fully decided ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) / [ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md) / [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md)). Exact versions are recorded here when the scaffold lands, and are always pinned exact (`save-exact`).

| Layer | Technology | Version | Origin ADR |
|---|---|---|---|
| Hosting / runtime | Cloudflare Workers (serverless, free plan) + cron triggers + static assets | n/a | [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) |
| Storage | Cloudflare D1 (SQLite-class, canonical copy) + Drizzle ORM; migrations via `drizzle-kit generate` → `wrangler d1 migrations apply` | TBD at scaffold | [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) / [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| Language | TypeScript (strict) across app, worker and shared code | TBD at scaffold | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| UI | React 19 SPA + Vite + `@cloudflare/vite-plugin` + `vite-plugin-pwa` (injectManifest) | TBD at scaffold | [ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md) / [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| API | Hono 4 (bearer-token middleware; `scheduled()` cron in the same Worker) | TBD at scaffold | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| Integrations | Web Push via `web-push` + `nodejs_compat`; external calendar TBD — decision 4 in [60-decisions/index.md](../60-decisions/index.md) | TBD at scaffold | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) (push) |
| Tooling | npm (`save-exact`), Vitest + `@cloudflare/vitest-pool-workers`, Prettier, ESLint (minimal flat config), wrangler | TBD at scaffold | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |

## Pending stack decisions

Only decision 4 (external calendar integration posture) remains in the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md).

Nothing in this document may be filled in ahead of its ADR — a stack row without a decision record is a decision made by accident.

## Dependency update policy

Per [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md): all versions pinned exact (`save-exact`), lockfile committed, `npm ci` on return. Upgrades are deliberate, changelog-in-hand events — never incidental — budgeted at ~one weekend per year. Drizzle (still 0.x) is upgraded only with its changelog open.
