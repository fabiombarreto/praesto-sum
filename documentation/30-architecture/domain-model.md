---
status: draft
last_updated: 2026-08-03
review_trigger: "a new domain concept appears, an ambiguity is resolved, or the glossary changes"
---

# Domain Model

> **Purpose:** The stack-independent conceptual model — entities, relationships and invariants — that any future implementation must respect.
> **Update when:** A new domain concept appears, an ambiguity is resolved, or the [glossary](../10-product/glossary.md) changes.

The canonical entity names — **Task**, **Event**, **Reminder**, **Life Area** — are defined in the [glossary](../10-product/glossary.md). This document uses exactly those names.

## Entity diagram

> Core relationships validated by the owner on 2026-08-03; attribute lists remain draft.

```mermaid
erDiagram
    LIFE_AREA ||--o{ TASK : contains
    LIFE_AREA ||--o{ EVENT : contains
    TASK }o--o{ EVENT : "linked to"
    REMINDER }o--o| TASK : "points to"
    REMINDER }o--o| EVENT : "points to"
```

A Reminder points to at most one Task **or** one Event — never both — and may exist standalone, with no target (resolved 2026-08-03). Tasks and Events never convert into one another; they relate through an N:N link.

## Entities

> Draft — attribute lists are a seed pending owner validation; nothing here implies a storage format or schema.

### Task

Something the owner intends to do; it has no fixed position on the calendar by itself.

- Title
- Description (optional)
- Deadline (optional — date to complete *by*) **or** scheduled date (optional — the specific date it is to be done *on*); distinct semantics, resolved 2026-08-03
- Status — lifecycle: `open → done`, nothing else in the MVP (resolved 2026-08-03); deletion covers abandonment, and any new state is a future migration.
- Life Area it belongs to
- Linked Events (zero or more — N:N, resolved 2026-08-03)
- Recurrence (confirmed 2026-08-03; model under research — owner proposed a single-record template + separate occurrence-log entity; resolution lands as ADR-0006)

### Event

Something that occupies a specific position in time on the calendar.

- Title
- Start date/time
- End date/time (or duration)
- Location (optional)
- Life Area it belongs to
- Linked Tasks (zero or more — N:N, resolved 2026-08-03)
- Recurrence (confirmed 2026-08-03; model under research — see the Task recurrence note; resolution lands as ADR-0006)

### Reminder

A notification the system delivers to the owner about a Task or an Event.

- Target — optional: one Task, one Event, or none (standalone Reminders confirmed 2026-08-03)
- Trigger time (absolute, or relative to the target's due date / start time)
- Delivery channel: Web Push to the installed PWA, per [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) and [ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md).

### Life Area

A named domain of the owner's personal life that groups Tasks and Events.

- Name
- Description (optional)
- Initial set of Life Areas: none pre-created — the owner creates areas as needed (resolved 2026-08-03).

## Domain rules and invariants

> Draft — seed rules and open questions, pending owner validation.

1. A Reminder never points to both a Task and an Event at once; it points to one of them or to nothing (standalone) — resolved 2026-08-03.
2. A Task with a deadline or a scheduled date DOES appear on the calendar views alongside Events, visually distinct (day-level item, no time slot) — resolved 2026-08-03.
3. A Task or Event MAY exist without a Life Area; area-less items surface in an implicit "Unsorted" grouping in the UI — no default area is stored — resolved 2026-08-03.
4. Tasks and Events are always distinct and never convert into one another; they relate through an N:N link — resolved 2026-08-03.

## Expected evolution

> Draft — pending owner validation.

The project starts with calendar and tasks and adds other life areas later. The model is designed so that growth is data, not remodeling:

- Adding a new Life Area is creating a new `Life Area` record — it must never require changing the Task, Event or Reminder entities.
- Area-specific concepts that emerge later (e.g. a future health or finance area bringing its own entities) attach to their Life Area as new entities alongside Task and Event, rather than by widening the core entities with area-specific attributes.
- If a future concept genuinely does not fit this shape, that is a glossary + domain-model change with its own ADR, not a silent workaround.
