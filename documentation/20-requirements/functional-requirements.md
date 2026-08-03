---
status: active
last_updated: 2026-08-03
review_trigger: "the owner validates the seeded requirements or confirms the MVP scope, or a scope change / accepted backlog idea touches any FR"
---

# Functional Requirements

> **Purpose:** The single list of what the system must do, as stable `FR-nnn` requirements prioritized with MoSCoW.
> **Update when:** Scope changes, a backlog idea is accepted, a requirement changes lifecycle state, or the owner validates a seeded requirement.

## How to read this document

- Every requirement has a stable ID `FR-nnn` (see [documentation-guidelines](../00-meta/documentation-guidelines.md)). IDs are never reused; a removed requirement is marked **withdrawn** and keeps its ID.
- IDs are allocated in blocks per area: `001–019` Tasks, `020–039` Calendar, `040–059` cross-cutting. A new area gets the next free block.
- Domain terms (Task, Event, Reminder, Life Area) are used exactly as defined in the [glossary](../10-product/glossary.md).
- Every requirement carries exactly one MoSCoW priority (**Must / Should / Could / Won't**), as defined in the [documentation-guidelines](../00-meta/documentation-guidelines.md#prioritization-moscow).
- Every requirement carries one lifecycle state:
  - **proposed** — drafted, not yet validated by the owner.
  - **accepted** — validated by the owner; part of committed scope.
  - **delivered** — implemented and in use.
  - **withdrawn** — removed from scope; the ID is retired, never reused.

## MVP scope

**Frozen by the owner on 2026-08-03.** The MVP is **Phase 1 — Tasks**: FR-001..005 and FR-007 (Task CRUD, dates, listing/filtering), FR-009 (Task recurrence per ADR-0006), FR-011/FR-012 (miss visibility and repeated-miss notifications — added 2026-08-03 with ADR-0006), FR-040 (search), FR-041 (notifications), FR-042 (export — day-1 safeguard of [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)), FR-044 (standalone Reminders) and FR-045 (quick capture). Exit criterion: the owner manages daily Tasks in Praesto Sum instead of the current scattered notes. Phase 2 (Calendar) follows per the [traceability](#traceability) below.

## Functional requirements — Tasks

> Validated by the owner on 2026-08-03.

| ID | Requirement | MoSCoW | Status |
|---|---|---|---|
| FR-001 | The owner can create a Task with at least a title. | Must | accepted |
| FR-002 | The owner can edit any attribute of an existing Task. | Must | accepted |
| FR-003 | The owner can mark a Task as completed, and undo the completion. | Must | accepted |
| FR-004 | The owner can delete a Task. | Must | accepted |
| FR-005 | A Task can carry an optional **deadline** (a date to complete *by*) *or* an optional **scheduled date** (the specific date it is to be done *on*). | Must | accepted |
| FR-006 | A Task can carry an optional priority level. | Should | accepted |
| FR-007 | The owner can list Tasks and filter them by completion status, dates and priority. | Must | accepted |
| FR-008 | A Task can be assigned to a Life Area. | Could | accepted |
| FR-009 | A Task can recur on a schedule (e.g. "pay rent on the 5th"), per the model in [ADR-0006](../60-decisions/ADR-0006-recurrence-model.md): shared rule, materialized current occurrence (at most one open per series), occurrences superseded without completion recorded as `missed`. | Should | accepted |
| FR-010 | A Task can be linked to any number of Events and vice versa (N:N); the link is navigable from both sides. | Should | accepted |
| FR-011 | Missed occurrences of recurring Tasks are permanently recorded and constantly visible: per-series adherence (miss counts, streaks, completion rate) and a view of recent misses. | Should | accepted |
| FR-012 | When the same recurring Task is missed repeatedly, the assistant proactively notifies the owner (threshold and cadence defined at design time). | Should | accepted |

## Functional requirements — Calendar

> Validated by the owner on 2026-08-03.

| ID | Requirement | MoSCoW | Status |
|---|---|---|---|
| FR-020 | The owner can create an Event with a title, a date and a start time (end time optional). | Must | accepted |
| FR-021 | The owner can edit any attribute of an existing Event. | Must | accepted |
| FR-022 | The owner can delete an Event. | Must | accepted |
| FR-023 | The owner can see all Events of a given day in chronological order (day view). | Must | accepted |
| FR-024 | The owner can see all Events of a given week (week view). | Should | accepted |
| FR-025 | The owner can attach a Reminder to an Event **or a Task**, set to fire at a chosen moment (absolute, or relative to the Event start / Task deadline). | Must | accepted |
| FR-026 | An Event can recur on a schedule (e.g. "meeting every Monday"), sharing the recurrence model of FR-009. | Should | accepted |

## Cross-cutting requirements

> Validated by the owner on 2026-08-03. FR-040 was promoted Should → Must: retrieval is a core owner pain (vision: found-again rate).

| ID | Requirement | MoSCoW | Status |
|---|---|---|---|
| FR-040 | The owner can search Tasks and Events by text. | Must | accepted |
| FR-041 | A due Reminder produces a notification the owner actually perceives. Delivery mechanism per [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md): Web Push to the installed PWA ([ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md)), fired by a server-side scheduler; fallback channels may be added. | Must | accepted |
| FR-042 | The owner can export all personal data on demand, in an open, documented format. | Must | accepted |
| FR-043 | Personal data is backed up automatically. | Should | accepted |
| FR-044 | The owner can create a standalone Reminder attached to nothing (e.g. "drink water at 3pm"), firing at a chosen time. | Must | accepted |
| FR-045 | Adding a Task, Event or Reminder takes near-zero friction on any device (quick capture — principle 5 in the [vision](../10-product/vision.md)). | Must | accepted |

## Future Life Areas

Candidates only — no IDs are allocated until an area enters scope. This list is a generic seed; the actual Life Areas that matter to the owner are TBD — pending owner input.

- Finances (budget, recurring bills)
- Health and habits
- Notes / journal
- Contacts and relationships
- Home maintenance

## Out of scope for now

> Draft pending owner validation. Items here have no IDs; anything promoted into scope receives the next free `FR-nnn` in its area.

| Item | Why out for now |
|---|---|
| Multi-user access, sharing, collaboration | The project has exactly one user by definition — see [vision](../10-product/vision.md). |
| Team / work project management | Different problem domain; this assistant organizes personal life. |
| Email or messaging client features | Adjacent tools already do this; integration could be a future Life Area at most. |
| Natural-language / AI capture of Tasks and Events | Attractive but not needed to prove the core loop; revisit after the MVP. |

External calendar integration (e.g. Google Calendar sync) is deliberately **not** listed here: it is an open question in the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md), not a rejected idea.

## Traceability

Mapping of requirements to the phases confirmed by the owner on 2026-08-03 (see the [roadmap](../50-planning/roadmap.md)).

| Requirement(s) | Roadmap phase |
|---|---|
| FR-001 … FR-005, FR-007, FR-009, FR-011, FR-012 (Tasks) | Phase 1 — MVP Tasks |
| FR-040, FR-041, FR-042, FR-044, FR-045 (cross-cutting) | Phase 1 — MVP Tasks |
| FR-020 … FR-026 (Calendar), FR-010 (Task ↔ Event links) | Phase 2 — Calendar |
| FR-006, FR-008, FR-043 | Unscheduled — assigned at a later triage |
