# Feature: Materialization on close (Phase 3 of recurring-tasks)

```
**Decision Gate**
- Active context: none
- Activated criteria: modifies three existing Task write paths (`POST /:id/complete`, `POST /:id/reopen`, `DELETE /:id`) in an established route file rather than creating a new route family; an additive wire-contract change in `src/shared/api.ts` (`successor` field); domain rules for tasks (this phase composes Phase 1's pure expansion and Phase 2's materialization shape, it does not modify either); no schema migration, no UI
- Decisions found:
  - ADR-0006 recurrence model — Tasks materialize ONLY the current occurrence; at most one open occurrence per active series enforced by a unique index; completing computes the next date, checks end conditions and inserts the successor with its Reminders resolved to absolute UTC instants; deleting the open occurrence skips it; template edits propagate only to the open non-detached occurrence (`docs/decisions.md`, 2026-08-03 entry)
  - PRD Decisions D2 (detached occurrence's edit never leaks into the successor — built from the template), D3 (delete skips the cycle, successor spawned immediately, skipped cycle counts as neither done nor missed), D4 (successor reminders armed in the same batch from the template's offsets), D5 (completion anchor is an argument, never read from the clock inside the pure function — the route derives it via `todayIn`), D6 (`count` end condition counts CLOSED occurrences, `done_count + missed_count`), D10 (reopening a completed occurrence: untouched successor → delete it and undo; touched successor → 409 pt-BR, nothing changes)
  - ADR-0003 canonical D1, thin client, no offline writes, token on every route
  - ADR-0005 types flow from `src/worker/db/schema.ts` through `src/worker/dto.ts` to `src/shared/api.ts`; hand-duplicated entity types forbidden
  - ADR-0008 test-first methodology — `tdd: true`; the test pair derives the suite from the PRD's Acceptance Criteria before the Implementer runs
  - ADR-0009 visible copy pt-BR, everything else English — this phase's new 409 error message is user-facing, following `series.ts`'s pt-BR precedent (`"Série não encontrada"`)
  - [2026-09-10] A relative Task Reminder resolves against end-of-day local (23:59) via `offsetToInstant` — the same helper this phase composes (through `occurrenceReminderInstants`) for a successor's reminders, never re-derived
  - Unit 2 froze the Task wire contract — this phase only ADDS an optional `successor` field to the complete response; `EDITABLE_TASK_FIELDS` is unchanged
- Applicable anti-patterns:
  - Hand-duplicated entity types — the new `successor` field's type is `TaskDto`, reused, never re-declared
  - Portuguese in artifacts, with the ADR-0009 carve-out for the new route's visible error strings
  - Weakening tests to force green — not applicable to this phase's own diff (Implementer writes no test file — see `## Notes`), binding on how the Implementer must react if a test looks wrong
