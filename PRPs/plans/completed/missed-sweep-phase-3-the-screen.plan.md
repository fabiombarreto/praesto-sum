# Feature: The screen (Phase 3 of missed-sweep)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test and implement stages consume); user-visible interface change on a shipped screen (*Hoje*) and on the search route; changes how a shared pure grouping function partitions closed Tasks; documentation pass owed by the maintenance map; domain rules for tasks
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording — `missed` is terminal and system-written; every skipped cycle leaves a permanent row (the screen must show that record honestly)
  - ADR-0008 / [2026-08-04] Test-first methodology — pure logic in `src/shared` is in TDD scope; React components are NOT written test-first and UI verification stays manual
  - ADR-0009 / [2026-08-18] Visible UI copy in pt-BR; code, identifiers, comments, tests, docs in English
  - ADR-0010 / ADR-0011 (visual identity and owned UI library) — the new group reuses `TaskGroup` and existing tokens; no new token, primitive or dependency
  - missed-sweep PRD D-G (*Concluídas* lists only `done`; a separate collapsed *Não concluídas* group with its count lists `missed`, on *Hoje* and in search, decided in `groupTasks`/`collectDayItems`, test-first) and Decisions Log "Migration: none"
  - [2026-08-29] An APPROVED PRD's phase table may grow only with a dated amendment note (not exercised here — no row is added)
