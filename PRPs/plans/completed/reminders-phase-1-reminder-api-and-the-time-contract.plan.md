# Feature: Reminder API and the time contract (Phase 1 of reminders)

```
**Decision Gate**
- Active context: none (no .context.md provided or referenced)
- Activated criteria: new route file in src/worker/routes/ (`reminders.ts`); new write-side wire types in src/shared/api.ts; new pure helper + constant in src/shared/; impact on the /api/* router (src/worker/index.ts)
- Decisions found:
  - ADR-0003 — bearer token on every route, D1 as the single canonical store, no offline write queue
  - ADR-0005 — Hono 4 + Drizzle ORM stack, exact version pins (no new dependency introduced by this phase)
  - ADR-0008 (2026-08-04) — test-first methodology declared active (`tdd: true`); this phase's route + pure-function work falls inside the automated scope named in `docs/context/methodology.md`
- Applicable anti-patterns:
  - "Hand-duplicated entity types" (`docs/anti-patterns.md`) — the Reminder wire types must flow from `src/worker/db/schema.ts` through `src/worker/dto.ts`/`src/shared/api.ts`, never be redeclared by hand
  - "Version ranges in dependencies" — not triggered; no new dependency is added
  - "Portuguese in artifacts" — not triggered; this phase ships no UI copy
  - Writing under `.claude/` — not triggered; all writes land under `PRPs/plans/` and `src/`
- Applicable architectural rules:
  - Types flow from `src/worker/db/schema.ts` (Drizzle) outward; `src/worker/dto.ts` is the single mapping point to `src/shared/api.ts` (`ReminderDto`/`toReminderDto` already exist and must be reused)
  - Genuine instants cross the wire as epoch seconds; calendar days stay local `YYYY-MM-DD` text
  - Every `/api/*` route is bearer-token gated by the global `app.use("/api/*", requireToken)` middleware — no per-route opt-out
  - Exact version pins; no new dependency for this phase's pure-function or route work
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/reminders.prd.md` — Implementation Phases row 1: "Reminder API and
  the time contract" — Goal: every Reminder the domain allows can be created,
  read, corrected and removed through a token-gated route, and "1 h before the
  deadline" has a single, tested, clock-free definition. — Success signal:
  AC-1, AC-2, AC-3, AC-4, AC-13 and AC-14 green, and `npm run check` clean —
  including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

## Summary

Add a token-gated `/api/reminders` CRUD router mirroring the hand-rolled
validation style of `src/worker/routes/tasks.ts`, covering both Reminder
shapes the schema already allows (standalone: label + absolute instant;
Task-linked: absolute or offset-in-minutes before the deadline). Extend
`src/shared/api.ts` with the write-side request types (`CreateReminderInput`,
`UpdateReminderInput`, `EDITABLE_REMINDER_FIELDS`) flowing from the existing
`reminders` table through the existing `ReminderDto`/`toReminderDto` — no new
type is hand-duplicated. Add one new pure, clock-free helper to
`src/shared/` that converts a local `YYYY-MM-DD` day plus an offset in
minutes into an epoch-seconds instant (default timezone
`America/Sao_Paulo`), plus its named end-of-day (23:59 local) constant. No
new database table, no migration, no cron, no UI — those are phases 2–4.

## User Story

As the owner, I want to create, list, correct and remove a Reminder (either
standalone or attached to one of my Tasks) through a token-gated API, so that
the rest of the reminders feature (the sweep, the UI, the deadline
recomputation) has a real write path to build on.

## Problem Statement

The `reminders` table has existed unused since migration `0000` — schema,
`ReminderDto` and `toReminderDto` are all in place
(`src/worker/db/schema.ts:233-265`, `src/worker/dto.ts:115-126`), but no
route reads or writes it, and nothing in the codebase converts "1 h before
the deadline" into an actual instant. Scoped to this phase: the data model
has a lifecycle waiting for its create/read/update/delete surface, and the
Task-linked relative shape (FR-025, Task side) has nothing to count back
from until the offset-to-instant helper exists.

## Solution Statement

Mirror the house route pattern (`src/worker/routes/tasks.ts`) exactly:
hand-rolled validation, a local `readJson` guard, `Object.hasOwn` for
partial `PATCH` updates, explicit 400s ahead of the database CHECK, and DTO
mapping only at the response boundary via the already-existing
`toReminderDto`. Add the offset-to-instant conversion as a pure function in
`src/shared/dates.ts` beside the existing `todayIn`/`PRAESTO_TIMEZONE`
convention — no ambient clock, timezone as an argument, environment-agnostic
(no imports), so both `tsc -b` and the Vitest-inside-workerd tier can reach
it (AC-14). Mount the new router in `src/worker/index.ts` beside the
existing ones so `requireToken` gates it automatically (AC-13).

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Medium |
| Systems Affected | Worker API (`src/worker/routes/`, `src/worker/index.ts`), shared wire contract (`src/shared/api.ts`), shared pure date logic (`src/shared/dates.ts`) |
| Dependencies | None (Implementation Phases row 1; `Depends` cell is empty) |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/reminders.prd.md` Implementation Phases row 1 (lines 368, 375-386) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/worker/routes/tasks.ts` | 1-313 | The exact route pattern to mirror: `readJson` guard, hand-rolled validation, `Object.hasOwn` partial-update handling, explicit 400s, DTO mapping only at the response boundary |
| P0 | `src/worker/db/schema.ts` | 233-265 | The `reminders` table this phase reuses verbatim — columns, `reminders_due_idx`, `reminders_label_chk` CHECK. No new table, no migration |
| P0 | `src/shared/api.ts` | 104-118, 187-255 | The existing `ReminderDto` to reuse, and the `CreateTaskInput`/`UpdateTaskInput`/`EDITABLE_TASK_FIELDS` shape to model the new Reminder input types on (note the create-vs-update absent/null distinction) |
| P0 | `src/shared/dates.ts` | 1-37 | The only existing helper in this file (`todayIn`) and its no-imports, timezone-as-argument convention the new offset-to-instant helper must follow |
| P1 | `src/worker/dto.ts` | 111-126 | `toReminderDto` already exists and must be reused, never hand-duplicated (docs/anti-patterns.md) |
| P1 | `src/worker/index.ts` | 20-32 | The exact router-mounting pattern (`app.route("/api/<prefix>", <router>)`) beside the global `requireToken` middleware |

## Patterns to Mirror

```
# SOURCE: src/worker/routes/tasks.ts:120-167
/** FR-001 / FR-045 — create a Task. Title is the only required field. */
taskRoutes.post("/", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const input = body as Partial<CreateTaskInput>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return c.json({ error: "title is required" }, 400);
  ...
  const db = createDb(c.env);
  const [row] = await db.insert(tasks).values({ id: crypto.randomUUID(), ... }).returning();

  if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
  return c.json({ task: toTaskDto(row) }, 201);
});
```
Copied by Task 3 (`POST /api/reminders`) — same shape: parse via `readJson`,
validate the required/optional fields by hand, insert, map through the DTO
only at the response boundary.

```
# SOURCE: src/worker/routes/tasks.ts:190-264
taskRoutes.patch("/:id", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const unknownKey = Object.keys(body).find((key) => !EDITABLE_TASK_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return c.json({ error: `Field is not editable: ${unknownKey}` }, 400);
  }
  ...
  if (Object.hasOwn(body, "deadline")) {
    const deadline = body.deadline;
    if (deadline !== null && !isCalendarDate(deadline)) {
      return c.json({ error: "deadline must be a calendar date (YYYY-MM-DD)" }, 400);
    }
    patch.deadline = deadline;
  }
  ...
});
```
Copied by Task 4 (`PATCH /api/reminders/:id`) — `Object.hasOwn` per editable
field against a closed `EDITABLE_REMINDER_FIELDS` allowlist, so an absent
key never collapses into a written `null`.

```
# SOURCE: src/worker/routes/tasks.ts:305-313
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
Copied (as a local, file-scoped function — the same non-shared convention
`tasks.ts` uses) by Task 3, at the bottom of the new `reminders.ts`.

