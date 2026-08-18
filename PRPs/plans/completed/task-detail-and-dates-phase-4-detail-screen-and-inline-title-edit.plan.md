# Feature: Detail screen and inline title edit (Phase 4 of task-detail-and-dates)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: the unit's only DOM-bound phase; adds the first
  browser-side editing surface; consumes the contract frozen in phase 3;
  triggers `docs/context/methodology.md`'s "split the logic out, then the glue
  is exempt" obligation
- Decisions found:
  - Owner, 2026-08-12 (PRD Decisions Log) — title corrected inline in the list;
    every other field on a detail screen one tap away; the owner chooses
    "complete by" or "do on" explicitly, never by a defaulted field
  - ADR-0004 / ADR-0005 (2026-08-03) — one responsive React 19 SPA, no
    meta-framework, no router dependency added for a two-view app
  - ADR-0008 (2026-08-04) — test-first, but scoped: it does NOT mean React
    component tests, and a purely visual criterion legitimately produces no
    test file
  - `docs/context/methodology.md`, "Browser-API work" (2026-08-11) — the
    resolution is not a blanket exception but a design obligation: extract the
    decidable part into `src/shared` behind a port and test it first; only the
    thin adapter is exempt, verified on the device and recorded
  - `documentation/40-engineering/testing-strategy.md` — UI verification is
    manual by deliberate choice; PRD AC-8 is the unit's only manual criterion
- Applicable anti-patterns:
  - Hand-duplicated entity types (`docs/anti-patterns.md:91-96`) — the edit
    form builds an `UpdateTaskInput`; it never restates the Task shape
  - Glossary synonym drift (`docs/anti-patterns.md:112-117`) — the two date
    controls are labelled "complete by" and "do on", never merged into "due"
  - Offline write queue (`docs/anti-patterns.md:12-17`) — editing is online
    only; a failed save surfaces an error and keeps the owner's text
  - Weakening tests to force green (`docs/anti-patterns.md:119-124`)
  - Portuguese in artifacts (`docs/anti-patterns.md:105-110`)