- Applicable architectural rules:
  - One Worker serves everything — no new route file, no second service
  - `db.batch([...])` is D1's only cross-statement atomicity primitive (no multi-statement transaction exists) — every write this phase adds that must be atomic with a Task status change uses it, exactly like `src/worker/routes/series.ts` and `src/worker/routes/oauth-callback.ts` already do
  - `src/shared/` stays DOM-free, clock-free, dependency-free — this phase CONSUMES `src/shared/recurrence.ts`'s `nextOccurrence`/`occurrenceReminderInstants`, it does not modify either; the route is the layer allowed to read the clock (`todayIn(now, tz)`), per D5
  - API-first internally — routes and tests green before any UI (Phase 4)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/recurring-tasks.prd.md` — Implementation Phases row 3: "Materialization
  on close" — Goal: Completing an occurrence makes the next one appear, and no Task
  write path can break the one-open invariant. — Success signal: AC-19..AC-25 green,
  and the full existing suite unmodified and green.

## Summary

This phase gives the three existing Task write paths in `src/worker/routes/tasks.ts`
— `POST /:id/complete`, `DELETE /:id`, `POST /:id/reopen` — the series-awareness they
currently lack entirely. Completing an occurrence of an active series computes its
successor via Phase 1's `nextOccurrence` and writes the closed Task, the series'
updated `doneCount`, the new successor Task and its armed Reminders in one atomic
`db.batch`, mirroring Phase 2's `POST /api/series` materialization shape; the
response gains an additive `successor` field. Deleting the open occurrence of a
series skips that cycle and spawns the successor immediately, touching neither
`doneCount` nor `missedCount` (D3). Reopening the most recently completed occurrence
either undoes the spawn — deleting an untouched successor and decrementing
`doneCount` — or refuses with `409` when the successor has been detached, closed, or
had a reminder already sent (D10). A one-off Task (`seriesId === null`) never enters
any of this new code: every handler branches on `seriesId` first and falls through to
today's exact, unmodified statement for that case, which is what makes AC-25's
byte-identical requirement structural rather than a runtime special case.

## User Story

As the owner completing, deleting or undoing a recurring commitment's current
occurrence,
I want the next cycle to appear automatically when I finish or skip this one, and to
be able to undo a completion cleanly when nothing has happened to the next cycle yet,
So that I never have to remember to recreate what always comes back, and a slip of
the thumb on "Completar" is not permanent.

## Problem Statement

Phase 2 can register a series and materialize its first occurrence, but nothing
after that exists: `complete`, `reopen` and `delete` in `src/worker/routes/tasks.ts:313-349`
carry zero series awareness today — completing a recurring Task's occurrence closes
that one row and nothing else ever appears again, silently breaking the "the next
cycle is already there" promise the whole unit exists to deliver. Worse, `delete` and
`reopen` on a series occurrence today behave identically to a one-off Task, which
for `delete` would leave the series with no open occurrence at all (violating the
one-open invariant's *spirit*, if not its structural enforcement) and for `reopen`
would silently resurrect a completed occurrence even after its successor already has
its own history — exactly the kind of stale, silently-wrong state the project's
honest-mirror principle forbids.

## Solution Statement

Extend the three handlers with a `seriesId !== null` branch that: (1) for
`complete`, reads the series row, builds a `RecurrenceRule` from it, computes
`nextOccurrence` (passing `completedOn` via `todayIn` only when `anchorMode ===
"completion"`, per D5) with `closedCount = doneCount + 1 + missedCount` (D6), and
either writes the successor Task + Reminders in the same `db.batch` as the
`doneCount` increment, or — when `nextOccurrence` returns `null` — ends the series in
that same batch; a `db.batch` rejection whose message names a `UNIQUE constraint`
(the two partial indexes' structural guard, AC-20) is caught and mapped to `409`,
never left to surface as `500`; (2) for `delete`, the same successor computation runs
with an UNCHANGED `closedCount` (D3 — a skip counts as neither done nor missed),
writing only the delete (Reminders cascade via the existing FK) and the successor in
one batch, or just the delete plus ending the series when `nextOccurrence` is `null`;
(3) for `reopen`, looks up the chronologically next `tasks` row for the same series
(`occurrenceDate` strictly greater than the reopened row's) — the row the original
completion spawned, whichever its current state — and either deletes it (Reminders
cascade) and decrements `doneCount` in one batch when it is untouched (`detached ===
false`, `status === "open"`, no reminder with `sentAt` set), or refuses with `409`
and a pt-BR message, writing nothing, when it is not. Two small private helpers
factor the series-row-to-`RecurrenceRule` mapping and the successor-statement
builder out of `complete` and `delete` so the `db.batch` shape (mirroring
`src/worker/routes/series.ts:172-220`) is written once, not twice.

## Metadata

| Field | Value |
|---|---|
| Type | Feature (extends three existing route handlers) |
| Complexity | High — three handlers each gain a new branch, one of them (`reopen`) resolves a row with no existing lookup precedent, one (`complete`) introduces this codebase's first caught-and-mapped D1 constraint-violation response, and every write must stay atomic with the Task status change it accompanies |
| Systems Affected | Worker API (`src/worker/routes/tasks.ts`), wire contract (`src/shared/api.ts`, additive only) |
| Dependencies | Phase 1 (`src/shared/recurrence.ts`) — complete; Phase 2 (`src/worker/routes/series.ts`, migration `0005`) — complete |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/recurring-tasks.prd.md:407` (Implementation Phases row 3); `:422-425` (Phase 3 Phase Details); `:209-243` (AC-19..AC-25); `:437-445` (Decisions Log D2-D6, D10) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/recurring-tasks.prd.md` | 209-243 | AC-19..AC-25 — the exact request/response/invariant contract this phase must satisfy |
| P0 | `src/worker/routes/tasks.ts` | 1-25, 262-349 | The exact file and handlers this phase edits: imports, the `PATCH` handler's "read existing row, branch, mutate" shape (262-270), and the current `complete`/`reopen`/`delete` bodies this phase extends without breaking their one-off path |
| P0 | `src/worker/routes/series.ts` | 41-50, 155-230 | `findOpenOccurrenceId`'s query shape (a pattern to adapt, not reuse verbatim, for `reopen`'s successor lookup) and `POST /`'s full `firstOccurrence` → `occurrenceReminderInstants` → `db.batch([series, task, ...reminders])` materialization — the exact shape this phase's new successor-builder helper must mirror |
| P0 | `src/shared/recurrence.ts` | 58-73, 286-312 | `NextOccurrenceArgs` and `nextOccurrence`'s exact contract: `completedOn` required (throws `TypeError` otherwise) only for `anchorMode: "completion"`, `closedCount` only consulted for `endKind: "count"`, `null` return means the series has ended |
| P0 | `src/worker/db/schema.ts` | 55-141, 151-228 | `recurrenceSeries` (`doneCount`, `missedCount`, `status`, rule columns) and `tasks` (both partial unique indexes at 194-200, the `detached`/`occurrenceDate` columns, the `tasks_completed_at_chk`/`tasks_occurrence_chk` CHECKs) — every column this phase reads or writes |
| P1 | `src/worker/routes/oauth-callback.ts` | 103-121 | The only other `db.batch([...])` precedent in the codebase, with its own comment on why D1 has no multi-statement transaction — the atomicity reasoning this phase's `complete`/`delete`/`reopen` batches all restate |
| P1 | `src/shared/dates.ts` | 22, 30-37 | `PRAESTO_TIMEZONE` and `todayIn(now, tz)` — the route-layer clock read D5 permits, needed for a completion-anchored series' `completedOn` |
| P1 | `src/worker/dto.ts` | 29-44, 119-121 | `toTaskDto` (reused for the new `successor` field, never re-declared) and `toSeriesDto`, for the mapping-composition convention |
| P1 | `src/shared/api.ts` | 24-40, 223-229, 336-337 | `TaskDto` (the type the new `successor` field reuses), `EDITABLE_TASK_FIELDS` (confirms this phase adds no new editable field), `SeriesDto` (the additive-field convention: spread the base DTO, add one computed field) |
| P2 | `test/tasks.test.ts` | 1-43, 115-198 | The test-helper idiom (`auth()`/`post()`) this phase's extended tests reuse, and the existing recurrence-index proofs — in particular lines 140-147/189-196 showing a unique-index violation surfaces in this test harness as a **thrown, catchable** error via `db.insert(...).rejects.toThrow()`, which is what makes AC-20's catch-and-map-to-409 design viable |
| P2 | `test/series.test.ts` | 1-33 | The sibling Phase 2 test file's own header comment on TDD scope boundaries and what it deliberately leaves for this phase — the convention this phase's own test-file extension (not authored by this plan) will likely follow |
| P2 | `docs/context/methodology.md` | 1-22 | `tdd: true`, `test_frameworks: ["vitest"]` — governs the TDD routing note in `## Notes` |

