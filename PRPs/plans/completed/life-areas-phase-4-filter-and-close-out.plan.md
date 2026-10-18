# Feature: Filter and close-out (Phase 4 of life-areas)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test and implement stages consume); changes to pure functions that existing suites pin (`TaskFilter`, `EMPTY_FILTER`, `toQuery`, `activeCount` in `test/task-filter.test.ts`); shared UI (the filter sheet, the quick-filter chip row, the *Hoje* screen's capture path and foreground refetch, and conditionally the `Chip` primitive); business rules for life areas and tasks (ADR-0015); export and restore (chore C6 — unit 13 is on its trigger list); documentation sync (the maintenance map in `documentation/README.md`); the UI/UX review checklist gate (CLAUDE.md, mandatory on every `src/app/` change)
- Decisions found:
  - ADR-0015 / [2026-10-11] Life Areas are owner-named, single-membership groupings; deleting one unassigns its items — *Sem área* is the filter value `lifeAreaId=none` and a count row, never a stored area or a grouping axis; accepted and not edited by this phase
  - life-areas PRD D-M (while an area filter is active a captured Task takes that area, `none` means no area, no filter means no key), D-N (single-choice *Área* group in the filter sheet, AND with the others, shown as an applied chip, not persisted across a cold start, an unmatched id is an empty list), D-O (*Sem área* is a filter value and a count row), D-P (search has no area control, *Aderência* untouched), D-R (no schema or manifest change, chore C6 on a snapshot with real areas before the unit closes), D-S (glossary, domain-model, FR-008 and the layout standard are amended in phase 4)
  - ui-layout-standard §2.3 [amended 2026-08-24] — the chip row holds toggles and nothing else (the trailing *Filtros…* chip was cut by the owner as a second door to one room); a narrowing filter never survives a cold start silently; §2.7 filter-induced empties read *Nenhuma tarefa com esse filtro.* + *Limpar filtros*
  - ADR-0008 / [2026-08-04] test-first, scoped to `src/shared` pure logic and the API; React components stay manually verified; a purely visual criterion legitimately produces no test file
  - ADR-0009 / [2026-08-18] visible UI copy is pt-BR (sentence case, infinitive buttons, "você"); identifiers, comments, tests, commits and docs stay English
  - ADR-0003 / [2026-08-03] canonical data in D1 with the weekly snapshot as the safety net; the restore drill is the condition on which Cloudflare holding the only copy was accepted; no offline write queue
  - ADR-0006 / [2026-08-03] closed rows are a permanent record; `src/shared/recurrence.ts` is frozen for unit 17
  - [2026-08-29] an APPROVED PRD's phase table is not edited by this plan beyond its own row N back-fill
- Applicable anti-patterns:
  - Hand-duplicated entity types (the filter carries a plain `string | null` id; no area entity type is redeclared, the area option is the existing `Pick` of `LifeAreaDto`)
  - Glossary synonym drift (Life Area in code and docs, *área* to the owner, never category)
  - Portuguese in artifacts (identifiers, comments, tests and docs stay English; only the string values the owner reads are pt-BR)
  - Editing accepted ADRs (ADR-0015 is not touched)
  - Weakening tests to force green (the existing assertions this phase legitimately extends are listed in Notes and go through the test pair's lifecycle ledger as updates, never as deletions)
  - Syncing the live database file (the drill rebuilds from an export snapshot into a throwaway SQLite file, never from a copied live file)
  - Mirroring Tasks, Reminders or Life Areas to Google (not approached)
  - Version ranges in dependencies (no dependency is added or moved)
- Applicable architectural rules:
  - One Worker serves everything; this phase adds no endpoint, no table, no migration and no wire change — `listTasks(filter)` already sends `toQuery(filter)`
  - `src/shared/` carries no DOM or Worker globals and compiles into every target; `task-filter.ts` stays free of storage globals (the filter is never persisted)
  - `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay byte-unchanged; `package.json` and `package-lock.json` stay byte-unchanged; nothing is written under `.claude/`
  - Types flow `src/worker/db/schema.ts` to `src/worker/dto.ts` to `src/shared/api.ts`; the client consumes `LifeAreaSummaryDto` and `TaskDto.lifeAreaId` as they are
  - The export completeness guard is untouched (no table is added); chore C6 is run, not modified
  - The UI/UX review checklist's result is recorded before the phase closes; the documentation is updated in the same session (documentation/README.md maintenance map, CLAUDE.md Definition of Done)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/life-areas.prd.md` — Implementation Phases row 4: "Filter and close-out" — Goal: the exit signal's action exists and the unit is observed working — Success signal: AC-13 and AC-23 green; AC-18, AC-21 and AC-25 recorded; AC-24 observed on the owner's device.

## Summary

Phases 1 to 3 gave the owner areas as data, a screen to manage them, a way to assign them and a row that shows them. This phase delivers the unit's exit-signal action and closes the unit out. `TaskFilter` gains the pure `lifeAreaId` dimension (`null` is no filter, `"none"` is area-less, anything else is an id), counted once by the badge and emitted last by `toQuery`; the filter sheet gains an *Área* single-choice group that wraps like the Task sheet's and is absent when he has no areas or the request failed; an applied area shows as one selected toggle chip at the head of the quick-filter row; and the one constant-null seam phase 3 left in `TodayScreen.submitCapture` becomes `filter.lifeAreaId`, which is what makes a capture inside a filtered view land in that area. Grounding found one defect that predates this unit and that AC-21 depends on: *Hoje*'s foreground refetch is registered once and closes over the first render's filter, so coming back to the app would refetch the UNFILTERED list under chips that still say filtered — this plan fixes it with the latest-callback ref `useConnectivity` already uses. The close-out half is honest about what this session can and cannot do: chore C6 is run on a synthetic fixture produced through the real routes on a local worker and recorded as exactly that, with the run on a real production snapshot owed; the device proof is the owner's and is created as an OWED skeleton that claims nothing; the documentation is synced, with the wording the PRD leaves to the owner written as proposed and flagged; and the unit stays `in-progress`. The pure half (AC-13 and the applied chip's decision) is test-first; the sheet, the chip and the wiring are the manually verified half, and the UI/UX checklist is recorded with the device-only items owed.

## User Story

As the owner of Praesto Sum
I want to narrow *Hoje* to one area of my life, or to what has no area yet, and always see that it is narrowed
So that I can decide what to do next without the noise of the other areas, and a Task I capture while looking at an area is not lost from the very list I am looking at.

## Problem Statement

The areas can be created, assigned and shown, but *Hoje* still cannot be narrowed by one: `TaskFilter` has no area dimension, the filter sheet has no *Área* group, and a capture can never take the area of the view it was made in. The roadmap's exit signal for the unit — "the owner filtered by an area *he* created and kept using that filter for a week" — has no action to perform. Separately, the unit is not closed: `life_areas` has never been exercised by the restore drill, the layout standard still promises an "area dot" the unit decided against, FR-008 names only Tasks, the glossary calls a Life Area "a domain of personal life … Calendar, Tasks", and no device proof exists.

## Solution Statement

`src/shared/task-filter.ts` gets the sixth dimension and `src/shared/life-area-assign.ts` gets one pure decision, `decideAreaFilterChip`, that says whether the applied chip shows and what it is called (the area's name, *Sem área*, or the neutral *Área* when the id is not in the loaded list — an applied narrowing filter is never hidden). `FilterSheet` and `FilterChips` consume them; `TodayScreen` passes the areas it already holds through `useLifeAreas`, replaces the seam with `filter.lifeAreaId` and fixes the foreground refetch. The shared `Chip` is changed ONLY if a live measurement at 375 px shows that a 40-character area name overflows a wrapping group; the decision and its numbers are recorded either way. The close-out is records and documents: the chore C6 run and its honest limits, the OWED device-proof skeleton, the documentation sync, the invariants inspection and the UI/UX checklist.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT and CLOSE-OUT (one pure dimension on an existing filter, one pure decision, two existing components and one screen wired, a latent foreground-refetch defect fixed, plus the unit's records and documentation; no schema, endpoint or wire change) |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/` (`task-filter.ts`, `life-area-assign.ts`), `src/app/components/` (`FilterSheet.tsx`, `FilterChips.tsx`, `TodayScreen.tsx`; `ui/Chip.tsx` only if measured necessary), `scripts/` (run, not modified), `documentation/`, `docs/`, `CLAUDE.md`, `PRPs/reports/life-areas/` |
| Dependencies | Phases 1 to 3 (`/api/life-areas`, `LifeAreaSummaryDto`, `useLifeAreas`, `decideAreaGroup`, `NO_AREA_VALUE`, `NO_AREA_LABEL`, `captureAreaFields`, `ChipGroup` `wrap`, the `lifeAreaId` list filter on the server) — all present in this worktree; no new package, no migration |
| Estimated Tasks | 12 |
| Source PRD line ref | `PRPs/prds/life-areas.prd.md` Implementation Phases row 4 (line 357), Phase Details (379-384); AC-13 (151-155), AC-14 (156-159), AC-18 (172-174), AC-21 (185-189), AC-23 (193-197), AC-24 (198-200), AC-25 (201-207); D-M, D-N, D-O, D-P, D-R, D-S (404-410) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/life-areas.prd.md` | 151-159, 172-174, 185-207, 209-226, 337-346, 379-384, 404-410 | AC-13, AC-14 (observable half), AC-18, AC-21, AC-23, AC-24, AC-25; the open questions the owner decides; the technical risks; the phase's goal and scope; decisions D-M to D-S |
| P0 | `PRPs/plans/completed/life-areas-phase-3-assign-and-show.plan.md` | 677-695 | Its Notes: the capture seam carry-forward ("Phase 4 must replace that one line with `filter.lifeAreaId`"), the copy still pending the owner, the `Chip` exception, the "no existing assertion changes" claim this phase now has to qualify |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 75-91, 93-103, 143-168 | §8 states (filtered-empty offers *Limpar filtros*), §9 copy mechanics, §12.6 what the pane can and cannot verify, and the review checklist this phase must run and record |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 29, 33, 34, 66, 68-72 | §2.3 (the chip row), §2.6 (row anatomy: "area dot later"), §2.7 (filter-induced empty), §6 (the unit-13 row) and the History format the amendment follows |
| P0 | `documentation/README.md` | 47-61 | The maintenance map that decides which document each kind of change touches |
| P0 | `src/shared/task-filter.ts` | 17-108 | The module this phase extends: `TaskFilter`, `EMPTY_FILTER`, `toQuery` (fixed order), `activeCount`, `isChipActive`, `toggleChip` (both spread `...filter`, so a new field is carried with no code change) |
| P0 | `src/shared/life-area-assign.ts` | 15-96 | `NO_AREA_VALUE`, `AreaOption`, `lifeAreaNameOf`, `decideAreaGroup`, `areaChoiceValue`, `lifeAreaIdFromChoice`, `captureAreaFields` — what the new decision sits beside, and why two of these helpers must NOT be used for the filter |
| P0 | `src/app/components/FilterSheet.tsx` | 1-113 | The sheet the *Área* group joins: props, the single-choice group markup, *Limpar filtros* at 107-109 |
| P0 | `src/app/components/FilterChips.tsx` | 1-55 | The quick-filter row: three toggles derived from `isChipActive`, no *Filtros…* chip, no *Limpar filtros* |
| P0 | `src/app/components/TodayScreen.tsx` | 228-233, 281-293, 399-409, 471-489, 775-807, 983, 1004-1018, 1079-1085, 1242-1247 | The filter state (never persisted), the areas atom, `refresh()` closing over `filter`, the capture seam, the `[filter]` effect and the foreground effect registered once, the badge, the chip-row cell, the filtered empty state and the filter sheet wiring |
| P0 | `test/task-filter.test.ts` | 45-51, 112-116, 164-170, 215-226 | The four places whose exact shape a new required key legitimately extends (see Notes); read-only for the Implementer |
| P1 | `src/app/components/ui/Chip.tsx` | 11-59 | `ChipGroup` (`wrap` already there) and `Chip` (`flex-none ... whitespace-nowrap`), the primitive Task 6 may change |
| P1 | `src/app/components/TaskSheet.tsx` | 299-337 | The shipped *Área* group (wrap, `NO_AREA_VALUE` chip first, options after) the filter group repeats, with the value mapping the filter must NOT repeat |
| P1 | `src/app/components/EmptyState.tsx` | 10-29 | The filtered-empty branch (*Nenhuma tarefa com esse filtro.* + *Limpar filtros*) that AC-21's deleted-area case lands on, driven by `activeCount(filter) > 0` |
| P1 | `src/app/hooks/useConnectivity.ts` | 25-30 | The latest-callback ref idiom (`onOnlineRef`) the foreground-refetch fix reuses |
| P1 | `src/app/hooks/useLifeAreas.ts` | 25-61 | `lifeAreas` is `null` when unknown or failed and `[]` when he has none |
| P1 | `src/app/components/SearchScreen.tsx` | 98-101, 115 | The no-area-control comment and the `{ ...EMPTY_FILTER, q }` request that must stay as it is |
| P1 | `src/app/api.ts` | 126-140 | `listTasks(filter)` sends `toQuery(filter)`; no change needed for the area to reach the server |
| P1 | `src/shared/life-areas-view.ts` | 20-21 | `NO_AREA_LABEL` (*Sem área*) |
| P1 | `scripts/restore-drill.mjs` | 23-37, 46-61, 103-142, 149-154 | What the drill reads, runs, prints and exits with — the patterns Task 8's checks are grounded on |
| P1 | `scripts/pull-export-snapshot.mjs` | 37-40, 77-100 | The three env vars that point it at a local server and a scratch directory, and its same-day skip rule |
| P1 | `test/life-areas-export.test.ts` | 50-94 | How an export with an area, a Task and a series is produced through the real routes (the model for the synthetic fixture) |
| P1 | `PRPs/reports/data-export/c6-restore-drill.md` | 57-111 | The record format of a drill re-run and what a prior run said about `life_areas` |
| P1 | `PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md` | 1-27 | The OWED device-proof skeleton format |
| P1 | `PRPs/reports/life-areas/phase-3/ui-checklist.md` | 1-35, 86-108 | The checklist record format, and item 12's recorded exception this phase must resolve |
| P2 | `documentation/20-requirements/functional-requirements.md` | 41, 119 | FR-008's text and its traceability row |
| P2 | `documentation/10-product/glossary.md` | 21 | The Life Area definition the PRD's Open Question says to reword |
| P2 | `documentation/30-architecture/domain-model.md` | 82-96, 103-109 | The Life Area entity, invariant 3 and the evolution rule |
| P2 | `documentation/50-planning/roadmap.md` | 66, 105-106, 120, 170-171 | Unit 13's row, the Now/Next block, chore C6's row and the Delivery history table head |
| P2 | `docs/domain/areas/life-areas.md`, `docs/domain/areas/tasks.md`, `docs/domain/glossary.md`, `docs/context/architecture.md` | whole files | The derived documents that must agree with `documentation/` after this phase |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-filter.ts:19-36
/** The whole filter state: five independent, nullable dimensions. `null` means "not set". */
export interface TaskFilter {
  status: TaskStatus | null;
  priority: TaskPriority | null;
  from: string | null;
  to: string | null;
  /** Text search (PRD AC-1..AC-9, text-search unit, phase 1). */
  q: string | null;
}