- Applicable architectural rules:
  - `src/shared/` compiles into BOTH targets, so it carries no DOM globals and
    no runtime dependencies (`src/shared/api.ts:1-13`)
  - The API produces the list order; the client never re-sorts it (phase 3's
    frozen contract)
  - The route owns omitted-vs-null; the client's job is to send only the keys
    the owner actually changed
  - No API route is added, removed or renamed in this phase
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/task-detail-and-dates.prd.md` — Implementation Phases row 4:
  "Detail screen and inline title edit" — Goal: the owner reaches all of it —
  title corrected in place, everything else one tap away — Success signal (PRD
  Phase Details): covers AC-8, verified manually on both devices, and runs last
  per the project's API-first delivery discipline.

## Summary

This phase gives the owner the two interactions the unit exists for, matching
the two distinct moments the PRD names: correcting a typo right after capture,
and deciding *when* something must happen later. Tapping a title in the list
turns it into an input that saves on blur or Enter and abandons on Escape;
tapping a Task's detail affordance opens a panel carrying description, the
explicit "complete by" / "do on" choice, and priority. Almost all of the
interesting behaviour is not DOM behaviour at all — it is deciding which keys
changed and turning them into the minimal `UpdateTaskInput` the phase-2 route
expects, including the date-exclusivity and clear-versus-omit rules. That part
is extracted into a pure `src/shared/task-edit.ts` and authored test-first, per
`docs/context/methodology.md`'s standing obligation; only the thin React
adapter is manually verified, which is what PRD AC-8 already says.

## User Story

```
As the owner
I want to fix a title where I see it, and set a date and priority one tap away
So that a Task captured in three seconds becomes correct without being deleted
and retyped
```

## Problem Statement

Every field this unit made editable is reachable by nothing. Phases 1–3 shipped
the priority enum, `PATCH /api/tasks/:id` and the frozen read contract, and the
owner cannot touch any of it: `src/app/App.tsx` renders a title as a plain
`<span>` with only a complete toggle and a delete button beside it. The exit
signal for the whole unit — "a Task created in a hurry was later corrected
(title and date) instead of deleted and recreated" — is unmeasurable until this
phase lands, and the second success metric (one dated Task in three) is
unreachable because no interface can set a date.

## Solution Statement

Keep the app a single React SPA with no router: a `selectedTaskId` piece of
state decides whether the board renders the list or the detail panel, which is
the whole navigation model a two-view, single-user app needs. Extract the
decidable core into `src/shared/task-edit.ts`: `dateModeOf`, which reads a
Task's current date mode, and `buildTaskPatch`, which diffs a draft against the
original and returns only the changed keys as an `UpdateTaskInput` — clearing
with an explicit `null`, omitting what did not change, and never emitting both
dates at once. The React layer then does one thing: collect a draft, call
`buildTaskPatch`, and skip the request entirely when the patch is empty (the
route rejects an empty body by design). Inline title editing reuses the same
`updateTask` call with a one-key patch. A failed save keeps the owner's text on
screen, matching the invariant unit 1 already established for capture.

## Metadata

| Key | Value |
|---|---|
| Type | UI phase + pure edit-logic module |
| Complexity | Medium — the logic is small and testable; the surface is manual |
| Systems Affected | `src/shared` (new edit module), the SPA (`src/app/App.tsx`), authoritative + derived docs |
| Dependencies | Phase 2 (`complete`) for `PATCH` and `updateTask`; phase 3 (`complete`) for the ordering the list renders |
| Estimated Tasks | 6 |
| Source PRD line ref | `PRPs/prds/task-detail-and-dates.prd.md:314` (Implementation Phases row 4); Phase Details at `:339-341` |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/task-detail-and-dates.prd.md` | 178-180, 226-251, 339-341 | AC-8 verbatim, the two triggers and the User Flow the screens must match, and the phase's own scope |
| P0 | `src/app/App.tsx` | 115-274 | The `TaskBoard` this phase extends — its `run`/`refresh` error plumbing, the list rows, and the failed-save invariant already locked in at lines 179-191 |
| P0 | `src/shared/api.ts` | 62-90 | `UpdateTaskInput` and `EDITABLE_TASK_FIELDS` — the contract the new pure module must emit and must not exceed |
| P0 | `docs/context/methodology.md` | 37-62 | The "split the logic out, then the glue is exempt" obligation this phase is the second real test of |
| P1 | `src/app/api.ts` | 81-115 | `listTasks` and `updateTask` — the two calls this phase wires, already shipped and typed |
| P1 | `src/shared/share-target.ts` | 1-30 | The house shape for a small pure module in `src/shared`: narrow signature, no DOM, documented contract |
| P1 | `documentation/40-engineering/testing-strategy.md` | 1-49 | Why the DOM half is manual, and what a manual verification record has to contain |
| P2 | `docs/api-reference.md` | 13-60 | The frozen read contract the list renders and the `PATCH` semantics the forms rely on |

## Patterns to Mirror

```ts
# SOURCE: src/app/App.tsx:152-162
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (cause) {
      handleFailure(cause);
    } finally {
      setBusy(false);
    }
  }
```

The single mutation path every write in this app goes through: busy flag, action,
refresh, centralised failure handling that already converts a 401 into the token
gate. Every new save in this phase goes through `run` rather than calling the
API directly. Reused by Tasks 3 and 4.

```tsx
# SOURCE: src/app/App.tsx:177-191
          void run(async () => {
            await createTask({ title: trimmed });
            setTitle("");
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
          });
```

The failed-save invariant, locked in by unit 1 and inherited here: the input is
cleared only AFTER the awaited call succeeds, so a thrown failure leaves the
owner's typed text on screen. The inline title editor and the detail form both
follow this sequencing — never reset local state before the await returns.
Copied by Tasks 3 and 4.

```tsx
# SOURCE: src/app/App.tsx:224-245
        {open.map((task) => (
          <li key={task.id} style={styles.item}>
            <button
              style={styles.link}
              type="button"
              disabled={busy}
              onClick={() => void run(() => completeTask(task.id))}
            >
              ○
            </button>
            <span style={styles.grow}>{task.title}</span>
```

