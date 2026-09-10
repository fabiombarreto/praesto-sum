# Feature: Deadline recomputation and the device proof (Phase 4 of reminders)

```
**Decision Gate**
- Active context: none (no .context.md provided or referenced)
- Activated criteria: editing an existing route handler (`src/worker/routes/tasks.ts`'s `PATCH /:id`); reuse of an existing shared pure helper (`offsetToInstant`, no new `src/shared/` function); UI glue change to an existing screen (`src/app/components/TodayScreen.tsx`) that shows the owner a new confirmation, triggering the mandatory UI/UX review checklist; documentation updates spanning both `documentation/` (authoritative) and `docs/` is not touched here directly, but `documentation/50-planning/roadmap.md` and `docs/domain/areas/reminders.md` are both in scope and must stay consistent with each other and with ADR-0013
- Decisions found:
  - ADR-0003 — D1 as the single canonical store; no offline write queue
  - ADR-0005 — Hono/Drizzle stack, exact version pins (no new dependency introduced by this phase)
  - ADR-0008 (2026-08-04) — test-first methodology active (`tdd: true`); the recompute logic in `src/worker/routes/tasks.ts` falls inside the automated scope named in `docs/context/methodology.md`, while the `TodayScreen.tsx` glue that shows the confirmation stays manually verified
  - ADR-0009 (2026-08-18) — visible UI copy in pt-BR; the new "reminder recomputed" toast text is owner-facing and therefore pt-BR
  - ADR-0013 (2026-09-07, ratified 2026-09-09) — `@block65/webcrypto-web-push` is the sole Web Push send library; `web-push` must never be named as current in any doc, including `docs/domain/areas/reminders.md`'s stale "Delivery architecture" line this phase corrects
  - PRD Decisions Log (`PRPs/prds/reminders.prd.md`) — "Behavior when a Task's deadline moves: recompute the relative Reminder's `fireAt` and say so on screen; never touch an already-sent row" — this is the exact shape phase 4 implements, chosen over Apple Reminders' documented silent-shift trap
- Applicable anti-patterns:
  - "Hand-duplicated entity types" (`docs/anti-patterns.md`) — not triggered; the recompute reuses `reminders`/`tasks` Drizzle rows and the existing `offsetToInstant` helper, introduces no new type
  - "Portuguese in artifacts" carve-out (ADR-0009) — the new toast copy is pt-BR; identifiers and tests stay English
  - Writing under `.claude/` — not triggered; every write lands under `src/`, `documentation/`, `docs/` or `PRPs/reports/`
  - "Weakening tests to force green" — not triggered; no test file is touched by this plan's tasks
- Applicable architectural rules:
  - Types flow from `src/worker/db/schema.ts` outward through `src/shared/api.ts`; this phase adds no new wire type and no new `src/shared/` function — it reuses `offsetToInstant` (phase 1) exactly as `src/worker/routes/reminders.ts` already does for the same computation
  - `documentation/` is authoritative and `docs/` is derived — both must be updated together on any conflict (CLAUDE.md); `test/docs-consistency.test.ts` guards the narrow, mechanically-checkable subset of that rule
  - Genuine instants are stored as epoch/timestamp values; the recompute writes `fireAt` as a `Date` via `new Date(offsetToInstant(...) * 1000)`, matching `src/worker/routes/reminders.ts`'s own convention
  - "Never stack sheets" / UI/UX guidelines — not triggered structurally (no new dialog), but the guidelines' Tier A checklist is still mandatory because this phase changes what the existing sheet and toast show the owner
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/reminders.prd.md` — Implementation Phases row 4: "Deadline
  recomputation and the device proof" — Goal: a relative reminder stays
  correct when plans change, visibly; and the whole chain is proved on the
  owner's own phone. — Success signal: AC-11 and AC-12 green; the owner's
  phone rings for a real Task-linked reminder and the tap lands on that
  Task.

## Summary

When the owner edits a Task's `deadline` through `PATCH /api/tasks/:id`,
recompute the `fireAt` of every relative (`originOffsetMinutes` non-null),
unsent (`sentAt IS NULL`) Reminder linked to that Task, using the same
`offsetToInstant` helper phase 1 already built and phase 1's own
`src/worker/routes/reminders.ts` already calls for the identical
computation — no new pure function is needed. A Reminder whose
`originOffsetMinutes` is `null` (an absolute-time Reminder) is left
completely untouched, and an already-sent Reminder is never selected by the
recompute query in the first place, so `sentAt` can never be disturbed by
it. On the client, the Task sheet's save flow re-fetches Reminders after a
successful save and shows a pt-BR toast naming the new date/time whenever
the linked Reminder's `fireAt` actually moved — the "say so on screen" half
of the PRD's Decisions Log entry, chosen over Apple Reminders' documented
silent-shift trap. Two documentation corrections this unit owes land here:
`documentation/50-planning/roadmap.md` (the unit 7 row moves off `next`,
a new Delivery history row records the code landing, and the M2 note keeps
saying M2 is not yet reached until the device proof happens) and
`docs/domain/areas/reminders.md`'s "Delivery architecture" line, which
still names `web-push` — a fact ADR-0013 superseded on 2026-09-07 and the
owner ratified on 2026-09-09. The on-device verification itself — a
Task-linked reminder tapped on the owner's own Android phone, app closed
and app open — is explicitly NOT a task in this plan; it is the owner's own
exit step, named in its own section below.