- Applicable anti-patterns:
  - Portuguese in artifacts (visible copy pt-BR; identifiers, comments, tests, docs English)
  - Glossary synonym drift ("missed" in code and docs; *não concluída* only as the pt-BR UI term from the guidelines' term table)
  - Weakening tests to force green (existing `closed`-bucket assertions change only as recorded lifecycle updates owned by the test pair)
  - Hand-duplicated entity types (the split reads `TaskDto.status` from `src/shared/api.ts`; no new type copy)
  - Editing accepted ADRs (ADR-0006 is applied, not amended; no new ADR is needed)
  - Mirroring Tasks, Reminders or Life Areas to Google (not approached)
  - Writing pipeline artifacts under `.claude/`
- Applicable architectural rules:
  - `src/shared` stays DOM-free, clock-free and dependency-free; `today` is an argument
  - `src/shared/recurrence.ts` and `src/worker/db/schema.ts` stay unchanged; no migration
  - UI/UX guidelines are MANDATORY on any `src/app/` change: the review checklist runs and its result is recorded BEFORE the merge (CLAUDE.md; guidelines "How to use this document")
  - `documentation/` is authoritative, `docs/` is derived; both are updated in the same session as the change (documentation/README.md maintenance map)
  - One Worker serves everything; the thin client holds no authoritative state (nothing in this phase writes data)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/missed-sweep.prd.md` — Implementation Phases row 3: "The screen" — Goal: A miss is shown as a miss, and the owner earns the exit signal on his device. — Success signal: AC-19 green; UI/UX checklist ✔/✘ recorded before the merge; AC-21 observed on the owner's device and recorded in Delivery history.

## Summary

Phases 1 and 2 made the cron write `missed` rows, but every screen still files them under *Concluídas*, because the shared partition puts every non-open Task in one `closed` bucket. Phase 3 splits that bucket: `collectDayItems` (`src/shared/day-groups.ts`) — the function both screens actually call — gains separate `done` and `missed` buckets in place of `closed`, and its Task-shaped façade `groupTasks` (`src/shared/task-groups.ts`) mirrors the same two keys. `TodayScreen` then renders *Concluídas* from the `done` bucket and a new *Não concluídas* group from the `missed` bucket, collapsed by default with its count, persisted in the existing `praesto.today.collapsed.<group>` scheme; `SearchScreen` renders the same two groups with local collapse state for the missed one. The UI/UX review checklist is run on the change and its ✔/✘ result is recorded in a report before the merge. The unit's documentation pass (roadmap, tasks domain rules, layout standard, visual-identity copy table, CLAUDE.md status text, and the items phase 2 deferred) lands in the same phase. The device proof (AC-21) is the owner's, not the implementer's, and is recorded in Delivery history only after he observes it.

## User Story

As the owner
I want a missed occurrence to appear under its own *Não concluídas* group instead of *Concluídas*
So that the screen tells the truth about what I did and did not do, without my having to read each row's meta line

## Problem Statement

From unit 10 on, something writes `missed` rows. `groupTasks`/`collectDayItems` put every Task whose status is not `open` into one `closed` bucket, which both screens render as *Concluídas* — harmless while nothing wrote `missed`, but from now on a miss listed as "completed" is exactly the dishonesty ADR-0006 and the project's honest-mirror principle exist to remove. Narrowed to Phase 3: the pure partition must separate `done` from `missed`, both screens must render the two groups, the interface change must pass the mandatory UI/UX checklist, and the documents that describe the screen and the missed state must stop being stale.

## Solution Statement

Split the bucket at its source, not in the screens. `bucketOf` in `src/shared/day-groups.ts` already reads status before dates; it gains one more branch: a closed Task item whose `task.status === "missed"` goes to `missed`, every other closed item to `done` (an external calendar item never reaches either, `closed` is always `false` for it). `DayItem` itself is left unchanged — the discriminator is read from the already-carried `TaskDto`, so `day-item.ts` and its tests are untouched. `DayItemGroups` and `TaskGroups` replace `closed` with `done` and `missed`; the concatenation of all buckets still reproduces the input. The screens render the new bucket with the existing `TaskGroup` (no new component, token or copy beyond the two pt-BR group names already in the guidelines' term table). Existing assertions on `closed` change only as recorded lifecycle updates by the test pair, never by the Implementer.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT (partition split + two screen groups) and documentation pass |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/day-groups.ts`, `src/shared/task-groups.ts`, `src/app/components/TodayScreen.tsx`, `src/app/components/SearchScreen.tsx`, `src/app/components/TaskGroup.tsx` (comment only); `documentation/` and `docs/` per the maintenance map; `CLAUDE.md`; a new report under `PRPs/reports/missed-sweep/phase-3/` |
| Dependencies | none new; phases 1 and 2 (complete) — their code lives in the worktree `.worktrees/missed-sweep`, not yet on `main` |
| Estimated Tasks | 8 |
| Source PRD line ref | `PRPs/prds/missed-sweep.prd.md` Implementation Phases row 3; AC-19..AC-21 |
| phase_type | feature |

## Mandatory Reading

All paths are relative to the repository root and resolve identically in the worktree `.worktrees/missed-sweep`, where this phase is implemented (phases 1-2 are uncommitted there).

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/missed-sweep.prd.md` | 159-172, 266, 317 | Phase 3 acceptance criteria AC-19..AC-21, the grouping architecture note and decision D-G the screens implement |
| P0 | `src/shared/day-groups.ts` | 26-55, 106-146 | `DayItemGroups`, `bucketOf` and `collectDayItems` — where the split really lives; the key list is repeated in the interface, two `Record` initialisers and the return |
| P0 | `src/shared/task-groups.ts` | 25-75 | `TaskGroups` and the `groupTasks` façade (no non-test caller in `src/app`; both screens call `collectDayItems`) whose doc comments say "five buckets" |
| P0 | `src/app/components/TodayScreen.tsx` | 78-104, 196-209, 273-276, 528-534, 1004-1047 | The collapse-key constants and storage helpers, the collapsed-by-default state idiom, the `groups` computation, the toggle pattern and the *Concluídas* `TaskGroup` being split |
| P0 | `src/app/components/SearchScreen.tsx` | 56-84, 423-447 | `groups` computation and the five non-collapsible `TaskGroup`s; this screen has no collapse state today |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 93-103, 146-168 | MANDATORY on any `src/app/` change: pt-BR copy rules and the term table (missed → não concluída), and the review checklist (Tier A items 1-9, Tier B items 10-14) |
| P1 | `src/app/components/TaskGroup.tsx` | 1-68 | The group section: count always rendered, `count === 0` returns `null`, no `onToggle` means non-collapsible; its header comment ("a fifth time for *Concluídas*") goes stale |
| P1 | `src/shared/day-item.ts` | 34-78, 106-119 | `closed` is `status !== "open"` for a Task and always `false` for an event — read-only here; the split must not change it |
| P1 | `test/task-groups.test.ts` | 56-136, 212-256 | The characterization suite whose `closed` assertions are lifecycle updates the test pair owns (read-only for the Implementer) |
| P1 | `test/day-groups.test.ts` | 69-140 | The `collectDayItems` suites and their bucket list (read-only for the Implementer) |
| P1 | `documentation/40-engineering/ui-layout-standard.md` | 31, 67-79 | §2.5 group list (does not name *Concluídas* at all today) and the History table that takes a dated amendment row |
| P1 | `documentation/10-product/visual-identity.md` | 95-101 | The copy table whose "Section" row lists only *Concluídas* |
| P1 | `documentation/50-planning/roadmap.md` | 63, 105, 169-171 | Unit 10 row, the "Now:" line (stale: "no phase planned yet") and the Delivery history table (newest first) |
| P1 | `docs/domain/areas/tasks.md` | 12-13 | The recurrence and `missed` business rules, which must state where a miss is shown and who writes it |
| P1 | `PRPs/reports/missed-sweep/phase-2/docs-update.md` | 22-32 | Docs edits phase 2 deferred to this phase (tasks domain area, roadmap, FR-009/FR-011, a `documentation/30-architecture` counterpart check, CLAUDE.md) |
| P2 | `docs/context/architecture.md` | 21, 23, 41 | `components/` and `src/shared/` inventories that describe `groupTasks` as "five buckets" and the phase-2 sentence about the sweep |

## Patterns to Mirror

Every snippet was read directly from the cited lines of the worktree (`.worktrees/missed-sweep`). The `research-codebase` and `research-web` dispatches ran and their findings are folded in below; the web pass found no mainstream-app precedent for a collapsed "not completed" group with a count (see Risks), so the screen pattern mirrors this repository's own collapsible groups rather than an external convention.

```ts
// SOURCE: src/shared/day-groups.ts:49-55
function bucketOf(item: DayItem, today: string): BucketKey {
  if (item.closed) return "closed";
  if (item.dueDate === null) return "undated";
  if (item.dueDate < today) return "overdue";
  if (item.dueDate === today) return "today";
  return "upcoming";
}
```
Copied by: Task 1 (`closed` is read first and stays first; the single `"closed"` return becomes a `done`-or-`missed` choice).

```ts
// SOURCE: src/shared/day-groups.ts:110-146
export function collectDayItems(sources: readonly DayItemSource[], today: string): DayItemGroups {
  const streams: Record<BucketKey, DayItem[][]> = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
    closed: [],
  };

  for (const source of sources) {
    const perBucket: Record<BucketKey, DayItem[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      undated: [],
      closed: [],
    };

    for (const item of source.items) {
      perBucket[bucketOf(item, today)].push(item);
    }

    for (const bucket of Object.keys(streams) as BucketKey[]) {
      streams[bucket].push(perBucket[bucket]);
    }
  }

  return {
    overdue: mergeStable(streams.overdue),
    today: mergeStable(streams.today),
    upcoming: mergeStable(streams.upcoming),
    undated: mergeStable(streams.undated),
    closed: mergeStable(streams.closed),
  };
}
```
Copied by: Task 1 (every place the bucket key list appears gains `done` and `missed` in place of `closed`; the single code path for any number of sources stays).

```ts
// SOURCE: src/shared/task-groups.ts:65-75
export function groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups {
  const groups = collectDayItems([{ id: "tasks", items: tasks.map(dayItemFromTask) }], today);

  return {
    overdue: unwrap(groups.overdue),
    today: unwrap(groups.today),
    upcoming: unwrap(groups.upcoming),
    undated: unwrap(groups.undated),
    closed: unwrap(groups.closed),
  };
}
```
Copied by: Task 2 (the façade mirrors the two new keys; its exported signature is unchanged).

```ts
// SOURCE: src/app/components/TodayScreen.tsx:201-209
  const [undatedCollapsed, setUndatedCollapsed] = useState(() =>
    readCollapsed(UNDATED_COLLAPSED_KEY, true),
  );
  const [agendaCollapsed, setAgendaCollapsed] = useState(() =>
    readCollapsed(AGENDA_COLLAPSED_KEY, true),
  );
  const [doneCollapsed, setDoneCollapsed] = useState(() =>
    readCollapsed(CLOSED_COLLAPSED_KEY, false),
  );
