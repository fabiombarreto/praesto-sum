# Feature: Pure adherence (Phase 1 of adherence-mirror)

```
**Decision Gate**
- Active context: none
- Activated criteria: new pure module in `src/shared`; domain rules for tasks (Recurrence Series, occurrences, `missed`); reuse of the pure-module pattern (missed-sweep, series-edit); `src/shared/recurrence.ts` reuse condition (unit 17)
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: missed recording; adherence history derives from real rows at zero extra modeling cost
  - ADR-0008 / [2026-08-04] Test-first (TDD): suite derived from the PRD ACs before the Implementer runs; scope covers pure logic in `src/shared`
  - adherence-mirror PRD D-A (rows are the source of truth), D-B (current streak), D-D (30-day window and ranking)
- Applicable anti-patterns:
  - Hand-duplicated entity types (the wire type is a later phase; this phase declares only pure-input shapes)
  - Glossary synonym drift (Recurrence Series, occurrence, missed)
  - Portuguese in artifacts (no visible copy in this phase; everything English)
  - Weakening tests to force green
  - Editing accepted ADRs
- Applicable architectural rules:
  - `src/shared/` stays DOM-free, clock-free and dependency-free; `today` is always an argument
  - `src/shared/recurrence.ts` must stay unchanged
  - No new table, no route, no UI in this phase
  - Types flow from schema outward; the closed-row status union mirrors the SQL CHECK
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/adherence-mirror.prd.md` — Implementation Phases row 1: "Pure adherence" — Goal: Every edge of "what does this series' record say" is pinned before any route or screen exists. — Success signal: AC-1..AC-10 green; `git diff` shows `src/shared/recurrence.ts` unchanged.

## Summary

Adds one new pure module, `src/shared/adherence.ts`, that turns a series' occurrence rows plus that series' local `today` into its adherence (done count, closed count, current streak, `missed` dates of the 30 days ending yesterday), and a second pure function that ranks series into the "what I keep failing" order. No route, schema or UI is touched; the module is clock-free and DB-free and composes nothing from `recurrence.ts`.

## User Story

As the owner / I want each Recurrence Series' record computed from its real done and missed rows / So that later phases can show which recurring commitment is slipping without any number disagreeing with the rows.

## Problem Statement

Every occurrence the owner does not do becomes a permanent `missed` row, but each is shown alone; nothing adds them up per Recurrence Series. This phase pins, in pure code, how a series' record is derived, before any endpoint or screen exists.

## Solution Statement

`src/shared/adherence.ts` exports `computeSeriesAdherence(rows, today)` and `rankAdherence(entries)`. Rows (not the series counters) are the source of truth; streak orders by `occurrence_date`; the window is `occurrence_date >= today - 30` and `< today`; ranking is misses in window desc, most recent miss desc, title asc, id asc, with zero-miss series excluded.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | LOW |
| Systems Affected | `src/shared/` only |
| Dependencies | none (no new package; no import from `recurrence.ts`) |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/adherence-mirror.prd.md` Implementation Phases row 1; AC-1..AC-10 |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/adherence-mirror.prd.md` | 90-120, 289-300 | AC-1..AC-10 and decisions D-A..D-D define every behavior |
| P0 | `src/shared/missed-sweep.ts` | 1-54 | Pure-module header, input/output interfaces, and the UTC calendar-day helper to mirror |
| P1 | `src/shared/series-edit.ts` | whole file | Second pure `src/shared` module; export and naming conventions |
| P1 | `test/missed-sweep.test.ts` | 1-50 | Shape of the sibling suite the test pair will author for this module |

## Patterns to Mirror