## User Story

As the owner, I want a Task-linked reminder's fire time to follow the Task
when I move its deadline, and to see on screen that it moved, so that I
never discover — the way Apple Reminders' own users report discovering —
that a reminder silently stayed pinned to a date I already changed.

## Problem Statement

Phases 1-3 gave Reminders a full CRUD surface, a cron sweep and a pt-BR
UI, but nothing in the codebase reacts when a Task's `deadline` changes:
`PATCH /api/tasks/:id` (`src/worker/routes/tasks.ts:190-264`) writes the
new `deadline` and returns, with no read or write of the `reminders` table
anywhere in that handler. A relative Reminder created against
`2026-09-20` stays fixed at that instant even after the owner reschedules
the Task to `2026-09-25` — silently wrong, exactly the trap Apple
Reminders' own community documents and works around by hand. Scoped to
this phase: the recompute rule the PRD's Decisions Log already settled
("recompute... and say so on screen") has no code behind it yet, and two
of this unit's own documentation debts — the stale `web-push` reference
and the roadmap's `next` status — are still open.

## Solution Statement

Extend the existing `PATCH /:id` handler in `src/worker/routes/tasks.ts`
with one additional step, run only when the request actually changed
`deadline` to a new non-null value: select every Reminder row matching
`taskId = <id> AND originOffsetMinutes IS NOT NULL AND sentAt IS NULL`,
and for each, write `fireAt: new Date(offsetToInstant(row.deadline,
reminder.originOffsetMinutes) * 1000)` — the identical expression
`src/worker/routes/reminders.ts:139-140` already uses for the same
offset-to-instant conversion, so this phase introduces no new formula, no
new `src/shared/` function, and no behavioural risk to the already-tested
`offsetToInstant` fixtures. The `sentAt IS NULL` clause in the `SELECT`
means an already-sent Reminder is never read, let alone written — AC-12
is satisfied structurally, not by a defensive check inside the loop. On
the client, `TodayScreen.tsx`'s `refreshReminders` gains a return value
(the freshly fetched array, instead of `void`) so `saveSheet` can compare
the linked Reminder's `fireAt` *before* the save against the value the
server just recomputed, without reading React's own (necessarily stale,
same-closure) `reminders` state. When the two differ, `saveSheet` shows a
toast naming the new day and time via the already-existing
`instantToLocalParts` helper; otherwise it shows the existing "Tarefa
salva" toast unchanged. Two documentation files are corrected to close
this unit's own debts, and the UI/UX Tier A checklist is run and recorded
against the new toast, per the project's own mandatory-on-every-interface-
change rule.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Medium |
| Systems Affected | Worker API (`src/worker/routes/tasks.ts`); SPA (`src/app/components/TodayScreen.tsx`); project documentation (`documentation/50-planning/roadmap.md`, `docs/domain/areas/reminders.md`) |
| Dependencies | Phase 3 (`Per-Task route and Reminder UI`) — `complete` |
| Estimated Tasks | 6 |
| Source PRD line ref | `PRPs/prds/reminders.prd.md` Implementation Phases row 4 (lines 371, 412-424) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/worker/routes/tasks.ts` | 169-264 | The exact `PATCH /:id` handler this phase extends with the recompute step, and the three rules it already owns (`Object.hasOwn` partial update, the deadline/scheduledDate mutual exclusion, the `detached` flag on a series occurrence) that the new step must not disturb |
| P0 | `src/worker/routes/reminders.ts` | 132-171 | The existing `nextFireAt` computation (`offsetToInstant(task.deadline, nextOriginOffsetMinutes) * 1000` wrapped in `new Date(...)`) this phase's recompute step reuses verbatim — the same formula, not a new one |
| P0 | `src/shared/dates.ts` | 108-139 | `offsetToInstant` itself — read, not re-derived; this phase adds no new pure helper |
| P0 | `src/worker/db/schema.ts` | 233-265 | The `reminders` table columns the recompute query filters on (`taskId`, `originOffsetMinutes`, `sentAt`) and writes (`fireAt`) |
| P0 | `src/app/components/TodayScreen.tsx` | 185-284 | `reminders` state, `sheetTaskReminder`'s derivation, and the existing `refreshReminders`/`refresh` fetch conventions this phase extends |
| P1 | `src/app/components/TodayScreen.tsx` | 473-489 | `saveSheet` — the exact save flow this phase extends with the before/after `fireAt` comparison and the new toast branch |
| P1 | `src/app/toast-store.ts` | 1-60 | `showToast`/`ToastSpec` — the synchronous call shape and the auto-dismiss contract the new toast follows unchanged |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 146-168 | The mandatory Tier A review checklist this phase must run and record against the new toast confirmation |
| P1 | `documentation/50-planning/roadmap.md` | 52-60, 101-107, 164-172 | The units table row format, the Now/Next/Later section, and the Delivery-history row format this phase's doc task edits |
| P1 | `docs/domain/areas/reminders.md` | 1-25 | The full (short) file this phase corrects — specifically its stale "Delivery architecture" line |
| P1 | `test/task-update.test.ts` | 1-53 | The existing `PATCH /api/tasks/:id` test conventions (`patch`/`patchOk` helpers) the test-first suite extends for AC-11/AC-12 |

## Patterns to Mirror

```
# SOURCE: src/worker/routes/tasks.ts:250-264
const db = createDb(c.env);
const [existing] = await db
  .select()
  .from(tasks)
  .where(eq(tasks.id, c.req.param("id")));
