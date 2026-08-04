---
status: active
last_updated: 2026-08-04
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
| FR-027 | The owner can see Events from his external (Google) calendar inside Praesto, alongside his own items, visually distinct; he chooses which calendars are included. Per [ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md). | Must | accepted |
| FR-028 | Events created, edited or deleted in Praesto are reflected in Google, and vice versa, within one sync cycle. A real conflict surfaces both versions with a restore action — never a silent overwrite. | Must | accepted |
| FR-029 | Recurring Events round-trip between Praesto and Google, including per-occurrence exceptions. A rule Praesto cannot express is preserved verbatim and marked read-only rather than flattened. | Should | accepted |
| FR-030 | The owner can connect and disconnect the external calendar with explicit consent; disconnecting revokes access and preserves 100% of the local data. | Must | accepted |

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

Every accepted requirement now has a phase and a delivery unit. The unit column points at the [roadmap's delivery units](../50-planning/roadmap.md#delivery-units), which carry the order, dependencies and exit signals.

| Requirement(s) | Roadmap phase | Delivery unit(s) |
|---|---|---|
| FR-001, FR-045 | Phase 1 | 1 `install-and-quick-capture` |
| FR-002, FR-003, FR-004, FR-005, FR-006 | Phase 1 | 2 `task-detail-and-dates` |
| FR-007 | Phase 1 | 3 `today-view-and-filters` |
| FR-042, FR-043 | Phase 1 | 4 `data-export` (+ chore C5 for the automated pull) |
| FR-041 | Phase 1 | 5 `push-channel-proven`, 6 `reminders` |
| FR-044, FR-025 (Task side) | Phase 1 | 6 `reminders` |
| FR-040 | Phase 1 | 7 `text-search` (extended to Events in unit 13) |
| FR-009 | Phase 1 | 8 `recurring-tasks`, 9 `missed-sweep` |
| FR-011 | Phase 1 | 9 `missed-sweep` (data), 10 `adherence-mirror` (surface) |
| FR-012 | Phase 1 | 11 `repeated-miss-nudge` |
| FR-008 | Phase 1 | 12 `life-areas` |
| FR-020 … FR-023 | Phase 2 | 13 `events-and-day-view` |
| FR-024 | Phase 2 | 14 `week-view` |
| FR-026 | Phase 2 | 15 `recurring-events` |
| FR-025 (Event side) | Phase 2 | 16 `event-reminders` |
| FR-027, FR-030 | Phase 1 (declared exception) | 4 `google-calendar-read` |
| FR-028 | Phase 2 | 15 `google-calendar-write` |
| FR-029 | Phase 2 | 19 `google-recurring-events-sync` |
| FR-010 | Phase 2 | 20 `task-event-links` |

Corrected on 2026-08-03: FR-006, FR-008 and FR-043 were previously listed as "Unscheduled". FR-043 in particular contradicted [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md), which already treated automated snapshots as a binding safeguard rather than optional work.
