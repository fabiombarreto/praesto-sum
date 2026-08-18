# Feature: Frozen read contract (Phase 3 of task-detail-and-dates)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: freezes the Task READ contract that eleven downstream
  units inherit; changes the default order of an existing route; introduces
  the project's first date-reasoning module in `src/shared`; repairs a
  visibility regression phase 2 made live
- Decisions found:
  - Roadmap, "Notes on five positions" — unit 2 is the contract-freeze point;
    its PRD designs the final shape (fields, filters, paging), not just what
    one screen needs
  - Owner, 2026-08-12 (PRD Decisions Log) — list ordering is overdue, today,
    future ascending, undated last, computed by the API; paging is `limit`
    accepted and honoured now, cursor added later additively
  - ADR-0003 (2026-08-03) — one canonical copy in D1; the API is the only
    place a shared guarantee can live for every client
  - ADR-0006 (2026-08-03) — `detached` marks an occurrence the owner edited
    individually; it does not unlink the occurrence and must not hide it
  - ADR-0008 (2026-08-04) — test-first (`tdd: true`)
  - `docs/context/methodology.md` — pure domain logic in `src/shared`
    (recurrence expansion, dates, timezone/DST) is squarely on the automated
    side and is where date reasoning belongs
- Applicable anti-patterns:
  - Glossary synonym drift (`docs/anti-patterns.md:112-117`) — "deadline" and
    "scheduled date" stay distinct; the ordering key is their coalesce, never
    a renamed third concept
  - Hand-duplicated entity types (`docs/anti-patterns.md:91-96`)
  - Weakening tests to force green (`docs/anti-patterns.md:119-124`)
  - Portuguese in artifacts (`docs/anti-patterns.md:105-110`)
