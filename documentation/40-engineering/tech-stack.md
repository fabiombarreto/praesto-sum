---
status: draft
last_updated: 2026-08-03
review_trigger: "a stack-related ADR is accepted, or any technology/version in use changes"
---

# Tech Stack

> **Purpose:** Snapshot of what the project currently runs on, with every row traceable to the ADR that introduced it.
> **Update when:** A stack-related ADR is accepted, a technology is added or replaced, or a version in use changes.

## Current stack

Every row is filled in only when its origin ADR is accepted. The hosting/runtime and storage layers were fixed by [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md); the rest follows decisions 2–3.

| Layer | Technology | Version | Origin ADR |
|---|---|---|---|
| Hosting / runtime | Cloudflare Workers (serverless, free plan) + cron triggers | n/a | [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) |
| Storage | Cloudflare D1 (SQLite-class, managed; canonical copy) | n/a | [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) |
| Language | Constrained to JavaScript/TypeScript/WASM by the Workers runtime; final choice TBD — decision 3 in [60-decisions/index.md](../60-decisions/index.md) | TBD | ADR-0003 (constraint) |
| UI | Single responsive web/PWA client; framework TBD — decision 3 in [60-decisions/index.md](../60-decisions/index.md) | TBD | ADR-0003 (shape) |
| Integrations | Web Push (VAPID) for notifications; external calendar TBD — decision 4 in [60-decisions/index.md](../60-decisions/index.md) | TBD | ADR-0003 (partial) |
| Tooling | TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) | TBD | TBD |

## Pending stack decisions

The remaining open layers (frontend framework, tooling) are filled by the decisions in the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md), taken in the order defined there.

Nothing in this document may be filled in ahead of its ADR — a stack row without a decision record is a decision made by accident.

## Dependency update policy

TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md). A policy (update cadence, how versions are pinned, how breaking upgrades are handled) only makes sense once the stack exists and brings its own package ecosystem.
