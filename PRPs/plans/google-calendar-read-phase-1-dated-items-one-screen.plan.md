# Feature: Dated items, one screen (Phase 1 of google-calendar-read)

```
**Decision Gate**
- Active context: none
- Activated criteria: cross-cutting patterns; reuse or creation of components; impact on shared UI; impact on reusable services; domain rules (tasks, events)
- Decisions found:
  - ADR-0005 — types originate in `src/worker/db/schema.ts` (Drizzle) and flow outward through `src/worker/dto.ts` to `src/shared/api.ts`; never hand-duplicated.
  - Unit 2's frozen Task read contract (2026-08-15) — the API computes urgency ordering in SQL before `limit`; the client never re-derives it (`docs/api-reference.md`).
  - ADR-0008 — test-first. The test pair authors the suite from the PRD's Acceptance Criteria before the Implementer runs; this plan authors production code only.
  - ADR-0009 — visible UI copy is pt-BR; identifiers, comments and tests stay English.
  - ADR-0010/ADR-0011 — the Arcade identity and the owned shadcn-style components; this phase changes no visual token and adds no component.
  - ADR-0007 — Google Calendar is read-only in Phase 1 and Events are unit 14's entity; this phase must therefore be able to describe a non-Task dated item WITHOUT introducing an Event entity.
- Applicable anti-patterns:
  - Hand-duplicated entity types — the projection must derive from `TaskDto`, never restate its fields as a parallel truth.
  - Weakening tests to force green — `test/task-groups.test.ts` is this phase's characterization suite and must pass byte-unchanged.
  - Glossary synonym drift — the new vocabulary is "day item" / "source"; Task stays Task and Event stays Event.
  - Portuguese in artifacts (carve-out: visible UI copy) — every new identifier and comment is English.
- Applicable architectural rules:
  - `src/shared/` compiles into both the browser and the Worker projects, so it carries no DOM globals, no Worker globals, no runtime dependencies and no clock reads — `today` is always an argument.
  - A partition is not a sort. The client chunks the order the API produced; re-deriving it here would move the frozen contract's most load-bearing guarantee into the one place consumers cannot share.
  - Per-target tsconfigs with project references make an app/worker boundary violation a compile error.
- Result: PROCEED
```

## Source

- `PRPs/prds/google-calendar-read.prd.md` — Implementation Phases row 1: "Dated items, one screen" — Goal: give the *Hoje* screen a seam for a second kind of dated item, before any of it exists — Success signal: the range function is called with zero, one and two sources in a test and is correct in all three (AC-10); a Task-only day groups byte-identically to today (AC-14); the shipped screen looks and behaves exactly as it does now.

## Summary

This phase widens the *Hoje* screen's data path from "a list of Tasks" to "a list of dated items that declare where they came from", and it does so with **no Google code anywhere** — no route, no fetch, no credential, no schema change. The approach is a **projection at the boundary**, not a polymorphic algorithm: each source type is mapped once into one narrow `DayItem` shape carrying a `source` discriminant, and the partition then runs over that shape as a plain function. The range function AC-10 demands — one function taking a *list of sources* — becomes `collectDayItems(sources, today)`, whose behaviour at zero, one and two sources falls out of a single stable merge with no source-count branch. `groupTasks` survives as a thin wrapper with its exported signature unchanged, which is what lets the existing characterization suite prove the widening changed nothing.

## User Story

```
As the owner of Praesto
I want the Hoje screen to be able to show something that is not a Task
So that my Google commitments can appear beside my Tasks in a later phase without the screen being rebuilt
```

## Problem Statement

The *Hoje* screen has no seam for a second item type. `TodayScreen` holds `tasks: TaskDto[] | null` as its only data state and renders every bucket through one `renderTaskRows` helper; `groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups` hard-codes `TaskDto[]` in all five buckets and buckets on `status` plus `deadline ?? scheduledDate` — three fields a Google event does not have. Wiring Google into that shape directly would mean either widening the screen and integrating the provider in the same change, or teaching the provider to impersonate a Task. The first risks a regression on the owner's daily surface at the exact moment a new failure mode arrives; the second is the hand-duplicated-entity-type anti-pattern wearing a disguise.

