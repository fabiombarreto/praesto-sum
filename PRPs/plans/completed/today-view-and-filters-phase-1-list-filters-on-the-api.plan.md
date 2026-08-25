# Feature: List filters on the API (Phase 1 of today-view-and-filters)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: extends a data contract eleven downstream units read
  (`GET /api/tasks`); adds query parameters whose names were reserved, not
  invented; encodes a task-domain rule (an unset priority sorts as normal) in
  SQL for the first time; touches the derived contract document and the
  architecture overview that describe the freeze
- Decisions found:
  - Frozen Task read contract (unit 2, 2026-08-15; `docs/api-reference.md:38-41`)
    — `status` is implemented and `from`, `to` and `priority` are RESERVED for
    unit 3, so this phase extends a vocabulary rather than inventing one;
    adding a filter is backward-compatible, renaming one is not
  - Frozen Task read contract — ordering is produced by the API and applied IN
    the query, before `limit`, so `?limit=N` returns the first N *of the ordered
    set*; a filter must therefore narrow the set the ordering runs over, never
    run after it
  - Owner, 2026-08-23 (PRD Decisions Log) — filtering happens on the API under
    the reserved names; grouping happens in the client and is explicitly NOT an
    API concern
  - `docs/domain/areas/tasks.md:15` — priority is `high | normal | low`,
    enforced by a TypeScript union AND `tasks_priority_chk`; `NULL` means "not
    set" and **sorts as normal**
  - ADR-0003 (2026-08-03) — one canonical copy in D1; the API is the only place
    a guarantee shared by every client can live
  - ADR-0008 (2026-08-04) — test-first (`tdd: true`)
  - Roadmap, "How units are built" — every unit is API-first internally: routes
    and tests green before any UI
- Applicable anti-patterns:
  - Hand-duplicated entity types (`docs/anti-patterns.md`) — the filter
    validators are the existing `src/shared/api.ts` guards, never a second copy
  - Weakening tests to force green (`docs/anti-patterns.md`) — the 20 existing
    list-contract tests are not edited by this phase; their passing UNCHANGED is
    the evidence that the no-filter contract did not move
  - Glossary synonym drift (`docs/anti-patterns.md`) — "deadline" and "scheduled
    date" stay distinct; the filter key is their coalesce, never a renamed third
    concept
  - Portuguese in artifacts (`docs/anti-patterns.md`) — the 400 messages this
    route emits are developer-facing English, like every other message in it
- Applicable architectural rules:
  - `src/shared/` compiles into BOTH targets, so it carries no DOM or Worker
    globals and no runtime dependencies (`src/shared/api.ts:1-13`) — this phase
    only *consumes* its guards, it adds nothing there
  - Filters belong in the `WHERE` clause, beside the ordering, so ordering and
    `limit` keep operating over the filtered set
  - A parameter is rejected at the boundary with a `400`, never clamped and
    never silently ignored — the rule `limit` already establishes
  - No route is added, removed or renamed; the `{ tasks: [...] }` envelope is
    untouched
