# Feature: The sweep in the cron (Phase 2 of missed-sweep)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test and implement stages consume); cross-cutting — adds a system writer to the cron that closes the owner's Task rows, and moves unit 9's successor-spawning path out of an HTTP route into a module the cron shares; domain rules for tasks, reminders and recurrence
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording — an occurrence superseded without completion becomes `missed` (terminal, system-written); every skipped cycle leaves a permanent `missed` row; the daily cron gains an idempotent sweep repairing any active series lacking an open occurrence
  - [2026-09-10] The due-Reminder sweep claims before it sends, and skips a Reminder whose Task is `done` or `missed` — the missed sweep must run BEFORE it so a just-missed occurrence's Reminder is never dispatched
  - [2026-09-10] A relative Task Reminder resolves against end-of-day local via `offsetToInstant`
  - recurring-tasks PRD D6 (a `count` end condition counts done + missed), D2 (a successor is built from the series template), D3 (deleting the open occurrence skips the cycle, counted as neither)
  - missed-sweep PRD D-A (miss when the series' local `today` reaches the next date), D-B (one missed row per whole cycle, 366 per run, a still-past successor gets NO Reminders), D-C, D-D, D-E (detached occurrences are missed like any other), D-F (repair starts fresh)
  - ADR-0008 / [2026-08-04] Test-first methodology — the `scheduled()` jobs are in TDD scope
  - ADR-0009 visible copy pt-BR; everything else English (this phase has no visible copy)
- Applicable anti-patterns:
  - Hand-duplicated entity types (the worker module derives from `src/worker/db/schema.ts`; the wire contract is untouched)
  - Glossary synonym drift ("missed", "occurrence", "Recurrence Series" — never "skipped", "failed", "habit")
  - Weakening tests to force green (existing suites change only as recorded lifecycle updates, by the test pair)
  - Portuguese in artifacts
  - Editing accepted ADRs (ADR-0006 is applied, not amended)
  - Mirroring Tasks, Reminders or Life Areas to Google (not approached)
  - Writing pipeline artifacts under `.claude/`
- Applicable architectural rules:
  - One Worker serves everything — the sweep runs inside the existing `scheduled()` / `runCronHeartbeat`, which writes `cron_runs` from a `finally` block
  - `src/shared` stays DOM-free, clock-free and dependency-free; `src/shared/recurrence.ts` and `src/shared/missed-sweep.ts` (phase 1) are consumed, never edited
  - Domain enums enforced twice (the `missed` status already is); invariants that protect the owner's data are unique indexes (`tasks_series_single_open_unq`, `tasks_series_occurrence_unq`), not conventions
  - No migration, no schema change; no UI in this phase
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/missed-sweep.prd.md` — Implementation Phases row 2: "The sweep in the cron" — Goal: The cron writes the plan safely, repeatably and without racing the owner. — Success signal: AC-10..AC-18 green, and the full existing suite green without weakening.

## Summary

Phase 2 makes the cron write what phase 1's pure `planMissedSweep` decides. Unit 9's successor builder (`buildSuccessorStatements`) and the series-row-to-rule mapper (`buildRecurrenceRule`) move out of `src/worker/routes/tasks.ts` into a new shared worker module, `src/worker/successor.ts`, which the Task routes and the cron both import; the module also gains a builder for an extra `missed` occurrence row, an `armReminders` option on the successor builder, and a non-HTTP unique-conflict predicate. `runScheduledJob` gains an injectable `now` and, before the due-Reminder sweep, runs a missed sweep: for every open series occurrence it computes the series' local day with `todayIn(now, series.timezone)`, asks `planMissedSweep`, and writes the plan in one `db.batch` per series (close the open row as `missed` first, then the catch-up `missed` rows, then the successor with its Reminders, then the guarded counter/status update). A second pass repairs every active series with no open occurrence. A unique-index conflict on one series is swallowed ("another writer got there first") and never blocks the next series. No migration, no schema change, no UI.

## User Story

As the owner, I want the cron to record a missed occurrence on its own and open the next cycle with its Reminders armed, so that a series I did not do today is honestly marked and still alive tomorrow without me opening the app.

## Problem Statement

When the owner does not do an occurrence of a recurring Task, nothing happens: the occurrence stays open and overdue forever, the series stops advancing — no next occurrence is ever materialized — and no record says that cycle failed. Narrowed to Phase 2: phase 1 decides what should happen, but nothing in the cron reads series rows, applies that decision or writes it, and the successor-spawning path is private to the Task routes and returns an HTTP `Response` on conflict, so the cron cannot reuse it as it stands.

## Solution Statement

Move the successor-building code to a shared worker module (behaviour-preserving for the routes), then add the sweep to `src/worker/cron.ts`. Decision stays in `planMissedSweep`; writing stays thin: one `db.batch` per series, ordered so the open row is closed before the successor is inserted (`tasks_series_single_open_unq` is checked immediately), guarded so a race with a manual completion or an overlapping cron run writes nothing, and wrapped per series so a unique-index conflict skips that series only. `now` becomes an injectable parameter of `runScheduledJob` and drives the missed sweep only; the Reminder sweep keeps its own clock read (see Notes — AC-10 cannot hold otherwise).

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY (system writer in the cron) + behaviour-preserving REFACTOR (successor builder extraction) |
| Complexity | MEDIUM |
| Systems Affected | `src/worker/cron.ts`, `src/worker/routes/tasks.ts`, new `src/worker/successor.ts`; reads `src/shared/missed-sweep.ts` (phase 1), `src/shared/recurrence.ts`, `src/shared/dates.ts` |
| Dependencies | none new; phase 1 (`planMissedSweep`, `MissedSweepInput`, `MissedSweepPlan`) — implemented in the worktree `.worktrees/missed-sweep`, not yet on `main` |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/missed-sweep.prd.md` Implementation Phases row 2; AC-10..AC-18 |
| phase_type | feature |

## Mandatory Reading

All paths are relative to the repository root and resolve identically in the worktree `.worktrees/missed-sweep`, where this phase is implemented and phase 1's code lives.

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/missed-sweep.prd.md` | 128-157, 233-268, 307-319 | Phase 2 acceptance criteria AC-10..AC-18, the Architecture Notes and Decisions Log D-A..D-F the writer implements |
| P0 | `src/shared/missed-sweep.ts` | 11-97 | Phase 1's `MissedSweepInput` / `MissedSweepPlan` / `planMissedSweep` — the exact contract the cron feeds and applies (worktree only; do not edit) |
| P0 | `src/worker/routes/tasks.ts` | 31-106, 394-429, 452-505 | `buildRecurrenceRule`, `buildSuccessorStatements` (to move), `batchOrRace`'s unique-conflict check, and the complete route's close-then-spawn batch ordering the sweep reuses |
| P0 | `src/worker/cron.ts` | 27-126 | `runScheduledJob` (the due-Reminder sweep the missed sweep must precede) and `runCronHeartbeat` (the `finally`-block `cron_runs` record) |
| P0 | `src/worker/db/schema.ts` | 55-141, 151-228 | Series and Task columns, CHECKs and the two partial unique indexes the write relies on |
| P1 | `src/shared/dates.ts` | 30-37, 108-139 | `todayIn` (the series' local day) and `offsetToInstant` (the Reminder instant AC-10 asserts) |
| P1 | `src/shared/recurrence.ts` | 281-312 | `occurrenceReminderInstants` consumer context and `nextOccurrence`; this file must not change |
| P1 | `test/cron-sweep.test.ts` | 29-128 | The seeding, `vi.stubGlobal("fetch")` and `resetTaskTables` idioms every cron suite uses (read-only for the Implementer) |
| P1 | `test/isolation.ts` | 147-152 | `resetTaskTables()` wipes `tasks` and `recurrence_series` only — suites must also clear `reminders` and `cron_runs` themselves |
| P2 | `docs/context/testing.md` | 51-98 | The worker test project, isolation rules and the mandatory `npm run check` |

## Patterns to Mirror

Every snippet was read directly from the cited lines of the worktree (`.worktrees/missed-sweep`, identical to `main` for these files). The dispatch of `research-*` subagents was replaced by direct reads of the PRD's Technical Context sources, so every `file:line` below was verified against the file, not recalled.

```ts
// SOURCE: src/worker/routes/tasks.ts:38-51
function buildRecurrenceRule(series: RecurrenceSeries): RecurrenceRule {
  return {
    freq: series.freq,
    interval: series.interval,
    byWeekday: series.byWeekday === null ? null : (JSON.parse(series.byWeekday) as number[]),
    byMonthday: series.byMonthday,
    dtstart: series.dtstart,
    timezone: series.timezone,
    anchorMode: series.anchorMode,
    endKind: series.endKind,
    untilDate: series.untilDate,
    maxCount: series.maxCount,
  };
}
```
Copied by: Task 1 (moved verbatim into `src/worker/successor.ts` and exported) and Task 3 (the cron builds the rule from each series row with it).

```ts
// SOURCE: src/worker/routes/tasks.ts:63-106
async function buildSuccessorStatements(
  db: ReturnType<typeof createDb>,
  series: RecurrenceSeries,
  occurrenceDate: string,
): Promise<{ successorId: string; statements: unknown[] }> {
  const reminderOffsets =
    series.reminderOffsets === null ? [] : (JSON.parse(series.reminderOffsets) as number[]);
  const reminderInstants = occurrenceReminderInstants(
    occurrenceDate,
    reminderOffsets,
    series.timezone,
  );

  const successorId = crypto.randomUUID();

  return {
    successorId,
    statements: [
      db
        .insert(tasks)
        .values({
          id: successorId,
          // Non-null: recurrence_series_template_chk guarantees title is set for kind='task'.
          title: series.title!,
          description: series.description,
          deadline: series.dateMode === "deadline" ? occurrenceDate : null,
          scheduledDate: series.dateMode === "scheduled" ? occurrenceDate : null,
          priority: series.priority,
          lifeAreaId: series.lifeAreaId,
          seriesId: series.id,
          occurrenceDate,
        })
        .returning(),
      ...reminderInstants.map((instant, index) =>
        db.insert(reminders).values({
          id: crypto.randomUUID(),
          taskId: successorId,
          fireAt: new Date(instant * 1000),
          originOffsetMinutes: reminderOffsets[index] ?? null,
        }),
      ),
    ],
  };
}
```
Copied by: Task 1 (moved into `successor.ts`; the only change is an optional fourth parameter `{ armReminders }` defaulting to `true`, so both route call sites stay byte-identical in behaviour) and Task 3 (the cron passes the plan's `armReminders`). The extra-`missed`-row builder added in Task 1 copies the same `.values({...})` template mapping with `status: "missed"`.

```ts
// SOURCE: src/worker/routes/tasks.ts:481-497
  const statements: unknown[] = [
    db
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
      .returning(),
    db.update(recurrenceSeries).set(seriesUpdate).where(eq(recurrenceSeries.id, series.id)),
  ];
  let successorId: string | undefined;
  if (next !== null) {
    const successor = await buildSuccessorStatements(db, series, next);
    successorId = successor.successorId;
    statements.push(...successor.statements);
  }

  const outcome = await batchOrRace(db, statements);
```
Copied by: Task 3 (the sweep's batch has the same order — close the open row FIRST, because `tasks_series_single_open_unq` is checked immediately and the successor insert would otherwise collide with it).

```ts
// SOURCE: src/worker/routes/tasks.ts:406-429
async function batchOrRace<T extends unknown[]>(
  db: ReturnType<typeof createDb>,
  statements: T,
): Promise<{ ok: true; results: unknown[] } | { ok: false; response: Response }> {
  try {
    // The batch is built dynamically (a variable number of successor
    // statements), so it cannot be typed as the literal tuple `db.batch`'s
    // signature demands; the runtime shape is exactly what `series.ts` and
    // `oauth-callback.ts` already pass it. See plan `## Notes`.
    const results = (await db.batch(statements as never)) as unknown[];
    return { ok: true, results };
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return {
        ok: false,
        response: Response.json(
          { error: "A próxima ocorrência já foi criada por outra requisição" },
          { status: 409 },
        ),
      };
    }
    throw error;
  }
}
```
Copied by: Task 1 (the message check becomes the exported `isUniqueConflict(error)` predicate, and `batchOrRace` calls it — same condition, same behaviour) and Task 3 (the cron maps a `true` result to "skip this series"; every other error is kept and rethrown after the loop, never swallowed).

```ts
// SOURCE: src/worker/cron.ts:27-35
export async function runScheduledJob(env: Env): Promise<void> {
  const db = createDb(env);
  const now = new Date();

  const dueReminders = await db
    .select()
    .from(reminders)
    .where(and(isNull(reminders.sentAt), lte(reminders.fireAt, now)));
```
Copied by: Task 3 (the signature gains `now: Date = new Date()` driving the missed sweep; the Reminder sweep keeps this exact clock read, placed AFTER the missed sweep).

```ts
// SOURCE: src/shared/missed-sweep.ts:29-36
export interface MissedSweepPlan {
  closeOpenAsMissed: boolean;
  extraMissedDates: string[];
  successor: { date: string; armReminders: boolean } | null;
  endSeries: boolean;
  /** The open occurrence's miss (when closed) plus `extraMissedDates.length`. */
  missedCountDelta: number;
}
```
Copied by: Task 3 (the writer maps each field to one statement group; it never re-derives a date or a count).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/worker/successor.ts` | CREATE | The shared worker module the PRD calls for: `buildRecurrenceRule`, `buildSuccessorStatements` (moved), `buildMissedOccurrenceStatement` (new) and `isUniqueConflict` (extracted) |
| `src/worker/routes/tasks.ts` | UPDATE | Delete the two private helpers and the inline conflict check; import them from `../successor` — behaviour-preserving |
| `src/worker/cron.ts` | UPDATE | Injectable `now`; `sweepMissedOccurrences` + `writeMissedSweepPlan`; the sweep runs before the due-Reminder sweep |

No test file appears here on purpose: this phase's test files are created and maintained by the `test-writer` / `test-reviewer` pair (see `## Notes`).

## NOT Building (Scope Limits)

- **The pure decision** — `src/shared/missed-sweep.ts` is phase 1's, complete and consumed as-is. Any change to `planMissedSweep` semantics is out of scope (the two phase-1 advisories are recorded under Risks, not acted on).
- **Any change to `src/shared/recurrence.ts`** — unit 17's reuse condition.
- **A migration or schema change** — `missed_count`, the `missed` status and both partial unique indexes are already applied; `git status` must show nothing under `migrations/` and no diff of `src/worker/db/schema.ts`.
- **The screen** — `groupTasks`, *Concluídas* / *Não concluídas*, the UI/UX checklist and the device proof are phase 3.
- **Notifying the owner of a miss** (unit 12), adherence statistics (unit 11), undoing a miss, a day-boundary miss, collapsing a long absence into one miss, backfilling a system-broken period (D-F).
- **Deadline-recomputation or any change to the Reminder sweep's behaviour** — the sweep's body is untouched; only its position after the missed sweep matters.
- **New dependencies, new routes, new tables, a log/telemetry layer** — failures surface through the existing `cron_runs` row.

## Step-by-Step Tasks

### Task 1: CREATE src/worker/successor.ts

**ACTION**: Create `src/worker/successor.ts` exporting four things. (1) `buildRecurrenceRule(series: RecurrenceSeries): RecurrenceRule` — moved verbatim from `src/worker/routes/tasks.ts:38-51`. (2) `buildSuccessorStatements(db, series, occurrenceDate, options?: { armReminders?: boolean })` — moved from `tasks.ts:63-106`; the one change is that when `options.armReminders === false` the returned `statements` contain only the Task insert and no Reminder inserts (default `true` keeps both existing route call sites identical). (3) `buildMissedOccurrenceStatement(db, series, occurrenceDate): ReturnType<…insert…>` — a Task insert for one catch-up occurrence with `status: "missed"`, `completedAt` left null (the `tasks_completed_at_chk` requires null for a non-`done` row), `detached: false`, the template's `title`, `description`, `priority`, `lifeAreaId`, the date placed in `deadline` or `scheduledDate` per `series.dateMode`, `seriesId: series.id`, `occurrenceDate`, and NO Reminder statements (AC-10: "no Reminders"). (4) `isUniqueConflict(error: unknown): boolean` — `error instanceof Error && error.message.includes("UNIQUE constraint failed")`, the exact condition `batchOrRace` uses today (`tasks.ts:418`). Move the needed imports (`occurrenceReminderInstants`, `RecurrenceRule`, the schema tables and types) with the code; keep the file free of `src/app` imports. Do not edit `src/shared/*`.

**MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:38-51` (rule mapper), `# SOURCE: src/worker/routes/tasks.ts:63-106` (successor builder and the `.values({...})` template mapping), `# SOURCE: src/worker/routes/tasks.ts:406-429` (the conflict condition).

**AC**: Delivers the shared seam for AC-A1, AC-A7, AC-A8 and AC-A10 (no behaviour of its own until Tasks 2-3 wire it).

**VALIDATE**: `npx tsc -b && node -e "const s=require('node:fs').readFileSync('src/worker/successor.ts','utf8'); for (const n of ['buildRecurrenceRule','buildSuccessorStatements','buildMissedOccurrenceStatement','isUniqueConflict']) { if (!new RegExp('export (async )?function '+n+'\\\\b').test(s)) { console.error('missing export: '+n); process.exit(1); } }"`

### Task 2: UPDATE src/worker/routes/tasks.ts

**ACTION**: Remove the local `buildRecurrenceRule` (`:31-51`) and `buildSuccessorStatements` (`:53-106`) and import them, plus `isUniqueConflict`, from `"../successor"`. Change `batchOrRace`'s catch condition to `isUniqueConflict(error)`; its 409 body and its re-throw of any other error stay byte-identical. Drop imports that become unused (`occurrenceReminderInstants`, possibly `RecurrenceRule`) so ESLint stays clean; keep `nextOccurrence` and `todayIn`, still used by the complete and delete routes. Touch nothing else: no route, status code or message changes.

**MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:481-497` (the complete route's call shape to `buildSuccessorStatements` must still compile unchanged) and `# SOURCE: src/worker/routes/tasks.ts:406-429`.

**AC**: Delivers AC-A10 (the existing Task/series suites stay green without edits — the extraction changes no route behaviour).

**VALIDATE**: `set -euo pipefail; npx tsc -b; npx vitest run --project worker test/tasks.test.ts test/series.test.ts test/task-edit.test.ts test/task-update.test.ts; if grep -nE "^(async )?function (buildSuccessorStatements|buildRecurrenceRule)" src/worker/routes/tasks.ts; then echo "FAIL: helper still defined in the route file"; exit 1; else echo "PASS: helpers live only in src/worker/successor.ts"; fi`

### Task 3: UPDATE src/worker/cron.ts

**ACTION**: Make four changes, importing `buildRecurrenceRule`, `buildSuccessorStatements`, `buildMissedOccurrenceStatement` and `isUniqueConflict` from `"./successor"` and `planMissedSweep` from `"../shared/missed-sweep"`. (a) Change the signature to `runScheduledJob(env: Env, now: Date = new Date())`; `runCronHeartbeat` keeps calling `cronModule.runScheduledJob(env)` unchanged (so the existing spy-based heartbeat tests still observe the override). `now` drives ONLY the missed sweep; the due-Reminder sweep keeps its own `const reminderNow = new Date()` read, taken AFTER the missed sweep, because with one shared pinned clock the successor Reminder AC-10 expects to remain unsent (`offsetToInstant("2026-10-04", 1440)` = 23:59 local on 10-03) would already be due and be claimed by the very run under test. (b) Add exported `sweepMissedOccurrences(db, now)`: select every open series occurrence joined to its series — `tasks` inner-joined to `recurrenceSeries` on `tasks.seriesId`, where `tasks.status = 'open'` and `recurrenceSeries.kind = 'task'`, ordered by `tasks.occurrenceDate, tasks.id` (an ended series with an open occurrence is included — AC-16/D-D) — then select every repair candidate: `recurrenceSeries` where `kind = 'task'`, `status = 'active'` and `NOT EXISTS (select 1 from tasks where tasks.series_id = recurrence_series.id and tasks.status = 'open')`. For each series compute `today = todayIn(now, series.timezone)` (never UTC — AC-15) and call `planMissedSweep({ rule: buildRecurrenceRule(series), status: series.status, doneCount: series.doneCount, missedCount: series.missedCount, openOccurrenceDate: task.occurrenceDate, lastClosedOccurrenceDate: null, today })`. Pass `lastClosedOccurrenceDate: null` and do not query it: phase 1's `planMissedSweep` never reads that field (the repair derives its date from `today` only) and this plan deliberately does not change the phase-1 contract. Skip a series whose plan changes nothing (`closeOpenAsMissed` false, `successor` null, `endSeries` false) — this is what makes a second run write nothing (AC-11). (c) Add exported `writeMissedSweepPlan(db, series, openTask | null, plan)` that builds ONE `db.batch` in this order: 1. when `plan.closeOpenAsMissed`: `update tasks set status = 'missed' where id = <open id> and status = 'open'` (the open row closes first; the title and `detached` flag are untouched, so a detached occurrence keeps its edited title — AC-16); 2. one `buildMissedOccurrenceStatement` per date in `plan.extraMissedDates`; 3. when `plan.successor` is non-null: `buildSuccessorStatements(db, series, successor.date, { armReminders: successor.armReminders })` (a successor still dated before today is written WITHOUT Reminders — AC-4/D-B); 4. when the plan changes the series (`missedCountDelta > 0` or `endSeries`): `update recurrence_series set missedCount = series.missedCount + plan.missedCountDelta` (plus `status = 'ended'` when `plan.endSeries`) with a GUARD in its `where`: `id = series.id and done_count = <snapshot> and missed_count = <snapshot> and exists (select 1 from tasks where id = <open id> and status = 'missed')`, so a race with `POST /api/tasks/:id/complete`, an overlapping cron run or the owner's skip-delete matches no row and the counters never move twice (AC-12). For the repair path (`openTask` null) the series update, when `plan.endSeries`, is guarded by `status = 'active' and not exists (an open row for the series)`; a plan with a successor needs no guard — `tasks_series_single_open_unq` rejects a second open row. Run the batch through the same `db.batch(statements as never)` call shape `batchOrRace` uses; map `isUniqueConflict(error)` to "another writer got there first" (return without throwing), and rethrow every other error unchanged. (d) Inside `sweepMissedOccurrences`, wrap each series' plan-and-write in its own try/catch: a unique conflict continues to the next series (AC-13); any other error is remembered, the loop continues, and after the last series the sweep throws one `Error` naming the first failing series id and message. In `runScheduledJob`, call the sweep FIRST, catching its throw into a local; run the due-Reminder sweep unchanged; then rethrow the remembered sweep error so `runCronHeartbeat` records `outcome: "failure"` with its message while the Reminders still went out. A conflict-only run therefore records `success` (AC-12). One-off Tasks (`series_id` null) are never selected (AC-18).

**MIRROR**: `# SOURCE: src/worker/cron.ts:27-35` (the signature and clock being changed), `# SOURCE: src/worker/routes/tasks.ts:481-497` (close-first batch order and the `db.batch(statements as never)` idiom), `# SOURCE: src/worker/routes/tasks.ts:406-429` (conflict mapping), `# SOURCE: src/shared/missed-sweep.ts:29-36` (the plan fields the writer applies).

**AC**: Delivers AC-A1 through AC-A9.

**VALIDATE**: `set -euo pipefail; npx tsc -b; npx vitest run --project worker test/cron-sweep.test.ts test/cron-heartbeat.test.ts test/cron-freshness.test.ts test/cron-reminder-route.test.ts test/missed-sweep; node -e "const s=require('node:fs').readFileSync('src/worker/cron.ts','utf8'); const body=s.slice(s.indexOf('export async function runScheduledJob')); const a=body.indexOf('sweepMissedOccurrences('); const b=body.indexOf('.from(reminders)'); if (a<0||b<0||a>b) { console.error('FAIL: the missed sweep must be called before the due-Reminder select inside runScheduledJob'); process.exit(1); } console.log('PASS: missed sweep precedes the Reminder sweep');"`

### Task 4: VERIFY the whole suite and the phase invariants

**ACTION**: Infrastructure/verification task — it edits no file and delivers AC-A10 plus the PRD's "`recurrence.ts` unchanged / no migration" invariants. Run the full gates and the invariant checks below. Do NOT edit, skip or weaken any existing test to get green: a failing existing suite is either a defect in Tasks 1-3 or a recorded lifecycle update the test pair owns (route it through `/relay-write-test`, never fix it by hand — R-X). If a pre-existing cron suite fails because the missed sweep now runs first against series rows it seeded, that is such a lifecycle case.

**MIRROR**: `# SOURCE: src/worker/cron.ts:27-35` (the unchanged Reminder sweep this verification protects).

**AC**: Delivers AC-A10.

**VALIDATE**: `set -euo pipefail; npm run check; npm test; git diff --quiet HEAD -- src/shared/recurrence.ts src/worker/db/schema.ts; test -z "$(git status --porcelain -- migrations)"; if git diff --unified=0 HEAD -- src/worker | grep -E "^\+[^+]" | grep "\.claude/PRPs" | grep -qv "MUST NOT appear"; then echo "FAIL: forbidden .claude/PRPs reference introduced"; exit 1; else echo "PASS: invariants hold"; fi`

## Validation Commands

All commands run from the worktree root (`.worktrees/missed-sweep`). Each level exits non-zero on any failure.

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

**Level 2 — UNIT_TESTS / CONTENT_INVARIANTS**

```bash
set -euo pipefail
npx vitest run --project worker test/missed-sweep test/cron-sweep.test.ts test/cron-heartbeat.test.ts test/cron-freshness.test.ts test/cron-reminder-route.test.ts test/tasks.test.ts test/series.test.ts
git diff --quiet HEAD -- src/shared/recurrence.ts src/worker/db/schema.ts
test -z "$(git status --porcelain -- migrations)"
if grep -nE "^(async )?function (buildSuccessorStatements|buildRecurrenceRule)" src/worker/routes/tasks.ts; then
  echo "FAIL: helper still defined in the route file"; exit 1
else
  echo "PASS: helpers live only in src/worker/successor.ts"
fi
grep -q 'from "../successor"' src/worker/routes/tasks.ts
grep -q 'from "./successor"' src/worker/cron.ts
```

**Level 3 — INTEGRATION (full suite, both projects)**

```bash
set -euo pipefail
npm test
```

## Acceptance Criteria

- **AC-A1 (PRD AC-10):** Given a daily series whose open occurrence is `2026-10-01` with one reminder offset `[1440]`, when `runScheduledJob` runs with `now` inside local day `2026-10-04`, then in one batch the `2026-10-01` row is `missed`, `2026-10-02` and `2026-10-03` are new `missed` rows carrying the template's title, priority and date field and no Reminders, exactly one open occurrence exists on `2026-10-04` with one unsent Reminder at `offsetToInstant("2026-10-04", 1440)`, and `missed_count` grew by 3.
- **AC-A2 (PRD AC-11):** Given the state AC-A1 produced, when `runScheduledJob` runs again with the same `now`, then every row of `tasks`, `reminders` and `recurrence_series` is byte-identical to its state before the second run.
- **AC-A3 (PRD AC-12):** Given an open occurrence the sweep is about to mark missed, when `POST /api/tasks/:id/complete` lands first, then the sweep writes nothing for that series (its guarded statements match no row, or a partial unique index rejects the batch), no duplicate row exists, the run completes without throwing, and `cron_runs` records `success`.
- **AC-A4 (PRD AC-13):** Given two series due for a sweep where the first one's write is rejected by a unique-index conflict, when `runScheduledJob` runs, then the second series is still swept.
- **AC-A5 (PRD AC-14):** Given an open occurrence superseded today that still carries an unsent Reminder whose `fire_at` has passed, when `runScheduledJob` runs, then the occurrence is `missed` and no push is dispatched for that Reminder.
- **AC-A6 (PRD AC-15):** Given a monthly series whose next date is `2026-10-05` in `America/Sao_Paulo`, when `runScheduledJob` runs at `2026-10-05T02:30:00Z` (still `2026-10-04` locally) nothing changes; at `2026-10-05T03:30:00Z` the occurrence is swept.
- **AC-A7 (PRD AC-16):** Given an open occurrence whose title was edited (so it is `detached`), when it is swept, then it becomes `missed` with its edited title intact and the successor carries the series template's title.
- **AC-A8 (PRD AC-17):** Given an active series with no open occurrence, when `runScheduledJob` runs, then exactly one open occurrence exists for it afterwards with its Reminders armed, and no `missed` row was added.
- **AC-A9 (PRD AC-18):** Given a Task with `series_id = null` whose deadline is 30 days past, when `runScheduledJob` runs, then it is still `open` and unchanged.
- **AC-A10 (PRD AC-4 / D-B, cron half):** Given a plan whose successor is still dated before today (the 366-cycle bound left it behind), when the cron writes it, then that successor is inserted open with NO Reminders; and the full existing suite stays green without any existing test being weakened.

R8b note: in PRD mode every bullet above carries the PRD AC it derives from. The Phase 2 success signal ("AC-10..AC-18 green, and the full existing suite green without weakening") is covered by AC-A1..AC-A9 and AC-A10 respectively.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| A race with the owner's manual completion writes a duplicate or double-counts `missed_count` (a no-match conditional `UPDATE` does not abort a batch) | M | H | The open-row close is first and conditional; the successor and catch-up inserts are rejected by `tasks_series_single_open_unq` / `tasks_series_occurrence_unq`, rolling the whole batch back; the one statement those cannot protect — the series counter/status update — carries a guard on both counter snapshots plus `exists(... status = 'missed')`, so overlapping runs and a skip-delete match no row. A unique conflict is mapped to "skip this series" (AC-A3, AC-A4) |
| One malformed series (e.g. unparseable `by_weekday` JSON) blocks every other series' sweep | L | M | Per-series try/catch; the first non-conflict failure is rethrown after the loop so `cron_runs` records `failure` while the Reminder sweep still ran |
| **AC-10 vs the Reminder clock.** If `now` fed both sweeps, the successor's Reminder (`23:59` local the day before) would be due inside the injected day and be claimed by the run under test, contradicting "one unsent Reminder" | H if shared | M | `now` drives only the missed sweep; the Reminder sweep keeps its own wall-clock read. The test for AC-A1 must therefore pin the system clock below that Reminder's `fireAt` (`vi.setSystemTime`) or it becomes a time bomb after `2026-10-03` — flagged to the test pair in `## Notes` |
| **Phase-1 advisory — unread input.** `MissedSweepInput.lastClosedOccurrenceDate` is required but `planMissedSweep` never reads it, so the caller supplies a value that is ignored | M | L | Phase 2 passes `null` and does not query it. Making the field optional or removing it is a phase-1 contract change, not made here; recorded for a follow-up cleanup so the type stops implying a query the writer need not make |
| **Phase-1 advisory — open owner decision D-F.** A completion-anchored repair with `interval > 1` lands at `today + interval - 1` (the phase-1 plan's Task 3 literal reading: `stepFrom(rule, previousDay(today), …)` with `completedOn = previousDay(today)`); untested | L | L | Left exactly as is; no phase-2 task alters it. Reachable only for a completion-anchored series that lost its open occurrence — a system-fault state. Recorded as an open risk for the owner to rule on; any change would be a `planMissedSweep` semantics change and must be traced to the PRD first |
| D1 / free-plan query budget per cron invocation (Cloudflare documents a per-invocation query/subrequest cap) vs. one read per pass + one batch per series + the existing per-Reminder queries | L | M | The owner holds a handful of series; at most 366 cycles per series per run (phase 1's bound) in a single batch. Whether a `db.batch` counts as one query on the free plan is `TBD - needs validation` against Cloudflare's current limits before the first long catch-up in production |
| Cloudflare cron delivery gaps (chore C9 saw 149 and 335 min) delay a miss | M | L | The sweep tolerates any gap (catch-up, AC-A1); a delayed miss is recorded on the next run, never lost |
| Existing cron suites seed series rows and now see the missed sweep run before the Reminder sweep | L | M | The sweep only writes when a series is genuinely superseded or lacks an open occurrence; if an existing assertion does depend on the old behaviour it is a recorded lifecycle update owned by the test pair, never an Implementer edit (R-X) |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework.
- Task 2-4's `**VALIDATE**` commands do invoke `vitest`, but only to RUN the already-approved suites (no test file is created or edited); the paragraph above remains true.
- **Worktree.** Phase 1's `src/shared/missed-sweep.ts` and `test/missed-sweep.test.ts` exist only in `.worktrees/missed-sweep` (uncommitted). This plan was grounded on that worktree; implement and validate there. `git diff HEAD` cannot vouch for `missed-sweep.ts` while it is untracked — the Implementer must simply not edit it.
- **Test seam for AC-A3.** `writeMissedSweepPlan(db, series, openTask, plan)` is exported on purpose: a test can snapshot the series and its open row, complete the occurrence through the route, and then call the writer with the now-stale snapshot — the only deterministic way to exercise "the completion lands first" without interleaving inside a single `runScheduledJob` call.
- **Test seam for AC-A4.** A conflict can be induced deterministically by seeding a `done` row for a date the first series' catch-up would write (the `tasks_series_occurrence_unq` index rejects it); the second series must still be swept and `cron_runs` must record `success`.
- **Reminders armed in the past.** A successor dated `today` with offset `1440` has its Reminder at 23:59 of the previous local day, so the Reminder sweep that follows in the same run pushes it immediately. That is exactly what AC-A1 asserts the row looks like and is intended: the owner learns of today's occurrence on the first cron run after midnight.
- **No docs edits in this phase.** The PRD assigns the `documentation/` and `docs/` updates (tasks domain area, roadmap, architecture's "the `scheduled()` handler still runs no `missed` sweep" sentence) to phase 3; `docs_sync: true` also routes them through the post-merge docs updater.
- **No UI** is touched, so the UI/UX review checklist is not triggered by this phase.

---

*Generated: 2026-10-01*
*Approved: 2026-10-01*
*Implemented: 2026-10-02*
*Status: IMPLEMENTED*