- Applicable architectural rules:
  - `src/shared/` compiles into BOTH the browser and Worker targets, so it
    carries no DOM or Worker globals and no runtime dependencies
    (`src/shared/api.ts:1-13`)
  - Ordering is computed by the API — sorting in the client would put the
    frozen contract's most load-bearing guarantee in the one place unit 3,
    unit 8 and the export cannot reuse
  - Ordering must be applied IN the SQL query, not after it: `?limit=N` must
    return the first N *of the ordered set*, which a post-query sort cannot
    guarantee
  - No route is removed or renamed (PRD AC-7)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/task-detail-and-dates.prd.md` — Implementation Phases row 3:
  "Frozen read contract" — Goal: urgency ordering produced by the API, plus the
  documented filter and paging shape the later units inherit — Success signal
  (PRD Phase Details): ordering is overdue, then today, then future ascending,
  then undated, covering AC-6; and the phase writes down the parts of the
  contract it does *not* implement — the filter vocabulary unit 3 will use and
  the paging decision — because the roadmap makes this PRD responsible for the
  final shape, and a shape recorded only in a future PRD is not frozen.

## Summary

This phase freezes the shape eleven downstream units will read Tasks through.
Three things land. First, the list comes back in urgency order — overdue, then
today, then future by date ascending, then undated last — computed in SQL so
that `?limit=N` returns the first N *of the ordered set* rather than the first N
of an arbitrary set that is then sorted. Second, `?limit=N` is accepted and
honoured, which is what makes adding a cursor later additive instead of a
reshape. Third, the contract this phase does *not* implement is written down —
the filter vocabulary unit 3 will speak and the recorded paging decision —
because a shape that exists only in a future PRD is not frozen. A fourth,
unplanned item is repaired here because this is the first phase that can: the
list currently excludes `detached` rows, which was inert until phase 2 started
writing that flag and now silently hides any recurring Task the owner corrects.

## User Story

```
As the owner
I want the list to answer "what is urgent" before I read a single row
So that the Tasks I have already dated earn their keep, instead of being buried
under whatever I captured most recently
```

## Problem Statement

The read contract is one filter wide and carries no ordering guarantee.
`listTasks` accepts `?status=` and nothing else (`src/app/api.ts`), the route
sorts by `createdAt` descending with a hard `limit(500)`
(`src/worker/routes/tasks.ts:23-45`), and `TaskDto` promises no order at all.
Units 3, 5, 8, 9, 10, 11, 13, 14 and 20 all read Tasks; whatever shape this unit
leaves behind is the shape they inherit, and changing it later means changing
every one of them at once. Meanwhile the dates unit 2 just made editable are
invisible in the list's ordering, so a Task dated for today sits below one
captured a minute ago.

There is also a live defect. The list's `where` clause excludes rows whose
`detached` flag is true. Nothing ever set that flag until phase 2 shipped
`PATCH`; now, correcting any attribute of a recurrence occurrence removes it
from the list entirely — the opposite of what ADR-0006 means by detaching, which
severs *propagation from the series*, never the Task from the owner's view.

## Solution Statement

Compute "today" once per request from a single named timezone constant in a new
pure `src/shared/dates.ts`, and order in SQL with a `CASE` over
`COALESCE(deadline, scheduled_date)`: bucket 0 overdue, 1 today, 2 future, 3
undated; then that coalesced date ascending; then `createdAt` descending as a
stable tiebreak. Accept `?limit=N`, validating it as a positive integer no
greater than the existing 500 ceiling and rejecting anything else with 400, so
the field that lets paging arrive later is real rather than merely declared.
Drop the `detached` exclusion from the list's `where` clause, restoring the
visibility ADR-0006 never intended to remove. Then write the frozen contract
down — ordering, the filter vocabulary unit 3 will add, and the recorded reason
there is no cursor — in `docs/api-reference.md`, with the architectural
commitment recorded in `documentation/30-architecture/architecture-overview.md`.

## Metadata

| Key | Value |
|---|---|
| Type | API read contract + pure date module |
| Complexity | Medium — the SQL is small; the freeze is the deliverable |
| Systems Affected | Task list route, `src/shared` (new dates module), wire contract, typed SPA client, authoritative + derived docs |
| Dependencies | Phase 1 (`complete`). Phase 2 is not a prerequisite for the ordering, but its `detached` writes are what make this phase's list-filter repair necessary |
| Estimated Tasks | 6 |
| Source PRD line ref | `PRPs/prds/task-detail-and-dates.prd.md:313` (Implementation Phases row 3); Phase Details at `:333-337` |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/task-detail-and-dates.prd.md` | 172-188, 292-296, 333-337, 345-355 | AC-6 and AC-10 verbatim, the "ordering is computed by the API" note, the phase's own scope, and the Decisions Log rows for ordering and paging |
| P0 | `src/worker/routes/tasks.ts` | 23-45 | The list route this phase rewrites — its status filter, its `detached` exclusion, its `orderBy` and its 500 ceiling |
| P0 | `src/shared/api.ts` | 1-13, 24-40, 102-107 | Why `src/shared` carries no runtime dependencies, and the `TaskDto` fields the ordering key is built from |
| P0 | `src/worker/db/schema.ts` | 154-160, 195-207 | `deadline` and `scheduledDate` as local calendar days, the indexes on both, and `tasks_single_date_chk` — which is why coalescing them is unambiguous |
| P1 | `documentation/60-decisions/ADR-0006-recurrence-model.md` | 1-45 | What `detached` means — propagation, not visibility — which is the basis for removing it from the list filter |
| P1 | `src/app/api.ts` | 81-95 | The typed client's `listTasks`, which gains the `limit` argument |
| P1 | `docs/api-reference.md` | 1-25 | The contract document this phase's freeze is written into |
| P2 | `test/tasks.test.ts` | 24-50 | The list helper the existing suite uses, whose containment assertions must keep passing under the new order |

## Patterns to Mirror

```ts
# SOURCE: src/worker/routes/tasks.ts:24-45
taskRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  if (status !== undefined && !isTaskStatus(status)) {
    return c.json({ error: `Unknown status: ${status}` }, 400);
  }

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        status === undefined ? undefined : eq(tasks.status, status),
        // One-off Tasks and materialized occurrences only — never a template.
        or(isNull(tasks.seriesId), eq(tasks.detached, false)),
      ),
    )
    .orderBy(desc(tasks.createdAt))
    .limit(500);

  return c.json({ tasks: rows.map(toTaskDto) });
});
```

The handler this phase rewrites in place. Two things are preserved verbatim —
the unknown-status 400 and the `{ tasks: ... }` envelope — and two change: the
`orderBy` becomes the urgency expression, and the `or(...)` clause loses its
`detached` exclusion. Note the comment's stated intent ("never a template") does
not describe what the clause does: templates live in `recurrence_series`, not in
`tasks`, so the clause only ever excluded detached occurrences. Rewritten by
Task 3.