- Result: PROCEED
```

## Source

- `PRPs/prds/today-view-and-filters.prd.md` — Implementation Phases row 1 (line
  276): "List filters on the API" — Goal: the contract's reserved filter
  vocabulary exists, is tested, and composes with everything already frozen —
  Success signal (PRD Phase Details): the new route tests are RED for the right
  reason before the implementation and GREEN after; the pre-existing list tests
  pass **unchanged**, which is what proves the no-filter contract did not move;
  `npm run check` green.

## Summary

This phase spends the three query-parameter names unit 2 reserved and stops
there. `GET /api/tasks` learns `from`, `to` and `priority`, each validated at
the boundary through the guards `src/shared/api.ts` already exports, each
applied as a `WHERE` clause built beside the ordering expression so the frozen
"ordered before limited" guarantee survives untouched. Two semantics are
decided here rather than inherited by accident: a date range compares against
`coalesce(deadline, scheduled_date)`, so an undated Task is never inside one;
and `priority=normal` matches rows whose priority is `normal` **or** `NULL`,
because an unset priority means "not set" and sorts as normal. No UI changes, no
grouping, no migration — the screen is phases 2 and 3.

## User Story

As the owner
I want the list endpoint to answer narrower questions — a date window, a
priority — without inventing a second vocabulary
So that the today screen's filters, the export and every later unit ask the same
API the same way, and the ordering guarantee they all depend on keeps holding
under a filter.

## Problem Statement

FR-007 promises filtering by status, dates and priority; only `status` exists.
The list route validates `status` and `limit` and nothing else
(`src/worker/routes/tasks.ts:41-57`), so a caller asking for high-priority Tasks
due this week has exactly two options: fetch everything and filter in the
client, or invent parameters. The first puts a shared guarantee in the one place
consumers cannot share it; the second is what
`docs/api-reference.md:38-41` reserved the names to prevent. Until the
vocabulary exists, phase 3's chip row has nothing to call.

## Solution Statement

Add the three reserved parameters to the existing handler and nowhere else.
Validate each at the top of the handler, in the shape the route already uses —
`isCalendarDate` for `from` and `to` (the same guard the create route applies to
`deadline`), `isTaskPriority` for `priority` — returning `400` with a message
that names the offending parameter rather than clamping or ignoring it. Then
build the clauses into the `where()` call that today carries only the optional
status equality, keeping `.orderBy(...).limit(...)` byte-identical so the
filtered set is ordered and only then truncated. The date clauses compare
against the `dueDate` sql fragment the ordering already computes, which is what
makes "undated Tasks are never in a date range" a property of the expression
rather than a special case. The priority clause branches once, for `normal`, to
honour the `NULL`-means-normal domain rule.

## Metadata

| Key | Value |
|---|---|
| Type | API extension (backward-compatible) |
| Complexity | Low — one handler, no schema change, no migration, no new dependency |
| Systems Affected | `src/worker/routes/tasks.ts` (list handler only); the derived contract docs |
| Dependencies | None. PRD row 1 has an empty `Depends` cell; unit 2's frozen contract is already shipped |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/today-view-and-filters.prd.md:276` (Implementation Phases row 1) |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| 1 | `src/worker/routes/tasks.ts` | 24-77 | The handler being changed, its doc comment explaining why the order is produced here, and the two validation idioms to mirror |
| 1 | `docs/api-reference.md` | 26-50 | The frozen read contract: the ordering guarantee, the reserved filter vocabulary this phase spends, and the paging rule it must not disturb |
| 1 | `src/shared/api.ts` | 96-117 | `isTaskStatus`, `isTaskPriority`, `isCalendarDate` — the guards to reuse; `isCalendarDate` also rejects impossible dates like `2026-02-31` |
| 2 | `src/shared/api.ts` | 24-40 | `TaskDto`, and the comment recording that `priority: null` means "not set" and sorts as normal |
| 2 | `test/task-list-contract.test.ts` | 1-57 | The 20 tests that must keep passing unedited, and the `dayOffset()` helper the new tests inherit — every date derived from the server's own today |
| 2 | `docs/domain/areas/tasks.md` | 15 | The task-domain rule this phase encodes in SQL for the first time |
| 3 | `src/worker/db/schema.ts` | 200-215 | `tasks_single_date_chk` — why `coalesce(deadline, scheduled_date)` is unambiguous |
| 3 | `PRPs/prds/today-view-and-filters.prd.md` | 109-135 | AC-1 through AC-6, the contract the test pair authors from |

## Patterns to Mirror

```ts
# SOURCE: src/worker/routes/tasks.ts:42-57
  const status = c.req.query("status");
  if (status !== undefined && !isTaskStatus(status)) {
    return c.json({ error: `Unknown status: ${status}` }, 400);
  }

  const rawLimit = c.req.query("limit");
  let limit = MAX_TASK_LIMIT;
  if (rawLimit !== undefined) {
    // Reject rather than clamp: a caller handed 501 and given 500 has no way to
    // know its request was altered.
    const parsed = /^\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TASK_LIMIT) {
      return c.json({ error: `Invalid limit: ${rawLimit}` }, 400);
    }
    limit = parsed;
  }
```

The boundary shape every new parameter follows: read with `c.req.query`, leave
`undefined` alone, reject an invalid value with a `400` that quotes it back.

