# Feature: The screen (Phase 4 of recurring-tasks)

```
**Decision Gate**
- Active context: none
- Activated criteria: new UI surface in src/app/ (screen change requiring the ui-ux-guidelines.md review checklist before merge, not after — the v0.8.1 lesson); domain rule for tasks (recurrence, ADR-0006) exposed through the sheet for the first time; the layout standard's pre-decided plug-in point for units 9-12 ("Series glyph in the row metadata", ui-layout-standard.md §6); documentation updates as part of the Definition of Done (CLAUDE.md maintenance map)
- Decisions found: ADR-0006 recurrence model — materialize only the current occurrence; the rule is fixed at series creation and never edited afterward (Decisions Log D11, "Won't: end the series and create a new one"); ADR-0009 visible UI copy in pt-BR, identifiers/comments/tests/docs stay English; ADR-0010/ADR-0011 visual identity and the owned UI library — components under src/app/components/ui/ first, tokens only, no second scale; ADR-0001 all artifacts in English (carved out for visible copy by ADR-0009); ADR-0005/ADR-0003 one Worker, no offline writes, hand-duplicated entity types forbidden — types flow from src/worker/db/schema.ts through src/shared/api.ts; the 2026-08-29 rule that an APPROVED PRD's phase table changes only via a dated amendment (not touched by this phase); the recurring-tasks PRD's own Decisions Log D1/D5/D9 (day-of-month/weekday fallback, completion anchor, reminder-offset resolution) already implemented in Phases 1-3 and reused here unchanged
- Applicable anti-patterns: Hand-duplicated entity types (`CreateSeriesInput`/`SeriesDto`/`RecurrenceSeriesDto` already exist in `src/shared/api.ts` — reuse verbatim, never redeclare); Portuguese in artifacts (carve-out: visible chip/label copy is pt-BR; identifiers, comments and tests stay English); Glossary synonym drift (say "Série de repetição"/"Recurrence Series"/"Tarefa" in copy — never "hábito", "rotina", "repeat task"); Weakening tests to force green (no task in this plan touches a test file — see Notes)
- Applicable architectural rules: decidable logic lives in `src/shared/`, not in components (`src/app/components/ui/` for primitives, `src/app/components/` for screens); tokens only, no raw literals, no second scale (guidelines §3.5/§12.2); the UI/UX review checklist is a gate BEFORE the merge, not after (roadmap Delivery history, 2026-09-17); API-first internally is already satisfied — Phases 2-3 shipped `POST/GET/PATCH /api/series` and successor spawning before this UI phase exists; no offline write queue, no second sync engine
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/recurring-tasks.prd.md` — Implementation Phases row 4: "The screen" —
  Goal: The owner earns the exit signal on his own device. — Success signal: UI/UX
  checklist ✔/✘ in the plan record before the merge; AC-28 observed on the owner's
  device and recorded in Delivery history.

## Summary