## Patterns to Mirror

```
# SOURCE: src/worker/routes/tasks.ts:262-270
  const db = createDb(c.env);
  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, c.req.param("id")));
  if (existing === undefined) return c.json({ error: "No Task with that id" }, 404);

  // Rule 3 — an edited occurrence detaches from its series.
  if (existing.seriesId !== null) patch.detached = true;
```
Copied by Tasks 3, 4 and 5 — every handler reads the existing row FIRST (before any
mutation) and branches on `existing.seriesId !== null`, the same "read, then branch
on series membership" shape `PATCH` already uses. A one-off Task never enters the
branch (AC-25).

```
# SOURCE: src/worker/routes/series.ts:41-50
async function findOpenOccurrenceId(
  db: ReturnType<typeof createDb>,
  seriesId: string,
): Promise<string | null> {
  const [open] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.seriesId, seriesId), eq(tasks.status, "open")));
  return open?.id ?? null;
}
```
Adapted (not reused verbatim) by Task 5 — `reopen`'s successor lookup needs the FULL
row (to read `detached`/`status`) and the CHRONOLOGICALLY NEXT occurrence specifically
(`occurrenceDate > existing.occurrenceDate`, ascending, limit 1), not "whichever row
is currently open" — the two differ once more than one cycle has elapsed since the
row being reopened.

```
# SOURCE: src/worker/routes/series.ts:169-220
  const taskId = crypto.randomUUID();
  const reminderInstants = occurrenceReminderInstants(occurrenceDate, reminderOffsets, timezone);

  const db = createDb(c.env);
  const [[seriesRow], [taskRow]] = await db.batch([
    db.insert(recurrenceSeries).values({ ... }).returning(),
    db.insert(tasks).values({
      id: taskId,
      title,
      description,
      deadline: dateMode === "deadline" ? occurrenceDate : null,
      scheduledDate: dateMode === "scheduled" ? occurrenceDate : null,
      priority,
      lifeAreaId,
      seriesId,
      occurrenceDate,
    }).returning(),
    ...reminderInstants.map((instant, index) =>
      db.insert(reminders).values({
        id: crypto.randomUUID(),
        taskId,
        fireAt: new Date(instant * 1000),
        originOffsetMinutes: reminderOffsets[index] ?? null,
      }),
    ),
  ]);
```
Composed by Task 2's `buildSuccessorStatements` helper — the exact Task-row-plus-
Reminders shape a new occurrence is built from, generalized to read the template
fields from an existing `RecurrenceSeries` row (`series.title`, `series.dateMode`,
…) instead of a validated POST body, and to return an array of un-awaited statements
for the CALLER to fold into its own `db.batch([...])` (Task 3's or Task 4's), rather
than calling `db.batch` itself — this phase's batch always also contains the Task
status change (`done` or delete), which `series.ts`'s POST never had to combine with.

