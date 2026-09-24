# Feature: Pure expansion (Phase 1 of recurring-tasks)

```
**Decision Gate**
- Active context: none
- Activated criteria: cross-cutting artifact creation — a new pure module in `src/shared/` that compiles into every target (browser + Worker) and that unit 17 `recurring-events` must reuse unchanged; domain rules for tasks (recurrence)
- Decisions found:
  - ADR-0006 recurrence model — one shared rule table (`recurrence_series`), one shared pure expansion function resolving each occurrence in local time; the expansion reads no clock and touches no database (`docs/decisions.md`, 2026-08-03 entry)
  - ADR-0008 test-first methodology — `tdd: true`; the test pair derives the suite from the PRD's Acceptance Criteria before the Implementer runs
  - Hand-duplicated entity types anti-pattern — a rule type must not be declared independently of the Drizzle schema it represents (`docs/anti-patterns.md`)
- Applicable anti-patterns:
  - Hand-duplicated entity types (`docs/anti-patterns.md`) — `RecurrenceRule`'s fields must structurally mirror `recurrenceSeries`'s rule columns, following the exact precedent `TaskDto`/`TaskStatus` already sets in `src/shared/api.ts` (hand-written in `src/shared`, drift caught at the schema-to-DTO mapping site, never by importing the schema into `src/shared`)
  - Weakening tests to force green (`docs/anti-patterns.md`) — not applicable to this phase's own diff (Implementer writes no test file — see `## Notes`), but binding on how the Implementer must react if a test looks wrong: fix the code, never the test
- Applicable architectural rules:
  - `src/shared/` compiles into every target and carries no DOM globals, no Worker globals and no runtime dependencies (`docs/context/architecture.md`); per-target tsconfig project references make a boundary violation a compile error
  - Domain enums enforced twice (TypeScript union + SQL CHECK) — `RecurrenceRule`'s `freq`/`anchorMode`/`endKind` literal unions must match `recurrenceSeries`'s CHECK-constrained enums exactly
  - Migrations only via drizzle-kit + wrangler — not applicable, this phase touches no migration
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/recurring-tasks.prd.md` — Implementation Phases row 1: "Pure expansion" — Goal: The function unit 17 will reuse unchanged exists, and its edge cases are pinned before any route depends on it. — Success signal: AC-1..AC-10 green; the module has zero imports outside `src/shared/`.

## Summary

This phase builds the one pure, clock-free, DB-free module the rest of the `recurring-tasks` unit and unit 17 (`recurring-events`) depend on: `src/shared/recurrence.ts`. It exports `firstOccurrence`, `nextOccurrence`, `expandOccurrences` and `occurrenceReminderInstants` — all local-calendar-day arithmetic with every input (including "the day it was completed", for completion-anchored series) taken as an explicit argument, never read from the system clock. The module touches no route, no schema, no UI — its own test file is the only other artifact this unit produces, and per this project's test-first methodology that test file is authored by the `test-writer`/`test-reviewer` pair before this plan's tasks run, not by the Implementer (see `## Notes`).

## User Story

As the owner of a recurring commitment (rent, a bill, a weekly chore),
I want the system to compute — correctly, for every frequency, anchor mode, end condition and month-day edge case — what the next occurrence date is,
So that later phases can materialize that date as a real Task without ever getting the arithmetic wrong.

## Problem Statement

Praesto has no idea a Task can return: each cycle is either re-typed by hand or kept as one open Task whose date is pushed forward, silently erasing the record of every cycle already done. Before any route or screen can register a recurring Task, the date arithmetic itself — the part every later phase and unit 17 depend on — has to exist and be pinned against its edge cases (month-day overflow, leap years, both anchor modes, end conditions) in isolation, with no database or clock to hide a wrong answer.

## Solution Statement