```
# SOURCE: src/shared/missed-sweep.ts:1-11
/**
 * Pure planning of the missed sweep (unit 10, ADR-0006): ...
 *
 * It is clock-free and database-free: it compares only local `YYYY-MM-DD`
 * strings it is handed (`today` is the series' local day, supplied by the
 * caller), reads no ambient clock, and imports only its same-directory sibling
 * `./recurrence`, whose `nextOccurrence` it composes without changing.
 */
import { nextOccurrence, type RecurrenceRule } from "./recurrence";
```
Copied by Task 1 (header contract: clock-free, DB-free, `today` supplied by the caller; unlike this sibling, `adherence.ts` imports nothing at all).

```
# SOURCE: src/shared/missed-sweep.ts:50-54
/** The calendar day before `day`, derived from an explicit instant only. */
function previousDay(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
```
Copied by Task 1 (a local-date shift via `Date.UTC` on explicit components, never an ambient clock; generalized to `shiftDay(day, -30)`).

```
# SOURCE: src/shared/missed-sweep.ts:16-27
export interface MissedSweepInput {
  rule: RecurrenceRule;
  status: "active" | "ended";
  ...
  /** The series' local calendar day (`YYYY-MM-DD`). */
  today: string;
}
```
Copied by Tasks 2 and 3 (exported input interfaces with `today` as an explicit field/argument).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/adherence.ts` | CREATE | The pure adherence module (AC-1..AC-10) |

## NOT Building (Scope Limits)

- Any route, `GET /api/series/adherence`, DTO or wire type in `src/shared/api.ts` (phase 2)
- Any screen, `AppRoute`, or the *Hoje* line and its show/text decision (phase 3)
- Longest streak, percentages, shields, decaying scores, notifications
- Reading `done_count`/`missed_count`; any migration or index
- Any change to `src/shared/recurrence.ts`
- Test files: the test pair authors `test/adherence.test.ts` from the ACs (see Notes)

## Step-by-Step Tasks

### Task 1: CREATE src/shared/adherence.ts — module header, input types, window helper
- **ACTION**: Create the file with a header comment stating it is clock-free, DB-free and imports nothing. Export `AdherenceRow { occurrenceDate: string; status: "open" | "done" | "missed" }` and `SeriesAdherence { done: number; closed: number; currentStreak: number; recentMisses: string[] }`. Add an unexported `shiftDay(day, delta)` using `Date.UTC` and an exported `RECENT_WINDOW_DAYS = 30`. Infrastructure task: delivers no criterion by itself; it supports AC-A7 and AC-A10.
- **MIRROR**: `# SOURCE: src/shared/missed-sweep.ts:1-11` and `# SOURCE: src/shared/missed-sweep.ts:50-54`
- **VALIDATE**: `npx tsc -b` (the module must type-check with exact exports; no import statements allowed: `if grep -nE "^import " src/shared/adherence.ts; then echo "FAIL: adherence.ts must import nothing"; exit 1; else echo "PASS: no imports"; fi`)

### Task 2: UPDATE src/shared/adherence.ts — computeSeriesAdherence
- **ACTION**: Export `computeSeriesAdherence(rows: AdherenceRow[], today: string): SeriesAdherence`. Closed rows are `done` or `missed`; `open` is counted in neither (AC-A1). Sort closed rows by `occurrenceDate` ascending (never by insertion or completion; AC-A4); `done` = count of done, `closed` = closed length. `currentStreak` = trailing consecutive `done` from the latest closed row backwards, 0 if the latest is `missed` (AC-A2, AC-A3); skipped cycles leave no row and do not interfere (AC-A5); detached occurrences are ordinary rows (AC-A6, no field read). `recentMisses` = `missed` dates with `shiftDay(today, -30) <= date < today`, newest first (AC-A7). Empty history returns zeros and `[]` with no division (AC-A8).
- **MIRROR**: `# SOURCE: src/shared/missed-sweep.ts:16-27`
- **VALIDATE**: `npx tsc -b`