if (existing === undefined) return c.json({ error: "No Task with that id" }, 404);

// Rule 3 — an edited occurrence detaches from its series.
if (existing.seriesId !== null) patch.detached = true;

const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, existing.id)).returning();

if (row === undefined) return c.json({ error: "Update returned no row" }, 500);
return c.json({ task: toTaskDto(row) });
```
Extended by Task 1 — the recompute step runs AFTER this final `db.update`
succeeds and reads `row.deadline`/`existing.deadline` to decide whether a
recompute is due, exactly the same "read `existing`, then read the fresh
`row`" shape already established two lines above it.

```
# SOURCE: src/worker/routes/reminders.ts:132-156
const nextOriginOffsetMinutes = Object.hasOwn(body, "originOffsetMinutes")
  ? typeof body.originOffsetMinutes === "number" && Number.isFinite(body.originOffsetMinutes)
    ? body.originOffsetMinutes
    : null
  : existing.originOffsetMinutes;

let nextFireAt: Date;
if (nextOriginOffsetMinutes !== null && task !== undefined && task.deadline !== null) {
  nextFireAt = new Date(offsetToInstant(task.deadline, nextOriginOffsetMinutes) * 1000);
}
```
Copied by Task 1 — the identical `new Date(offsetToInstant(deadline,
offsetMinutes) * 1000)` shape, applied to every relative, unsent Reminder
linked to the Task whose deadline just moved, rather than to one Reminder
being edited directly.

```
# SOURCE: src/shared/dates.ts:108-139
export function offsetToInstant(
  day: string,
  offsetMinutes: number,
  timeZone: string = PRAESTO_TIMEZONE,
): number {
  ...
}
```
Read (not copied) by Task 1 — this phase calls the existing function; it
does not add a second one. AC-3/AC-14's already-shipped DST fixtures cover
its correctness; this phase's own test-first suite only needs to assert
that the RIGHT arguments reach it on a deadline edit.

```
# SOURCE: src/app/components/TodayScreen.tsx:260-274
async function refreshReminders(): Promise<void> {
  try {
    const next = await listReminders();
    setReminders(next);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return;
    }
    setReminders(null);
  }
}
```
Extended by Task 2 — the return type widens to
`Promise<ReminderDto[] | null>`, returning `next` on success and `null` on
failure (including the 401 branch, after calling `onUnauthorized()`), so a
caller that needs the freshly fetched rows — Task 3's `saveSheet` — never
has to read the `reminders` state variable through a stale closure.

```
# SOURCE: src/app/components/TodayScreen.tsx:473-489
function saveSheet(): void {
  if (sheetTask === null) return;
  const changes = buildTaskPatch(sheetTask, currentDraft(sheet, sheetTask));
  if (Object.keys(changes).length === 0) {
    dispatchSheet({ type: "close" });
    return;
  }
  void runSheet(async () => {
    await updateTask(sheetTask.id, changes);
    dispatchSheet({ type: "saved", taskId: sheetTask.id });
    showToast({ key: "task-saved", text: "Tarefa salva" });
  });
}
```
Extended by Task 3 — captures `sheetTaskReminder`'s `fireAt` before the
`runSheet` call, awaits Task 2's `refreshReminders()` inside the action
callback (in addition to `runSheet`'s own `refresh()`), and branches the
final `showToast` call on whether the linked Reminder's `fireAt` changed.

```
# SOURCE: src/app/toast-store.ts:47-58
export function showToast(toast: ToastSpec): void {
  const before = state;
  dispatch({ type: "show", toast });
  if (state === before) return;
  clearTimer();
  if (autoDismisses(toast)) {
    timer = setTimeout(() => {
      timer = null;
      dispatch({ type: "expire", key: toast.key });
    }, TOAST_AUTO_DISMISS_MS);
  }
}
```
Reused unmodified by Task 3 — the new `{ key: "reminder-recomputed", text:
... }` call follows the identical two-field `ToastSpec` shape as the
existing `{ key: "task-saved", text: "Tarefa salva" }` call it sits beside,
so it auto-dismisses after `TOAST_AUTO_DISMISS_MS` the same way.

```
# SOURCE: documentation/50-planning/roadmap.md:60
| 7 | `reminders` | "Drink water at 3pm" and "warn me 1 h before this deadline" — created, edited, and delivered on time with the app closed | FR-044, FR-025 (Task side), FR-041 | 6, 2 | 4 | **next** | For a full week every reminder arrived on time — none duplicated, none silent |
```
Edited by Task 5 — only the `State` cell (`**next**`) changes, to reflect
that phases 1-4's code is complete while the device proof — and therefore
`shipped` — is still pending; every other cell (Outcome, FRs, Depends,
Est.) is untouched.

```
# SOURCE: docs/domain/areas/reminders.md:14-16
## Delivery architecture (ADR-0003/0005)