Implement `src/shared/recurrence.ts` as a single, self-contained module: a `RecurrenceRule` type that structurally mirrors the `recurrenceSeries` table's rule columns (hand-written in `src/shared`, per the `TaskDto` precedent — never importing the Drizzle schema, which would pull the ORM into the SPA bundle and violate AC-1's zero-import boundary), plus four pure functions covering first/next/window occurrence computation and reminder-instant composition. Month-day overflow clamps `BACKWARD` (PRD Decision D1); the completion anchor takes the completion day as a required argument and throws rather than reading the clock (PRD Decision D5); end conditions count closed occurrences (`done + missed`, PRD Decision D6).

## Metadata

| Field | Value |
|---|---|
| Type | Feature (new pure library module) |
| Complexity | Medium — no external dependencies, but several interacting edge cases (month-day clamp × leap year × two anchor modes × two end-condition kinds) |
| Systems Affected | `src/shared/` (pure domain layer) — the seam Phase 2 (series API), Phase 3 (materialization) and unit 17 (`recurring-events`) all build on |
| Dependencies | None (Implementation Phases row 1, `Depends` = `-`) |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/recurring-tasks.prd.md:399-411` (Implementation Phases row 1 + Phase 1 Phase Details) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/recurring-tasks.prd.md` | 119-166 | AC-1..AC-10 — the exact input/output contract this module must satisfy, including the worked examples (dates, expected results) tasks must reproduce |
| P0 | `src/shared/dates.ts` | 1-139 | The sibling pure module to mirror: no-import module header, `PRAESTO_TIMEZONE`, and `offsetToInstant` — the existing helper `occurrenceReminderInstants` must compose, never reimplement |
| P0 | `src/worker/db/schema.ts` | 55-137 | The `recurrenceSeries` table's rule columns (`freq`, `interval`, `byWeekday`, `byMonthday`, `dtstart`, `timezone`, `anchorMode`, `endKind`, `untilDate`, `maxCount`) — `RecurrenceRule`'s fields must structurally match these exactly, including the literal-union enum values |
| P0 | `src/worker/db/schema.ts` | 417-421 | `RecurrenceSeries`/`NewRecurrenceSeries` — the Drizzle-inferred type names a future Phase 2 mapping site will build a `RecurrenceRule` from field-by-field; this phase's type must accept that mapping with zero renaming |
| P1 | `src/shared/api.ts` | 1-40 | The precedent for how `src/shared` declares a hand-written type that structurally mirrors a Drizzle schema WITHOUT importing it (`TaskStatus`, `TaskPriority`, `TaskDto`) — `RecurrenceRule` follows the identical convention |
| P1 | `src/worker/dto.ts` | 1-43 | The field-by-field mapping (`toTaskDto`) that makes schema drift a compile error at the mapping site, not at the `src/shared` declaration site — explains why Phase 1 is safe to hand-write `RecurrenceRule`'s shape |
| P1 | `test/dates.test.ts` | 1-66 | The pattern to mirror for testing a pure `src/shared` module: fixed-offset fixtures, direct import from `../src/shared/...`, and the explicit "reads no ambient clock" test via `vi.useFakeTimers()`/`vi.setSystemTime` |
| P1 | `test/tasks.test.ts` | 115-198 | The existing recurrence-adjacent tests — they only prove the `recurrence_series`/`tasks` unique-index DB invariants, confirming no pure-function coverage exists yet for this module |
| P2 | `src/worker/routes/reminders.ts` | 53-65 | A real call site composing `offsetToInstant(task.deadline, originOffsetMinutes)` — the pattern `occurrenceReminderInstants` must follow, one call per offset |
| P2 | `docs/context/methodology.md` | 1-22 | `tdd: true`, `test_frameworks: ["vitest"]` — governs the TDD routing note in `## Notes` |

## Patterns to Mirror

```
# SOURCE: src/shared/dates.ts:1-22
/**
 * Date reasoning shared by both compile targets.
 * ...
 * This module carries no imports so it stays usable from the browser bundle
 * and the Worker alike, matching the constraint stated at the top of
 * `src/shared/api.ts`.
 */

export const PRAESTO_TIMEZONE = "America/Sao_Paulo";
```
Copied by Task 1 — `recurrence.ts`'s module header states the same no-import, dual-compile-target convention.