```ts
# SOURCE: src/worker/routes/tasks.ts:26-28
  if (status !== undefined && !isTaskStatus(status)) {
    return c.json({ error: `Unknown status: ${status}` }, 400);
  }
```

The reject-bad-query-parameter shape, copied for `?limit=`: validate, 400 with a
message naming the offending value, nothing else happens. Copied by Task 3.

```ts
# SOURCE: src/shared/api.ts:102-107
/** `YYYY-MM-DD`, and a real date on the calendar (rejects 2026-02-31). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
```

The shape of a pure, dependency-free date helper in `src/shared`: a narrow
signature, no globals beyond the language's own, and a doc comment stating the
exact contract. `todayIn` in the new `src/shared/dates.ts` is written in this
idiom. Mirrored by Task 1.

```ts
# SOURCE: src/worker/db/schema.ts:195-201
    index("tasks_status_idx").on(t.status),
    index("tasks_deadline_idx").on(t.deadline),
    index("tasks_scheduled_date_idx").on(t.scheduledDate),
    index("tasks_life_area_idx").on(t.lifeAreaId),

    check("tasks_title_not_empty", sql`length(trim(${t.title})) > 0`),
    check("tasks_status_chk", sql`${t.status} in ('open','done','missed')`),
```

Both date columns are already indexed, and `tasks_single_date_chk` (two lines
below) guarantees at most one of them is non-null — which is what makes
`COALESCE(deadline, scheduled_date)` an unambiguous single ordering key rather
than a lossy merge of two competing values. Referenced (not edited) by Task 3.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/dates.ts` | CREATE | The project's first date-reasoning module: the timezone constant and a pure `todayIn`, placed where `methodology.md` says date logic belongs and where both compile targets can reach it |
| `src/shared/api.ts` | UPDATE | Add `MAX_TASK_LIMIT` so the client and the Worker share one ceiling instead of two literals |
| `src/worker/routes/tasks.ts` | UPDATE | Urgency ordering in SQL, `?limit=N` validation, and removal of the `detached` exclusion from the list filter |
| `src/app/api.ts` | UPDATE | `listTasks` gains the optional `limit` argument so the frozen query shape is reachable from the SPA |
| `docs/api-reference.md` | UPDATE | Record the frozen read contract: the ordering guarantee, the filter vocabulary unit 3 will add, and the paging decision with its revisit trigger |
| `documentation/30-architecture/architecture-overview.md` | UPDATE | The freeze is a cross-cutting architectural commitment, and the maintenance map routes data/component contract changes here |

## NOT Building (Scope Limits)

- **The filter UI and the today view.** FR-007 is unit 3. This phase freezes the
  vocabulary those filters will speak and implements the ordering; it builds no
  filter beyond the `status` one that already exists.
- **A cursor.** Recorded decision: one user with a few hundred Tasks has no
  volume problem, and a cursor nobody exercises is a contract nobody has tested.
  `limit` is accepted now so adding a cursor later is additive. The revisit
  trigger — the first list response over ~500 Tasks or 100 KB — is written into
  the frozen contract rather than left in the PRD.
- **Filtering by priority or by date range.** Named in the frozen vocabulary for
  unit 3; not implemented here.
- **The detail screen and inline title edit.** Phase 4 (AC-8).
- **Recurrence machinery.** Unit 9. This phase stops hiding detached
  occurrences; it spawns and sweeps nothing.
- **Per-request or per-user timezone.** One owner, one zone (CON-002). The
  constant is named and exported so a future Life Area or Event feature can
  parameterise it without a hunt.
- **Authoring or editing test files.** Under `tdd: true` the suite for this
  phase is authored by the `test-writer`/`test-reviewer` pair before the
  Implementer runs, and R-X strict forbids the Implementer from touching a test
  file. No task here edits `test/`; Task 5 only *runs* the suite.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/dates.ts`

- **ACTION**: Create the module with two exports and no imports. First, the
  timezone constant, declared exactly
  `export const PRAESTO_TIMEZONE = "America/Sao_Paulo";` — the same IANA zone
  `recurrence_series.timezone` already defaults to (`src/worker/db/schema.ts:69`),
  named here so the two cannot drift. Second, a pure function declared exactly
  `export function todayIn(now: Date, timeZone: string = PRAESTO_TIMEZONE): string`
  that returns the local calendar day at `now` in `timeZone` as `YYYY-MM-DD`,
  implemented with `Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)`
  — the `en-CA` locale renders ISO-ordered `YYYY-MM-DD`, so no string surgery is
  needed. Document in a doc comment that a Task's `deadline` and `scheduledDate`
  are LOCAL calendar days, not instants, which is why the comparison that
  decides "overdue" must be made against a local day rather than against a UTC
  timestamp. Import nothing — this file compiles into both targets.
