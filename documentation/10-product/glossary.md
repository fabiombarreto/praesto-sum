---
status: active
last_updated: 2026-08-03
review_trigger: "a new domain concept appears or an ambiguity between terms is resolved"
---

# Glossary

> **Purpose:** Define the canonical domain vocabulary so every document, discussion and (future) identifier uses exactly the same names for the same concepts.
> **Update when:** A new domain concept appears, an ambiguity is resolved, or the owner validates a draft definition. Mirror structural changes in [domain-model](../30-architecture/domain-model.md).

## Canonical terms

> Definitions validated by the owner on 2026-08-03. Term names (Task, Event, Reminder, Life Area) are canonical and fixed.

| Term | Definition | Synonyms to avoid |
|---|---|---|
| **Task** | Something the owner intends to do. Has a completion state (done / not done) and no fixed time slot of its own; it may carry a due date, but a due date is not a time slot. | to-do, todo item, action item, chore |
| **Event** | Something that happens at a specific date and time (or a date/time range). Occupies a slot on the calendar and has no completion state — it occurs (or is cancelled), it is not "done". | appointment, meeting, calendar entry |
| **Reminder** | A notification that directs the owner's attention at a chosen moment — about a Task, about an Event, or standalone (e.g. "drink water at 3pm"). It is never an item of work in itself. | alert, alarm, notification (as a domain term) |
| **Life Area** | A domain of personal life the assistant organizes (e.g. Calendar, Tasks now; others later). The top-level unit of scope in the [vision](vision.md). | module, category, domain, section |

Formerly open points, resolved by the owner on 2026-08-03:

- A Reminder **can** exist standalone, attached to nothing.
- Tasks never become Events — no time-blocking conversion. Instead, Tasks and Events relate through an **N:N link**, and a Task may carry either a **deadline** (complete by) or a **specific date** on which it is to be done.
- Recurrence applies to **both** Tasks and Events.

## Resolved distinctions

> Validated by the owner on 2026-08-03.

**Task vs Event vs Reminder**

- A **Task** is *something to do*: it exists to be completed, has no fixed time slot, and stays open until the owner marks it done.
- An **Event** is *something that happens*: it is anchored to a specific time, appears on the calendar, and has no completion state.
- A **Reminder** is *a notification* — about a Task, about an Event, or standalone: it carries no work of its own and no calendar slot; it only directs attention at a chosen moment.

Litmus test: "Can I finish it?" → Task. "Does it occupy a slot in my day whether or not I act?" → Event. "Is it just a nudge — about one of the other two, or on its own?" → Reminder.

## Parking lot

Concepts that may matter for future Life Areas but are **not yet modeled**. Listing here reserves the discussion, not the term — nothing below is canonical.

| Concept | Why it might matter | Status |
|---|---|---|
| Future Life Area candidates (e.g. finances, health, habits, notes) | Would each bring their own vocabulary | TBD — pending owner input |
| Recurrence | Confirmed for both Tasks and Events (2026-08-03); the shared model (rules, exceptions, end conditions) still needs design | Modeled with the MVP requirements |
| Project / grouping of Tasks | Larger goals may need Tasks grouped | Not needed for the seed scope |
| Priority / urgency | Ordering Tasks may need a canonical scale | Not needed for the seed scope |