```ts
# SOURCE: src/worker/routes/tasks.ts:59-74
  const today = todayIn(new Date());
  const dueDate = sql`coalesce(${tasks.deadline}, ${tasks.scheduledDate})`;
  const urgencyBucket = sql`case
      when ${dueDate} is null then 3
      when ${dueDate} < ${today} then 0
      when ${dueDate} = ${today} then 1
      else 2
    end`;

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(tasks)
    .where(status === undefined ? undefined : eq(tasks.status, status))
    .orderBy(urgencyBucket, dueDate, desc(tasks.createdAt))
    .limit(limit);
```

`dueDate` is the fragment the new date clauses compare against — reusing it is
what keeps the filter key and the ordering key provably the same expression. The
`.orderBy(...).limit(...)` tail must survive this phase unchanged.

```ts
# SOURCE: src/worker/routes/tasks.ts:88-93
  if (deadline !== null && !isCalendarDate(deadline)) {
    return c.json({ error: "deadline must be a calendar date (YYYY-MM-DD)" }, 400);
  }
  if (scheduledDate !== null && !isCalendarDate(scheduledDate)) {
    return c.json({ error: "scheduledDate must be a calendar date (YYYY-MM-DD)" }, 400);
  }
```

The exact message shape the two new date parameters copy: `<name> must be a
calendar date (YYYY-MM-DD)`.

```ts
# SOURCE: src/worker/routes/tasks.ts:233
    .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
```

`and` is already imported in this file and already composes clauses in the
complete/reopen handlers — the list handler's multi-clause `where` uses the same
import, adding none.

```ts
# SOURCE: test/task-list-contract.test.ts:29-34
/** A local calendar day `offset` days from the server's today, as YYYY-MM-DD. */
function dayOffset(offset: number): string {
  const today = todayIn(new Date(), PRAESTO_TIMEZONE);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}
```