```
# SOURCE: src/worker/routes/oauth-callback.ts:103-121
  // ONE operation, not two. Storing the credential and consuming the nonce
  // must not be separable: a termination between two independent awaits would
  // leave the token stored with the nonce still spendable, and the callback
  // URL replayable. `batch()` is D1's only cross-statement atomicity primitive
  // — there is no multi-statement transaction to reach for here.
  await db.batch([
    db.insert(googleConnections).values({ ... }).onConflictDoUpdate({ ... }),
    db.update(oauthStates).set({ consumedAt: new Date() }).where(eq(oauthStates.id, state)),
  ]);
```
Restated by Tasks 3, 4 and 5 — the Task status change (done / deleted / reopened)
and the series-side effect (successor spawn, `doneCount` change, or series-ended
flip) must never be separable, for the identical reason: a crash between two
independent awaits would leave the Task closed with no successor, or a successor
spawned twice.

```
# SOURCE: src/shared/recurrence.ts:299-312
export function nextOccurrence(rule: RecurrenceRule, args: NextOccurrenceArgs): string | null {
  let candidate: string;
  if (rule.anchorMode === "completion") {
    if (args.completedOn === undefined) {
      throw new TypeError(
        "nextOccurrence: rule.anchorMode is 'completion' but completedOn was not provided",
      );
    }
    candidate = stepToNextOccurrenceFromCompletion(rule, args.completedOn);
  } else {
    candidate = findNextTrackDate(rule, args.after);
  }
  return isWithinEndCondition(rule, candidate, args.closedCount) ? candidate : null;
}
```
Called by Task 3 (with `after: existing.occurrenceDate`, `completedOn` supplied only
when `rule.anchorMode === "completion"`, `closedCount: series.doneCount + 1 +
series.missedCount`) and Task 4 (same call, but `closedCount: series.doneCount +
series.missedCount` UNCHANGED — D3). A `null` return in either task means: write the
Task mutation, but end the series instead of spawning (AC-21).

```
# SOURCE: src/worker/db/schema.ts:194-200
    uniqueIndex("tasks_series_occurrence_unq")
      .on(t.seriesId, t.occurrenceDate)
      .where(sql`${t.seriesId} is not null`),
    uniqueIndex("tasks_series_single_open_unq")
      .on(t.seriesId)
      .where(sql`${t.seriesId} is not null and ${t.status} = 'open'`),
```
Grounds Task 3's concurrency design: D1 serializes concurrent `db.batch` calls
(single-writer model), so of two concurrent `complete` calls on the same occurrence,
the second's own successor `INSERT` — computing the SAME `occurrenceDate` from the
SAME deterministic inputs — collides with the first (already-committed) successor
row on `tasks_series_occurrence_unq` and throws; the whole second batch rolls back
atomically (AC-20).

```
# SOURCE: test/tasks.test.ts:140-147
    await expect(
      db.insert(tasks).values({
        id: crypto.randomUUID(),
        title: "Drink water",
        seriesId: "series-1",
        occurrenceDate: "2026-08-04",
      }),
    ).rejects.toThrow();
```
Confirms, for Task 3's design, that a partial-unique-index violation surfaces in
THIS test harness (Vitest + `@cloudflare/vitest-pool-workers` + Drizzle) as a
rejected promise / thrown error reaching the caller — never a silently empty
`.returning()` result — which is what makes "catch the `db.batch` rejection" the
correct shape for mapping the AC-20 race loser to a handled `409`.

