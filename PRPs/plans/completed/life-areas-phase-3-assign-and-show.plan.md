# Feature: Assign and show (Phase 3 of life-areas)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test and implement stages consume); reuse or creation of components (one new pure module in `src/shared`, one new hook, new optional props on the Task sheet, the row and the chip primitive); impact on shared UI (the Task sheet, the row, capture, the search screen); changes to pure functions that existing suites pin (`buildTaskPatch`, `planSeriesOccurrenceSave`, `taskMetaLine`); business rules for life areas, tasks and recurrence (ADR-0006, ADR-0015); the UI/UX review checklist gate (CLAUDE.md, mandatory on every `src/app/` change)
- Decisions found:
  - ADR-0015 / [2026-10-11] Life Areas are owner-named, single-membership groupings; deleting one unassigns its items — at most one area per Task and per series, the series template carries it, a series' area applies from the open occurrence on and `done` and `missed` rows keep theirs
  - ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation — editing one occurrence detaches it, the template carries the area, closed rows are the permanent record
  - life-areas PRD D-K (on an occurrence the choice follows *Aplicar a*, default *Toda a série*, *Só esta ocorrência* detaches), D-M (while an area filter is active a captured Task takes that area, `none` means no area, with no filter no area and no picker on the deck), D-P (search shows the area on rows and has no area control), D-Q (the area name as text in the meta line of an open Task whenever set; `done` and `missed` rows keep today's text; the sheet uses the existing single-choice `ChipGroup`), D-G (areas are created only on *Configurações → Áreas*), D-O (*Sem área* is a filter value and a label, never a stored area)
  - ADR-0008 / [2026-08-04] test-first, scoped to `src/shared` pure logic and the API; React components stay manually verified, and a purely visual criterion legitimately produces no test file
  - methodology "Browser-API work: split the logic out, then the glue is exempt" — the decidable half is extracted to `src/shared` first, the thin glue is the exempt half
  - ADR-0009 / [2026-08-18] visible UI copy is pt-BR (sentence case, infinitive buttons, "você"); identifiers, comments and tests stay English
  - ADR-0003 / [2026-08-03] thin client over D1, no offline write queue — reads degrade, writes wait for the server
  - ADR-0010 / ADR-0011 identity tokens and the owned `src/app/components/ui/` primitives; ui-layout-standard §2.6 (row anatomy), §3 (sheets, never stacked), §8 states; ui-ux-guidelines §8, §9, §10, §12
  - [2026-08-29] an APPROVED PRD's phase table is not edited by this plan beyond its own row
- Applicable anti-patterns:
  - Hand-duplicated entity types (the area option type is a `Pick` of `LifeAreaDto`, never redeclared; the wire shapes stay in `src/shared/api.ts`)
  - Glossary synonym drift (Life Area in code and docs, *área* to the owner; never category)
  - Portuguese in artifacts (identifiers, comments, tests and docs stay English; only the string values the owner reads are pt-BR)
  - Weakening tests to force green (this plan edits no test file and no existing assertion changes its expected value)
  - Offline write queue (a failed or offline write is shown, never queued)
  - Mirroring Tasks, Reminders or Life Areas to Google (not approached)
  - Editing accepted ADRs; writing pipeline artifacts under `.claude/` (nothing is written there)
- Applicable architectural rules:
  - One Worker serves everything; this phase adds no endpoint, no table, no migration and no wire change
  - `src/shared/` carries no DOM or Worker globals and compiles into every target; the new module imports only `./api` (types) and `./life-areas`
  - Types flow `src/worker/db/schema.ts` → `src/worker/dto.ts` → `src/shared/api.ts`; the client consumes `TaskDto.lifeAreaId`, `CreateTaskInput.lifeAreaId`, `UpdateTaskInput.lifeAreaId`, `CreateSeriesInput.lifeAreaId`, `UpdateSeriesInput.lifeAreaId` and `LifeAreasResponse` as they are
  - `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay byte-unchanged; `TaskFilter`, `toQuery`, `FilterSheet` and `FilterChips` are phase 4's and stay untouched
  - Every `/api/*` call goes through `src/app/api.ts`'s `request<T>()` (bearer token, 401 clears it)
  - The UI/UX review checklist's ✔/✘ result is recorded in the phase report before the phase closes
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/life-areas.prd.md` — Implementation Phases row 3: "Assign and show" — Goal: an item can carry an area and shows it — Success signal: AC-14, AC-15, AC-16 green; AC-20 and AC-22 recorded.

## Summary

Phases 1 and 2 gave the owner areas as data and a screen to manage them. This phase lets an item carry one and shows it. In the Task sheet an *Área* single-choice group (*Sem área* plus his areas) sits after *Prioridade*; on a series occurrence the choice follows *Aplicar a* exactly as title, description and priority do, so an ordinary edit never detaches the occurrence silently; with no areas the group is replaced by one line and a button that opens *Áreas*. An open Task's meta line ends with the area's name (`até seg., 24/08 · alta · Casa`), on *Hoje* and in search. Capture gets a pure decision for what area a new Task takes from the area filter; the filter dimension itself is phase 4's, so the decision is written against a minimal input (the area-filter value) and wired through one documented seam. When the areas request fails *Hoje* behaves as before, with no names, no group and no banner. The decidable half is test-first: one new pure module (`src/shared/life-area-assign.ts`) plus extensions to `buildTaskPatch`, `planSeriesOccurrenceSave`/`buildCreateSeriesInput` and `taskMetaLine`; the sheet, the row, the hook and the wiring are the manually verified half, and the plan records the UI/UX checklist for it.

## User Story

As the owner of Praesto Sum
I want to give a Task or a recurring series one of my areas from its sheet, and see that area on the row
So that *Hoje* stops being one undifferentiated pile and the filter of the next phase has something to filter by, without ever being forced to choose an area when I capture something.

## Problem Statement

The areas exist (phase 1) and can be managed (phase 2), but nothing in the app can put a Task into one: the Task sheet has no area control, a captured Task never takes an area, and a row never says which area it belongs to. Without assignment the unit's exit signal — filtering by an area he created — has nothing to act on, and the one place the area could be set today (`PATCH /api/tasks/:id`) is unreachable from the interface.

## Solution Statement

One pure module `src/shared/life-area-assign.ts` decides everything decidable about showing and choosing an area: the id-to-name lookup, the three-state group decision (absent when the areas request failed, a line when he has none, the choices otherwise), the chip value mapping and the capture decision. `TaskDraft` gains an optional `lifeAreaId` that only exists once the owner has chosen; `buildTaskPatch`, `buildUpdateSeriesTemplate`, `planSeriesOccurrenceSave` and `buildCreateSeriesInput` send it only when it changed or must be carried. `taskMetaLine` takes the area name and a new structured `taskMetaParts` replaces the row's fragile string splitting. A `useLifeAreas` hook, shared by *Hoje* and search like `useSeriesSheet`, holds the areas in their own atom and degrades to absence on failure. `ChipGroup` gains a `wrap` option so twelve areas wrap instead of scrolling sideways. `TaskSheet`, `TaskRow`, `TodayScreen`, `SearchScreen` and `App.tsx` are wired; nothing about the wire, the schema or the filter changes.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT (an existing sheet, row and capture path gain area behaviour on top of an existing API; one new pure module and one hook; no schema, endpoint or wire change) |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/` (new `life-area-assign.ts`; `task-edit.ts`, `series-edit.ts`, `format.ts`), `src/app/` (new `hooks/useLifeAreas.ts`; `ui/Chip.tsx`, `TaskRow.tsx`, `TaskSheet.tsx`, `TodayScreen.tsx`, `SearchScreen.tsx`, `App.tsx`), `PRPs/reports/life-areas/phase-3/` (the checklist record) |
| Dependencies | Phases 1 and 2 (`/api/life-areas`, `fetchLifeAreas`, `LifeAreasResponse`, `NO_AREA_LABEL`, `compareLifeAreaNames`, the `life-areas` route, `lifeAreaId` accepted and validated on Task and series writes) — present in this worktree; no new package, no migration |
| Estimated Tasks | 11 |
| Source PRD line ref | `PRPs/prds/life-areas.prd.md` Implementation Phases row 3 (line 356), Phase Details (373-377); AC-14, AC-15, AC-16 (156-168), AC-20 (181-184), AC-22 (190-192), AC-23 (193-197); D-K, D-M, D-P, D-Q (402, 404, 407, 408) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/life-areas.prd.md` | 156-168, 181-184, 190-192, 193-197, 322-327, 331-333, 373-377, 398, 402, 404, 407-408 | AC-14, AC-15, AC-16 (the pure decisions), AC-20 and AC-22 (the manual half), AC-23's checklist clause, the UI architecture note and checklist bullet, the Phase 3 details and decisions D-G, D-K, D-M, D-P, D-Q |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 75-103, 105-119, 136-168 | §8 states (empty, request error, offline), §9 copy rules, §10 accessibility, §12 components and the review checklist this phase must run and record |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 33-34, 39-43, 66 | §2.6 row anatomy (the second metadata line), §2.7 empty state, §3 sheets (detail content order, never stacked), §6 the unit-13 row |
| P0 | `src/shared/task-edit.ts` | 17-67 | `TaskDraft`, `buildTaskPatch` and the omitted-versus-cleared rule the new key must follow |
| P0 | `src/shared/series-edit.ts` | 138-167, 327-392 | `buildCreateSeriesInput`, `buildUpdateSeriesTemplate`, `TEMPLATE_TASK_FIELDS` and `planSeriesOccurrenceSave` |
| P0 | `src/shared/format.ts` | 124-166 | `taskMetaLine`, the one pure function behind the row's meta line |
| P0 | `src/app/components/TaskSheet.tsx` | 14-39, 47-141, 261-275, 377-398 | Imports, the props block, the draft fallback, the *Prioridade* group the new group follows and the *Aplicar a* block whose label changes |
| P0 | `src/app/components/TaskRow.tsx` | 14-30, 59-61, 109-130 | `splitMeta` and the meta render this phase replaces |
| P0 | `src/app/components/TodayScreen.tsx` | 142-170, 273-282, 365-385, 459-471, 636-652, 773-786, 851-871, 1137-1214 | The props, the isolated adherence atom the areas atom copies, capture, the series conversion, the visibility effect, the row wiring and the sheet wiring |
| P0 | `src/app/components/SearchScreen.tsx` | 59-65, 84-92, 271-286, 346-358, 461-536 | The props, the sheet wiring, the conversion and the row wiring; the `{ ...EMPTY_FILTER, q }` request at line 106 stays as it is |
| P1 | `src/app/hooks/useSeriesSheet.ts` | 12-42 | The precedent for a hook shared by the two screens "so the two sheets cannot drift" |
| P1 | `src/app/components/ui/Chip.tsx` | 11-47 | `ChipGroup` and `Chip` (string-valued, deselecting the pressed chip yields `[]`) |
| P1 | `src/app/api.ts` | 142-148, 232-242 | `createTask` and `fetchLifeAreas` (no change; both already exist) |
| P1 | `src/shared/api.ts` | 24-48, 113-126, 251-296, 365-399 | `TaskDto`, `LifeAreaSummaryDto`/`LifeAreasResponse`, `CreateTaskInput`, `UpdateTaskInput`, `EDITABLE_TASK_FIELDS`, `CreateSeriesInput`, `UpdateSeriesInput` (all already carry `lifeAreaId`) |
| P1 | `src/worker/routes/tasks.ts` | 301-305, 321-322 | The server validates `lifeAreaId` on the Task PATCH and detaches an occurrence on any key — why an unchanged key must never be sent |
| P1 | `src/worker/routes/series.ts` | 371-379 | The series PATCH writes the area to the series and to the open non-detached occurrence — why "Toda a série" sends nothing to the Task |
| P1 | `src/shared/task-filter.ts` | 17-36, 52-76 | The phase 4 boundary: `TaskFilter`, `toQuery` and `activeCount` have no area dimension and must not gain one here |
| P1 | `src/shared/life-areas.ts` and `src/shared/life-areas-view.ts` | 42-55 and 20-21 | `compareLifeAreaNames` (the alphabetical order) and `NO_AREA_LABEL` (*Sem área*) |
| P1 | `src/app/App.tsx` | 100-121 | The route switch; the two screens gain a prop wired to `navigate("life-areas")` |
| P2 | `test/task-edit.test.ts`, `test/series-edit.test.ts`, `test/format.test.ts`, `test/task-sheet.test.ts`, `test/task-filter.test.ts` | 223-245; 530-563 and 574-684; 118-279; 75-101; 215-226 | The existing suites nearest to this phase. Read-only for the Implementer; they pin what must keep passing (see Notes) |
| P2 | `PRPs/reports/life-areas/phase-2/ui-checklist.md` | 1-29 | The record format Task 11 follows (✔ / ✘ / pending / owed vocabulary) |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-edit.ts:26-32
export interface TaskDraft {
  title: string;
  description: string;
  dateMode: TaskDateMode;
  date: string;
  priority: TaskPriority | null;
}
```
Copied by Task 1 (the draft's shape and doc style; the new member is the one OPTIONAL key).

```ts
# SOURCE: src/shared/task-edit.ts:62-66
  if (draft.priority !== original.priority) patch.priority = draft.priority;

  applyDate(patch, original, draft);

  return patch;
```
Copied by Task 1 (one compare-and-assign per editable key, emitted only when it differs from the original).

```ts
# SOURCE: src/shared/series-edit.ts:339-343
  const priority: TaskPriority | null = taskDraft.priority;
  if (priority !== series.priority) body.priority = priority;

  return Object.keys(body).length === 0 ? null : body;
}
```
Copied by Task 2 (the template diff against the series, `null` when nothing differs).

```ts
# SOURCE: src/shared/series-edit.ts:356
const TEMPLATE_TASK_FIELDS = ["title", "description", "priority"] as const;
```
```ts
# SOURCE: src/shared/series-edit.ts:379-392
  const ruleBody = ruleDraft === null ? null : buildUpdateSeriesRule(series, ruleDraft);
  const templateBody = applyTo === "series" ? buildUpdateSeriesTemplate(taskDraft, series) : null;
  const merged: UpdateSeriesInput = { ...(ruleBody ?? {}), ...(templateBody ?? {}) };

  const taskChanges: UpdateTaskInput = { ...buildTaskPatch(task, taskDraft) };
  if (applyTo === "series" && !task.detached) {
    for (const field of TEMPLATE_TASK_FIELDS) delete taskChanges[field];
  }

  return {
    seriesBody: Object.keys(merged).length === 0 ? null : merged,
    taskChanges,
  };
}
```
Copied by Task 2 (the series-versus-occurrence split, the `delete` idiom for removing a key from a copy).

```ts
# SOURCE: src/shared/series-edit.ts:145-158
  const input: CreateSeriesInput = {
    title: taskDraft.title.trim(),
    freq: recurrence.freq === "none" ? "daily" : recurrence.freq,
    // A dateless series starts today in its own zone: the occurrence still has
    // a day internally (the sweep and the successor need it) but never shows it.
    dtstart: taskDraft.dateMode === "none" ? todayIn(now, timezone) : taskDraft.date,
    dateMode: resolvedDateMode(taskDraft),
    priority: taskDraft.priority,
    timezone,
    endKind: recurrence.endOption,
    reminderOffsets: reminderWillCarryOver(reminderDraft)
      ? [(reminderDraft as ReminderDraft).offsetMinutes]
      : null,
  };
```
Copied by Task 2 (the template fields a converted one-off carries into its series; the area joins them only when set).

```ts
# SOURCE: src/shared/life-areas.ts:1-11
/**
 * The pure core of Life Areas (ADR-0015, life-areas PRD AC-12): the name limits,
 * the name validator, the duplicate key and the pt-BR comparator.
 *
 * The `/api/life-areas` route and, from phase 2, the *Áreas* screen both import
 * this module, so the two cannot drift on what a valid, a duplicate or an
 * ordered area name is. Like `search.ts` and `dates.ts` it is compiled into
 * every target, so it carries no DOM globals and no Worker globals.
 */

import { normalizeSearchText } from "./search";
```
Copied by Task 3 (the module header: a purity statement and sibling-only imports).

```ts
# SOURCE: src/shared/life-areas.ts:46-55
const collator = new Intl.Collator("pt-BR");

/**
 * Orders two area names alphabetically in pt-BR (`Casa`, `Ética`, `Trabalho`),
 * never bytewise: a bytewise sort would put `Ética` after `Trabalho`. Usable
 * directly as an `Array.prototype.sort` comparator. AC-12 and AC-6.
 */
export function compareLifeAreaNames(a: string, b: string): number {
  return collator.compare(a, b);
}
```
Copied by Task 3 (the group's choices are sorted with this comparator, never re-implemented).

```ts
# SOURCE: src/shared/format.ts:158-166
  const priorityWord = task.priority === "high" ? "alta" : task.priority === "low" ? "baixa" : null;

  if (phrase === null) {
    return priorityWord === null ? null : { text: priorityWord, overdue: false };
  }
  return priorityWord === null
    ? phrase
    : { text: `${phrase.text} · ${priorityWord}`, overdue: phrase.overdue };
}
```
Copied by Task 4 (the join rule the structured parts must reproduce byte for byte: ` · ` between present parts, `overdue` taken from the date phrase only).

```ts
# SOURCE: src/app/components/ui/Chip.tsx:24-34
  return (
    <ToggleGroup
      multiple={multiple}
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      className="flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]"
    >
      {children}
    </ToggleGroup>
  );
