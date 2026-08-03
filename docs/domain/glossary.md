# Glossary

> Derived from `documentation/10-product/glossary.md` (authoritative, owner-validated 2026-08-03). Update both together. Canonical names are fixed — code identifiers must use them exactly.

| Term | Definition | Synonyms to AVOID |
|---|---|---|
| **Task** | Something the owner intends to do. Has a completion state (`open → done`) and no fixed time slot; may carry a **deadline** (complete *by*) OR a **scheduled date** (do *on*) — distinct semantics. | to-do, todo item, action item, chore |
| **Event** | Something that happens at a specific date/time (or range). Occupies a calendar slot; has NO completion state — it occurs or is cancelled, never "done". | appointment, meeting, calendar entry |
| **Reminder** | A notification that directs the owner's attention at a chosen moment — about a Task, about an Event, or **standalone** (e.g. "drink water at 3pm"). Never an item of work itself. | alert, alarm, notification (as a domain term) |
| **Life Area** | A domain of personal life the assistant organizes. Now: Calendar, Tasks. Leading later candidate: Notes/personal information. | module, category, domain, section |

## Resolved distinctions (owner-validated)

- Litmus test: "Can I finish it?" → Task. "Does it occupy a slot in my day whether or not I act?" → Event. "Just a nudge — about one of the other two, or on its own?" → Reminder.
- Tasks never become Events (no time-blocking conversion). They relate through an **N:N link**.
- Recurrence applies to **both** Tasks and Events (shared model designed in Phase 1).
- A Reminder points to at most ONE Task or ONE Event — never both — or to nothing (standalone).