```
Copied by: Task 3 (the new `missedCollapsed` state uses the collapsed-by-default `readCollapsed(KEY, true)` form; `CLOSED_COLLAPSED_KEY` stays byte-identical so the owner's *Concluídas* preference survives).

```ts
// SOURCE: src/app/components/TodayScreen.tsx:528-534
  function toggleDoneCollapsed(): void {
    setDoneCollapsed((current) => {
      const next = !current;
      writeCollapsed(CLOSED_COLLAPSED_KEY, next);
      return next;
    });
  }
```
Copied by: Task 3 (`toggleMissedCollapsed` is the same shape over the new key).

```tsx
// SOURCE: src/app/components/TodayScreen.tsx:1029-1045
            <TaskGroup
              name="Sem data"
              count={groups.undated.length}
              collapsed={undatedCollapsed}
              onToggle={toggleUndatedCollapsed}
            >
              {renderDayItems(groups.undated)}
            </TaskGroup>

            <TaskGroup
              name="Concluídas"
              count={groups.closed.length}
              collapsed={doneCollapsed}
              onToggle={toggleDoneCollapsed}
            >
              {renderDayItems(groups.closed)}
            </TaskGroup>
```
Copied by: Task 3 (*Concluídas* reads `groups.done`; *Não concluídas* follows it with the same props over `groups.missed`).

```tsx
// SOURCE: src/app/components/SearchScreen.tsx:440-446
            <TaskGroup name="Sem data" count={groups.undated.length}>
              {renderDayItems(groups.undated)}
            </TaskGroup>
            <TaskGroup name="Concluídas" count={groups.closed.length}>
              {renderDayItems(groups.closed)}
            </TaskGroup>
          </>
```
Copied by: Task 4 (search renders `groups.done` as *Concluídas* and adds *Não concluídas* over `groups.missed`, the latter collapsible).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/day-groups.ts` | UPDATE | Replace the `closed` bucket by `done` and `missed` in `DayItemGroups`, `bucketOf`, both `Record` initialisers and the return; refresh the doc comments (AC-19) |
| `src/shared/task-groups.ts` | UPDATE | `TaskGroups` gains `done` and `missed` in place of `closed`; `groupTasks` maps both; header comments no longer say "five buckets" / "lands in `closed`" |
| `src/app/components/TodayScreen.tsx` | UPDATE | *Concluídas* reads `groups.done`; new collapsed-by-default *Não concluídas* group with its own persisted key and toggle (AC-20) |
| `src/app/components/SearchScreen.tsx` | UPDATE | *Concluídas* reads `groups.done`; new *Não concluídas* group with local collapse state, collapsed by default (AC-20) |
| `src/app/components/TaskGroup.tsx` | UPDATE | Comment only: the header says the section is reused "four times ... plus a fifth time for *Concluídas*"; it is now reused for six groups |
| `PRPs/reports/missed-sweep/phase-3/ui-checklist.md` | CREATE | The UI/UX review checklist's ✔/✘ result, recorded before the merge (guidelines "How to use this document"; precedent `PRPs/reports/text-search/phase-2/ui-checklist.md`) |
| `documentation/10-product/visual-identity.md` | UPDATE | Copy table "Section" row lists *Não concluídas* beside *Concluídas*; `last_updated` moves |
| `documentation/40-engineering/ui-layout-standard.md` | UPDATE | §2.5 item 5 names the closed groups after *Sem data*; a dated History row records the amendment; `last_updated` moves |
| `documentation/50-planning/roadmap.md` | UPDATE | Unit 10 row, the "Now:" line and a Delivery history entry for phases 1-3 delivered with AC-21 explicitly OWED; `last_updated` moves |
| `documentation/30-architecture/domain-model.md` | UPDATE | Only if it states where a `missed` Task is shown or that nothing writes it — check first; edit only a false or stale statement |
| `docs/domain/areas/tasks.md` | UPDATE | The `missed` rule states who writes it (the cron sweep), when, and where it is shown (*Não concluídas*, never *Concluídas*) |
| `docs/context/architecture.md` | UPDATE | `src/shared/` and `components/` inventories: `groupTasks`/`collectDayItems` buckets are six; the screens render a *Não concluídas* group |
| `CLAUDE.md` | UPDATE | Unit 10 status text ("no phase planned yet" is false since phase 1) and the stale suite count |

No test file appears here on purpose: this phase's test updates (the `closed` assertions in `test/task-groups.test.ts` and `test/day-groups.test.ts`, plus new `done`/`missed` cases for AC-19) are created and maintained by the `test-writer` / `test-reviewer` pair (see `## Notes`). `src/shared/day-item.ts` is deliberately NOT in this table: it needs no change.