/** The filter a screen starts with — every dimension unset. Never seeded from storage (layout standard §2.3). */
export const EMPTY_FILTER: TaskFilter = {
  status: null,
  priority: null,
  from: null,
  to: null,
  q: null,
};
```
Copied by Task 1 (the interface member with its doc comment, and the constant's key list; `q` is the precedent for a dimension appended last).

```ts
# SOURCE: src/shared/task-filter.ts:52-60
export function toQuery(filter: TaskFilter): string {
  const params = new URLSearchParams();
  if (filter.status !== null) params.set("status", filter.status);
  if (filter.from !== null) params.set("from", filter.from);
  if (filter.to !== null) params.set("to", filter.to);
  if (filter.priority !== null) params.set("priority", filter.priority);
  if (filter.q !== null) params.set("q", filter.q);
  return params.size === 0 ? "" : `?${params.toString()}`;
}
```
Copied by Task 1 (one `if (... !== null) params.set(...)` line, appended after `q`, so no existing expected string changes).

```ts
# SOURCE: src/shared/task-filter.ts:70-76
export function activeCount(filter: TaskFilter): number {
  let count = 0;
  if (filter.status !== null) count += 1;
  if (filter.priority !== null) count += 1;
  if (filter.from !== null || filter.to !== null) count += 1;
  return count;
}
```
Copied by Task 1 (one more `count += 1` line; `q` is deliberately not counted and stays that way).

```ts
# SOURCE: src/shared/life-area-assign.ts:34-63
export function lifeAreaNameOf(
  areas: readonly AreaOption[] | null,
  lifeAreaId: string | null,
): string | null {
  if (areas === null || lifeAreaId === null) return null;
  return areas.find((area) => area.id === lifeAreaId)?.name ?? null;
}

export type AreaGroupView =
  { kind: "hidden" } | { kind: "empty" } | { kind: "choices"; options: readonly AreaOption[] };

export function decideAreaGroup(areas: readonly AreaOption[] | null): AreaGroupView {
  if (areas === null) return { kind: "hidden" };
  if (areas.length === 0) return { kind: "empty" };
  const options = [...areas].sort((a, b) => compareLifeAreaNames(a.name, b.name));
  return { kind: "choices", options };
}
```
Copied by Task 2 (the discriminated-union result, the `null`-areas branch first, the lookup reused, never mutating the argument; the doc comments that sit between these functions in the file are omitted here).

```tsx
# SOURCE: src/app/components/FilterSheet.tsx:48-62
        <div className="flex flex-col gap-1">
          <p className="m-0 font-data text-t1 font-semibold text-muted">Prioridade</p>
          <ChipGroup
            multiple={false}
            label="Prioridade"
            value={filter.priority === null ? [] : [filter.priority]}
            onValueChange={(next) =>
              onChange({ ...filter, priority: (next[0] as TaskPriority | undefined) ?? null })
            }
          >
            <Chip value="high">Alta</Chip>
            <Chip value="normal">Normal</Chip>
            <Chip value="low">Baixa</Chip>
          </ChipGroup>
        </div>
```
Copied by Task 3 (the group wrapper, the label paragraph, the direct `filter.x === null ? [] : [filter.x]` value and the `next[0] ?? null` write-back — the area group uses this mapping, not the Task sheet's).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:319-334
                <ChipGroup
                  multiple={false}
                  wrap
                  label="Área"
                  value={[areaChoiceValue(effectiveLifeAreaId(shownDraft, shown))]}
                  onValueChange={(next) =>
                    onDraftChange({ lifeAreaId: lifeAreaIdFromChoice(next) })
                  }
                >
                  <Chip value={NO_AREA_VALUE}>{NO_AREA_LABEL}</Chip>
                  {areaGroup.options.map((option) => (
                    <Chip key={option.id} value={option.id}>
                      {option.name}
                    </Chip>
                  ))}
                </ChipGroup>
```
Copied by Task 3 (the `wrap` group, the `NO_AREA_VALUE` chip first, the options after, in the order `decideAreaGroup` returned). NOT copied: `areaChoiceValue` and `lifeAreaIdFromChoice`, which map `"none"` to `null` — in the sheet `null` means "no area", in the filter `null` means "no filter" and `"none"` is itself the value.

```tsx
# SOURCE: src/app/components/FilterChips.tsx:35-54
  const pressed = QUICK_CHIPS.filter((chip) => isChipActive(filter, chip, today));

  // The ToggleGroup reports the WHOLE next pressed-array on every tap; the
  // single chip that differs from `pressed` (derived straight from the
  // filter, never from local state) is the one that was tapped.
  function handleValueChange(next: string[]): void {
    const nextSet = new Set(next);
    const changed = QUICK_CHIPS.find((chip) => nextSet.has(chip) !== pressed.includes(chip));
    if (changed !== undefined) onToggleChip(changed);
  }

  return (
    <ChipGroup value={pressed} onValueChange={handleValueChange} label="Filtros rápidos">
      {QUICK_CHIPS.map((chip) => (
        <Chip key={chip} value={chip}>
          {CHIP_LABEL[chip]}
        </Chip>
      ))}
    </ChipGroup>
  );
```
Copied by Task 4 (pressed state derived from the filter, never local; the diff-against-`pressed` handler; the one extra value `"area"` rides in the same group).

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:471-489
  function submitCapture(): void {
    const trimmed = title.trim();
    if (trimmed === "" || busy) return;
    // The one seam of capture inheritance (life-areas PRD AC-14). `TaskFilter` has
    // no area dimension until phase 4's AC-13, so no area filter can be active
    // here and the create request stays byte-identical to today's. Phase 4
    // replaces this one line with `filter.lifeAreaId`; `captureAreaFields` already
    // decides what a captured Task takes from it.
    const activeAreaFilter: string | null = null;
    void run(async () => {
      await createTask({ title: trimmed, ...captureAreaFields(activeAreaFilter) });
      // FR-045 invariant, locked in explicitly: `setTitle("")` is sequenced
      // AFTER the awaited `createTask(...)` call above, never before or
      // unconditionally — a thrown failure exits this callback before this
      // line runs, so a failed save never loses what the owner typed.
      setTitle("");
      showToast({ key: "task-saved", text: "Tarefa salva" });
    });
  }
```
Copied by Task 5 (the FR-045 sequencing stays byte-for-byte; only the constant and its comment are replaced by `filter.lifeAreaId`).

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:794-807
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
Copied by Task 5 — this is the DEFECT: the effect runs once, so `refresh` here is the first render's function and its `filter` is `EMPTY_FILTER` forever. The fix changes the one call, not the shape of the effect.

```ts
# SOURCE: src/app/hooks/useConnectivity.ts:29-30
  const onOnlineRef = useRef(options?.onOnline);
  onOnlineRef.current = options?.onOnline;
```
Copied by Task 5 (the latest-callback ref idiom, named `refreshRef` in the screen).

```tsx
# SOURCE: src/app/components/ui/Chip.tsx:49-59
export function Chip({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Toggle
      value={value}
      className="inline-flex min-h-12 min-w-12 flex-none items-center justify-center gap-1 rounded-pill border border-line bg-surface-2 px-3 font-text text-t2 font-medium whitespace-nowrap text-ink data-pressed:border-transparent data-pressed:bg-accent data-pressed:font-semibold data-pressed:text-on-accent"
    >
      <Check className="hidden size-4 in-data-pressed:block" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </Toggle>
  );
}
```
Copied by Task 6 (the class string a measured overflow would change: `whitespace-nowrap` is the one token that stops a long label from wrapping, `flex-none` stops it from shrinking).

```md
# SOURCE: PRPs/reports/data-export/c6-restore-drill.md:76-111
## Re-run 2026-09-30 — `recurrence_series` exercised, and a real defect found in the drill

**Why now.** At the roadmap's rule-6(b) review the owner set this run before unit 10's PRD opens …

**Second run: PASS.**

| Table | Snapshot | Restored | Fields |
|---|---|---|---|
| recurrence_series | 1 | 1 | every field identical |
| tasks | 19 | 19 | every field identical |
| reminders | 7 | 7 | every field identical |
| life_areas, google_calendar_selections | 0 | 0 | not exercised |

*Status: PASS (2026-09-30) — recurrence_series exercised; life_areas and google_calendar_selections still empty*
```
Copied by Task 8 (a dated re-run section, the four-column table, and the closing status line that says what is still not exercised — here, what is still not proven).

```md
# SOURCE: PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md:1-27
# Device proof — AC-17 (repeated-miss-nudge, phase 4)

Status: OWED

## Procedure

1. In production with this unit deployed, choose a real daily or weekly series and let three
   consecutive occurrences lapse …
6. Record the observation here and in the roadmap Delivery history, with the Open Questions
   it answers …

## Observation (owner)