## Solution Statement

Introduce `DayItem` — a discriminated union tagged by `source`, whose Task variant is *derived from* `TaskDto` rather than restating it — and a projection that maps a `TaskDto` into it. Introduce `collectDayItems(sources, today)`, which partitions a list of already-projected sources into the same five buckets, merging them with a stable rule that preserves each source's own relative order. Re-express `groupTasks` as a one-source call to that function, keeping its signature and `TaskGroups` byte-identical so no consumer outside the module changes. Finally, route `TodayScreen`'s rendering through the discriminant, delegating the `"task"` case to the existing `TaskRow` untouched. The screen's pixels do not move in this phase; only its data path widens.

## Metadata

| Key | Value |
|---|---|
| Type | Refactor (behaviour-preserving widening) + new pure module |
| Complexity | Medium — the algorithm is small, but it sits under the owner's daily screen and under a frozen contract |
| Systems Affected | `src/shared/` (two new modules, one widened), `src/app/components/TodayScreen.tsx` |
| Dependencies | None — row 1's `Depends` cell is empty |
| Estimated Tasks | 6 |
| Source PRD line ref | `PRPs/prds/google-calendar-read.prd.md:183` (Implementation Phases row 1); Phase Details at `:210` |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| 1 | `src/shared/task-groups.ts` | 1-66 | The module being widened. Its header comment states the two invariants this phase must not break: never sort, never read the clock |
| 1 | `test/task-groups.test.ts` | 26-49, 192-209 | The characterization suite. The `task()` fixture factory and the concatenation-identity test that makes AC-14 verifiable without writing anything new |
| 1 | `src/shared/api.ts` | 15-40 | `TaskStatus`, `TaskPriority`, `TaskDto` — the type the projection must derive from, never restate |
| 2 | `src/app/components/TodayScreen.tsx` | 117, 367-386, 396-399, 438-474 | The two coupling points (`groupTasks` call, `renderTaskRows`) and every place `groups.*` is consumed |
| 2 | `src/app/components/TaskGroup.tsx` | 12-45 | Already item-agnostic (`children: ReactNode`). Confirms the section shell needs no change |
| 2 | `src/worker/routes/tasks.ts` | 53-118 | The SQL `urgencyBucket` CASE the client partition mirrors. The merge rule must not contradict it |
| 3 | `vitest.config.ts` | 30-65 | All `test/**/*.test.ts` run inside workerd; only `docs-consistency.test.ts` is carved out to node. There is no separate tier for pure `src/shared/` tests |
| 3 | `PRPs/prds/google-calendar-read.prd.md` | 72, 76, 210-214 | PRD AC-10 and AC-14 verbatim, plus this phase's Goal/Scope/Success signal |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-groups.ts:17-25
import type { TaskDto } from "./api";

/** The five buckets a Task can belong to. Keys are English; the pt-BR group names live in `TaskGroup`. */
export interface TaskGroups {
  overdue: TaskDto[];
  today: TaskDto[];
  upcoming: TaskDto[];
  undated: TaskDto[];
  closed: TaskDto[];
}
```

```ts
# SOURCE: src/shared/task-groups.ts:45-66
export function groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups {
  const groups: TaskGroups = { overdue: [], today: [], upcoming: [], undated: [], closed: [] };

  for (const task of tasks) {
    if (task.status !== "open") {
      groups.closed.push(task);
      continue;
    }

    const due = task.deadline ?? task.scheduledDate;
    if (due === null) {
      groups.undated.push(task);
    } else if (due < today) {
      groups.overdue.push(task);
    } else if (due === today) {
      groups.today.push(task);
    } else {
      groups.upcoming.push(task);
    }
  }

  return groups;
}
```

```ts
# SOURCE: test/task-groups.test.ts:192-209
  it("is the identity function on a list already in the API's urgency order", () => {
    const groups = groupTasks(inApiOrder, TODAY);

    const concatenated = [
      ...groups.overdue,
      ...groups.today,
      ...groups.upcoming,
      ...groups.undated,
    ];

    // The frozen contract's ordering guarantee, expressed as a property: the
    // order the API produced survives the grouping untouched, because grouping
    // only chunks it.
    expect(concatenated.map((row) => row.id)).toEqual(inApiOrder.map((row) => row.id));
  });