The date discipline the new suite inherits (PRD AC-1 names it explicitly): the
route reads the wall clock, so a fixture date must be derived from the server's
own today or the assertion decays into meaninglessness.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/worker/routes/tasks.ts` | UPDATE | The list handler gains three validated parameters and the composed `WHERE`; no other handler is touched |
| `docs/api-reference.md` | UPDATE | The derived contract document must stop calling the vocabulary "reserved" and state the implemented semantics — it is what the PWA and every later unit code against |
| `documentation/30-architecture/architecture-overview.md` | UPDATE | Its frozen-contract section says "the filter vocabulary reserved for unit 3" (line 119); after this phase that sentence is stale, and `documentation/` is the authoritative source that `docs/` derives from |

## NOT Building (Scope Limits)

- **Grouping of any kind.** The today/overdue/upcoming/undated buckets are a client-side partition (PRD Decisions Log); no `group` parameter, no grouped payload, no per-group counts on the wire.
- **Any client change.** `src/app/api.ts` keeps its `listTasks(status?, limit?)` signature until phase 3 needs the filter object; no component is touched.
- **A cursor, or any paging change.** `limit` keeps its behaviour, its 500 cap and its reject-don't-clamp rule; the revisit trigger of the frozen contract is untouched.
- **Text search** (FR-040, unit 8) and **Life Area filters** (FR-008, unit 13) — neither name enters the vocabulary here.
- **Sorting parameters.** The order is the frozen contract's; this phase adds no way to change it.
- **Test files.** Under `tdd: true` the suite for AC-1 through AC-6 is authored by the `test-writer`/`test-reviewer` pair before the Implementer runs; no task below edits or creates a test file.

## Step-by-Step Tasks

### Task 1: UPDATE `src/worker/routes/tasks.ts` (list handler only)

- **ACTION**: Change only the `taskRoutes.get("/")` handler; touch no other
  handler and add no import (`and`, `desc`, `eq`, `sql` are already imported on
  line 1, and `isCalendarDate` / `isTaskPriority` are already imported from
  `../../shared/api`). Keep the existing `status` and `limit` blocks, the
  `{ tasks: rows.map(toTaskDto) }` envelope, and the
  `.orderBy(urgencyBucket, dueDate, desc(tasks.createdAt)).limit(limit)` tail
  exactly as they are.
  **(a) Boundary validation**, added directly after the existing `limit` block
  and before `const today = ...`: read `const from = c.req.query("from")` and
  reject with `return c.json({ error: "from must be a calendar date (YYYY-MM-DD)" }, 400)`
  when it is defined and `!isCalendarDate(from)`; read
  `const to = c.req.query("to")` and reject symmetrically with
  `"to must be a calendar date (YYYY-MM-DD)"`; read
  `const priority = c.req.query("priority")` and reject with
  `` return c.json({ error: `Unknown priority: ${priority}` }, 400) `` when it is
  defined and `!isTaskPriority(priority)`. An absent parameter is never a
  filter — only `undefined` is skipped, never an empty string coerced to
  "no filter".
  **(b) Composed `WHERE`**, built after `dueDate` exists (it is the fragment the
  date clauses compare against) and before the `db.select()` chain: assemble an
  array of the clauses that apply — the existing `eq(tasks.status, status)` when
  `status` is defined; `` sql`${dueDate} >= ${from}` `` when `from` is defined;
  `` sql`${dueDate} <= ${to}` `` when `to` is defined; and for `priority`, the
  single branch the domain rule requires —
  `` sql`(${tasks.priority} = 'normal' or ${tasks.priority} is null)` `` when the
  value is exactly `normal`, and `eq(tasks.priority, priority)` otherwise —
  then drop the inapplicable entries. Pass `undefined` to `.where()` when the
  array is empty (preserving today's no-filter query byte-for-byte) and
  `and(...clauses)` otherwise. Bind every value through the `sql` template's
  `${}` interpolation so Drizzle parameterizes it; never build a SQL string by
  concatenation.
  **(c) Document the two decided semantics in a comment** on the handler, in the
  register the file already uses: that a date range compares against
  `coalesce(deadline, scheduled_date)`, so a Task with no date is never inside
  one — a `NULL` comparison is never true, and that is the wanted behaviour, not
  an accident; and that `priority=normal` also matches `NULL` because an unset
  priority means "not set" and sorts as normal (`docs/domain/areas/tasks.md`), so
  a plain equality would hide most of the real table. An inverted range
  (`from` after `to`) needs no branch at all: the two clauses simply select
  nothing, which is the right answer to a well-formed request describing an
  empty interval.
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:42-57` (the reject-at-the-boundary
  shape), `# SOURCE: src/worker/routes/tasks.ts:59-74` (the `dueDate` fragment and
  the untouched order/limit tail), `# SOURCE: src/worker/routes/tasks.ts:88-93`
  (the calendar-date message shape) and `# SOURCE: src/worker/routes/tasks.ts:233`
  (the `and(...)` composition already used in this file).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'from must be a calendar date (YYYY-MM-DD)' src/worker/routes/tasks.ts
  grep -q 'to must be a calendar date (YYYY-MM-DD)' src/worker/routes/tasks.ts
  grep -q 'Unknown priority' src/worker/routes/tasks.ts
  grep -q 'is null' src/worker/routes/tasks.ts
  if ! grep -q 'orderBy(urgencyBucket, dueDate, desc(tasks.createdAt))' src/worker/routes/tasks.ts; then
    echo "FAIL: the frozen ordering tail was altered"; exit 1
  fi
  npx tsc -b
  npx vitest run --project worker
  ```
- Delivers AC-A1, AC-A2, AC-A3, AC-A4.

### Task 2: UPDATE `docs/api-reference.md`

- **ACTION**: Move the three names from reserved to implemented, in two places.
  In the **Implemented** table, replace the list row's route cell
  `` `/api/tasks?status=open\|done\|missed&limit=N` `` with one that also names
  `from`, `to` and `priority`, and extend its behaviour cell with the decided
  semantics: `from`/`to` are inclusive and compare against
  `coalesce(deadline, scheduledDate)`, so undated Tasks fall outside any range;
  an inverted range returns an empty list with `200`; `priority=normal` also
  matches an unset priority; an invalid date or an unknown priority is `400`.
  In the **Filter vocabulary** paragraph of the frozen read contract, replace
  the sentence that begins "Unit 3 will add `from`, `to` and `priority`" with
  one stating that unit 3 **added** them, dated 2026-08-23, and keep the
  surrounding rule intact — adding a filter is backward-compatible, renaming one
  is not. Leave the **Order**, **Paging** and **Deliberately not on the wire**
  paragraphs untouched: this phase changes what can be asked, never what is
  returned or in what order. Do not touch the `## Not built yet` row for unit 3,
  which was already corrected on 2026-08-23 to record that grouping is not an
  API concern; the row stays until phases 2 and 3 close it.