Phases 1-3 built the whole recurrence machine — the pure expansion function, the
`/api/series` routes, and successor spawning on complete — but none of it is
reachable from the screen the owner actually opens every day. This phase closes
that gap: it adds a *Repetir* control to the existing Task sheet, visible only on
a Task that is not already part of a series (matching the PRD's D11 "Won't: the
rule is fixed at creation, never edited afterward"); wires it to
`POST /api/series` (already shipped) through a new pure `src/shared/series-edit.ts`
module that assembles the request from the sheet's existing title/date/priority
draft plus the chosen rule and whatever ad-hoc Reminder the owner already set;
renders a small series glyph in `TaskRow`'s metadata line for any Task that
belongs to a series — the exact plug-in point `ui-layout-standard.md` §6 already
reserved for units 9-12; and confirms the "successor visible without a reload"
half of AC-26 is already produced by `TodayScreen`'s existing
`refresh()`-after-`completeTask()` flow, with no new code required for that part.
The phase closes with the mandatory pre-merge UI/UX checklist run and the
documentation updates the project's Definition of Done requires.

## User Story

As the owner, I want to mark a Task as repeating right from the sheet I already
use to edit it, so that Praesto keeps materializing the next occurrence for me
without ever having to re-type "pagar aluguel" again.

## Problem Statement

Phases 1-3 delivered a fully working recurrence engine with 25 passing acceptance
criteria, but it is only reachable by `curl`. Without a *Repetir* control there is
no way for the owner to register "pay rent on the 5th" once; without a series
glyph, a materialized recurring Task is visually indistinguishable from every
other row, so the owner cannot tell which Tasks will spawn a successor and which
will not.

## Solution Statement

Add a *Repetir* chip group (frequency) and an end-condition chip group (never /
until a date / after N times) to `TaskSheet`'s detail form, shown only when the
open Task's `seriesId` is `null`. The day-of-month or weekday is never asked for
separately — it is derived from the Task's own already-chosen date (`dtstart`),
exactly as `src/shared/recurrence.ts`'s own fallback already does server-side.
Saving with a repetition selected calls the new `createSeries` API wrapper
(mirroring the existing one-liner wrappers), then deletes the original one-off
Task row now that its series-backed replacement exists, then refreshes the list —
mirroring the sheet's existing save/delete/refresh pattern exactly. `TaskRow`
gains a small repeat glyph, shown whenever `task.seriesId !== null`. Finally,
`documentation/` and `docs/` are updated per the maintenance map, and the UI/UX
guidelines' Tier A checklist is run and recorded in this plan's `## Notes` before

### UI/UX Checklist Result (Task 6) — recorded 2026-09-24, BEFORE the merge

Run against this phase's own diff per `documentation/40-engineering/ui-ux-guidelines.md`. Transcribed by the
command: the implementer ran the analysis but is forbidden from editing this plan (D8), so it handed the result
back for recording here.

**Method, stated honestly because it bounds what the result is worth:** static inspection of the diff against the
already-shipped primitives it reuses (`Chip`/`ChipGroup`, the `sheet-date` input pattern, the existing
priority-glyph meta-line), NOT a live browser-pane interaction pass — the implementer had no browser or device
tool in its invocation. Items marked *(inferred)* were not measured on a running screen.

| # | Item | Result |
|---|---|---|
| 1 | One primary action per screen | ✔ — *Salvar* stays the sheet's single primary action; *Repetir* and the end-condition are secondary fields on the same form |
| 2 | Touch targets | ✔ *(inferred)* — every new control reuses `Chip`/`ChipGroup` or the exact `min-h-12 … px-4` input className already shipped on `sheet-date`; no new class introduces a smaller target |
| 3 | Never colour alone | ✔ — the series glyph pairs an aria-hidden `Repeat` icon with the literal word *Repete*; end-condition chips are text-labeled; the reminder-drop notice is plain text |
| 4 | pt-BR copy, sentence case | ✔ — *Repetir*, *Não repete*, *Diariamente*…, *Até quando?*, *Nunca* / *Até uma data* / *Depois de N vezes*, *Repete*, *Série criada*, plus the three `recurrenceDraftError` messages |
| 5 | Visible focus | ✔ *(inferred)* — native `<input>` / `ChipGroup` / `Chip` carry the project's global `:focus-visible` token styling; no new dialog or focus-trap code |
| 6 | Labels and names | ✔ **with a caveat** — the two new inputs (`sheet-recurrence-until`, `sheet-recurrence-count`) use `aria-label` only, no separate `<label>`, mirroring the already-shipped `sheet-date` input exactly. A pre-existing characteristic rather than a new regression, but it is the one item that deserves a real device look before the checklist is called fully discharged |
| 7 | Tokens, no raw values | ✔ — every new className is a reused token utility already present in the file; no raw literal, no new motion |
| 8 | Destructive actions confirm | ✔ (N/A) — no new destructive control |
| 9 | Network calls | ✔ — the only new call (`createSeries` → `/api/series`) is same-origin through the existing `request<T>()` wrapper |

**Standing owed:** item 6's `aria-label`-only pattern, and items 2 and 5, are inferred rather than observed. The
owner's device pass (AC-28) is where they get real eyes. This checklist ran before the merge, which is the rule the
v0.8.1 incident produced — but "before the merge" and "on a real screen" are different guarantees, and only the
first one is discharged here.
the phase can be merged.

## Metadata

| Field | Value |
|---|---|
| Type | Feature (UI + one supporting pure module) |
| Complexity | Medium |
| Systems Affected | `src/app/components/TaskSheet.tsx`, `src/app/components/TaskRow.tsx`, `src/app/components/TodayScreen.tsx`, `src/app/api.ts`, `src/shared/series-edit.ts` (new), `docs/context/architecture.md`, `docs/domain/areas/tasks.md`, `documentation/50-planning/roadmap.md` (`documentation/30-architecture/architecture-overview.md` was checked and deliberately left untouched — see Task 7's Correction note) |
| Dependencies | Phase 2 (`series-api`, complete) — `POST/GET/PATCH /api/series`; Phase 3 (`materialization-on-close`, complete) — successor spawning, delete-skip, reopen-undo |
| Estimated Tasks | 8 |
| Source PRD line ref | `PRPs/prds/recurring-tasks.prd.md:408` (Implementation Phases row 4), `:427-430` (Phase 4 Details) |
| phase_type | feature |

**Why `feature`, not `foundation` or `scaffold`:** this phase writes real
application source (a pure module plus three component updates), and its
Validation Commands are framework/type-check invocations, not filesystem
probes — ruling out `scaffold`. It does not introduce a seam other phases
build on top of — the seam (`recurrence_series`, `/api/series`,
`CreateSeriesInput`/`SeriesDto`) was already created in Phases 1-2 — so
`foundation` would be inaccurate here even though one new pure module is
added; that module is the phase's *delivery*, not infrastructure for a later
phase. `docs_sync: true` in `docs/context/methodology.md` is a project-wide
default, not a per-phase override; `figma_track: false`, so no
`design_source` row is added to this table, and the source PRD carries no
`## Visual-First Mode` section, so `phase_scope` is not added either — both
byte-identical to every other row in this table, per their own
never-inferred lineage.

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `docs/context/methodology.md` | 24-62 | The TDD scope split this phase's task list depends on: automated tests apply to pure `src/shared` logic, never to React components; a purely visual AC legitimately produces no test file |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 1-172 (whole doc; review checklist at 146-168) | Mandatory before touching anything under `src/app/`; Task 6 runs its Tier A checklist and pastes the ✔/✘ result here, before the merge |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 40-41 (§3 detail content order), 55-66 (§6 "where the upcoming units plug into") | §3 fixes where a new field lands in the sheet's field order; §6 line 65 pre-decides "Series glyph in the row metadata" for units 9-12 — Task 5 implements exactly that, nothing else |
| P1 | `src/app/components/TaskSheet.tsx` | 92-227 | The detail form Task 3 extends: title/description/date-chip/priority-chip/reminder pattern to mirror for the new Repetir + end-condition chip groups |
| P1 | `src/app/components/TaskRow.tsx` | 14-30, 96-127 | The row's meta-line insertion pattern (priority glyph via `splitMeta`) Task 5 mirrors for the series glyph |
| P1 | `src/app/components/TodayScreen.tsx` | 529-572 | `saveSheet()`/`deleteSheetTask()` — the server-first mutation + refresh pattern Task 4 mirrors for the create-series-then-delete-original flow |
| P1 | `src/shared/task-edit.ts` | 1-95 | `TaskDraft`/`buildTaskPatch` — the exact pure-draft-to-wire-patch shape Task 1's `buildCreateSeriesInput` mirrors |
| P1 | `src/shared/recurrence.ts` | 164-168, 196-223 | Confirms `byWeekday`/`byMonthday` fall back to the rule's own `dtstart` day/weekday when omitted — the reason Task 1/3 need no separate "day" picker |
| P1 | `src/worker/routes/series.ts` | 59-150 | `POST /api/series`'s validation order and field shape — what `buildCreateSeriesInput` must produce to pass first-try |
| P2 | `src/shared/api.ts` | 306-365, 49-52 | `CreateSeriesInput`, `SeriesDto`, `EDITABLE_SERIES_FIELDS`, `CompleteTaskResponse` — the wire types this phase reuses, never redeclares |
| P2 | `docs/domain/areas/tasks.md` | 1-37 | Existing recurrence business rules Task 8 confirms are now reflected as delivered, not planned |
| P2 | `docs/context/architecture.md` | 17-41 | The stale "Not built yet: recurrence machinery" line (41) and the `src/shared/` inventory row (23) Task 7 corrects/extends |
| P2 | `documentation/50-planning/roadmap.md` | 46-73 | The Delivery units table; unit 9's own row (62) and unit 8's row (61), whose phrasing Task 8 mirrors |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-edit.ts:50-67
export function buildTaskPatch(original: TaskDto, draft: TaskDraft): UpdateTaskInput {
  const patch: UpdateTaskInput = {};
  const title = draft.title.trim();
  if (title !== "" && title !== original.title) patch.title = title;
  const description = draft.description.trim();
  const nextDescription = description === "" ? null : description;
  if (nextDescription !== original.description) patch.description = nextDescription;
  if (draft.priority !== original.priority) patch.priority = draft.priority;
  applyDate(patch, original, draft);
  return patch;
}
```
Copied by: Task 1 (`buildCreateSeriesInput`'s draft-to-wire-body shape and the
"assemble only what changed / is set" discipline — though a create body, unlike
a patch, always emits every required field).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:130-141
<ChipGroup
  multiple={false}
  label="Data"
  value={[shownDraft.dateMode]}
  onValueChange={(next) =>
    onDraftChange({ dateMode: (next[0] as TaskDateMode | undefined) ?? "none" })
  }
>
  <Chip value="none">Sem data</Chip>
  <Chip value="deadline">Concluir até</Chip>
  <Chip value="scheduled">Fazer em</Chip>
</ChipGroup>
```
Copied by: Task 3 (the Repetir frequency chip group and the end-condition chip
group — same `ChipGroup`/`Chip` primitives, same single-select shape).

```tsx
# SOURCE: src/app/components/TaskRow.tsx:96-127 (splitMeta insertion, see also :14-30)
{meta !== null && metaSplit !== null && (
  <span className={cn("font-data text-t1 font-medium text-muted tabular-nums", meta.overdue && "text-overdue")}>
    {metaSplit.prefix}
    {metaSplit.priorityWord === "alta" && <ChevronUp className="inline size-3" aria-hidden="true" />}
    {metaSplit.priorityWord === "baixa" && <ChevronDown className="inline size-3" aria-hidden="true" />}
    {metaSplit.priorityWord !== null && ` ${metaSplit.priorityWord}`}
  </span>
)}
```
Copied by: Task 5 (inserting the series glyph into the same meta-line span,
gated on `task.seriesId !== null` rather than on `task.priority`).

```ts
# SOURCE: src/app/components/TodayScreen.tsx:529-561 (saveSheet), :563-572 (deleteSheetTask)
void runSheet(async () => {
  await updateTask(sheetTask.id, changes);
  dispatchSheet({ type: "saved", taskId: sheetTask.id });
  const nextReminders = await refreshReminders();
  // ...
  showToast({ key: "task-saved", text: "Tarefa salva" });
});
```
Copied by: Task 4 (the server-first `runSheet`-style mutation, in the order
create-series-succeeds-first, then delete-original, then refresh — never the
reverse, so a failed delete never loses data).

```ts
# SOURCE: src/app/components/TodayScreen.tsx:221 (state), :992-1018 (props into TaskSheet)
const [taskReminderDraft, setTaskReminderDraft] = useState<ReminderDraft | null>(null);
// ...
<TaskSheet
  // ...
  reminderDraft={taskReminderDraft}
  onOpenReminder={() => {
    setTaskReminderDraft(draftFromReminder(sheetTaskReminder));
    dispatchSheet({ type: "open-reminder" });
  }}
  onReminderDraftChange={(changes) =>
    setTaskReminderDraft((prev) => (prev === null ? prev : { ...prev, ...changes }))
  }
  onReminderSave={() => { /* ... */ }}
/>
```
Copied by: Task 3 and Task 4 together — `TaskSheet`'s own header comment says
it "never holds state of its own beyond what it last saw"; the Reminder
editor already solves the identical shape mismatch (a draft for an endpoint
that is not `PATCH /api/tasks`) by keeping it in `TodayScreen`'s own
`useState`, never inside `TaskSheet` or `task-sheet.ts`'s reducer. The
Repetir draft follows the exact same ownership split, not a `TaskSheet`-local
`useState` (a research-codebase finding surfaced this precedent after the
first draft of this plan placed the state in the wrong component; corrected
here before the DRAFT's first review).

```ts
# SOURCE: src/app/api.ts:179-185
export async function createReminder(input: CreateReminderInput): Promise<ReminderDto> {
  const body = await request<{ reminder: ReminderDto }>("/api/reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.reminder;
}
```
Copied by: Task 2 (`createSeries` — the identical one-liner-over-`request<T>()`
wrapper shape every other API call in this file already uses).

```ts
# SOURCE: src/shared/recurrence.ts:196-223 (findNextMonthlyOrYearly), :164-168 (findNextWeekly)
const day = rule.byMonthday ?? start.day;
// ...
const weekdays =
  rule.byWeekday !== null && rule.byWeekday.length > 0
    ? [...rule.byWeekday].sort((a, b) => a - b)
    : [isoWeekday(rule.dtstart)];
```
Referenced by: Task 1 and Task 3 — confirms `byMonthday`/`byWeekday` are safe to
omit from `CreateSeriesInput` (the server derives them from `dtstart`), which is
why the Repetir control asks only for frequency and an end condition, never a
separate "day of month" or "weekday" picker.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/series-edit.ts` | CREATE | The pure, test-first `RecurrenceDraft` type and `buildCreateSeriesInput` — the decidable half of "convert this Task into a series", mirroring `task-edit.ts` |
| `src/app/api.ts` | UPDATE | Add the `createSeries` typed-client wrapper over `POST /api/series` |
| `src/app/components/TaskSheet.tsx` | UPDATE | Add the Repetir + end-condition chip groups, shown only when `seriesId === null` |
| `src/app/components/TodayScreen.tsx` | UPDATE | Wire the save-with-recurrence branch: `createSeries` → delete the original one-off row → `refresh()` |
| `src/app/components/TaskRow.tsx` | UPDATE | Render the series glyph in the row's meta line when `task.seriesId !== null` |
| `docs/context/architecture.md` | UPDATE | Correct the stale "Not built yet: recurrence machinery" line (41); add `recurrence.ts`/`series-edit.ts` to the `src/shared/` inventory row (23) |
| `docs/domain/areas/tasks.md` | UPDATE | Confirm the recurrence business rules read as delivered, not merely decided |
| `documentation/50-planning/roadmap.md` | UPDATE | Add a Delivery history line recording phase 4's code delivery date (not the unit's close — that still needs AC-28's device proof) |

## NOT Building (Scope Limits)

- **Editing the rule of an existing series.** Once `task.seriesId !== null`,
  `TaskSheet` never shows the Repetir control for that Task — matches PRD D11
  ("Won't: end the series and create a new one").
- **The missed sweep, adherence, or the repeated-miss nudge** — units 10-12.
- **Hard-deleting a series, or "this and all future" edits** — PRD Won'ts,
  unaffected by this phase.
- **Recurring Events** — unit 17.
- **A series summary line in the sheet** (e.g. "Todo mês, dia 5 · até dez/2026")
  — explicitly a PRD "Could"; the glyph alone satisfies the layout standard, and
  building it now would be unrequested scope.
- **A second reminder-offset picker.** The Repetir control does not add a new
  UI for reminder offsets; `buildCreateSeriesInput` derives `reminderOffsets`
  from whatever the sheet's existing "Lembrete" control already produced for
  this Task (a single offset, or `null`), reusing UI rather than duplicating it.
- **A new migration.** `0005` already shipped in Phase 2; this phase touches no
  schema.
- **Closing unit 9 in the roadmap.** That requires AC-28 — the owner's own
  device action in production — which is out of this plan's code scope; Task 8
  records phase 4's *code* delivery only.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/series-edit.ts (delivers AC-A1)

**ACTION**: Add a pure, DOM-free module (mirrors `src/shared/task-edit.ts`'s
header discipline: no runtime dependencies, no clock): a `RecurrenceDraft` type
(`freq: "none" | "daily" | "weekly" | "monthly" | "yearly"`, `endOption: "never"
| "until" | "count"`, `untilDate: string`, `maxCount: string` — all-string form
fields, matching `TaskDraft`'s convention), an `EMPTY_RECURRENCE_DRAFT`
constant, `recurrenceDraftError(taskDraft: TaskDraft, recurrence:
RecurrenceDraft): string | null` (pt-BR validation messages: a date is required
when `freq !== "none"`; `endOption: "until"` requires a valid calendar
`untilDate`; `endOption: "count"` requires `maxCount` to parse as an integer
`>= 1` — mirroring `src/worker/routes/series.ts:106-132`'s validation order so
the client never sends a body the route would 400 on), and
`buildCreateSeriesInput(taskDraft: TaskDraft, recurrence: RecurrenceDraft,
reminderDraft: ReminderDraft | null, timezone: string): CreateSeriesInput` —
maps `taskDraft.date` to `dtstart`, `taskDraft.dateMode` to `dateMode`,
`taskDraft.priority`/`title` verbatim, omits `byMonthday`/`byWeekday` entirely
(server-side fallback, see Patterns to Mirror). `reminderOffsets` is set to
`[reminderDraft.offsetMinutes]` only when `reminderDraft !== null &&
reminderDraft.timeMode === "offset"` — the real `ReminderDraft` shape
(`src/shared/reminder-edit.ts:33-39`) has no `originOffsetMinutes` field;
that name belongs to the wire-level `ReminderDto`/`CreateReminderInput`, not
the draft, and `offsetMinutes` is the draft's own field. In every other case
(no existing Reminder, or one in `timeMode: "absolute"`) `reminderOffsets` is
`null`: an absolute-time Reminder has one fixed instant with no offset to
repeat, so it is not carried into the series template. Also export
`reminderWillCarryOver(reminderDraft: ReminderDraft | null): boolean`
(`reminderDraft !== null && reminderDraft.timeMode === "offset"`) so Task 3's
UI can show an inline pt-BR notice — "O lembrete atual não será copiado para
a série; adicione um novo lembrete relativo depois de salvar." — whenever an
existing absolute-time Reminder would otherwise be silently dropped, rather
than leaving the Implementer to guess what happens to it.

**MIRROR**: `# SOURCE: src/shared/task-edit.ts:50-67`

**VALIDATE**: `npx vitest run --project worker test/series-edit.test.ts`
(the test-writer/test-reviewer pair authors this suite before this task runs,
per `tdd: true` — this command only RUNS it; see `## Notes`)

### Task 2: UPDATE src/app/api.ts (infrastructure for AC-A2 — the `createSeries` call Task 4 makes)

**ACTION**: Add `export async function createSeries(input: CreateSeriesInput):
Promise<{ series: SeriesDto; occurrence: TaskDto }>` — a one-liner
`POST /api/series` wrapper over `request<T>()`, importing `CreateSeriesInput`
and `SeriesDto` from `../shared/api` (already declared there — never
redeclared).

**MIRROR**: `# SOURCE: src/app/api.ts:179-185`

**VALIDATE**: `npx tsc -b`

### Task 3: UPDATE src/app/components/TaskSheet.tsx (delivers AC-A2, UI half)

**ACTION**: Below the existing "Prioridade" `ChipGroup` (and above "Lembrete"),
add: when `shown.seriesId === null`, a "Repetir" `ChipGroup` (single-select:
"Não repete" / "Diariamente" / "Semanalmente" / "Mensalmente" / "Anualmente")
and — only when the passed-in draft's `freq !== "none"` — a second "Até
quando?" `ChipGroup` ("Nunca" / "Até uma data" / "Depois de N vezes") plus the
matching conditional input (a `type="date"` input for "Até uma data", a
`type="number"` input for "Depois de N vezes", both disabled/hidden otherwise,
mirroring the existing `sheet-date` input's `disabled` pattern at line 147).
The draft itself is **not** local state inside `TaskSheet` — this component's
own header comment says it "never holds state of its own beyond what it last
saw" (line 8), and the existing Reminder editor already solves the identical
"a draft for an endpoint that is not `PATCH /api/tasks`" problem by keeping it
in `TodayScreen`'s own `useState` (`taskReminderDraft`). Add two new props
mirroring that pair exactly: `recurrenceDraft: RecurrenceDraft` and
`onRecurrenceDraftChange: (changes: Partial<RecurrenceDraft>) => void`. `onSave`
fires unchanged when `recurrenceDraft.freq === "none"`; otherwise call a new
`onSaveWithRecurrence: () => void` prop (Task 4 owns building the actual
`CreateSeriesInput` from whatever `recurrenceDraft` currently holds, exactly
as `onReminderSave` already does for `taskReminderDraft`). A
`recurrenceDraftError(...)`-sourced inline error (mirroring the existing
`error !== null` block at lines 211-215) blocks `Salvar` when the recurrence
choice is incomplete. When `recurrenceDraft.freq !== "none"` and
`reminderWillCarryOver(reminderDraft) === false` while `reminderDraft !==
null` (an existing absolute-time Reminder on this Task), render Task 1's
inline pt-BR notice beneath the end-condition control, so the owner is told
the Reminder will not follow the Task into the new series rather than
discovering it missing after the fact.

**MIRROR**: `# SOURCE: src/app/components/TaskSheet.tsx:130-141` (chip-group
shape) and `# SOURCE: src/app/components/TodayScreen.tsx:221,992-1018`
(draft-lives-in-the-parent ownership)

**VALIDATE**: `npx tsc -b && npx eslint src/app/components/TaskSheet.tsx` —
then manually, in the browser pane (`npm run dev`, 375 px, dark mode): open an
existing one-off Task's sheet, confirm "Repetir" is visible; open a Task that
already carries a `seriesId` (create one via `curl -X POST
http://localhost:5173/api/series ...` first) and confirm "Repetir" does NOT
render for it.

### Task 4: UPDATE src/app/components/TodayScreen.tsx (delivers AC-A2 wiring half, and AC-A3)

**ACTION**: Add `const [recurrenceDraft, setRecurrenceDraft] =
useState<RecurrenceDraft>(EMPTY_RECURRENCE_DRAFT)`, reset to
`EMPTY_RECURRENCE_DRAFT` wherever the sheet closes or a different Task opens
(mirroring how `taskReminderDraft` is seeded/cleared around `open-reminder`/
`close-reminder` and the sheet's own `close`/`saved`/`deleted` transitions).
Pass `recurrenceDraft` and `onRecurrenceDraftChange={(changes) =>
setRecurrenceDraft((prev) => ({ ...prev, ...changes }))}` into `TaskSheet`
(Task 3's new props). Add `saveSheetWithRecurrence(): void`, passed as
`onSaveWithRecurrence`: build the `CreateSeriesInput` via
`buildCreateSeriesInput(currentDraft(sheet, sheetTask), recurrenceDraft,
sheetTaskReminder === null ? null : draftFromReminder(sheetTaskReminder),
PRAESTO_TIMEZONE)`; inside `runSheet`, `await createSeries(input)` FIRST, and
only on its success `await deleteTask(sheetTask.id)` (never the reverse order —
a failed delete after a successful create leaves a visible, recoverable
duplicate row; a failed create after a delete would lose the Task outright);
then `dispatchSheet({ type: "deleted", taskId: sheetTask.id })` (reuses the
existing sheet-close-on-delete transition), reset `recurrenceDraft` to
`EMPTY_RECURRENCE_DRAFT`, and `showToast({ key: "series-created", text:
"Série criada" })`; `refresh()` (already called by `runSheet`'s own success
path) then surfaces the new occurrence — the same `refresh()` call that
already makes a completed occurrence's successor appear (AC-A3), so no change
to `complete()` or to `completeTask()`'s return type is needed here.

**MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:529-561` (mutation
shape) and `# SOURCE: src/app/components/TodayScreen.tsx:221,992-1018`
(draft ownership)

**VALIDATE**: `npx tsc -b` — then manually: in the running dev server, open a
one-off Task, set "Repetir" → "Mensalmente", pick a deadline, save; confirm the
original row is gone, a new occurrence with the same title/date/priority
appears under its date group, and no duplicate row remains.

### Task 5: UPDATE src/app/components/TaskRow.tsx (delivers AC-A2, glyph half)

**ACTION**: Import a repeat-shaped icon from `lucide-react` (verify the exact
export name per this task's `VALIDATE` before using it — do not guess). Insert
it into the meta-line `<span>` (same span `splitMeta`'s output already renders
into) whenever `task.seriesId !== null`, positioned before the existing date
phrase, with `aria-hidden="true"` on the icon itself and a leading visually
adjacent word ("Repete") so the cue is never colour- or icon-only (guidelines
§10, 1.4.1/1.1.1) — mirrors how the priority glyph pairs an icon with
`priorityWord` text rather than shipping the icon alone.

**MIRROR**: `# SOURCE: src/app/components/TaskRow.tsx:96-127`

**VALIDATE**: `node -e "const m = require('lucide-react'); const hit = Object.keys(m).find(k => /^Repeat/.test(k)); if (!hit) { console.error('FAIL: no Repeat-prefixed export in lucide-react'); process.exit(1); } console.log('PASS:', hit)"`
— then `npx tsc -b`, then manually confirm the glyph renders only on a Task
created via Task 4's flow, never on a plain one-off Task.

### Task 6: UI/UX guidelines Tier A checklist (AC-27 — hard gate before merge)

**ACTION**: Read `documentation/40-engineering/ui-ux-guidelines.md` in full if
not already done this session. Run the 9-item Tier A checklist (§"Review
checklist") against this phase's whole diff in the browser pane (375 px, dark
mode): one primary action per screen, 48 px targets with 8 px gaps, no
colour-only meaning, pt-BR/sentence-case/infinitive-button copy, Tab/Enter/Esc +
visible focus, `aria-label`s and visible labels, tokens-only styling with
reduced-motion honoured, destructive-action pattern (n/a — no destructive
control added), and no cross-origin request. Paste the ✔/✘ result, one line per
item, into this plan's `## Notes` under a "UI/UX Checklist Result" heading
**before** this phase's PR is opened for merge — not after (the exact v0.8.1
defect this rule exists to prevent).

**MIRROR**: `documentation/40-engineering/ui-ux-guidelines.md:150-160`
(Tier A item list — a documentation source, not a code pattern; no `# SOURCE:`
snippet applies)

**VALIDATE**: Manual — no shell command exists for a checklist item (this is
the manual/device half of the phase, per `docs/context/methodology.md`'s UI
carve-out). Pass condition: all 9 items read ✔, or any ✘ carries a recorded,
conscious exception in `## Notes`, per the guideline's own rule ("One ✘ without
a recorded, conscious exception = not done").

### Task 7: UPDATE docs/context/architecture.md (infrastructure — Definition of Done, CLAUDE.md maintenance map; delivers no AC-A item)

**Correction (plan-reviewer R-COH-MANDATORY-READING-IRRELEVANT, and the
orchestrator's own follow-up):** the original draft of this task pointed at
`documentation/30-architecture/architecture-overview.md`, sourced from the
orchestrator's dispatch prompt. That file's real content (219 lines, read in
full) contains no "Not built yet" prose line at all — line 41 there falls
inside a Mermaid diagram (`pa <--> cal`) and cannot carry a text edit. The
sentence actually being described — "Not built yet: recurrence machinery
(the `scheduled()` handler still runs no recurrence sweep), export (FR-042),
Life Area endpoints." — lives in `docs/context/architecture.md:41`, under its
"Current implementation state (Phase 1)" heading, verified directly. Having
now read `documentation/30-architecture/architecture-overview.md` in full for
this phase specifically: it carries no stale recurrence-related statement
(its content is C4-level drivers/containers/data/integrations, none of which
this phase's UI-only change alters), so it is deliberately left untouched by
this plan rather than edited on the strength of a description that did not
match the file.

**ACTION**: In `docs/context/architecture.md` line 41, replace "Not built
yet: recurrence machinery (the `scheduled()` handler still runs no recurrence
sweep), export (FR-042), Life Area endpoints." with an accurate statement:
recurrence materialization (the pure expansion function, `/api/series`,
successor spawning on complete, and the *Repetir* screen control) is now
built; export and Life Area endpoints are unaffected by this phase and keep
their existing wording; the `missed` sweep (unit 10) remains the only
recurrence-adjacent gap, named explicitly rather than left implicit. In the
same file's `src/shared/` inventory row (line 23), add `recurrence.ts` and
`series-edit.ts` with one-line descriptions matching the style of the
existing entries in that row (e.g. how `task-edit.ts` and `task-filter.ts`
are already described there).

**MIRROR**: `docs/context/architecture.md:37` ("Web Push dispatch (unit 6)
and Reminder endpoints ... have shipped; `scheduled()` is no longer a stub
for Reminders" — the exact "X have shipped, here is what changed" sentence
shape to mirror for the recurrence clause) and `docs/context/architecture.md:23`
(the `src/shared/` row's own `` `module.ts` (one-line description) `` listing
style, for the two new file names)

**VALIDATE**: `npx vitest run --project docs` (the docs-consistency suite —
real exit code; fails if a derived doc contradicts an accepted ADR or calls a
resolved decision open)

### Task 8: UPDATE docs/domain/areas/tasks.md and documentation/50-planning/roadmap.md (infrastructure — Definition of Done, CLAUDE.md maintenance map; delivers no AC-A item)

**ACTION**: In `docs/domain/areas/tasks.md`, confirm the existing recurrence
bullet (lines 12-13) reads as delivered behavior (it already correctly
describes the ADR-0006 model; add one clause noting the screen control now
exists, if the bullet does not already say so once Tasks 1-6 land). In
`documentation/50-planning/roadmap.md`'s unit 9 row (`| 9 | recurring-tasks
| ... |`), append to the **State** cell's prose a note that phase 4's *code* is
delivered on the date this phase merges — explicitly NOT that the unit is
`shipped`, since AC-28 (the owner's own device proof) is still owed, mirroring
how unit 8's row already distinguishes "code delivered" from "unit closed".

**MIRROR**: `documentation/50-planning/roadmap.md:61` (unit 8's row — its
"code delivered/deployed; device verification and the UI/UX checklist
recording remain owed before the unit can close" phrasing is the exact shape
to mirror for unit 9's row) and `docs/domain/areas/tasks.md:12-13` (the
existing recurrence bullet's own sentence style)

**VALIDATE**: `npx vitest run --project docs`

## Validation Commands

**Level 1 — STATIC_ANALYSIS**
```bash
npm run check
```
(`wrangler types --check` + `tsc -b` + ESLint + Prettier — real exit code,
fails on any one of the four)

**Level 2 — UNIT_TESTS**
```bash
npx vitest run --project worker test/series-edit.test.ts && npx vitest run --project worker
```
(first the new pure module's own suite, then the full `worker` project suite —
confirms zero regressions against the existing suite; real exit code)

**Level 3 — MANUAL INTEGRATION (device/browser pane — no automated e2e tier
exists in this project; the browser test tier was deliberately rejected,
roadmap Backlog "Browser test tier" row)**
```
1. npm run dev
2. Open a one-off Task's sheet. Set Repetir -> Mensalmente, Data -> a real
   deadline, Até quando? -> Nunca. Salvar.
3. PASS iff: the original row is gone; exactly one new row appears under its
   date group carrying the same title/date/priority; the row shows the series
   glyph; no duplicate row exists (GET /api/tasks confirms one row per title).
4. Complete the new occurrence. PASS iff the successor appears in the list
   with no page reload (React state update only).
5. Record the result inline here (pass/fail, one line).
```

## Acceptance Criteria

- **AC-A1 (PRD AC-26):** `buildCreateSeriesInput` (Task 1) assembles a valid
  `CreateSeriesInput` from the sheet's draft plus the chosen rule, with
  `byMonthday`/`byWeekday` omitted and correctly falling back to `dtstart` per
  `src/shared/recurrence.ts` — verified by `test/series-edit.test.ts`.
- **AC-A2 (PRD AC-26):** `TaskSheet` exposes the Repetir + end-condition chips
  only when `seriesId === null`; selecting a repetition and saving calls
  `createSeries` then deletes the original one-off row; the new occurrence
  appears in *Hoje* under its date group with the series glyph on the row, in
  pt-BR throughout.
- **AC-A3 (PRD AC-26):** Completing the new occurrence shows the successor in
  the list without a reload — verified as already produced by
  `TodayScreen`'s existing `refresh()`-after-`completeTask()` flow; no new
  production code is required for this clause specifically (confirmed by
  Level 3 step 4).
- **AC-A4 (PRD AC-27):** The `ui-ux-guidelines.md` Tier A review checklist
  (9 items) is run against this phase's full diff and its ✔/✘ result is
  pasted into `## Notes` **before** the merge and the deploy.
- **AC-A5 (PRD AC-28):** Out of this plan's code scope by construction — it is
  the owner's own production action (completing a real series occurrence on
  his device) — but this phase's Tasks 1-6 are what make that action possible
  to perform at all; recording the result in the roadmap's Delivery history is
  the unit-closing step, not a task in this plan.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Converting a one-off Task into a series needs create-then-delete (`POST /api/series` always mints a new Task id — `src/worker/routes/series.ts:169`); a delete failure after a successful create leaves a duplicate row | M | L (a visible duplicate, never data loss) | Task 4 sequences create-then-delete, never the reverse; a failed delete surfaces via the existing error/toast path and the owner can delete the duplicate by hand — no row is ever silently lost |
| The Repetir control scope-creeps into editing an existing series' rule, contradicting PRD D11 | L | M (contradicts an APPROVED PRD without a dated amendment) | Task 3 gates the whole control on `seriesId === null`; once a Task belongs to a series, `TaskSheet` never renders Repetir for it |
| The assumed `lucide-react` icon name for the series glyph does not exist in the pinned `1.33.0` | L | L | Task 5's `VALIDATE` greps the installed package's actual exports before the icon is imported, and fails loudly (non-zero exit) if none match |
| The UI/UX checklist runs after the merge instead of before it (the exact v0.8.1 defect) | M (recorded precedent) | M (a real production defect shipped once this way already) | Task 6 is ordered before this phase can be considered complete, and its pass condition is written as a hard gate, not an optional item |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in
`docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

**Manual/device scope for this phase:** AC-26..AC-28 are manual/device
verification and produce no test file, per the methodology's "UI stays
manually verified" split (`documentation/40-engineering/testing-strategy.md`);
the one automatable piece of this phase, `src/shared/series-edit.ts` (Task 1),
follows the same test-first order as every other pure module in this
codebase (`task-edit.ts`, `task-sheet.ts`, `format.ts`).

**Test-file routing:** this phase's one test-first module
(`src/shared/series-edit.ts`, Task 1) is covered by `test/series-edit.test.ts`,
authored by the `test-writer`/`test-reviewer` pair's lifecycle ledger
(`/relay-write-test` → `/relay-test-write-review`) **before** the Implementer
runs — R-X is a blanket straight-fail on any test glob in the Implementer's
diff, so Task 1's own `**VALIDATE**` only RUNS that pre-existing suite, never
authors or edits it. Every other task in this plan (2 through 8) touches UI
components or documentation that the methodology's own "UI stays manually
verified" split keeps outside the automated tier, so no task and no
`## Files to Change` row targets a test file, and those tasks'
`**VALIDATE**` commands exercise the change directly (type-check, lint, and
the browser-pane/device checks `ui-ux-guidelines.md` itself prescribes as
this project's standard UI-verification method, since the browser test tier
was deliberately rejected — roadmap Backlog, "Browser test tier" row) rather
than invoking vitest.

**Flagged for the test pair, not this plan's Implementer (R-X):**
`test/tasks.test.ts`'s AC-21 cases (~lines 381-417) call `getSeries()` after
ending a series via `count`/`until` but assert only `.status` and
`.doneCount`, never `.openOccurrenceId` — so PRD AC-16's "(or null)" branch
(`GET /api/series` returning `openOccurrenceId: null` once a series has no
open occurrence) is exercised nowhere. Closing it is a one-line addition to
an existing case. Since it touches `test/tasks.test.ts`, it belongs to the
`test-writer`/`test-reviewer` pair's lifecycle ledger (an
`EXISTING_TEST_UPDATED` entry) — no task in this plan authors it.

**Grounding note.** This plan's "Patterns to Mirror" and "Mandatory Reading"
sections are grounded in direct `Read` calls against the real files in the
working tree (`C:\repos\assistente-pessoal\.worktrees\recurring-tasks\`),
verified line-by-line by the plan-writer before being cited. A
`research-codebase` and a `research-web` subagent were also dispatched in
parallel per the standard GROUNDING protocol. `research-codebase` returned
after the first draft of Tasks 3-4 was written and surfaced one real
correction, folded in before this DRAFT was finalized: the recurrence draft
must live in `TodayScreen`'s own `useState` (mirroring `taskReminderDraft`),
not inside `TaskSheet`, because `TaskSheet` is documented glue that "never
holds state of its own beyond what it last saw." It also confirmed
independently what direct reading had already found: no `createSeries`
client wrapper exists yet (Task 2), no icon/badge primitive exists to reuse
for the series glyph (Task 5 imports directly from `lucide-react`, matching
how the priority glyph already does), and `TodayScreen`'s `complete()` /
`api.ts`'s `completeTask()` already reconcile state through a full
`refresh()` regardless of the wire response — which is exactly why AC-A3
needs no new production code. `research-web` returned design-precedent
findings only (Todoist/Things repeat-rule editors, a bare circular-arrow
glyph placed beside the date rather than a calendar+loop icon) — informative
for a future summary-line "Could", but nothing in it changes a task above,
since this phase's scope is deliberately smaller than a full rule editor.

**UI/UX Checklist Result:** not yet run — Task 6 records it here before this
phase's PR is opened for merge.

**Level 3 manual verification result:** not yet run — recorded here once
performed, per the Validation Commands section above.

*Generated: 2026-09-24*
*Approved: 2026-09-24*
*Implemented: 2026-09-24*
*Status: IMPLEMENTED*
