# Recurring Tasks

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a PRD that downstream plan, test and implement stages consume); cross-cutting — creates a pure module in src/shared that unit 17 must reuse unchanged, adds a route family to the wire contract, changes the semantics of three existing Task write paths (complete, reopen, delete), adds one migration, and adds a screen control; domain rules for tasks and reminders
- Decisions found: ADR-0006 recurrence model — one shared rule table (`recurrence_series`), one shared pure expansion function resolving each occurrence in local time, Tasks materialize ONLY the current occurrence, at most one open occurrence per active series enforced by a unique index, completing computes the next date, checks end conditions and inserts the successor with its Reminders resolved to absolute UTC instants, deleting the open occurrence skips it, template edits propagate only to the open non-detached occurrence; ADR-0003 thin client over a canonical store (no offline writes); ADR-0005 types flow from src/worker/db/schema.ts through src/worker/dto.ts to src/shared/api.ts, bearer token on every /api/* route; ADR-0008 test-first for routes, validation, data-layer invariants and pure logic in src/shared, UI verified manually; ADR-0009 visible copy pt-BR, everything else English; unit 2 froze the Task wire contract — this PRD only ADDS fields and routes; [2026-09-10] the due-Reminder sweep claims before it sends; [2026-09-10] a relative Task Reminder resolves against end-of-day local (23:59) via `offsetToInstant`; roadmap rule 2 (a unit rises only when its dependencies are `shipped`) — broken here as a recorded exception, see Decisions Log
- Applicable anti-patterns: Hand-duplicated entity types (the series type derives from the Drizzle schema through dto.ts, never declared by hand); Portuguese in artifacts (identifiers, tests and docs English; visible copy pt-BR under the ADR-0009 carve-out); Glossary synonym drift ("Recurrence Series", "Task", "Reminder", "occurrence" — never "habit", "routine", "repeat task"); Mirroring Tasks, Reminders or Life Areas to Google (not approached — series never leave D1); Weakening tests to force green (the existing ADR-0006 invariant tests in test/tasks.test.ts stay as they are)
- Applicable architectural rules: one Worker serves everything; src/shared stays DOM-free, clock-free and dependency-free — the expansion function reads no clock and touches no database; domain enums enforced twice (TypeScript union + SQL CHECK); migrations only via drizzle-kit generate + wrangler d1 migrations apply; API-first internally (routes and tests green before any UI); the UI/UX review checklist is a gate before the merge; the export completeness guard must keep classifying every table (this PRD adds none)
- Result: PROCEED
```

## Problem Statement

The owner's life is full of things that come back — rent on the 5th, a bill every
month, a weekly chore — and Praesto has no idea that a Task can return. Today each
cycle is either re-typed by hand, which is enough friction that it does not happen,
or kept as one open Task whose date gets pushed forward, which silently erases the
record of every cycle already done. That erased record is exactly what units 10–12
(misses, adherence, the repeated-miss nudge) will need to read, so every week this
stays unsolved is history the honest mirror can never recover.

## Evidence

- `documentation/20-requirements/functional-requirements.md:42` — FR-009, "A Task can
  recur on a schedule (e.g. 'pay rent on the 5th')", frozen into the Phase 1 MVP on
  2026-08-03.
- `documentation/10-product/vision.md` principle 6 (honest mirror) and the owner's own
  words recorded in ADR-0006: *"if I keep failing the same tasks while using the app
  correctly, I must be notified and constantly see my misses … Stale data means the
  project itself has failed."* Pushing a Task's date forward is stale data by design.
- The schema for this already exists and is **applied in production**: `recurrence_series`,
  `tasks.series_id / occurrence_date / detached` and both partial unique indexes are in
  `migrations/0000_neat_the_fallen.sql:22-101` and survive unchanged through `0004`.
  What does not exist is any code: no expansion function in `src/shared/`, no route
  that creates a series (`src/worker/routes/` has none), and `complete` / `reopen` /
  `delete` in `src/worker/routes/tasks.ts:313-349` carry no series awareness at all.
  The only recurrence tests insert series rows by hand to prove the indexes reject
  duplicates (`test/tasks.test.ts:115-198`).
- Unit 17 `recurring-events` has as its exit signal *"unit 9's expansion function was
  reused without a single line changed"* — the roadmap already depends on this unit
  producing that function in the right shape.
- **Counter-evidence, recorded rather than hidden:** production data today is test rows
  (the 2026-09-15 read found six `Teste…` reminders and test Tasks). The pain is
  stated by the owner and the vision, not yet measured in real use.

## Proposed Solution

Build the Task half of ADR-0006 exactly as the ADR already decided it: the owner
registers a Recurrence Series once — the rule plus the Task template, including its
reminder offsets — and Praesto materializes **only the current occurrence** as a real
Task row. Completing that occurrence computes the next date, checks the end condition
and inserts the successor, with its Reminders armed through unit 7's machinery, in the
same write. The date arithmetic lives in one pure function in `src/shared/recurrence.ts`
that takes every input as an argument (including "the day it was completed" for
completion-anchored series) and returns local calendar days — it reads no clock and
touches no database, so unit 17 can expand Event series through it unchanged. This
beats the alternatives the ADR already weighed: mass materialization is Taskwarrior's
documented duplicate-row failure (one weekly series grew to 60,749 rows, issue #592),
and fully virtual occurrences make "what was due" derived state, the bug class the ADR
cites from Habitica. Nearly all of the storage work is already in production; one small
migration fixes the template's `priority` column, which unit 2 left behind as `integer`
when it turned `tasks.priority` into the `high | normal | low` enum.

## Key Hypothesis

We believe materializing only the current occurrence of a Recurrence Series, and
spawning its successor on completion, will let the owner register a recurring
commitment once and never re-type it — while keeping a permanent, row-per-cycle
record of what he actually did.
We'll know we're right when, after a month of one real series, it has exactly one open
occurrence, one closed row per completed cycle, no duplicates, and every successor
appeared on the right date with its reminders armed without the owner doing anything
but completing the previous one — and when unit 17 expands Event series through the
same function without changing a line of it.

## What We're NOT Building

- **The `missed` sweep** — marking an occurrence `missed` when its successor's date
  arrives, and repairing a series left without an open occurrence, is unit 10
  `missed-sweep` (FR-009 sweep, FR-011 data). In this unit an unfinished occurrence
  simply stays open and overdue.
- **Adherence and the repeated-miss nudge** — units 11 and 12.
- **Editing the rule of an existing series** (frequency, interval, weekdays, month day,
  anchor, start, end condition). The template (title, description, priority, reminder
  offsets) is editable; the rule is not — end the series and create a new one. Rule
  edits need a decision about what happens to the already-materialized occurrence's
  date, and nothing in the exit signal needs it.
- **Hard-deleting a series.** A series can be ended; its closed occurrences stay as
  history. Deletion would orphan the realization log the next three units read.
- **"This and all future" edits, or detaching a whole tail of occurrences** — ADR-0006
  defers them for Events and there is no Task case for them yet.
- **Recurring Events** — unit 17. This unit only guarantees the expansion function is
  usable for them.
- **Rules Praesto cannot express** (`BYSETPOS`, "last weekday of the month", hourly
  frequencies, multiple month days) — they belong to the Google-sync units, where the
  "store verbatim, mark read-only" rule already exists.
- **Mirroring series or occurrences to Google Calendar** — forbidden by the ADR-0007
  closed mirror inventory.
- **A new migration beyond the `priority` fix** — every other column the unit needs is
  already applied.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Successor appears on the correct date | 100% of completions of one real series over one month | Read the series' rows in production (`occurrence_date` sequence against the rule) at the end of the month |
| Duplicate occurrences | 0 rows violating one-open / one-per-date per series | Production query grouping `tasks` by `series_id, occurrence_date` and by `series_id` where `status = 'open'`; the unique indexes make any other result structurally impossible |
| Successor reminders armed | 100% of successors whose series carries reminder offsets | Production query: every successor has one unsent `reminders` row per template offset, with `fire_at` equal to `offsetToInstant` of its date |
| Expansion reused by unit 17 unchanged | 0 lines changed in `src/shared/recurrence.ts` | `git diff` of that file across unit 17's PR, measured when unit 17 opens |

## Acceptance Criteria (test scenarios)

Test-first: AC-1..AC-25 are the automated contract (Vitest inside workerd, per
`docs/context/testing.md`); AC-26..AC-28 are the manual/device half and produce no test
file, per the methodology's "UI stays manually verified" split. All dates below are
local calendar days (`YYYY-MM-DD`); `tz` is `America/Sao_Paulo` unless stated.

### Phase 1 — the pure expansion function (`src/shared/recurrence.ts`)

- **AC-1 Clock-free:** Given the same rule and the same arguments, when
  `nextOccurrence` and `expandOccurrences` are called twice with the system clock
  faked to two instants a year apart (`vi.setSystemTime`), then both calls return
  identical results — and the module imports nothing from `src/worker/` or `src/app/`
  (the per-target tsconfig makes a violation a compile error).
- **AC-2 Monthly by month day:** Given `{ freq: "monthly", interval: 1, byMonthday: 5,
  dtstart: "2026-08-05" }`, when `nextOccurrence(rule, { after: "2026-08-05" })` is
  called, then it returns `"2026-09-05"`; and `firstOccurrence(rule)` returns
  `"2026-08-05"`.
- **AC-3 Month-day overflow clamps backward (D1):** Given `{ freq: "monthly",
  byMonthday: 31, dtstart: "2026-01-31" }`, when the occurrences from January to April
  2026 are expanded, then they are `2026-01-31, 2026-02-28, 2026-03-31, 2026-04-30` —
  the clamp never drifts the track (March is the 31st, not the 28th); and in 2028 the
  February occurrence is `2028-02-29`.
- **AC-4 Weekly with weekdays and interval:** Given `{ freq: "weekly", interval: 2,
  byWeekday: [1, 4], dtstart: "2026-09-21" }` (a Monday), when expanded from
  `2026-09-21` to `2026-10-09`, then the result is `2026-09-21, 2026-09-24, 2026-10-05,
  2026-10-08`.
- **AC-5 Daily and yearly:** Given `{ freq: "daily", interval: 3, dtstart:
  "2026-09-01" }`, the occurrence after `2026-09-01` is `2026-09-04`; given `{ freq:
  "yearly", dtstart: "2028-02-29" }`, the occurrences are `2028-02-29, 2029-02-28,
  2030-02-28, 2032-02-29`.
- **AC-6 Calendar anchor keeps the track:** Given a calendar-anchored monthly series on
  the 5th, when `nextOccurrence(rule, { after: "2026-08-05", completedOn: "2026-09-20" })`
  is called, then it returns `"2026-09-05"` — the next date on the track after the
  completed occurrence, even if that date is already past (it appears overdue; the
  mirror does not hide a late cycle).
- **AC-7 Completion anchor counts from the completion day (D5):** Given `{ freq:
  "daily", interval: 3, anchorMode: "completion" }`, when `nextOccurrence(rule, { after:
  "2026-09-05", completedOn: "2026-09-10" })` is called, then it returns `"2026-09-13"`;
  and calling it without `completedOn` is a thrown `TypeError`, never a silent read of
  the clock.
- **AC-8 End conditions (D6):** Given `endKind: "until", untilDate: "2026-12-05"` on a
  monthly-on-the-5th series, the occurrence after `2026-12-05` is `null`. Given
  `endKind: "count", maxCount: 3` and `closedCount: 3` (done + missed), the next
  occurrence is `null`; with `closedCount: 2` it is a date.
- **AC-9 Bounded window expansion for unit 17:** Given any rule, when
  `expandOccurrences(rule, { from, to })` is called, then it returns every occurrence
  date in `[from, to]` in ascending order, and it refuses (throws `RangeError`) a window
  longer than 366 days — the guard against a runaway loop.
- **AC-10 Reminder instants for an occurrence:** Given an occurrence day and the
  template's offsets `[1440, 60]`, when `occurrenceReminderInstants(day, offsets, tz)`
  is called, then it returns exactly `offsetToInstant(day, 1440, tz)` and
  `offsetToInstant(day, 60, tz)` — composition of the existing unit 7 helper, no second
  time implementation; and for `tz = "America/New_York"` on `2026-03-08` (a DST
  transition day) the instants match `offsetToInstant`'s already-tested DST handling.

### Phase 2 — the series API (`/api/series`)

- **AC-11 Create materializes the first occurrence:** Given a valid body `{ title:
  "Pagar aluguel", freq: "monthly", byMonthday: 5, dtstart: "2026-10-05", dateMode:
  "deadline", reminderOffsets: [1440] }`, when `POST /api/series` is called with the
  token, then it returns `201` with the series and its first occurrence: one `tasks`
  row with `series_id` set, `occurrence_date = "2026-10-05"`, `deadline = "2026-10-05"`,
  `scheduled_date = null`, `status = "open"`, and one unsent `reminders` row for that
  Task with `origin_offset_minutes = 1440` and `fire_at = offsetToInstant("2026-10-05",
  1440)`.
- **AC-12 Reminder offsets follow the occurrence's own date field (D9):** Given the same
  body with `dateMode: "scheduled"`, when created, then the occurrence carries
  `scheduled_date = "2026-10-05"`, `deadline = null`, and its reminder is computed with
  `offsetToInstant` against that scheduled date.
- **AC-13 Validation writes nothing:** Given a body with, one at a time, an empty title,
  an unknown `freq`, `interval: 0`, `byMonthday: 32`, a `byWeekday` outside 1..7,
  `endKind: "until"` without `untilDate`, both `untilDate` and `maxCount`, an invalid
  date string, or a `priority` outside `high | normal | low`, when `POST /api/series` is
  called, then it returns `400` naming the offending field and no row is written to
  `recurrence_series`, `tasks` or `reminders`.
- **AC-14 Priority is an enum twice (migration 0005):** Given migration `0005` applied,
  when a `recurrence_series` row is inserted directly with `priority = 'urgent'`, then
  the database rejects it by CHECK constraint; and `priority` round-trips as the text
  enum through `RecurrenceSeriesDto`.
- **AC-15 Token gate:** Given no bearer token, when any `/api/series` route is called,
  then it returns `401` and writes nothing.
- **AC-16 Read:** Given two series, when `GET /api/series` and `GET /api/series/:id` are
  called, then they return the series with their current open occurrence id (or `null`),
  and an unknown id returns `404`.
- **AC-17 Template edit propagates only to the open, non-detached occurrence (D7):**
  Given a series with two closed occurrences and one open, non-detached occurrence, when
  `PATCH /api/series/:id` changes `title` and `priority`, then the open occurrence
  carries the new values, the closed rows keep their old ones, and a rule field in the
  body (e.g. `freq`) is rejected with `400` naming it. Given the open occurrence is
  `detached`, then it is left untouched too.
- **AC-18 Ending a series:** Given an active series with an open occurrence, when
  `PATCH /api/series/:id` sets `status: "ended"`, then the series is `ended`, the open
  occurrence stays open, and completing it later spawns nothing.

### Phase 3 — materialization when an occurrence closes

- **AC-19 Completing spawns the successor in the same write:** Given an open occurrence
  `2026-10-05` of the AC-11 series, when `POST /api/tasks/:id/complete` is called, then
  that row is `done` with `completed_at` set, the series' `done_count` is incremented,
  and exactly one new open occurrence exists with `occurrence_date = "2026-11-05"`, the
  template's title/description/priority/date field, and one unsent reminder per
  template offset — and the response carries the new occurrence as an additive
  `successor` field. A one-off Task's complete response has no `successor` key and is
  otherwise byte-identical to today's.
- **AC-20 No duplicate successor:** Given an occurrence already completed, when
  `complete` is called on it again, then no second successor is created; and given two
  `complete` calls issued concurrently on the same open occurrence, then exactly one
  successor exists afterwards (the partial unique indexes are the structural guard, and
  the losing write surfaces as a handled response, never a `500`).
- **AC-21 End conditions stop the series:** Given a series with `endKind: "count",
  maxCount: 2` and one closed occurrence, when the second is completed, then no
  successor is created and the series becomes `ended`; the same for `endKind: "until"`
  when the next track date is after `untilDate`.
- **AC-22 An edited occurrence does not leak into the successor (D2):** Given an open
  occurrence whose title was changed through `PATCH /api/tasks/:id` (so it is
  `detached`), when it is completed, then the successor carries the **series template's**
  title, not the edited one.
- **AC-23 Deleting the open occurrence skips the cycle (D3):** Given an open occurrence
  `2026-10-05`, when `DELETE /api/tasks/:id` is called, then that row and its reminders
  are gone, the successor `2026-11-05` exists open with its reminders armed, and
  `done_count`/`missed_count` are unchanged.
- **AC-24 Reopen undoes the spawn, or refuses honestly (D10):** Given the most recently
  completed occurrence and a successor that is untouched (not detached, still open, no
  reminder sent), when `POST /api/tasks/:id/reopen` is called, then the successor and
  its unsent reminders are deleted, the occurrence is open again and `done_count` is
  decremented. Given the successor has been touched (detached, closed, or any reminder
  already sent), then the reopen returns `409` with a pt-BR message saying the next
  occurrence already exists, and nothing changes.
- **AC-25 One-off Tasks are unaffected:** Given a Task with `series_id = null`, when it
  is completed, reopened or deleted, then the behavior and response are byte-identical
  to the current suite's expectations (the existing tests stay green unmodified).

### Phase 4 — the screen (manual / device)

- **AC-26 Create and recognize a series on screen:** Given the Task sheet, when the
  owner sets a repetition (*Repetir*: frequency, day, end) and saves, then the first
  occurrence appears in *Hoje* under its date group with the series glyph in its row
  metadata (`ui-layout-standard.md` §"where each unit plugs in", units 9–12 row); and
  completing it shows the successor in the list without a reload. Every visible string
  is pt-BR.
- **AC-27 UI/UX checklist before the merge:** Given phase 4's diff, when it is ready
  for review, then the `ui-ux-guidelines.md` review checklist has been run and its
  ✔/✘ result is pasted in the plan record **before** the merge and the deploy — not
  after (the v0.8.1 lesson, Delivery history 2026-09-17).
- **AC-28 Exit signal on the owner's device:** Given a real series the owner created
  in production, when he completes a real occurrence, then the next occurrence appears
  on the right date with its reminders set, with nothing else done — recorded in the
  roadmap's Delivery history as the unit's device proof.

## Open Questions

- [ ] **23:59 for scheduled-date series (inherits unit 7's open question).** A reminder
  offset on a `scheduled` series counts back from 23:59 of that day, so "the morning of"
  is an offset of ~15 h. That is honest arithmetic and the instant is shown before
  saving, but whether it reads naturally is for real use to settle — the same deferral
  unit 7 recorded for deadlines.
- [ ] **Unit 7's single-Reminder route still requires a deadline for relative offsets**
  (`src/worker/routes/reminders.ts:59`). D9 lets series-spawned reminders resolve
  against a scheduled date; whether the hand-made Reminder route should follow is left
  to real use rather than widened here without a request.
- [ ] **Rule edits.** Deferred as a Won't. If the owner asks to change "every 5th" to
  "every 10th" in practice, the decision about the already-materialized occurrence's
  date gets its own PRD amendment.

---

## Users & Context

**Primary User**
- **Who:** The owner — the single user of Praesto — who manages bills, chores and
  routines that return on a schedule.
- **Current behavior:** Re-types the Task every cycle, or keeps one open Task and
  pushes its date forward (erasing the record of the cycles already done); re-arms each
  reminder by hand.
- **Trigger:** Completing this cycle's occurrence.
- **Success state:** The next cycle is already there, on the right date, with its
  reminders armed — and the completed cycle stays in the history.

**Job to Be Done**
When I finish something that repeats this cycle, I want the next cycle to already
exist, so I never have to remember to recreate what always comes back.

**Non-Users**
Nobody else — Praesto has one user. And this is not for commitments with a time of day:
those are Events, whose recurrence is unit 17.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Pure, clock-free, DB-free expansion in `src/shared/recurrence.ts` (daily/weekly/monthly/yearly, interval, weekdays, month day, both anchors, end conditions, bounded window) | The unit's own exit signal and unit 17's reuse condition |
| Must | `POST /api/series` creating the series and materializing its first occurrence with reminders | Without it there is no way to register "pay rent on the 5th" once |
| Must | Completing an occurrence spawns the successor with its reminders in the same write | The unit's outcome |
| Must | End conditions (`until`, `count`) stop the series | Otherwise a finite series never ends |
| Must | Delete = skip, reopen = undo-or-409 | Without them two existing Task write paths either break the one-open invariant or leave a series silent |
| Must | Migration `0005`: `recurrence_series.priority` becomes the `high/normal/low` text enum with a CHECK | The template cannot carry a priority the Task accepts otherwise; enums are enforced twice |
| Must | Screen: create a series from the Task sheet, series glyph on the row | The exit signal is earned on the device, not by curl |
| Should | `PATCH /api/series/:id` for template fields and ending the series | Correcting a typo in a series title without ending it |
| Should | `GET /api/series`, `GET /api/series/:id` | The sheet needs to show the rule of the Task it opened |
| Could | A series summary line in the sheet ("Todo mês, dia 5 · até dez/2026") | Readability; the glyph alone satisfies the layout standard |
| Won't | Missed sweep / adherence / nudge | Units 10, 11, 12 |
| Won't | Rule edits, series hard delete, "this and future", unsupported rule shapes, Google mirror | See What We're NOT Building |

### MVP Scope

The pure expansion function; the series create/read/update-template/end API with the
first occurrence and its reminders; successor spawning on complete, skip on delete,
undo-or-refuse on reopen, end conditions; the `priority` migration; and a *Repetir*
control in the Task sheet with the row glyph. That is the minimum that lets the owner
register one real series and watch its next occurrence appear on its own.

### User Flow

1. Owner opens the Task sheet for a new Task, types "Pagar aluguel", picks *Prazo* on
   the 5th and *Repetir → Todo mês, dia 5*, sets a reminder "1 dia antes", saves.
2. *Hoje* shows the occurrence under its date group with the series glyph.
3. The reminder fires the day before (unit 7's cron, unchanged).
4. He completes it. The next occurrence — the 5th of next month, reminder armed —
   appears under *Próximas*. Nothing else to do.

---

## Technical Approach

**Feasibility:** HIGH — the storage model is decided (ADR-0006) and already applied in
production (`migrations/0000`), the reminder arithmetic and the claim-before-send sweep
are live and tested (unit 7), and the only schema change is a column type fix on a table
no code has ever written to.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**.

Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial
test suite from the Acceptance Criteria above, before the Implementer runs. AC-26..AC-28
are manual/device verification and produce no test file, per the methodology's split.

### Architecture Notes

- **One pure module, three entry points.** `src/shared/recurrence.ts` exports
  `firstOccurrence(rule)`, `nextOccurrence(rule, { after, completedOn?, closedCount? })`
  and `expandOccurrences(rule, { from, to })`, all on local calendar-day strings, plus
  `occurrenceReminderInstants(day, offsets, tz)` composing the existing
  `offsetToInstant`. The rule type is derived from the Drizzle `recurrenceSeries`
  columns (never hand-declared). No `Date.now()`, no `new Date()` without arguments, no
  imports from `src/worker/` or `src/app/`. Calendar-day arithmetic is done on
  `YYYY-MM-DD` components, so DST never touches the expansion; instants are produced
  only by `offsetToInstant`, which already handles DST in one place.
- **Why no library.** Neither `rrule.js` nor `rrule-temporal` accepts an injected
  clock, `rrule.js` asks its callers to fake local time as UTC, and both bring a runtime
  dependency into `src/shared`, which compiles into every target and carries none. The
  vocabulary this unit must express is four frequencies and two by-rules.
- **Materialization is a D1 batch, not a transaction dance.** Closing the occurrence,
  incrementing the counter, inserting the successor and its reminders are one
  `db.batch([...])`. The partial unique indexes `tasks_series_single_open_unq` and
  `tasks_series_occurrence_unq` are the concurrency guard: a racing second spawn fails
  the index and the route maps that failure to a handled response (AC-20).
- **Successor is computed from the series, never from the closing row.** Template
  fields come from `recurrence_series`; the closing row contributes only its
  `occurrence_date` (and, for completion anchoring, the completion day in the owner's
  time zone via `todayIn(now, tz)` evaluated by the route — the route may read the
  clock, the pure function may not).
- **Wire contract grows additively.** New `/api/series` routes; the complete response
  gains an optional `successor`; `RecurrenceSeriesDto.priority` changes type with the
  migration (it has had no consumer but the export). `EDITABLE_TASK_FIELDS` is
  unchanged — `seriesId`, `occurrenceDate` and `detached` stay server-owned.
- **Migration `0005`** is generated by drizzle-kit (SQLite rebuilds the table), read
  before applying, and applied to remote D1 before the deploy — the unit 6 pattern. The
  plan confirms first that production holds zero `recurrence_series` rows.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A duplicate successor in a race (double tap, retry) — Taskwarrior's failure class | M | The two partial unique indexes already in production make it structurally impossible; AC-20 tests a concurrent double complete and that the loser is not a `500` |
| Silent month-overflow or leap-year drift (the 31st, Feb 29) | M | Behavior named in advance (D1, `BACKWARD`) and tested as tables in phase 1, before any route exists (AC-3, AC-5) |
| Scope creeping into unit 10's sweep ("but what if he never completes it?") | M | Explicit Won't; an unfinished occurrence stays open and overdue in this unit — the honest state until the sweep exists |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Pure expansion | `src/shared/recurrence.ts`: first/next/window expansion, both anchors, end conditions, month-day clamp, reminder-instant composition; clock-free and DB-free (AC-1..AC-10) | pending | - | - | - |
| 2 | Series API | Migration `0005` (`priority` enum); `POST/GET/PATCH /api/series` creating the series and materializing its first occurrence with reminders; template propagation; ending (AC-11..AC-18) | pending | - | 1 | - |
| 3 | Materialization on close | Complete spawns the successor with reminders in one batch; end conditions; detached isolation; delete = skip; reopen = undo-or-409; one-off Tasks unchanged (AC-19..AC-25) | pending | - | 2 | - |
| 4 | The screen | *Repetir* control in the Task sheet, series glyph on the row, successor visible without reload; UI/UX checklist before merge; device proof of the exit signal; documentation updates (AC-26..AC-28) | pending | - | 3 | - |

### Phase Details

**Phase 1: Pure expansion**
- **Goal:** The function unit 17 will reuse unchanged exists, and its edge cases are pinned before any route depends on it.
- **Scope:** `src/shared/recurrence.ts` and its test file; no route, no schema, no UI.
- **Success signal:** AC-1..AC-10 green; the module has zero imports outside `src/shared/`.

**Phase 2: Series API**
- **Goal:** A series can be registered once and its first occurrence appears with its reminders.
- **Scope:** Migration `0005` applied locally (remote at deploy), `src/worker/routes/series.ts`, the wire types in `src/shared/api.ts`, DTO mapping in `src/worker/dto.ts`.
- **Success signal:** AC-11..AC-18 green; `curl` against local dev creates a series and `GET /api/tasks` shows its first occurrence.

**Phase 3: Materialization on close**
- **Goal:** Completing an occurrence makes the next one appear, and no Task write path can break the one-open invariant.
- **Scope:** `complete`, `reopen` and `delete` in `src/worker/routes/tasks.ts`; the additive `successor` response field.
- **Success signal:** AC-19..AC-25 green, and the full existing suite unmodified and green.

**Phase 4: The screen**
- **Goal:** The owner earns the exit signal on his own device.
- **Scope:** The *Repetir* control in `TaskSheet`, the series glyph in `TaskRow`, the successor rendered after completion; `documentation/` and `docs/` updates per the maintenance map (domain model, tasks area, architecture-overview's "Not built yet", roadmap).
- **Success signal:** UI/UX checklist ✔/✘ in the plan record before the merge; AC-28 observed on the owner's device and recorded in Delivery history.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Opening unit 9 while units 7 and 8 are `in-progress` | **Recorded exception to roadmap rule 2**, owner-confirmed 2026-09-21; to be recorded as a Delivery history line on approval | Wait for units 7 and 8 to close | Neither unit is waiting for code: 7 waits for a week of real reminders on time, 8 for the owner to find an old Task by two words — both earned by use, not by work. Unit 9's technical dependency on 7 (the reminder machinery) is live and tested in production. Same shape as unit 8's own recorded exception. Rule 6 (mandatory order review when unit 7 closes) has **not** fired and is not pre-empted by this |
| Where the expansion lives and what it may touch | `src/shared/recurrence.ts`, pure: no DB, no clock, inputs as arguments | A worker-side helper; a library (`rrule`, `rrule-temporal`) | Non-negotiable design condition from the unit's exit signal — unit 17 reuses it unchanged, the same kind of condition as unit 4's range function over a list of sources. No library found accepts an injected clock |
| D1 — Month-day overflow | `BACKWARD` (RFC 7529 `SKIP=BACKWARD`): the 31st becomes the month's last day; the track is re-derived from the rule each month, never from the clamped date | `OMIT` (skip the month); `FORWARD` (1st of next month) | Omitting would make "rent on the 31st" vanish in February — the opposite of the honest mirror. Forward moves the cycle into the wrong month |
| D2 — A detached occurrence closes | Successor is built from the series template, not the edited row | Carry the edit forward | An individual edit is about that cycle; carrying it forward is the documented Todoist trap (rescheduling before completing silently skips occurrences) |
| D3 — Deleting the open occurrence | Skip: the successor is spawned immediately; the deleted cycle is not counted as done or missed | Leave the series without an open occurrence until unit 10's sweep | ADR-0006 says delete skips; waiting for a sweep that does not exist yet would leave the series silent |
| D4 — Successor reminders | Armed in the same batch from the template's `reminder_offsets`, via unit 7's `offsetToInstant` | Re-arm by hand | ADR-0006 requires the successor "with its Reminders resolved to absolute UTC fire times"; unit 7's sweep then delivers them unchanged |
| D5 — Completion anchor without a clock | The completion day is an **argument** of the pure function; the route derives it (`todayIn(now, tz)`) | The function reads the clock | Reading the clock inside the expansion would break the design condition; missing `completedOn` on a completion-anchored rule is a thrown error, not a silent default |
| D6 — What `count` counts | Closed occurrences: `done_count + missed_count` | Only `done` | A "12 times" series with 3 misses would never end if only completions counted |
| D7 — Template edits | Propagate only to the open, non-detached occurrence; closed rows keep their values | Rewrite history | ADR-0006 text; history is the realization log |
| D8 — Sweep, adherence, nudge | Out of scope | Build the sweep now | Units 10, 11, 12 own them; keeps this unit inside its 6-day floor |
| D9 — Reminder offsets on a `scheduled` series | Resolve against the occurrence's own date field (deadline **or** scheduled date), same `offsetToInstant` and 23:59 anchor | Allow reminder offsets only on `deadline` series, matching unit 7's single-Reminder route | Refusing would make "take the medicine every morning" unremindable. The hand-made Reminder route is left unchanged (Open Questions). |
| D10 — Reopening a completed occurrence whose successor exists | Untouched successor → delete it and its unsent reminders, reopen, decrement `done_count`; touched successor → `409` with pt-BR copy, nothing changes | Always refuse; allow two open occurrences | Reopen is a shipped capability (FR-003) and "undo" should undo; two open occurrences are forbidden by the unique index. |
| D11 — Rule edits of an existing series | Won't: end the series and create a new one | Allow and move the open occurrence's date; allow and apply from the next spawn | Nothing in the exit signal needs it and each option is a decision about the owner's data; deferred to real demand. |
| Migration | One migration, `0005`, changing `recurrence_series.priority` from `integer` to the `high/normal/low` text enum with a CHECK | Keep `integer` and map in the DTO | Unit 2 migrated `tasks.priority` (`migrations/0001`) and left the template column behind; domain enums are enforced twice, and a hand-mapping would be a second source of truth |

---

## Research Summary

**Market Context**
- The two anchors ADR-0006 names are the industry pattern under other names: Todoist
  `every` vs `every!` (https://2sync.com/blog/todoist-recurring-tasks) and TickTick
  "By Due Dates" vs "By Completion Date"
  (https://help.ticktick.com/articles/7055782206349770752). The applied `anchor_mode`
  column already matches.
- Todoist's documented trap: rescheduling an occurrence before completing it makes the
  next occurrence skip everything between the original and the rescheduled date — the
  reason for D2.
- Taskwarrior generates a fixed lookahead of instances regardless of completion
  (https://taskwarrior.org/docs/recurrence/), and a filed bug shows one weekly series
  growing from #56 to #60,749 pending rows
  (https://github.com/GothenburgBitFactory/taskwarrior/issues/592) — the failure class
  the one-open unique index rules out.
- DST: convergent advice is to resolve occurrences in the local zone and convert to UTC
  last (https://www.nylas.com/blog/calendar-events-rrules/); `rrule.js` asks callers to
  fake local time as UTC (https://github.com/jkbrzt/rrule). `rrule-temporal` implements
  RFC 7529 `SKIP` for month-day overflow (https://github.com/ggaabe/rrule-temporal) —
  the vocabulary used for D1. Neither library exposes an injectable clock.
- Gaps: nothing specific surfaced for Things 3 or Habitica, no bundle-size figures for a
  Workers runtime, and no documented incident of a reminder attached to the wrong
  spawned occurrence — that risk is inferred, not observed.

**Technical Context**
- `recurrence_series` and the Task recurrence columns with both partial unique indexes
  are applied: `migrations/0000_neat_the_fallen.sql:22-101`; declared at
  `src/worker/db/schema.ts:55-137,168-222`.
- `recurrence_series.priority` is still `integer` (`migrations/0000_neat_the_fallen.sql:40`)
  while `tasks.priority` became the text enum in `migrations/0001_violet_pretty_boy.sql:15-27`.
- `src/shared/` pure-module convention — no clock, `now`/`today`/`timeZone` always
  arguments: `src/shared/dates.ts:22-138` (`todayIn`, `offsetToInstant`,
  `END_OF_DAY_LOCAL_MINUTES`), `src/shared/agenda.ts:17-19`.
- Unit 7's reminder arithmetic and sweep: relative offsets resolve via
  `offsetToInstant(task.deadline, originOffsetMinutes)` at
  `src/worker/routes/reminders.ts:53-65`; claim-before-send and the done/missed skip in
  `src/worker/cron.ts:31-90`.
- `PATCH /api/tasks/:id` already sets `detached = true` on any edit of a series row and
  recomputes relative reminders on a deadline change (`src/worker/routes/tasks.ts:269-307`);
  `complete`/`reopen`/`delete` (`:313-349`) have no series awareness.
- No series route exists; `RecurrenceSeriesDto` serves only the export
  (`src/worker/dto.ts:83-109`); `EDITABLE_TASK_FIELDS` keeps series columns
  server-owned (`src/shared/api.ts:223-229`).
- Existing recurrence tests only prove the indexes (`test/tasks.test.ts:115-198`);
  `test/isolation.ts` already wipes `recurrence_series`.
- UI placement is pre-decided: "Series glyph in the row metadata" for units 9–12
  (`documentation/40-engineering/ui-layout-standard.md:65`).

---

*Generated: 2026-09-21*
*Approved: 2026-09-22*
*Status: APPROVED*
