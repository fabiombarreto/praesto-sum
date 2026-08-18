# Feature: Task update route (Phase 2 of task-detail-and-dates)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: adds a route to the frozen Task wire contract; owns
  three domain rules the client must never own (omitted-vs-null, date
  exclusivity, occurrence detaching); honours an ADR-0006 invariant ahead of
  its consumer
- Decisions found:
  - ADR-0005 (2026-08-03) — types originate in `src/worker/db/schema.ts` and
    flow outward through `src/worker/dto.ts` to `src/shared/api.ts`
  - ADR-0003 (2026-08-03) — single canonical copy in D1; every `/api/*` route
    requires the bearer token; no offline-write or merge logic anywhere
  - ADR-0006 (2026-08-03) — `detached` marks an occurrence the owner edited
    individually, so a later series edit stops propagating to it. Editing is
    introduced HERE, so the rule is honoured here or unit 9 retrofits it over
    real data
  - ADR-0008 (2026-08-04) — test-first (`tdd: true`)
  - Owner, 2026-08-12 (PRD Decisions Log) — deadline vs scheduled date is an
    explicit choice, never inferred from a default; `updatedAt` and `detached`
    stay off the wire
  - PRD Open Question 2 (2026-08-12) — editing a `done` Task leaves it `done`;
    to be answered by real use, not decided now
- Applicable anti-patterns:
  - Hand-duplicated entity types (`docs/anti-patterns.md:91-96`) — the update
    input type is declared once in `src/shared/api.ts` and never mirrors a
    hand-written row shape; `src/worker/dto.ts` stays the single mapping point
  - Glossary synonym drift (`docs/anti-patterns.md:112-117`) — "deadline" and
    "scheduled date" are distinct canonical terms and are never conflated
  - Weakening tests to force green (`docs/anti-patterns.md:119-124`)
  - Offline write queue (`docs/anti-patterns.md:12-17`) — editing is online-only,
    like every other write
  - Portuguese in artifacts (`docs/anti-patterns.md:105-110`)
