# Events (Calendar)

**Primary responsibility:** everything that happens at a specific time in the owner's life — the calendar. Phase 2 scope.

**Entities:** Event (see `docs/domain/glossary.md`); relates to Life Area, Task (N:N), Reminder.

## Business rules (owner-validated 2026-08-03)

- An Event is anchored to a specific date/time (start required, end optional) and occupies a calendar slot (FR-020).
- An Event has NO completion state — it occurs or is cancelled, never "done" (glossary distinction).
- Events never convert into Tasks and vice versa; they relate through N:N links (FR-010).
- Events can recur ("meeting every Monday", FR-026) per ADR-0006: the recurring Event is ONE master record referencing a Recurrence Series; occurrences are expanded virtually over the visible window (never materialized); "only this" edits become Event Exception records (cancel/move); "this and future" is deferred to an explicit series split.
- Day view (chronological, FR-023) is Must; week view (FR-024) is Should.
- A Reminder can be attached to an Event, firing at a chosen moment relative to its start (FR-025).

## Phase 2 FR set

FR-020..026 + FR-010. Exit criterion: the owner replaces Google Calendar for day-to-day use.

## Relationships

- **Tasks** relate via N:N links.
- **Reminders** may point to an Event.
- **Life Areas** group Events.
- **External calendar sync (Google Calendar)** is NOT decided — pending decision 4; do not build against it.

## Resolved 2026-08-03

- Dated Tasks DO surface on the calendar views alongside Events, visually distinct.

## Open Questions

- None — the recurrence model was resolved by `documentation/60-decisions/ADR-0006-recurrence-model.md` (2026-08-03); the owner's single-record + exceptions intuition was adopted as proposed.