The list row this phase modifies: the `<span>` becomes the inline-edit
affordance, and a detail button joins the existing complete and delete buttons.
The `disabled={busy}` and `aria-label` conventions carry over to every control
added. Rewritten by Task 3.

```ts
# SOURCE: src/shared/api.ts:102-107
/** `YYYY-MM-DD`, and a real date on the calendar (rejects 2026-02-31). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
```

The pure-helper idiom `src/shared/task-edit.ts` follows, and the exact validator
the detail form reuses before offering a date to `buildTaskPatch` — the client
rejects an impossible date locally rather than waiting for the route's 400.
Mirrored by Task 1.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/task-edit.ts` | CREATE | The decidable core: `dateModeOf` and `buildTaskPatch`, extracted so the omitted-vs-null and date-exclusivity rules are unit-tested rather than trapped in a component |
| `src/app/App.tsx` | UPDATE | Inline title editing in the list, the detail panel, and the `selectedTaskId` state that switches between them |
| `docs/domain/areas/tasks.md` | UPDATE | Record that FR-002 is reachable by the owner, closing the derived area doc's account of unit 2 |
| `documentation/50-planning/roadmap.md` | UPDATE | Unit 2's delivery entry and its exit signal — the phase that makes the signal measurable is the one that should record it |

## NOT Building (Scope Limits)

- **Filters, the today view, or day grouping.** FR-007 is unit 3. The list
  renders the API's order; it adds no controls over it.
- **Life Area assignment.** FR-008 is unit 13; `lifeAreaId` is not editable.
- **Recurrence UI.** Unit 9. The detail panel shows no series information and
  offers no "edit this occurrence vs the series" choice.
- **Reminders on a Task.** FR-025 (Task side) is unit 7.
- **Undo of an edit.** Needs an edit-history table nothing else wants yet.
- **Bulk editing.** One owner, a few hundred Tasks.
- **Natural-language dates.** Explicitly parked until after the MVP.
- **A router or a design pass.** Two views need `useState`, not a dependency;
  styling stays the deliberately minimal inline-style system already in place.
- **React component tests.** ADR-0008 scopes test-first to the automated tier,
  and `documentation/40-engineering/testing-strategy.md` keeps UI verification
  manual. The decidable logic is extracted and tested instead; AC-8 is verified
  on both devices and recorded.
- **Authoring or editing test files.** Under `tdd: true` the suite for this
  phase is authored by the `test-writer`/`test-reviewer` pair before the
  Implementer runs, and R-X strict forbids the Implementer from touching a test
  file. No task here edits `test/`; Task 5 only *runs* the suite.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/task-edit.ts`

- **ACTION**: Create the module importing only types and the `isCalendarDate`
  validator from `./api` — no DOM globals, no runtime dependency. Export a mode
  union declared exactly
  `export type TaskDateMode = "none" | "deadline" | "scheduled";`. Export
  `export function dateModeOf(task: TaskDto): TaskDateMode` returning
  `"deadline"` when the Task carries one, `"scheduled"` when it carries a
  scheduled date, and `"none"` otherwise. Export a draft shape declared exactly
  `export interface TaskDraft` with `title: string`, `description: string`,
  `dateMode: TaskDateMode`, `date: string` and `priority: TaskPriority | null` —
  all non-optional, because a form always has a current value for each. Export
  `export function buildTaskPatch(original: TaskDto, draft: TaskDraft): UpdateTaskInput`
  returning ONLY the keys whose value actually changed, per these rules: a
  trimmed `title` differing from the original is included (an empty trimmed
  title is never emitted — the caller refuses to save it); `description` is
  included as the trimmed string, or as `null` when trimmed empty and the
  original was non-null; `priority` is included when it differs, `null`
  clearing it; and the date is resolved from `dateMode` — `"none"` clears
  whichever date the original carried (emitting that one key as `null`),
  `"deadline"` with a value passing `isCalendarDate` emits `deadline` when it
  differs from the original's, `"scheduled"` likewise emits `scheduledDate`, and
  a mode carrying an empty or invalid date emits nothing for the date at all.
  NEVER emit both `deadline` and `scheduledDate` in one patch: the route clears
  the other side itself, and sending both is a 400. An unchanged draft yields
  `{}`. Document that an empty result means "nothing to save" and the caller
  must skip the request, because `PATCH` rejects an empty body by design.
