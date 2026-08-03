---
status: draft
last_updated: 2026-08-02
review_trigger: "a stack-related ADR is accepted, or any technology/version in use changes"
---

# Tech Stack

> **Purpose:** Snapshot of what the project currently runs on, with every row traceable to the ADR that introduced it.
> **Update when:** A stack-related ADR is accepted, a technology is added or replaced, or a version in use changes.

## Current stack

No technology has been chosen yet. This table exists so the shape of the answer is fixed before the answers arrive; every row is filled in only when its origin ADR is accepted.

| Layer | Technology | Version | Origin ADR |
|---|---|---|---|
| Language | TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) | TBD | TBD |
| UI | TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) | TBD | TBD |
| Storage | TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) | TBD | TBD |
| Integrations | TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) | TBD | TBD |
| Tooling | TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) | TBD | TBD |

## Pending stack decisions

The stack is deliberately undecided. The decisions that will fill the table above live in the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) and are taken in the order defined there.

Nothing in this document may be filled in ahead of its ADR — a stack row without a decision record is a decision made by accident.

## Dependency update policy

TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md). A policy (update cadence, how versions are pinned, how breaking upgrades are handled) only makes sense once the stack exists and brings its own package ecosystem.