Workers cron trigger scans due Reminders → `web-push` under `nodejs_compat` → installed PWA (`src/sw.ts` handles push + notificationclick). Push failure is SILENT — the dedicated VAPID integration test is mandatory, and a manual test-push route is recommended.
```
Edited by Task 6 — `web-push` under `nodejs_compat` is replaced with
`@block65/webcrypto-web-push` (Web Crypto + native `fetch`, no
`nodejs_compat` dependency), and the heading's ADR citation gains
ADR-0013.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/worker/routes/tasks.ts` | UPDATE | Add the deadline-recompute step to `PATCH /:id` (AC-A1, AC-A2) |
| `src/app/components/TodayScreen.tsx` | UPDATE | Widen `refreshReminders`'s return type (scaffolding for AC-A3) and wire the "reminder recomputed" toast branch in `saveSheet` (AC-A3) |
| `documentation/50-planning/roadmap.md` | UPDATE | Move the unit 7 row off `**next**`, add a Delivery history row, keep the M2 note accurate — this unit's own documentation debt (Phase Details scope) |
| `docs/domain/areas/reminders.md` | UPDATE | Correct the "Delivery architecture" line's stale `web-push` reference per ADR-0013 — this unit's own documentation debt (Phase Details scope) |
| `PRPs/reports/reminders/phase-4/ui-ux-checklist.md` | CREATE | The recorded Tier A ✔/✘ checklist result the Hard project rules require for this phase's screen change (the new toast confirmation) |

## NOT Building (Scope Limits)

- **No on-device proof.** The owner's phone tapping a real Task-linked
  reminder — app closed and app open — is this unit's own exit signal, not
  a Step-by-Step Task in this plan. See the `### Device Verification`
  subsection of `## Notes` below.
- **No new `src/shared/` function.** The recompute reuses `offsetToInstant`
  exactly as `src/worker/routes/reminders.ts` already does; this phase adds
  no second formula and touches no DST fixture.
- **No recompute when a deadline is cleared to `null` (switched to a
  `scheduledDate`, or removed).** The recompute step only runs when
  `Object.hasOwn(body, "deadline") && row.deadline !== null && row.deadline
  !== existing.deadline` — a deadline becoming `null` has nothing left to
  count back from. A relative Reminder on a Task whose deadline is cleared
  keeps its last-computed `fireAt`, which is now stale; the PRD's own
  AC-11/AC-12 scenarios do not cover this transition, and it is recorded as
  a known limitation in `## Risks and Mitigations` (`TBD - needs
  validation`) rather than guessed at.
- **No change to the cron sweep, the push dispatch path, or the per-Task
  route.** Phases 2 and 3 already own those; this phase only adds a write
  to `reminders.fireAt` inside an existing Task route handler.
- **No new database column, no migration.** `reminders.fireAt` already
  exists and is already writable; this phase adds no schema change.
- **No new dependency.** The recompute is three more lines of Drizzle
  query composition using `and`/`isNull`/`eq`, already imported patterns
  from phase 2's own sweep.

## Step-by-Step Tasks

### Task 1: Recompute relative Reminders' `fireAt` when a Task's deadline changes