```

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:366-386
  /** The `<ul>` of `TaskRow`s shared by every group — five callers, one prop shape, unchanged from what the screen rendered before grouping. */
  function renderTaskRows(rows: TaskDto[]): ReactNode {
    return (
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((task) => (
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
        ))}
      </ul>
    );
  }
```

```ts
# SOURCE: test/task-groups.test.ts:26-49
function task(
  title: string,
  overrides: {
    status?: TaskStatus;
    deadline?: string | null;
    scheduledDate?: string | null;
    priority?: TaskPriority | null;
  } = {},
): TaskDto {
  return {
    id: `id-${title}`,
    title,
    description: null,
    status: overrides.status ?? "open",
    deadline: overrides.deadline ?? null,
    scheduledDate: overrides.scheduledDate ?? null,
    priority: overrides.priority ?? null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    completedAt: null,
    createdAt: 1_700_000_000,
  };
}
```

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/day-item.ts` | CREATE | The `DayItem` discriminated union, its `DayItemSource` container, the `TaskDto → DayItem` projection, and the `never`-assertion exhaustiveness helper. Pure, DOM-free, clock-free |
| `src/shared/day-groups.ts` | CREATE | `collectDayItems(sources, today)` — the range function PRD AC-10 requires, taking a *list* of sources with no source-count branch |
| `src/shared/task-groups.ts` | UPDATE | `groupTasks` becomes a one-source call to `collectDayItems`; its exported signature and the `TaskGroups` shape stay byte-identical |
| `src/app/components/TodayScreen.tsx` | UPDATE | Render through the `source` discriminant; the `"task"` case delegates to the existing `TaskRow` with the same props |

## NOT Building (Scope Limits)

- **Any Google code** — no OAuth route, no `fetch` to Google, no credential, no scope, no calendar selection. Phases 2 and 3 own all of it.
- **An Event entity, table or migration** — unit 14 is where the sync-aware schema is born (ADR-0007). The `DayItem` union's non-Task variant is a *view-model shape*, not a persisted entity, and this phase constructs none of them outside tests.
- **Any visual change** — no new component, no token change, no copy change. `TaskGroup`, `TaskRow`, `FilterChips`, `FilterSheet` and every style are untouched. The screen after this phase must be indistinguishable from the screen before it.
- **Widening `src/shared/format.ts`** — `taskMetaLine(task: TaskDto, today)` and `formatRemaining` stay Task-specific. How a non-Task item renders its meta line is a presentation decision, and phase 4 owns it. Grounding flagged this explicitly; deferring it is deliberate, not an oversight.
- **Widening `src/shared/task-filter.ts`** — `TaskFilter` embeds `TaskStatus`/`TaskPriority`. How the existing filters relate to events is named in the PRD as phase 4's decision; touching it here would pre-empt that decision silently.
- **Authoring the test suite** — `tdd: true`, so the test pair authors tests from the PRD's Acceptance Criteria before the Implementer runs. This plan's tasks produce production code; its `VALIDATE` commands exercise it.
- **Modifying `test/task-groups.test.ts`** — it is this phase's characterization suite. Changing it would destroy the only evidence that the widening preserved behaviour.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/day-item.ts`