### Task 3: UPDATE src/shared/adherence.ts — rankAdherence
- **ACTION**: Export `AdherenceRankInput { seriesId: string; title: string; recentMisses: string[] }` (`recentMisses` as returned by Task 2, newest first) and `rankAdherence(entries): string[]` returning series ids ordered by `recentMisses.length` descending, then most recent miss date descending, then `title` ascending, then `seriesId` ascending; entries with zero recent misses are excluded (AC-A9). Use plain string comparison (no locale, no clock); do not mutate the input array.
- **MIRROR**: `# SOURCE: src/shared/missed-sweep.ts:16-27`
- **VALIDATE**: `npx tsc -b`

### Task 4: VERIFY purity and untouched recurrence.ts
- **ACTION**: Confirm `src/shared/adherence.ts` has no import, no `Date.now`, no `new Date()` without arguments, no `performance.now`, and that `src/shared/recurrence.ts` is unchanged (AC-A10). Infrastructure/verification task: no source edit.
- **MIRROR**: `# SOURCE: src/shared/missed-sweep.ts:1-11`
- **VALIDATE**: `if grep -nE "Date\.now\(|new Date\(\)|performance\.now|^import " src/shared/adherence.ts; then echo "FAIL: impure construct in adherence.ts"; exit 1; elif ! git diff --quiet HEAD -- src/shared/recurrence.ts; then echo "FAIL: recurrence.ts changed"; exit 1; else echo "PASS: pure and recurrence.ts untouched"; fi`

## Validation Commands

### Level 1 STATIC_ANALYSIS
```
set -euo pipefail
npx tsc -b
npx prettier --check src/shared/adherence.ts
```

### Level 2 UNIT_TESTS
```
set -euo pipefail
npx vitest run test/adherence.test.ts
```
(`test/adherence.test.ts` is authored by the test pair before the Implementer runs.)

### Level 3 INTEGRATION
```
set -euo pipefail
npm test
npm run check
```

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** 7 done, 3 missed, 1 open rows yield `done = 7`, `closed = 10`; the open row counts in neither.
- **AC-A2 (PRD AC-2):** rows `done, missed, done, done, done` yield `currentStreak = 3`.
- **AC-A3 (PRD AC-3):** rows `done, done, missed` yield `currentStreak = 0`.
- **AC-A4 (PRD AC-4):** the streak follows `occurrence_date` order, not insertion order or completion time.
- **AC-A5 (PRD AC-5):** a skipped cycle (no row) between two dones gives `currentStreak = 2` and is excluded from `closed`.
- **AC-A6 (PRD AC-6):** a detached `done` row counts toward `done`, `closed` and the streak.
- **AC-A7 (PRD AC-7):** with `today = 2026-10-31`, missed rows `2026-09-30`, `2026-10-01`, `2026-10-30` give `recentMisses = ["2026-10-30", "2026-10-01"]`.
- **AC-A8 (PRD AC-8):** a series with no closed rows gives zeros and `[]`, with no `NaN`.
- **AC-A9 (PRD AC-9):** series A (3 misses, last 2026-10-20), B (3, last 2026-10-28), C (1), D (0) rank as `B, A, C`, D absent.
- **AC-A10 (PRD AC-10):** `adherence.ts` imports nothing, takes `today` as an argument, and `recurrence.ts` is unchanged.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Off-by-one at the window edge | M | M | Window defined once (`>= today-30`, `< today`) and pinned by AC-A7 at both edges |
| research-web returned only unverified search-snippet evidence (no source covers ranking or this project's record-every-miss model) | M | L | Streak, window and ranking come from the PRD's decisions D-B and D-D, not from the web findings; research-codebase anchors (`src/shared/missed-sweep.ts:1-11, 16-27, 50-54`) confirmed the patterns |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework.
- Level 2 runs the pair-authored suite as a gate over the finished module; per-task VALIDATE commands do not invoke it.
- The pure inputs here are minimal row shapes, not entity types; the Drizzle-derived wire type arrives in phase 2.

*Generated: 2026-10-04*
*Approved: 2026-10-04*
*Implemented: 2026-10-04*
*Status: IMPLEMENTED*