- Applicable architectural rules:
  - Invariants that protect the owner's data are constraints, not conventions —
    `tasks_single_date_chk` is the structural backstop, and the route resolves
    the conflict before the CHECK ever reports it
  - Domain enums are enforced twice — `isTaskPriority` + `tasks_priority_chk`,
    both shipped in phase 1 and reused here rather than re-implemented
  - `src/shared/` compiles into BOTH the browser and Worker targets, so it
    carries no runtime dependencies (`src/shared/api.ts:1-13`)
  - No existing route is removed, renamed, or altered (PRD AC-7)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/task-detail-and-dates.prd.md` — Implementation Phases row 2:
  "Task update route" — Goal: `PATCH /api/tasks/:id` with partial-update
  semantics, date exclusivity and the `detached` rule — Success signal (PRD
  Phase Details): covers AC-1, AC-2, AC-3, AC-5 and AC-9; the route owns three
  rules the client must never own — an omitted key is not a `null`, setting one
  date clears the other, and editing an occurrence detaches it — with AC-7 a
  standing obligation of the phase (the existing routes are not touched).

## Summary

This phase adds the one route that makes a captured Task correctable:
`PATCH /api/tasks/:id`. Its whole difficulty is semantic rather than
structural. A partial update must distinguish *"I did not mention this field"*
from *"I am clearing this field"* — a distinction TypeScript's optional
properties cannot express and `CreateTaskInput` actively contradicts, since its
optional fields already mean "absent". The route therefore reads the parsed JSON
object's own keys rather than a typed view of it, applying only the keys that
are present. Three domain rules live at this boundary and nowhere else: an
omitted key leaves the column alone while an explicit `null` clears it; setting
either date clears the other in the same statement so the CHECK never has to
report the conflict; and editing a Task that belongs to a recurrence series sets
`detached`, which costs one line now and saves unit 9 a retrofit over real data.
Everything outside a closed editable set is rejected with 400 rather than
silently dropped.

## User Story

```
As the owner
I want to change any attribute of a Task I already captured
So that a rough three-second capture becomes correct, instead of being deleted
and retyped
```

## Problem Statement

Praesto offers exactly three things to do with a captured Task — complete it,
reopen it, delete it. `src/worker/routes/tasks.ts` serves create, list,
complete, reopen and delete; there is no `PATCH`, so FR-002 ("edit any
attribute") is at 0%. The fields that make a Task actionable — `description`,
`deadline`, `scheduledDate`, and now `priority` — have been columns since the
2026-08-03 scaffold and are reachable by nothing after creation. A Task that
cannot be fixed is a Task the owner deletes and retypes, which is slower than
never having captured it, or leaves wrong, which quietly erodes trust in the
list.

## Solution Statement

One route, `PATCH /api/tasks/:id`, whose input type is declared separately from
`CreateTaskInput` precisely because the two mean different things by an absent
field. The handler validates the raw body's key set against a closed editable
set (`title`, `description`, `deadline`, `scheduledDate`, `priority`), rejecting
anything else with 400 — which covers AC-9's seven named non-editable fields and
any typo besides. Present keys are validated with the functions the create route
already uses (`isCalendarDate`, `isTaskPriority`), so the two write paths cannot
drift. Date exclusivity is resolved server-side: setting `deadline` writes
`scheduledDate: null` in the same statement and vice versa, so the Task never
holds both and the write never fails the CHECK. When the target row carries a
`seriesId`, the same statement sets `detached: true`. Every other route keeps
its path, behaviour and response bytes.

## Metadata

| Key | Value |
|---|---|
| Type | API route + wire-contract addition |
| Complexity | Medium — small surface, four interacting domain rules |
| Systems Affected | Task routes, wire contract (`src/shared/api.ts`), typed SPA client (`src/app/api.ts`) |
| Dependencies | Phase 1 (`complete`) — `isTaskPriority` and `tasks_priority_chk` are reused, not re-created |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/task-detail-and-dates.prd.md:312` (Implementation Phases row 2); Phase Details at `:327-331` |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/task-detail-and-dates.prd.md` | 156-188, 277-296, 327-331 | The five ACs this phase covers, the `PATCH`-semantics and date-exclusivity architecture notes, and the phase's own scope statement |
| P0 | `src/worker/routes/tasks.ts` | 1-131 | Every pattern this route mirrors — the 400 shapes, `readJson`, the `.returning()` idiom, and the five routes AC-7 forbids touching |
| P0 | `src/shared/api.ts` | 1-60 | The wire contract, why `CreateTaskInput`'s optional fields cannot express "clear this", and the validators reused here |
| P0 | `src/worker/db/schema.ts` | 144-216 | `tasks_single_date_chk`, `tasks_priority_chk`, `detached`, and the `$onUpdate` on `updatedAt` that makes the timestamp automatic |
| P1 | `documentation/60-decisions/ADR-0006-recurrence-model.md` | 1-40 | What `detached` means and why writing it now is insurance rather than scope creep |
| P1 | `src/app/api.ts` | 1-90 | The typed SPA client the detail screen (phase 4) will call; `updateTask` is added here so phase 4 adds no contract |
| P1 | `docs/context/testing.md` | 18-79 | The mandatory test guardrail and the two detected suites |
| P2 | `test/tasks.test.ts` | 1-107 | The suite idiom (`auth()`, `post()`, real workerd + ephemeral D1) the new tests follow |

## Patterns to Mirror

```ts
# SOURCE: src/worker/routes/tasks.ts:122-130
async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
```

The load-bearing helper for this phase: it already returns a
`Record<string, unknown>`, which is exactly the untyped key-set view the
omitted-vs-null distinction needs. The `PATCH` handler reads keys off this
record with `Object.hasOwn` rather than casting to a typed input. Reused by
Task 2.

```ts
# SOURCE: src/worker/routes/tasks.ts:57-68
  if (deadline !== null && !isCalendarDate(deadline)) {
    return c.json({ error: "deadline must be a calendar date (YYYY-MM-DD)" }, 400);
  }
  if (scheduledDate !== null && !isCalendarDate(scheduledDate)) {
    return c.json({ error: "scheduledDate must be a calendar date (YYYY-MM-DD)" }, 400);
  }
  // Domain rule (glossary, 2026-08-03): a Task carries a deadline OR a
  // scheduled date — never both. The DB enforces it too; this is the
  // human-readable half.
  if (deadline !== null && scheduledDate !== null) {
    return c.json({ error: "A Task carries either a deadline or a scheduled date" }, 400);
  }