- **ACTION**: Create the module. Export `DaySource = "task" | "google"`. Export `DayItem` as a discriminated union tagged by a `source` property: the Task variant carries `source: "task"`, the projected bucketing fields (`id: string`, `dueDate: string | null`, `closed: boolean`) and a `task: TaskDto` payload; the second variant carries `source: "google"`, the same three bucketing fields, and its own payload placeholder typed so that no Event entity is implied. **Derive the payload type from `TaskDto` by importing it** — never restate its fields. Export `dayItemFromTask(task: TaskDto): DayItem`, whose body computes `dueDate` as `task.deadline ?? task.scheduledDate` and `closed` as `task.status !== "open"`, mirroring the status-before-dates rule the current `groupTasks` body encodes. Export `assertNeverDaySource(value: never): never` using the TypeScript handbook's `never`-assertion idiom, so adding a third source in unit 14 becomes a compile error rather than a silent fallthrough. Keep the module free of DOM globals, Worker globals and clock reads, matching the header contract of `task-groups.ts`. Serves **AC-A1/AC-A2/AC-A3 (PRD AC-10)** — the projection is what lets one partition serve every source — and **AC-A5 (PRD AC-14)**, by deriving from `TaskDto` rather than restating it.
- **MIRROR**: `src/shared/task-groups.ts:17-25` (the export shape and the "keys are English" comment discipline) and `src/shared/task-groups.ts:45-66` (the status-before-dates and `deadline ?? scheduledDate` rules the projection must reproduce exactly).
- **VALIDATE**: `npx tsc -b`

### Task 2: CREATE `src/shared/day-groups.ts`

- **ACTION**: Create the module. Export `DayItemGroups` with the same five keys as `TaskGroups` (`overdue`, `today`, `upcoming`, `undated`, `closed`), each a `DayItem[]`. Export `DayItemSource = { id: string; items: readonly DayItem[] }`. Export `collectDayItems(sources: readonly DayItemSource[], today: string): DayItemGroups`. Implement it as: partition every source's items into the five buckets using `closed` first and then `dueDate` against `today` as `YYYY-MM-DD` strings; then, within each bucket, produce a **stable merge** across sources keyed on `dueDate`, preserving each source's own relative order and breaking ties by the source's index in the `sources` array. Write the function so the same code path runs for any number of sources — **no `if (sources.length === 0)` and no `if (sources.length === 1)` shortcut** — because PRD AC-10 requires zero, one and two sources to be correct through one path. Document in the header comment why the merge is stable rather than a sort: the API already ordered the Task source and re-sorting would re-derive the frozen contract's guarantee on the client.
- **MIRROR**: `src/shared/task-groups.ts:45-66` — the single-pass partition, the `< today` / `= today` / `> today` ladder and the zero-padded-string comparison rationale.
- **VALIDATE**: `npx tsc -b`

### Task 3: UPDATE `src/shared/task-groups.ts`

- **ACTION**: Re-express `groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups` as a thin wrapper: project the input with `dayItemFromTask`, call `collectDayItems` with exactly one source, and unwrap each bucket's `DayItem`s back to their `TaskDto` payloads. **The exported signature and the `TaskGroups` interface must not change**, so no consumer outside this module is touched for type reasons. Keep the existing header comment's two invariants (never sort, never read the clock) and extend it with one sentence explaining that the partition now lives in `day-groups.ts` and this module is its Task-shaped façade. Serves **AC-A4 and AC-A5 (PRD AC-14)** — the unchanged signature is what keeps every consumer untouched, and the unchanged behaviour is what the characterization suite proves.
- **MIRROR**: `src/shared/task-groups.ts:17-25` — the `TaskGroups` interface, preserved verbatim.
- **VALIDATE**: `npx vitest run test/task-groups.test.ts`

### Task 4: UPDATE `src/app/components/TodayScreen.tsx`