**No existing pattern to mirror for Task 3's catch-and-map-to-409 design** — this
codebase has no prior file that catches a D1/SQLite constraint-violation error and
maps it to a non-500 HTTP response, so there is no `# SOURCE:` citation to give it.
The full reasoning and the exact code shape are recorded in `## Notes` ("No-precedent
design decision: the catch-and-map-to-409 pattern") rather than here.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/api.ts` | UPDATE | Add `successor?: TaskDto` to the complete response type (AC-19); additive only, `EDITABLE_TASK_FIELDS` unchanged |
| `src/worker/routes/tasks.ts` | UPDATE | Series-aware `complete`/`delete`/`reopen`; two new private helpers (`buildRecurrenceRule`, `buildSuccessorStatements`) |

## NOT Building (Scope Limits)

- No `missed` sweep — an unfinished occurrence stays open and overdue in this unit
  (unit 10's concern, PRD "What We're NOT Building").
- No adherence tracking or repeated-miss nudge — units 11, 12.
- No rule edits, series hard-delete, "this and future" edits, or unsupported RRULE
  shapes — Won't per the PRD, `PATCH /api/series/:id` already structurally rejects
  rule fields (Phase 2).
- No *Repetir* UI control, series glyph, or any screen change — Phase 4
  (AC-26..AC-28).
- No change to `PATCH /api/tasks/:id`'s existing `detached`/reminder-recompute
  behavior (`src/worker/routes/tasks.ts:269-307`) — it is read as a pattern, not
  modified.
- No frontend client change (`src/app/api.ts`'s `completeTask`/`reopenTask`/
  `deleteTask`) — consuming the new `successor` field on screen is Phase 4's job;
  this phase only adds the field to the wire response.
- No Google Calendar mirroring of series or occurrences (ADR-0007 closed inventory).

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/api.ts — additive `successor` field
**ACTION** (AC-19): Add a new exported interface immediately after `TaskDto`:
```ts
/**
 * `POST /api/tasks/:id/complete`'s response shape (PRD AC-19). `successor` is
 * present only when the completed Task belonged to an active series and a
 * next occurrence was spawned; a one-off Task's response carries no
 * `successor` key at all, matching today's `{ task }` shape byte-for-byte
 * (AC-25).
 */
export interface CompleteTaskResponse {
  task: TaskDto;
  successor?: TaskDto;
}
```
Make no other change to this file — `EDITABLE_TASK_FIELDS` (223-229) stays exactly
as it is, since `seriesId`/`occurrenceDate`/`detached` remain server-owned.
**MIRROR**: `# SOURCE: src/shared/api.ts:336-337` (`SeriesDto`'s own additive-field
convention: a base DTO type plus one extra field)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 2: UPDATE src/worker/routes/tasks.ts — private helpers
**ACTION** (AC-19, AC-20, AC-22, AC-23): Add two private (non-exported) helper
functions above the route handlers, after the existing imports — consumed by
Task 3 (`complete`, AC-19/AC-20/AC-22) and Task 4 (`delete`, AC-23), so neither
handler duplicates the series-row-to-rule mapping or the successor-write shape:
1. `function buildRecurrenceRule(series: RecurrenceSeries): RecurrenceRule` —
   maps a `recurrenceSeries` row to `src/shared/recurrence.ts`'s `RecurrenceRule`,
   decoding `byWeekday` with `series.byWeekday === null ? null :
   (JSON.parse(series.byWeekday) as number[])` (this is the codebase's first
   byWeekday JSON *decode* — Phase 2 only ever *encoded* it for storage, since
   `firstOccurrence` never reads it; `src/shared/recurrence.ts:34-36`'s own doc
   comment anticipates this decode happening "at the route boundary").
2. `async function buildSuccessorStatements(db: ReturnType<typeof createDb>,
   series: RecurrenceSeries, occurrenceDate: string): Promise<{ successorId:
   string; statements: unknown[] }>` — computes `reminderOffsets` (decoded the
   same way as `byWeekday`, defaulting to `[]`), calls
   `occurrenceReminderInstants(occurrenceDate, reminderOffsets, series.timezone)`,
   generates a new Task id, and returns `{ successorId, statements: [
   db.insert(tasks).values({ id: successorId, title: series.title!,
   description: series.description, deadline: series.dateMode === "deadline" ?
   occurrenceDate : null, scheduledDate: series.dateMode === "scheduled" ?
   occurrenceDate : null, priority: series.priority, lifeAreaId:
   series.lifeAreaId, seriesId: series.id, occurrenceDate }).returning(),
   ...reminderInstants.map((instant, index) => db.insert(reminders).values({
   id: crypto.randomUUID(), taskId: successorId, fireAt: new Date(instant *
   1000), originOffsetMinutes: reminderOffsets[index] ?? null })) ] }` — the
   statements are NOT awaited or executed here; Tasks 3 and 4 splice them into
   their own `db.batch([...])` array alongside the Task-status-changing
   statement, so the whole write stays one atomic operation.
Import `RecurrenceRule`, `nextOccurrence`, `occurrenceReminderInstants` from
`../../shared/recurrence`, `recurrenceSeries` and `type RecurrenceSeries` from
`../db/schema`, and add `recurrenceSeries` to the existing `tasks, reminders`
import from `../db/schema`.
**MIRROR**: `# SOURCE: src/worker/routes/series.ts:169-220` (the exact
occurrence-plus-reminders write shape this helper generalizes)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 3: UPDATE src/worker/routes/tasks.ts — `POST /:id/complete`
**ACTION** (AC-19, AC-20, AC-21, AC-22, AC-25): Replace the handler body. Read
`existing` first (`select` by id); `404` with today's exact message when
`existing === undefined || existing.status !== "open"`. When `existing.seriesId
=== null`, keep TODAY'S exact statement unchanged (the single `update ...
where(and(eq(id), eq(status,'open'))).returning()`, `404` if no row, `return
c.json({ task: toTaskDto(row) })`) — this is what makes AC-25 structural.
Otherwise (series occurrence): `select` the `recurrenceSeries` row by
`existing.seriesId`; build its `RecurrenceRule` (Task 2's helper); compute
`completedOn = rule.anchorMode === "completion" ? todayIn(new Date(),
rule.timezone) : undefined`; compute `closedCount = series.doneCount + 1 +
series.missedCount` (D6 — this completion counts); compute `next =
series.status === "ended" ? null : nextOccurrence(rule, { after:
existing.occurrenceDate!, completedOn, closedCount })`. Build the statements
array starting with the Task `update ... set({ status: "done", completedAt: new
Date() }).where(and(eq(id), eq(status,'open'))).returning()`; when `next !==
null`, append `db.update(recurrenceSeries).set({ doneCount: series.doneCount +
1 }).where(eq(recurrenceSeries.id, series.id))` plus Task 2's
`buildSuccessorStatements(db, series, next).statements`; when `next === null`,
append `db.update(recurrenceSeries).set({ doneCount: series.doneCount + 1,
status: "ended" }).where(eq(recurrenceSeries.id, series.id))` instead (skip the
`status: "ended"` write when `series.status` was already `"ended"`, to avoid an
unnecessary write — not a correctness requirement, just avoiding a no-op
`UPDATE`). Execute with `try { results = await db.batch(statements); } catch
(error) { if (error instanceof Error && error.message.includes("UNIQUE
constraint failed")) return c.json({ error: "A próxima ocorrência já foi criada
por outra requisição" }, 409); throw error; }` (the TBD-flagged pattern in
`## Patterns to Mirror` — AC-20's race handling). Read the Task-update result
from `results[0]`; `404` with today's message if empty (sequential double-call,
same as the one-off path). Respond `c.json({ task: toTaskDto(updatedRow),
successor: successorRow === undefined ? undefined : toTaskDto(successorRow) })`
— `successorRow` comes from the statements array's task-insert result when
`next !== null`, `undefined` otherwise, so a `next === null` completion's
response carries no `successor` key (`JSON.stringify` omits an `undefined`
property, matching AC-19's "additive" framing and AC-25's byte-identical
requirement for the one-off path specifically).
**MIRROR**: `# SOURCE: src/worker/routes/oauth-callback.ts:103-121` (batch
atomicity); `# SOURCE: src/shared/recurrence.ts:299-312` (`nextOccurrence`
contract); no existing pattern for the catch-and-map-to-409 response — see
`## Notes`, "No-precedent design decision: the catch-and-map-to-409 pattern"
**VALIDATE**: `npx vitest run test/tasks.test.ts -t "complete|successor|409"`

### Task 4: UPDATE src/worker/routes/tasks.ts — `DELETE /:id`
**ACTION** (AC-23, AC-25): Read `existing` first; `404` with today's exact message
when `existing === undefined`. When `existing.seriesId === null` OR
`existing.status !== "open"`, keep TODAY'S exact statement unchanged (`db.delete(tasks).where(eq(tasks.id,
id)).returning()`, `404` if no row, `return c.body(null, 204)`) — a closed
series row (already `done`/`missed`) is deleted the plain way, only an OPEN
series occurrence triggers the skip-and-spawn (this is what keeps AC-25
structural and avoids re-spawning a successor for a row that already has one).
Otherwise: `select` the series row; build its `RecurrenceRule`; compute `next =
series.status === "ended" ? null : nextOccurrence(rule, { after:
existing.occurrenceDate!, completedOn: rule.anchorMode === "completion" ?
todayIn(new Date(), rule.timezone) : undefined, closedCount: series.doneCount +
series.missedCount })` — `closedCount` is UNCHANGED from the series' current
counts (D3: a skip counts as neither done nor missed; note in a code comment
that `completedOn` here is the deletion day standing in for "the day this cycle
ended", since D3/D5's interaction for a completion-anchored series being
skipped rather than completed is not named by any AC — flagged in `## Risks and
Mitigations` below). Build statements: `db.delete(tasks).where(eq(tasks.id,
id)).returning()` (Reminders cascade via the existing `onDelete: "cascade"` FK
— no explicit reminder delete needed) plus, when `next !== null`, Task 2's
`buildSuccessorStatements(db, series, next).statements`; when `next === null`
and `series.status !== "ended"`, append the series-ending update instead (no
`doneCount`/`missedCount` change either way — D3). Execute via `db.batch(...)`
wrapped in the same catch-and-map-to-409 shape as Task 3 (a concurrent delete +
complete racing on the same occurrence is the same structural collision).
`404` with today's message if the delete's own result is empty. Respond `c.body(null,
204)` — unchanged shape; `DELETE` never carried a JSON body and does not gain
one (a delete has nothing to attach a `successor` field to on the wire; Phase
4's screen re-fetches the list, which already shows the successor once it
exists).
**MIRROR**: `# SOURCE: src/shared/recurrence.ts:299-312` (`nextOccurrence`,
`closedCount` left unchanged per D3); `# SOURCE: src/worker/routes/series.ts:169-220`
(successor materialization, via Task 2's helper)
**VALIDATE**: `npx vitest run test/tasks.test.ts -t "delete|skip"`

### Task 5: UPDATE src/worker/routes/tasks.ts — `POST /:id/reopen`
**ACTION** (AC-24, AC-25): Read `existing` first; `404` with today's exact message
when `existing === undefined || existing.status !== "done"`. When
`existing.seriesId === null`, keep TODAY'S exact statement unchanged (`db.update(tasks).set({
status: "open", completedAt: null }).where(and(eq(id),
eq(status,'done'))).returning()`, `404` if no row, `return c.json({ task:
toTaskDto(row) })`) — structural AC-25. Otherwise: look up the successor —
`select().from(tasks).where(and(eq(tasks.seriesId, existing.seriesId),
sql\`${tasks.occurrenceDate} > ${existing.occurrenceDate}\`)).orderBy(tasks.occurrenceDate).limit(1)`
(adapted from `findOpenOccurrenceId`, see `## Patterns to Mirror` — the
chronologically NEXT row for this series, not "whichever is currently open").
When no such row exists, or it exists and is UNTOUCHED (`successor.detached ===
false && successor.status === "open" &&` no linked `reminders` row has
`sentAt` set — check with a `select` on `reminders` where `taskId =
successor.id and sentAt is not null`, limit 1), build a `db.batch([
db.update(tasks).set({ status: "open", completedAt: null }).where(and(eq(id),
eq(status,'done'))).returning(), db.update(recurrenceSeries).set({ doneCount:
series.doneCount - 1 }).where(eq(recurrenceSeries.id, existing.seriesId)),
...(successor === undefined ? [] : [db.delete(tasks).where(eq(tasks.id,
successor.id))]) ])` (deleting the successor cascades its Reminders via the
existing FK) and respond `c.json({ task: toTaskDto(updatedRow) })`. When the
successor exists and is TOUCHED (any of the three conditions fails), write
NOTHING and respond `c.json({ error: "A próxima ocorrência já existe e não
pode mais ser desfeita" }, 409)` (D10, pt-BR). Document in a code comment,
next to the `successor === undefined` branch, that this treats "no successor
row at all" (e.g. the series had already reached its end condition when this
row was completed) as vacuously untouched — an edge D10's own wording does not
name explicitly, flagged in `## Risks and Mitigations`.
**MIRROR**: `# SOURCE: src/worker/routes/series.ts:41-50` (`findOpenOccurrenceId`,
adapted to a chronological-next lookup); `# SOURCE: src/worker/routes/oauth-callback.ts:103-121`
(batch atomicity for the undo)
**VALIDATE**: `npx vitest run test/tasks.test.ts -t "reopen|undo|409"`

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc -b --noEmit
npx eslint src/worker/routes/tasks.ts src/shared/api.ts
```

### Level 2: UNIT_TESTS
```bash
npx vitest run test/tasks.test.ts
```
AC-19..AC-25 must all be green. This is the test-writer/test-reviewer's suite
(authored before this plan's tasks run, per `tdd: true`) — the Implementer's job is
to make it pass, not to write it.

### Level 3: INTEGRATION
```bash
set -euo pipefail
npm test
npm run check
```
`npm test` runs the full existing suite (889+ tests, plus Phase 1's and Phase 2's
own suites already landed in this worktree) as the regression check AC-25 depends
on: every existing `test/tasks.test.ts` one-off case, and everything in
`test/series.test.ts`, `test/recurrence.test.ts` and the rest of the suite, must
stay green unmodified. `npm run check` is the project's combined type/lint/format
gate.

## Acceptance Criteria

- **AC-A1 (PRD AC-19):** Completing an open occurrence of an active series marks it
  `done` with `completedAt` set, increments the series' `doneCount`, spawns exactly
  one new open occurrence with the template's fields and one unsent reminder per
  offset, and returns it as an additive `successor` field; a one-off Task's
  complete response carries no `successor` key and is otherwise byte-identical to
  today's.
- **AC-A2 (PRD AC-20):** Completing an already-completed occurrence a second time
  creates no second successor (`404`, unchanged); two concurrent `complete` calls on
  the same open occurrence leave exactly one successor, with the losing request
  receiving a handled non-`500` response.
- **AC-A3 (PRD AC-21):** When completing reaches the series' `count` or `until` end
  condition, no successor is created and the series becomes `ended`.
- **AC-A4 (PRD AC-22):** Completing a `detached` (individually edited) occurrence
  spawns a successor carrying the series template's original fields, not the
  edited ones.
- **AC-A5 (PRD AC-23):** Deleting an open occurrence removes it and its reminders,
  spawns the successor with its reminders armed, and leaves `doneCount`/
  `missedCount` unchanged.
- **AC-A6 (PRD AC-24):** Reopening the most recently completed occurrence, when its
  successor is untouched, deletes the successor and its unsent reminders, reopens
  the occurrence and decrements `doneCount`; when the successor has been touched
  (detached, closed, or any reminder sent), reopen returns `409` with pt-BR copy and
  changes nothing.
- **AC-A7 (PRD AC-25):** A one-off Task's `complete`/`reopen`/`delete` behavior and
  response stay byte-identical to the current suite's expectations — the existing
  tests pass unmodified.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The catch-and-map-to-`409` pattern for a D1 unique-constraint violation is introduced with zero prior codebase precedent (confirmed by research) | M | Medium — an unmatched error message would let a genuine race surface as `500` instead of the required handled response | Task 3/4's `error.message.includes("UNIQUE constraint failed")` check is grounded in `test/tasks.test.ts:140-147`'s proof that this harness surfaces the violation as a catchable thrown error; AC-20's concurrent-double-complete test is the structural backstop, and any non-matching error still propagates (never silently swallowed) |
| `reopen`'s "untouched vs. touched successor" check spans three independent conditions (`detached`, `status`, any sent reminder); missing one could silently delete a successor that already has real history | M | High — would destroy owner data | Task 5's `## Patterns to Mirror`/ACTION enumerates all three checks explicitly, backed by a dedicated `reminders` lookup rather than inferring "touched" from the Task row alone |
| A completion-anchored (`anchorMode: "completion"`) series' open occurrence being DELETED (not completed) has no natural `completedOn` — D3 (skip) and D5 (completion anchor requires the actual completion day) are not jointly specified by any AC | L — AC-23's own worked example is calendar-anchored; completion-anchored delete is an untested corner, not the common path | Medium — a wrong successor date on this specific corner | Task 4 documents the chosen fallback (`todayIn` of the deletion instant standing in for "the day this cycle ended") in an inline code comment, naming it explicitly as an untested corner — mirroring `src/shared/recurrence.ts`'s own precedent (its "completed-extremely-late" doc comment) for flagging rather than hiding an open question |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in
`docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance
Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed
through the `test-writer`/`test-reviewer` pair's lifecycle ledger
(`/relay-write-test` → `/relay-test-write-review`), not authored by the
Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's
diff. No task above and no `## Files to Change` row targets a test file, so this
plan's `**VALIDATE**` commands exercise the change directly (`tsc -b`, `eslint`, the
extended `test/tasks.test.ts` run, the full `npm test` regression) rather than the
Implementer authoring new coverage.