- **MIRROR**: `# SOURCE: docs/api-reference.md:38-41` — the existing Filter
  vocabulary paragraph, whose sentence shape and rule wording the replacement
  keeps.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'priority=normal' docs/api-reference.md
  if grep -q 'Unit 3 will add' docs/api-reference.md; then
    echo "FAIL: the contract doc still calls the vocabulary reserved"; exit 1
  fi
  grep -q 'must not be re-derived in a client' docs/api-reference.md
  npx vitest run --project docs
  ```
- Delivers AC-A5.

### Task 3: UPDATE `documentation/30-architecture/architecture-overview.md`

- **ACTION**: In the section "The Task read contract is frozen (2026-08-15, unit
  2)", the closing sentence reads "The full contract — the ordering key, the
  filter vocabulary reserved for unit 3, and the paging revisit trigger — is
  recorded in `docs/api-reference.md`" (line 119). Replace "the filter
  vocabulary reserved for unit 3" with wording that records the vocabulary as
  implemented by unit 3 on 2026-08-23, so the authoritative document and its
  derived copy agree. Change nothing else in that section — the three
  load-bearing commitments (ordering produced by the API, `limit`-only paging,
  adding a field stays backward-compatible) are unaffected by this phase and
  must not be re-worded. Set the file's frontmatter `last_updated` to
  `2026-08-23`.
- **MIRROR**: `# SOURCE: documentation/30-architecture/architecture-overview.md:102-121`
  — the frozen-contract section whose register and structure the edit preserves.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  if grep -q 'filter vocabulary reserved for unit 3' documentation/30-architecture/architecture-overview.md; then
    echo "FAIL: the architecture overview still calls the vocabulary reserved"; exit 1
  fi
  grep -q 'last_updated: 2026-08-23' documentation/30-architecture/architecture-overview.md
  npx vitest run --project docs
  ```
- Delivers AC-A5.

### Task 4: RUN the full gate

- **ACTION**: Run the whole suite and the check gate from a clean working tree,
  and read two things rather than only the exit codes. First, that
  `test/task-list-contract.test.ts` passes **with no edit to that file** — its 20
  tests are the evidence that the no-filter contract did not move, and an edit
  there would destroy exactly the evidence the phase exists to produce. Second,
  that the total test count went UP relative to the 313 of 2026-08-23 (the test
  pair's new filter suite), never down. Do not modify any test file to make this
  pass; a failure here is a defect in the production code or a genuine contract
  question for the owner, not a reason to touch the suite.
- **MIRROR**: `# SOURCE: test/task-list-contract.test.ts:1-11` — the file header
  stating that this suite exists to pin the boundary, which is why it is run
  unedited.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  git diff --quiet -- test/task-list-contract.test.ts
  npm test
  npm run check
  ```
- Delivers AC-A4, AC-A6.

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

`npm run check` is `wrangler types --check && tsc -b && eslint . && prettier --check .`
(`package.json`). Each stage exits non-zero on failure and `&&` propagates.

**Level 2 — UNIT/INTEGRATION TESTS**

```bash
set -euo pipefail
npx vitest run --project worker
npx vitest run --project docs
```

`vitest run` exits non-zero when any test fails — no output parsing, no guessed
reporter format.

**Level 3 — FRESH-DATABASE END-TO-END**

```bash
set -euo pipefail
npm run db:migrate
npm test
git diff --quiet -- test/task-list-contract.test.ts
if ! grep -q 'orderBy(urgencyBucket, dueDate, desc(tasks.createdAt))' src/worker/routes/tasks.ts; then
  echo "FAIL: the frozen ordering tail was altered"; exit 1