Empty until the owner records it. Nothing has been observed and nothing is claimed.
```
Copied by Task 9 (heading, `Status: OWED`, a numbered procedure ending in where to record, and an observation section that is empty on purpose).

```md
# SOURCE: PRPs/reports/life-areas/phase-3/ui-checklist.md:86-95
12. ✘ exception (conscious, recorded, not fixed here) — `Chip` is `flex-none whitespace-nowrap` and
    the plan forbids changing it, so one chip wider than the row can overflow. By static reasoning,
    at 375 px: the dialog content is 343 px (`px-4` on the sheet) and the group's own `px-4` leaves
    311 px; a name near the 40-character limit is about 7-8 px per character at 14 px Inter medium
    (about 280-320 px) plus 26 px of chip chrome and 20 px for the pressed check, so the worst case
    can exceed the row by tens of pixels and make the sheet scroll sideways. This is an estimate,
    not a measurement. The twelve-area wrap itself is by construction (`flex flex-wrap gap-2`),
    and a long name on the row wraps (`break-words`, `min-h-16`). Remaining live half: pending
    live check (orchestrator browser pass) at 375 px and 1280 px; safe areas, keyboard overlap and
    the Android back gesture: owed to the owner's device.
```
Copied by Tasks 6 and 7 (the estimate this phase must replace with a measurement or carry forward unchanged; the one-line-per-item format with ✔ / ✘ / pending / owed vocabulary).

```md
# SOURCE: documentation/40-engineering/ui-layout-standard.md:70-72
| Date | What changed |
|---|---|
| 2026-10-04 | **adherence-mirror phase 3.** §2 gains item 3.5, the adherence line: one plain-text line below the chip row in the same grid cell, present only for an active series with at least two misses in the 30-day window, absent with no placeholder and no reserved space otherwise, never a ratio or progress bar. §6's unit 9–12 row names the route `/settings/adherence` and the line. See `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` |
```
Copied by Task 10 (a dated, bold-led History row that names every section it touched and points at the record).

```md
# SOURCE: documentation/50-planning/roadmap.md:170-171
|---|---|
| 2026-10-11 | **Unit 13 `life-areas` opened — PRD APPROVED, `planned` → `in-progress`, as a recorded exception to rule 2.** [life-areas.prd.md](../../PRPs/prds/life-areas.prd.md): four phases (areas API and the filter; the *Áreas* screen; assign and show; filter and close-out), 25 acceptance criteria, **no migration**. … (row truncated here)
```
Copied by Task 10 (newest row first; a bold lead sentence, then what was decided, what is open and what is owed).

## Files to Change

Paths are relative to the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/task-filter.ts` | UPDATE | `lifeAreaId` on `TaskFilter` and `EMPTY_FILTER`, emitted last by `toQuery`, counted once by `activeCount` (AC-A1) |
| `src/shared/life-area-assign.ts` | UPDATE | `decideAreaFilterChip` — whether the applied chip shows and what it is called (AC-A3) |
| `src/app/components/FilterSheet.tsx` | UPDATE | The *Área* group, absent when there are no areas or the request failed (AC-A4) |
| `src/app/components/FilterChips.tsx` | UPDATE | The applied area as one selected toggle chip at the head of the row (AC-A5) |
| `src/app/components/TodayScreen.tsx` | UPDATE | The capture seam becomes `filter.lifeAreaId`; the areas reach the sheet and the row; the foreground refetch uses the current filter (AC-A2, AC-A4, AC-A5) |
| `src/app/components/ui/Chip.tsx` | UPDATE (conditional) | Only if Task 6's live measurement shows a 40-character name overflows a wrapping group; otherwise untouched (infrastructure for AC-A4) |
| `PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md` | CREATE | The measurement and the recorded decision for the Chip question (AC-A4) |
| `PRPs/reports/life-areas/phase-4/ui-checklist.md` | CREATE | The UI/UX review checklist's recorded result and the AC-21 and AC-14 walks, device-only items owed (AC-A9, AC-A4, AC-A5) |
| `PRPs/reports/life-areas/c6-restore-drill.md` | CREATE | Chore C6 on a synthetic fixture, recorded as exactly that, with the real-snapshot run owed (AC-A6) |
| `PRPs/reports/life-areas/c6-drill-output.txt` | CREATE | The drill's own stdout for the run, so the record can be checked (AC-A6) |
| `PRPs/reports/data-export/c6-restore-drill.md` | UPDATE | A short dated re-run section appended to the running C6 log, pointing at the life-areas record and saying `life_areas` is still not exercised on production data (AC-A6) |
| `PRPs/reports/life-areas/device-proof.md` | CREATE | The OWED skeleton the owner fills in on his phone (AC-A7) |
| `PRPs/reports/life-areas/phase-4/close-out.md` | CREATE | AC-23's invariants inspection and the unit's per-AC status, with what is not claimed (AC-A9) |
| `documentation/20-requirements/functional-requirements.md` | UPDATE | FR-008 names Tasks and recurrence series (AC-A8) |
| `documentation/10-product/glossary.md` | UPDATE | Life Area as a named grouping the owner creates, *Sem área* as the pt-BR copy of the implicit "Unsorted" grouping — written as proposed, flagged for the owner (AC-A8) |
| `documentation/30-architecture/domain-model.md` | UPDATE | The Life Area entity and invariant 3 in the same wording, flagged (AC-A8) |
| `documentation/40-engineering/ui-layout-standard.md` | UPDATE | §2.3 and §2.6 and §6 dated amendments, History row, `last_updated` (AC-A8) |
| `documentation/50-planning/roadmap.md` | UPDATE | Unit 13's row text, the Now/Next block, chore C6's row and one Delivery history line; the unit stays `in-progress` (AC-A8) |
| `docs/domain/glossary.md` | UPDATE | The derived glossary agrees with `documentation/` (AC-A8) |
| `docs/domain/areas/life-areas.md` | UPDATE | A phase 4 section; the "phase 4 does not exist yet" sentences become true statements (AC-A8) |
| `docs/domain/areas/tasks.md` | UPDATE | The Task area bullet no longer says there is no filter (AC-A8) |
| `docs/context/architecture.md` | UPDATE | Only the sentences that name the area filter or the seam as not built yet (AC-A8) |
| `docs/api-reference.md` | UPDATE (conditional) | Only if Task 11's check finds `/api/life-areas` or `lifeAreaId` missing — phase 1 was to document both (AC-A8) |
| `CLAUDE.md` | UPDATE | The unit 13 status sentence now says all four phases are delivered in code (AC-A8) |

## NOT Building (Scope Limits)