```
Copied by Task 5 (the default class string stays byte-identical; `wrap` selects the second one).

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:165-170
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  // The adherence record lives in its OWN atom, never folded into `tasks`,
  // `loadError`, `busy` or the agenda state: a failed fetch leaves it `null`
  // and the line is simply absent (plan AC-A3).
  const [adherence, setAdherence] = useState<AdherenceResponse | null>(null);
  const latestAdherenceRequest = useRef(0);
```
```tsx
# SOURCE: src/app/components/TodayScreen.tsx:365-385
  /**
   * Fetches the adherence record for the line below the chip row. Like
   * `refreshEvents` and `refreshReminders` it never calls `report(...)`, never
   * toasts and never sets an error state: a failure just clears the line.
   */
  async function refreshAdherence(): Promise<void> {
    // Only the newest request may write, so a slow older response cannot
    // overwrite fresher data.
    const mine = ++latestAdherenceRequest.current;
    try {
      const response = await fetchAdherence();
      if (mine === latestAdherenceRequest.current) setAdherence(response);
    } catch (cause) {
      if (mine !== latestAdherenceRequest.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setAdherence(null);
    }
  }
```
```tsx
# SOURCE: src/app/components/TodayScreen.tsx:773-786
  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void refresh();
      // The agenda goes stale on wall-clock time rather than on anything the
      // owner did, so coming back to the app is exactly when it is worth
      // re-reading (guidelines §12.4 — there is no manual refresh gesture).
      void refreshEvents();
      void refreshReminders();
      void refreshAdherence();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
```
Copied by Task 6 (the isolated atom, the newest-request-wins guard, the 401 route, failure as absence, load on mount and on return to the foreground).

```ts
# SOURCE: src/app/hooks/useSeriesSheet.ts:27-35
export function useSeriesSheet(
  sheetTask: TaskDto | null,
  onUnauthorized: () => void,
): {
  series: SeriesDto | null;
  /** Set when the series could not be loaded, so the sheet says so instead of going quiet. */
  seriesError: string | null;
  ruleDraft: SeriesRuleDraft | null;
  changeRuleDraft: (changes: Partial<SeriesRuleDraft>) => void;
```
Copied by Task 6 (a hook with `onUnauthorized` as its last argument, shared by both screens so they cannot drift).