```
# SOURCE: src/worker/db/schema.ts:233-265
export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id, { onUpdate: "cascade", onDelete: "cascade" }),
    label: text("label"),
    fireAt: integer("fire_at", { mode: "timestamp" }).notNull(),
    originOffsetMinutes: integer("origin_offset_minutes"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    ...
  },
  (t) => [
    index("reminders_due_idx").on(t.sentAt, t.fireAt),
    index("reminders_task_idx").on(t.taskId),
    check("reminders_label_chk", sql`${t.taskId} is not null or (${t.label} is not null and length(trim(${t.label})) > 0)`),
  ],
);
```
Read (not copied) by Task 3 — the CHECK constraint text is what the create
route's hand-rolled 400 for "no `taskId` and an empty/absent `label`" must
pre-empt (AC-2), and the `onDelete: "cascade"` on `taskId` is what makes
AC-4's cascade-delete assertion already true with no code change.

```
# SOURCE: src/shared/api.ts:187-229
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  ...
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  ...
}

export const EDITABLE_TASK_FIELDS: readonly string[] = [
  "title",
  "description",
  "deadline",
  "scheduledDate",
  "priority",
];
```
Copied by Task 2 — the same Create-vs-Update split (absent and cleared mean
the same thing on create; they differ on update) and the same closed
editable-fields allowlist convention, adapted to the Reminder's own fields
(`label`, `fireAt`, `taskId`, `originOffsetMinutes`).

