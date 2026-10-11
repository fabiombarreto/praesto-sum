# Feature: Pure nudge decision (Phase 1 of repeated-miss-nudge)

```
**Decision Gate**
- Active context: none
- Activated criteria: new pure module in `src/shared`; domain rules for tasks (Recurrence Series, occurrences, `missed`) and reminders (push dispatch decision); reuse of the pure-module pattern (adherence, missed-sweep); `src/shared/recurrence.ts` and `src/shared/adherence.ts` reuse condition
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: missed recording; misses are a permanent record and skipped cycles leave no row
  - ADR-0008 / [2026-08-04] Test-first (TDD): suite derived from the PRD ACs before the Implementer runs; scope covers pure logic in `src/shared`
  - ADR-0013 / [2026-09-07] send library is `@block65/webcrypto-web-push` (not used in this phase; the decision is data only)
  - [2026-09-10] The due-Reminder sweep claims before it sends (the claim itself arrives in phase 3)
  - repeated-miss-nudge PRD D-A (trailing consecutive `missed`), D-B (N = 3 constant), D-G (from 09:00 in the series' own zone), D-I (muted run consumed)
- Applicable anti-patterns:
  - Hand-duplicated entity types (this phase declares only pure-input shapes; the wire type is a later phase)
  - Glossary synonym drift (Recurrence Series, occurrence, missed)
  - Portuguese in artifacts (no visible copy in this phase; everything English)
  - Weakening tests to force green
  - Editing accepted ADRs
- Applicable architectural rules:
  - `src/shared/` stays DOM-free, Worker-free, clock-free; `now` is always an argument
  - `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay unchanged
  - No new table, column, migration, route or UI in this phase
  - The closed-row status union mirrors the SQL CHECK
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/repeated-miss-nudge.prd.md` — Implementation Phases row 1: "Pure nudge decision" — Goal: the only new domain logic, decidable without a database or a clock. — Success signal: AC-1..AC-5 green; `recurrence.ts` and `adherence.ts` byte-identical to `main`.

## Summary

Adds one new pure module, `src/shared/nudge.ts`, exporting `NUDGE_THRESHOLD = 3`, `trailingMissStreak(rows)` (the trailing consecutive `missed` count over a series' closed occurrence rows, ordered by `occurrenceDate`) and `decideNudge(series, rows, now)` (whether the repeated-miss notification is due, as plain data, with a reason code). The 09:00 local-hour gate is judged in the zone carried by the series data. No route, schema, cron or UI is touched; the module reads no ambient clock and has no DB, Worker or DOM dependency.

## User Story

As the owner / I want the rule "three misses in a row, from 09:00 local, active, not silenced, not already told" pinned as pure code / So that the cron and the sheet in later phases only wire an already-proven decision.

## Problem Statement

The assistant has no "consecutive misses" count (`currentStreak` counts trailing `done`, `recentMisses` is a 30-day window, `missed_count` is a lifetime total) and no decision for when a pattern deserves a notification. This phase pins both in pure code before any column, claim or push exists.

## Solution Statement

`src/shared/nudge.ts` reads the same closed rows `computeSeriesAdherence` does (`AdherenceRow`), sorts them by `occurrenceDate` ascending, and counts trailing `missed` rows until a `done`. `decideNudge` composes that count with the series' status, mute flag, `nudgedAt` marker and the local hour at `now` in the series' zone, and returns `{ due, streak, reason }`. The zone is data: the caller resolves an unresolvable stored zone to `America/Sao_Paulo` (as `todayForSeries` already does) before calling.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | LOW |
| Systems Affected | `src/shared/` only |
| Dependencies | none (no new package; imports only the same-directory `./adherence` type and `./dates` helper, both unchanged) |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/repeated-miss-nudge.prd.md` Implementation Phases row 1; AC-1..AC-5 |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/repeated-miss-nudge.prd.md` | 90-104, 220-243, 298-308 | AC-1..AC-5, the pure-core architecture note and decisions D-A, D-B, D-G, D-I define every behavior |
| P0 | `src/shared/adherence.ts` | 1-78 | Pure-module header, `AdherenceRow`, the closed-row filter + `occurrenceDate` sort + trailing loop to mirror (file stays unchanged) |
| P0 | `src/shared/dates.ts` | 22, 141-179 | `PRAESTO_TIMEZONE` and `instantToLocalParts`, the local `HH:mm` helper the hour gate reuses |
| P1 | `test/adherence.test.ts` | 1-45 | Shape of the sibling suite (describe per AC, injected time, row builder) the test pair mirrors for `test/nudge.test.ts` |

## Patterns to Mirror

```
# SOURCE: src/shared/adherence.ts:1-23
/**
 * Pure adherence of a Recurrence Series (adherence-mirror, phase 1, ADR-0006):
 * ...
 * It is clock-free and database-free: it compares only local `YYYY-MM-DD`
 * strings it is handed (`today` is the series' local day, supplied by the
 * caller), reads no ambient clock, and imports nothing at all.
 */

