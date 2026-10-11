# Feature: Adherence endpoint (Phase 2 of adherence-mirror)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a PRD phase that downstream test and implement stages consume); domain rules for tasks (Recurrence Series, occurrences, `missed`); impact on reusable services (`/api/series` gains a read endpoint); a new wire type and its single mapping point
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: adherence history derives from real rows at zero extra modeling cost; the owner chose missed-recording so misses stay visible
  - [2026-08-04] Test-first (ADR-0008): suite derived from the Acceptance Criteria is RED before the Implementer runs; scope is routes, auth gate, pure `src/shared` logic, `scheduled()` jobs, not React components
  - ADR-0009: visible copy pt-BR, everything else English (this phase adds no visible copy)
  - adherence-mirror PRD D-A: rows (`done`/`missed`) are the source of truth, `done_count`/`missed_count` are not read; D-D: per-series local 30-day window ending yesterday
  - ADR-0003: one Worker serves everything; every `/api/*` route is bearer-gated (`app.use("/api/*", requireToken)`)
- Applicable anti-patterns:
  - Hand-duplicated entity types (the adherence wire type is declared once in `src/shared/api.ts` and mapped in `src/worker/dto.ts`)
  - Weakening tests to force green
  - Glossary synonym drift (Recurrence Series, occurrence, missed)
  - Portuguese in artifacts (this phase adds no visible copy; identifiers and docs stay English)
  - Editing accepted ADRs
- Applicable architectural rules:
  - The endpoint is a Hono route behind the bearer gate; types flow schema -> `src/worker/dto.ts` -> `src/shared/api.ts`
  - `src/shared/` stays DOM-free, clock-free and dependency-free: `today` is an argument, the clock is read only in the Worker
  - `src/shared/recurrence.ts` must stay unchanged (unit 17's reuse condition)
  - No new table or migration; the export completeness guard is untouched
  - Injectable `now`, as `sweepMissedOccurrences(db, now)` already does in `src/worker/cron.ts`
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/adherence-mirror.prd.md` — Implementation Phases row 2: "Adherence endpoint" — Goal: The record reaches the wire, computed per series in its own time zone, without changing a row. — Success signal: AC-11..AC-14 green, and the full existing suite green without weakening.

## Summary

This phase adds the read-only `GET /api/series/adherence` endpoint. It loads every task-kind Recurrence Series and every closed occurrence row (`done` or `missed`) in two selects, groups the rows in memory, computes each series' local `today` from an injectable `now` with the existing `todayIn`, and calls phase 1's pure `computeSeriesAdherence` and `rankAdherence`. The wire type is declared once in `src/shared/api.ts`, mapped in `src/worker/dto.ts`, and consumed through a one-liner client function in `src/app/api.ts`. The new route is registered before `seriesRoutes.get("/:id")` so `"adherence"` is never read as an id.

## User Story

As the owner, I want my recurring commitments' real record (counts, streak, recent misses, and the "what I keep not doing" ranking) available from the API, so that the screen in phase 3 can show it without ever computing a number the database does not back.

## Problem Statement

Since unit 10 every occurrence of a recurring Task the owner does not do becomes a permanent `missed` row, but each is shown alone. Nothing adds them up per Recurrence Series, so the honest mirror that ADR-0006 names exists in the database and not on the screen. Phase 1 pinned the computation as a pure function; this phase narrows the problem to getting that computation onto the wire, per series in its own time zone, without changing a row.

## Solution Statement

One new read endpoint plus its wire type, DTO mapper and client function. The route handler delegates to an exported `loadSeriesAdherence(db, now)` so the clock is an argument (mirroring `sweepMissedOccurrences(db, now)`), which makes the per-series time-zone behavior testable with an injected `now`. The handler itself calls `new Date()` once. Nothing is written: no `insert`, `update` or `delete` appears in the new code.

## Metadata

| Field | Value |
|-------|-------|
| Type | feature |
| Complexity | LOW-MEDIUM |
| Systems Affected | `src/worker/routes/series.ts`, `src/worker/dto.ts`, `src/shared/api.ts`, `src/app/api.ts` |
| Dependencies | Phase 1 `src/shared/adherence.ts` (complete, in the worktree); `todayIn` in `src/shared/dates.ts` |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/adherence-mirror.prd.md` Implementation Phases row 2; Phase Details "Phase 2: Adherence endpoint"; AC-11..AC-14 |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/adherence-mirror.prd.md` | 121-133, 227-245 | AC-11..AC-14 and the Architecture Notes (rows as truth, per-series `today`, route order, query cost) |
| P0 | `src/worker/routes/series.ts` | 241-262 | Where `GET /` and `GET /:id` live; the new route goes between them |
| P0 | `src/shared/adherence.ts` | 11-98 | The pure API this phase composes: `AdherenceRow`, `SeriesAdherence`, `computeSeriesAdherence`, `rankAdherence` |
| P0 | `src/worker/dto.ts` | 113-122 | `toSeriesDto` composes an existing mapper instead of re-declaring fields |
| P0 | `src/worker/cron.ts` | 112-125 | The injectable-`now` + per-series `todayIn(now, series.timezone)` shape to mirror |
| P1 | `src/shared/api.ts` | 88-122 | `RecurrenceSeriesDto`: where the wire type sits and its status/title field types |
| P1 | `src/app/api.ts` | 216-220 | The `getSeries` one-liner over `request<T>()` the client function copies |
| P1 | `src/worker/index.ts` | 22-30 | Proof the bearer gate is `app.use("/api/*", requireToken)`, so the 401 needs no route code |
| P1 | `test/series.test.ts` | 35-95 | The route-test harness (`exports.default.fetch`, `auth()`, drain-barrier `beforeEach`) the test pair will reuse |

## Patterns to Mirror

# SOURCE: src/worker/routes/series.ts:241-262
```ts
/** List every series with its current open occurrence id (AC-16). */
seriesRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(recurrenceSeries);
  ...
  return c.json({ series });
});