- **MIRROR**: `# SOURCE: src/shared/api.ts:102-107` (the pure-helper idiom and
  the `isCalendarDate` validator reused here).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export type TaskDateMode = "none" | "deadline" | "scheduled";' src/shared/task-edit.ts
  grep -q 'export function dateModeOf' src/shared/task-edit.ts
  grep -q 'export function buildTaskPatch' src/shared/task-edit.ts
  npx tsc -b
  ```
- Delivers AC-A1, AC-A2, AC-A3.

### Task 2: UPDATE `src/app/App.tsx` (detail panel state)

- **ACTION**: In `TaskBoard`, add a `selectedTaskId` state initialised to
  `null`, and derive the selected Task from the already-loaded `tasks` array
  rather than re-fetching it. When `selectedTaskId` names a Task that is
  present, render the detail panel INSTEAD of the capture form and the lists;
  otherwise render the board exactly as today. Add no router and no dependency —
  two views are a `useState`, and ADR-0005 records the no-meta-framework
  position. When a refresh removes the selected Task (deleted elsewhere), fall
  back to the list rather than rendering an empty panel.
- **MIRROR**: `# SOURCE: src/app/App.tsx:152-162` (the `run`/`refresh` plumbing
  the panel's saves go through).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'selectedTaskId' src/app/App.tsx
  if grep -qE '"(react-router|react-router-dom|wouter)"' package.json; then
    echo "FAIL: a router dependency was added; two views need useState (ADR-0005)"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A4.

### Task 3: UPDATE `src/app/App.tsx` (inline title edit)

- **ACTION**: Replace the open-list row's plain title `<span>` with an
  affordance that enters edit mode on click. While editing, render an input
  seeded from the Task's title whose `aria-label` reads `Edit title of` followed
  by the Task's title; commit on Enter and on blur by calling `updateTask` with
  a one-key title patch through the existing `run` helper, and abandon on
  Escape without saving. Skip the request entirely when the trimmed title is
  unchanged or empty — an empty body and an empty title are both 400s, and the
  owner should not meet either. Follow the failed-save sequencing: leave edit
  mode only after the awaited call resolves, so a failure keeps the typed text
  on screen. Add a separate detail button to the row, whose `aria-label` reads
  `Open` followed by the Task's title, that sets `selectedTaskId`, keeping the
  existing complete and delete buttons and their `disabled={busy}` convention
  untouched.
- **MIRROR**: `# SOURCE: src/app/App.tsx:224-245` (the row being rewritten),
  `# SOURCE: src/app/App.tsx:177-191` (clear local state only after the await
  resolves).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'Edit title of' src/app/App.tsx
  grep -q 'updateTask' src/app/App.tsx
  npx tsc -b
  ```
- Delivers AC-A5.

### Task 4: UPDATE `src/app/App.tsx` (detail panel form)

- **ACTION**: Render the detail panel for the selected Task with: a back control
  returning to the list; the title as an editable input; a description
  `textarea`; an explicit date control offering exactly three mutually exclusive
  choices labelled `No date`, `Complete by` and `Do on` — never one date field
  with a defaulted meaning, because the owner's 2026-08-12 decision is that the
  choice is explicit and hiding it behind a default would let the
  cheaper-to-type option silently win — plus a date input enabled only when a
  dated mode is chosen; and a priority select offering `Not set`, `High`,
  `Normal`, `Low`. Seed the draft from the Task via `dateModeOf`. On save, call
  `buildTaskPatch(task, draft)`; when the result has no keys, close the panel
  without issuing a request; otherwise call `updateTask` with the patch through
  the existing `run` helper and close only after it resolves. Show the same
  `styles.error` surface the board already uses on failure. Do not render or
  edit `lifeAreaId`, `status`, `detached` or any other non-editable field.
- **MIRROR**: `# SOURCE: src/app/App.tsx:152-162` (`run` plumbing),
  `# SOURCE: src/app/App.tsx:177-191` (close only after the await resolves).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'buildTaskPatch' src/app/App.tsx
  grep -q 'Complete by' src/app/App.tsx
  grep -q 'Do on' src/app/App.tsx
  if grep -q 'lifeAreaId' src/app/App.tsx; then
    echo "FAIL: the detail panel must not touch lifeAreaId (unit 13 owns it)"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A6.