```tsx
# SOURCE: src/app/components/TaskRow.tsx:19-30
function splitMeta(
  meta: { text: string; overdue: boolean },
  priority: TaskPriority | null,
): { prefix: string; priorityWord: "alta" | "baixa" | null } {
  if (priority === "high" && meta.text.endsWith("alta")) {
    return { prefix: meta.text.slice(0, meta.text.length - "alta".length), priorityWord: "alta" };
  }
  if (priority === "low" && meta.text.endsWith("baixa")) {
    return { prefix: meta.text.slice(0, meta.text.length - "baixa".length), priorityWord: "baixa" };
  }
  return { prefix: meta.text, priorityWord: null };
}
```
```tsx
# SOURCE: src/app/components/TaskRow.tsx:109-130
          {meta !== null && metaSplit !== null && (
            <span
              className={cn(
                "font-data text-t1 font-medium text-muted tabular-nums",
                meta.overdue && "text-overdue",
              )}
            >
              {task.seriesId !== null && (
                <>
                  <Repeat className="inline size-3" aria-hidden="true" /> Repete{" "}
                </>
              )}
              {metaSplit.prefix}
              {metaSplit.priorityWord === "alta" && (
                <ChevronUp className="inline size-3" aria-hidden="true" />
              )}
              {metaSplit.priorityWord === "baixa" && (
                <ChevronDown className="inline size-3" aria-hidden="true" />
              )}
              {metaSplit.priorityWord !== null && ` ${metaSplit.priorityWord}`}
            </span>
          )}
```
Copied by Task 7 (the span, the series glyph and the priority glyph keep their exact markup; only the source of the pieces changes from a string split to structured parts).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:261-273
          <p className="m-0 font-data text-t1 font-semibold text-muted">Prioridade</p>
          <ChipGroup
            multiple={false}
            label="Prioridade"
            value={shownDraft.priority === null ? [] : [shownDraft.priority]}
            onValueChange={(next) =>
              onDraftChange({ priority: (next[0] as TaskPriority | undefined) ?? null })
            }
          >
            <Chip value="high">Alta</Chip>
            <Chip value="normal">Normal</Chip>
            <Chip value="low">Baixa</Chip>
          </ChipGroup>
```
```tsx
# SOURCE: src/app/components/TaskSheet.tsx:385-391
              <p className="m-0 font-data text-t1 font-semibold text-muted">
                Aplicar título, descrição e prioridade a
              </p>
              <ChipGroup
                multiple={false}
                label="Aplicar título, descrição e prioridade a"
                value={[applyTo]}
```
Copied by Task 8 (the group markup the *Área* group repeats; the *Aplicar a* label that must now name the area, visible text and accessible name together).

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:459-471
  function submitCapture(): void {
    const trimmed = title.trim();
    if (trimmed === "" || busy) return;
    void run(async () => {
      await createTask({ title: trimmed });
      // FR-045 invariant, locked in explicitly: `setTitle("")` is sequenced
      // AFTER the awaited `createTask(...)` call above, never before or
      // unconditionally — a thrown failure exits this callback before this
      // line runs, so a failed save never loses what the owner typed.
      setTitle("");
      showToast({ key: "task-saved", text: "Tarefa salva" });
    });
  }
```
```tsx
# SOURCE: src/app/components/TodayScreen.tsx:636-644
  function saveSheetWithRecurrence(): void {
    if (sheetTask === null) return;
    const input = buildCreateSeriesInput(
      currentDraft(sheet, sheetTask),
      recurrenceDraft,
      sheetTaskReminder === null ? null : draftFromReminder(sheetTaskReminder),
      PRAESTO_TIMEZONE,
    );
    const id = sheetTask.id;
```
```tsx
# SOURCE: src/app/components/TodayScreen.tsx:859-870
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  busy={busy || !writable}
                  editing={editingId === task.id}
                  onToggle={(next) => void (next ? complete(task.id) : reopen(task.id))}
                  onOpen={() => openSheet(task)}
                  onEdit={() => setEditingId(task.id)}
                  onCommitTitle={(newTitle) => commitTitle(task.id, newTitle)}
                  onCancelEdit={() => setEditingId(null)}
                />
```
Copied by Task 9 (capture keeps the FR-045 sequencing; the conversion resolves the area before building the series; the row gains one prop).

```tsx
# SOURCE: src/app/components/SearchScreen.tsx:346-357
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  busy={busy}
                  editing={editingId === task.id}
                  onToggle={(next) => void (next ? complete(task.id) : reopen(task.id))}
                  onOpen={() => openSheet(task)}
                  onEdit={() => setEditingId(task.id)}
                  onCommitTitle={(newTitle) => commitTitle(task.id, newTitle)}
                  onCancelEdit={() => setEditingId(null)}
                />
```
Copied by Task 10 (the same row element in search; byte-for-byte the *Hoje* shape plus the one prop).

```tsx
# SOURCE: src/app/App.tsx:112-121
  return (
    <TodayScreen
      onUnauthorized={onUnauthorized}
      initialShare={initialShare}
      initialTaskId={taskIdFromRoute(route)}
      onOpenSearch={() => navigate("search")}
      onOpenSettings={() => navigate("settings")}
      onOpenAdherence={() => navigate("adherence")}
    />
  );
```
Copied by Tasks 9 and 10 (one `navigate("...")` arrow per entry the screen can open).

```md
# SOURCE: PRPs/reports/life-areas/phase-2/ui-checklist.md:18-21
## Tier A — every interface change

1. ✔ — method: static inspection. The one primary action is *Adicionar*; the row actions are
   icon buttons; *Tentar de novo*, *Cancelar* and the `ConfirmView` buttons are `secondary`.
```
Copied by Task 11 (a heading per tier, then one numbered line per checklist item, each carrying a status and a method the file's reader can act on; the file's opening paragraph at lines 3-7 states what was and was not run).

## Files to Change

Paths are relative to the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/task-edit.ts` | UPDATE | `TaskDraft.lifeAreaId` (optional, present only once chosen), `buildTaskPatch` sends it only when it changed, and `effectiveLifeAreaId` (AC-A4, AC-A5, AC-A6) |
| `src/shared/series-edit.ts` | UPDATE | `lifeAreaId` joins `TEMPLATE_TASK_FIELDS` and the template diff, `planSeriesOccurrenceSave` routes it with *Aplicar a*, `buildCreateSeriesInput` carries a chosen area into a converted series (AC-A3, AC-A6) |
| `src/shared/life-area-assign.ts` | CREATE | The pure decisions: capture, name lookup, the three-state group, the chip value mapping (AC-A1, AC-A2, AC-A5, AC-A7) |
| `src/shared/format.ts` | UPDATE | `taskMetaParts` and `taskMetaLine`'s optional area name (AC-A2) |
| `src/app/components/ui/Chip.tsx` | UPDATE | `ChipGroup` `wrap` option, default byte-identical (infrastructure for AC-A5) |
| `src/app/hooks/useLifeAreas.ts` | CREATE | The areas in their own atom, shared by *Hoje* and search, absent on failure (AC-A7) |
| `src/app/components/TaskRow.tsx` | UPDATE | `areaName` prop; the meta renders from structured parts, `splitMeta` removed (AC-A2) |
| `src/app/components/TaskSheet.tsx` | UPDATE | The *Área* group, the zero-areas line and button, the *Aplicar a* label (AC-A5, AC-A7) |
| `src/app/components/TodayScreen.tsx` | UPDATE | Areas atom, row names, sheet props, capture seam, conversion keeps the area, `onOpenLifeAreas` (AC-A1, AC-A2, AC-A5, AC-A6, AC-A7) |
| `src/app/components/SearchScreen.tsx` | UPDATE | Areas atom, row names, sheet props, conversion keeps the area, `onOpenLifeAreas` (AC-A2, AC-A5, AC-A6, AC-A7) |
| `src/app/App.tsx` | UPDATE | Threads `onOpenLifeAreas` to both screens (AC-A5) |
| `PRPs/reports/life-areas/phase-3/ui-checklist.md` | CREATE | The UI/UX review checklist's recorded ✔/✘ and the AC-20 and AC-22 walks, with the device-only items marked owed (AC-A8) |

## NOT Building (Scope Limits)

- `TaskFilter.lifeAreaId`, `toQuery`, `activeCount`, `isChipActive`/`toggleChip`, the *Área* group in the filter sheet, the applied chip and *Limpar filtros* for it (phase 4: AC-13, AC-21). `src/shared/task-filter.ts`, `FilterSheet.tsx` and `FilterChips.tsx` are not edited, and Level 2 fails the phase if `lifeAreaId` appears in them.
- An area filter in search or any area control on the search screen (PRD D-P); search only shows the name on its rows and keeps its `{ ...EMPTY_FILTER, q }` request.
- Creating an area from inside the Task sheet (PRD D-G, "Won't"): the zero-areas button only opens *Áreas*.
- Changing what a seeded draft holds: `draftFromTask` in `src/shared/task-sheet.ts` is not edited and `reduceTaskSheet` needs no change (its `edit` event already merges `Partial<TaskDraft>`).
- Any "Sem área" marker on an area-less row (AC-22) and any area name on `done` or `missed` rows (D-Q).
- Re-assigning or re-stamping closed occurrences (PRD "What We're NOT Building"; the server already keeps `done` and `missed` rows' areas).
- Any endpoint, table, migration, export or wire change; any change to `src/shared/recurrence.ts` or `src/shared/adherence.ts`; any new dependency.
- Documentation sync: `ui-layout-standard.md` §2.6/§6 ("area dot" becomes the area name), the glossary, `domain-model.md`, FR-008, the area docs and the roadmap are phase 4 (AC-25) or the post-merge docs update; this phase only records its own checklist result.
- The restore drill and the device proof (phase 4: AC-18, AC-24) and the phase-4 half of capture (the filter value itself).
- Authoring or editing any test file and any React component test (the test pair owns the suite; component verification stays manual per `docs/context/methodology.md`).
- Touching `src/app/components/DesignPlayground.tsx`: every new prop on `TaskRow` and `TaskSheet` is optional so the dev-only playground compiles unchanged.

## Step-by-Step Tasks

Every `VALIDATE` command runs from the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

### Task 1: UPDATE src/shared/task-edit.ts

- **ACTION**: Delivers AC-A4 and the `effectiveLifeAreaId` helper that AC-A5 and AC-A6 consume. (1) Add to `TaskDraft` ONE OPTIONAL member, `lifeAreaId?: string | null`, with a short English doc comment: it is the area the owner has CHOSEN in this edit session; absent means he has not touched the control, so nothing is sent and nothing is overwritten; `null` is an explicit *Sem área*; a string is an area id. State in the comment that it is deliberately not seeded by `draftFromTask`: a kept draft must never re-send an area id that changed or vanished on the server since the sheet first opened, and an unchosen area must never detach an occurrence (ADR-0006). The five existing members stay required and untouched, and the module header's "every field is required" sentence is narrowed to say so. (2) In `buildTaskPatch`, after the priority line and before `applyDate`, add the one rule: `if (draft.lifeAreaId !== undefined && draft.lifeAreaId !== original.lifeAreaId) patch.lifeAreaId = draft.lifeAreaId;` — the key is emitted only when the owner chose a value that differs from the Task's own (set, change, or clear with `null`), so an unchanged area is never sent and an empty result still means "nothing to save". (3) Export `effectiveLifeAreaId(draft: Pick<TaskDraft, "lifeAreaId">, task: Pick<TaskDto, "lifeAreaId">): string | null`, returning `task.lifeAreaId` when the draft carries no choice and `draft.lifeAreaId` otherwise — what the sheet shows as selected and what a conversion to a series must carry. Edit no test file and do not edit `draftFromTask` (the seed keeps its five keys).
- **MIRROR**: `# SOURCE: src/shared/task-edit.ts:26-32` and `# SOURCE: src/shared/task-edit.ts:62-66`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/task-edit.ts; npx prettier --check src/shared/task-edit.ts; npx vitest run --project worker test/task-edit.test.ts test/task-sheet.test.ts; grep -qF 'export function effectiveLifeAreaId' src/shared/task-edit.ts` — the two existing suites are the regression guard (a draft with no area decision still emits no `lifeAreaId` key, the seed is unchanged); the pair's added cases are what prove the new behaviour.