- An area filter in search or any area control on the search screen (PRD D-P): `SearchScreen.tsx` is not edited and keeps `{ ...EMPTY_FILTER, q }`, which inherits `lifeAreaId: null`.
- A quick chip per area, a multi-select, or persisting the area filter across a cold start (PRD D-N, layout standard §2.3): the filter stays `useState(EMPTY_FILTER)`.
- Silently dropping a stale area filter (an id deleted on another device). AC-21 wants the filtered-empty state with *Limpar filtros*; the chip reads *Área* and the owner clears it. Recorded as a known edge in Risks, not engineered around.
- A *Limpar filtros* chip in the quick row. The owner cut the row's only non-toggle on 2026-08-24; this plan keeps the row to toggles, leaves *Limpar filtros* to the sheet and the filtered-empty state, and flags the question for him (Notes). It is one element if he wants it.
- Grouping *Hoje* by area, an area on `SeriesAdherenceDto` or the *Aderência* route, colour, icon, description, archive, tags, sub-areas, reordering, bulk assignment (PRD "What We're NOT Building").
- Any endpoint, table, migration, export, manifest or wire change; any change to `src/shared/recurrence.ts` or `src/shared/adherence.ts`; any dependency added or bumped; anything under `.claude/`.
- Editing any ADR, in particular ADR-0015 (accepted, append-only).
- Authoring or editing any test file and any React component test: the test pair owns the suite (it also owns the legitimate extensions of `test/task-filter.test.ts` listed in Notes); component verification stays manual per `docs/context/methodology.md`.
- Running the restore drill against a REAL production snapshot, or recording the run on a synthetic fixture as if it were that run; there is no production token in this session and production holds no area (the unit is not deployed).
- Observing the device proof, claiming it, or marking unit 13 `shipped`: AC-24 is the owner's, and the roadmap row stays `in-progress` until he records it.
- Touching `src/app/components/DesignPlayground.tsx`: every new prop is optional so the dev-only playground compiles unchanged.
- Correcting statements that are stale for reasons other than this unit (for example `docs/context/architecture.md`'s "Not built yet: export (FR-042)"): out of scope here, left for the owner or the post-merge docs update.

## Step-by-Step Tasks

Every `VALIDATE` command runs from the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

### Task 1: UPDATE src/shared/task-filter.ts

- **ACTION**: Delivers AC-A1. (1) Add `lifeAreaId: string | null` to `TaskFilter` with a short English doc comment: `null` is no area filter, `"none"` (`NO_AREA_VALUE` in `life-area-assign.ts`) is the Tasks that have no area, any other string is an area id; and add `lifeAreaId: null` to `EMPTY_FILTER`. The file must not import from `./life-area-assign` (keep the literal in the comment) so the module still imports only `./api`. (2) In `toQuery`, add one line AFTER the `q` line: `if (filter.lifeAreaId !== null) params.set("lifeAreaId", filter.lifeAreaId);` — the fixed order becomes `status`, `from`, `to`, `priority`, `q`, `lifeAreaId`, so no expected string that exists today changes, and the doc comment names the new order and why the area sits last (the same reason `q` does). (3) In `activeCount`, add `if (filter.lifeAreaId !== null) count += 1;` and update the doc comment: one more dimension, the range is now 0 to 4, and `q` still counts for nothing. (4) Leave `isChipActive` and `toggleChip` byte-for-byte as they are: both spread `...filter`, so the area is carried through every chip toggle untouched. (5) Update the module header's "five independent, nullable dimensions" to six. Do not edit any test file; the pair extends `test/task-filter.test.ts` (Notes).
- **MIRROR**: `# SOURCE: src/shared/task-filter.ts:19-36`, `# SOURCE: src/shared/task-filter.ts:52-60` and `# SOURCE: src/shared/task-filter.ts:70-76`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/task-filter.ts; npx prettier --check src/shared/task-filter.ts; if grep -nE 'localStorage|sessionStorage|indexedDB|from "\./life-area' src/shared/task-filter.ts; then echo "FAIL: task-filter.ts must stay storage-free and import only ./api"; exit 1; else echo "PASS: storage-free, sibling-free"; fi; npx vitest run --project worker test/task-filter.test.ts` — the last command is the effect: the pair's cases (the dimension in `EMPTY_FILTER`, the emitted parameter and its position, the count, `toggleChip` carrying it) fail until the dimension exists.

### Task 2: UPDATE src/shared/life-area-assign.ts

- **ACTION**: Delivers AC-A3, the decidable half of the applied chip. Add and export `type AreaFilterChipView = { kind: "absent" } | { kind: "no-area" } | { kind: "area"; name: string } | { kind: "unknown" }` and `decideAreaFilterChip(areaFilter: string | null, areas: readonly AreaOption[] | null): AreaFilterChipView` with an English doc comment naming AC-A3: `null` returns `absent` (no area filter, no chip); `NO_AREA_VALUE` returns `no-area` whatever `areas` holds, including `null` (*Sem área* needs no list); any other string returns `area` with the name `lifeAreaNameOf(areas, areaFilter)` finds, and `unknown` when it finds none — which covers an area deleted on another device, an empty list and a list that is `null` because the request failed. State in the comment why `unknown` exists at all: an applied narrowing filter must stay visible (layout standard §2.3), so the chip is never dropped, and the component shows the neutral *Área* for it. Reuse `lifeAreaNameOf`; do not re-implement the lookup. Also update the `NO_AREA_VALUE` doc comment from "from phase 4, the `lifeAreaId=none` filter and query value" to the present tense, since the filter now uses it. Add no import: the module keeps importing only `./api` and `./life-areas`. Do not change `areaChoiceValue` or `lifeAreaIdFromChoice` and add a one-line warning on each that they map `NO_AREA_VALUE` to `null`, which is right for the sheet and wrong for the filter.
- **MIRROR**: `# SOURCE: src/shared/life-area-assign.ts:34-63`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/life-area-assign.ts; npx prettier --check src/shared/life-area-assign.ts; if grep -hoE 'from "[^"]+"' src/shared/life-area-assign.ts | grep -vE '^from "\./(api|life-areas)"$'; then echo "FAIL: life-area-assign.ts imports outside its siblings"; exit 1; else echo "PASS: only sibling imports"; fi; npx vitest run --project worker test/life-area-assign.test.ts` — the suite file already exists from phase 3 and the pair appends the cases pinned in Notes; they fail until `decideAreaFilterChip` exists.

### Task 3: UPDATE src/app/components/FilterSheet.tsx

- **ACTION**: Delivers AC-A4 (the sheet's half). (1) Add one OPTIONAL prop with a doc comment: `areas?: readonly AreaOption[] | null` — the owner's areas as `useLifeAreas` holds them; `null` or absent means unknown or failed. Optional so any other caller compiles unchanged. (2) `const areaGroup = decideAreaGroup(areas ?? null);` beside the existing code. (3) Between the *Prioridade* group and the *Período* group, render ONLY when `areaGroup.kind === "choices"` (so the group is ABSENT, not a placeholder, when he has no areas and when the request failed): a `div` shaped like its siblings (`flex flex-col gap-1`) holding the label paragraph `Área` and `<ChipGroup multiple={false} wrap label="Área" value={filter.lifeAreaId === null ? [] : [filter.lifeAreaId]} onValueChange={(next) => onChange({ ...filter, lifeAreaId: next[0] ?? null })}>` whose children are `<Chip value={NO_AREA_VALUE}>{NO_AREA_LABEL}</Chip>` followed by one `<Chip key={option.id} value={option.id}>{option.name}</Chip>` per option, in the order `decideAreaGroup` returned. The chip value `NO_AREA_VALUE` IS the filter's own value for area-less, so there is no mapping; do NOT use `areaChoiceValue` or `lifeAreaIdFromChoice` here. Tapping the pressed chip yields `[]` and clears the dimension, as *Status* and *Prioridade* do. Every change applies immediately through `onChange`; there is no *Aplicar*. (4) Imports: `decideAreaGroup`, `NO_AREA_VALUE` and `type AreaOption` from `../../shared/life-area-assign`, `NO_AREA_LABEL` from `../../shared/life-areas-view`. (5) Update the file's header comment so it names the *Área* group and its absence rule. *Limpar filtros* stays as it is: `onChange(EMPTY_FILTER)` now clears the area because `EMPTY_FILTER` carries the key.
- **MIRROR**: `# SOURCE: src/app/components/FilterSheet.tsx:48-62` and `# SOURCE: src/app/components/TaskSheet.tsx:319-334`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/FilterSheet.tsx; npx prettier --check src/app/components/FilterSheet.tsx; grep -qF 'decideAreaGroup(' src/app/components/FilterSheet.tsx; grep -qF 'NO_AREA_VALUE' src/app/components/FilterSheet.tsx; grep -qF 'NO_AREA_LABEL' src/app/components/FilterSheet.tsx; grep -qE '^[[:space:]]+wrap$' src/app/components/FilterSheet.tsx; if grep -nE 'areaChoiceValue|lifeAreaIdFromChoice' src/app/components/FilterSheet.tsx; then echo "FAIL: those helpers map none to null, which in the filter means no filter"; exit 1; else echo "PASS: the filter keeps none as none"; fi` — the sheet itself is the manual level (Level 4); `tsc -b` proves the optional prop and the pure decision line up with Tasks 1 and 2.

### Task 4: UPDATE src/app/components/FilterChips.tsx

- **ACTION**: Delivers AC-A5 (the applied chip). (1) Two new OPTIONAL props with a doc comment each: `areas?: readonly AreaOption[] | null` and `onClearArea?: () => void`. (2) `const areaChip = decideAreaFilterChip(filter.lifeAreaId, areas ?? null);`. (3) When `areaChip.kind !== "absent"`, render ONE extra `<Chip value="area">` as the FIRST child of the existing `ChipGroup`, labelled `NO_AREA_LABEL` for `no-area`, the area's name for `area`, and the literal `Área` for `unknown` — never blank, never hidden — and make the group's `value` the pressed quick chips plus `"area"`. It leads the row, not trails it, because a trailing chip would sit at or past the edge of a row that already holds three chips at 375 px, which would make an applied narrowing filter invisible without scrolling (Task 6 and checklist item 12 measure it). (4) `handleValueChange`: when the area chip is present and `next` no longer contains `"area"`, call `onClearArea?.()` and return; otherwise the existing diff against `pressed` runs unchanged (it ignores the `"area"` value). (5) Do NOT add a *Limpar filtros* control or any non-toggle: the row holds toggles and nothing else (owner, 2026-08-24). Update the header comment to say the row holds the three quick toggles plus, when he has narrowed by area, one applied toggle at the head; tapping it clears only the area. `QuickChip`, `isChipActive` and `toggleChip` are not touched. Imports: `decideAreaFilterChip` and `type AreaOption` from `../../shared/life-area-assign`, `NO_AREA_LABEL` from `../../shared/life-areas-view`.
- **MIRROR**: `# SOURCE: src/app/components/FilterChips.tsx:35-54`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/FilterChips.tsx; npx prettier --check src/app/components/FilterChips.tsx; grep -qF 'decideAreaFilterChip(' src/app/components/FilterChips.tsx; grep -qF 'onClearArea' src/app/components/FilterChips.tsx; if grep -nF 'Limpar filtros' src/app/components/FilterChips.tsx | grep -vE '^[0-9]+:[[:space:]]*//'; then echo "FAIL: the chip row holds toggles only (owner 2026-08-24)"; exit 1; else echo "PASS: no clear control in the row"; fi` — `tsc -b` proves the new props line up with Task 2's union; the rendered row is the manual level.

### Task 5: UPDATE src/app/components/TodayScreen.tsx

- **ACTION**: Delivers AC-A2 and the screen half of AC-A4 and AC-A5. (1) *Capture seam*: in `submitCapture`, delete the `const activeAreaFilter: string | null = null;` line and its comment, and make the create call `await createTask({ title: trimmed, ...captureAreaFields(filter.lifeAreaId) });` with a short comment that capture inherits the active area filter (`null` adds no `lifeAreaId` key, `"none"` an explicit null, an id that id; PRD AC-14, D-M). The FR-045 sequencing — `setTitle("")` after the awaited call — is unchanged. This is the carry-forward the phase-3 plan's Notes name: "Phase 4 must replace that one line with `filter.lifeAreaId`"; the PRD row does not say it and this plan does. (2) *Wiring*: pass `areas={lifeAreas}` to `FilterChips` together with `onClearArea={() => setFilter((current) => ({ ...current, lifeAreaId: null }))}`, and `areas={lifeAreas}` to `FilterSheet`. `lifeAreas` is already in scope from `useLifeAreas`. (3) *Foreground refetch*: add `const refreshRef = useRef(refresh); refreshRef.current = refresh;` immediately before the `visibilitychange` effect, with a comment that the effect is registered once, so a bare `refresh()` there closes over the FIRST render's `filter` and would refetch the unfiltered list under chips that still say filtered (the same idiom as `useConnectivity`'s `onOnlineRef`), and change that effect's `void refresh();` to `void refreshRef.current();`. This predates the unit (it affects every filter since unit 3) and PRD AC-21's "after the refetch" depends on it; record it in the checklist as found during phase 4 grounding. Do not touch the other three refreshes in that effect (they read no changing state). (4) Leave `useState<TaskFilter>(EMPTY_FILTER)` and its never-persisted comment as they are; nothing about the area is written to storage. Do NOT edit `SearchScreen.tsx`, `TaskSheet.tsx` or any other file in this task.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:471-489`, `# SOURCE: src/app/components/TodayScreen.tsx:794-807` and `# SOURCE: src/app/hooks/useConnectivity.ts:29-30`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/TodayScreen.tsx; npx prettier --check src/app/components/TodayScreen.tsx; grep -qF 'captureAreaFields(filter.lifeAreaId)' src/app/components/TodayScreen.tsx; if grep -nF 'const activeAreaFilter' src/app/components/TodayScreen.tsx; then echo "FAIL: the constant-null seam survives"; exit 1; else echo "PASS: the seam reads the filter"; fi; grep -qF 'refreshRef.current' src/app/components/TodayScreen.tsx; grep -qF 'useState<TaskFilter>(EMPTY_FILTER)' src/app/components/TodayScreen.tsx; test "$(grep -cF 'areas={lifeAreas}' src/app/components/TodayScreen.tsx)" -eq 2` — `tsc -b` proves both components accept what the screen passes; the capture and the refetch behaviour are the manual level (Level 4, items 9 and 11).

### Task 6: UPDATE (conditional) src/app/components/ui/Chip.tsx — measure the overflow, then decide

- **ACTION**: Infrastructure for AC-A4 — delivers no criterion alone: it resolves the one ✘ exception phase 3's checklist carried (item 12), now that the same wrapping group sits in a second sheet. (1) With Tasks 1 to 5 in place, run the app (`npm run dev`; the browser pane at 375 px wide, dark, or the Playwright browser per guidelines §12.6) and create twelve areas through *Configurações → Áreas*, one of them named with exactly 40 characters — the fixture `Cuidados com a casa e a saúde da família` is 40 characters; verify `name.length === 40` and that the field accepts it and refuses a 41st. (2) For BOTH the Task sheet's *Área* group and the filter sheet's, with that fixture, record into `PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md`: the viewport, the group's `scrollWidth` and `clientWidth`, the widest chip's `getBoundingClientRect().width`, and the `<dialog>`'s scroll region `scrollWidth` against `clientWidth` (a horizontal overflow of the region is the defect). Also record the quick row: the right edge of the third quick chip at 375 px, and with the 40-character area applied, whether the leading area chip pushes the quick chips off-screen. (3) Decide, with those numbers, and write one line of the record that starts exactly `Decision: keep Chip as is`, `Decision: change Chip` or `Decision: pending measurement`. **Keep** when neither sheet overflows: the exception is retired by evidence and `Chip.tsx` stays untouched. **Change** when either overflows: edit only the class string — replace `whitespace-nowrap` with `whitespace-normal` and add `max-w-full break-words text-center` — so a chip wider than its row wraps inside it instead of overflowing, then re-measure both sheets and assert that every chip of every OTHER group (the Task sheet's date, priority, *Repetir* and *Aplicar a* groups, the filter sheet's *Status* and *Prioridade*, the quick row) is still exactly 48 px tall, i.e. nothing that used to fit now wraps; record those numbers too. **Pending** only when no rendered page is available to the Implementer at all (as in phase 3): leave `Chip.tsx` untouched, restate the static estimate, and carry the measurement as owed to the orchestrator's browser pass and the owner's device. Never edit `Chip.tsx` without the recorded `Decision: change Chip`. The phase-3 plan forbade touching `Chip`; this task lifts that on exactly this condition.
- **MIRROR**: `# SOURCE: src/app/components/ui/Chip.tsx:49-59` and `# SOURCE: PRPs/reports/life-areas/phase-3/ui-checklist.md:86-95`.
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md; grep -qE '^Decision: (keep Chip as is|change Chip|pending measurement)' PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md; if grep -q '^Decision: change Chip' PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md; then grep -qF 'max-w-full' src/app/components/ui/Chip.tsx; elif grep -qF 'max-w-full' src/app/components/ui/Chip.tsx; then echo "FAIL: Chip.tsx changed without a recorded decision to change it"; exit 1; fi; npx tsc -b; npx eslint src/app/components/ui/Chip.tsx; npx prettier --check src/app/components/ui/Chip.tsx; grep -qF 'flex flex-wrap gap-2 px-4 py-1' src/app/components/ui/Chip.tsx; grep -qF 'flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]' src/app/components/ui/Chip.tsx` — the record is the effect of the measurement; the last two literals prove both `ChipGroup` class strings survived; Level 3's production build proves Tailwind still compiles the file.

### Task 7: CREATE PRPs/reports/life-areas/phase-4/ui-checklist.md

- **ACTION**: Delivers AC-A9's checklist clause and the recording half of AC-A4 and AC-A5. Create the record (the directory does not exist yet). Read `documentation/40-engineering/ui-ux-guidelines.md`'s "Review checklist" and, with Tasks 1 to 6 in place, run Tier A items 1 to 9 at 375 px dark on the filter sheet (with areas, with none, with the areas request blocked), the quick row (no area, an area, *Sem área*, a 40-character name, an area id the loaded list does not hold) and the capture path, and Tier B items 10 to 14. Record each item on ONE line that starts with its number, a period and a space (`1. ` … `14. `): `✔` with the method, `✘` with a one-line reason on the same line (and the word `exception` there when it is a recorded conscious exception), `pending live check (orchestrator browser pass)` when no rendered page was available, or `owed to the owner's device` for the device-only items named in Level 4. Never ✔ from imagination and never claim a screenshot that was not taken (guidelines §12.6). Item 12 cites `chip-overflow-measurement.md` and takes the form its decision allows: ✔ with the numbers when the exception was retired, ✔ with the changed class string and the re-measured 48 px heights, or the carried ✘ exception when the measurement is pending. Then add two sections headed exactly `## AC-21 walk` and `## AC-14 observable half`: one line per clause of PRD AC-21 (the group's contents and order; picking filters at once; the badge; the selected chip; *Limpar filtros*; the cold start; the deleted-area empty state after a foreground return; the group absent with no areas and on a failed request) and, for AC-14, the three captures (area filter active, *Sem área* active, no filter) observed in the network panel as the request body — each in the same vocabulary, each stating what was exercised and what only the owner's device can. Record that the foreground-refetch defect was found during this phase's grounding and what was observed after the fix. Record `npm run build`'s size numbers for item 13. One ✘ without a recorded conscious exception means the phase is not done.
- **MIRROR**: `# SOURCE: PRPs/reports/life-areas/phase-3/ui-checklist.md:86-95`.
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/phase-4/ui-checklist.md; for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14; do grep -qE "^${i}\. " PRPs/reports/life-areas/phase-4/ui-checklist.md; done; grep -qF '## AC-21 walk' PRPs/reports/life-areas/phase-4/ui-checklist.md; grep -qF '## AC-14 observable half' PRPs/reports/life-areas/phase-4/ui-checklist.md; if grep -E '^[0-9]+\. .*✘' PRPs/reports/life-areas/phase-4/ui-checklist.md | grep -viE 'exception|owed'; then echo "FAIL: an unexplained ✘ remains in the checklist"; exit 1; else echo "PASS: no unexplained ✘"; fi`

### Task 8: Run chore C6 on a synthetic fixture and record it — CREATE PRPs/reports/life-areas/c6-restore-drill.md and c6-drill-output.txt, UPDATE PRPs/reports/data-export/c6-restore-drill.md

- **ACTION**: Delivers AC-A6. There is no production token in this session and production holds no area (the unit is not deployed), so the achievable run is on a SYNTHETIC fixture and the record says exactly that. Steps, all against a LOCAL worker, never production and never `--remote`: (1) `npm run db:migrate` (local D1 only; applies `0000` to `0006`). (2) Start the dev server (`npm run dev`, or `npm run docker:up`) and note the URL it prints. (3) Put the dev token where `pull-export-snapshot.mjs` can read it WITHOUT printing it — read `API_BEARER_TOKEN` from `.dev.vars` with a short `node -e` into a file in a scratch directory outside the repo; the token never appears in a transcript, a command line you echo or a report (chore C10's lesson). (4) Through the REAL routes (a throwaway script or `curl`, kept outside the repo) create: two areas (`Casa`, `Saúde`); two Tasks each assigned to one of them; one Task with no area; one daily series assigned to `Casa` (`POST /api/series` with `freq: "daily"`, `dtstart` today, `dateMode: "scheduled"`, `lifeAreaId`) and complete its first occurrence so a `done` row keeps the area and a successor is spawned; then give `Casa` a non-null description with `npx wrangler d1 execute praesto-db --local --command "UPDATE life_areas SET description = 'Onde a gente mora' WHERE name = 'Casa'"` (the API never writes it; `--local` is mandatory), so a null and a non-null `description` both round-trip. This is the model `test/life-areas-export.test.ts` `seedAssigned()` shows. (5) Pull the snapshot with the unattended job's own script, pointed away from everything real: `PRAESTO_EXPORT_BASE_URL=<the dev URL> PRAESTO_TOKEN_FILE=<scratch token file> PRAESTO_SNAPSHOT_DIR=<a scratch directory> node scripts/pull-export-snapshot.mjs`. NEVER let it default to `~/praesto-snapshots`: a synthetic file named for today would sit among the owner's real snapshots and the weekly job's same-day rule would then skip the real one. (6) Assert the snapshot has what AC-18 needs, then run the drill from the repo root and keep its output: `node scripts/restore-drill.mjs <snapshot> | tee PRPs/reports/life-areas/c6-drill-output.txt`. (7) Write `PRPs/reports/life-areas/c6-restore-drill.md` in the format of the data-export record: date, why now (unit 13's close-out; `life_areas` has been empty in every snapshot), the snapshot's file name, byte size, SHA-256 and per-table row counts (the file itself is NOT committed — it is local dev data), the `| Table | Snapshot | Restored | Fields |` table, the migrations applied, and the line `SYNTHETIC FIXTURE RUN` stating plainly that the rows were produced through the real routes on a local worker and are not the owner's data. State what it proves (the camelCase to snake_case mapping and the foreign-key columns round-trip for `life_areas` rows and for Tasks and a series that carry an area; the `0006` columns are present) and what it does not (nothing about the owner's real rows, nothing about D1 over the network). Then a section headed with the literal `REAL SNAPSHOT RUN: OWED` that says AC-18 as the PRD words it — "a production snapshot holding at least one `life_areas` row and one assigned Task" — is NOT met, and gives the owner's procedure: deploy unit 13, create at least one area and assign at least one Task, take the next Sunday snapshot (or pull one by hand with `node scripts/pull-export-snapshot.mjs`), run `node scripts/restore-drill.mjs ~/praesto-snapshots/praesto-<date>.json` from the repo root, and append a `## Re-run` section to this file; the same snapshot also closes the "C6 after migration `0006`" item the PRD lists as open. (8) Append a short dated section to `PRPs/reports/data-export/c6-restore-drill.md`, in its own re-run format, that points at the life-areas record and says `life_areas` is still not exercised on production data. Stop the dev server afterwards.
- **MIRROR**: `# SOURCE: PRPs/reports/data-export/c6-restore-drill.md:76-111` and `# SOURCE: PRPs/reports/life-areas/phase-3/ui-checklist.md:86-95` (the vocabulary for what was and was not claimed).
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/c6-restore-drill.md; grep -qF 'SYNTHETIC FIXTURE RUN' PRPs/reports/life-areas/c6-restore-drill.md; grep -qF 'REAL SNAPSHOT RUN: OWED' PRPs/reports/life-areas/c6-restore-drill.md; grep -qE '^  life_areas +[1-9][0-9]* rows, every field identical  OK$' PRPs/reports/life-areas/c6-drill-output.txt; grep -qE '^  tasks +[1-9][0-9]* rows, every field identical  OK$' PRPs/reports/life-areas/c6-drill-output.txt; grep -qF 'restore-drill: PASS' PRPs/reports/life-areas/c6-drill-output.txt; grep -qF 'PRPs/reports/life-areas/c6-restore-drill.md' PRPs/reports/data-export/c6-restore-drill.md` — every pattern is the drill's own print format (`scripts/restore-drill.mjs` lines 135 and 154), and the run's exit status was the drill's, preserved by `pipefail` when the output was captured.

### Task 9: CREATE PRPs/reports/life-areas/device-proof.md

- **ACTION**: Delivers AC-A7. Create the skeleton in the format of the repeated-miss-nudge precedent: `# Device proof — AC-24 (life-areas, phase 4)`, the line `Status: OWED`, a numbered `## Procedure` for the owner on his phone against production once unit 13 is deployed: (1) *Configurações → Áreas*, create an area he chose himself; (2) open an existing Task's sheet and give it that area, see the name end the row's meta line; (3) open the filter sheet, pick the area — the badge reads 1, the quick row leads with a selected chip bearing the name, *Hoje* lists only that area's Tasks; (4) pick *Sem área* — the rest are listed; (5) with the area filter on, capture one Task — it lands in that area and stays visible; with *Sem área* on, capture another — it has no area; (6) tap *Limpar filtros*, close the app fully and reopen it — it starts unfiltered; (7) record how many Tasks or series he has assigned and on how many different days he used the filter in the week after deploy (the PRD's metrics; no telemetry is added, CON-005); (8) then take the next snapshot and run the restore drill on it (chore C6, `PRPs/reports/life-areas/c6-restore-drill.md`, the `REAL SNAPSHOT RUN: OWED` section). End the procedure with where to record: here and in the roadmap Delivery history, then flip unit 13 on his decision. Add a section `## Decisions awaiting the owner` listing, as OPEN and not settled: the pt-BR copy *Área*, *Você ainda não criou nenhuma área.*, *Criar áreas*, *Aplicar título, descrição, prioridade e área a* and the neutral *Área* this phase adds for an area the list does not hold; the glossary and domain-model wording (PRD Open Question 1); whether he wants a *Limpar filtros* chip in the quick row (layout standard §2.3 still names one); the 12-area limit; the three open questions the PRD lists. End with `## Observation (owner)` reading exactly `Empty until the owner records it. Nothing has been observed and nothing is claimed.`
- **MIRROR**: `# SOURCE: PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md:1-27`.
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/device-proof.md; grep -qF 'Status: OWED' PRPs/reports/life-areas/device-proof.md; grep -qF 'Nothing has been observed and nothing is claimed.' PRPs/reports/life-areas/device-proof.md; grep -qF '## Decisions awaiting the owner' PRPs/reports/life-areas/device-proof.md; grep -qF 'Criar áreas' PRPs/reports/life-areas/device-proof.md; if grep -E '^Status: (OBSERVED|DONE|COMPLETE|PASS)' PRPs/reports/life-areas/device-proof.md; then echo "FAIL: the device proof is the owner's and is not observed"; exit 1; else echo "PASS: nothing claimed"; fi`

### Task 10: UPDATE the documentation/ set (functional-requirements, glossary, domain-model, ui-layout-standard, roadmap)

- **ACTION**: Delivers AC-A8 for `documentation/`; the maintenance map in `documentation/README.md` governs, and every edited file's `last_updated` is set to the date of the edit. Do NOT edit any ADR. (1) `functional-requirements.md`: FR-008's text becomes "A Task or a Recurrence Series can be assigned to at most one Life Area, which the owner creates himself; an item may carry none." (stable ID, MoSCoW and Status unchanged). (2) `glossary.md` and `domain-model.md` (the Life Area entry, and invariant 3's "implicit \"Unsorted\" grouping" which gains "shown in the UI as *Sem área*, the pt-BR copy (ADR-0009), still with no default area stored"): describe a Life Area as a named grouping the owner creates (for example *Casa*, *Saúde*) that a Task or a Recurrence Series may belong to — at most one, optional — and note that Calendar and Tasks are product capabilities, not Life Area records. This is the PRD's own proposal and the owner decides: write it as proposed and mark each of the two edits with an inline `(Proposed 2026-<date>, awaiting the owner's confirmation — life-areas PRD Open Question 1.)` note; do not present it as validated. (3) `ui-layout-standard.md`: in §2.6 replace "area dot later" with "the area name as text (never a dot or a colour)" and a dated amendment saying why (colour needs a migration and a categorical palette under ADR-0010 and WCAG 1.4.1 requires the name beside any colour anyway — ADR-0015, D-F); in §6's unit-13 row replace "Area dot in the row metadata and an area filter chip" with the built shape (the area name as text at the end of an open Task's metadata line; the *Áreas* route entered from *Configurações*; an *Área* group in the filter sheet whose pick shows as a selected chip in the quick row); in §2.3 amend in place, dated, the sentence "Applied filters stay visible as selected chips with a *Limpar filtros* chip" to what is built — the area filter is the first applied chip and is a toggle at the head of the row, and *Limpar filtros* lives in the sheet and in the filtered-empty state because a chip for it would be a non-toggle among toggles again, which the 2026-08-24 amendment removed — marked pending the owner's confirmation; add one History row dated the day of the edit, in the existing format, naming §2.3, §2.6 and §6 and pointing at `PRPs/reports/life-areas/phase-4/ui-checklist.md`; the History row must not reproduce the literal replaced phrase. (4) `roadmap.md`: replace "Nothing is built yet." in unit 13's row with a statement that phases 1 to 4 are delivered in code, not merged or deployed, that AC-18 on a real snapshot and AC-24 are OWED so the unit stays `in-progress` (the State cell stays `**in-progress**`, the exit signal is untouched); update the Now and Next lines that say "nothing built yet" and that chore C6 "has not been run since unit 12's migration `0006`" only to add that a synthetic-fixture run passed on the date of the edit; in chore C6's row append a dated sentence, introduced by the literal `Unit 13 close-out run on a synthetic fixture`, saying the drill passed on rows produced through the real routes on a local worker and that the real production snapshot run is OWED — never worded as the real run; add ONE Delivery history line at the top of the table (anchor the `Edit` on the `|---|---|` separator plus the start of the 2026-10-11 row so it is unique), starting `**Unit 13 \`life-areas\` phase 4 (the filter and the close-out) delivered in code`, stating the status stays `in-progress`, listing what is owed (AC-18 on a real snapshot, AC-24, the live browser pass items) and the open items awaiting the owner (the pt-BR copy decisions, the glossary wording, the *Limpar filtros* chip, the 12-area limit), and pointing at the records. The unit's row must not read `shipped`.
- **MIRROR**: `# SOURCE: documentation/40-engineering/ui-layout-standard.md:70-72` and `# SOURCE: documentation/50-planning/roadmap.md:170-171`.
- **VALIDATE**: `set -euo pipefail; grep -qF 'FR-008 | A Task or a Recurrence Series can be assigned to at most one Life Area' documentation/20-requirements/functional-requirements.md; if grep -nF '| FR-008 | A Task can be assigned to a Life Area. |' documentation/20-requirements/functional-requirements.md; then echo "FAIL: FR-008 still names only Tasks"; exit 1; else echo "PASS: FR-008 amended"; fi; grep -qF 'named grouping the owner creates' documentation/10-product/glossary.md; grep -qF 'named grouping the owner creates' documentation/30-architecture/domain-model.md; grep -qF 'Sem área' documentation/10-product/glossary.md; grep -qF 'Sem área' documentation/30-architecture/domain-model.md; grep -qF 'the area name as text' documentation/40-engineering/ui-layout-standard.md; if grep -nE 'area dot later|Area dot in the row metadata' documentation/40-engineering/ui-layout-standard.md; then echo "FAIL: the area dot rule survives in the layout standard"; exit 1; else echo "PASS: area dot amended"; fi; grep -qF '| FR-008 | 3, 8 | 3 | **in-progress**' documentation/50-planning/roadmap.md; if grep -E '^\| 13 \| `life-areas`' documentation/50-planning/roadmap.md | grep -F 'Nothing is built yet.'; then echo "FAIL: unit 13's row still says nothing is built"; exit 1; else echo "PASS: unit 13 row updated"; fi; grep -qF 'Unit 13 close-out run on a synthetic fixture' documentation/50-planning/roadmap.md; grep -qF 'Unit 13 `life-areas` phase 4 (the filter and the close-out) delivered in code' documentation/50-planning/roadmap.md; git diff --quiet "$(git merge-base main HEAD)" -- documentation/60-decisions` — the deliverable here IS the text, so literal checks are the right instrument; the last command proves no ADR was edited.

### Task 11: UPDATE the derived docs/ files and CLAUDE.md

- **ACTION**: Delivers AC-A8 for the derived set — "update both together". (1) `docs/domain/glossary.md`: the Life Area row mirrors the `documentation/` glossary wording of Task 10, flagged as proposed. (2) `docs/domain/areas/life-areas.md`: add a section "Delivered — unit 13 `life-areas`, phase 4: the filter and the close-out" describing the *Área* group (all, one area, *Sem área*; absent with no areas or a failed request), the applied chip at the head of the quick row (a toggle, tapping it clears only the area), the badge counting it once, nothing persisted across a cold start, an unknown area leaving the filtered-empty state with *Limpar filtros*, capture inheriting the active filter, and the state of the close-out (drill on a synthetic fixture, device proof owed); and make the sentences that say the filter "does not exist yet" or that *Hoje* "calls it with a constant `null`" true statements (the three that name phase 4 as future, and the capture bullet) — the phrase "constant `null`" must not remain anywhere in that file, and the heading of the new section contains the literal `phase 4: the filter and the close-out`. (3) `docs/domain/areas/tasks.md`: the Task area bullet drops "there is still no area filter in the UI (phase 4)" and says what exists. (4) `docs/context/architecture.md`: change only the sentences that name the area filter or the capture seam as not built — the `components/` entry's "which does not exist until phase 4, so the create request is unchanged", the `task-filter.ts` description (it gains `lifeAreaId`) and the "Current implementation state" sentence "There is no area filter in the UI yet (phase 4) …" plus its "phases … are implemented and nothing else" count — and add `FilterSheet`'s *Área* group, `FilterChips`' applied chip and `decideAreaFilterChip` where those components and modules are listed. Do not touch unrelated stale statements. (5) `CLAUDE.md`: in the unit 13 sentence replace "phases 1–3 of 4 are delivered in code, not yet merged or deployed" with "all four phases are delivered in code, not yet merged or deployed" and the tail "the *Área* filter, and with it a capture that inherits the area, is phase 4 and does not exist yet." with a sentence saying phase 4 delivered the *Área* filter and the capture inheritance and that AC-18 on a real snapshot and the device proof (AC-24) are owed, so the unit stays `in-progress`. Never write `shipped`.
- **MIRROR**: `# SOURCE: documentation/40-engineering/ui-layout-standard.md:70-72` (a dated, scoped, pointing record) — applied to prose sections.
- **VALIDATE**: `set -euo pipefail; grep -qF 'named grouping the owner creates' docs/domain/glossary.md; grep -qF 'phase 4: the filter and the close-out' docs/domain/areas/life-areas.md; if grep -nF 'is phase 4 and does not exist yet' docs/domain/areas/life-areas.md CLAUDE.md; then echo "FAIL: a not-built-yet sentence survives"; exit 1; else echo "PASS: not-built-yet sentences replaced"; fi; if grep -nE 'constant .null.' docs/domain/areas/life-areas.md; then echo "FAIL: the constant-null seam is still described as current"; exit 1; else echo "PASS: no constant-null seam described"; fi; if grep -nF 'there is still no area filter in the UI' docs/domain/areas/tasks.md; then echo "FAIL: tasks.md still says there is no filter"; exit 1; else echo "PASS: tasks.md current"; fi; if grep -nE 'does not exist until phase 4|There is no area filter in the UI yet' docs/context/architecture.md; then echo "FAIL: architecture.md names the filter as not built"; exit 1; else echo "PASS: architecture.md current"; fi; grep -qF '/api/life-areas' docs/api-reference.md; grep -qF 'lifeAreaId' docs/api-reference.md; if grep -nF 'Unit 13 `life-areas` is `shipped`' CLAUDE.md; then echo "FAIL: CLAUDE.md claims unit 13 shipped"; exit 1; else echo "PASS: unit 13 not claimed shipped"; fi` — the two `docs/api-reference.md` greps verify AC-25's clause that phase 1 already satisfied; if either fails, add the missing section there (conditional edit) before closing.

### Task 12: CREATE PRPs/reports/life-areas/phase-4/close-out.md — the invariants inspection

- **ACTION**: Delivers AC-A9's invariants clause. After Tasks 1 to 11, run the commands of Level 2 and record them with their outcomes: the base commit (`git merge-base main HEAD`), `git diff --quiet` for `src/shared/recurrence.ts` and `src/shared/adherence.ts`, the empty `migrations/` diff, `package.json` and `package-lock.json` byte-identical, nothing under `.claude/`, no test file deleted and no skip marker added, ADR files untouched, `npm run check` and `npm test` exit 0 with the totals (the floor is the 1693 tests in 89 files the phase-3 checklist recorded — new cases only add), and that `test/task-update.test.ts`'s old pinned 400 for `lifeAreaId` was replaced by AC-9's behaviour in phase 1, not removed. Then a per-AC table for this phase — AC-13, AC-18, AC-21, AC-23, AC-24, AC-25 — each with its honest status: AC-13 green; AC-18 `synthetic fixture PASS, real snapshot OWED`; AC-21 recorded with the device items owed; AC-23 this record; AC-24 `OWED`; AC-25 documentation synced, and its last clause ("the roadmap row records `shipped` or `dropped`") NOT met until AC-24 — the row records `in-progress`. End with a `## Not claimed` section listing what no record may say: the production restore run, the device proof, the week of use, the unit shipped. Write the line `AC-24: OWED` literally.
- **MIRROR**: `# SOURCE: PRPs/reports/life-areas/phase-3/ui-checklist.md:86-95` (the vocabulary and the honesty about pending and owed).
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/phase-4/close-out.md; for ac in AC-13 AC-18 AC-21 AC-23 AC-24 AC-25; do grep -qF "$ac" PRPs/reports/life-areas/phase-4/close-out.md; done; grep -qF 'AC-24: OWED' PRPs/reports/life-areas/phase-4/close-out.md; grep -qF '## Not claimed' PRPs/reports/life-areas/phase-4/close-out.md; base="$(git merge-base main HEAD)"; git diff --quiet "$base" -- src/shared/recurrence.ts src/shared/adherence.ts package.json package-lock.json documentation/60-decisions` — the record's claims are re-checked by the same commands it quotes.

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
base="$(git merge-base main HEAD)"

# the pure modules ADR-0006 froze stay byte-identical to main (PRD AC-23)
git diff --quiet "$base" -- src/shared/recurrence.ts src/shared/adherence.ts

# this unit adds no migration and changes none (PRD AC-23)
if [ -n "$(git diff --name-only "$base" -- migrations)" ] || [ -n "$(git ls-files --others --exclude-standard -- migrations)" ]; then
  echo "FAIL: migrations/ changed — this unit adds none"; exit 1
else
  echo "PASS: migrations/ untouched"
fi

# no dependency added or moved (PRD AC-23)
git diff --quiet "$base" -- package.json package-lock.json

# no accepted ADR edited, ADR-0015 included (anti-pattern: editing accepted ADRs)
git diff --quiet "$base" -- documentation/60-decisions

# nothing under .claude/ is part of the diff
test -z "$(git diff --name-only "$base" -- .claude)"

# no test file deleted, no skip marker added (PRD AC-23)
if [ -n "$(git diff --diff-filter=D --name-only "$base" -- test)" ]; then
  echo "FAIL: a test file was deleted"; exit 1
else
  echo "PASS: no test file deleted"
fi
if git diff "$base" -- test | grep -E '^\+[^+].*(\.skip\(|\.only\(|\.todo\(|\bxit\(|\bxdescribe\()'; then
  echo "FAIL: a skip, only or todo marker was added to a test"; exit 1
else
  echo "PASS: no skip marker added"
fi

# capture inherits the filter through the one seam, and the constant is gone (AC-A2)
grep -qF 'captureAreaFields(filter.lifeAreaId)' src/app/components/TodayScreen.tsx
if grep -nF 'const activeAreaFilter' src/app/components/TodayScreen.tsx; then
  echo "FAIL: the constant-null seam survives"; exit 1
else
  echo "PASS: the seam reads the filter"
fi

# the foreground refetch reads the CURRENT filter (AC-A5; found in grounding)
grep -qF 'refreshRef.current' src/app/components/TodayScreen.tsx

# the filter is never persisted (layout standard §2.3, AC-A5)
grep -qF 'useState<TaskFilter>(EMPTY_FILTER)' src/app/components/TodayScreen.tsx
if grep -nE 'localStorage|sessionStorage|indexedDB' src/shared/task-filter.ts src/app/components/FilterSheet.tsx src/app/components/FilterChips.tsx; then
  echo "FAIL: the area filter must not touch storage"; exit 1
else
  echo "PASS: nothing persisted"
fi

# search has no area control and keeps its request (PRD D-P)
if grep -nE 'FilterSheet|FilterChips' src/app/components/SearchScreen.tsx; then
  echo "FAIL: the search screen must not host the filter surfaces"; exit 1
else
  echo "PASS: search has no area control"
fi
grep -qF '...EMPTY_FILTER, q }' src/app/components/SearchScreen.tsx

# the filter keeps none as none: the sheet's none-to-null helpers must not appear in it
if grep -nE 'areaChoiceValue|lifeAreaIdFromChoice' src/app/components/FilterSheet.tsx; then
  echo "FAIL: FilterSheet uses helpers that map none to null"; exit 1
else
  echo "PASS: the filter keeps none"
fi

# the row holds toggles only: no clear control added outside comments (owner, 2026-08-24)
if grep -nF 'Limpar filtros' src/app/components/FilterChips.tsx | grep -vE '^[0-9]+:[[:space:]]*//'; then
  echo "FAIL: a non-toggle was added to the chip row"; exit 1
else
  echo "PASS: the chip row holds toggles"
fi

# no glossary synonym in the files this phase edits for copy
if grep -niE 'categoria' src/shared/task-filter.ts src/shared/life-area-assign.ts src/app/components/FilterSheet.tsx src/app/components/FilterChips.tsx; then
  echo "FAIL: glossary synonym (categoria)"; exit 1
else
  echo "PASS: vocabulary clean"
fi

# the documentation no longer promises the dropped area dot, and the unit is not claimed shipped
if grep -nE 'area dot later|Area dot in the row metadata' documentation/40-engineering/ui-layout-standard.md; then
  echo "FAIL: the area dot rule survives"; exit 1
else
  echo "PASS: area dot amended"
fi
grep -qF '| FR-008 | 3, 8 | 3 | **in-progress**' documentation/50-planning/roadmap.md

# the full suite, both vitest projects, with a machine-readable report: vitest's JSON reporter is
# Jest-compatible (numTotalTests, numFailedTests, success); the run's own exit status already
# fails on any failing test, and the floor below is the 1693 tests the phase-3 checklist recorded.
out="$(mktemp -d)/vitest.json"
npm test -- --reporter=json --outputFile="$out"
node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (r.success !== true || r.numFailedTests !== 0 || r.numTotalTests < 1693) { console.error("FAIL: suite not green or below the 1693-test floor", r.numTotalTests, r.numFailedTests); process.exit(1); } console.log("PASS: " + r.numTotalTests + " tests, 0 failed");' "$out"
```

### Level 3 INTEGRATION and DRY-RUN END-TO-END

```bash
set -euo pipefail
# the production bundle builds with the new props and (if changed) the Chip class string, and the
# dev-token guard passes; read the size report against guidelines §11 for checklist item 13
npm run build

# the chore C6 run is recorded as what it is, and its output proves the restore path was exercised
test -s PRPs/reports/life-areas/c6-restore-drill.md
grep -qF 'SYNTHETIC FIXTURE RUN' PRPs/reports/life-areas/c6-restore-drill.md
grep -qF 'REAL SNAPSHOT RUN: OWED' PRPs/reports/life-areas/c6-restore-drill.md
grep -qE '^  life_areas +[1-9][0-9]* rows, every field identical  OK$' PRPs/reports/life-areas/c6-drill-output.txt
grep -qE '^  tasks +[1-9][0-9]* rows, every field identical  OK$' PRPs/reports/life-areas/c6-drill-output.txt
grep -qF 'restore-drill: PASS' PRPs/reports/life-areas/c6-drill-output.txt

# the device proof exists, is OWED and claims nothing
grep -qF 'Status: OWED' PRPs/reports/life-areas/device-proof.md
grep -qF 'Nothing has been observed and nothing is claimed.' PRPs/reports/life-areas/device-proof.md
```

### Level 4 MANUAL (browser pane at 375 px dark, then the owner's device)

Not an exit-code gate: its recorded result is what Task 7's `VALIDATE` checks. Run `npm run dev` and walk the filter sheet, the quick row and the capture path (guidelines §12.6: the pane can assert `getBoundingClientRect`, computed styles, the accessibility-relevant DOM, real key presses and the network panel; it cannot be trusted for screenshots or transitions, and `:focus-visible` only matches after a real key press). Fixtures: no area, one area, twelve areas with one 40-character name, an area filter whose id the loaded list does not hold (delete the area from a second tab), the areas request blocked in DevTools, offline. To check the foreground refetch in the pane, set a filter, then override `document.visibilityState` to `"visible"` and dispatch `visibilitychange`: the Network panel must show `GET /api/tasks` carrying the SAME query string as the filter, not a bare `/api/tasks`.

| # | Tier | Item | Where it can be done |
|---|------|------|----------------------|
| 1 | A | One primary action; the *Área* group adds chips only, the quick row gains at most one toggle, nothing else is added to either surface | browser pane |
| 2 | A | Every tappable control at least 48 x 48 px and at least 8 px from its neighbours: each *Área* chip in the filter sheet (wrapped), the applied chip in the quick row, the three quick chips beside it | browser pane (box model) |
| 3 | A | No meaning by colour alone: the applied chip carries the check, the fill and the heavier weight; the badge is a number; an unknown area reads as text (*Área*), not as a missing chip | browser pane |
| 4 | A | Copy is pt-BR, sentence case, "você", zero special-cased: *Área*, *Sem área*, *Limpar filtros*, *Nenhuma tarefa com esse filtro.*; no `categoria`; the neutral *Área* for an unknown area is recorded as a proposal pending the owner | browser pane |
| 5 | A | Tab / Space on the chips, Esc closes the filter sheet with focus back on the opener; the applied chip toggles with Space and clearing it returns focus sensibly | browser pane (real key presses) |
| 6 | A | The group has a visible *Área* label and the same `aria-label`; the applied chip's pressed state is exposed; icon-only controls unchanged; `<title>` and `lang` untouched | browser pane |
| 7 | A | Tokens only (the only class change, if any, is Task 6's recorded one); no literal colour, size or duration; reduced motion honoured (nothing new moves) | browser pane |
| 8 | A | No destructive action added; *Limpar filtros* and the applied chip only change view state, nothing is written | browser pane |
| 9 | A | Only same-origin `/api/tasks` and `/api/life-areas`; picking an area issues exactly one `GET /api/tasks?...lifeAreaId=...`; a capture's `POST /api/tasks` body carries `lifeAreaId` as the walk says (id, `null`, absent) | browser pane (network panel) |
| 10 | B | Contrast of the five pairs of §4.3 — the applied chip uses the existing pressed `Chip` tokens, no new pair | **owner's device** for the real rendering |
| 11 | B | States simulated: areas request blocked (group absent, no chip name — *Área* — no banner), zero areas (group absent), an area deleted on another tab then a foreground return (the list reads *Nenhuma tarefa com esse filtro.* with *Limpar filtros*, and the refetch carries the filter), offline, a capture under each of the three filter states | browser pane (DevTools Network) |
| 12 | B | 375 px and 1280 px: twelve areas plus *Sem área* wrap inside the filter sheet; a 40-character name in both sheets and as the applied chip (Task 6's measurement); the leading applied chip leaves the quick chips reachable; **safe areas, keyboard overlap and the Android back gesture are the owner's device only** | browser pane; **owner's device** for the last three |
| 13 | B | `vite build` size report read against §11 | `npm run build`; **Lighthouse on the phone is the owner's device only** |
| 14 | B | Screenshots filed under `PRPs/reports/life-areas/phase-4/` or the reason none exists | **owner's device photos** when the pane cannot render; never claim one that was not taken |

## Acceptance Criteria

- **AC-A1 (PRD AC-13):** Given `EMPTY_FILTER`, then `lifeAreaId` is `null`, `toQuery` emits `""` and `activeCount` is `0`; given `lifeAreaId` an id, `toQuery` emits `lifeAreaId=<id>` and given `"none"` it emits `lifeAreaId=none`, after every parameter it already emitted, whose order is unchanged; `activeCount` counts it as one active filter and `q` still counts for nothing; `isChipActive` and `toggleChip` behave exactly as before and carry the area through untouched. Pure, and tested without the DOM.
- **AC-A2 (PRD AC-14):** Given the *Hoje* filter has `lifeAreaId` A, when the owner captures `marcar consulta`, then the create request carries `lifeAreaId` A; given the filter is `"none"` it carries `null`; given no area filter it carries no `lifeAreaId` key at all. `submitCapture` passes `filter.lifeAreaId` to the already-pinned `captureAreaFields`, so the half phase 3 could not observe now is true, and the captured Task appears in the filtered list with the area's name.
- **AC-A3 (PRD AC-21):** Given the area-filter value and the loaded areas, then `decideAreaFilterChip` returns `absent` for no filter, `no-area` for `"none"` whatever the list holds, `area` with its name for an id the list holds, and `unknown` for an id it does not hold — a deleted area, an empty list or a failed request — so an applied narrowing filter is never hidden. Pure, and tested without the DOM.
- **AC-A4 (PRD AC-21):** Given at least one area, when the owner opens the filter sheet, then an *Área* group offers *Sem área* and each area, alphabetically in pt-BR and wrapping inside the sheet; picking one filters *Hoje* at once and tapping the pressed chip clears it; with no areas, or when the areas request fails, the group is absent; and a 40-character name does not make either sheet scroll sideways — or the measured overflow is recorded with a decision (Task 6).
- **AC-A5 (PRD AC-21):** Given an area is picked, then the header badge rises by one and the quick row leads with one selected chip named after the area (*Sem área* for `"none"`, *Área* for an id the list does not hold); killing and reopening the app starts unfiltered; given that area was deleted from another device, then after the refetch — including the one on returning to the foreground, which must use the CURRENT filter — the list reads *Nenhuma tarefa com esse filtro.* with *Limpar filtros*; and *Limpar filtros* clears the area together with every other dimension.
- **AC-A6 (PRD AC-18):** Given a snapshot holding at least one `life_areas` row and at least one assigned Task, produced through the real routes on a local worker, when `scripts/restore-drill.mjs` rebuilds it, then the row counts match and every field of every row is identical, `life_areas` included, and the result is recorded under `PRPs/reports/life-areas/` as a SYNTHETIC FIXTURE run with the run on a real production snapshot recorded as OWED. AC-18 as the PRD words it ("a production snapshot") is NOT claimed met.
- **AC-A7 (PRD AC-24):** Given the unit is not yet deployed, then `PRPs/reports/life-areas/device-proof.md` exists marked `Status: OWED`, lists the steps the owner performs on his phone and the decisions awaiting him, and records no observation.
- **AC-A8 (PRD AC-25):** Given this phase's work, when `documentation/` and `docs/` are inspected, then FR-008 names Tasks and recurrence series; the glossary and `domain-model.md` describe a Life Area as a named grouping the owner creates, with *Sem área* as the pt-BR copy of the implicit "Unsorted" grouping, marked as proposed and awaiting the owner; `ui-layout-standard.md` §2.6 and §6 carry a dated amendment replacing the "area dot" with the area name, with its History row; `docs/api-reference.md` documents `/api/life-areas` and `lifeAreaId` on `GET /api/tasks`; the derived `docs/` area files and `CLAUDE.md` agree with `documentation/`; and the roadmap records the true state — `in-progress`, with the real-snapshot drill and the device proof owed — rather than `shipped` (the final clause of PRD AC-25 waits for AC-24).
- **AC-A9 (PRD AC-23):** Given this phase's diff against `main`, then `src/shared/recurrence.ts`, `src/shared/adherence.ts`, `package.json` and `package-lock.json` are byte-identical to `main`, no file was added under `migrations/`, nothing under `.claude/` is part of the diff, no ADR was edited, no test file was deleted and no skip marker added, the only existing assertions that changed are the legitimate extensions listed in Notes, `npm run check` and `npm test` pass, and the UI/UX review checklist's ✔/✘ is recorded in `PRPs/reports/life-areas/phase-4/ui-checklist.md` with the device-only items marked owed.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| The foreground refetch closes over the first render's filter, so returning to the app refetches the UNFILTERED list under chips that still say filtered — AC-21's deleted-area case would never show its empty state, and every other filter has had the same latent defect since unit 3 | H | H | Task 5 routes the call through a latest-callback ref (the idiom `useConnectivity` already uses); Level 2 requires `refreshRef.current`; Level 4 item 11 checks the Network panel for the filtered query on a simulated foreground return |
| A 40-character area name overflows a wrapping `Chip` group at 375 px and the sheet scrolls sideways (recorded as phase 3's conscious exception, now in a second sheet) | M | M | Task 6 measures both sheets and decides on numbers; the only change allowed is one class string, and it requires re-measuring every other chip group for 48 px heights |
| The applied chip trails the three quick chips and sits at or past the edge of the row at 375 px, so an applied narrowing filter is invisible without scrolling | M | M | Task 4 puts it FIRST in the row; Task 6 and checklist item 12 measure the row; the badge also counts it |
| The sheet's `areaChoiceValue` and `lifeAreaIdFromChoice` are reused for the filter: they map `"none"` to `null`, which in the filter means no filter, so *Sem área* would be pressed on an unfiltered list or its pick would clear the filter | M | H | Task 3 maps the value directly (`NO_AREA_VALUE` is the filter's own value); Level 2 fails if either helper appears in `FilterSheet.tsx`; Task 2 warns on both helpers |
| `EMPTY_FILTER`'s exact shape is asserted in `test/task-filter.test.ts` and three literal `TaskFilter` objects there stop type-checking once the key is required | H | L | Listed in Notes as legitimate extensions to be made by the test pair through its lifecycle ledger as updates (never deletions); `tsc -b` is the proof nothing else builds a literal `TaskFilter` |
| The synthetic-fixture run is mistaken for the production proof and AC-18 is read as met | M | H | Literal markers (`SYNTHETIC FIXTURE RUN`, `REAL SNAPSHOT RUN: OWED`), the roadmap sentence, the close-out's `## Not claimed`, and the PRD's own wording quoted as unmet |
| The drill's snapshot lands in `~/praesto-snapshots` and the weekly job's same-day rule then skips the owner's real snapshot | L | H | Task 8 sets `PRAESTO_SNAPSHOT_DIR` to a scratch directory explicitly; the snapshot file is never committed |
| The dev token leaks into a transcript or a report while seeding the fixture (chore C10's precedent) | L | H | Task 8 moves it from `.dev.vars` into a scratch file with no echo; no record contains it |
| A stale area filter (area deleted on another device) leaves the owner capturing into an id the server refuses: the create answers 400 under the capture field, input kept (FR-045), until he taps *Limpar filtros* | L | M | Known edge, recorded and not engineered around: the list shows *Nenhuma tarefa com esse filtro.* with *Limpar filtros* and the chip reads *Área*, so the way out is on screen; silently dropping the filter would widen the list without telling him, which AC-21 forbids |
| The glossary and domain-model wording changes owner-validated definitions without his say | M | M | Written as the PRD proposes it and marked "awaiting the owner's confirmation" in place and in the device-proof's open items; nothing is presented as validated |
| The *Limpar filtros* sentence in layout standard §2.3 contradicts the owner's 2026-08-24 "toggles and nothing else" cut | M | L | This plan follows the later, explicit decision, amends §2.3 in place with the date, and flags the question for the owner; adding the chip back is one element |
| The owner does not keep using the filter, so the exit signal's revert clause applies | M | L | The unit adds no migration, so reverting is removing routes and UI (PRD D-C); the plan does not mark the unit shipped |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework.
- **Where the framework does run:** the `VALIDATE` commands of the pure-logic Tasks 1 and 2 also run the relevant suite file as a regression guard and as the proof of the pair's added cases, and Level 2's `npm test` runs both projects. Running a suite is not touching a test file.
- **For the test pair — the cases this plan pins** (PRD AC-13 is the pure criterion of this row; AC-14's pure half already exists from phase 3; AC-21 is manual except the decision below, which the plan adds as AC-A3):
  - **Existing `test/task-filter.test.ts`, appended cases** (AC-13; `TODAY` is `2026-08-24`; `A` is `"3f2c9d1e-0000-4000-8000-000000000001"`): `EMPTY_FILTER.lifeAreaId` is `null`; `toQuery(EMPTY_FILTER)` is `""`; `toQuery({ ...EMPTY_FILTER, lifeAreaId: A })` is `?lifeAreaId=3f2c9d1e-0000-4000-8000-000000000001`; `toQuery({ ...EMPTY_FILTER, lifeAreaId: "none" })` is `?lifeAreaId=none`; with every dimension set — `{ status: "open", from: "2026-08-01", to: TODAY, priority: "high", q: "aluguel", lifeAreaId: "none" }` — the query is `?status=open&from=2026-08-01&to=2026-08-24&priority=high&q=aluguel&lifeAreaId=none` (the area last, every earlier parameter in its old place); `activeCount({ ...EMPTY_FILTER, lifeAreaId: A })` and `(… lifeAreaId: "none")` are `1`; status plus priority plus a range plus an area is `4`; `{ ...EMPTY_FILTER, q: "x", lifeAreaId: A }` is `1` (`q` counts for nothing); `toggleChip({ ...EMPTY_FILTER, lifeAreaId: A }, "open", TODAY)` equals `{ ...EMPTY_FILTER, lifeAreaId: A, status: "open" }` and toggling it off again keeps the area; `isChipActive({ ...EMPTY_FILTER, lifeAreaId: "none" }, chip, TODAY)` is `false` for each of the three chips.
  - **Existing `test/life-area-assign.test.ts`, appended cases** (AC-A3; areas `[{ id: "A", name: "Casa" }, { id: "B", name: "Saúde" }]`): `decideAreaFilterChip(null, null)`, `(null, [])` and `(null, areas)` are `{ kind: "absent" }`; `("none", null)`, `("none", [])` and `("none", areas)` are `{ kind: "no-area" }`; `("A", areas)` is `{ kind: "area", name: "Casa" }`; `("C", areas)`, `("A", [])` and `("A", null)` are `{ kind: "unknown" }`; the `areas` argument is left unchanged.
- **Existing assertions this phase legitimately extends — the phase-3 plan's claim that no existing assertion changes no longer holds for this file, and the pair routes each through its ledger as an UPDATE, never a DELETE or a loosening.** All in `test/task-filter.test.ts` (the only test that references `EMPTY_FILTER`, `toQuery` or `activeCount`, per grounding): (1) lines 45-51, the `const filter: TaskFilter = { … }` literal in "carries every set dimension in one query string, in a fixed order" gains `lifeAreaId: null` — its expected string is unchanged; (2) lines 112-116, the inline `activeCount({ … q: null })` literal in "never exceeds three" gains `lifeAreaId: null` and the case's title becomes untrue (the range is now 0 to 4), so the pair retitles it and the appended case above covers four; its expected value `3` is unchanged; (3) lines 164-170, the `const rich: TaskFilter = { … }` literal in "touches no dimension but its own" gains `lifeAreaId: null`; (4) lines 215-226, `expect(EMPTY_FILTER).toEqual({ status: null, priority: null, from: null, to: null, q: null })` in "EMPTY_FILTER has all five dimensions null" gains `lifeAreaId: null` and its title says six — the struct's shape genuinely changes, the same reasoning that test's own comment records for the text-search phase. Nothing else in `test/` builds a literal `TaskFilter` or asserts an exact `toQuery` string for the area, and `test/life-areas-task-routes.test.ts:241-361` already covers the server side of the parameter, including that an empty `lifeAreaId=` is a 400 — which is why `toQuery` must never emit an empty one and the filter sheet never produces one.
- **PRD-AC mapping (R8).** AC-A1 is PRD AC-13 verbatim in its decidable form. AC-A2 is PRD AC-14's observable half, which phase 3 stated it could not observe. AC-A3, AC-A4 and AC-A5 are PRD AC-21; AC-A3 is the one decidable part the plan adds beyond the PRD's literal text, disclosed rather than hidden — it follows from "appears as a selected chip" plus layout standard §2.3's "a narrowing filter never survives a cold start *silently*", and exists so that no applied filter can be invisible. AC-A6 is PRD AC-18, and AC-A7, AC-A8 and AC-A9 are PRD AC-24, AC-25 and AC-23. No PRD AC was invented and no plan AC cites a criterion that does not exist.
- **What is and is not claimed.** The drill passes on a synthetic fixture; AC-18 on a real production snapshot is OWED (production holds no area and the unit is not deployed, and this session has no production token). The device proof, AC-24, is the owner's and the skeleton claims nothing. The unit stays `in-progress`; the roadmap row, `CLAUDE.md` and the docs must not say `shipped`. PRD AC-25's last clause waits for AC-24.
- **Carry-forward from phase 3, honoured.** The phase-3 plan's Notes say "Phase 4 must replace that one line with `filter.lifeAreaId`; no signature changes and AC-14's pure tests already cover the function." The PRD's row 4 does not say it; Task 5 does. The phase-3 plan also forbade touching `Chip`; Task 6 lifts that, conditionally and on a measurement.
- **A defect found while grounding, predating the unit.** `TodayScreen`'s `visibilitychange` effect has an empty dependency array, so its `refresh()` closes over the first render's `filter` (`EMPTY_FILTER`). Since unit 3 a returning-to-foreground refetch has therefore replaced a filtered list with the unfiltered one while the chips went on saying filtered. `useConnectivity` already avoids the same trap for `onOnline` with a ref; the other refetches in that effect read no changing state. PRD AC-21 and its Technical Risks row ("*Hoje* refetches on `visibilitychange`; an unmatched id is an empty list with *Limpar filtros*") depend on the refetch honouring the filter, so Task 5 fixes it here rather than leaving the unit's headline behaviour false. It is glue with no honest test-first path under `docs/context/methodology.md`, so the check is Level 4 item 11.
- **Decisions left to the plan, with their reasons.** (1) The applied chip is a TOGGLE appended to the quick row's own group (value `"area"`, tapping it clears only the area), not a new component and not a second state: the row stays a view of the one `TaskFilter`. (2) It LEADS the row, for visibility, and is never hidden: an unknown id still shows *Área*. (3) The sheet's group is absent (not a placeholder) with no areas or a failed request, exactly as AC-21 words it. (4) The area is last in `toQuery`, the same reason `q` is: no existing expected string changes. (5) *Limpar filtros* stays out of the row — see the next note. (6) The synthetic snapshot is not committed: it is local dev data, and the record carries its hash and counts so the run is checkable and repeatable.
- **For the owner — the *Limpar filtros* chip.** Layout standard §2.3 still says applied filters "stay visible as selected chips with a *Limpar filtros* chip", and PRD AC-21 says the selected chip appears "with *Limpar filtros*". The same section also says, since the owner's 2026-08-24 cut of the *Filtros…* chip, that the row "holds toggles and nothing else". A *Limpar filtros* chip is not a toggle. This plan follows the later, explicit decision: the clear-all lives in the sheet and in the filtered-empty state (both of which AC-21 requires), and tapping the applied chip clears the area in one tap. If he wants the chip back it is one element in `FilterChips.tsx`; the plan flags it in the roadmap line and in `device-proof.md`'s open items rather than settling it for him.
- **Proposed copy and wording, pending the owner — open, not settled.** *Área* (the group label), *Você ainda não criou nenhuma área.*, *Criar áreas* and *Aplicar título, descrição, prioridade e área a* (phase 3's proposals, still unconfirmed), the neutral chip label *Área* this phase adds for an id the list does not hold, and the glossary and domain-model wording of a Life Area. Each UI string is a literal in its component, one edit to change; the documents mark the wording as proposed.
- **Research grounding.** `research-codebase` located every anchor above; its one correction to the brief is that `FilterChips.tsx` has neither a trailing *Filtros…* chip nor a *Limpar filtros* control, so the applied chip is a new render path rather than an extension, and *Limpar filtros* lives only in `FilterSheet.tsx` and `EmptyState.tsx`. The plan's own reads confirmed the foreground-refetch defect and that no non-test source builds a literal `TaskFilter`. `research-web` returned thin, mostly non-task-manager evidence: it found no first-party source on how task apps show an applied-filter chip, on filter persistence across sessions, or on a filter that references a deleted entity, and its restore-drill sources stop at row counts and checksums — none of which changes a decision here; D-N and the field-for-field comparison rest on the owner's decision and the drill's own design.
- **Slug.** "Filter and close-out" becomes `filter-and-close-out` under Step 1.4's rule, so the file is `life-areas-phase-4-filter-and-close-out.plan.md`.
- The CLAUDE.md UI/UX gate applies: the Implementer reads `documentation/40-engineering/ui-ux-guidelines.md` and `documentation/40-engineering/ui-layout-standard.md` before touching `src/app/`, and Task 7 records the checklist result.

*Generated: 2026-10-12*
*Approved: 2026-10-12*
*Implemented: 2026-10-12*
*Status: IMPLEMENTED*