- **MIRROR**: `# SOURCE: src/shared/api.ts:102-107` (the pure, dependency-free
  date-helper idiom).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export const PRAESTO_TIMEZONE = "America/Sao_Paulo";' src/shared/dates.ts
  grep -q 'export function todayIn' src/shared/dates.ts
  if grep -q '^import ' src/shared/dates.ts; then
    echo "FAIL: src/shared/dates.ts must carry no imports"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A1 (the "today" boundary the ordering depends on).

### Task 2: UPDATE `src/shared/api.ts`

- **ACTION**: Add the shared ceiling as the line
  `export const MAX_TASK_LIMIT = 500;`, documenting that it is the hard cap the
  list route enforces whether or not `?limit=` is supplied, and that it is the
  number the paging revisit trigger is expressed against. Do not change any
  existing export. Import nothing.
- **MIRROR**: `# SOURCE: src/shared/api.ts:102-107` — the same file's convention
  of exporting a small, documented constant or helper rather than repeating a
  literal at each call site.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export const MAX_TASK_LIMIT = 500;' src/shared/api.ts
  npx tsc -b
  ```
- Delivers AC-A3.

### Task 3: UPDATE `src/worker/routes/tasks.ts` (list route)

- **ACTION**: Rewrite only the `taskRoutes.get("/")` handler; touch no other
  handler. Keep the unknown-status 400 and the `{ tasks: ... }` envelope exactly
  as they are. Add `?limit=` handling in the same shape: when the parameter is
  present, it must parse as a base-10 integer that is at least 1 and at most
  `MAX_TASK_LIMIT`, otherwise return
  `c.json({ error: \`Invalid limit: ${raw}\` }, 400)` — reject `0`, negatives,
  non-numeric strings, and values above the ceiling rather than clamping them,
  so a caller never believes it received a full page when it did not. The
  effective limit is the supplied value, or `MAX_TASK_LIMIT` when absent. Remove
  the `or(isNull(tasks.seriesId), eq(tasks.detached, false))` clause from the
  `where` entirely: `detached` governs whether a later series edit propagates
  (ADR-0006), never whether the owner can see the Task, and leaving it would
  make every occurrence corrected by phase 2's `PATCH` vanish from the list. The
  `status` filter is unchanged. Replace `.orderBy(desc(tasks.createdAt))` with
  the urgency expression, computing `const today = todayIn(new Date());` once
  per request and ordering by, in this order: a `CASE` over
  `coalesce(deadline, scheduled_date)` yielding `0` when it is `< today`, `1`
  when `= today`, `2` when `> today` and `3` when it is `NULL`; then
  `coalesce(deadline, scheduled_date)` ascending; then `created_at` descending
  as a stable tiebreak. Build these with Drizzle's `sql` template so the
  ordering runs IN the query — sorting after `.limit()` would return the first N
  of an unordered set, which is precisely what AC-10 forbids. Bind `today` as a
  parameter; never interpolate it into the SQL string.
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:24-45` (the handler being
  rewritten), `# SOURCE: src/worker/routes/tasks.ts:26-28` (the
  reject-bad-query-parameter shape), `# SOURCE: src/worker/db/schema.ts:195-201`
  (the indexed date columns and the XOR CHECK that make the coalesce
  unambiguous).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'todayIn' src/worker/routes/tasks.ts
  grep -q 'Invalid limit' src/worker/routes/tasks.ts
  if grep -q 'eq(tasks.detached, false)' src/worker/routes/tasks.ts; then
    echo "FAIL: the list route still hides detached occurrences"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A1, AC-A2, AC-A3, AC-A4, AC-A6.

### Task 4: UPDATE `src/app/api.ts`

- **ACTION**: Change `listTasks` to accept an optional second argument,
  declared exactly
  `export async function listTasks(status?: TaskStatus, limit?: number): Promise<TaskDto[]>`,
  appending `limit` to the query string only when it is supplied, alongside the
  existing `status` parameter. Existing call sites pass one argument and keep
  working unchanged. Do not sort the returned array — the order is the API's
  guarantee, and re-sorting client-side is the exact failure the PRD's
  "computed by the API" note exists to prevent; state that in a short comment.
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:24-45` — the `{ tasks: ... }`
  envelope and the `status`/`limit` query parameters this client call mirrors.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export async function listTasks(status?: TaskStatus, limit?: number): Promise<TaskDto\[\]>' src/app/api.ts
  npm run check
  ```
- Delivers AC-A5.

### Task 5: RUN the suites against the frozen contract

- **ACTION**: Run the full test suite. The `worker` project rebuilds an
  ephemeral D1 from `migrations/` on every run, so phases 1, 2 and 3 are
  exercised together. Confirm the test-first suite for this phase passes, and
  that every pre-existing assertion in `test/tasks.test.ts`,
  `test/task-priority.test.ts` and `test/task-update.test.ts` still passes
  untouched. Pay particular attention to the existing list assertions: they
  check containment rather than position, so the new default order must not
  break them — if one fails, the cause is a regression in the route to fix,
  never a test to weaken (`docs/anti-patterns.md:119-124`).
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:24-45` — the handler whose
  rewrite this run verifies against both the new ordering assertions and the
  existing containment ones.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  npm run db:migrate
  npx vitest run --project worker
  ```
- Delivers AC-A7 (verification of AC-A1 through AC-A6).

### Task 6: UPDATE the frozen-contract documentation

- **ACTION**: In `docs/api-reference.md`, add a `## Task read contract (frozen at unit 2)`
  section recording four things: (a) the ordering guarantee, written as the
  sentence `Order: overdue first, then today, then future by date ascending, then undated last.`
  byte-for-byte, noting the key is `COALESCE(deadline, scheduledDate)` and the
  tiebreak is `createdAt` descending; (b) the filter vocabulary — `status`
  implemented now, and the names unit 3 will add (`from`, `to`, `priority`)
  reserved here so unit 3 does not invent competing ones; (c) the paging
  decision — no cursor, `limit` accepted and honoured, capped at
  `MAX_TASK_LIMIT`, with the revisit trigger stated as the first list response
  over ~500 Tasks or over 100 KB; (d) what is deliberately NOT on the wire —
  `updatedAt` and `detached` — and the asymmetry that makes the freeze
  meaningful: adding a field later is backward-compatible, renaming or removing
  one is not. In
  `documentation/30-architecture/architecture-overview.md`, record the same
  commitment in one short subsection pointing at `docs/api-reference.md` for the
  detail, and set `last_updated` on it per the documentation guidelines,
  mirroring the date in the status panel of `documentation/README.md`.
- **MIRROR**: `# SOURCE: src/worker/db/schema.ts:195-201` — the indexes and the
  XOR CHECK the documented ordering key rests on.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'Order: overdue first, then today, then future by date ascending, then undated last.' docs/api-reference.md
  grep -q 'Task read contract (frozen at unit 2)' docs/api-reference.md
  npx vitest run --project docs
  ```
- Delivers no AC directly — this is infrastructure / scaffolding work
  (authoritative and derived documentation). It is nonetheless the phase's
  named deliverable per the PRD Phase Details: "a shape recorded only in a
  future PRD is not frozen".

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
if grep -q 'eq(tasks.detached, false)' src/worker/routes/tasks.ts; then
  echo "FAIL: the list route still hides detached occurrences"; exit 1
fi
grep -q 'todayIn' src/worker/routes/tasks.ts
```

The last two checks are the structural half of AC-A2 and AC-A6: the ordering
must be derived from a server-computed "today", and the visibility repair must
not silently regress. The behavioural halves are asserted by the suite.

## Acceptance Criteria

- **AC-A1 (PRD AC-6):** given Tasks with mixed dates, the list returns them
  overdue first, then today, then future by date ascending, then undated last.
  A Task's ordering date is its `deadline` or its `scheduledDate`, whichever is
  set.
- **AC-A2 (PRD AC-6):** the order is produced by the API. The response arrives
  already ordered, and `src/app/api.ts` does not re-sort it.
- **AC-A3 (PRD AC-10):** `?limit=N` returns at most N Tasks, and they are the
  first N in the AC-A1 order — not the first N of an unordered set.
- **AC-A4 (PRD AC-10):** a `limit` that is not a positive integer at most
  `MAX_TASK_LIMIT` — `0`, a negative, a non-numeric string, or `501` — is
  rejected with 400 rather than clamped, so a caller never mistakes a partial
  page for a full one.
- **AC-A5 (PRD AC-10):** `listTasks(status?, limit?)` reaches the frozen query
  shape from the SPA, and existing single-argument call sites are unaffected.
- **AC-A6 (PRD AC-6):** a Task whose `detached` flag is true still appears in
  the list. Detaching governs series propagation, not visibility, so a
  recurrence occurrence the owner corrects does not disappear.
- **AC-A7 (PRD AC-7):** the create, complete, reopen, delete and update routes
  keep their paths, behaviour and response bodies — every pre-existing assertion
  in the three existing Task suites passes without being edited.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The frozen contract turns out wrong and unit 3 needs to break it | Medium | High — eleven consumers inherit it | The freeze is deliberately narrow: ordering, field names and types, and the omitted-vs-null rule. It does not fix filter *names*, which unit 3 may still add. Task 6 records the reserved vocabulary so unit 3 extends rather than competes |
| Ordering is applied after `limit`, so `?limit=N` returns the wrong N | Medium | High — silently wrong data, and the exact failure AC-10 exists to catch | Task 3 requires the ordering to be built with Drizzle's `sql` template inside the query; AC-A3 asserts the identity of the returned rows, not merely their count |
| "Today" is computed in the wrong zone, so overdue is off by a day at the edges | Medium | Medium | `todayIn` is a pure function in `src/shared` with the zone named in one constant that matches the schema's existing default, and it is exercised directly by the suite rather than only through the route |
| Removing the `detached` clause exposes rows some future unit expects hidden | Low | Low | ADR-0006 defines `detached` as a propagation flag; nothing in the ADR or the schema ties it to visibility. AC-A6 pins the intended behaviour so a future change is a deliberate decision rather than a silent revert |
| The new default order breaks the SPA's or existing tests' assumptions | Medium | Low | The existing list assertions check containment, not position; Task 5 runs them unmodified, and a failure is treated as a route regression, never as a test to relax |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **This phase's test-file updates are routed through the
  `test-writer`/`test-reviewer` pair, not authored by the Implementer.** Under
  `tdd: true` the pair writes the suite for AC-A1 through AC-A7 before the
  Implementer runs, and R-X strict forbids the Implementer from touching any
  test file. Accordingly no task in `## Step-by-Step Tasks` edits a test file
  and no `## Files to Change` row names one — Task 5 only *runs* the suite.
- **The `detached` visibility repair is unplanned scope, taken deliberately.**
  The PRD does not mention it, because until phase 2 shipped nothing ever wrote
  the flag and the clause was inert. Phase 2 made it live, and phase 3 owns the
  list route, so this is both the first phase that *can* fix it and the last one
  before phase 4 puts the list in front of the owner. Shipping the freeze while
  knowing that a corrected recurring Task vanishes from it would be freezing a
  defect into the contract eleven units inherit. Recorded here, in `## Risks`,
  and as its own AC-A6 so the behaviour is pinned rather than incidental.
- **Why `COALESCE` is safe here.** `tasks_single_date_chk`
  (`src/worker/db/schema.ts:207`) guarantees at most one of `deadline` and
  `scheduled_date` is non-null, so the coalesce picks the only value present
  rather than silently preferring one of two competing dates. If that CHECK
  were ever relaxed, this ordering would need revisiting — which is why the
  dependency is stated in the plan rather than left in the reader's head.
- **`0` and `501` are rejected, not clamped.** Clamping is friendlier and
  wrong: a caller asking for 501 and receiving 500 has no way to know its
  request was altered, which is the same silent-mutation failure mode AC-9's
  reject-unknown-field rule exists to prevent on the write side.
- **Research grounding was performed inline by the main session**, not via the
  `research-codebase` / `research-web` subagents: this session carries an
  explicit instruction not to dispatch agents without the user asking — the same
  constraint recorded in unit 1's PRD and in this PRD's own Research Summary.
  Every `# SOURCE:` anchor is a real `file:line` read in this session against
  the phase-2 worktree state. `research-web` returned no findings (degradation
  reason: not dispatched).

*Generated: 2026-08-15*
*Approved: 2026-08-15*
*Implemented: 2026-08-15*
*Status: IMPLEMENTED*
