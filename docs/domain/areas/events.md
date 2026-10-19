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
- **External calendar sync (Google Calendar)** is **decided** — `documentation/60-decisions/ADR-0007-google-calendar-bidirectional-sync.md` (2026-08-04): bidirectional, **Events only**, scope `calendar.events` (never `calendar`), polling on the existing cron, read in Phase 1 (unit 4) and write in Phase 2 (unit 15). Access was proven by chore C11 on 2026-08-11, but no integration code exists yet. Consequences that bind Event work from now on: unit 14 `events-and-day-view` must be **born sync-aware** (its migration ships the `event_sync_links` table, `all_day` and IANA timezone become mandatory, `source` (`local` | `google`) is a domain fact, and `computeEventContentHash()` is born pure in `src/shared`); the mirror inventory is closed, so nothing but Events ever crosses; and `docs/anti-patterns.md` carries the six rules this integration must not break — notably no field-level merge, and never `updated_at` as the dirty flag.

## Storage model (ADR-0016, 2026-10-19)

Unit 14 stores a timed Event as two UTC instants (epoch seconds) plus a never-null IANA zone, and an all-day Event as local days with an **exclusive** end (like Google); `end` is mandatory in storage and the form (or the API, for any other caller) fills it when the owner leaves it empty. The Event's `content_hash` lives on the Event row, written by one repository function; `event_sync_links` (empty until unit 15) holds the Google ids, the etag and `synced_content_hash`, and its `event_id` is nullable with `ON DELETE SET NULL` — an orphan link is the pending deletion in Google. Events carry no Life Area yet (deferred, 2026-10-19). One pure `itemsInRange(sources, { from, to })` merges local Events, Google Events and dated Tasks for the day route and *Hoje*'s Agenda.

## Resolved 2026-08-03

- Dated Tasks DO surface on the calendar views alongside Events, visually distinct.

## Open Questions

- None — the recurrence model was resolved by `documentation/60-decisions/ADR-0006-recurrence-model.md` (2026-08-03); the owner's single-record + exceptions intuition was adopted as proposed.