/** The minimal row shape adherence reads from an occurrence. */
export interface AdherenceRow {
  /** The occurrence's local calendar day (`YYYY-MM-DD`). */
  occurrenceDate: string;
  status: "open" | "done" | "missed";
  ...
}
```
Copied by Task 1 (header contract: pure, clock-free, DB-free, instants supplied by the caller; the row shape is imported as a type from `./adherence`, never redeclared).

```
# SOURCE: src/shared/adherence.ts:52-67
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Derives a series' adherence from its occurrence rows and its local `today`. */
export function computeSeriesAdherence(rows: AdherenceRow[], today: string): SeriesAdherence {
  const closedRows = rows
    .filter((r) => r.status === "done" || r.status === "missed")
    .sort((a, b) => compareStrings(a.occurrenceDate, b.occurrenceDate));
  ...
  let currentStreak = 0;
  for (let i = closedRows.length - 1; i >= 0 && closedRows[i]!.status === "done"; i--) {
    currentStreak++;
  }
```
Copied by Task 2 (closed-rows filter, ascending `occurrenceDate` sort on a copy, trailing loop walking back from the latest row; here the loop counts `missed` instead of `done`).

```
# SOURCE: src/shared/dates.ts:147-151
export function instantToLocalParts(
  epochSeconds: number,
  timeZone: string = PRAESTO_TIMEZONE,
): { day: string; time: string } {
  const instant = new Date(epochSeconds * 1000);
```
Copied by Task 3 (the local `HH:mm` of an instant in a named zone; `now.getTime() / 1000` is passed in, no ambient clock is read).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/nudge.ts` | CREATE | The pure trailing-miss count and nudge decision (AC-1..AC-5) |

## NOT Building (Scope Limits)

- `nudged_at` / `nudge_muted` columns, migration `0006`, export-manifest classification, `SeriesDto.nudgeMuted`, the `PATCH /api/series/:id` field (phase 2)
- Clearing the marker on completion (phase 2)
- The cron step, claim-before-send, payload, deep link, outcome handling, the consumed-muted-run write (phase 3; this phase only returns a `muted` reason for it to act on)
- The sheet switch and the *Aderência* row state, any pt-BR copy (phase 4)
- Any configurable threshold, cadence, snooze or escalation
- Any change to `src/shared/recurrence.ts` or `src/shared/adherence.ts`
- Test files: the test pair authors `test/nudge.test.ts` from the ACs (see Notes)

## Step-by-Step Tasks

### Task 1: CREATE src/shared/nudge.ts — header, constant, input and result types
- **ACTION**: Create the file with a header comment stating it is pure, clock-free, DB-free and Worker/DOM-free. Add `import type { AdherenceRow } from "./adherence";` and `import { PRAESTO_TIMEZONE, instantToLocalParts } from "./dates";`. Export `NUDGE_THRESHOLD = 3` and `NUDGE_FROM_LOCAL_HOUR = 9`. Export `NudgeSeries { status: "active" | "ended"; nudgeMuted: boolean; nudgedAt: number | null; timeZone: string }` (`nudgedAt` is the epoch-seconds claim marker or null; `timeZone` is an already-resolved IANA zone) and `NudgeDecision { due: boolean; streak: number; reason: "due" | "ended" | "already-nudged" | "below-threshold" | "muted" | "before-window" }`. Infrastructure task: delivers no criterion by itself; it supports AC-A4 and AC-A5.
- **MIRROR**: `# SOURCE: src/shared/adherence.ts:1-23`
- **VALIDATE**: `npx tsc -b`

### Task 2: UPDATE src/shared/nudge.ts — trailingMissStreak
- **ACTION**: Export `trailingMissStreak(rows: AdherenceRow[]): number`. Keep rows whose status is `done` or `missed` (an `open` row is ignored, never counted and never a reset), sort a copy ascending by `occurrenceDate` (never by insertion order; do not mutate the argument), then count trailing `missed` rows walking back from the latest until the first `done`. `done, missed, missed, missed` is 3 (AC-A1); `missed, missed, done, missed` is 1 (AC-A1); only open rows or none is 0 (AC-A1); `missed, missed, missed, done` is 0 and two further misses then give 2 (AC-A2); skipped cycles leave no row, so `missed, missed, <gap>, missed` is 3 (AC-A3).
- **MIRROR**: `# SOURCE: src/shared/adherence.ts:52-67`
- **VALIDATE**: `npx vitest run test/nudge.test.ts -t "trailingMissStreak"`

### Task 3: UPDATE src/shared/nudge.ts — decideNudge with the local-hour gate
- **ACTION**: Export `decideNudge(series: NudgeSeries, rows: AdherenceRow[], now: Date): NudgeDecision`. Compute `streak = trailingMissStreak(rows)` and return the FIRST matching reason in this order: `ended` (status is `ended`), `already-nudged` (`nudgedAt !== null`), `below-threshold` (`streak < NUDGE_THRESHOLD`), `muted` (`nudgeMuted`), `before-window` (local hour in `series.timeZone` at `now`, taken from `instantToLocalParts(now.getTime() / 1000, series.timeZone).time` as the hour part, is below `NUDGE_FROM_LOCAL_HOUR`; no upper bound), else `due: true, reason: "due"`. `due` is true only for reason `due`. The `muted` reason with `streak >= NUDGE_THRESHOLD` and `nudgedAt` null is exactly the "run to consume" case phase 3 acts on (PRD D-I), so the order must not be changed. Read no ambient clock: `now` is the only instant; two series in `UTC` and `America/Sao_Paulo` at the same `now` are judged each on its own local hour (AC-A5). An unresolvable zone is the caller's concern (it falls back to `PRAESTO_TIMEZONE` before calling, as `todayForSeries` does); this function does not catch `RangeError`.
- **MIRROR**: `# SOURCE: src/shared/dates.ts:147-151`
- **VALIDATE**: `npx vitest run test/nudge.test.ts -t "decideNudge"`

### Task 4: VERIFY purity and untouched recurrence.ts / adherence.ts
- **ACTION**: Confirm `src/shared/nudge.ts` has no import other than `./adherence` and `./dates`, no `Date.now`, no `new Date()` without arguments, no `performance.now`, and that `src/shared/recurrence.ts` and `src/shared/adherence.ts` are byte-identical to `HEAD` (the PRD Phase 1 success signal: "`recurrence.ts` and `adherence.ts` byte-identical to `main`", restating the "unchanged" rule in the PRD's Architecture Notes). Infrastructure/verification task: no source edit; it delivers no acceptance criterion of its own and guards the purity of the module that delivers AC-A1..AC-A5.
- **MIRROR**: `# SOURCE: src/shared/adherence.ts:1-23`
- **VALIDATE**: `if grep -nE "Date\.now\(|new Date\(\)|performance\.now" src/shared/nudge.ts; then echo "FAIL: ambient clock read in nudge.ts"; exit 1; elif grep -nE "^import " src/shared/nudge.ts | grep -vE "from \"\./(adherence|dates)\""; then echo "FAIL: unexpected import in nudge.ts"; exit 1; elif ! git diff --quiet HEAD -- src/shared/recurrence.ts src/shared/adherence.ts; then echo "FAIL: recurrence.ts or adherence.ts changed"; exit 1; else echo "PASS: pure and siblings untouched"; fi`

## Validation Commands

### Level 1 STATIC_ANALYSIS
```
set -euo pipefail
npx tsc -b
npx prettier --check src/shared/nudge.ts
```

### Level 2 UNIT_TESTS
```
set -euo pipefail
npx vitest run test/nudge.test.ts
```
(`test/nudge.test.ts` is authored by the test pair before the Implementer runs.)

### Level 3 INTEGRATION
```
set -euo pipefail
npm test
npm run check
```

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** closed rows ending `done, missed, missed, missed` give a trailing miss count of 3; `missed, missed, done, missed` gives 1; only open rows, or no rows, give 0.
- **AC-A2 (PRD AC-2):** `missed, missed, missed, done` gives 0, and after two further misses the count is 2.
- **AC-A3 (PRD AC-3):** `missed, missed`, a deleted (skipped) open occurrence leaving no row, then a third `missed` give 3.
- **AC-A4 (PRD AC-4):** an `active` series, not muted, `nudgedAt` null, count >= 3, at a local time >= 09:00 in its zone is `due`; any one of `ended`, muted, `nudgedAt` set, or count 2 makes it not due, each with its own reason.
- **AC-A5 (PRD AC-5):** with a count of 3, `now` at 00:10, 03:00 and 08:55 local is not due (`before-window`) and 09:00 or later the same day is due; a `UTC` series and an `America/Sao_Paulo` series at the same instant are each judged on their own local hour.
R8b note for the reviewer: every bullet above carries its `(PRD AC-N)` token. The purity and "`recurrence.ts` / `adherence.ts` unchanged" guarantees are not acceptance criteria (the PRD has no criterion for them); they are carried by the infrastructure/verification Task 4.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Time-zone or DST error in the 09:00 gate | M | M | `now` and the zone are arguments; tests at both sides of the boundary (08:55 / 09:00) and for two zones (AC-A5); `instantToLocalParts` already uses `hourCycle: "h23"` |
| An unresolvable stored zone makes `Intl` throw `RangeError` inside the cron | L | M | The caller resolves the zone with the `todayForSeries` fallback before calling; phase 3's plan must carry that resolution and its own test |
| Result reason order drifts and the muted-run consumption of phase 3 silently breaks | L | M | The order is specified in Task 3 and pinned by AC-A4 tests per reason (the `muted` case at count >= 3 is asserted explicitly) |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file; the `**VALIDATE**` commands that run `test/nudge.test.ts` only execute the pair-authored suite and never edit it.
- The exact exported names beyond `trailingMissStreak`, `decideNudge` and `NUDGE_THRESHOLD` (`NudgeSeries`, `NudgeDecision`, `NUDGE_FROM_LOCAL_HOUR`) are this plan's declared contract; the test pair should treat that contract as the source for imports.
- `NudgeSeries` is a minimal pure-input shape, not an entity type; the Drizzle-derived columns arrive in phase 2 and the `kind`/task-only filter is a loader concern of phase 3 (only task series are loaded).
- Open questions in the PRD (upper bound of the window, first-day burst, unmute behaviour) do not change this phase: no upper bound is encoded, no backfill exists here, and D-I's default is only exposed through the `muted` reason.
- Level 2 runs the whole pair-authored suite as a gate over the finished module; per-task VALIDATE commands run only their own `-t` slice.

*Generated: 2026-10-10*
*Approved: 2026-10-10*
*Implemented: 2026-10-10*
*Status: IMPLEMENTED*