### Task 5: RUN the suites and build the SPA

- **ACTION**: Run the full test suite and the production build. The suite covers
  the extracted `task-edit` module and every API-level guarantee phases 1–3
  shipped; the build is what type-checks the React layer this phase adds, since
  no component test exists by deliberate choice. Confirm every pre-existing
  assertion still passes untouched — a failure is a regression to fix in the
  code, never a test to weaken (`docs/anti-patterns.md:119-124`).
- **MIRROR**: `# SOURCE: src/app/App.tsx:152-162` — the mutation path whose
  behaviour the API-level suites exercise end to end.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  npm run db:migrate
  npm test
  npm run build
  ```
- Delivers AC-A7 (verification of AC-A1 through AC-A6, minus the DOM half).

### Task 6: UPDATE the delivery record

- **ACTION**: In `documentation/50-planning/roadmap.md`, move unit 2 to
  delivered, recording what the four phases shipped and — per the roadmap's own
  convention for unit 1 — what the manual verification did and did not prove.
  State plainly that AC-8 was verified by hand and that the remote D1 migration
  is an owner-run step that may still be outstanding, so a later reader is not
  misled into thinking production carries the new schema. In
  `docs/domain/areas/tasks.md`, record that editing (FR-002) is reachable by the
  owner. Set `last_updated` on every edited `documentation/` file and mirror the
  date in the status panel of `documentation/README.md`.
- **MIRROR**: `# SOURCE: src/shared/api.ts:102-107` — the shipped contract the
  delivery record describes.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'task-detail-and-dates' documentation/50-planning/roadmap.md
  npx vitest run --project docs
  ```
- Delivers no AC directly — this is infrastructure / scaffolding work
  (authoritative and derived documentation); CLAUDE.md makes "affected docs
  updated" part of the Definition of Done, and the maintenance map routes a
  completed milestone to the roadmap.

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

**Level 3 — BUILD + STRUCTURAL GATE**

```bash
set -euo pipefail
npm run db:migrate
npm test
npm run build
grep -q 'buildTaskPatch' src/app/App.tsx
if grep -q 'lifeAreaId' src/app/App.tsx; then
  echo "FAIL: the detail panel must not touch lifeAreaId (unit 13 owns it)"; exit 1
fi
```

`npm run build` is this phase's real Level 3: with no browser tier, the
production build (`tsc -b && vite build`) is the only automated gate that
type-checks and bundles the React layer. The two greps pin the phase's own
structural commitments — the panel routes its save through the tested pure
module, and it never touches a field unit 13 owns. **The DOM behaviour of AC-8
is NOT covered by any command here and is verified by hand** — see `## Notes`
for the manual script.

## Acceptance Criteria

- **AC-A1 (PRD AC-8):** `buildTaskPatch` returns only the keys whose value the
  owner actually changed; an unchanged draft yields an empty patch, which the
  caller treats as "nothing to save" rather than issuing a request.
- **AC-A2 (PRD AC-8):** clearing a field in the form emits that key as an
  explicit `null`, while a field the owner did not touch is omitted entirely —
  the client half of PRD AC-2's omitted-versus-cleared rule.
- **AC-A3 (PRD AC-8):** a patch never carries both `deadline` and
  `scheduledDate`; choosing one date mode emits only that mode's key, and
  choosing `No date` clears whichever date the Task carried.
- **AC-A4 (PRD AC-8):** selecting a Task opens the detail panel and returning
  restores the list, with no router dependency added.