- **ACTION**: Route the render path through the discriminant without changing a pixel. Keep `const groups = groupTasks(tasks ?? [], today)` working, or replace it with the `collectDayItems` equivalent — either is acceptable provided the five `groups.*` consumption sites at lines 396-399 and 438-474 keep reading five arrays with the same lengths. Rename or wrap `renderTaskRows` so it accepts the widened item and `switch`es on `item.source`, delegating `"task"` to the existing `<TaskRow>` with **exactly the props it receives today** (`task`, `today`, `busy`, `editing`, `onToggle`, `onOpen`, `onEdit`, `onCommitTitle`, `onCancelEdit`), and routing the `"google"` case to `assertNeverDaySource` or an explicit not-yet-rendered branch — this phase constructs no Google items, so that branch is unreachable at runtime and exists only to make unit 14's addition a compile-time obligation. Do not touch `TaskGroup`, `TaskRow`, the collapse state, the filter state, or any className. Serves **AC-A6 (PRD AC-14)** — the screen must be indistinguishable from its pre-phase self — and **AC-A3 (PRD AC-10)**, since the `never` branch is what makes unit 14's third source a compile error rather than a silent omission.
- **MIRROR**: `src/app/components/TodayScreen.tsx:366-386` — the `renderTaskRows` body and its exact `TaskRow` prop list.
- **VALIDATE**: `npm run check`

### Task 5: VERIFY the characterization suite was not touched

- **ACTION**: Confirm that `test/task-groups.test.ts` is byte-unchanged relative to the phase's base commit. This is the evidence for PRD AC-14: the widening is behaviour-preserving precisely because the suite that pinned the old behaviour still passes without being edited. If the suite needed an edit to pass, the widening changed behaviour and the task list is wrong — fix the production code, never the suite (`docs/anti-patterns.md`, "Weakening tests to force green").
- **MIRROR**: `test/task-groups.test.ts:192-209` — the concatenation-identity test, the specific assertion this task protects.
- **VALIDATE**: `if ! git diff --quiet HEAD -- test/task-groups.test.ts; then echo "FAIL: test/task-groups.test.ts was modified; PRD AC-14 requires it to pass byte-unchanged"; exit 1; else echo "PASS: characterization suite untouched"; fi`

### Task 6: VERIFY the whole suite and the type boundary

- **ACTION**: Run the full test suite and the check gate together, confirming that (a) no existing test regressed, (b) `src/shared/day-item.ts` and `src/shared/day-groups.ts` compile into both the app and the Worker projects without a boundary violation, and (c) formatting and lint are clean. A failure in the Worker project specifically would mean a DOM global leaked into a `src/shared/` module — the boundary the per-target tsconfigs exist to catch. Serves **AC-A5 (PRD AC-14)** — its claim that no file outside the four named ones needed an edit is only credible if the whole suite and the whole type graph still pass.
- **MIRROR**: `vitest.config.ts:30-65` — the two-project split that determines which tier a failure came from.
- **VALIDATE**: `npm test && npm run check`

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```
npm run check
```

Runs `wrangler types --check && tsc -b && eslint . && prettier --check .`. Each stage propagates its own non-zero exit status; `tsc -b` is what proves the new `src/shared/` modules are legal in both the app and Worker projects.

**Level 2 — UNIT_TESTS**

```
npx vitest run test/task-groups.test.ts
```

`vitest run` exits non-zero on any failing test. This is the characterization gate: the suite pinned `groupTasks`'s behaviour before the widening and must pass unedited after it.

**Level 3 — INTEGRATION**

```
npm test
```

The full suite across both vitest projects (`worker` in workerd, `docs` in node). This is where a regression in `test/task-list-contract.test.ts` — the frozen read contract — would surface, and where a Worker-project compile failure caused by a leaked DOM global in `src/shared/` would appear.

## Acceptance Criteria