### Task 2: UPDATE src/shared/series-edit.ts

- **ACTION**: Delivers AC-A3 and the series half of AC-A6. (1) Add `"lifeAreaId"` to `TEMPLATE_TASK_FIELDS` so the array reads `["title", "description", "priority", "lifeAreaId"]`: with *Toda a série* on a non-detached occurrence the area is then stripped from the Task PATCH (any key there detaches the occurrence, `src/worker/routes/tasks.ts:321-322`) and travels in the series PATCH, whose route already writes it to the series and to the open non-detached occurrence (`src/worker/routes/series.ts:371-379`). (2) In `buildUpdateSeriesTemplate`, after the priority comparison, add `if (taskDraft.lifeAreaId !== undefined && taskDraft.lifeAreaId !== series.lifeAreaId) body.lifeAreaId = taskDraft.lifeAreaId;` (signature unchanged; an absent choice or one equal to the series' area adds nothing). (3) In `planSeriesOccurrenceSave`, count the area as changed only against the OCCURRENCE the owner is looking at: when `taskDraft.lifeAreaId === undefined || taskDraft.lifeAreaId === task.lifeAreaId`, copy `templateBody` and `delete` its `lifeAreaId` before merging (and treat a template body left empty as `null`). A detached occurrence may legitimately hold an area different from its series, and an unrelated edit under *Toda a série* must not rewrite the series' area. Everything else in the function is unchanged: the rule always goes to the series, a date is always the occurrence's own, an already-detached occurrence takes the template fields itself, and with *Só esta ocorrência* the area goes to the Task PATCH alone, which detaches it. (4) In `buildCreateSeriesInput`, after building `input`, add `if (typeof taskDraft.lifeAreaId === "string") input.lifeAreaId = taskDraft.lifeAreaId;` — an absent or `null` area leaves no key, so the body is byte-identical to today's for an area-less draft; callers pass a draft whose area is already resolved by `effectiveLifeAreaId` (Tasks 9 and 10). (5) Update the doc comments that enumerate "title, description and priority" (the `ApplyTo` comment and the `planSeriesOccurrenceSave` doc) so they name the area. Do not touch `src/shared/recurrence.ts`.
- **MIRROR**: `# SOURCE: src/shared/series-edit.ts:339-343`, `# SOURCE: src/shared/series-edit.ts:356`, `# SOURCE: src/shared/series-edit.ts:379-392` and `# SOURCE: src/shared/series-edit.ts:145-158`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/series-edit.ts; npx prettier --check src/shared/series-edit.ts; npx vitest run --project worker test/series-edit.test.ts; grep -qE 'TEMPLATE_TASK_FIELDS = \[[^]]*"lifeAreaId"' src/shared/series-edit.ts; git diff --quiet main -- src/shared/recurrence.ts` — the existing suite is the regression guard (every case builds a draft with no area decision and must keep its exact expectation); the pair's added cases prove the routing.

### Task 3: CREATE src/shared/life-area-assign.ts

- **ACTION**: Create the pure module behind showing and choosing an area, delivering the decidable half of AC-A1, AC-A2, AC-A5 and AC-A7. Header as `src/shared/life-areas.ts` (a purity statement: no DOM globals, no Worker globals, no clock, no network; imports only `./api` for types and `./life-areas` for `compareLifeAreaNames`). Export exactly: (1) `NO_AREA_VALUE = "none"` — the one literal for "no area": the chip value in the sheet and, from phase 4, the `lifeAreaId=none` filter and query value (ids are UUIDs, so it cannot collide; the server already reserves it). (2) `type AreaOption = Pick<LifeAreaDto, "id" | "name">`. (3) `lifeAreaNameOf(areas: readonly AreaOption[] | null, lifeAreaId: string | null): string | null` — the name of the area with that id, and `null` when `areas` is `null` (not loaded or failed), when `lifeAreaId` is `null`, or when no area has that id. (4) `type AreaGroupView = { kind: "hidden" } | { kind: "empty" } | { kind: "choices"; options: readonly AreaOption[] }` and `decideAreaGroup(areas: readonly AreaOption[] | null): AreaGroupView` — `null` is `hidden` (the request failed or has not answered: the sheet offers nothing and says nothing, because "you have no areas" would be false), an empty list is `empty` (the one line and the button), otherwise `choices` holding a COPY of the input sorted by `compareLifeAreaNames` on `name`, never mutating the argument. (5) `areaChoiceValue(lifeAreaId: string | null): string` — `NO_AREA_VALUE` for `null`, else the id; and `lifeAreaIdFromChoice(next: readonly string[]): string | null` — `null` for `[]` (a deselected pressed chip clears the area, as *Prioridade* does) and for `[NO_AREA_VALUE]`, else the first element. (6) `captureAreaFields(areaFilter: string | null): { lifeAreaId?: string | null }` — the area fields a newly captured Task carries given the area-filter value, which has the exact vocabulary AC-13 gives the filter's own field: `null` means no area filter and returns `{}` (NO `lifeAreaId` key at all), `NO_AREA_VALUE` returns `{ lifeAreaId: null }`, any other string is an area id and returns `{ lifeAreaId: <id> }`. Every export carries a short English doc comment naming the AC-A item it serves.
- **MIRROR**: `# SOURCE: src/shared/life-areas.ts:1-11` (the module header and sibling-only imports) and `# SOURCE: src/shared/life-areas.ts:46-55` (the pt-BR comparator is reused, not re-implemented).
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/life-area-assign.ts; npx prettier --check src/shared/life-area-assign.ts; if grep -hoE 'from "[^"]+"' src/shared/life-area-assign.ts | grep -vE '^from "\./(api|life-areas)"$'; then echo "FAIL: life-area-assign.ts imports outside its siblings"; exit 1; else echo "PASS: only sibling imports"; fi; npx vitest run --project worker life-area-assign` — the last command runs the pair's suite for this module (any file under `test/` whose name contains `life-area-assign`); it fails when no such suite exists, which is intended: the module is the test-first surface of AC-14.

### Task 4: UPDATE src/shared/format.ts

- **ACTION**: Delivers AC-A2. Add an exported `interface TaskMetaParts { phrase: string | null; priorityWord: "alta" | "baixa" | null; areaName: string | null; overdue: boolean }` and an exported `taskMetaParts(task: TaskDto, today: string, areaName: string | null = null): TaskMetaParts | null` holding the logic `taskMetaLine` holds today, unchanged in its date phrases and its `overdue` rule: `done` returns `null`; `missed` returns `{ phrase: "não concluída", priorityWord: null, areaName: null, overdue: true }` (a closed row never shows the area); an open Task returns the date phrase text (or `null`), the priority word (`"alta"` for `high`, `"baixa"` for `low`, `null` otherwise), the `areaName` given (or `null`) and the `overdue` of the date phrase (`false` when there is none); it returns `null` only when all three of phrase, priority word and area name are absent. Rewrite `taskMetaLine(task, today, areaName: string | null = null)` as a thin function over `taskMetaParts`: `null` stays `null`, otherwise `{ text, overdue }` with `text` the present parts among `phrase`, `priorityWord`, `areaName` — in that order — joined by ` · `. For a two-argument call the result must be byte-identical to today's in every case (that is what keeps `test/format.test.ts` untouched). So an open Task due Monday 2026-08-24 with high priority and an area named `Casa` reads `até seg., 24/08 · alta · Casa`; with neither date nor priority it reads `Casa` with `overdue: false`; an overdue date keeps `overdue: true`. Update the module header's rule list to name the area. Do not touch `formatDayShort`, `formatRemaining`, `formatHeaderDate` or `formatEventTime`.
- **MIRROR**: `# SOURCE: src/shared/format.ts:158-166`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/format.ts; npx prettier --check src/shared/format.ts; npx vitest run --project worker test/format.test.ts; grep -qF 'export function taskMetaParts' src/shared/format.ts` — the existing suite pins every two-argument string and `null`; the pair's added cases pin the area behaviour.

### Task 5: UPDATE src/app/components/ui/Chip.tsx

- **ACTION**: Infrastructure for AC-A5 — delivers no criterion alone: the PRD's mitigation for twelve areas plus *Sem área* at 375 px (Technical Risks, "Chips wrap inside the sheet's scroll region") needs a group that wraps, and `ChipGroup` today is a single horizontally scrolling row. Add an optional `wrap?: boolean` prop to `ChipGroup`, default `false`. When `false` the `className` is exactly the string it is today (`flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]`), so every existing group renders byte-identically; when `true` it is `flex flex-wrap gap-2 px-4 py-1`. Touch nothing else: `Chip`, the props already there and the Base UI `ToggleGroup` wiring stay as they are. Phase 4's filter sheet reuses the same option.
- **MIRROR**: `# SOURCE: src/app/components/ui/Chip.tsx:24-34`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/ui/Chip.tsx; npx prettier --check src/app/components/ui/Chip.tsx; grep -qF 'flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]' src/app/components/ui/Chip.tsx; grep -qF 'flex flex-wrap gap-2 px-4 py-1' src/app/components/ui/Chip.tsx` — the first literal proves the default class string survived; the text is the deliverable here, and Level 3's production build proves Tailwind still compiles the file.

### Task 6: CREATE src/app/hooks/useLifeAreas.ts

- **ACTION**: Delivers AC-A7 and supplies the areas AC-A2 and AC-A5 read. Create `export function useLifeAreas(onUnauthorized: () => void): { lifeAreas: readonly LifeAreaSummaryDto[] | null; refresh: () => Promise<void> }`, the areas in their OWN atom — never folded into the Task list, `busy`, an error state or the connectivity reducer — so a failed or slow request can neither blank the list nor be mistaken for "no areas" (the two states `decideAreaGroup` tells apart). State: `useState<LifeAreaSummaryDto[] | null>(null)` and a `useRef(0)` request counter. `refresh()` increments the counter, calls `fetchLifeAreas()` from `../api`, and only the newest request may write: on success `setLifeAreas(response.lifeAreas)`; on an `ApiError` with `status === 401` call `onUnauthorized()` and return; on any other failure `setLifeAreas(null)`. It never calls `report`, never toasts, never sets an error state and never reads `noArea`. A mount effect calls `refresh()`; a `visibilitychange` effect calls it again whenever the document becomes visible (guidelines §12.4: there is no manual refresh gesture). Doc comment in English: why it is shared by *Hoje* and search (the two sheets and the two row lists cannot drift, as `useSeriesSheet` states), that failure is absence by design (AC-22) and that the Task list never waits for it.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:165-170`, `# SOURCE: src/app/components/TodayScreen.tsx:365-385`, `# SOURCE: src/app/components/TodayScreen.tsx:773-786` and `# SOURCE: src/app/hooks/useSeriesSheet.ts:27-35`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/hooks/useLifeAreas.ts; npx prettier --check src/app/hooks/useLifeAreas.ts; grep -qF 'fetchLifeAreas' src/app/hooks/useLifeAreas.ts; grep -qF 'visibilitychange' src/app/hooks/useLifeAreas.ts; if grep -nE 'showToast|useToast|report\(|useConnectivity' src/app/hooks/useLifeAreas.ts; then echo "FAIL: the areas hook must not toast or touch connectivity (AC-22)"; exit 1; else echo "PASS: failure is silent absence"; fi` — `tsc -b` proves the hook's return type satisfies the pure functions of Task 3 once Tasks 8 to 10 consume it.

### Task 7: UPDATE src/app/components/TaskRow.tsx

- **ACTION**: Delivers AC-A2 on the row. Add an OPTIONAL prop `areaName?: string | null` (default `null`; optional so `DesignPlayground.tsx` compiles unchanged). Replace the `taskMetaLine(task, today)` call and the whole `splitMeta` helper by `const parts = taskMetaParts(task, today, areaName);` (import `taskMetaParts` from `../../shared/format`; drop the now-unused `taskMetaLine` and `TaskPriority` imports). The meta `<span>` renders when `parts !== null`, with the same class string and the same `overdue` rule (`parts.overdue && "text-overdue"`), and inside it, in order: the existing series glyph and ` Repete ` when `task.seriesId !== null`; `parts.phrase`; when both `parts.phrase` and `parts.priorityWord` are present the ` · ` between them (it used to be the tail of the string prefix); the existing `ChevronUp` / `ChevronDown` glyph and ` ${parts.priorityWord}` exactly as today; and finally, when `parts.areaName !== null`, ` · ` followed by the name — the ` · ` is omitted only when nothing at all precedes the name inside the span (no series glyph, no phrase, no priority). With `areaName` null the rendered row must be byte-identical to today's in every case (AC-15: a Task with no area "gets exactly the line it gets today"). No string slicing, no `endsWith`: the structured parts are what remove the hazard of an area named `alta`.
- **MIRROR**: `# SOURCE: src/app/components/TaskRow.tsx:19-30` (what is removed) and `# SOURCE: src/app/components/TaskRow.tsx:109-130` (the markup that is kept and re-sourced).
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/TaskRow.tsx; npx prettier --check src/app/components/TaskRow.tsx; grep -qF 'taskMetaParts' src/app/components/TaskRow.tsx; grep -qF 'areaName' src/app/components/TaskRow.tsx; if grep -nE 'endsWith\(|splitMeta' src/app/components/TaskRow.tsx; then echo "FAIL: string-splitting of the meta line is back"; exit 1; else echo "PASS: the row renders from structured parts"; fi` — the rendered look is the manual level; `tsc -b` proves the row uses `TaskMetaParts` with the right shape.

### Task 8: UPDATE src/app/components/TaskSheet.tsx

- **ACTION**: Delivers AC-A5 and the sheet half of AC-A7. (1) Two new OPTIONAL props with a doc comment each: `lifeAreas?: readonly AreaOption[] | null` (the owner's areas; `null` or absent means unknown or failed, so the group is absent and says nothing) and `onOpenLifeAreas?: () => void` (opens *Áreas*). Optional so `DesignPlayground.tsx` compiles unchanged. (2) `const areaGroup = decideAreaGroup(lifeAreas ?? null);` beside the other derived values. (3) Directly after the *Prioridade* group and before the `canRepeat` block, render when `areaGroup.kind !== "hidden"`: a `<p className="m-0 font-data text-t1 font-semibold text-muted">` reading `Área`, then either — for `empty` — a `div` holding one muted line `Você ainda não criou nenhuma área.` (`m-0 font-text text-t2 text-muted`) and, only when `onOpenLifeAreas` is defined, a secondary `Button` reading `Criar áreas` (`type="button"`, `onClick={onOpenLifeAreas}`, `disabled={busy}`); or — for `choices` — a `<ChipGroup multiple={false} wrap label="Área" ...>` whose `value` is `[areaChoiceValue(effectiveLifeAreaId(shownDraft, shown))]`, whose `onValueChange` calls `onDraftChange({ lifeAreaId: lifeAreaIdFromChoice(next) })`, and whose children are `<Chip value={NO_AREA_VALUE}>{NO_AREA_LABEL}</Chip>` followed by one `<Chip key={option.id} value={option.id}>{option.name}</Chip>` per option, in the order `decideAreaGroup` returned (alphabetical, pt-BR). `NO_AREA_LABEL` comes from `../../shared/life-areas-view`; the decision helpers from `../../shared/life-area-assign`; `effectiveLifeAreaId` from `../../shared/task-edit`. Tapping the pressed chip clears the area to *Sem área*, exactly as *Prioridade* does. Nothing is mandatory: a Task saves with no area. (4) Because the area now follows *Aplicar a*, replace the visible text and the `ChipGroup` `label` of that block, both, with the exact literal `Aplicar título, descrição, prioridade e área a` (WCAG 2.5.3: the visible label is in the accessible name), and update the doc comment of the `applyTo` prop the same way. The copy is the plan's proposal (guidelines §9's voice is still pending the owner); it lives in the component as literals, one edit to change. Do not change the sheet's save path: `onSave`, `onSaveSeriesOccurrence` and `onSaveWithRecurrence` stay as they are and the parent decides what is sent.
- **MIRROR**: `# SOURCE: src/app/components/TaskSheet.tsx:261-273` and `# SOURCE: src/app/components/TaskSheet.tsx:385-391`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/TaskSheet.tsx; npx prettier --check src/app/components/TaskSheet.tsx; grep -qF 'decideAreaGroup(' src/app/components/TaskSheet.tsx; grep -qF 'effectiveLifeAreaId(' src/app/components/TaskSheet.tsx; grep -qF 'NO_AREA_LABEL' src/app/components/TaskSheet.tsx; grep -qF 'Você ainda não criou nenhuma área.' src/app/components/TaskSheet.tsx; grep -qF 'Criar áreas' src/app/components/TaskSheet.tsx; test "$(grep -cF 'Aplicar título, descrição, prioridade e área a' src/app/components/TaskSheet.tsx)" -ge 2; if grep -qF 'Aplicar título, descrição e prioridade a' src/app/components/TaskSheet.tsx; then echo "FAIL: the old Aplicar a label survives"; exit 1; else echo "PASS: Aplicar a names the area"; fi` — the sheet itself is the manual level; the literal checks are acceptable because the deliverable IS the pt-BR copy, and `tsc -b` proves the optional props line up with Tasks 3 and 5.

### Task 9: UPDATE src/app/components/TodayScreen.tsx and src/app/App.tsx (the TodayScreen element)

- **ACTION**: Delivers AC-A1, AC-A2, AC-A5, AC-A6 and AC-A7 on *Hoje*. In `TodayScreen.tsx`: (1) a new required prop `onOpenLifeAreas: () => void` with a doc comment ("threaded from `App.tsx`; opens `/settings/life-areas` from the Task sheet's zero-areas button"). (2) Call `const { lifeAreas, refresh: refreshLifeAreas } = useLifeAreas(onUnauthorized);` before `useConnectivity`, and add `void refreshLifeAreas();` to the `onOnline` callback beside the existing refreshes (a first load that failed offline recovers on reconnect). (3) *Capture seam*: in `submitCapture`, immediately before `void run(...)`, declare `const activeAreaFilter: string | null = null;` with a comment that `TaskFilter` has no area dimension until phase 4's AC-13, so no area filter can be active and the request stays byte-identical to today's, and that phase 4 replaces this one line with `filter.lifeAreaId`; then `await createTask({ title: trimmed, ...captureAreaFields(activeAreaFilter) });` — the FR-045 sequencing (`setTitle("")` after the awaited call) is unchanged. (4) *Conversion keeps the area*: in `saveSheetWithRecurrence`, `const draft = currentDraft(sheet, sheetTask);` and pass `{ ...draft, lifeAreaId: effectiveLifeAreaId(draft, sheetTask) }` as the first argument of `buildCreateSeriesInput`, so a one-off that already has an area, or one the owner just chose, does not lose it in the create-then-delete. (5) In `renderDayItems`, give the `TaskRow` `areaName={lifeAreaNameOf(lifeAreas, task.lifeAreaId)}`. (6) Give `TaskSheet` `lifeAreas={lifeAreas}` and `onOpenLifeAreas={onOpenLifeAreas}`. Imports: `useLifeAreas`, `captureAreaFields`, `lifeAreaNameOf`, `effectiveLifeAreaId`. Do NOT add any area to `TaskFilter`, the `filter` state, `FilterChips`, `FilterSheet`, `refresh()` or `listTasks(...)`. In `App.tsx` add `onOpenLifeAreas={() => navigate("life-areas")}` to the `TodayScreen` element, after `onOpenAdherence`.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:459-471`, `# SOURCE: src/app/components/TodayScreen.tsx:636-644`, `# SOURCE: src/app/components/TodayScreen.tsx:859-870` and `# SOURCE: src/app/App.tsx:112-121`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/TodayScreen.tsx src/app/App.tsx; npx prettier --check src/app/components/TodayScreen.tsx src/app/App.tsx; grep -qF 'useLifeAreas(' src/app/components/TodayScreen.tsx; grep -qF 'captureAreaFields(' src/app/components/TodayScreen.tsx; grep -qF 'effectiveLifeAreaId(' src/app/components/TodayScreen.tsx; grep -qF 'lifeAreaNameOf(' src/app/components/TodayScreen.tsx; grep -qF 'onOpenLifeAreas={() => navigate("life-areas")}' src/app/App.tsx; if grep -nE 'lifeAreaId' src/shared/task-filter.ts src/app/components/FilterSheet.tsx src/app/components/FilterChips.tsx; then echo "FAIL: the area filter dimension belongs to phase 4"; exit 1; else echo "PASS: filter boundary intact"; fi` — `tsc -b` also proves `onOpenLifeAreas` is satisfied by the only caller.

### Task 10: UPDATE src/app/components/SearchScreen.tsx and src/app/App.tsx (the SearchScreen element)

- **ACTION**: Delivers AC-A2, AC-A5, AC-A6 and AC-A7 in search. In `SearchScreen.tsx`: (1) a new required prop `onOpenLifeAreas: () => void`. (2) `const { lifeAreas } = useLifeAreas(onUnauthorized);` beside `useSeriesSheet`. (3) Give the `TaskRow` in `renderDayItems` `areaName={lifeAreaNameOf(lifeAreas, task.lifeAreaId)}` — the search screen shows the name exactly as *Hoje* does (PRD D-P) and gets NO area control. (4) Give `TaskSheet` `lifeAreas={lifeAreas}` and `onOpenLifeAreas={onOpenLifeAreas}`. (5) In `saveSheetWithRecurrence`, resolve the area exactly as Task 9 does, with `effectiveLifeAreaId`. (6) Leave `listTasks({ ...EMPTY_FILTER, q }, undefined, signal)` as it is: phase 4's null dimension in `EMPTY_FILTER` then leaves search unfiltered with no edit here. In `App.tsx` add `onOpenLifeAreas={() => navigate("life-areas")}` to the `SearchScreen` element (it becomes a multi-line element once Prettier wraps it). Capture is not on this screen, so `captureAreaFields` is not imported here.
- **MIRROR**: `# SOURCE: src/app/components/SearchScreen.tsx:346-357` and `# SOURCE: src/app/App.tsx:112-121`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/SearchScreen.tsx src/app/App.tsx; npx prettier --check src/app/components/SearchScreen.tsx src/app/App.tsx; grep -qF 'useLifeAreas(' src/app/components/SearchScreen.tsx; grep -qF 'lifeAreaNameOf(' src/app/components/SearchScreen.tsx; grep -qF 'effectiveLifeAreaId(' src/app/components/SearchScreen.tsx; test "$(grep -cF 'onOpenLifeAreas={() => navigate("life-areas")}' src/app/App.tsx)" -eq 2; if grep -nE 'captureAreaFields' src/app/components/SearchScreen.tsx; then echo "FAIL: capture does not exist on the search screen"; exit 1; else echo "PASS: no capture seam in search"; fi`

### Task 11: CREATE PRPs/reports/life-areas/phase-3/ui-checklist.md

- **ACTION**: Create the record (the directory may not exist yet), delivering AC-A8 and the recording half of AC-A5 and AC-A7. Read `documentation/40-engineering/ui-ux-guidelines.md`'s "Review checklist" and, after Tasks 1-10 are in place, run Tier A items 1-9 at 375 px dark in the browser pane on the Task sheet (one-off, occurrence of a series, with areas, with none, with the areas request blocked), on the row (with and without an area name, with a 40-character name, a high-priority and a recurring Task, in *Hoje* and in search) and Tier B items 10-14. Record each item on ONE line that starts with its number, a period and a space (`1. ` … `14. `): `✔` with the method, `✘` with a one-line reason on the same line (and the word `exception` there when it is a recorded, conscious exception), `pending live check (orchestrator browser pass)` when no rendered pane was available to the Implementer, or `owed to the owner's device` for the device-only items named in Level 4. Never ✔ from imagination and never claim a screenshot that was not taken (guidelines §12.6). Then add two sections headed exactly `## AC-20 walk` and `## AC-22 walk`, one line per clause of PRD AC-20 and AC-22 in the same vocabulary; `AC-14`'s UI half cannot be observed until phase 4 adds the filter, and the record says so in its own line rather than claiming it. Record the `npm run build` size numbers for item 13. One ✘ without a recorded conscious exception means the phase is not done.
- **MIRROR**: `# SOURCE: PRPs/reports/life-areas/phase-2/ui-checklist.md:18-21`.
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/phase-3/ui-checklist.md; for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14; do grep -qE "^${i}\. " PRPs/reports/life-areas/phase-3/ui-checklist.md; done; grep -qF '## AC-20 walk' PRPs/reports/life-areas/phase-3/ui-checklist.md; grep -qF '## AC-22 walk' PRPs/reports/life-areas/phase-3/ui-checklist.md; if grep -E '^[0-9]+\. .*✘' PRPs/reports/life-areas/phase-3/ui-checklist.md | grep -viE 'exception|owed'; then echo "FAIL: an unexplained ✘ remains in the checklist"; exit 1; else echo "PASS: no unexplained ✘"; fi`

## Validation Commands

Run from the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

### Level 1 STATIC_ANALYSIS

```bash
set -euo pipefail
# wrangler types --check && tsc -b && eslint . && prettier --check .
# If the format gate reports a file, run `npx prettier --write <touched non-test files>` first.
npm run check
```

### Level 2 CONTENT_INVARIANTS and UNIT_TESTS

```bash
set -euo pipefail
# the pure modules ADR-0006 froze stay byte-identical to main (PRD AC-23, applied to this phase's diff)
git diff --quiet main -- src/shared/recurrence.ts src/shared/adherence.ts
# this unit adds no migration and changes none (PRD AC-23)
if [ -n "$(git status --porcelain -- migrations)" ] || ! git diff --quiet main -- migrations; then
  echo "FAIL: migrations/ changed — this unit adds none"; exit 1
else
  echo "PASS: migrations/ untouched"
fi
# no new dependency (PRD AC-23: the unit's cost of reverting stays at zero)
git diff --quiet main -- package.json
# nothing under .claude/ is part of the diff
test -z "$(git diff --name-only main -- .claude)"
# the phase 4 boundary: no area dimension on the filter, its sheet or its chip row yet
if grep -nE 'lifeAreaId' src/shared/task-filter.ts src/app/components/FilterSheet.tsx src/app/components/FilterChips.tsx; then
  echo "FAIL: the area filter dimension belongs to phase 4 (AC-13)"; exit 1
else
  echo "PASS: filter boundary intact"
fi
# the new shared module imports only its siblings
if grep -hoE 'from "[^"]+"' src/shared/life-area-assign.ts | grep -vE '^from "\./(api|life-areas)"$'; then
  echo "FAIL: life-area-assign.ts imports outside its siblings"; exit 1
else
  echo "PASS: sibling imports only"
fi
# a failed areas request is silent absence: the hook never toasts or reports connectivity (AC-22)
if grep -nE 'showToast|useToast|report\(|useConnectivity' src/app/hooks/useLifeAreas.ts; then
  echo "FAIL: the areas hook must not toast or touch connectivity"; exit 1
else
  echo "PASS: failure stays silent"
fi
# capture goes through the pure decision, and the row no longer splits strings
grep -qF 'captureAreaFields(' src/app/components/TodayScreen.tsx
if grep -nE 'endsWith\(|splitMeta' src/app/components/TaskRow.tsx; then
  echo "FAIL: string-splitting of the meta line is back"; exit 1
else
  echo "PASS: row renders from structured parts"
fi
# no glossary synonym in the files this phase adds or edits for copy
if grep -niE 'categoria' src/shared/life-area-assign.ts src/app/hooks/useLifeAreas.ts src/app/components/TaskSheet.tsx src/app/components/TaskRow.tsx; then
  echo "FAIL: glossary synonym (categoria)"; exit 1
else
  echo "PASS: vocabulary clean"
fi
# both vitest projects: `worker` (inside workerd) and `docs`, including the pair's suites and every existing suite
npm test
```

### Level 3 INTEGRATION and DRY-RUN END-TO-END

```bash
set -euo pipefail
# the production bundle builds with the new hook, prop and chip option wired through App.tsx; read the size report against guidelines §11
npm run build
```

### Level 4 MANUAL (browser pane at 375 px dark, then the owner's device)

Not an exit-code gate: its recorded result is what Task 11's `VALIDATE` checks. Run `npm run dev` and walk the sheet and the rows (guidelines §12.6: the pane can assert `getBoundingClientRect`, computed styles, the accessibility-relevant DOM, real key presses and the network panel; it cannot be trusted for screenshots or transitions). Fixtures: no area, one area, twelve areas with 40-character names, an open Task with and without date, priority and area, a recurring Task, the areas request blocked in DevTools, offline.

| # | Tier | Item | Where it can be done |
|---|------|------|----------------------|
| 1 | A | One primary action on the sheet (*Salvar*); the *Área* group adds chips and, with no areas, one secondary *Criar áreas*; the row gains text only | browser pane |
| 2 | A | Every tappable control at least 48 x 48 px and at least 8 px from its neighbours: the *Sem área* chip and every area chip (wrapped), *Criar áreas*, the *Aplicar a* chips; the row's tap target is unchanged with a long name | browser pane (box model) |
| 3 | A | No meaning by colour alone: the area name is text; the selected area chip carries the check and the fill; a missing name is absence, not a colour | browser pane |
| 4 | A | Copy is pt-BR, sentence case, infinitive button (*Criar áreas*), "você" in the zero-areas line; the *Aplicar a* label names the area; no `categoria`; no "Sem área" marker on an area-less row | browser pane |
| 5 | A | Tab / Space on the chips, Esc closes the sheet, focus returns to the opener row; *Criar áreas* navigates and *Esc* on *Áreas* goes back | browser pane (real key presses) |
| 6 | A | The group has a visible *Área* label and the same `aria-label`; the icon-only controls are unchanged; `<title>` and `lang` untouched | browser pane |
| 7 | A | Tokens only, no literal colour, size or duration; reduced motion honoured (nothing new moves) | browser pane |
| 8 | A | No destructive action is added; *Aplicar a* keeps *Toda a série* as its default so an area edit does not detach by accident | browser pane |
| 9 | A | Only same-origin `/api/life-areas`, `/api/tasks` and `/api/series` requests; a failed `/api/life-areas` produces no other request | browser pane (network panel) |
| 10 | B | Contrast of the five pairs of §4.3 (the area text uses the row's existing muted meta tokens; no new pair) | **owner's device** for the real rendering |
| 11 | B | States simulated: areas request blocked (Tasks list, no names, no group, no banner or toast), zero areas (line and button), slow areas (Tasks first, names after), offline, an area deleted from another tab (400 on save shows under *Salvar*, list refetches on return), a series occurrence under both *Aplicar a* choices | browser pane (DevTools Network) |
| 12 | B | 375 px and 1280 px: twelve areas plus *Sem área* wrap inside the sheet's scroll region; a 40-character name on the row wraps without breaking the 64 px minimum; **safe areas, keyboard overlap and the Android back gesture are the owner's device only** | browser pane; **owner's device** for the last three |
| 13 | B | `vite build` size report read against §11 | `npm run build`; **Lighthouse on the phone is the owner's device only** |
| 14 | B | Screenshots filed under `PRPs/reports/life-areas/phase-3/` or the reason none exists | **owner's device photos** when the pane cannot render; never claim one that was not taken |

## Acceptance Criteria

- **AC-A1 (PRD AC-14):** Given the area-filter value, then `captureAreaFields` returns `{}` with no `lifeAreaId` key for no filter, `{ lifeAreaId: null }` for *Sem área* (`"none"`) and `{ lifeAreaId: <id> }` for an area id, as a pure function tested without the DOM; and *Hoje*'s create call spreads it through a single, documented seam that reads no filter dimension this phase, so the request a capture sends today is byte-identical and phase 4 changes one expression to make capture inherit the filter.
- **AC-A2 (PRD AC-15):** Given an open Task whose area is `Casa`, then its meta line ends with `Casa` after the date and priority phrases (`até seg., 24/08 · alta · Casa`), is just `Casa` with neither date nor priority, and keeps the overdue flag of its date phrase; the name shows on *Hoje* and in search; a Task with no area, or whose area name is unknown, gets exactly the line it gets today, with no "Sem área" marker; `done` and `missed` rows keep today's text; and the row keeps its priority glyph whatever the name is, including an area named `alta`.
- **AC-A3 (PRD AC-16):** Given an occurrence of an active series, when the owner changes only the area, then `planSeriesOccurrenceSave` with *Toda a série* sends `lifeAreaId` to the series PATCH and nothing to the Task PATCH, with *Só esta ocorrência* sends it to the Task PATCH alone (which detaches the occurrence, ADR-0006) and nothing to the series, and when the area is unchanged against the occurrence neither request carries it — including for a detached occurrence whose own area differs from its series'. The function is pure and tested without the DOM.
- **AC-A4 (PRD AC-9, AC-20):** Given a Task and its draft, then `buildTaskPatch` carries `lifeAreaId` only when the owner chose a value that differs from the Task's own (a new area, a different area, or `null` to clear), never when no choice was made or the choice equals the current area, so an ordinary re-save of an occurrence never detaches it and the key set stays inside `EDITABLE_TASK_FIELDS`.
- **AC-A5 (PRD AC-20):** Given the sheet of a Task and at least one area, then an *Área* single-choice group (*Sem área* first, then the areas alphabetically in pt-BR, wrapping inside the sheet) sits after *Prioridade*; saving persists the choice; on a series occurrence the choice follows *Aplicar a*, whose visible label and accessible name now name the area; with no areas the group is replaced by one line and a *Criar áreas* button that opens *Áreas* from *Hoje* and from search; and nothing is mandatory — a Task saves with no area.
- **AC-A6 (PRD AC-20, AC-10):** Given a one-off Task that has an area, or one to which the owner just chose an area, when he sets it to repeat, then the created series and its first occurrence carry that area (`buildCreateSeriesInput` carries a chosen area, the screens resolve it with `effectiveLifeAreaId`), and an area-less draft produces a request body with no `lifeAreaId` key at all.
- **AC-A7 (PRD AC-22):** Given the areas request fails or is slow, when *Hoje* or search loads, then Tasks list normally and independently of it, rows show no area name, the Task sheet offers no *Área* group and not the zero-areas line (a failed request is not "no areas"), and no banner, toast or connectivity report appears; a refresh that fails later degrades to the same absence, and a 401 routes to the token gate like every other request.
- **AC-A8 (PRD AC-23):** Given this phase's diff, then the UI/UX review checklist's ✔/✘ is recorded in `PRPs/reports/life-areas/phase-3/ui-checklist.md` with the device-only items marked owed, `src/shared/recurrence.ts` and `src/shared/adherence.ts` are byte-identical to `main`, no file was added under `migrations/`, no dependency was added, no test was removed, skipped or loosened (no existing assertion changes), `TaskFilter` and the filter sheet are untouched, and `npm run check` and `npm test` pass.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Re-saving or re-assigning an occurrence detaches it from its series (ADR-0006; PRD Technical Risks) | M | H | The area goes through *Aplicar a* (default *Toda a série*); an unchosen or unchanged area is never sent; `TEMPLATE_TASK_FIELDS` strips it from the Task PATCH under *Toda a série*; AC-A3 and AC-A4 are pure and tested (Tasks 1 and 2) |
| A kept draft re-sends an area id that was deleted or changed on another device, and the save answers 400 or silently reverts the area | M | M | The draft carries an area only once the owner has chosen one (optional member, not seeded); a chosen id that has since vanished fails with the existing inline message under *Salvar* and the list refetches on return (Tasks 1, 6) |
| The row's string splitting loses the priority glyph once a name follows it, or mis-splits an area named `alta` | H | M | `taskMetaParts` returns structured parts and `splitMeta` is deleted; Level 2 fails if `endsWith(` or `splitMeta` reappears in `TaskRow.tsx` (Tasks 4, 7) |
| A detached occurrence's own area rewrites the series' area on an unrelated edit under *Toda a série* | L | M | `planSeriesOccurrenceSave` counts the area as changed only against the occurrence on screen (Task 2); pinned by a case in Notes |
| A one-off Task with an area loses it when converted to a series (create-then-delete) | M | H | `buildCreateSeriesInput` carries a chosen area and both screens resolve it with `effectiveLifeAreaId` before building (Tasks 2, 9, 10); AC-A6 |
| Twelve areas plus *Sem área* overflow a horizontally scrolling chip row at 375 px (PRD Technical Risks) | M | M | `ChipGroup` gains an opt-in `wrap`, default unchanged; checklist items 2 and 12 use a twelve-area, 40-character fixture (Tasks 5, 8, 11) |
| A failed areas request is shown as "you have no areas", inviting him to create duplicates | M | M | `decideAreaGroup` distinguishes `null` (hidden) from `[]` (line and button) and is pinned; the hook returns `null` on failure (Tasks 3, 6) |
| Leaving the sheet for *Áreas* discards its unsaved edits, because the screens unmount on a route change | M | L | The button exists only on the zero-areas path, a one-time situation; the sheet never stacks (layout standard §3); recorded in the checklist (item 11) and Notes rather than hidden |
| Capture inheritance has no state to read until phase 4, so the seam could be forgotten | M | M | The pure function and its tests land now; the seam is one named constant with a comment naming AC-13 and `filter.lifeAreaId`; Level 2 keeps the filter boundary honest; Notes name what phase 4 wires |
| The pair names its suite for the new module differently and Task 3's `VALIDATE` filter finds nothing | L | L | Notes pin the file name `test/life-area-assign.test.ts`; the filter is a substring, so any name containing `life-area-assign` matches |
| No first-party evidence that task apps copy the active filter onto a captured item (Apple Reminders puts it in the default list; ClickUp users asked for inheritance for years; OmniFocus users disagree) | M | L | PRD D-M is a recorded owner decision, flagged as judgment in Notes; reverting it is `captureAreaFields` returning `{}` |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file; the `**VALIDATE**` commands of the UI tasks (5 to 11) exercise the change directly — compiler, linter, formatter and literal checks — rather than invoking the test framework.
- **Where the framework does run:** the `VALIDATE` commands of the pure-logic Tasks 1 to 4 also run the relevant suite file (existing suites by name, the new module's by the `life-area-assign` substring) as a regression guard and as the proof of the pair's added cases, and Level 2's `npm test` runs both projects. Running a suite is not touching a test file.
- **For the test pair — names and exact cases this plan pins** (PRD AC-14, AC-15 and AC-16 are the pure decisions of this row; AC-20 and AC-22 are manual):
  - **New suite `test/life-area-assign.test.ts`**, over `src/shared/life-area-assign.ts` (`NO_AREA_VALUE` is `"none"`). AC-14: `captureAreaFields(null)` equals `{}` and has no `lifeAreaId` key (`not.toHaveProperty`); `captureAreaFields("none")` has `lifeAreaId` present and `null` (`toHaveProperty("lifeAreaId", null)`); `captureAreaFields("3f2c9d1e-0000-4000-8000-000000000001")` equals `{ lifeAreaId: "3f2c9d1e-0000-4000-8000-000000000001" }`; `{ title: "marcar consulta", ...captureAreaFields(null) }` has exactly the keys `["title"]`. `lifeAreaNameOf`: `null` areas → `null`; `null` id → `null`; unknown id → `null`; a match → its name. `decideAreaGroup`: `null` → `{ kind: "hidden" }`; `[]` → `{ kind: "empty" }`; `[Trabalho, Casa, Ética]` → `choices` ordered `Casa`, `Ética`, `Trabalho`, and the input array is left unchanged. `areaChoiceValue(null)` → `"none"`, `areaChoiceValue("A")` → `"A"`; `lifeAreaIdFromChoice([])` → `null`, `(["none"])` → `null`, `(["A"])` → `"A"`.
  - **Existing `test/task-edit.test.ts`**, appended cases (AC-9, AC-20): original area `A`, draft with no `lifeAreaId` → `{}`; draft `lifeAreaId: "A"` (same) → `{}`; original `null`, draft `"A"` → `{ lifeAreaId: "A" }`; original `A`, draft `null` → `{ lifeAreaId: null }`; original `A`, draft `"B"` → `{ lifeAreaId: "B" }`; with every editable field changed plus the area the sorted keys are `["description", "lifeAreaId", "priority", "scheduledDate", "title"]`. `effectiveLifeAreaId({}, taskWithA)` → `"A"`, `({ lifeAreaId: null }, taskWithA)` → `null`, `({ lifeAreaId: "B" }, taskWithA)` → `"B"`.
  - **Existing `test/series-edit.test.ts`**, appended cases (AC-16, in the existing `occurrence`/`draftOf`/`seriesDto` style): occurrence area `A`, not detached, series area `A`, draft area `B`: with `"series"` → `seriesBody` equals `{ lifeAreaId: "B" }` and `taskChanges` equals `{}`; with `"occurrence"` → `seriesBody` is `null` and `taskChanges` equals `{ lifeAreaId: "B" }`; draft area `A` or no key, with a title edit, under both choices → no `lifeAreaId` key in either request; area cleared (`null`) under `"series"` → `seriesBody` equals `{ lifeAreaId: null }`; detached occurrence (own area `X`, series `Y`), draft area `Z`, `"series"` → `seriesBody` `{ lifeAreaId: "Z" }` and `taskChanges` `{ lifeAreaId: "Z" }`; detached occurrence (own `X`, series `Y`), draft with no area choice and a title edit, `"series"` → `seriesBody` `{ title }` and neither request has `lifeAreaId`; draft area equal to the occurrence's own `X` (touched and returned) with series `Y` and a title edit → `seriesBody` has no `lifeAreaId`; an area change together with a rule edit → one body `{ byMonthday: 10, lifeAreaId: "B" }`. `buildUpdateSeriesTemplate`: draft area differing from `series.lifeAreaId` → `{ lifeAreaId }`; equal or absent → `null`. `buildCreateSeriesInput`: draft `lifeAreaId: "A"` → `input.lifeAreaId === "A"`; draft `null` or absent → `not.toHaveProperty("lifeAreaId")`.
  - **Existing `test/format.test.ts`**, appended cases (AC-15; `TODAY` is `2026-08-21`, a Friday, so `2026-08-24` is a Monday; the PRD's `seg., 18/08` is illustrative — `2026-08-18` is a Tuesday and reads `ter., 18/08`): `taskMetaLine(task({ deadline: "2026-08-24", priority: "high" }), TODAY, "Casa")` → `{ text: "até seg., 24/08 · alta · Casa", overdue: false }`; the same without priority → `"até seg., 24/08 · Casa"`; no date and priority `low` → `{ text: "baixa · Casa", overdue: false }`; no date and no priority → `{ text: "Casa", overdue: false }`; `deadline: "2026-08-18"` with `"Casa"` → `{ text: "atrasada · venceu ter., 18/08 · Casa", overdue: true }`; `scheduledDate: "2026-08-22"` → `"fazer amanhã · Casa"`; an area named `alta` with priority `high` and no date → `"alta · alta"`; a `null` or omitted name returns exactly what the two-argument call returned for the same Task; `done` with a name → `null`; `missed` with a name → `{ text: "não concluída", overdue: true }`. `taskMetaParts`: the first case above → `{ phrase: "até seg., 24/08", priorityWord: "alta", areaName: "Casa", overdue: false }`; no date, no priority, name `Casa` → `{ phrase: null, priorityWord: null, areaName: "Casa", overdue: false }`; open with nothing → `null`; `done` → `null`; `missed` → phrase `"não concluída"`, the others `null`, `overdue: true`; and for a small grid of Tasks and names `taskMetaLine(...).text` equals the present parts joined by ` · `.
- **Existing assertions nearest to this phase — none changes its expected value, and the pair confirms they stay green** (no existing test is extended in place: the extensions above are appended cases, so nothing is routed through the ledger as an `UPDATE` or a `DELETE`): `test/task-edit.test.ts:223-245` (the key-set check — a draft built without an area decision still emits exactly `description`, `priority`, `scheduledDate`, `title`) and its `toEqual({})` cases; `test/series-edit.test.ts:530-563` (`buildUpdateSeriesTemplate` `toBeNull()` at the matching-fields cases) and `:574-684` (every `planSeriesOccurrenceSave` expectation); `test/format.test.ts:118-279` (every two-argument string); `test/task-sheet.test.ts:75-101, 127-141, 158-171` (the seeded draft keeps its five keys, because `draftFromTask` is not edited); `test/task-filter.test.ts:215-226` (`EMPTY_FILTER` keeps its five keys, because the filter dimension is phase 4's). The helpers `draftOf`/`taskDraft` in those files build `TaskDraft` literals without `lifeAreaId`, which type-checks because the member is optional and behaves as "no choice".
- **PRD-AC mapping (R8).** AC-A1..AC-A3 are PRD AC-14, AC-15 and AC-16 verbatim in their decidable form. AC-A4 cites AC-9 (the Task PATCH carries the area, unchanged is never sent) and AC-20 ("saving persists the choice"). AC-A5 and AC-A7 are the manual halves of AC-20 and AC-22. AC-A8 cites AC-23 for the invariants and the "checklist ✔/✘ recorded in the phase report" clause, which that criterion states and the PRD's Technical Approach applies to each phase; its complete-diff inspection stays phase 4's. Statements that are not literal clauses of those criteria are disclosed rather than hidden: AC-A6 (conversion keeps the area) is the "saving persists the choice" clause of AC-20 applied to the *Repetir* path plus AC-10's "the series and its first occurrence carry A"; the wrapping chip group is the PRD's own mitigation for its twelve-area risk; the "area changed only against the occurrence" rule of AC-A3 is the third clause of AC-16 ("when the area is unchanged neither request carries it") read for a detached occurrence. No PRD AC was invented and no plan AC cites a criterion that does not exist.
- **Decisions left to the plan, with their reasons.** (1) `TaskDraft.lifeAreaId` is OPTIONAL and unseeded ("present once chosen"), not a required key seeded by `draftFromTask`. A seeded key would let a kept draft re-send an area id that changed or was deleted elsewhere (a 400, or a silent revert), would change four exact-draft assertions in `test/task-sheet.test.ts`, and would make every existing `TaskDraft` literal in the suite stop type-checking. The cost is one helper, `effectiveLifeAreaId`, for the two places that need the effective value (the sheet's selection and the series conversion). (2) The sheet keeps *Sem área* as a real chip with the reserved value `none`, and tapping the pressed chip also clears, so there is one meaning for "no area" whichever way the owner reaches it. (3) `TaskRow` and `TaskSheet` take their new props as optional so the dev-only `DesignPlayground` compiles unchanged and a screen that does not know about areas simply shows none. (4) A failed areas refresh degrades to absence, as the adherence atom does, rather than keeping the last list: it is the PRD's AC-22 reading and the model the lead named; a stale list would offer a deleted area. (5) The areas request is not part of `refresh()` and is not keyed on the filter: it loads on mount, on return to the foreground and on reconnect, like adherence, and the Task list never waits for it. (6) `Criar áreas` navigates directly: the screens unmount on a route change, so the sheet's unsaved edits are lost; this is accepted because the button exists only while he has no areas, which happens once.
- **The phase 3 / phase 4 boundary for capture.** This phase adds the pure decision `captureAreaFields(areaFilter: string | null)` — `null` is the type phase 4's `TaskFilter["lifeAreaId"]` will have, with `"none"` for *Sem área* and an id otherwise, the vocabulary AC-13 already fixes — and one seam: `const activeAreaFilter: string | null = null;` in `TodayScreen.submitCapture`. `TaskFilter`, `EMPTY_FILTER`, `toQuery`, `activeCount`, `isChipActive`, `toggleChip`, `FilterChips` and `FilterSheet` are not touched, and Level 2 fails the phase if `lifeAreaId` appears in the three filter files. **Phase 4 must replace that one line with `filter.lifeAreaId`**; no signature changes and AC-14's pure tests already cover the function. Until then AC-14's observable half (capture inside a filtered view lands in that area) cannot be exercised on a device and is not claimed.
- **Proposed copy, pending the owner.** `Área` (label), `Você ainda não criou nenhuma área.` and `Criar áreas` in the sheet, and the *Aplicar a* label `Aplicar título, descrição, prioridade e área a` are this plan's proposals under ADR-0009 and guidelines §9's mechanics; guidelines §9 records the product voice as pending the owner. They are literals in `TaskSheet.tsx`, one edit each to change, and checklist item 4 names them.
- **Research grounding.** `research-codebase` located every anchor above (it reached its scope caps and did not open `DesignPlayground.tsx`, the day-groups modules or the tests after line 305 of `series-edit.test.ts`; the plan's own reads confirmed `DesignPlayground.tsx:297-399` passes every `TaskSheet` prop by name, which is why the new props are optional). It found no id-to-name helper, no sheet-state decider and no capture mapping — all new here — and that `buildCreateSeriesInput` never carried an area, which AC-A6 closes. `research-web` returned only thin, mostly community evidence: Apple Reminders places an item created in a Smart List in the default list; ClickUp users asked for new-item inheritance of filter properties for about five years; OmniFocus users disagree on whether a container's tag should be inherited at quick entry; GitLab, ClickUp, Quire and Toodledo threads show the cost of a repeated container label on every row and of hiding it under a filter. Its gaps are that no first-party source (Things, Todoist) was verified for either question, so PRD D-M and D-Q rest on the owner's decision, not on external evidence.
- **Docs and status.** No `docs/` or `documentation/` file is edited here: the architecture listing, the area docs and the roadmap are the post-merge docs update, and `ui-layout-standard.md` §2.6/§6 ("area dot" replaced by the area name), the glossary, `domain-model.md` and FR-008 are phase 4 (AC-25). Unit 13 stays `in-progress` after this phase; AC-20 and AC-22 are recorded in this phase's checklist with the device-only items owed, and the unit's own device proof is AC-24.
- **Slug.** "Assign and show" becomes `assign-and-show` under Step 1.4's rule, so the file is `life-areas-phase-3-assign-and-show.plan.md`.
- The CLAUDE.md UI/UX gate applies: the Implementer reads `documentation/40-engineering/ui-ux-guidelines.md` and `documentation/40-engineering/ui-layout-standard.md` before touching `src/app/`, and Task 11 records the checklist result.

*Generated: 2026-10-12*
*Approved: 2026-10-12*
*Implemented: 2026-10-12*
*Status: IMPLEMENTED*