```
# SOURCE: src/shared/dates.ts:22-37
export const PRAESTO_TIMEZONE = "America/Sao_Paulo";

export function todayIn(now: Date, timeZone: string = PRAESTO_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
```
Copied by Task 1 — same no-imports, environment-agnostic module, same
default-timezone-as-argument convention, same `Intl.DateTimeFormat`
building block (this time used to derive the target zone's UTC offset for
the given local day/time via a formatted-parts diff, per the research-web
finding on `Intl.DateTimeFormat`'s formatting-only contract — see `##
Risks and Mitigations`).

```
# SOURCE: src/worker/index.ts:20-32
const app = new Hono<{ Bindings: Env }>();
app.use("/api/*", requireToken);
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/google", googleRoutes);
...
app.route("/api/diagnostics", diagnosticsRoutes);
```
Copied by Task 5 — `app.route("/api/reminders", reminderRoutes)` added
beside the existing mounts, below the `requireToken` middleware line so it
is gated the same way as every other route (AC-13).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/dates.ts` | UPDATE | Add the pure, clock-free offset-to-instant helper and its named end-of-day constant (AC-3, AC-14) |
| `src/shared/api.ts` | UPDATE | Add `CreateReminderInput`, `UpdateReminderInput`, `EDITABLE_REMINDER_FIELDS` — the write-side wire types the route needs; `ReminderDto` already exists and is reused unchanged |
| `src/worker/routes/reminders.ts` | CREATE | The `/api/reminders` CRUD router: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `src/worker/index.ts` | UPDATE | Mount `reminderRoutes` at `/api/reminders`, beside the existing router mounts, below `requireToken` |

## NOT Building (Scope Limits)

- **No cron sweep.** `runScheduledJob` stays an empty placeholder; dispatching
  a due Reminder through `sendPush`/`classifyPushOutcome` is phase 2.
- **No UI or `AppRoute` change.** The per-Task deep link and the pt-BR
  create/edit/delete surfaces are phase 3.
- **No deadline recomputation.** Recomputing a relative Reminder's `fireAt`
  when its Task's deadline changes (AC-11/AC-12) is phase 4.
- **No new database table and no migration.** The `reminders` table, its
  indexes and its CHECK already exist (`src/worker/db/schema.ts:233-265`);
  this phase writes zero SQL migration files.
- **No new dependency.** Validation stays hand-rolled, matching `tasks.ts` —
  no zod or equivalent is introduced.

## Step-by-Step Tasks

### Task 1: Add the offset-to-instant helper and end-of-day constant to src/shared/dates.ts

**ACTION**: In `src/shared/dates.ts`, add an exported constant
`END_OF_DAY_LOCAL_MINUTES = 23 * 60 + 59` (23:59, documented as the single
named source of the "meaning of a deadline" convention from the PRD's
Decisions Log) and an exported pure function
`offsetToInstant(day: string, offsetMinutes: number, timeZone: string = PRAESTO_TIMEZONE): number`
that returns the epoch-seconds instant `offsetMinutes` minutes before
`END_OF_DAY_LOCAL_MINUTES` of the local calendar day `day` in `timeZone`
(AC-3, AC-14). The function must read no ambient clock (no `Date.now()`,
no bare `new Date()` without an explicit input), must take the timezone
as an argument defaulting to `PRAESTO_TIMEZONE`, must add no import to
the module (same environment-agnostic convention as `todayIn`), and must
derive the IANA-zone UTC offset for that specific local instant via an
`Intl.DateTimeFormat`/`formatToParts` comparison against the UTC
rendering of the same wall-clock moment (never a fixed offset constant,
since Brazil's historical DST years are still representable dates). This
is the AC-3 conversion primitive (a Reminder's `originOffsetMinutes`
resolves to a real `fireAt`) and is what makes AC-14's "clock-free,
timezone-as-argument, lives in `src/shared/`" claim true.

**MIRROR**: `src/shared/dates.ts:22-37` (`# SOURCE` block above) — same
no-imports module, same `timeZone: string = PRAESTO_TIMEZONE` signature
shape.

**VALIDATE**: `npx tsc -b` (exits non-zero on any strict-mode violation,
including `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` on the
new function's internals; this compiles the AC-3/AC-14 helper's
internals)

### Task 2: Add write-side wire types to src/shared/api.ts

**INFRASTRUCTURE/SCAFFOLDING**: this task adds no owner-observable
behavior of its own and delivers no Acceptance Criterion directly — it
is the shared-type seam Task 3 (`POST`, AC-A1/AC-A2/AC-A3/AC-A4) and
Task 4 (`PATCH`/`DELETE`, AC-A2/AC-A3/AC-A4) both compile against. Its
own AC coverage is exercised transitively, at `npx tsc -b` and the
routes' own `npm test` runs, not by this task's `VALIDATE` in isolation.

**ACTION**: In `src/shared/api.ts`, add `export interface CreateReminderInput`
(`taskId?: string | null`, `label?: string | null`, `fireAt?: number`,
`originOffsetMinutes?: number | null`), `export interface UpdateReminderInput`
(same fields, all optional, following the `UpdateTaskInput` absent-vs-null
convention documented at `src/shared/api.ts:196-208`), and
`export const EDITABLE_REMINDER_FIELDS: readonly string[]` listing exactly
`"taskId"`, `"label"`, `"fireAt"`, `"originOffsetMinutes"`. Do not touch
`ReminderDto` — it already exists (`src/shared/api.ts:105-118`) and is
reused unchanged. These are the wire types Task 3's `POST /` and Task 4's
`PATCH /:id` bodies are typed against — no Acceptance Criterion is
satisfied by this task alone.

**MIRROR**: `src/shared/api.ts:187-229` (`# SOURCE` block above) — same
Create/Update split and closed editable-fields allowlist pattern.

**VALIDATE**: `npx tsc -b` (fails non-zero if the new types conflict with
`exactOptionalPropertyTypes` or any existing consumer; this is a
scaffolding check, not an AC-level validation — the AC-A1..AC-A4
behaviors these types feed are validated by Task 3/Task 4's own
`npm test` runs)

### Task 3: Create src/worker/routes/reminders.ts — GET and POST

**ACTION**: Create `src/worker/routes/reminders.ts` exporting
`reminderRoutes = new Hono<{ Bindings: Env }>()`. Add `GET /` (list all
Reminders, mapped through the existing `toReminderDto`) and `POST /`
(create a Reminder): parse the body with a local `readJson` guard
(identical shape to `tasks.ts:305-313`); reject with 400 and a pt-BR
error message (e.g. `"Informe um label ou uma tarefa"`) when neither a
non-empty `label` nor a `taskId` is present (pre-empting
`reminders_label_chk`, AC-2); when `taskId` is present, look it up and
return 400 (or 404) with a pt-BR error message (e.g. `"Tarefa não
encontrada"`) when no such Task exists (AC-4) — this API error string is
owner-facing, so ADR-0009 governs it exactly as it governs UI copy, even
though this phase ships no UI screen; reject with 400 and a pt-BR error
message (e.g. `"Informe fireAt ou originOffsetMinutes com uma tarefa com
prazo"`) when
neither `fireAt` (a finite epoch-seconds number) nor
(`originOffsetMinutes` a finite number AND the target Task has a
`deadline`) is present; when `originOffsetMinutes` is given, compute
`fireAt` via the Task 1 `offsetToInstant` helper against the Task's
`deadline` (AC-3) rather than trusting a client-supplied `fireAt`; insert
and map the returned row through `toReminderDto` at the response boundary
only, returning 201. Every error body this route returns is owner-facing
API copy and therefore pt-BR per ADR-0009 — none of this route's 400/404
messages are English.

**MIRROR**: `src/worker/routes/tasks.ts:120-167` (POST create) and
`src/worker/routes/tasks.ts:305-313` (`readJson`) — both `# SOURCE` blocks
above.

**VALIDATE**: `npm test` (runs the full Vitest suite inside workerd,
including the test-first suite already authored against AC-1/AC-2/AC-3/AC-4
before this task runs; `vitest run` exits non-zero on any failing test)

### Task 4: Add PATCH and DELETE to src/worker/routes/reminders.ts

**ACTION**: In the same file, add `PATCH /:id` (partial update): reject an
unknown key against `EDITABLE_REMINDER_FIELDS` with 400 and a pt-BR error
message; walk each field with `Object.hasOwn(body, key)` so an absent key
leaves the column untouched (never collapsed into `null`); re-validate
`label`/`taskId`/`fireAt`/`originOffsetMinutes` with the same rules — and
the same pt-BR error messages — as `POST /` (AC-A2, AC-A4: the "no target,
no unknown target" invariants apply on update exactly as they do on
create); return 404 with a pt-BR error message (e.g. `"Lembrete não
encontrado"`) when no Reminder with that id exists.

**INFRASTRUCTURE/SCAFFOLDING (DELETE /:id only)**: `DELETE /:id` (delete
and return 204, or 404 with a pt-BR error message when no such row exists,
mirroring `tasks.ts:296-303` byte-for-shape) completes the CRUD surface
the Phase 1 Goal names ("... corrected and removed through a token-gated
route") but has no dedicated numbered AC in this phase's scope (AC-1..
AC-4/AC-13/AC-14 cover create/read/token-gate/the time contract, not a
direct-delete scenario) — it is scope-completion work for Phase 2's sweep
and Phase 4's recomputation to build on, not an AC-bearing behavior of
its own.

**MIRROR**: `src/worker/routes/tasks.ts:190-264` (PATCH partial update) —
`# SOURCE` block above.

**VALIDATE**: `npm test` (exercises the AC-A2/AC-A4 re-validation coverage
on `PATCH /:id` the test-first suite already carries, plus the `DELETE
/:id` 204/404 scaffolding path; real vitest exit code)

### Task 5: Mount the reminders router in src/worker/index.ts

**ACTION**: In `src/worker/index.ts`, import `reminderRoutes` from
`./routes/reminders` and add `app.route("/api/reminders", reminderRoutes);`
beside the existing router mounts, below the `app.use("/api/*", requireToken)`
line so every `/api/reminders` path is bearer-token gated with no
per-route opt-out (AC-13).

**MIRROR**: `src/worker/index.ts:20-32` (`# SOURCE` block above).

**VALIDATE**: `if grep -q 'app.route("/api/reminders", reminderRoutes)' src/worker/index.ts; then echo "PASS: reminders router mounted"; else echo "FAIL: reminders router not mounted"; exit 1; fi`

## Validation Commands

**Level 1 (STATIC_ANALYSIS)**:
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .`,
chained with `&&` — the block fails non-zero on the first failing stage,
including `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violations
this project has twice let slip past a green Vitest run)

**Level 2 (UNIT_TESTS)**:
```
npm test
```
(`vitest run` — exits non-zero on any failing test; exercises the test-first
suite authored against AC-1, AC-2, AC-3, AC-4, AC-13 and AC-14 before this
plan's Implementer runs, per `docs/context/methodology.md`'s `tdd: true`
routing)

**Level 3 (INTEGRATION)**:
```
if grep -q 'app.route("/api/reminders", reminderRoutes)' src/worker/index.ts \
   && grep -q 'requireToken' src/worker/index.ts; then
  echo "PASS: /api/reminders is mounted and the bearer-token middleware is present"
else
  echo "FAIL: /api/reminders mount or requireToken gate missing"
  exit 1
fi
```

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** Given no Reminder exists, `POST /api/reminders` with
  `{ "label": "Beber água", "fireAt": <epoch seconds> }` and a valid bearer
  token creates a row with `taskId` null, `sentAt` null, returns the
  `ReminderDto`, and a subsequent `GET /api/reminders` includes it.
- **AC-A2 (PRD AC-2):** Given a body with no `taskId` and an absent, empty,
  or whitespace-only `label`, `POST /api/reminders` returns 400 with no row
  written, pre-empting the `reminders_label_chk` CHECK.
- **AC-A3 (PRD AC-3):** Given a Task with `deadline` `2026-09-20`, a
  Reminder created with `originOffsetMinutes: 60` gets a `fireAt` equal to
  60 minutes before `2026-09-20T23:59` local `America/Sao_Paulo`, and
  `originOffsetMinutes` persists as `60`.
- **AC-A4 (PRD AC-4):** Given a `taskId` that does not exist,
  `POST /api/reminders` returns 400 (or 404) with no row written. Given a
  Task that is later deleted, its Reminders are gone too (the existing
  `onDelete: "cascade"` on `reminders.task_id` — no new code required).
- **AC-A5 (PRD AC-13):** Given a request to any `/api/reminders` route with
  no valid bearer token, the response is 401 and no row is read or written.
- **AC-A6 (PRD AC-14):** The `offsetToInstant` helper reads no ambient
  clock, takes the timezone as an argument defaulting to
  `America/Sao_Paulo`, and lives in `src/shared/` — so both `tsc -b` and the
  Vitest-inside-workerd tier cover it.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Timezone/DST arithmetic turns "1 h before the deadline" into the wrong instant | M | Wrong notification time reaches the owner | `offsetToInstant` is a pure function in `src/shared/`, timezone as an argument, no ambient clock; the test-first suite (already authored before this plan's Implementer runs) pins fixtures against `America/Sao_Paulo` per AC-3/AC-14; research-web confirms `Intl.DateTimeFormat` is a display formatter, not an offset calculator, so the implementation must diff a `formatToParts` rendering against UTC rather than assume a fixed `-03:00` offset |
| A suite that passes under Vitest still breaks under `tsc -b` (this project has done this twice) | M | A merged phase ships a type error | `npm run check` (Level 1) is run before Level 2/3 report success, and Task 1/Task 2's own `VALIDATE` already runs `tsc -b` directly, catching `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violations at the smallest possible diff |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd`
in `docs/context/methodology.md`: **true**. Test-first ordering — the test
pair (test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

Because `tdd: true` and `test_frameworks` (`vitest`) is non-empty, the test
suite covering AC-1/AC-2/AC-3/AC-4/AC-13/AC-14 already exists and is RED
before this plan's Implementer starts — that is why Tasks 3 and 4's
`VALIDATE` lines invoke `npm test` directly rather than deferring to a
framework-mismatch exemption: the test files are not authored by the
Implementer (test-writer/test-reviewer own that lifecycle, per
`docs/context/methodology.md`), but running them against the Implementer's
own code is exactly what confirms the phase is done. No task in this plan
and no row in `## Files to Change` creates or edits a file under `test/`.

The offset-to-instant helper's DST-safety claim rests on the general
`Intl.DateTimeFormat`/`formatToParts`-diff technique research-web
identified — no single authoritative source ships a complete, vetted
recipe for this exact function, so its correctness is established by the
test-first fixtures (AC-3/AC-14), not by copying an external snippet
verbatim.

*Generated: 2026-09-09*
*Approved: 2026-09-09*
*Status: IMPLEMENTED*
