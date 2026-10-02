# Missed Sweep

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a PRD that downstream plan, test and implement stages consume); cross-cutting — adds a system writer to the cron that closes the owner's Task rows, changes how a shared pure grouping function partitions closed Tasks, and reuses unit 9's successor-spawning path outside an HTTP route; domain rules for tasks and reminders
- Decisions found: ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording — an occurrence superseded without completion becomes `missed` (terminal, system-written) when the next occurrence's date arrives, late completion stays possible until then, every skipped cycle leaves a permanent `missed` row, and the daily cron gains an idempotent sweep repairing any active series lacking an open occurrence; recurring-tasks PRD D6 (a `count` end condition counts done + missed), D2 (a successor is built from the series template, never from a detached row), D3 (deleting the open occurrence skips the cycle, counted as neither); [2026-09-10] The due-Reminder sweep claims before it sends, and skips a Reminder whose Task is `done` or `missed`; [2026-09-10] A relative Task Reminder resolves against end-of-day local via `offsetToInstant`; ADR-0008 test-first; ADR-0009 visible copy pt-BR, everything else English; roadmap rule 2 (units 9 and 6 are `shipped`, so this unit rises without an exception)
- Applicable anti-patterns: Hand-duplicated entity types; Portuguese in artifacts (identifiers, tests and docs English; visible copy pt-BR); Glossary synonym drift ("Recurrence Series", "occurrence", "missed" — never "skipped", "failed", "habit"); Weakening tests to force green (existing tests change only as recorded lifecycle updates); Mirroring Tasks, Reminders or Life Areas to Google (not approached); Editing accepted ADRs (ADR-0006 is applied, not amended)
- Applicable architectural rules: one Worker serves everything — the sweep runs inside the existing `scheduled()` / `runCronHeartbeat`, which records every run into `cron_runs` from a `finally` block; src/shared stays DOM-free, clock-free and dependency-free — the sweep's decision logic is a pure function taking `today` as an argument; `src/shared/recurrence.ts` must stay unchanged (unit 17's reuse condition); domain enums enforced twice (the `missed` status already is); no new migration; the UI/UX review checklist is a gate before the merge
- Result: PROCEED
```

## Problem Statement

When the owner does not do an occurrence of a recurring Task, nothing happens: the occurrence stays open
and overdue forever, the series stops advancing — no next occurrence is ever materialized — and no record
says that cycle failed. The only ways out today are manual and both corrupt the history: deleting the
occurrence skips the cycle without recording a miss, and completing it records a completion that never
happened. Units 11 and 12 (adherence, repeated-miss nudge) read exactly the `missed` rows this unit is the
first to write, so every week without it is history the honest mirror can never recover.

## Evidence

- `documentation/60-decisions/ADR-0006-recurrence-model.md` — the owner's own decision (2026-08-03):
  *"missed occurrences must be recorded, not silently skipped … Stale data means the project itself has
  failed."* It specifies the rule (missed when the next occurrence's date arrives) and names "the idempotent
  daily sweep" as a non-optional mitigation for dead or duplicated series.
- `documentation/20-requirements/functional-requirements.md:42` — FR-009 includes "occurrences superseded
  without completion recorded as `missed`"; FR-011 (`:44`) needs those rows to exist.
- `PRPs/prds/recurring-tasks.prd.md` "What We're NOT Building" — unit 9 deferred "marking an occurrence
  `missed` when its successor's date arrives, and repairing a series left without an open occurrence" to
  this unit by name; "in this unit an unfinished occurrence simply stays open and overdue."
- Production, 2026-09-30: the owner has his first real series (snapshot `praesto-2026-09-30.json`, one
  `recurrence_series` row). Nothing in the code writes `missed` today — the status exists in the schema
  (`src/worker/db/schema.ts:157-158`) with the comment "system-written by the recurrence sweep", and no
  writer.
- **Counter-evidence, recorded rather than hidden:** the owner has not yet missed a real occurrence; the pain
  is stated by the ADR and the vision, not yet observed in use.

## Proposed Solution

Add a missed sweep to the cron that already runs every five minutes. For each series with an open
occurrence, it asks one pure function in `src/shared` — given the rule, the counters, the open occurrence's
date and today's local date in the series' time zone — whether that occurrence has been superseded and, if
so, which cycles were missed, where the successor falls, and whether the series ends. The cron then writes
that plan in one D1 batch per series: the open occurrence becomes `missed`, any whole cycles that passed
unseen become `missed` rows of their own, the successor is inserted open with its Reminders armed through
unit 7's machinery, and `missed_count` grows. The same sweep repairs an active series left without an open
occurrence. Keeping the decision pure keeps it testable at every date edge without a database, and writing
through the partial unique indexes that already guard the one-open and one-per-date invariants makes a race
with a manual completion structurally harmless. The only screen change is honesty: a `missed` occurrence
stops being listed under *Concluídas*.

## Key Hypothesis

We believe marking an occurrence `missed` when its successor's date arrives, and materializing that
successor in the same write, will keep every series alive and produce a trustworthy miss record for the
owner. We'll know we're right when, after two weeks of real use, every active series has exactly one open
occurrence and every past cycle has exactly one `done` or `missed` row — no duplicates, no gaps — and running
the sweep a second time changes not one row.

## What We're NOT Building

- **Adherence statistics and the "what I keep failing" list** — unit 11 `adherence-mirror` (FR-011's
  visibility half). This unit writes the rows and stops listing them as done; it does not aggregate them.
- **Notifying the owner of a miss** — unit 12 `repeated-miss-nudge` (FR-012).
- **Changing when a miss happens** — ADR-0006 decides it (the next occurrence's date), confirmed by the owner
  on 2026-09-30 without reopening it. A day-boundary miss (Habitica's model) is not built.
- **Collapsing a long absence into one miss** — every whole cycle that passed leaves its own row (ADR-0006).
- **Undoing a miss** — `missed` is terminal; there is no reopen for it, and late completion is possible only
  until the occurrence is superseded.
- **Backfilling misses for a period a series was broken by the system** — the repair starts fresh (D-F).
- **Any change to `src/shared/recurrence.ts`** — unit 17's reuse condition.
- **A migration** — `missed_count`, the `missed` status and both partial unique indexes are already applied.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Active series without an open occurrence | 0 | Query over a snapshot: `recurrence_series` with `status = 'active'` and no `tasks` row `status = 'open'` for it |
| Duplicate occurrence dates | 0 | Group a snapshot's `tasks` by `(series_id, occurrence_date)`; the unique index makes any other result impossible |
| Misses recorded on the right date | 100% of missed cycles over two weeks of real use | Compare each series' `occurrence_date` sequence in a snapshot against its rule; every past cycle has one `done` or `missed` row |
| Second run of the sweep | 0 rows changed | Automated (AC-11); on the device, two diagnostics-visible cron runs with no change to the series' rows |

## Acceptance Criteria (test scenarios)

Test-first: AC-1..AC-19 are the automated contract (Vitest inside workerd, per `docs/context/testing.md`);
AC-20..AC-21 are the manual/device half and produce no test file, per the methodology's "UI stays manually
verified" split. All dates are local calendar days (`YYYY-MM-DD`); `tz` is `America/Sao_Paulo` unless
stated. "The plan" is the return value of the pure planning function in `src/shared`.

### Phase 1 — the pure plan (`src/shared`)

- **AC-1 Pure and clock-free:** Given the same inputs, when the planning function is called twice with the
  system clock faked to two instants a year apart (`vi.setSystemTime`), then both calls return identical
  plans; and the module imports nothing from `src/worker/` or `src/app/`.
- **AC-2 Not yet superseded is a no-op:** Given a daily series whose open occurrence is `2026-10-01`, when the
  plan is computed for today `2026-10-01`, then it changes nothing. Given a monthly-on-the-5th series whose
  open occurrence is `2026-10-05`, then today `2026-11-04` changes nothing, and today `2026-11-05` marks
  `2026-10-05` missed with the successor on `2026-11-05`.
- **AC-3 Catch-up leaves one row per whole cycle (D-B):** Given a daily series whose open occurrence is
  `2026-10-01`, when the plan is computed for today `2026-10-04`, then `2026-10-01` becomes missed, `2026-10-02`
  and `2026-10-03` are new missed rows, the successor is `2026-10-04`, and the missed count grows by 3.
- **AC-4 Catch-up is bounded (D-B):** Given a daily series whose open occurrence is 400 days before today, when
  the plan is computed, then it covers at most 366 missed cycles and names a successor at the next unswept
  date; that successor, still dated before today, is planned **without Reminders**; and repeating the plan from
  that successor reaches today's occurrence — the bound never loses a cycle and never loops without end.
- **AC-5 Completion anchor (D-C):** Given `{ freq: "daily", interval: 3, anchorMode: "completion" }` with the
  open occurrence `2026-10-01`, when the plan is computed for today `2026-10-03`, then it changes nothing; for
  today `2026-10-04`, `2026-10-01` becomes missed and the successor is `2026-10-04` — the date the rule gives
  as if the occurrence had been completed on its own day.
- **AC-6 A `count` series ends on its last miss (D-D, D6):** Given a monthly series with `endKind: "count",
  maxCount: 3`, `doneCount: 1`, `missedCount: 1` and its open occurrence `2026-10-05`, when the plan is
  computed for today `2026-11-05`, then `2026-10-05` becomes missed, no successor is planned, and the series
  ends.
- **AC-7 An `until` series stops at its limit (D-D):** Given a daily series with `untilDate: "2026-10-03"` and
  its open occurrence `2026-10-01`, when the plan is computed for today `2026-10-10`, then `2026-10-01` becomes
  missed, `2026-10-02` and `2026-10-03` are new missed rows, nothing after `2026-10-03` is planned, no successor
  exists, and the series ends.
- **AC-8 A series the owner ended (D-D):** Given a series with `status: "ended"` whose open occurrence is
  `2026-10-05` (monthly on the 5th), when the plan is computed for today `2026-11-05`, then `2026-10-05`
  becomes missed and nothing else is planned — no intermediate rows, no successor.
- **AC-9 Repair starts fresh (D-F):** Given an active daily series with no open occurrence whose last closed
  occurrence is `2026-09-01`, when the plan is computed for today `2026-10-04`, then it plans exactly one open
  occurrence on `2026-10-04` and no missed rows. Given the rule has no date on or after today (an `until` in the
  past, or a `count` already reached), then it plans no occurrence and ends the series.

### Phase 2 — the sweep in the cron

- **AC-10 One batch writes the plan:** Given the AC-3 series with one reminder offset `[1440]` in D1, when
  `runScheduledJob` runs with `now` inside local day `2026-10-04`, then the `2026-10-01` row is `missed`, two
  new `missed` rows exist for `2026-10-02` and `2026-10-03` carrying the template's title, priority and date
  field and no Reminders, exactly one open occurrence exists on `2026-10-04` with one unsent Reminder at
  `offsetToInstant("2026-10-04", 1440)`, and `missed_count` grew by 3.
- **AC-11 Running it twice changes nothing:** Given the state AC-10 produced, when `runScheduledJob` runs again
  with the same `now`, then every row of `tasks`, `reminders` and `recurrence_series` is byte-identical to the
  state before the second run.
- **AC-12 A race with a manual completion is harmless:** Given an open occurrence the sweep is about to mark
  missed, when the owner's `POST /api/tasks/:id/complete` lands first, then the sweep writes nothing for that
  series (its conditional update matches no open row, or the partial unique indexes reject the write), no
  duplicate row exists, the run completes without throwing, and `cron_runs` records a success.
- **AC-13 One series cannot block another:** Given two series due for a sweep where the first one's write is
  rejected by a unique-index conflict, when `runScheduledJob` runs, then the second series is still swept.
- **AC-14 The sweep runs before the Reminder sweep:** Given an open occurrence superseded today that still
  carries an unsent Reminder whose `fire_at` has passed, when `runScheduledJob` runs, then the occurrence is
  `missed` and no push is dispatched for that Reminder.
- **AC-15 "Today" is the series' local day:** Given a monthly series whose next date is `2026-10-05` in
  `America/Sao_Paulo`, when `runScheduledJob` runs at `2026-10-05T02:30:00Z` (still `2026-10-04` locally), then
  nothing changes; at `2026-10-05T03:30:00Z`, the occurrence is swept.
- **AC-16 A detached occurrence is missed like any other (D-E):** Given an open occurrence whose title was
  edited (so it is `detached`), when it is swept, then it becomes `missed` with its edited title intact, and the
  successor carries the series template's title.
- **AC-17 The repair runs in the cron (D-F):** Given an active series with no open occurrence, when
  `runScheduledJob` runs, then exactly one open occurrence exists for it afterwards, with its Reminders armed,
  and no `missed` row was added.
- **AC-18 One-off Tasks are untouched:** Given a Task with `series_id = null` whose deadline is 30 days past,
  when `runScheduledJob` runs, then it is still `open` and unchanged.

### Phase 3 — the screen

- **AC-19 Closed Tasks split into done and missed (D-G):** Given a list holding open, `done` and `missed` Tasks,
  when `groupTasks` partitions it, then `done` Tasks land in one bucket and `missed` Tasks in another, each in
  the order the API returned them, and the open buckets are unchanged — the concatenation of all buckets still
  reproduces the input.
- **AC-20 On screen (manual):** Given the owner has at least one `missed` occurrence, when he opens *Hoje* or
  searches, then *Concluídas* lists only completed Tasks and a separate *Não concluídas* group (collapsed by
  default, with its count) lists the missed ones; every visible string is pt-BR; and the UI/UX review checklist
  has been run and its ✔/✘ result recorded **before** the merge.
- **AC-21 Exit signal on the owner's device (manual):** Given a real **daily** series in production whose
  occurrence the owner deliberately does not do, when the next day arrives, then — without him opening the app
  in between — that occurrence shows as *não concluída*, today's occurrence is open with its Reminder armed,
  and a later cron run changes neither; recorded in the roadmap's Delivery history as the unit's device proof.

## Open Questions

- [ ] **How long a real absence looks on screen.** A daily series left for a month produces ~30 *não
  concluída* rows at once. That is the honest record ADR-0006 asks for; whether the *Não concluídas* group
  reads well at that size is for real use to settle, and unit 11 owns the aggregated view.
- [ ] **Cloudflare's cron delivery guarantee.** Chore C9 observed two silent gaps (149 and 335 min) and
  Cloudflare documents no retry or catch-up; the sweep is written to tolerate any gap (AC-3, AC-4), but how
  long a gap can grow is unmeasured.

---

## Users & Context

**Primary User**
- **Who:** The owner — Praesto's single user — who keeps bills, medication and chores as Recurrence Series.
- **Current behavior:** An occurrence he does not do stays open and overdue indefinitely; the series stops
  advancing; to move on he must either delete it (no record) or complete it falsely.
- **Trigger:** A cycle of a series passes without being done.
- **Success state:** The next day (for a daily series) the old occurrence reads *não concluída* and the new one
  is open with its reminder — without him opening the app.

**Job to Be Done**
When I fail to do something that repeats, I want the app to record the miss on its own and move on to the
next cycle, so the history tells the truth without me tending to it.

**Non-Users**
One-off Tasks: they never become *não concluída* and stay open and overdue, as today. Nobody else uses
Praesto.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Pure plan in `src/shared`: superseded or not, missed cycles, successor date, series end — all anchors and end conditions | The decision is the risky part; pure keeps every date edge testable without a database |
| Must | Sweep in `runScheduledJob`: one batch per series, idempotent, conflict-tolerant, before the Reminder sweep | The unit's outcome and half of its exit signal ("running the sweep twice changes not one row") |
| Must | Catch-up: one `missed` row per whole cycle, bounded per run | ADR-0006 ("every skipped cycle leaves a permanent `missed` row"); the cron is known to go silent (C9) |
| Must | Repair of an active series without an open occurrence | ADR-0006 names it a non-optional mitigation |
| Must | *Concluídas* no longer lists `missed` Tasks | Once the sweep writes `missed`, listing a miss under "completed" is exactly the dishonesty the unit exists to remove |
| Should | *Não concluídas* as its own collapsed group on *Hoje* and in search | The honest home for the rows until unit 11's aggregated view |
| Won't | Adherence stats, repeated-miss notification, day-boundary misses, undoing a miss, backfilling system-broken periods | Units 11 and 12; ADR-0006; see What We're NOT Building |

### MVP Scope

The pure plan, the sweep in the cron with catch-up and repair, and the *Concluídas* / *Não concluídas* split.
That is the minimum that lets the owner see a real miss recorded and the next cycle already waiting.

### User Flow

1. The owner has a daily series (e.g. a medication) and does not do today's occurrence.
2. At local midnight's first cron run of the next day, the sweep marks it `missed`, spawns today's occurrence
   and arms its reminder. He does nothing.
3. He opens *Hoje*: today's occurrence is there; yesterday's sits under *Não concluídas*.

---

## Technical Approach

**Feasibility:** HIGH — the model, the `missed` status, `missed_count`, both partial unique indexes and the
successor-spawning path already exist and are in production; the sweep reuses them.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**.

Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

### Architecture Notes

- **Decision pure, writing thin.** The planning function takes the rule, `status`, `doneCount`, `missedCount`,
  the open occurrence's date (or the last closed occurrence's date, for the repair) and `today` as arguments,
  and returns a plan. It composes `nextOccurrence` from `src/shared/recurrence.ts` and never edits it. To find
  when the last occurrence of an ending series is superseded (D-D), it calls `nextOccurrence` on a **copy** of
  the rule with `endKind: "never"` — the date the rule would produce — and separately checks the real end
  condition.
- **Completion anchor (D-C)** passes the occurrence's own date as `completedOn`: the successor is the date the
  rule gives had it been done on time.
- **The sweep lives in `runScheduledJob`, before the Reminder sweep**, inside `runCronHeartbeat`, so a thrown
  error is recorded in `cron_runs` and a missed occurrence's Reminder is never dispatched (the existing skip for
  `missed` Tasks then applies). `now` becomes injectable so tests pin the local day (AC-15); today no cron test
  fakes the clock.
- **Reuse, not duplication.** Unit 9's `buildSuccessorStatements` (`src/worker/routes/tasks.ts:63-106`) is
  private to the Task routes and `batchOrRace` (`:406-429`) returns an HTTP `Response`. The successor builder
  moves to a shared worker module both the routes and the cron import; the cron gets its own conflict handling
  that treats a `UNIQUE constraint failed` as "another writer got there first" and moves on (AC-12, AC-13).
- **Ordering inside a batch matters:** `tasks_series_single_open_unq` is checked immediately, so the open row is
  closed before the successor is inserted — the same ordering the complete route already uses.
- **Local day per series:** `today` is `todayIn(now, series.timezone)`, never UTC (AC-15).
- **Grouping:** `groupTasks` (`src/shared/task-groups.ts`) splits its `closed` bucket into done and missed.
  Existing tests that assert the `closed` bucket are updated as recorded lifecycle changes, never weakened.
- **No migration**, so no remote apply precedes the deploy. Chore C6 ran on 2026-09-30 and passed.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A race with the owner's manual completion writes a duplicate or a `500` | M | The conditional update and the two partial unique indexes make a duplicate structurally impossible; the sweep maps the conflict to "skip this series" (AC-12, AC-13) |
| Time-zone or DST off-by-one marks a miss a day early or late | M | Comparisons only on local calendar days via `todayIn(now, series.timezone)`; AC-15 pins the boundary instant |
| A long catch-up exceeds the free plan's CPU budget | L | At most 366 cycles per series per run (AC-4) and one batch per series; the next run continues |

---

## Implementation Phases

| # | Phase | Description | Status | Repo | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|------|----------|---------|----------|
| 1 | Pure plan | The planning function in `src/shared`: superseded or not, catch-up rows, successor date, end conditions, completion anchor, repair — clock-free and DB-free, `recurrence.ts` untouched (AC-1..AC-9) | complete | - | - | - | PRPs/plans/missed-sweep-phase-1-pure-plan.plan.md |
| 2 | The sweep in the cron | Successor builder moved to a shared worker module; the sweep in `runScheduledJob` before the Reminder sweep, one batch per series, injectable `now`, conflict-tolerant, repair (AC-10..AC-18) | complete | - | - | 1 | PRPs/plans/missed-sweep-phase-2-the-sweep-in-the-cron.plan.md |
| 3 | The screen | `groupTasks` done/missed split, *Concluídas* and *Não concluídas* on *Hoje* and in search, UI/UX checklist before the merge, device proof, documentation (AC-19..AC-21) | complete | - | - | 2 | PRPs/plans/missed-sweep-phase-3-the-screen.plan.md |

### Phase Details

**Phase 1: Pure plan**
- **Goal:** Every date edge of "is this occurrence missed, and what comes next" is pinned before any row is written.
- **Scope:** One new module in `src/shared` and its test file; no route, no schema, no UI.
- **Success signal:** AC-1..AC-9 green; `git diff` shows `src/shared/recurrence.ts` unchanged.

**Phase 2: The sweep in the cron**
- **Goal:** The cron writes the plan safely, repeatably and without racing the owner.
- **Scope:** `src/worker/cron.ts`, a shared worker module for the successor builder, the Task routes switched to it.
- **Success signal:** AC-10..AC-18 green, and the full existing suite green without weakening.

**Phase 3: The screen**
- **Goal:** A miss is shown as a miss, and the owner earns the exit signal on his device.
- **Scope:** `src/shared/task-groups.ts`, `TodayScreen`, `SearchScreen`; `documentation/` and `docs/` updates per the maintenance map (tasks domain area, roadmap).
- **Success signal:** AC-19 green; UI/UX checklist ✔/✘ recorded before the merge; AC-21 observed on the owner's device and recorded in Delivery history.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| D-A — When an occurrence is missed | When `today` in the series' time zone reaches the next occurrence's date (ADR-0006), checked on every cron run, before the Reminder sweep | Mark it missed the day after its own date (Habitica's day boundary) | ADR-0006 decides it; the owner confirmed on 2026-09-30 not to reopen it. For a daily series this is "the next day", which is how the exit signal is proven; for a monthly series late completion stays possible for the whole month |
| D-B — Catch-up after a gap | One `missed` row per whole cycle that passed; only the last occurrence is open and only it gets Reminders; at most 366 cycles per series per run, and a successor the bound leaves still dated before today gets **no** Reminders (owner-confirmed at review, 2026-09-30) | Collapse the gap into one miss | ADR-0006: "every skipped cycle leaves a permanent `missed` row". Collapsing hides misses. The bound protects the CPU budget without losing cycles — the next run continues. A past-dated successor built like any other would carry Reminders already due, and the Reminder sweep running right after would push for an occurrence the next run marks missed |
| D-C — Completion-anchored series | The supersede date is the one the rule gives as if the occurrence had been completed on its own day; the successor is dated there | Completion-anchored series never become missed | Never missing would break the honest mirror for exactly the series with a flexible cadence. Research: Todoist's `every!` has no fixed slot to miss, which is the gap this closes deliberately |
| D-D — End conditions and ended series | A miss counts toward `count` (D6). The last allowed occurrence, if not done, becomes missed on the date the rule would have produced next, and the series ends with no successor. A series the owner ended follows the same rule for its open occurrence | Leave the last occurrence open forever | Otherwise the final cycle of every finite series could never be recorded. Computed with a copy of the rule without its end condition, so `recurrence.ts` stays untouched |
| D-E — Detached occurrences | Missed like any other; the successor comes from the series template | Exempt detached occurrences | A detached edit is about that cycle (unit 9 D2); it does not change whether the cycle was done |
| D-F — Repair of a series without an open occurrence | Materialize the rule's first date on or after today; no `missed` rows for the broken period; end the series if the rule has no such date | Backfill misses for the whole gap | Only a system failure can produce this state; recording misses the owner never had a chance to avoid would put the system's fault in his history |
| D-G — Where a miss is shown | *Concluídas* lists only `done`; a separate *Não concluídas* group (collapsed, with count) lists `missed`, on *Hoje* and in search; decided in `groupTasks`, test-first | Leave the screen untouched and let unit 11 handle it | Today `groupTasks` puts every non-open Task under *Concluídas*. That was harmless while nothing wrote `missed`; from this unit on, a miss listed as "completed" is the dishonesty the project exists to avoid |
| D-H — Notify the owner of a miss | No | Push a notification per miss | Unit 12 owns it, with its own "not daily, not forever" constraint |
| Migration | None | Add an index for the scan | `missed_count`, the `missed` status and both partial unique indexes are applied; the scan uses the existing partial index on open series rows |
| Chore C6 before this PRD | Ran 2026-09-30 on a hand-pulled snapshot carrying the first real series; found and fixed a boolean restore defect; PASS | Wait for the 2026-10-04 Sunday snapshot | Owner's call at the rule-6(b) review, brought forward the same day |

---

## Research Summary

**Market Context**
- Todoist schedules recurring tasks only on future dates: completing an overdue occurrence jumps to the next future
  date and drops the missed ones with no record — the behavior ADR-0006 rejected
  (https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV). Its `every!` is completion-anchored,
  counting from the completion day, so it has no fixed slot to miss (same source). A third-party guide reports
  fixed-day rules piling up overdue copies and recommends `every!` to avoid it (https://2sync.com/blog/todoist-recurring-tasks).
- Habitica decides a miss at a configurable day boundary, not when the next occurrence arrives; a due Daily left
  unchecked damages the player and resets its streak (https://habitica.fandom.com/wiki/Dailies). Before its cron
  runs it offers a one-day grace window to record yesterday's activity (https://habitica.fandom.com/wiki/Cron) —
  second-hand, from search summaries of the wiki.
- Habitica's cron has been reported running part-way on a transient database timeout, leaving some Dailies reset
  and others not (https://github.com/HabitRPG/habitica/issues/10806) — the failure class that one batch per series
  and an idempotent sweep rule out.
- TickTick offers an explicit manual skip and retroactive habit back-fill, with no automatic missed state found
  (https://help.ticktick.com/articles/7055792921664028672). Loop Habit Tracker models adherence as a score each
  miss weakens rather than a streak a miss resets (https://github.com/iSoron/uhabits) — relevant to unit 11.
- Gaps: no primary source on multi-day catch-up (one miss per cycle vs collapse); Things 3, Streaks and Microsoft
  To Do not verified; Cloudflare documents no delivery guarantee, retry or catch-up for Cron Triggers — the
  community claims could not be opened (403).

**Technical Context**
- `buildSuccessorStatements` builds the successor Task insert plus one Reminder insert per offset via
  `occurrenceReminderInstants(date, offsets, series.timezone)`, returning statements without executing them; it is
  private to the Task routes (`src/worker/routes/tasks.ts:63-106`).
- The complete route closes the row, bumps the counter and spawns the successor in one batch, computing
  `closedCount = doneCount + 1 + missedCount` (D6) and `completedOn = todayIn(now, rule.timezone)` for
  completion-anchored series (`src/worker/routes/tasks.ts:452-505`); the skip path passes
  `closedCount = doneCount + missedCount` (`:600-662`).
- `batchOrRace` maps a `UNIQUE constraint failed` to an HTTP 409 (`src/worker/routes/tasks.ts:406-429`) — the cron
  needs a non-HTTP equivalent.
- `nextOccurrence(rule, { after, completedOn?, closedCount? })` throws without `completedOn` on a completion-anchored
  rule and applies `until`/`count` inside `isWithinEndCondition` (`src/shared/recurrence.ts:266-312`).
- `todayIn(now, timeZone)` returns the local `YYYY-MM-DD` (`src/shared/dates.ts:30-37`).
- Schema: `recurrence_series` already carries `timezone`, `anchorMode`, `endKind`/`untilDate`/`maxCount`,
  `doneCount`, `missedCount`, `status`; `tasks_series_single_open_unq` and `tasks_series_occurrence_unq` guard the
  invariants (`src/worker/db/schema.ts:55-100,191-200`).
- `runScheduledJob` reads `new Date()` itself and runs inside `runCronHeartbeat`, which writes a `cron_runs` row from
  a `finally` block; the Reminder sweep already skips `done`/`missed` Tasks (`src/worker/cron.ts:27-55`). No cron test
  fakes the clock today; `vi.setSystemTime` is used in `test/dates.test.ts:57-59` and `test/recurrence.test.ts:62-68`.
- The read side of `missed` already exists: the *Não concluídas* status filter (`src/app/components/FilterSheet.tsx:44`),
  *não concluída* in the row's meta line (`src/shared/format.ts:136`), a disabled complete control
  (`src/app/components/TaskRow.tsx:90`) — but `groupTasks` puts every non-open Task into `closed`, rendered as
  *Concluídas* (`src/shared/task-groups.ts:56-75`, `src/app/components/TodayScreen.tsx:1039`,
  `src/app/components/SearchScreen.tsx:443`).

---

*Generated: 2026-09-30*
*Approved: 2026-09-30*
*Status: APPROVED*
