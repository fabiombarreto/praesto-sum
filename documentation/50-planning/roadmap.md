---
status: active
last_updated: 2026-08-03
review_trigger: "a milestone completes, a phase closes, or a backlog idea is triaged"
---

# Roadmap

> **Purpose:** The single place that states where the project is now, what comes next, and what has been delivered — deliberately isolated so its volatility does not contaminate the stable documents.
> **Update when:** A milestone completes, a phase opens or closes, a backlog idea is added or triaged, or anything ships.

## Current phase

> **Phase 0 — Documentation & foundational decisions** · started 2026-08-02 · **in progress**

The project is documentation-first: no code exists yet, no tech stack has been chosen, and the repository is not yet under version control. Phase 0 produces the document set and resolves the pending technical decisions tracked in the [decisions index](../60-decisions/index.md).

## Phases and milestones

> Phase cut lines and exit criteria for Phases 1–2 confirmed by the owner on 2026-08-03. The FR → phase mapping lives in the [functional-requirements traceability](../20-requirements/functional-requirements.md#traceability).

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Documentation & decisions** | Write the full document set; resolve foundational technical decisions | All docs approved by the owner **and** pending decisions 1–3 (data posture, interface type, language & stack) resolved as ADRs |
| **1 — MVP Tasks** | First working software: Task management (FR-001..005, 007, 009, 040, 041, 042, 044, 045) | The owner manages daily Tasks in the assistant instead of the current scattered notes (confirmed 2026-08-03) |
| **2 — Calendar** | Events and Reminders; calendar view of daily life (FR-020..026, FR-010) | The owner replaces Google Calendar for day-to-day use (confirmed 2026-08-03) |
| **Later — future Life Areas** | Other Life Areas beyond tasks and calendar | TBD — pending owner input |

Phases are sequential; a phase opens only when the previous one meets its exit criteria. Pending decision 4 (external calendar integration posture) is expected to be resolved before or during Phase 2 — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md).

## Now / Next / Later

> Draft pending owner validation.

### Now

- Validate the remaining seeded drafts (quality attributes, constraints) — the last Phase 0 gate.
- Close Phase 0 and open Phase 1 (MVP Tasks): scaffold the [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) stack.

### Next

- Implement the Phase 1 FR set in vertical slices, starting with Task CRUD + quick capture.

### Later

TBD — pending owner input. Populated when Phase 0 closes and the MVP scope is frozen.

## Backlog

Ideas land here first. They are raw, unprioritized, and carry no commitment.

### Triage rules

1. An idea becomes a requirement (`FR-nnn` in [functional-requirements](../20-requirements/functional-requirements.md)) **only when accepted** at triage. Until then it has no ID and no priority.
2. An idea parked for more than one audit cycle is **rejected**, with the reason recorded — parking is not a permanent state.
3. Rejected ideas keep their row and move to the *Rejected* subsection below, so no topic is re-litigated from scratch.

### Open ideas

| Idea | Added | Status | Notes |
|---|---|---|---|

*No ideas captured yet.*

### Rejected

| Idea | Added | Rejected | Reason |
|---|---|---|---|

*No rejected ideas yet.*

## Delivery history

Newest first. One row per meaningful delivery, added in the same session it happens.

| Date | Delivered |
|---|---|
| 2026-08-03 | Vision, glossary and requirements validated by the owner; MVP scope frozen (Phase 1 = Tasks; FR-009/010/026/044/045 added; FR-040 promoted to Must) |
| 2026-08-03 | Decision 3 resolved: React 19 SPA + Vite + Hono + Drizzle stack ([ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md)) — all foundational technical decisions closed |
| 2026-08-03 | Decision 2 resolved: single installable PWA as the sole MVP interface ([ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md)) |
| 2026-08-03 | Decision 1 resolved: canonical data on Cloudflare D1 + Workers, PWA-first ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)) |
| 2026-08-03 | Project named **Praesto Sum**, short form `praesto` ([ADR-0002](../60-decisions/ADR-0002-name-the-project-praesto-sum.md)) |
| 2026-08-02 | Documentation structure created (Phase 0 kickoff) |