```
# SOURCE: src/shared/api.ts:1-22
/**
 * Wire contract between the PWA and the Worker API.
 *
 * This module is compiled into BOTH the browser and the Worker projects, so it
 * must stay environment-agnostic and free of runtime dependencies — importing
 * the Drizzle schema here would pull the ORM into the SPA bundle. Drift is still
 * a compile error, not a convention: `src/worker/dto.ts` builds every DTO field
 * by field from the schema row type, so renaming a column breaks the build
 * (docs/anti-patterns.md — "hand-duplicated entity types").
 * ...
 */

export type TaskStatus = "open" | "done" | "missed";
```
Copied by Task 1 — this is the exact precedent for declaring `RecurrenceRule` by hand in `src/shared` while keeping it schema-derived in spirit: the type is never imported from `src/worker/db/schema.ts` (AC-1 forbids that import), but its field names and literal-union types are written to match `recurrenceSeries`'s rule columns exactly, and any future drift is caught where `src/worker/dto.ts` builds a `RecurrenceRule` field-by-field from a `RecurrenceSeries` row (Phase 2, out of this phase's scope).

```
# SOURCE: src/worker/db/schema.ts:63-79
    // Rule (shared vocabulary — expanded by one pure function in src/shared).
    freq: text("freq", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
    interval: integer("interval").notNull().default(1),
    /** JSON array of ISO weekday numbers (1 = Monday … 7 = Sunday), or NULL. */
    byWeekday: text("by_weekday"),
    byMonthday: integer("by_monthday"),
    /** First date of the series, local calendar day. */
    dtstart: text("dtstart").notNull(),
    /** IANA zone the rule is resolved in before converting to instants. */
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    /**
     * 'calendar' keeps the original track and skips missed dates;
     * 'completion' computes the next date from the actual completion date.
     */
    anchorMode: text("anchor_mode", { enum: ["calendar", "completion"] })
      .notNull()
      .default("calendar"),
```
Copied by Task 1 — `RecurrenceRule`'s field names and literal unions are written to match this column set exactly (`byWeekday` taken as an already-decoded `number[] | null`, since the pure module knows nothing of the JSON-text storage format; that decode is a future Phase 2 concern).

```
# SOURCE: src/shared/dates.ts:108-112
export function offsetToInstant(
  day: string,
  offsetMinutes: number,
  timeZone: string = PRAESTO_TIMEZONE,
): number {
```
Copied by Task 4 — `occurrenceReminderInstants(day, offsets, tz)` calls this once per offset in `offsets`, composing rather than reimplementing the DST-aware conversion.

```
# SOURCE: src/worker/routes/reminders.ts:58-60
  if (originOffsetMinutes !== null && task !== undefined && task.deadline !== null) {
    fireAt = offsetToInstant(task.deadline, originOffsetMinutes);
```
Copied by Task 4 — a real call site proving the composition pattern (day + offset in, instant out) `occurrenceReminderInstants` must follow.

```
# SOURCE: test/dates.test.ts:55-65
  it("reads no ambient clock: mocking the system clock does not change the result (AC-14)", () => {
    const before = offsetToInstant("2026-09-20", 60);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      const after = offsetToInstant("2026-09-20", 60);
      expect(after).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
```
Grounding reference only (not copied by an Implementer task — the Implementer authors no test file this phase, see `## Notes`): this is the assertion shape the `test-writer` agent's suite for AC-1 ("Clock-free") is expected to follow.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/recurrence.ts` | CREATE | The pure expansion module itself — `firstOccurrence`, `nextOccurrence`, `expandOccurrences`, `occurrenceReminderInstants` (AC-1..AC-10) |

## NOT Building (Scope Limits)