- **AC-A1 (PRD AC-10):** Given `collectDayItems` and an empty `sources` array, when it is called with any `today`, then it returns five empty buckets and does not throw — through the same code path the one- and two-source cases use.
- **AC-A2 (PRD AC-10):** Given `collectDayItems` and exactly one source, when it is called, then every bucket preserves that source's own relative order exactly as received, with no reordering of any kind.
- **AC-A3 (PRD AC-10):** Given `collectDayItems` and two sources, when it is called, then each bucket is a stable merge in which every source's own relative order is preserved and ties on `dueDate` resolve by the source's index in the `sources` array; and the implementation contains no branch on `sources.length`.
- **AC-A4 (PRD AC-14):** Given `test/task-groups.test.ts` exactly as it exists at the phase's base commit, when the full suite runs after the widening, then every test passes with the file byte-unchanged — including the concatenation-identity test at `test/task-groups.test.ts:192`.
- **AC-A5 (PRD AC-14):** Given `groupTasks` after the widening, when its exported signature and the `TaskGroups` interface are compared with their pre-phase form, then both are unchanged, and no file outside `src/shared/task-groups.ts`, `src/shared/day-item.ts`, `src/shared/day-groups.ts` and `src/app/components/TodayScreen.tsx` required an edit.
- **AC-A6 (PRD AC-14):** Given the *Hoje* screen rendered against real Tasks after the widening, when the owner opens it, then the five groups, their counts, their collapse behaviour, the chip row and the filter sheet are indistinguishable from the pre-phase screen. Verified manually — `docs/context/methodology.md` keeps React component verification manual, so this criterion produces no test file.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The widening silently changes bucket membership or intra-bucket order on the owner's daily screen | M | H | `test/task-groups.test.ts` is a characterization suite in Michael Feathers' sense — it pins observed behaviour rather than asserting correctness — and Task 5's VALIDATE fails the phase if it was edited to pass |
| The merge rule contradicts the API's own `urgencyBucket` ordering, re-deriving on the client what the frozen contract says the server owns | M | H | The merge is stable and never sorts: for one source it is the identity, which is exactly what AC-A2 asserts. `src/worker/routes/tasks.ts:53-118` is mandatory reading so the two ladders stay aligned |
| A DOM global leaks into the new `src/shared/` modules and breaks the Worker build | L | M | Per-target tsconfigs make it a compile error; Level 1's `tsc -b` and Task 6 catch it before review |
| `DayItem`'s non-Task variant drifts toward being an Event entity ahead of unit 14 | M | M | Scope-limited explicitly in NOT Building: it is a view-model shape, this phase constructs none of them outside tests, and no schema or migration is touched |
| The exhaustiveness branch for `"google"` is unreachable in this phase and could be written as dead code that lies | L | M | It is written as a `never` assertion per the TypeScript handbook idiom, so unit 14 adding a third source is a compile error rather than a silent fallthrough |

## Notes

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Why projection at the boundary rather than a generic `<T extends DatedItem>`.** A generic constraint would require the *Task* to carry `dueDate` and `closed` fields it does not have, or force every call site to supply accessor functions — either way spreading knowledge of `TaskDto`'s internals outward. Projecting once, at the boundary, keeps the partition a plain function over one narrow shape and confines Task-specific knowledge to `dayItemFromTask`. The union tag then rides along so the renderer can discriminate, with the handbook's `never`-assertion idiom (https://www.typescriptlang.org/docs/handbook/2/narrowing.html) turning unit 14's third source into a compile error. The Adapter framing is the classical name for the same move (https://refactoring.guru/design-patterns/adapter/typescript/example).

**Research gap, recorded rather than papered over.** Web research found no handbook or well-regarded style guide that directly compares discriminated unions against generic constraints against structural capability interfaces for a bucketing function over two entity shapes, and no public precedent for widening a shipped, tested pure function to accept a second structurally different type without duplicating it. The choice above is argued from this codebase's own constraints, not from an external recommendation.

**Characterization testing is the named technique** behind AC-A4 (https://en.wikipedia.org/wiki/Characterization_test): the suite blacklists any deviation from established behaviour rather than whitelisting expected values, which is exactly the guarantee a behaviour-preserving widening needs. The project already has that suite by accident of good practice — this phase spends it.

**On the merge algorithm.** At this scale (one source of tens of items, later two) a stable merge and a concat-then-sort are indistinguishable in cost. The merge is chosen for a correctness reason, not a performance one: concat-then-sort would re-derive an ordering the API already produced and guarantees, which the frozen read contract puts out of the client's hands.

**No `design_source` or `phase_scope` row in Metadata** — `docs/context/methodology.md` declares `figma_track: false`, and the source PRD declares no `visual_first`, so both conditional keys and their companion sections are absent by contract rather than by omission.

*Generated: 2026-08-25*
*Approved: 2026-08-26*
*Status: APPROVED*