**`phase_type: feature`, not `foundation`.** This phase extends three existing
handlers against a seam (schema, indexes, `src/shared/recurrence.ts`'s pure
functions, `occurrenceReminderInstants`) that already exists and is already tested
— it does not introduce the types or methods its own Acceptance Criteria name, it
composes existing ones behind three already-shipped endpoints. AC-19..AC-25 are
precise, test-first-authorable request/response examples against that seam, the
`feature` signal, not the `foundation` one.

**No-precedent design decision: the catch-and-map-to-409 pattern (Task 3, restated
by Task 4).** No file in this codebase currently catches a D1/SQLite
constraint-violation error and maps it to a non-500 HTTP response — confirmed by
`research-codebase`: every `db.insert`/`db.update`/`db.batch` call site in
`src/worker/routes/*.ts` is unwrapped, and no `src/worker/errors.ts` or similar
classification helper exists. Task 3 introduces this pattern for the first time in
the project: `catch (error) { if (error instanceof Error &&
error.message.includes("UNIQUE constraint failed")) { return c.json({ error: "..."
}, 409); } throw error; }` around the `db.batch(...)` call — any error NOT matching
that message propagates unchanged (never silently swallowed), consistent with
`oauth-callback.ts`'s own reason-preserving catch blocks around `exchangeCode`
(`src/worker/routes/oauth-callback.ts:79-101`). Grounded in `test/tasks.test.ts:140-147`'s
proof that this harness surfaces a unique-index violation as a catchable thrown
error (see `## Patterns to Mirror`), not in any prior route's error handling.

**A second documented design decision with no PRD-named precedent:** `reopen`'s
successor lookup (Task 5) is the chronologically-next `tasks` row for the series,
not `findOpenOccurrenceId`'s "currently open" row — the two coincide in the
common case (undo shortly after completing) but diverge once more than one cycle
has elapsed, and the plan deliberately picks the historically-correct lookup over
the simpler-but-wrong one.

*Generated: 2026-09-24*
*Approved: 2026-09-24*
*Implemented: 2026-09-24*
*Status: IMPLEMENTED*
