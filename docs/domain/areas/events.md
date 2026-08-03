# Events (Calendar)

**Primary responsibility:** everything that happens at a specific time in the owner's life — the calendar. Phase 2 scope.

**Entities:** Event (see `docs/domain/glossary.md`); relates to Life Area, Task (N:N), Reminder.

## Business rules (owner-validated 2026-08-03)

- An Event is anchored to a specific date/time (start required, end optional) and occupies a calendar slot (FR-020).
- An Event has NO completion state — it occurs or is cancelled, never "done" (glossary distinction).
- Events never convert into Tasks and vice versa; they relate through N:N links (FR-010).
- Events can recur ("meeting every Monday", FR-026), sharing the recurrence model designed with FR-009.
- Day view (chronological, FR-023) is Must; week view (FR-024) is Should.
- A Reminder can be attached to an Event, firing at a chosen moment relative to its start (FR-025).

## Phase 2 FR set

FR-020..026 + FR-010. Exit criterion: the owner replaces Google Calendar for day-to-day use.

## Relationships

- **Tasks** relate via N:N links.
- **Reminders** may point to an Event.
- **Life Areas** group Events.
- **External calendar sync (Google Calendar)** is NOT decided — pending decision 4; do not build against it.

## Open Questions

- Recurrence model design — shared with Tasks, designed during Phase 1.
- Whether dated Tasks surface on the calendar views (see tasks.md open question).