- No route (`src/worker/routes/series.ts` is Phase 2).
- No schema change or migration (migration `0005` is Phase 2).
- No UI (the *Repetir* control and series glyph are Phase 4).
- No materialization on complete/delete/reopen (Phase 3).
- No `missed` sweep, adherence tracking or repeated-miss nudge (units 10-12).
- No rule-edit support, series hard-delete, "this and future" edits, or Google Calendar mirroring — all out of the parent unit entirely (PRD "What We're NOT Building").
- No decoding of `byWeekday`'s stored JSON-text format or `reminderOffsets` — this module takes already-decoded arguments; the JSON parse/stringify boundary belongs to the Phase 2 route.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/recurrence.ts — RecurrenceRule type + calendar-anchored stepping
**ACTION**: Create `src/shared/recurrence.ts` with a module header mirroring `dates.ts`'s no-import convention. Declare `RecurrenceRule` (a hand-written type in `src/shared`, structurally matching `recurrenceSeries`'s rule columns: `freq: "daily" | "weekly" | "monthly" | "yearly"`, `interval: number`, `byWeekday: number[] | null`, `byMonthday: number | null`, `dtstart: string`, `timezone: string`, `anchorMode: "calendar" | "completion"`, `endKind: "never" | "until" | "count"`, `untilDate: string | null`, `maxCount: number | null`) and the `NextOccurrenceArgs`/`ExpandArgs` argument types. Implement `firstOccurrence(rule)` and `nextOccurrence(rule, { after, completedOn?, closedCount? })` for the calendar anchor mode covering daily/weekly (with `interval` and `byWeekday`, AC-4)/monthly (by `byMonthday`, no overflow yet, AC-2)/yearly stepping (AC-5), re-deriving each candidate date from the rule rather than incrementing the previous result, and keeping the calendar anchor on-track past a late completion (AC-6).
**MIRROR**: `# SOURCE: src/shared/dates.ts:1-22` (module header/no-import convention) and `# SOURCE: src/shared/api.ts:1-22` (hand-written schema-mirroring type convention) and `# SOURCE: src/worker/db/schema.ts:63-79` (exact field/enum shapes to mirror)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 2: UPDATE src/shared/recurrence.ts — month-day overflow clamp + completion anchor
**ACTION**: Add the `BACKWARD` month-day-overflow clamp to the monthly/yearly stepping added in Task 1 (PRD Decision D1, AC-3: day 31 in a 30-day or 28/29-day month clamps to that month's last real day; the track is re-derived from the rule each month, never from the previously clamped date — so January 31 → February 28/29 → March 31, never March 29). Add the `completion` anchor branch to `nextOccurrence`: when `rule.anchorMode === "completion"`, compute the next date from `args.completedOn` instead of `args.after`, and throw a `TypeError` when `completedOn` is `undefined` for a completion-anchored rule (PRD Decision D5, AC-7 — never silently read the clock).
**MIRROR**: `# SOURCE: src/worker/db/schema.ts:63-79` (the `anchorMode` enum and its doc comment naming exactly this branch)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 3: UPDATE src/shared/recurrence.ts — end conditions + expandOccurrences
**ACTION**: Add end-condition handling to `nextOccurrence`: `endKind: "until"` returns `null` once the next track date would be after `untilDate`; `endKind: "count"` returns `null` once `args.closedCount >= rule.maxCount` (PRD Decision D6 — `closedCount` is `done_count + missed_count`, computed by the caller, never by this module). Add `expandOccurrences(rule, { from, to })`, returning every occurrence date in `[from, to]` ascending by repeated `nextOccurrence` stepping from `firstOccurrence`, and throw a `RangeError` when `to - from` exceeds 366 days (AC-9's runaway-loop guard).
**MIRROR**: none new — reuses the `RecurrenceRule`/end-condition fields established in Task 1 (`# SOURCE: src/worker/db/schema.ts:63-79`, the `endKind`/`untilDate`/`maxCount` columns just above the cited range, same file)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 4: UPDATE src/shared/recurrence.ts — occurrenceReminderInstants + clock-free audit
**ACTION**: Add `occurrenceReminderInstants(day: string, offsets: number[], tz: string): number[]`, mapping each offset through `offsetToInstant(day, offset, tz)` (imported from `../shared/dates`, a same-directory `src/shared` import — allowed; only `src/worker/`/`src/app/` imports are forbidden). Finish with a self-audit pass over the whole file: confirm there is no `Date.now()` call, no bare `new Date()` (every `Date`/day argument is a parameter), and no import statement referencing `../worker/` or `../app/` anywhere in the file (AC-1).
**MIRROR**: `# SOURCE: src/shared/dates.ts:108-112` (the signature to compose) and `# SOURCE: src/worker/routes/reminders.ts:58-60` (the real composition call-site pattern)
**VALIDATE**: `npx vitest run test/recurrence.test.ts`

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc -b --noEmit
npx eslint src/shared/recurrence.ts
```

### Level 2: UNIT_TESTS
```bash
npx vitest run test/recurrence.test.ts
```
AC-1..AC-10 must all be green. This is the test-writer/test-reviewer's suite (authored before this plan's tasks run, per `tdd: true`) — the Implementer's job is to make it pass, not to write it.

### Level 3: INTEGRATION (import-boundary assertion + full-repo regression)
```bash
set -euo pipefail
if grep -nE '\.\./(worker|app)' src/shared/recurrence.ts; then
  echo "FAIL: src/shared/recurrence.ts imports from src/worker or src/app"
  exit 1
else
  echo "PASS: src/shared/recurrence.ts has zero worker/app imports"
fi
npm test
```
The first block is a real, fail-capable assertion of AC-1's "zero imports outside `src/shared/`" success signal, independent of `tsc -b`'s project-reference enforcement. `npm test` runs the full existing suite as a regression check — Phase 1 touches only a new file, so nothing in `test/tasks.test.ts` or elsewhere should change.

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** `firstOccurrence`/`nextOccurrence`/`expandOccurrences` return identical results across two calls with the system clock faked a year apart (`vi.setSystemTime`); the module imports nothing from `src/worker/` or `src/app/`.
- **AC-A2 (PRD AC-2):** For `{ freq: "monthly", interval: 1, byMonthday: 5, dtstart: "2026-08-05" }`, `nextOccurrence(rule, { after: "2026-08-05" })` returns `"2026-09-05"`; `firstOccurrence(rule)` returns `"2026-08-05"`.
- **AC-A3 (PRD AC-3):** For `{ freq: "monthly", byMonthday: 31, dtstart: "2026-01-31" }`, occurrences January-April 2026 are `2026-01-31, 2026-02-28, 2026-03-31, 2026-04-30`; in 2028 the February occurrence is `2028-02-29`.
- **AC-A4 (PRD AC-4):** For `{ freq: "weekly", interval: 2, byWeekday: [1, 4], dtstart: "2026-09-21" }`, expanding `2026-09-21` to `2026-10-09` yields `2026-09-21, 2026-09-24, 2026-10-05, 2026-10-08`.
- **AC-A5 (PRD AC-5):** For `{ freq: "daily", interval: 3, dtstart: "2026-09-01" }`, the occurrence after `2026-09-01` is `2026-09-04`; for `{ freq: "yearly", dtstart: "2028-02-29" }`, occurrences are `2028-02-29, 2029-02-28, 2030-02-28, 2031-02-28, 2032-02-29` *(source PRD AC-5 amended 2026-09-23, owner-confirmed: the approved text skipped `2031-02-28`)*.
- **AC-A6 (PRD AC-6):** For a calendar-anchored monthly-on-the-5th series, `nextOccurrence(rule, { after: "2026-08-05", completedOn: "2026-09-20" })` returns `"2026-09-05"` — the next track date, even if already past.
- **AC-A7 (PRD AC-7):** For `{ freq: "daily", interval: 3, anchorMode: "completion" }`, `nextOccurrence(rule, { after: "2026-09-05", completedOn: "2026-09-10" })` returns `"2026-09-13"`; calling without `completedOn` throws `TypeError`.
- **AC-A8 (PRD AC-8):** `endKind: "until", untilDate: "2026-12-05"` on a monthly-on-the-5th series returns `null` after `2026-12-05`. `endKind: "count", maxCount: 3, closedCount: 3` returns `null`; `closedCount: 2` returns a date.
- **AC-A9 (PRD AC-9):** `expandOccurrences(rule, { from, to })` returns every occurrence date in `[from, to]` ascending, and throws `RangeError` for a window longer than 366 days.
- **AC-A10 (PRD AC-10):** `occurrenceReminderInstants(day, [1440, 60], tz)` returns exactly `[offsetToInstant(day, 1440, tz), offsetToInstant(day, 60, tz)]`; for `tz = "America/New_York"` on `2026-03-08` the instants match `offsetToInstant`'s own DST handling.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Silent month-overflow or leap-year drift (the 31st, Feb 29) | M | High — a wrong date silently misplaces a real Task later | `BACKWARD` clamp behavior named in advance (PRD Decision D1), re-derived from the rule each month (never from the previous clamped date), and pinned as an explicit table in AC-3/AC-5 before any route depends on it; corroborated by research-web finding that `rrule-temporal` (a library this project rejected) shipped exactly this bug by defaulting to `constrain` instead of skip semantics (github.com/ggaabe/rrule-temporal/issues/140) |
| `RecurrenceRule` hand-written in `src/shared` drifts silently from `recurrenceSeries`'s real columns | M | Medium — would surface as a Phase 2 compile error, not silent, but only once Phase 2 exists | Field-for-field mirror of `src/worker/db/schema.ts:63-79`, following the exact `TaskDto`/`src/shared/api.ts` precedent where drift is caught at the future `src/worker/dto.ts` mapping site (Phase 2), never by importing the schema into `src/shared` (AC-1 forbids that import) |
| Completion-anchored series behavior when completed extremely late is untested beyond AC-7's single worked example | L | Low — Phase 1's tested surface is explicitly bounded to AC-1..AC-10 | Left as an open question for later units; research-web corroborates Todoist's distinct "jump to next future occurrence" handling for calendar-anchored (not completion-anchored) series, which is out of this phase's scope to resolve |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly (`tsc -b`, the eventual `test/recurrence.test.ts` run, the import-boundary grep) rather than the Implementer invoking the test framework to write new coverage.

**Why `RecurrenceRule` is hand-written rather than imported from the schema:** AC-1 requires the module to import nothing from `src/worker/`. This looks, at first read, like it contradicts the orchestrator's instruction that the rule type "must derive from the Drizzle `recurrenceSeries` table... rather than being hand-declared." The resolution already exists in this codebase: `src/shared/api.ts`'s `TaskDto`/`TaskStatus`/`TaskPriority` are hand-written in `src/shared`, structurally matching `tasks`'s columns, with drift caught not by an import but by `src/worker/dto.ts`'s field-by-field mapping function (a compile error if a field is renamed). `RecurrenceRule` follows the identical convention: written by hand in Task 1 with field names and literal-union types that match `recurrenceSeries`'s rule columns exactly, verified for real (not just by convention) once Phase 2 builds a `RecurrenceRule` from a `RecurrenceSeries` row field-by-field.

**Migration `0005` (the `recurrence_series.priority` enum fix) is explicitly out of this phase's scope** — it belongs to Phase 2 ("Series API") per the PRD's own Phase Details, and `priority` is not part of the rule vocabulary this module computes over.

*Generated: 2026-09-22*
*Approved: 2026-09-23*
*Implemented: 2026-09-23*
*Status: IMPLEMENTED*