/** Read one series with its current open occurrence id, or 404 (AC-16). */
seriesRoutes.get("/:id", async (c) => {
  const db = createDb(c.env);
  ...
});
```
Task 3 copies this route shape and registers `/adherence` between `GET /` and `GET /:id`.

# SOURCE: src/worker/cron.ts:112-125
```ts
export async function sweepMissedOccurrences(db: Db, now: Date): Promise<void> {
  ...
  const sweepOne = async (series: RecurrenceSeries, openTask: Task | null) => {
    try {
      const plan = planMissedSweep({
        ...
        today: todayIn(now, series.timezone),
      });
```
Task 3 copies the "`now` is an argument, `today` is `todayIn(now, series.timezone)` per series" shape in `loadSeriesAdherence(db, now)`.

# SOURCE: src/worker/dto.ts:113-122
```ts
export function toSeriesDto(row: RecurrenceSeries, openOccurrenceId: string | null): SeriesDto {
  return { ...toRecurrenceSeriesDto(row), openOccurrenceId };
}
```
Task 2 copies this "compose, never re-declare, field by field" mapper style for `toSeriesAdherenceDto`.

# SOURCE: src/app/api.ts:216-220
```ts
/** Reads one series, so an occurrence's sheet can show and edit its rule (D11 amended 2026-09-29). */
export async function getSeries(id: string): Promise<SeriesDto> {
  const body = await request<{ series: SeriesDto }>(`/api/series/${id}`);
  return body.series;
}
```
Task 4 copies this one-liner client wrapper.

# SOURCE: src/shared/api.ts:88-122
```ts
export interface RecurrenceSeriesDto {
  id: string;
  ...
  status: "active" | "ended";
  title: string | null;
  ...
}
```
Task 1 copies this declare-once, doc-commented interface style next to the series types.

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/api.ts` | UPDATE | Declare the adherence wire type once (`SeriesAdherenceDto`, `AdherenceResponse`) |
| `src/worker/dto.ts` | UPDATE | The single mapping point: `toSeriesAdherenceDto` |
| `src/worker/routes/series.ts` | UPDATE | `loadSeriesAdherence(db, now)` and `GET /adherence` registered before `/:id` |
| `src/app/api.ts` | UPDATE | `fetchAdherence()` client function for phase 3 |

## NOT Building (Scope Limits)

- Any screen, route (`AppRoute`), settings entry or *Hoje* line: phase 3 (AC-15..AC-20).
- Any notification about misses: unit 12.
- Percentages, charts, longest streak, shields: the PRD's What We're NOT Building.
- A migration, a new index, or a new table: read-only over existing columns; `test/export-completeness.test.ts` is untouched.
- Any change to `src/shared/recurrence.ts` or to `src/shared/adherence.ts`: both stay as they are.
- Reading `done_count`/`missed_count`: rows are the source of truth (PRD D-A).
- Any write to `recurrence_series` or `tasks` (AC-14).

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/api.ts

- **ACTION**: Declare the adherence wire type once, next to the series types: `SeriesAdherenceDto` with `seriesId: string`, `title: string`, `status: "active" | "ended"`, `done: number`, `closed: number`, `currentStreak: number`, `recentMisses: string[]` (local `YYYY-MM-DD` days, newest first), and `AdherenceResponse` with `series: SeriesAdherenceDto[]` and `ranking: string[]` (series ids in the PRD AC-9 order). Delivers AC-A1.
- **MIRROR**: `src/shared/api.ts:88-122` (declare-once, doc-commented interface style).
- **VALIDATE**: `npx tsc -b`

### Task 2: UPDATE src/worker/dto.ts

- **ACTION**: Add `toSeriesAdherenceDto(row: RecurrenceSeries, adherence: SeriesAdherence): SeriesAdherenceDto`, written field by field (`seriesId` from `row.id`, `title` from `row.title ?? ""`, `status` from `row.status`, and `done`, `closed`, `currentStreak`, `recentMisses` from `adherence`). Import `SeriesAdherence` as a type from `../shared/adherence`. Delivers AC-A1.
- **MIRROR**: `src/worker/dto.ts:113-122` (single mapping point, explicit fields).
- **VALIDATE**: `npx tsc -b`

### Task 3: UPDATE src/worker/routes/series.ts

- **ACTION**: Add an exported `loadSeriesAdherence(db, now: Date): Promise<AdherenceResponse>` that runs one select over `recurrence_series` (kind `task`) and one over `tasks` where `series_id` is not null and `status` is in (`done`, `missed`), groups the closed rows by `seriesId` in memory (skipping any row whose `occurrenceDate` is null), computes `todayIn(now, row.timezone)` per series, calls `computeSeriesAdherence`, maps with `toSeriesAdherenceDto`, and builds `ranking` with `rankAdherence` over `{ seriesId, title, recentMisses }`. It must contain no `insert`, `update` or `delete` (AC-A4). Then register `seriesRoutes.get("/adherence", ...)` calling `loadSeriesAdherence(createDb(c.env), new Date())` and returning `c.json(result)`, placed BEFORE `seriesRoutes.get("/:id", ...)` (AC-A3). The bearer gate already covers the path through `app.use("/api/*", requireToken)`, so no auth code is added (AC-A1). Per-series `today` delivers AC-A2. Do not touch `src/shared/recurrence.ts`.
- **MIRROR**: `src/worker/routes/series.ts:241-262` (route shape and placement) and `src/worker/cron.ts:112-125` (`now` as an argument, `todayIn(now, series.timezone)`).
- **VALIDATE**: `npx tsc -b && node -e "const s=require('fs').readFileSync('src/worker/routes/series.ts','utf8');const a=s.indexOf('seriesRoutes.get(\"/adherence\"');const b=s.indexOf('seriesRoutes.get(\"/:id\"');if(a<0||b<0||a>b){console.error('FAIL: /adherence missing or registered after /:id');process.exit(1)}"`

### Task 4: UPDATE src/app/api.ts

- **ACTION**: Add `fetchAdherence(): Promise<AdherenceResponse>`, a one-liner over `request<AdherenceResponse>("/api/series/adherence")`, importing `AdherenceResponse` as a type from `../shared/api`. No local types, no error re-mapping. Infrastructure for phase 3; it delivers no criterion on its own, and AC-A1 reaches the screen through it.
- **MIRROR**: `src/app/api.ts:216-220` (one-liner wrapper over `request<T>()`).
- **VALIDATE**: `npx tsc -b`

## Validation Commands

### Level 1 STATIC_ANALYSIS

```
set -euo pipefail
npm run check
```

### Level 2 CONTENT_INVARIANTS

```
set -euo pipefail
grep -q "export interface SeriesAdherenceDto" src/shared/api.ts
grep -q "export interface AdherenceResponse" src/shared/api.ts
grep -q "export function toSeriesAdherenceDto" src/worker/dto.ts
grep -q "export async function loadSeriesAdherence" src/worker/routes/series.ts
grep -q "export async function fetchAdherence" src/app/api.ts
node -e "const s=require('fs').readFileSync('src/worker/routes/series.ts','utf8');const a=s.indexOf('seriesRoutes.get(\"/adherence\"');const b=s.indexOf('seriesRoutes.get(\"/:id\"');if(a<0||b<0||a>b){console.error('FAIL: route order');process.exit(1)}"
git diff --quiet HEAD -- src/shared/recurrence.ts src/shared/adherence.ts
```

### Level 3 INTEGRATION

```
set -euo pipefail
npm test
```

## Acceptance Criteria

R8b (PRD AC-N token check) is satisfied below: every item carries its PRD token.

- **AC-A1 (PRD AC-11):** Given no bearer token, `GET /api/series/adherence` answers 401. Given the token and two series with rows, it answers 200 with one entry per series carrying `seriesId`, `title`, `status`, `done`, `closed`, `currentStreak`, `recentMisses`, plus a `ranking` array of `seriesId`s in the AC-9 order; the wire type is declared once in `src/shared/api.ts` and mapped in `src/worker/dto.ts`.
- **AC-A2 (PRD AC-12):** Given `now = 2026-10-31T01:30Z`, a series in `America/Sao_Paulo` (local `2026-10-30`) and one in `UTC` (local `2026-10-31`), each with a `missed` row on `2026-09-30`, the miss is inside the Sao Paulo series' window and outside the UTC series' window; `now` is injectable through `loadSeriesAdherence(db, now)`.
- **AC-A3 (PRD AC-13):** A request to `GET /api/series/adherence` is answered by the adherence handler, never by `GET /api/series/:id` as an id lookup for `"adherence"`.
- **AC-A4 (PRD AC-14):** Any call to the endpoint leaves `recurrence_series` and `tasks` unchanged (counts and `updated_at` before and after are identical).
- **AC-A5 (PRD AC-11):** The full existing suite stays green without any test being weakened, and `src/shared/recurrence.ts` and `src/shared/adherence.ts` are unchanged (phase success signal).

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Off-by-one at the window edge or the local-day boundary | M | M | Window logic stays in phase 1's pure function; this phase only supplies `todayIn(now, series.timezone)`, and AC-A2 pins the zone split with an injected `now` |
| `GET /:id` registered first shadows `/adherence` | L | H | Task 3's VALIDATE and Level 2 fail when `/adherence` is missing or after `/:id`; AC-A3 pins it behaviorally |
| `recurrence_series.title` is nullable but ranking needs a string | L | L | `toSeriesAdherenceDto` maps `null` to `""`, so the ranking tie-break stays total; phase 3 decides how an empty title is shown |
| No clock-injection seam exists in routes (research-codebase: routes call `new Date()` inline; Cloudflare's known-issues page says fake timers do not reach storage simulators) | M | M | `loadSeriesAdherence(db, now)` takes the clock as a parameter, so the time-zone test passes `now` as data instead of relying on `vi.setSystemTime` or process TZ |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework. Level 3 runs the whole suite (`npm test`) as the regression gate that the approved test pair's suite stays green.
- The code lives in the git worktree `.worktrees/adherence-mirror` (branch `feature/adherence-mirror`); every path above is relative to that worktree root. Phase 1's `src/shared/adherence.ts` exists only there, uncommitted.
- Injectable clock: HTTP-level tests exercise 401, shape, route order and read-only behavior; the time-zone split (AC-A2) is exercised through `loadSeriesAdherence(db, now)` with a fixed `now`, the same way `sweepMissedOccurrences(db, now)` is tested.
- Response shape decision: `GET /api/series/adherence` answers `{ series: SeriesAdherenceDto[], ranking: string[] }`.
- UI/UX review checklist: not applicable to this phase (no change under `src/app/` beyond a non-visual client function); it gates phase 3.

*Generated: 2026-10-04*
*Approved: 2026-10-04*
*Implemented: 2026-10-04*
*Status: IMPLEMENTED*