- **AC-A5 (PRD AC-8):** a title corrected in place in the list persists without
  the detail screen being opened; Escape abandons the edit; a failed save keeps
  the typed text on screen.
- **AC-A6 (PRD AC-8):** the detail panel exposes description, an explicit
  "complete by" / "do on" / "no date" choice, and priority — and exposes no
  field outside `EDITABLE_TASK_FIELDS`.
- **AC-A7 (PRD AC-7):** every pre-existing assertion in the four existing Task
  suites passes without being edited, and the production build succeeds.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The edit logic hides in the component and is never tested | High without mitigation | High — the omitted-vs-null rule is the unit's subtlest behaviour | `docs/context/methodology.md`'s standing obligation is applied literally: `buildTaskPatch` and `dateModeOf` are pure, live in `src/shared`, and are authored test-first. Only the React adapter is exempt |
| The DOM half regresses unnoticed, since no browser tier exists | Medium | Medium | AC-8 is verified by hand against the script in `## Notes`, and the result is recorded in the roadmap's delivery entry — the same discipline unit 1 phase 2 used. The roadmap backlog already carries a real browser tier with its trigger (unit 6's push work) |
| A defaulted date field lets the cheaper option silently win | Medium | Medium | The control offers three explicit mutually exclusive choices, never one field with an implied meaning; AC-A6 pins it, and the owner's 2026-08-12 decision is quoted in Task 4 so a later reader does not "simplify" it away |
| An empty patch produces a confusing 400 | Medium | Low | `buildTaskPatch` returns `{}` for an unchanged draft and the caller skips the request entirely, so the route's deliberate empty-body 400 is never shown to the owner |
| The owner edits a Task on a stale list and overwrites a newer value | Low | Low | Single user, single device at a time (CON-002); no concurrent-edit protection is designed, and adding optimistic concurrency here would freeze a shape unit 14's sync work has not designed |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **This phase's test-file updates are routed through the
  `test-writer`/`test-reviewer` pair, not authored by the Implementer.** Under
  `tdd: true` the pair writes the suite for the extracted module before the
  Implementer runs, and R-X strict forbids the Implementer from touching any
  test file. No task in `## Step-by-Step Tasks` edits a test file and no
  `## Files to Change` row names one — Task 5 only *runs* the suite.
- **What is tested and what is verified by hand, stated plainly.** The pure
  module carries every rule worth asserting: which keys a patch contains,
  clearing versus omitting, and date exclusivity. What remains DOM-bound is
  genuinely thin — click to enter edit mode, Enter/blur/Escape, panel open and
  close — and has no honest automated path in this project's only test tier
  (Vitest inside workerd, which has no DOM). That is the split
  `docs/context/methodology.md` prescribes, applied rather than invoked as an
  excuse.
- **Manual verification script for AC-8** (run with `npm run dev`, then repeat
  on the phone against the deployed build):
  1. Capture a Task with a deliberate typo; tap its title in the list, correct
     it, press Enter. It persists after a reload, without the detail screen
     having been opened.
  2. Tap the title again, change it, press Escape. The original is intact.
  3. Open a Task's detail; set a description and priority `High`; save; reopen
     and confirm both survived.
  4. Choose `Complete by` with a date, save, reopen, and switch to `Do on` with
     a different date. The deadline is gone and only the scheduled date remains.
  5. Choose `No date`, save, and confirm the Task moves to the undated group at
     the end of the list — which also confirms phase 3's ordering end to end.
  6. Stop the dev server and attempt a save; the error surface appears and the
     typed text is still on screen.
- **Research grounding was performed inline by the main session**, not via the
  `research-codebase` / `research-web` subagents: this session carries an
  explicit instruction not to dispatch agents without the user asking — the same
  constraint recorded in unit 1's PRD and in this PRD's own Research Summary.
  Every `# SOURCE:` anchor is a real `file:line` read in this session against
  the phase-3 worktree state. `research-web` returned no findings (degradation
  reason: not dispatched).

*Generated: 2026-08-15*
*Approved: 2026-08-15*
*Implemented: 2026-08-15*
*Status: IMPLEMENTED*
