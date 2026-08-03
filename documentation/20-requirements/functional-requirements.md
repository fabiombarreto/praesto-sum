---
status: draft
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

TBD — pending owner input.

The requirements seeded below are **candidates, not commitments**. The MVP is defined only when the owner promotes a set of them from `proposed` to `accepted` and the cut line is recorded here.

## Functional requirements — Tasks

> Seed content: draft pending owner validation. All priorities are initial guesses.

| ID | Requirement | MoSCoW | Status |
|---|---|---|---|
| FR-001 | The owner can create a Task with at least a title. | Must | proposed |
| FR-002 | The owner can edit any attribute of an existing Task. | Must | proposed |
| FR-003 | The owner can mark a Task as completed, and undo the completion. | Must | proposed |
| FR-004 | The owner can delete a Task. | Must | proposed |
| FR-005 | A Task can carry an optional due date. | Must | proposed |
| FR-006 | A Task can carry an optional priority level. | Should | proposed |
| FR-007 | The owner can list Tasks and filter them by completion status, due date and priority. | Must | proposed |
| FR-008 | A Task can be assigned to a Life Area. | Could | proposed |

## Functional requirements — Calendar

> Seed content: draft pending owner validation. All priorities are initial guesses.

| ID | Requirement | MoSCoW | Status |
|---|---|---|---|
| FR-020 | The owner can create an Event with a title, a date and a start time (end time optional). | Must | proposed |
| FR-021 | The owner can edit any attribute of an existing Event. | Must | proposed |
| FR-022 | The owner can delete an Event. | Must | proposed |
| FR-023 | The owner can see all Events of a given day in chronological order (day view). | Must | proposed |
| FR-024 | The owner can see all Events of a given week (week view). | Should | proposed |
| FR-025 | The owner can attach a Reminder to an Event, set to fire ahead of its start. | Must | proposed |

## Cross-cutting requirements

> Seed content: draft pending owner validation. All priorities are initial guesses.

| ID | Requirement | MoSCoW | Status |
|---|---|---|---|
| FR-040 | The owner can search Tasks and Events by text. | Should | proposed |
| FR-041 | A due Reminder produces a notification the owner actually perceives. Delivery mechanism per [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md): Web Push to the installed PWA ([ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md)), fired by a server-side scheduler; fallback channels may be added. | Must | proposed |
| FR-042 | The owner can export all personal data on demand, in an open, documented format. | Must | proposed |
| FR-043 | Personal data is backed up automatically. | Should | proposed |

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

Mapping of requirements to delivery phases. Mostly TBD until the phases in the [roadmap](../50-planning/roadmap.md) are confirmed.

| Requirement(s) | Roadmap phase |
|---|---|
| FR-001 … FR-008 (Tasks) | TBD — pending owner input |
| FR-020 … FR-025 (Calendar) | TBD — pending owner input |
| FR-040 … FR-043 (cross-cutting) | TBD — pending owner input |