## NOT Building (Scope Limits)

- **Adherence statistics, the "what I keep failing" list and any aggregation of misses** — unit 11 `adherence-mirror`. This phase lists the rows; it does not count them beyond the group's own count.
- **Notifying the owner of a miss** — unit 12 `repeated-miss-nudge`.
- **Undoing a miss** — `missed` is terminal; the complete control on a `missed` row stays disabled (`TaskRow` already does this) and no reopen path is added.
- **Any change to the sweep, the cron, the pure plan or the Reminder sweep** — phases 1 and 2 are complete and consumed as-is.
- **Any change to `src/shared/recurrence.ts`, `src/worker/db/schema.ts`, `migrations/`** — unit 17's reuse condition and "no migration".
- **A change to `src/shared/day-item.ts`, `TaskRow`, `src/shared/format.ts` or `FilterSheet`** — the read side of `missed` (the *não concluída* meta line, the *Não concluídas* status chip, the disabled complete control) already exists and is correct.
- **Aggregating a long absence on screen** — a daily series left for a month yields ~30 rows in *Não concluídas*; the PRD records this as an Open Question for real use, and unit 11 owns the aggregated view.
- **A new design token, UI primitive, dependency, route or API field.**
- **The device proof itself** — AC-21 is the owner's observation in production; the implementer cannot complete it (see `## Notes`).

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/day-groups.ts

**ACTION**: Replace the single `closed` bucket with two buckets, `done` and `missed`, everywhere the key appears: the `DayItemGroups` interface (`overdue`, `today`, `upcoming`, `undated`, `done`, `missed`), the `streams` initialiser, the `perBucket` initialiser and the returned object (`done: mergeStable(streams.done)`, `missed: mergeStable(streams.missed)`). In `bucketOf`, keep `if (item.closed)` as the FIRST test, but replace `return "closed"` with: return `"missed"` when `item.source === "task" && item.task.status === "missed"`, otherwise `"done"`. Do not add a field to `DayItem` and do not edit `src/shared/day-item.ts`: the discriminator is read from the `TaskDto` the Task variant already carries, and a calendar item (`closed: false`) can never reach either bucket. Keep the merge logic, the single code path for any number of sources and the stable-partition guarantee untouched (no sorting). Update the doc comments that say "five buckets" / `closed` to describe six buckets and the done/missed split, naming D-G of the missed-sweep PRD. Keep the module DOM-free, clock-free and dependency-free.

**MIRROR**: `# SOURCE: src/shared/day-groups.ts:49-55` (the `bucketOf` ladder whose first branch is being split) and `# SOURCE: src/shared/day-groups.ts:110-146` (every key list that must change together).

**AC**: Delivers AC-A1.

**VALIDATE**: `set -euo pipefail; npx tsc -b; npx vitest run test/day-groups.test.ts test/task-groups.test.ts test/day-item.test.ts test/day-item-event.test.ts; if grep -nE "\bclosed\b *:|\"closed\"|\.closed\b" src/shared/day-groups.ts | grep -v "item\.closed" ; then echo "FAIL: a closed bucket reference is left in day-groups.ts"; exit 1; else echo "PASS: bucket renamed everywhere"; fi`

### Task 2: UPDATE src/shared/task-groups.ts

**ACTION**: In `TaskGroups`, replace `closed: TaskDto[]` with `done: TaskDto[]` and `missed: TaskDto[]`; in `groupTasks`, replace `closed: unwrap(groups.closed)` with `done: unwrap(groups.done)` and `missed: unwrap(groups.missed)`. The exported signature `groupTasks(tasks, today)` is unchanged. Rewrite the header comment and the function's doc comment: six buckets now; any Task whose `status !== "open"` still never reappears in a dated bucket (status before dates), a `done` Task lands in `done` and a `missed` Task in `missed`, each in the order the API returned them, and the concatenation of all buckets still reproduces the input. Leave `unwrap` and the façade shape alone.

**MIRROR**: `# SOURCE: src/shared/task-groups.ts:65-75` (the façade whose return object gains the two keys).

**AC**: Delivers AC-A1.

**VALIDATE**: `set -euo pipefail; npx tsc -b; npx vitest run test/task-groups.test.ts test/day-groups.test.ts; node -e "const s=require('node:fs').readFileSync('src/shared/task-groups.ts','utf8'); if (!/done: TaskDto\[\]/.test(s) || !/missed: TaskDto\[\]/.test(s) || /closed: TaskDto\[\]/.test(s)) { console.error('FAIL: TaskGroups must expose done and missed and no closed'); process.exit(1); } console.log('PASS: TaskGroups shape');"`

### Task 3: UPDATE src/app/components/TodayScreen.tsx (and TaskGroup.tsx comment)

**ACTION**: Make four edits in `TodayScreen.tsx`. (a) Add a constant `MISSED_COLLAPSED_KEY = "praesto.today.collapsed.missed"` beside the other `collapsed.<group>` keys; leave `CLOSED_COLLAPSED_KEY = "praesto.today.doneCollapsed"` byte-identical (renaming it would silently lose the owner's *Concluídas* preference — the existing comment says so). (b) Add `const [missedCollapsed, setMissedCollapsed] = useState(() => readCollapsed(MISSED_COLLAPSED_KEY, true));` — collapsed by default. (c) Add `toggleMissedCollapsed`, the same shape as `toggleDoneCollapsed` over the new key. (d) In the JSX, make the *Concluídas* group read `groups.done` (count and rows), and add, immediately after it, `<TaskGroup name="Não concluídas" count={groups.missed.length} collapsed={missedCollapsed} onToggle={toggleMissedCollapsed}>{renderDayItems(groups.missed)}</TaskGroup>`. The visible name is exactly `Não concluídas` (pt-BR, sentence case, from the guidelines' term table); `TaskGroup` already renders the count in both collapsed and expanded states and renders nothing when the count is 0, so no empty group reaches the DOM. Do not change `TaskRow`, the filter chips, the empty states or the `tasks.length > 0` guard. In `src/app/components/TaskGroup.tsx` change ONLY the header comment so it no longer says the section is reused "four times for the groups plus a fifth time for *Concluídas*" (it is six groups now); no code line of `TaskGroup.tsx` changes. No network call, no new token, no new dependency. Run `npx prettier --write` on both files.

**MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:201-209` (collapsed-by-default state), `# SOURCE: src/app/components/TodayScreen.tsx:528-534` (toggle), `# SOURCE: src/app/components/TodayScreen.tsx:1029-1045` (the group JSX).

**AC**: Delivers AC-A2 (code half; the on-screen verification is the owner's, see AC-A3 and `## Notes`).

**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/TodayScreen.tsx src/app/components/TaskGroup.tsx; npx prettier --check src/app/components/TodayScreen.tsx src/app/components/TaskGroup.tsx; grep -q 'name="Não concluídas"' src/app/components/TodayScreen.tsx; grep -q 'praesto.today.doneCollapsed' src/app/components/TodayScreen.tsx; if grep -n "groups\.closed" src/app/components/TodayScreen.tsx; then echo "FAIL: TodayScreen still reads groups.closed"; exit 1; else echo "PASS: TodayScreen reads done and missed"; fi`

### Task 4: UPDATE src/app/components/SearchScreen.tsx

**ACTION**: Make three edits. (a) Add local state `const [missedCollapsed, setMissedCollapsed] = useState(true);` — collapsed by default, deliberately NOT persisted (search has no collapse state today and a search is a transient view; the persisted per-group preference belongs to *Hoje*). (b) Make the *Concluídas* group read `groups.done` (count and rows; it stays non-collapsible as today). (c) Add, immediately after it, `<TaskGroup name="Não concluídas" count={groups.missed.length} collapsed={missedCollapsed} onToggle={() => setMissedCollapsed((current) => !current)}>{renderDayItems(groups.missed)}</TaskGroup>`. The visible name is exactly `Não concluídas`. Do not touch the debounce, the abort logic, the empty state, the sheet wiring or any other group. No network call, no new dependency. Run `npx prettier --write` on the file.

**MIRROR**: `# SOURCE: src/app/components/SearchScreen.tsx:440-446` (the closing groups of the results list) and `# SOURCE: src/app/components/TodayScreen.tsx:1029-1045` (collapsible group props).

**AC**: Delivers AC-A2 (code half).

**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/SearchScreen.tsx; npx prettier --check src/app/components/SearchScreen.tsx; grep -q 'name="Não concluídas"' src/app/components/SearchScreen.tsx; if grep -n "groups\.closed" src/app/components/SearchScreen.tsx; then echo "FAIL: SearchScreen still reads groups.closed"; exit 1; else echo "PASS: SearchScreen reads done and missed"; fi`

### Task 5: UPDATE documentation/ (authoritative docs)

**ACTION**: The deliverable IS prose, so the checks below are text matches by design. Edit, and set `last_updated: 2026-10-02` in the frontmatter of each file you edit: (a) `documentation/10-product/visual-identity.md` — change the copy table's `Section` row from `**Concluídas** · count` to `**Concluídas** · count · **Não concluídas** · count (collapsed by default)`. (b) `documentation/40-engineering/ui-layout-standard.md` — in §2 item 5 ("Groups, in this order"), append after the *Sem data* clause the two closed groups: **Concluídas** (`done` Tasks only) then **Não concluídas** (`missed` occurrences, collapsed by default, count visible when collapsed), each as a collapsible group whose state persists per group on *Hoje*; add a dated History row `2026-10-02` stating that §2.5 never named the closed groups, that unit 10 `missed-sweep` phase 3 splits them, and why (a miss listed as completed is the dishonesty ADR-0006 exists to remove). (c) `documentation/50-planning/roadmap.md` — (i) in unit 10's row replace nothing that is true and ADD: phases 1 and 2 `complete` and phase 3's code delivered, the screen split built, **AC-21 (the device proof) still OWED**, status stays **in-progress** — do NOT write `shipped` and do NOT claim the device proof was observed; (ii) rewrite the "Now:" line, whose "no phase planned yet" is false; (iii) add a Delivery history row dated `2026-10-02` at the top of the table (newest first) recording phases 1-3 delivered in code, the correction applied to phase 1 on 2026-10-02 (the D-A catch-up) as the plan record states it, and AC-21 owed to the owner with the exact steps in the phase-3 plan's Notes. (d) `documentation/30-architecture/domain-model.md` and `documentation/30-architecture/architecture-overview.md` and `documentation/20-requirements/functional-requirements.md` (FR-009/FR-011 rows and traceability table at lines 116-117): read each for a statement about who writes `missed`, when, or where it is shown; edit ONLY a sentence that is now false or stale (phase 2's `docs-update.md` asked for this check), and record "checked, no edit needed" in the Notes of the report written in Task 7 for each file left alone. Do not edit any ADR. No new ADR: ADR-0006 is applied, not amended, and D-G is recorded in the PRD's Decisions Log.

**MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:1029-1045` (the group order the layout standard text must match: Atrasadas, Hoje, Próximas, Sem data, then the two closed groups).

**AC**: Delivers AC-A5.

**VALIDATE**: `set -euo pipefail; grep -q "Não concluídas" documentation/10-product/visual-identity.md; grep -q "Não concluídas" documentation/40-engineering/ui-layout-standard.md; grep -q "2026-10-02" documentation/40-engineering/ui-layout-standard.md; grep -q "AC-21" documentation/50-planning/roadmap.md; if grep -n "no phase planned yet" documentation/50-planning/roadmap.md; then echo "FAIL: roadmap still says no phase planned yet"; exit 1; else echo "PASS: roadmap Now line refreshed"; fi; if grep -nE "unit 10[^|]*\*\*shipped\*\*|\| 10 \| .missed-sweep. .*\*\*shipped\*\*" documentation/50-planning/roadmap.md; then echo "FAIL: unit 10 must not be marked shipped before AC-21"; exit 1; else echo "PASS: unit 10 not claimed shipped"; fi`

### Task 6: UPDATE docs/ (derived context) and CLAUDE.md

**ACTION**: The deliverable IS prose, so the checks below are text matches by design. `documentation/` wins on any conflict; mirror what Task 5 wrote. (a) `docs/domain/areas/tasks.md` — in the `missed` business-rule bullet state that the daily cron's missed sweep (`src/worker/cron.ts`, before the Reminder sweep) writes it when the series' local day reaches the next occurrence's date, that each whole cycle that passed leaves its own row, and that the screen lists a `missed` Task under *Não concluídas* (collapsed by default, on *Hoje* and in search) and never under *Concluídas*. (b) `docs/context/architecture.md` — in the `src/shared/` inventory, change the `task-groups.ts` / `day-groups.ts` descriptions from "five buckets — overdue/today/upcoming/undated/closed" to six (`done` and `missed` replacing `closed`), and in the `components/` inventory change "reused five times for *Atrasadas · Hoje · Próximas · Sem data · Concluídas*" to six, adding *Não concluídas*; leave the phase-2 sentence on line 41 as is unless Task 5(d) found a `documentation/30-architecture` counterpart that now needs mirroring. (c) `CLAUDE.md` (the worktree copy; it merges with the branch) — rewrite the unit 10 sentence: phases 1-3 are `complete`/delivered in code, the cron now records `missed` and spawns the successor, the screen splits *Concluídas* / *Não concluídas*, and the unit stays `in-progress` until the owner observes AC-21 on his device; drop "no phase planned yet" and "chore C6 runs on the 2026-10-04 snapshot before unit 10's PRD opens" (C6 ran and passed on 2026-09-30, per the PRD); replace the stale "Suite is 889 tests / 62 files" with the counts the `npm test` summary line prints now (run `npm test` first and read it; if the summary cannot be read, delete the number rather than guess one). Do not edit `docs/decisions.md` or `docs/anti-patterns.md` (nothing new was decided or forbidden). `docs/api-reference.md` line 77 is a planned-units table that names unit 10's job, not its status — leave it unless it is false after reading it.

**MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:1029-1045` (group order and names the docs must match).

**AC**: Delivers AC-A5.

**VALIDATE**: `set -euo pipefail; grep -q "Não concluídas" docs/domain/areas/tasks.md; grep -q "Não concluídas" docs/context/architecture.md; if grep -n "no phase planned yet" CLAUDE.md; then echo "FAIL: CLAUDE.md still says no phase planned yet"; exit 1; else echo "PASS: CLAUDE.md unit 10 text refreshed"; fi; if grep -n "overdue/today/upcoming/undated/closed" docs/context/architecture.md; then echo "FAIL: architecture.md still lists the closed bucket"; exit 1; else echo "PASS: architecture.md buckets updated"; fi; if grep -n "889 tests" CLAUDE.md; then echo "FAIL: stale suite count"; exit 1; else echo "PASS: suite count refreshed or removed"; fi`

### Task 7: CREATE PRPs/reports/missed-sweep/phase-3/ui-checklist.md

**ACTION**: Read `documentation/40-engineering/ui-ux-guidelines.md` end to end, then run its review checklist on this change and write the result to `PRPs/reports/missed-sweep/phase-3/ui-checklist.md` BEFORE any merge. The file lists Tier A items 1-9 each as `N. ✔` or `N. ✘ — <one line>`, then the Tier B items that apply to a new group on already-shipped screens (10 contrast: the new group reuses the `TaskGroup` header tokens, state "no new colour pair" only if verified; 11 states: the empty state is "no group rendered" because `TaskGroup` returns null at count 0; 12; 13 `npx vite build` size report read against §11, with the numbers pasted; 14 screenshots or the reason none exists). Be honest about the method, as the recurring-tasks checklist was: say whether each item was verified by reading the code, by a build, or in a live browser pane, and NEVER claim a screenshot or a live pass that was not taken (guidelines §12.6). Any item that needs the owner's phone (item 12's phone half, item 14) is recorded as `OWED to the owner` rather than ✔. Record in the same file, as plain statements, the checks Task 5(d) made on `documentation/30-architecture/*` and `documentation/20-requirements/functional-requirements.md` ("edited" or "checked, no edit needed"). One ✘ without a recorded, conscious exception means the change is not done.

**MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:1029-1045` (the markup the checklist inspects).

**AC**: Delivers AC-A3 (the "checklist recorded before the merge" half).

**VALIDATE**: `set -euo pipefail; f=PRPs/reports/missed-sweep/phase-3/ui-checklist.md; test -s "$f"; for n in 1 2 3 4 5 6 7 8 9; do grep -qE "^$n\. (✔|✘)" "$f" || { echo "FAIL: checklist item $n has no ✔/✘ line"; exit 1; }; done; if grep -nE "[Ss]creenshot" "$f" | grep -viE "no screenshot|not taken|owed|none"; then echo "FAIL: a screenshot claim without a caveat"; exit 1; else echo "PASS: checklist recorded without unbacked claims"; fi`

### Task 8: VERIFY the whole suite and the phase invariants

**ACTION**: Infrastructure/verification task — it edits no file and delivers no criterion of its own; it protects AC-A1 and the "no migration, `recurrence.ts` unchanged, existing suite green without weakening" invariants. Run the gates below. Do NOT edit, skip or weaken any test to get green: a failing assertion on the old `closed` bucket is a recorded lifecycle update owned by the test pair (route it through `/relay-write-test` and `/relay-test-write-review`, never fix it by hand — R-X). If the implementation is correct and only those lifecycle assertions fail, report that rather than touching a test.

**MIRROR**: `# SOURCE: src/shared/task-groups.ts:65-75` (the façade whose behaviour the suite pins).

**AC**: Infrastructure task — protects AC-A1.

**VALIDATE**: `set -euo pipefail; npm run check; npm test; git diff --quiet HEAD -- src/shared/recurrence.ts src/worker/db/schema.ts src/shared/day-item.ts; test -z "$(git status --porcelain -- migrations)"; if git diff --unified=0 HEAD -- src documentation docs CLAUDE.md | grep -E "^\+[^+]" | grep "\.claude/PRPs" | grep -qv "MUST NOT appear"; then echo "FAIL: forbidden .claude/PRPs reference introduced"; exit 1; else echo "PASS: invariants hold"; fi`

## Validation Commands

All commands run from the worktree root (`.worktrees/missed-sweep`). Each level exits non-zero on any failure.

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

**Level 2 — UNIT_TESTS / CONTENT_INVARIANTS**

```bash
set -euo pipefail
npx vitest run test/day-groups.test.ts test/task-groups.test.ts test/day-item.test.ts test/day-item-event.test.ts
git diff --quiet HEAD -- src/shared/recurrence.ts src/worker/db/schema.ts src/shared/day-item.ts
test -z "$(git status --porcelain -- migrations)"
grep -q 'name="Não concluídas"' src/app/components/TodayScreen.tsx
grep -q 'name="Não concluídas"' src/app/components/SearchScreen.tsx
if grep -rn "groups\.closed" src/app; then
  echo "FAIL: a screen still reads the removed closed bucket"; exit 1
else
  echo "PASS: no screen reads groups.closed"
fi
if grep -n "no phase planned yet" CLAUDE.md documentation/50-planning/roadmap.md; then
  echo "FAIL: stale unit 10 status text"; exit 1
else
  echo "PASS: unit 10 status text refreshed"
fi
test -s PRPs/reports/missed-sweep/phase-3/ui-checklist.md
```

**Level 3 — INTEGRATION (full suite, both projects)**

```bash
set -euo pipefail
npm test
npx vite build
```

## Acceptance Criteria

- **AC-A1 (PRD AC-19):** Given a list holding open, `done` and `missed` Tasks, when `groupTasks` (and the `collectDayItems` it wraps) partitions it, then `done` Tasks land in one bucket and `missed` Tasks in another, each in the order the API returned them, the open buckets are unchanged, and the concatenation of all buckets still reproduces the input.
- **AC-A2 (PRD AC-20):** Given the owner has at least one `missed` occurrence, when he opens *Hoje* or searches, then *Concluídas* lists only completed Tasks and a separate *Não concluídas* group, collapsed by default with its count, lists the missed ones, and every visible string is pt-BR. (Built by Tasks 3-4; the on-screen reading is MANUAL and the owner's — see Notes.)
- **AC-A3 (PRD AC-20):** The UI/UX review checklist has been run on the change and its ✔/✘ result is recorded in `PRPs/reports/missed-sweep/phase-3/ui-checklist.md` BEFORE the merge, with the method of each item stated honestly. (Delivered by Task 7.)
- **AC-A4 (PRD AC-21):** Given a real daily series in production whose occurrence the owner deliberately does not do, when the next day arrives, then — without him opening the app in between — that occurrence shows as *não concluída*, today's occurrence is open with its Reminder armed, and a later cron run changes neither; recorded in the roadmap's Delivery history as the unit's device proof. **MANUAL / DEVICE — an owner-verification step, not a task the Implementer can complete**; this plan only records it as owed and writes no claim that it was observed.
- **AC-A5 (PRD AC-20, AC-21):** The documents the maintenance map names are no longer stale: the tasks domain rule, the layout standard, the copy table, the architecture inventory, the roadmap and `CLAUDE.md` state that a miss is written by the cron sweep and listed under *Não concluídas*, and the roadmap records AC-21 as owed rather than met.

R8b note: in PRD mode every bullet above carries the PRD AC it derives from. The Phase 3 success signal ("AC-19 green; UI/UX checklist ✔/✘ recorded before the merge; AC-21 observed on the owner's device and recorded in Delivery history") is covered by AC-A1, AC-A3 and AC-A4 respectively, with AC-A2 and AC-A5 carrying the screen and documentation deliverables its Scope names.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Renaming the `closed` bucket breaks existing assertions (`test/task-groups.test.ts` lines 64, 127, 134, 141, 172, 220, 255; `test/day-groups.test.ts` line 109 and the bucket list) | H | M | Expected and recorded: the PRD says existing `closed` tests "are updated as recorded lifecycle changes, never weakened". The test pair owns it (R-X forbids the Implementer from editing a test file); Task 8 reports rather than fixes. The bucket names `done` and `missed` are fixed by this plan so the suite and the code agree |
| The `DayItem` shape is changed to carry a missed flag, rippling into `day-item.ts` and its tests | L | M | Avoided by design: `bucketOf` reads `item.task.status` from the Task variant already carried; Task 8 asserts `src/shared/day-item.ts` is unchanged |
| Overwriting the legacy `praesto.today.doneCollapsed` key silently loses the owner's *Concluídas* preference | L | L | The key literal stays byte-identical (Task 3's VALIDATE greps it); the new group gets its own `collapsed.missed` key on the current scheme |
| On *Hoje* with the *Não concluídas* status chip active, every result sits in a collapsed group, so the filtered list looks empty at first glance | M | L | The count is always visible on the collapsed header (TaskGroup's "my tasks vanished" rule) and one tap expands it; recorded for the owner's look — if it reads badly, expanding when the status filter is exactly `missed` is a small follow-up, not decided here |
| A long absence makes *Não concluídas* long (~30 rows for a month of a daily series) | M | L | PRD Open Question, already recorded; the honest record is the point, and unit 11 owns the aggregated view |
| No mainstream-app precedent for a collapsed "not completed" group with a count (research-web: only small GitHub projects and Todoist's collapse-to-one behaviour, search snippets unopened) | M | L | The pattern mirrors this repository's own collapsible groups (*Próximas*, *Sem data*) and the owner's own decision D-G; the web finding is recorded as thin evidence, not relied on |
| The UI/UX checklist is run as static inspection only, as the recurring-tasks one was | M | M | Task 7 forces the method of each item to be stated and bans unbacked screenshot claims (guidelines §12.6); phone-only items are recorded as OWED to the owner |
| The device proof (AC-21) needs a deployed build and a real daily series; nothing in this pipeline can supply either | H | M | Recorded as an owner-verification step in Notes; the roadmap stays `in-progress` and the docs say AC-21 is owed, so the unit cannot be read as shipped by accident |
| Documentation drifts from the build again (the layout standard never named *Concluídas* at all) | M | M | Task 5 amends §2.5 in place with a dated History row, as the maintenance map requires, and Task 7 records which architecture/requirements docs were checked |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework.
- Tasks 1, 2 and 8 and the Level 2/3 blocks do invoke `vitest`, but only to RUN the already-approved suites (no test file is created or edited); the paragraph above remains true.
- **Scope of TDD here.** Only AC-19 is automated, and only because `groupTasks`/`collectDayItems` are pure logic in `src/shared` (methodology: "pure domain logic in `src/shared`"). The React edits (Tasks 3-4) are NOT written test-first and have no component test: UI verification stays manual (methodology; ADR-0008). The browser test tier was rejected at its own trigger and is not re-litigated here.
- **What the test pair should pin for AC-19** (to keep the suite and the code agreeing): `groupTasks` and `collectDayItems` return `done` and `missed` in place of `closed`; a `done` Task with an overdue deadline lands in `done`, a `missed` Task with a deadline of today lands in `missed`, never in a dated bucket; both buckets preserve the API order; the concatenation of all six buckets is a permutation-free partition of the input (conservation); an empty list yields six empty arrays; `dayItemFromTask(...).closed` is still `true` for both `done` and `missed` (so `test/day-item.test.ts` stays untouched) and `dayItemFromEvent(...).closed` is still `false`.
- **Why the split lives in `day-groups.ts` and not only in `groupTasks`.** The PRD names `groupTasks`, but neither screen calls it: `TodayScreen` and `SearchScreen` call `collectDayItems` directly (`TodayScreen.tsx:273`, `SearchScreen.tsx:81`), and `groupTasks` is its Task-shaped façade with no non-test caller in `src/app`. Splitting only the façade would change nothing on screen. This is a judgment call that follows the code, not the PRD's shorthand; the PRD's intent (D-G: "decided in `groupTasks`, test-first") is preserved because the façade exposes the same split and both are tested.
- **Worktree.** Phases 1-2 exist only in `.worktrees/missed-sweep` (uncommitted); this plan was grounded on that worktree. Implement and validate there; `git diff HEAD` cannot vouch for untracked files, so Task 8's unchanged-file checks cover only tracked files (`recurrence.ts`, `schema.ts`, `day-item.ts`).
- **Owner-verification steps (AC-A4 and the on-screen half of AC-A2) — not Implementer tasks.** These need a deployed build and the owner's device; record each outcome in the roadmap's Delivery history, in his words, only after he observes it:
  1. Deploy: from the merged branch, `npm run deploy` (no migration; nothing to apply remotely). Record the release tag and the Cloudflare version id per the maintenance map's release row.
  2. On *Hoje* and in search, with at least one `missed` occurrence present, confirm *Concluídas* lists only completed Tasks and *Não concluídas* is a separate group, collapsed, with its count, all in pt-BR.
  3. Create (or use) a real **daily** series in production and deliberately do not do its occurrence. Do not open the app when the next local day begins.
  4. After the first cron run of the next day, open the app: the old occurrence reads *não concluída* under *Não concluídas*, today's occurrence is open with its Reminder armed, and the diagnostics screen shows the cron ran. A later cron run must change neither.
  5. Add the Delivery history entry for the device proof (AC-21) and only then flip unit 10's roadmap status; until then the docs this phase writes say AC-21 is owed.
- **Phase-1 correction.** The D-A catch-up correction applied to phase 1 on 2026-10-02 is already in the worktree; this phase consumes `planMissedSweep` indirectly (through the cron) and does not touch it.
- **Docs-sync.** `docs_sync: true` also routes `docs/` through the post-merge docs updater; Tasks 5-6 do the owner-facing pass now because CLAUDE.md makes "affected docs updated" part of the Definition of Done, never "later". No ADR is written: ADR-0006 is applied, not amended, and D-G lives in the PRD's Decisions Log.
- **Glossary.** Code and docs say `missed`; the guidelines' term table maps it to *não concluída* in the UI. The new group's pt-BR name is *Não concluídas* (plural, as the existing `FilterSheet` status chip already writes it).

---

*Generated: 2026-10-02*
*Approved: 2026-10-02*
*Implemented: 2026-10-02*
*Status: IMPLEMENTED*