```

The date-validation and both-dates-rejected shapes, copied verbatim in
behaviour so the create and update paths answer identically. Copied by Task 2.

```ts
# SOURCE: src/worker/routes/tasks.ts:70-75
  // Priority is a domain enum (FR-006). Reject at the boundary so the owner
  // meets a 400, not the CHECK constraint's 500. NULL stays "not set".
  const priority = input.priority ?? null;
  if (priority !== null && !isTaskPriority(priority)) {
    return c.json({ error: `Unknown priority: ${String(priority)}` }, 400);
  }
```

Phase 1's priority guard. The update route reuses `isTaskPriority` rather than
re-deriving the enum — one union, one CHECK, two call sites. Copied by Task 2.

```ts
# SOURCE: src/worker/routes/tasks.ts:96-108
taskRoutes.post("/:id/complete", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [row] = await db
    .update(tasks)
    .set({ status: "done", completedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
    .returning();

  if (row === undefined) return c.json({ error: "No open Task with that id" }, 404);
```

The update-and-return idiom: a single statement with `.returning()`, and an
undefined row meaning 404. `PATCH` mirrors this exactly, which is what makes
date exclusivity and `detached` a single write rather than a read-then-write.
Copied by Task 2.

```ts
# SOURCE: src/shared/api.ts:42-49
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: TaskPriority | null;
  lifeAreaId?: string | null;
}
```

The type this phase must NOT reuse. Its optional fields mean "absent" at
creation, where absent and cleared are the same thing; on an update they are
opposites. `UpdateTaskInput` is declared beside it with the same field types and
a documented difference in meaning. Mirrored (deliberately, not reused) by
Task 1.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/api.ts` | UPDATE | Add `UpdateTaskInput` and the `EDITABLE_TASK_FIELDS` closed set that AC-9's rejection is derived from, so the client and the Worker agree on what is editable |
| `src/worker/routes/tasks.ts` | UPDATE | Add the `PATCH /:id` handler; no existing handler is touched (AC-7) |
| `src/app/api.ts` | UPDATE | Add `updateTask(id, input)` to the typed client so phase 4's detail screen consumes a contract that already exists |
| `documentation/20-requirements/functional-requirements.md` | UPDATE | FR-002 moves from unimplemented to implemented in the traceability table |
| `docs/api-reference.md` | UPDATE | Record the shipped `PATCH /api/tasks/:id` and its omitted-vs-null rule — the derived API surface unit 3 and later read |

## NOT Building (Scope Limits)

- **Urgency ordering, filters and `limit`.** PRD phase 3. The list route is not
  touched here at all.
- **The detail screen and inline title edit.** PRD phase 4 (AC-8). This phase
  ships the contract that screen calls, and no UI.
- **Life Area assignment.** FR-008 is unit 13. `lifeAreaId` stays in the read
  contract because the column and DTO field already exist, but it is NOT in the
  editable set — the PRD is explicit that nothing in this unit writes it, and
  there are no Life Area rows or endpoints yet for it to reference. A `PATCH`
  carrying `lifeAreaId` is therefore rejected with 400 like any other
  non-editable key, rather than silently ignored (which AC-9 forbids as a
  category).
- **Recurrence machinery.** FR-009 is unit 9. This phase writes `detached` and
  reads `seriesId`; it does not spawn, sweep, or expand anything.
- **Reopening a `done` Task on edit.** PRD Open Question 2 leaves it `done`
  deliberately, to be answered by real use. The route never writes `status`.
- **Exposing `updatedAt` or `detached` on the wire.** PRD Decisions Log: both
  stay off the contract; `detached` is written, never returned.
- **Undo of an edit.** Needs an edit-history table nothing else wants yet.
- **Authoring or editing test files.** Under `tdd: true` the suite for this
  phase is authored by the `test-writer`/`test-reviewer` pair before the
  Implementer runs, and R-X strict forbids the Implementer from touching a test
  file. No task here edits `test/`; Task 4 runs the suite, it does not write it.

## Step-by-Step Tasks

### Task 1: UPDATE `src/shared/api.ts`

- **ACTION**: Add, below `CreateTaskInput`, an interface declared exactly
  `export interface UpdateTaskInput` whose
  fields are `title?: string`, `description?: string | null`,
  `deadline?: string | null`, `scheduledDate?: string | null`, and
  `priority?: TaskPriority | null`. Document on it, in a doc comment, the one
  sentence that makes it different from `CreateTaskInput`: an ABSENT key leaves
  the field unchanged, while an explicit `null` clears it. Note that `title` is
  the only field with no `| null` — a Task must always have one. Below it add
  the closed editable set as the line
  `export const EDITABLE_TASK_FIELDS: readonly string[] = ["title", "description", "deadline", "scheduledDate", "priority"];`
  so the Worker's rejection and the client's expectations derive from one list.
  Import nothing — this file stays free of runtime dependencies.
- **MIRROR**: `# SOURCE: src/shared/api.ts:42-49` (the `CreateTaskInput` shape
  this deliberately diverges from).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export interface UpdateTaskInput' src/shared/api.ts
  # Matches the declaration head only: Prettier wraps the five members onto
  # their own lines (it exceeds the 100-col print width), so a grep for the
  # single-line array form could never pass under `npm run check`.
  grep -q 'export const EDITABLE_TASK_FIELDS: readonly string\[\]' src/shared/api.ts
  for field in '"title"' '"description"' '"deadline"' '"scheduledDate"' '"priority"'; do
    grep -q "$field" src/shared/api.ts
  done
  npx tsc -b
  ```
- Delivers AC-A2, AC-A5.

### Task 2: UPDATE `src/worker/routes/tasks.ts` (add the PATCH handler)

- **ACTION**: Add a `taskRoutes.patch("/:id", ...)` handler AFTER the create
  handler and BEFORE the complete handler. Do not modify any existing handler.
  In order: read the body with the existing `readJson` and answer 400 if it is
  not a JSON object; reject any key not in `EDITABLE_TASK_FIELDS` with 400 and a
  message naming the offending key; answer 400 when no editable key is present
  at all (an empty patch is a client bug, not a no-op); then build the update
  patch by testing each editable key with `Object.hasOwn(body, key)` — NEVER by
  reading `body.key ?? null`, which erases the distinction this whole route
  exists for. Validate the present keys with the same guards the create handler
  uses: a `title` must be a non-empty string after trim (and may not be `null`);
  `description` accepts a string or `null`; `deadline` and `scheduledDate` each
  accept `null` or a value satisfying `isCalendarDate`; `priority` accepts
  `null` or a value satisfying `isTaskPriority`. Reject a body carrying BOTH a
  non-null `deadline` and a non-null `scheduledDate` with the same 400 the
  create handler already returns. Then apply date exclusivity: when the patch
  sets a non-null `deadline`, also set `scheduledDate: null` in the same
  statement, and symmetrically when it sets a non-null `scheduledDate`. Read the
  target row first to learn its `seriesId`, answering 404 when there is none;
  when `seriesId` is not null, add `detached: true` to the same update. Issue
  ONE `db.update(tasks).set(patch).where(eq(tasks.id, id)).returning()` and
  return `{ task: toTaskDto(row) }` with 200. Never write `status`,
  `completedAt`, `seriesId`, `occurrenceDate`, `createdAt` or `lifeAreaId`;
  `updatedAt` is written by the schema's own `$onUpdate` and is not set by hand.
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:122-130` (`readJson`'s
  untyped record), `# SOURCE: src/worker/routes/tasks.ts:57-68` (date
  validation + both-dates 400), `# SOURCE: src/worker/routes/tasks.ts:70-75`
  (the priority guard), `# SOURCE: src/worker/routes/tasks.ts:96-108`
  (single-statement update, `.returning()`, undefined row → 404).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'taskRoutes.patch("/:id"' src/worker/routes/tasks.ts
  grep -q 'Object.hasOwn' src/worker/routes/tasks.ts
  grep -q 'detached: true' src/worker/routes/tasks.ts
  npx tsc -b
  ```
- Delivers AC-A1, AC-A2, AC-A3, AC-A4, AC-A5.

### Task 3: UPDATE `src/app/api.ts`

- **ACTION**: Add a function declared exactly
  `export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDto>`
  beside the existing Task calls, issuing `PATCH /api/tasks/${id}` with
  the shared JSON/auth helper the file already uses for `createTask`, and
  unwrapping the `{ task }` envelope the same way. Import `UpdateTaskInput` from
  `../shared/api` — never restate the field list here. Shipping the client call
  in this phase is deliberate: phase 4 then adds a screen against a contract
  that is already tested, rather than adding a contract and a screen at once.
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:96-108` — the `{ task }`
  envelope this client call unwraps is the one that handler returns.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export async function updateTask' src/app/api.ts
  grep -q 'UpdateTaskInput' src/app/api.ts
  npm run check
  ```
- Delivers AC-A6.

### Task 4: RUN the suites against the implemented route

- **ACTION**: Run the full test suite. The `worker` project rebuilds an
  ephemeral D1 from `migrations/` on every run (`test/apply-migrations.ts`), so
  the phase-1 CHECK and the phase-2 route are exercised together. Confirm the
  test-first suite authored for this phase now passes, and that every
  pre-existing assertion in `test/tasks.test.ts` and `test/task-priority.test.ts`
  still passes untouched — a failure there is a regression against PRD AC-7 to
  fix in the route, never a test to weaken (`docs/anti-patterns.md:119-124`).
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:96-108` — the complete and
  reopen handlers whose byte-identical behaviour AC-7 requires and this run
  verifies.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  npm run db:migrate
  npx vitest run --project worker
  ```
- Delivers AC-A7 (verification of AC-A1 through AC-A6).

### Task 5: UPDATE the requirements traceability and the derived API reference

- **ACTION**: In `documentation/20-requirements/functional-requirements.md`,
  move FR-002 to implemented in the traceability table, citing unit 2 phase 2.
  In `docs/api-reference.md`, record the shipped route with the sentence
  `PATCH /api/tasks/:id — an omitted key leaves the field unchanged; an explicit null clears it.`
  written byte-for-byte, so the rule that is easiest to get wrong is stated where
  the next unit will read it. Set `last_updated` on every edited
  `documentation/` file per the documentation guidelines, and mirror the date in
  the status panel of `documentation/README.md`.
- **MIRROR**: `# SOURCE: src/shared/api.ts:42-49` — the contract asymmetry the
  documented sentence describes.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'PATCH /api/tasks/:id — an omitted key leaves the field unchanged; an explicit null clears it.' docs/api-reference.md
  npx vitest run --project docs
  ```
- Delivers no AC directly — this is infrastructure / scaffolding work
  (authoritative and derived documentation); `documentation/` is authoritative
  and CLAUDE.md makes "affected docs updated" part of the Definition of Done.

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
if grep -rn "PRAGMA foreign_keys" migrations/; then
  echo "FAIL: a D1-hostile PRAGMA foreign_keys statement remains in migrations/"; exit 1
fi
grep -q 'detached: true' src/worker/routes/tasks.ts
grep -q 'Object.hasOwn' src/worker/routes/tasks.ts
```

The last two greps are the structural half of AC-5 and AC-2: the ADR-0006
`detached` write and the key-presence test that carries the omitted-vs-null
rule are the two lines whose silent disappearance would leave the suite's
intent unenforced elsewhere in the file. The behavioural halves — including
AC-9's rejection of every non-editable key, which cannot be grepped for because
`status:` and `completedAt:` legitimately appear in the complete and reopen
handlers — are asserted by the suite, which is why both layers exist.

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** `PATCH /api/tasks/:id` changing a Task's title,
  description, date or priority persists the change and returns the updated
  Task; every field the request did not mention comes back unchanged.
- **AC-A2 (PRD AC-2):** an omitted key leaves its column exactly as it was; the
  same key sent as `null` clears it. The two are distinguishable, and clearing
  `description`, `deadline`, `scheduledDate` or `priority` is possible.
- **AC-A3 (PRD AC-3):** setting a `scheduledDate` on a Task that carries a
  `deadline` clears the deadline in the same write (and symmetrically), so the
  Task never holds both and the write never fails `tasks_single_date_chk`. A
  body carrying both non-null dates is rejected with 400.
- **AC-A4 (PRD AC-5):** editing any attribute of a Task whose `seriesId` is not
  null sets `detached` to true; editing a one-off Task leaves `detached` false.
- **AC-A5 (PRD AC-9):** a body carrying `id`, `status`, `createdAt`,
  `completedAt`, `seriesId`, `occurrenceDate`, `detached` — or any other key
  outside `EDITABLE_TASK_FIELDS`, `lifeAreaId` included — is rejected with 400
  and nothing is written.
- **AC-A6 (PRD AC-2):** `src/app/api.ts` exposes `updateTask` typed by
  `UpdateTaskInput`, so phase 4's detail screen consumes an existing contract
  rather than defining one.
- **AC-A7 (PRD AC-7):** the create, list, complete, reopen and delete routes
  keep their paths, behaviour and response bodies — every pre-existing assertion
  in `test/tasks.test.ts` and `test/task-priority.test.ts` passes without being
  edited.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `PATCH` semantics get muddled and clearing a date becomes impossible | Medium | High — the PRD names this risk explicitly | AC-A2 is authored test-first with the omission case and the explicit-null case as separate assertions, and Task 2 forbids the `body.key ?? null` idiom by name — that single expression is how the distinction is normally lost |
| A partial update silently wipes a field the request never mentioned | Medium | High — data loss on the owner's only copy | The patch object is built key by key from `Object.hasOwn`, so an unmentioned column is never present in the `set()` at all; AC-A1 asserts the untouched fields on every update |
| The `detached` write is forgotten and unit 9 retrofits it over real data | Low | Medium | AC-A4 covers both branches (series occurrence and one-off), and the Level 3 block greps for `detached: true` structurally so the line cannot silently disappear |
| `lifeAreaId` rejection is read as a contract break by a later unit | Low | Low | Recorded in `## NOT Building` with its reasoning: it stays in the READ contract (`TaskDto`), is absent from the WRITE set, and unit 13 adds it when Life Areas exist to point at |
| Editing a `done` Task is later decided to reopen it | Medium | Low | PRD Open Question 2 parks this deliberately; the route never writes `status`, so changing the answer later is adding a rule, not unwinding one |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **This phase's test-file updates are routed through the
  `test-writer`/`test-reviewer` pair, not authored by the Implementer.** Under
  `tdd: true` the pair writes the suite for AC-A1 through AC-A7 before the
  Implementer runs, and R-X strict forbids the Implementer from touching any
  test file. Accordingly no task in `## Step-by-Step Tasks` edits a test file
  and no `## Files to Change` row names one — Task 4 only *runs* the suite.
- **Why `Object.hasOwn` and not a typed input.** `UpdateTaskInput` exists for
  the client and for documentation; it cannot enforce the rule, because
  TypeScript models `{deadline?: string | null}` identically whether the key is
  absent or present-and-null. Only the parsed JSON object knows. This is the
  reason the PRD says the input type "cannot reuse `CreateTaskInput`" — the type
  is a description of the contract, and the key-set check is its enforcement.
- **An empty patch body is a 400, not a 200.** The PRD does not name this case.
  Rejecting it is the reading consistent with AC-9's principle that a request
  which cannot do what it appears to ask for is answered, not silently accepted.
  Recorded here as a judgment call so a later unit can revisit it deliberately.
- **Research grounding was performed inline by the main session**, not via the
  `research-codebase` / `research-web` subagents: this session carries an
  explicit instruction not to dispatch agents without the user asking — the same
  constraint recorded in unit 1's PRD and in this PRD's own Research Summary.
  Every `# SOURCE:` anchor is a real `file:line` read in this session against
  the phase-1 worktree state. `research-web` returned no findings (degradation
  reason: not dispatched); the design space is bounded by the existing schema,
  ADR-0006 and the PRD's own Decisions Log.
- **`src/worker/dto.ts` needs no change and has no row in `## Files to Change`.**
  The route returns the same `TaskDto` the other routes return, through the same
  single mapping point.

*Generated: 2026-08-15*
*Approved: 2026-08-15*
*Implemented: 2026-08-15*
*Status: IMPLEMENTED*