fi
```

The last two checks are the structural half of AC-A4: the ordering tail this
phase promised not to touch is still there, and the contract suite that proves
the no-filter behaviour is unchanged was itself not edited to get green. The
behavioural halves are asserted by the suite.

## Acceptance Criteria

- **AC-A1 (PRD AC-1, PRD AC-2, PRD AC-3):** `from` and `to` filter inclusively against `coalesce(deadline, scheduled_date)`; a Task with neither date is absent from any range; the two compose into a closed interval; and an inverted range (`from` after `to`) answers `200` with an empty list rather than an error.
- **AC-A2 (PRD AC-4):** `from` or `to` carrying a malformed or impossible calendar date (`2026-8-1`, `2026-02-31`, `ontem`) answers `400` with a message naming that parameter, through `isCalendarDate` — never a `500`, never silently ignored.
- **AC-A3 (PRD AC-5):** `priority=high|low` matches only that value; `priority=normal` matches rows whose priority is `normal` **and** rows whose priority is `NULL`; `priority=urgent` answers `400` with `Unknown priority: urgent`.
- **AC-A4 (PRD AC-6):** the new clauses sit in the `WHERE`, so a filtered request is ordered by the frozen urgency key and only then truncated by `limit` — `?status=open&priority=high&to=<today>&limit=2` returns the first two of the ordered filtered set; and a request carrying no filter parameter returns exactly what it returns today, proved by `test/task-list-contract.test.ts` passing unedited.
- **AC-A5 (PRD AC-6):** `docs/api-reference.md` and `documentation/30-architecture/architecture-overview.md` record the vocabulary as implemented, with the inclusive-range, undated-excluded and `normal`-matches-`NULL` semantics written down, so the contract document and the code cannot disagree about what the API accepts.
- **AC-A6 (PRD AC-17):** `npm test` and `npm run check` are green at the end of the phase, with the test count at or above the 313 of 2026-08-23 and no test file weakened, skipped or deleted.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `from`/`to` silently dropping undated Tasks surprises a later consumer | M | M | The exclusion is stated in the handler comment, in `docs/api-reference.md`, and asserted by AC-A1 — it is a decided property of the expression, not an inherited SQL accident |
| `priority=normal` implemented as a plain equality, hiding every unset row | M | H | Called out in Task 1(b) with the exact clause, given its own criterion (AC-A3) and its own `grep -q 'is null'` in Task 1's VALIDATE |
| The composed `where` accidentally changes the no-filter query | L | H | The empty-clause case passes `undefined` to `.where()` exactly as today, and the 20 unedited contract tests are the check; Level 3 additionally fails if that file was modified |
| Ordering or `limit` disturbed while editing the same chain | L | H | The `.orderBy(...).limit(...)` tail is asserted verbatim by a `grep` in both Task 1 and Level 3 |
| A future filter is added by string concatenation, opening injection | L | H | Every value is bound through the `sql` template's `${}`; Task 1 states it, and the reviewer sees the diff |

## Notes

**TDD routing (this plan):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **No task edits a test file, deliberately.** Under `tdd: true` the pair
  authors the suite for AC-A1 through AC-A4 before the Implementer runs, and the
  code-reviewer's R-X guard forbids the Implementer from touching test files.
  Task 4 only *runs* the suite, and `git diff --quiet -- test/task-list-contract.test.ts`
  makes "the contract suite was not edited" a machine-checked claim rather than
  a promise.
- **Why the dates in the new suite must be relative.** This route reads the wall
  clock (`todayIn(new Date())`), so a hardcoded fixture date stops testing the
  boundary the moment the calendar passes it. PRD AC-1 states the rule and
  `test/task-list-contract.test.ts:29-34` already carries the `dayOffset()`
  helper the new suite should reuse. The opposite holds for phase 2's
  `groupTasks`, which takes `today` as an argument: a fixed date there is
  deterministic by construction and must NOT be made relative.
- **Why `coalesce` is safe as a filter key.** `tasks_single_date_chk` guarantees
  at most one of `deadline` and `scheduledDate` is ever set, so the coalesce is
  unambiguous — the same reasoning that made it the ordering key in unit 2.
- **Grouping is explicitly not here.** The PRD's Decisions Log records that
  grouping is a client-side stable partition, and `docs/api-reference.md`'s
  "Not built yet" row for unit 3 was corrected on 2026-08-23 to say so. A future
  reader looking for grouping in the API should find that sentence, not an
  unimplemented parameter.
- **This is an additive contract change.** No field is renamed, removed or
  retyped and no route is added — the asymmetry the freeze protects
  (`docs/api-reference.md`) is respected, which is why no ADR is required for it.

*Generated: 2026-08-23*
*Approved: 2026-08-23*
*Implemented: 2026-08-23*
*Status: IMPLEMENTED*