**ACTION**: In `src/worker/routes/tasks.ts`, inside `taskRoutes.patch("/:id",
...)`, after the existing final `const [row] = await
db.update(tasks).set(patch).where(eq(tasks.id, existing.id)).returning();`
and its `row === undefined` guard, add: when
`Object.hasOwn(body, "deadline") && row.deadline !== null && row.deadline
!== existing.deadline`, select every Reminder matching
`and(eq(reminders.taskId, row.id), isNotNull(reminders.originOffsetMinutes),
isNull(reminders.sentAt))`, and for each returned row, `await
db.update(reminders).set({ fireAt: new Date(offsetToInstant(row.deadline,
reminder.originOffsetMinutes) * 1000) }).where(eq(reminders.id,
reminder.id));` — reusing `offsetToInstant` exactly as
`src/worker/routes/reminders.ts:139-140` already does. Do this BEFORE the
`return c.json({ task: toTaskDto(row) });` line, so the recompute is
guaranteed to have run (or to have thrown, surfacing a 500) before the
response is sent. Import `isNotNull`, `isNull` from `drizzle-orm` (add to
the existing `import { and, desc, eq, sql } from "drizzle-orm";` line) and
`reminders` and `offsetToInstant` (from `../../shared/dates`, add to the
existing `import { todayIn } from "../../shared/dates";` line) into
`src/worker/routes/tasks.ts`. This is the AC-11 recompute rule (a relative,
unsent Reminder's `fireAt` moves with the deadline) and, because the
`SELECT`'s own `isNull(reminders.sentAt)` clause means an already-sent row
is never read by this code path, this is also the AC-12 guarantee (an
already-sent Reminder's `sentAt` — and, moreover, its `fireAt` — is never
touched by an edit) satisfied structurally rather than by a runtime check.
A Reminder with `originOffsetMinutes === null` (an absolute-time Reminder)
is excluded by the same `SELECT`'s `isNotNull` clause and therefore
likewise untouched.

**MIRROR**: `src/worker/routes/tasks.ts:250-264` (`# SOURCE` block above,
the exact point in the handler this task extends) and
`src/worker/routes/reminders.ts:132-156` (`# SOURCE` block above, the
`new Date(offsetToInstant(...) * 1000)` formula reused verbatim).

**VALIDATE**: `npm test` (runs the full Vitest suite inside workerd,
including the test-first suite `test-writer` extends `test/task-update.test.ts`
with, against AC-11 and AC-12, before this plan's Implementer runs, per
`docs/context/methodology.md`'s `tdd: true` routing; `vitest run` exits
non-zero on any failing test. Against the tree as it stands today,
`PATCH /:id` never reads or writes the `reminders` table at all, so an
AC-11 assertion — that a linked relative Reminder's `fireAt` moved with the
deadline — fails today for the right reason)

### Task 2: Widen `refreshReminders`'s return type to hand back the fetched rows

**INFRASTRUCTURE/SCAFFOLDING**: this task adds no owner-observable
behavior of its own and delivers no Acceptance Criterion directly — it is
the seam Task 3 (AC-A3) needs so it can compare a Reminder's `fireAt`
against a value that is guaranteed fresh, rather than against React's own
same-closure, necessarily-stale `reminders` state.

**ACTION**: In `src/app/components/TodayScreen.tsx`, change
`refreshReminders`'s signature from `Promise<void>` to
`Promise<ReminderDto[] | null>`. On success, `return next;` after
`setReminders(next);`. In the `catch` block, `return null;` in the 401
branch (after calling `onUnauthorized()`) and `return null;` after
`setReminders(null);` in the fallback branch. No call site of
`refreshReminders()` elsewhere in this file needs to change — a
`Promise<ReminderDto[] | null>` discarded with a bare `await` or `void`
remains valid.

**MIRROR**: `src/app/components/TodayScreen.tsx:260-274` (`# SOURCE` block
above).

**VALIDATE**: `npx tsc -b` (fails non-zero on a type mismatch anywhere the
new return type conflicts with a caller; against the tree as it stands
before Task 3 lands, this change alone compiles clean since every existing
call site discards the return value, so this task's own gate is `tsc -b`
directly rather than a behavioural assertion — the seam only becomes load-
bearing once Task 3 consumes it)

### Task 3: Show a toast when the Task-linked Reminder's `fireAt` was recomputed

**ACTION**: In `src/app/components/TodayScreen.tsx`'s `saveSheet`, before
the `void runSheet(async () => { ... })` call, capture `const
previousReminderFireAt = sheetTaskReminder?.fireAt ?? null;`. Inside the
action callback, immediately after `dispatchSheet({ type: "saved", taskId:
sheetTask.id });`, call `const nextReminders = await refreshReminders();`
(Task 2's widened return) and derive `const updatedReminder = (nextReminders
?? []).find((r) => r.taskId === sheetTask.id) ?? null;`. Replace the
existing unconditional `showToast({ key: "task-saved", text: "Tarefa
salva" });` with: when `previousReminderFireAt !== null && updatedReminder
!== null && updatedReminder.fireAt !== previousReminderFireAt`, call
`const { day, time } = instantToLocalParts(updatedReminder.fireAt);` (import
`instantToLocalParts` from `../../shared/dates`, adding it to whatever is
already imported from that module in this file, or adding a fresh import
line if none exists yet) and `showToast({ key: "reminder-recomputed", text:
\`Lembrete reagendado para ${day} ${time}\` });`; otherwise, keep the
existing `showToast({ key: "task-saved", text: "Tarefa salva" });`
unchanged. This is the AC-A3 "say so on screen" half of the PRD's
Decisions Log entry: the owner sees a distinct, pt-BR confirmation exactly
when — and only when — the save actually moved a linked Reminder's fire
time, never a generic "saved" message that would hide the change the way
Apple Reminders' silent shift does.

**MIRROR**: `src/app/components/TodayScreen.tsx:473-489` (`# SOURCE` block
above, the exact function extended) and `src/app/toast-store.ts:47-58`
(`# SOURCE` block above, the unmodified `showToast`/`ToastSpec` contract
the new call follows).

**VALIDATE**: `npx tsc -b` (React glue, manual verification per
`docs/context/methodology.md`'s explicit UI carve-out), then a real content
check that the branch actually landed:
```
if ! grep -q 'reminder-recomputed' src/app/components/TodayScreen.tsx; then
  echo "FAIL: reminder-recomputed toast branch missing from saveSheet"
  exit 1
else
  echo "PASS: reminder-recomputed toast branch present"
fi
```
(fails today — the string does not exist anywhere in this file before this
task runs)

### Task 4: Run and record the UI/UX Tier A review checklist

**INFRASTRUCTURE/SCAFFOLDING**: this task delivers no Acceptance Criterion
of its own — it is a process gate (a Hard project rule, not a numbered PRD
AC) the project's own CLAUDE.md and
`documentation/40-engineering/ui-ux-guidelines.md` require on every
interface change. This phase changes what an existing screen shows the
owner (the new "reminder recomputed" toast copy), which is exactly the
trigger this rule names.

**ACTION**: Using the browser pane at 375 px, dark mode (per guidelines
§12.6), exercise the Task sheet's save flow for both a Task-linked relative
Reminder whose deadline edit moves its `fireAt` (expect the "Lembrete
reagendado para ..." toast) and a Task edit that does not touch a linked
Reminder (expect the unchanged "Tarefa salva" toast), against the 9-item
Tier A checklist (`documentation/40-engineering/ui-ux-guidelines.md:150-160`:
one primary action per screen; 48 px targets with 8 px gaps; no
colour-only meaning; pt-BR/sentence-case/infinitive-button copy;
Tab/Enter/Esc + visible focus + focus-returns-to-opener; `aria-label`s and
visible labels; tokens-only styling with reduced-motion honoured;
destructive actions follow §8 — not triggered by this phase's own,
non-destructive toast, note as N/A rather than skipped; no cross-origin
request). Record one ✔/✘ (or ✔ N/A) line per item, with the reason for any
✘, in a new file `PRPs/reports/reminders/phase-4/ui-ux-checklist.md` — the
ARTIFACT root, never inside the worktree (phase 3's checklist was
misfiled inside the worktree at `PRPs/reports/reminders-phase-3/` and had
to be relocated to `PRPs/reports/reminders/phase-3/ui-ux-checklist.md`;
this path is the corrected convention, named explicitly so this phase does
not repeat that mistake). A ✘ with no recorded, conscious exception means
the change is not done — fix it before this task's `VALIDATE` is expected
to pass.

**MIRROR**: `documentation/40-engineering/ui-ux-guidelines.md:146-160` (the
Tier A checklist itself — process, not code, so no `src/` file anchor
applies here) and `PRPs/reports/reminders/phase-3/ui-ux-checklist.md` (the
corrected artifact-root convention this task follows).

**VALIDATE**:
```
if [ -f PRPs/reports/reminders/phase-4/ui-ux-checklist.md ] && grep -qE "(✔|✘)" PRPs/reports/reminders/phase-4/ui-ux-checklist.md; then
  echo "PASS: Tier A checklist recorded"
else
  echo "FAIL: Tier A checklist result missing"
  exit 1
fi
```
(fails today — the file does not exist yet)

### Task 5: Update the roadmap's unit 7 row, Delivery history and M2 note

**INFRASTRUCTURE/SCAFFOLDING**: this task delivers no numbered PRD
Acceptance Criterion — it is the documentation debt the PRD's own Phase
Details scope names explicitly for this phase ("Documentation updates land
here too: `documentation/50-planning/roadmap.md` (unit 7 row, delivery
history, M2)").

**ACTION**: In `documentation/50-planning/roadmap.md`: (1) change the unit
7 row's `State` cell (line 60) from `**next**` to `**in-progress**` — code
for AC-11/AC-12 is complete and tested, but the unit cannot be `shipped`
until the device proof (see `### Device Verification` under `## Notes` below) happens, so
`in-progress` is the honest state, not `shipped`; (2) insert a new row
immediately below the Delivery history table's header divider (after line
169, "Newest first" per the section's own stated rule), dated with today's
date, recording that phase 4's recompute (AC-11, AC-12) landed with tests
green, that the roadmap's own `web-push` reference in
`docs/domain/areas/reminders.md` was corrected per ADR-0013 in the same
session, and that the unit's own exit signal — the device proof — remains
outstanding and is the reason the unit is `in-progress` rather than
`shipped`; (3) leave the M2 note (line 34) internally consistent with the
above: M2 is still NOT reached, because a code-complete recompute is not
the same as the owner's phone proving the whole chain end to end.

**MIRROR**: `documentation/50-planning/roadmap.md:60` (`# SOURCE` block
above, the row this task edits) and `documentation/50-planning/roadmap.md:164-172`
(the Delivery history section's own stated format and "newest first" rule,
read in full during Mandatory Reading).

**VALIDATE**:
```
if grep -nE '^\| 7 \| `reminders`.*\*\*next\*\*' documentation/50-planning/roadmap.md; then
  echo "FAIL: unit 7 row is still marked **next**"
  exit 1
fi
if ! grep -q "AC-11" documentation/50-planning/roadmap.md; then
  echo "FAIL: no Delivery history row references the AC-11 recomputation work"
  exit 1
fi
echo "PASS: unit 7 row updated off **next** and a Delivery history row records phase 4"
```
(fails today on both checks — the row still reads `**next**` and no line
in this file mentions "AC-11" — and passes only once both edits land)

### Task 6: Correct the stale `web-push` reference in the reminders domain doc

**INFRASTRUCTURE/SCAFFOLDING**: this task delivers no numbered PRD
Acceptance Criterion — it is the documentation debt the PRD's own Phase
Details scope names explicitly for this phase ("the `web-push` reference
in that domain doc's delivery-architecture line, which ADR-0013
superseded").

**ACTION**: In `docs/domain/areas/reminders.md`, replace the "Delivery
architecture" section's body line — currently `Workers cron trigger scans
due Reminders → \`web-push\` under \`nodejs_compat\` → installed PWA
(\`src/sw.ts\` handles push + notificationclick).` — with the corrected
send library: `Workers cron trigger scans due Reminders →
\`@block65/webcrypto-web-push\` (Web Crypto + native \`fetch\`) → installed
PWA (\`src/sw.ts\` handles push + notificationclick).`, and update the
section heading from `## Delivery architecture (ADR-0003/0005)` to `##
Delivery architecture (ADR-0003/0005/0013)` so the citation names the ADR
that actually governs the send library. Leave the rest of the file —
including the "Push failure is SILENT" sentence and every other section —
untouched; this task corrects exactly the one stale fact.

**MIRROR**: `docs/domain/areas/reminders.md:14-16` (`# SOURCE` block
above, the exact lines this task edits).

**VALIDATE**:
```
if grep -q '`web-push`' docs/domain/areas/reminders.md; then
  echo "FAIL: docs/domain/areas/reminders.md still names web-push as current"
  exit 1
fi
if ! grep -q '@block65/webcrypto-web-push' docs/domain/areas/reminders.md; then
  echo "FAIL: corrected send library name not present in docs/domain/areas/reminders.md"
  exit 1
fi
echo "PASS: docs/domain/areas/reminders.md names the ADR-0013 send library, not web-push"
```
(fails today on the first check — the file currently names `web-push` as
current — and passes only once the correction lands)

## Validation Commands

**Level 1 (STATIC_ANALYSIS)**:
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .`,
chained with `&&` — fails non-zero on the first failing stage, including
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violations this
project has twice let slip past a green Vitest run)

**Level 2 (UNIT_TESTS)**:
```
npm test
```
(`vitest run` — exits non-zero on any failing test; exercises the
test-first suite `test-writer` extends `test/task-update.test.ts` with,
against AC-11 and AC-12, before this plan's Implementer runs, per
`docs/context/methodology.md`'s `tdd: true` routing; the `docs-consistency`
suite (`test/docs-consistency.test.ts`) also runs here and would fail if
Task 5/6's documentation edits introduced a broken cited path or a
still-open-decision claim, though neither task's own content triggers
those specific checks)

**Level 3 (INTEGRATION)**:
```
if grep -q "isNotNull(reminders.originOffsetMinutes)" src/worker/routes/tasks.ts \
   && grep -q "offsetToInstant(row.deadline" src/worker/routes/tasks.ts \
   && grep -q "reminder-recomputed" src/app/components/TodayScreen.tsx \
   && ! grep -q '`web-push`' docs/domain/areas/reminders.md \
   && grep -q '@block65/webcrypto-web-push' docs/domain/areas/reminders.md \
   && [ -f PRPs/reports/reminders/phase-4/ui-ux-checklist.md ]; then
  echo "PASS: recompute wiring, on-screen confirmation, corrected domain doc and checklist are all present"
else
  echo "FAIL: at least one of the recompute/toast/doc/checklist pieces is missing"
  exit 1
fi
```
(against the tree as it stands today none of these six conditions hold —
`web-push` is still named as current, so the fifth clause's negation
already fails on its own — so this fails for the right reason before the
plan's tasks run, and passes only once every piece is wired)

## Acceptance Criteria

- **AC-A1 (PRD AC-11):** Given a Task with `deadline` `2026-09-20` and a
  Reminder with `originOffsetMinutes: 60`, when the Task's deadline is
  changed to `2026-09-25`, that Reminder's `fireAt` moves to 60 minutes
  before the end of `2026-09-25` local, while a Reminder on the same Task
  with `originOffsetMinutes` null keeps its `fireAt` unchanged.
- **AC-A2 (PRD AC-12):** Given a Reminder whose `sentAt` is set, when its
  Task's deadline is edited, the recomputation does not clear `sentAt` — a
  past notification is not re-delivered because a date moved. (Satisfied
  structurally: the recompute's own `SELECT` filters `sentAt IS NULL`, so
  an already-sent row is never selected, let alone written.)
- **AC-A3 (PRD AC-11):** Given a Task-linked relative Reminder whose
  `fireAt` was just recomputed by an edit, the owner sees a distinct pt-BR
  toast naming the new date and time — never a generic "saved" message
  that would hide the change, per the PRD's own Decisions Log rejection of
  Apple Reminders' silent-shift behavior. When the save did not move a
  linked Reminder's `fireAt` (no linked Reminder, or an absolute-time one),
  the existing "Tarefa salva" toast shows unchanged.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The recompute fires on every deadline edit, even a no-op re-save of the same date | L | An unnecessary `UPDATE` per relative Reminder on an unrelated field edit | Task 1's guard is `row.deadline !== existing.deadline`, not merely "a `deadline` key was present" — an edit that resubmits the same date recomputes nothing |
| A Task's deadline is cleared to `null` (switched to `scheduledDate`, or removed) while a relative Reminder is still linked to it | L | The Reminder's `fireAt` goes stale, frozen at the last real deadline, with nothing recomputing it going forward | `TBD - needs validation` — out of this phase's AC-11/AC-12 scope (both scenarios keep the deadline non-null) and the PRD's Decisions Log does not address this transition; recorded here rather than guessed at, per the TBD discipline this project's plan-writer follows |
| The client-side `fireAt` comparison in Task 3 reads a stale `reminders` value because `refreshReminders()`'s state update has not yet re-rendered the closure | M | The "reminder recomputed" toast never fires, or fires on stale data | Task 2 widens `refreshReminders`'s own return value so Task 3 compares against the freshly fetched array directly, never against the `reminders` state variable inside the same closure |
| A suite that passes under Vitest still breaks under `tsc -b` (this project has done this twice) | M | A merged phase ships a type error | `npm run check` (Level 1) runs before Level 2/3 report success, and Task 1/Task 2's own `VALIDATE` chain already exercises `npx tsc -b`/`npm test` directly on the smallest possible diff |
| The Tier A checklist is skipped or its result never recorded, or filed inside the worktree again (phase 3's own mistake) | M | A defect the checklist would have caught ships silently, or the artifact is lost when the worktree is torn down | Task 4 is a dedicated, non-optional task with a `VALIDATE` that fails until `PRPs/reports/reminders/phase-4/ui-ux-checklist.md` — the ARTIFACT root, explicitly not the worktree — exists and contains at least one ✔/✘ line |

## Notes

### Device Verification (owner-performed)

This unit's own exit signal, per the PRD's Phase 4 success signal ("the
owner's phone rings for a real Task-linked reminder and the tap lands on
that Task"), is performed by the owner on his own Android device — not by
the autonomous Implementer, and not automatable:

1. Create (or reuse) a Task with a `deadline` and a relative Reminder
   attached to it (`originOffsetMinutes` set), with a `fireAt` a few
   minutes in the future.
2. With the PWA installed and the app **closed**, wait for the cron sweep
   to dispatch the notification (within 5-10 minutes of `fireAt`, per the
   PRD's own Success Metrics table). Confirm the phone rings and tapping
   the notification opens the app landing on that exact Task — the
   `postMessage`/`notificationclick` path phase 3 built and unit-tested
   but never device-proved.
3. Repeat with the app already **open** in the foreground, confirming the
   in-app `NOTIFICATION_CLICK` listener (`src/app/hooks/useRoute.ts`,
   phase 3 Task 3) navigates to the Task without a page reload.
4. Separately, edit that Task's `deadline` through the app's own Task
   sheet and confirm the "Lembrete reagendado para ..." toast this plan's
   Task 3 adds appears, naming the correct new date and time.
5. Once all of the above are confirmed, update
   `documentation/50-planning/roadmap.md`'s unit 7 row `State` from
   `in-progress` (Task 5 of this plan) to `shipped`, and add the closing
   Delivery history row recording the device proof and that milestone
   **M2** is now reached — this final flip is explicitly the owner's own
   action, not this plan's Task 5, which only records the code landing.

No task in `## Step-by-Step Tasks` performs, simulates, or scripts any part
of this section. This section exists so the plan names the obligation
without assigning it to the autonomous Implementer.


**TDD routing (this plan, against the relay repo):** Current value of `tdd`
in `docs/context/methodology.md`: **true**. Test-first ordering — the test
pair (test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are
routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger
(`/relay-write-test` → `/relay-test-write-review`), not authored by the
Implementer — R-X is a blanket straight-fail on any test glob in the
Implementer's diff. No task above and no `## Files to Change` row targets
a test file, so Task 1's `**VALIDATE**` invokes `npm test` directly against
the pre-authored suite extending `test/task-update.test.ts` for AC-11/AC-12,
and Tasks 2-3's React-glue `**VALIDATE**` invoke `npx tsc -b` plus a
content grep, matching `docs/context/methodology.md`'s explicit statement
that React component/glue verification stays manual.

**Why no new `src/shared/` function was introduced for the recompute.**
The PRD's own Technical Approach names `offsetToInstant` as the helper to
reuse for this phase, and `src/worker/routes/reminders.ts` already
demonstrates the exact call shape (`new Date(offsetToInstant(deadline,
offsetMinutes) * 1000)`) for the identical computation on `PATCH
/api/reminders/:id`. Inventing a second, differently-named function that
does the same arithmetic would be the "hand-duplicated logic" mirror of
the project's hand-duplicated-types anti-pattern, and would double the
DST-fixture surface for zero behavioural gain — the existing AC-3/AC-14
fixtures already cover `offsetToInstant` completely.

**Why the recompute lives in `src/worker/routes/tasks.ts`, not in a new
shared module.** The recompute IS a database write coupled to the Task
update transaction boundary (the same request/response cycle that writes
`patch.deadline`), not a pure function with an interesting decision inside
it — the only "decision" is `offsetToInstant`'s own arithmetic, already
extracted and already tested. Placing the `SELECT`/`UPDATE` pair directly
in the route handler matches where phase 1's own `POST`/`PATCH
/api/reminders/:id` routes already do the equivalent computation, rather
than inventing a service-layer indirection this codebase does not use
anywhere else.

*Generated: 2026-09-09*
*Approved: 2026-09-10*
*Status: IMPLEMENTED*
