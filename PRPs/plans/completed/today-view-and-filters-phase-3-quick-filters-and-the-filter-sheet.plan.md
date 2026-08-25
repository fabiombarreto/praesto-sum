# Feature: Quick filters and the filter sheet (Phase 3 of today-view-and-filters)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: reuse and creation of components (ChipGroup/Chip get their
  second consumer, Sheet its second); impact on shared UI (the one screen every
  later unit plugs into); a new pure module in `src/shared`; a data-contract
  consumer change (`listTasks` grows a filter argument); amends a written UI rule
  (layout standard §2.3)
- Decisions found:
  - Owner, 2026-08-23 (PRD Decisions Log) — the chip row is *Abertas · Para hoje
    · Alta prioridade* plus *Filtros…*; filters reset on a cold start while group
    collapse persists; the header count keeps its meaning and gains a badge; no
    search (FR-040 is unit 8)
  - Layout standard §2.3 — one horizontally scrolling row of 3–5 toggles plus a
    trailing *Filtros…* chip; 48 px hit areas, 8 px gaps; **default state nothing
    selected, and a narrowing filter never survives a cold start silently**
  - Layout standard §2.1 — the filter icon in the header carries a numeric badge
    when any filter is active
  - Layout standard §2.7 — a filter-induced empty reads *Nenhuma tarefa com esse
    filtro.* + *Limpar filtros*
  - Layout standard §3 — light dismiss (`closedby="any"`) is allowed on the
    filter sheet and ONLY there, never on an editor with unsaved changes; and
    sheets are never stacked
  - Phase 1 (`complete`) — the API already accepts `status`, `from`, `to` and
    `priority`; this phase only calls it
  - ADR-0009 — pt-BR strings enter `visual-identity.md` before they enter code
  - ADR-0010 / ADR-0011 — tokens only; owned components; native `<dialog>`
  - ADR-0008 — `tdd: true`; the chip→query mapping is decidable and goes to
    `src/shared` test-first
- Applicable anti-patterns:
  - Hand-duplicated entity types — the filter module reuses `TaskStatus` and
    `TaskPriority` from `src/shared/api.ts`, never re-declares them
  - Weakening tests to force green — phases 1 and 2's 36 new tests stay untouched
  - Portuguese in artifacts — carve-out: only the visible chip and sheet labels
    are pt-BR; the module, its keys and its tests stay English
  - Glossary synonym drift — open → *aberta*, done → *concluída*, missed → *não
    concluída*, priority → *prioridade* (alta / normal / baixa)
- Applicable architectural rules:
  - `src/shared` stays DOM-free, dependency-free and clock-free — `today` is an
    argument to every function that needs it
  - One screen plus sheets, never stacked: the filter sheet and the detail sheet
    can never be open at the same time
  - Filtering is a read against the API; nothing is filtered from a local copy
    and nothing is queued offline (ADR-0003)
  - UI verification stays manual; the browser-pane pass is the record
- Result: PROCEED
```

## Source

- `PRPs/prds/today-view-and-filters.prd.md` — Implementation Phases row 3 (line
  278): "Quick filters and the filter sheet" — Goal: FR-007's filter half is
  reachable in one tap and never lies about what it is hiding — Success signal
  (PRD Phase Details): Tier A ✔ and Tier B ✔ for the sheet and the chip row, the
  back gesture verified on the Android device, the cold-start reset verified by a
  reload, and the filtered empty state read against the approved copy; `npm test`
  and `npm run check` green.

## Summary

The last phase of unit 3 spends what phase 1 built. One pure module,
`src/shared/task-filter.ts`, holds the whole filter state and every decision
about it — what a chip maps to, what the query string looks like, how many
dimensions are active — so the React side never invents a second answer. The chip
row and the filter sheet are two views of that ONE state: pressing *Alta
prioridade* and choosing *Alta* in the sheet are the same act, and the sheet
shows what the chips did. The header's filter icon carries the count of active
dimensions, a filtered-empty list says so in the approved words and offers
*Limpar filtros*, and none of it survives a cold start — the state lives in React
and nowhere else, which is the layout standard's rule stated as an
implementation, not a promise.

## User Story

As the owner
I want to narrow the list to a status, a priority or a date window without
leaving the screen
So that I can answer a narrower question than "what is today?" — and always see
that a filter is on, so an emptier list never reads as lost work.

## Problem Statement

FR-007 promises filtering by status, dates and priority. Phase 1 taught the API
all three; nothing calls them. `TodayScreen` still issues a bare `listTasks()`
(`src/app/components/TodayScreen.tsx`), the header has no filter control, and the
chip primitives built in A5 (`src/app/components/ui/Chip.tsx`) have exactly one
consumer — the detail sheet's date and priority pickers. Until this lands, the
owner's only way to ask a narrower question is to read past the answers he does
not want.

## Solution Statement

Put every decidable rule in `src/shared/task-filter.ts`: a `TaskFilter` record of
four nullable fields, `EMPTY_FILTER`, the chip vocabulary, `toggleChip`,
`isChipActive`, `activeCount` and `toQuery`. `TodayScreen` holds one
`useState<TaskFilter>` seeded from `EMPTY_FILTER` — never from storage, which is
what makes the cold-start reset structural — passes it to `listTasks`, and hands
it to both the chip row and the sheet. `Sheet` grows one optional `lightDismiss`
prop so the filter sheet gets `closedby="any"` while the editor's behaviour stays
byte-identical. The filtered-empty variant is a second, explicit branch of
`EmptyState` rather than a silent reuse, because its copy and its action are
different.

## Metadata

| Key | Value |
|---|---|
| Type | UI feature on an existing screen + one new pure module |
| Complexity | Medium — one shared module, two new components, four touched; no API change (phase 1 shipped it), no migration, no new dependency |
| Systems Affected | `src/shared/`, `src/app/`, the approved microcopy table, the layout standard |
| Dependencies | Phases 1 and 2, both `complete` |
| Estimated Tasks | 8 |
| Source PRD line ref | `PRPs/prds/today-view-and-filters.prd.md:278` (Implementation Phases row 3) |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| 1 | `src/app/components/TodayScreen.tsx` | 79-110, 337-400 | Where the filter state must live, the single `refresh()` every read goes through, and the list region the chip row and empty state plug into |
| 1 | `src/app/components/ui/Sheet.tsx` | 1-30, 82-112 | The `closedby` decision recorded in its header comment, and the markup the `lightDismiss` prop must leave untouched for the editor |
| 1 | `src/app/components/ui/Chip.tsx` | 1-46 | `ChipGroup`/`Chip` over Base UI: 48 px hit areas, pill shape, pressed state by fill + weight + a leading check — never colour alone |
| 1 | `docs/api-reference.md` | 14-50 | What phase 1 shipped: the parameter names, the inclusive range, `priority=normal` matching unset, and the `limit` rule this must not disturb |
| 2 | `src/app/api.ts` | 85-99 | `listTasks`'s current signature and its `URLSearchParams` idiom; one caller today |
| 2 | `src/app/components/TodayHeader.tsx` | 1-27 | The header the filter icon joins; §2.1 allows up to three 48 px icon buttons and this phase adds exactly one |
| 2 | `src/app/components/EmptyState.tsx` | 1-18 | The empty state gaining a second, filtered branch |
| 2 | `documentation/40-engineering/ui-layout-standard.md` | §2.1, §2.3, §2.7, §3 | The chip row, the badge, the filtered empty, and the light-dismiss rule that applies to this sheet and no other |
| 3 | `documentation/10-product/visual-identity.md` | 80-110 | The approved microcopy table every new string enters first |
| 3 | `PRPs/prds/today-view-and-filters.prd.md` | 109-145 | AC-11 through AC-17 |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-groups.ts:1-20
/**
 * The client half of the frozen Task read contract (unit 2, 2026-08-15):
 * `groupTasks` PARTITIONS the array the API already ordered into the buckets
 * layout standard §2.5 specifies. It never sorts — the ordering is produced
 * by the API and is its guarantee to keep (`docs/api-reference.md`), so
 * re-deriving it here would put the one thing every consumer must agree on
 * in the one place they cannot share.
 */
```

Phase 2's module header: state the environment constraint and the one rule the
module exists to protect. `task-filter.ts` copies the shape — its rule is that
the chip row and the sheet are two views of ONE state.

```ts
# SOURCE: src/app/api.ts:90-98
export async function listTasks(status?: TaskStatus, limit?: number): Promise<TaskDto[]> {
  const params = new URLSearchParams();
  if (status !== undefined) params.set("status", status);
  if (limit !== undefined) params.set("limit", String(limit));
  const query = params.size === 0 ? "" : `?${params.toString()}`;

  const body = await request<{ tasks: TaskDto[] }>(`/api/tasks${query}`);
  return body.tasks;
}
```

The signature being replaced and the `URLSearchParams` idiom the new one keeps —
including `params.size === 0` yielding an empty string, which is what makes an
unfiltered request byte-identical to today's.

```tsx
# SOURCE: src/app/components/ui/Chip.tsx:11-32
export function ChipGroup({
  value,
  onValueChange,
  children,
  label,
  multiple = true,
}: {
  value: string[];
  onValueChange: (next: string[]) => void;
  children: ReactNode;
  label: string;
  multiple?: boolean;
}) {
  return (
    <ToggleGroup
      multiple={multiple}
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      className="flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]"
    >
```

The chip primitive both surfaces reuse: `multiple` for the quick row, `multiple={false}`
for the sheet's single-select dimensions. The horizontal scroll and the 8 px gap
§2.3 asks for are already in this class list.

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:80-90
  const [overdueCollapsed, setOverdueCollapsed] = useState(() =>
    readCollapsed(OVERDUE_COLLAPSED_KEY, false),
  );
```

The contrast the filter state must draw against: collapse state is seeded FROM
storage; the filter must be seeded from `EMPTY_FILTER` and written to storage
nowhere. That asymmetry is the cold-start rule, and it is enforced by a grep in
Task 8's VALIDATE.

```tsx
# SOURCE: src/app/components/ui/Sheet.tsx:96-104
      <div className="flex items-center gap-2">
        <h2 id={titleId} className="m-0 flex-1 font-text text-t4 font-semibold">
          {title}
        </h2>
        <Button
          type="button"
          variant="icon"
          aria-label="Fechar"
          onClick={() => onOpenChange(false)}
        >
```

The sheet chrome the filter sheet inherits unchanged — same title row, same
*Fechar* button, same accessible name.

```markdown
# SOURCE: documentation/40-engineering/ui-layout-standard.md:72
| 2026-08-23 | **A5 retro (plan A6).** Five rules amended by what building the screens measured: §2.6 titles wrap to two lines (the guidelines sit above this document), §2.7 the empty state carries the *Nova tarefa* CTA (the approved microcopy postdated the "no duplicate button" line), … |
```

The amendment convention Task 2(b) copies: a dated History row that names the
section changed AND what measured it wrong, never a bare "updated §2.3". The
2026-08-24 row this phase adds follows the same shape, with unit 3's domain fact
— a Task has no time of day — as the thing that measured it.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/task-filter.ts` | CREATE | The whole filter vocabulary and every decision about it, authored test-first |
| `documentation/10-product/visual-identity.md` | UPDATE | The chip, sheet and badge strings are new visible copy; ADR-0009 puts them in the approved table first |
| `documentation/40-engineering/ui-layout-standard.md` | UPDATE | §2.3's *Com hora* chip is not expressible for a Task; the amendment is dated in place with a History row, per the maintenance map |
| `src/app/api.ts` | UPDATE | `listTasks` takes the filter and builds the query from `toQuery` |
| `src/app/components/ui/Sheet.tsx` | UPDATE | One optional `lightDismiss` prop; the editor's behaviour must not move |
| `src/app/components/FilterChips.tsx` | CREATE | The quick-filter row plus the trailing *Filtros…* chip |
| `src/app/components/FilterSheet.tsx` | CREATE | Status, Prioridade and Período, over the existing `Sheet` and `ChipGroup` |
| `src/app/components/TodayHeader.tsx` | UPDATE | The 48 px filter icon button with its numeric badge |
| `src/app/components/EmptyState.tsx` | UPDATE | The filtered branch: *Nenhuma tarefa com esse filtro.* + *Limpar filtros* |
| `src/app/components/TodayScreen.tsx` | UPDATE | Owns the one filter state, passes it to `listTasks`, the chips, the sheet, the header and the empty state |

## NOT Building (Scope Limits)

- **Text search** (FR-040, unit 8) — no search icon, no search route, nothing in the vocabulary.
- **Life Area filters** (FR-008, unit 13) — the filter record gains no `lifeAreaId`.
- **Filter persistence of any kind.** No `localStorage`, no URL parameter, no session storage. The state is React-only, which is the rule made structural.
- **A `missed` group or any change to where `missed` Tasks appear** — the sheet can *filter* to `missed` via its status dimension, but the grouping is phase 2's and unchanged.
- **The *Reagendar para hoje* action**, the ≥ 840 px two-pane desktop, and a `normal`-priority chip in the quick row — all deferred by the PRD.
- **Any change to the API.** Phase 1 shipped the parameters; this phase only calls them. No route, no validator, no `WHERE` clause is touched.
- **Sorting controls.** The order is the API's and there is no way to change it.
- **Test files.** The suite for AC-12 is authored by the test pair before the Implementer runs; no task below edits or creates a test file.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/task-filter.ts`

- **ACTION**: Create a pure module importing only the `TaskStatus`, `TaskPriority`
  and `TaskDto`-adjacent TYPES from `./api` — never re-declaring them. Open with a
  module header in the register of `src/shared/task-groups.ts:1-20` stating: the
  module is compiled into both targets so it carries no DOM globals, no runtime
  dependencies and no clock read (`today` is an argument); and the rule it
  exists to protect — the chip row and the filter sheet are two VIEWS of one
  state, never two states that must be kept in sync.
  Export:
  - `export interface TaskFilter { status: TaskStatus | null; priority: TaskPriority | null; from: string | null; to: string | null; }`
  - `export const EMPTY_FILTER: TaskFilter` with all four `null`.
  - `export type QuickChip = "open" | "today" | "high";`
  - `export function toQuery(filter: TaskFilter): string` — returns `""` when
    every field is `null`, otherwise `?` plus the set parameters in the fixed
    order `status`, `from`, `to`, `priority`, built with `URLSearchParams` so
    values are encoded. The fixed order is what makes the output assertable.
  - `export function activeCount(filter: TaskFilter): number` — counts
    DIMENSIONS, not fields: `status` is one, `priority` is one, and `from`/`to`
    together are one *period*, so a range counts once, never twice. Range 0–3.
  - `export function isChipActive(filter: TaskFilter, chip: QuickChip, today: string): boolean`
    — `open` when `status === "open"`, `high` when `priority === "high"`, `today`
    when `to === today`.
  - `export function toggleChip(filter: TaskFilter, chip: QuickChip, today: string): TaskFilter`
    — returns a NEW object (never mutates) with exactly that chip's own dimension
    flipped: pressing sets it, pressing again clears it to `null`, and no other
    field is touched. `today` maps to the `to` field; note it clears only `to`,
    leaving any `from` the sheet set.
  Every function is total and side-effect free; no function reads the clock.
- **MIRROR**: `# SOURCE: src/shared/task-groups.ts:1-20` — the module-header
  discipline and the "state the one rule this module protects" convention.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function toQuery' src/shared/task-filter.ts
  grep -q 'export function toggleChip' src/shared/task-filter.ts
  grep -q 'export const EMPTY_FILTER' src/shared/task-filter.ts
  if grep -qE 'localStorage|sessionStorage|new Date\(|Date\.now' src/shared/task-filter.ts; then
    echo "FAIL: the filter module must not read storage or the clock"; exit 1
  fi
  npx tsc -b
  npx vitest run --project worker
  ```
- Delivers AC-A1.

### Task 2: UPDATE the two documentation files (copy and rule, before any code renders them)

- **ACTION**: Two edits, both before Tasks 4–8 touch a component.
  **(a) `documentation/10-product/visual-identity.md`** — add three rows to the
  approved microcopy table, after the *Group headers* row phase 2 added:
  `| Quick-filter chips | *Abertas* · *Para hoje* · *Alta prioridade* · *Filtros…* |`,
  `| Filter icon (accessible name) | *Filtros* · with filters active, *Filtros (N ativos)* |`,
  and `| Filter sheet | title *Filtros* · labels *Status · Prioridade · Período* · status chips *Abertas · Concluídas · Não concluídas* · priority chips *Alta · Normal · Baixa* · date labels *De* / *Até* · *Limpar filtros* · close button *Fechar* |`.
  Add a dated `## History` line naming this plan. Set `last_updated: 2026-08-24`.
  **(b) `documentation/40-engineering/ui-layout-standard.md`** — amend §2.3 in
  place: replace the *Com hora* chip with *Para hoje*, and add a short dated
  parenthetical stating why — a Task carries no time of day (`deadline` and
  `scheduledDate` are calendar days, enforced by `tasks_single_date_chk`);
  time-of-day arrives with Event in unit 14. Add a `## History` row dated
  2026-08-24 describing the amendment and naming unit 3 as what proved it. Set
  `last_updated: 2026-08-24`. Do not touch any other section — §2.1's badge,
  §2.7's filtered empty and §3's light-dismiss rule are all being implemented as
  written, not amended.
- **MIRROR**: `# SOURCE: documentation/40-engineering/ui-layout-standard.md:72`
  — the A5-retro History row, whose "what changed, and what measured it wrong"
  shape the 2026-08-24 amendment row copies.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'Quick-filter chips' documentation/10-product/visual-identity.md
  grep -q 'Filter sheet' documentation/10-product/visual-identity.md
  grep -q 'Para hoje' documentation/40-engineering/ui-layout-standard.md
  if grep -q 'Com hora' documentation/40-engineering/ui-layout-standard.md; then
    echo "FAIL: the unimplementable Com hora chip is still prescribed"; exit 1
  fi
  npx vitest run --project docs
  ```
- Delivers AC-A2, AC-A7.

### Task 3: UPDATE `src/app/api.ts`

- **ACTION**: Change `listTasks` to take the filter object:
  `export async function listTasks(filter: TaskFilter = EMPTY_FILTER, limit?: number): Promise<TaskDto[]>`.
  Build the query by starting from `toQuery(filter)` and appending `limit` when
  supplied — or, equivalently, build one `URLSearchParams` from the filter's set
  fields plus `limit`; either is fine provided an EMPTY filter with no limit
  produces exactly `""`, so the unfiltered request is byte-identical to today's.
  Keep the existing doc comment's paragraph about not re-sorting the result.
  Import the type and `EMPTY_FILTER` from `../shared/task-filter`.
- **MIRROR**: `# SOURCE: src/app/api.ts:90-98` — the signature being replaced and
  the `params.size === 0` idiom that keeps an unfiltered call unchanged.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'toQuery' src/app/api.ts
  if grep -q 'listTasks(status?: TaskStatus' src/app/api.ts; then
    echo "FAIL: the old positional signature is still present"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A3.

### Task 4: UPDATE `src/app/components/ui/Sheet.tsx`

- **ACTION**: Add ONE optional prop, `lightDismiss?: boolean` (default `false`).
  When `true`, set `closedby="any"` on the `<dialog>`; when false or absent, emit
  no `closedby` attribute at all so the editor keeps the `showModal()` default of
  `closerequest` exactly as today. Extend the component's header comment: record
  that light dismiss is opt-in because layout standard §3 allows it on the filter
  sheet and forbids it on an editor with unsaved changes, and that the detail
  sheet therefore never passes the prop. Change nothing else — the `close`/`cancel`
  mirroring, the focus handling, the handle, the title row and the class list all
  stay byte-identical. Note React does not know `closedby`; if it warns about an
  unknown attribute, use the lowercase DOM attribute name it accepts rather than
  restyling the component.
- **MIRROR**: `# SOURCE: src/app/components/ui/Sheet.tsx:96-104` — the chrome that
  must stay untouched while the one attribute is added.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'lightDismiss' src/app/components/ui/Sheet.tsx
  grep -q 'closedby' src/app/components/ui/Sheet.tsx
  grep -q 'aria-label="Fechar"' src/app/components/ui/Sheet.tsx
  npx tsc -b
  npx eslint src/app/components/ui/Sheet.tsx
  ```
- Delivers AC-A6.

### Task 5: CREATE `src/app/components/FilterChips.tsx`

- **ACTION**: The quick-filter row of layout standard §2.3: one horizontally
  scrolling `ChipGroup` (`multiple`) holding three `Chip`s — *Abertas*, *Para
  hoje*, *Alta prioridade* — plus a trailing *Filtros…* chip that opens the
  sheet. Props: the current `TaskFilter`, `today`, `onToggleChip(chip)` and
  `onOpenSheet()`. Derive each chip's pressed state from `isChipActive`, never
  from local state — that is what makes the row a view of the filter rather than a
  second copy of it. The *Filtros…* chip is not a toggle: render it as a `Chip`
  whose activation calls `onOpenSheet`, or as a sibling button styled with the
  same class list; either way it must never appear pressed. Reuse the existing
  `Chip` classes verbatim; introduce no colour literal and no inline style.
- **MIRROR**: `# SOURCE: src/app/components/ui/Chip.tsx:11-32` — the group and its
  class list, including the horizontal scroll and the 8 px gap §2.3 requires.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'Abertas' src/app/components/FilterChips.tsx
  grep -q 'Para hoje' src/app/components/FilterChips.tsx
  grep -q 'Alta prioridade' src/app/components/FilterChips.tsx
  grep -q 'isChipActive' src/app/components/FilterChips.tsx
  if grep -qE '#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|style=\{' src/app/components/FilterChips.tsx; then
    echo "FAIL: colour literal or inline style (guidelines 3.5, 12.2)"; exit 1
  fi
  npx tsc -b && npx eslint src/app/components/FilterChips.tsx
  ```
- Delivers AC-A4.

### Task 6: CREATE `src/app/components/FilterSheet.tsx`

- **ACTION**: The filter sheet, over the existing `Sheet` with `lightDismiss`, title
  *Filtros*. Three labelled dimensions, each a single-select `ChipGroup`
  (`multiple={false}`) so a dimension holds at most one value: **Status**
  (*Abertas* → `open`, *Concluídas* → `done`, *Não concluídas* → `missed`),
  **Prioridade** (*Alta* / *Normal* / *Baixa*), and **Período** as two native
  `<input type="date">` with visible labels *De* and *Até* mapped to `from` and
  `to`. Deselecting a chip clears that dimension to `null`. Every change applies
  IMMEDIATELY through `onChange(next)` — there is no *Aplicar* button, which is
  why light dismiss is safe here and forbidden on the editor. A *Limpar filtros*
  button clears every dimension at once. Each dimension's group needs its own
  `aria-label`; the date inputs need real `<label for>` elements, not placeholders
  (guidelines §10, 3.3.2). Take the current `TaskFilter` as a prop and derive every
  selected state from it.
- **MIRROR**: `# SOURCE: src/app/components/ui/Sheet.tsx:96-104` (the chrome and
  the *Fechar* button it inherits) and
  `# SOURCE: src/app/components/ui/Chip.tsx:11-32` (the group, here with
  `multiple={false}`).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'lightDismiss' src/app/components/FilterSheet.tsx
  grep -q 'Limpar filtros' src/app/components/FilterSheet.tsx
  grep -q 'Período' src/app/components/FilterSheet.tsx
  grep -q 'multiple={false}' src/app/components/FilterSheet.tsx
  if grep -q 'Aplicar' src/app/components/FilterSheet.tsx; then
    echo "FAIL: changes apply immediately; an Aplicar button contradicts light dismiss"; exit 1
  fi
  npx tsc -b && npx eslint src/app/components/FilterSheet.tsx
  ```
- Delivers AC-A5, AC-A6.

### Task 7: UPDATE `TodayHeader.tsx` and `EmptyState.tsx`

- **ACTION**: **(a) `TodayHeader.tsx`** — add one 48 px icon button after the
  count, with `aria-label` *Filtros* when no filter is active and
  `Filtros (N ativos)` when `N > 0`, calling a new `onOpenFilters` prop. When
  `activeCount > 0`, render a small numeric badge showing `N` — the number must be
  real text, not a dot, so the state is not carried by colour or shape alone
  (guidelines §4.4). When `activeCount === 0` render no badge at all. Keep the
  header flat and never elevated, and keep `remaining` exactly as it is: the count
  keeps meaning every open Task of the visible set.
  **(b) `EmptyState.tsx`** — add a `filtered?: boolean` prop (or an explicit
  second exported component; either is fine, but the two branches must be
  visibly distinct in the source). When filtered, render *Nenhuma tarefa com esse
  filtro.* with a *Limpar filtros* action calling `onClearFilters`; when not,
  render today's *Nada para hoje. / Bora capturar a primeira?* with *Nova tarefa*
  unchanged. Both strings are already in the approved table — use them verbatim.
- **MIRROR**: `# SOURCE: src/app/components/ui/Sheet.tsx:96-104` — the
  `Button variant="icon"` with an `aria-label`, the shape the header's filter
  button copies.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'onOpenFilters' src/app/components/TodayHeader.tsx
  grep -q 'Filtros' src/app/components/TodayHeader.tsx
  grep -q 'Nenhuma tarefa com esse filtro' src/app/components/EmptyState.tsx
  grep -q 'Limpar filtros' src/app/components/EmptyState.tsx
  grep -q 'Nada para hoje' src/app/components/EmptyState.tsx
  npx tsc -b && npx eslint src/app/components/TodayHeader.tsx src/app/components/EmptyState.tsx
  ```
- Delivers AC-A4, AC-A8.

### Task 8: UPDATE `src/app/components/TodayScreen.tsx`

- **ACTION**: Wire the one state. Add
  `const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER)` — seeded from
  the constant and **never** from storage, and never written to storage; that
  asymmetry against the collapse state is the cold-start rule (layout standard
  §2.3) expressed as code. Add `const [filtersOpen, setFiltersOpen] = useState(false)`.
  Pass `filter` to `listTasks(filter)` inside `refresh()`, and make every filter
  change re-read: either call `refresh()` after `setFilter`, or add `filter` to a
  `useEffect` that refetches — whichever, a chip tap must produce exactly ONE
  `GET /api/tasks`. Render `FilterChips` directly under the header/banner (the
  §2.3 position, above the list region), pass the sheet `filter` and
  `onChange={setFilter}`, give the header `activeCount(filter)` and
  `onOpenFilters`, and give the list region's empty branch
  `filtered={activeCount(filter) > 0}` with `onClearFilters={() => setFilter(EMPTY_FILTER)}`.
  **Never stack sheets:** the filter sheet must not open while the detail sheet is
  open — gate its `open` prop on `sheet.taskId === null`, the same condition the
  toast slot already uses. Change nothing else about the screen: grouping,
  collapse persistence, the optimistic complete/reopen path, the refetch effects
  and the capture deck all stay as they are.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:80-90` — the collapse
  state seeded FROM storage, the deliberate contrast the filter state must not
  copy.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'useState<TaskFilter>(EMPTY_FILTER)' src/app/components/TodayScreen.tsx
  grep -q 'listTasks(filter' src/app/components/TodayScreen.tsx
  if grep -nE '(localStorage|writeCollapsed)\s*\([^)]*[Ff]ilter' src/app/components/TodayScreen.tsx; then
    echo "FAIL: the filter must never be persisted (layout standard 2.3)"; exit 1
  fi
  npx tsc -b && npx eslint src/app/components/TodayScreen.tsx
  npm test
  ```
- Delivers AC-A3, AC-A8, AC-A9.

### Task 9: RUN the full gate and the build budget

- **ACTION**: Run the suite, the check gate and a production build. Read three
  things beyond the exit codes: that phases 1 and 2's 36 tests are still green and
  `test/` is untouched; that the total count did not fall below 349; and that the
  build is still inside guidelines §11 — this phase adds two components and a
  module, so a jump means something unintended entered the bundle. Do not modify
  any test to make this pass.
- **MIRROR**: `# SOURCE: src/app/api.ts:90-98` — the unfiltered-call shape whose
  preservation the suite is checking.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  git diff --quiet -- test/
  npm test
  npm run check
  npm run build
  ```
- Delivers AC-A10.

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

**Level 3 — FULL SUITE + BUILD + STRUCTURAL GATES**

```bash
set -euo pipefail
npm test
npm run build
git diff --quiet -- test/
if grep -qE 'localStorage|sessionStorage|new Date\(|Date\.now' src/shared/task-filter.ts; then
  echo "FAIL: the filter module must not read storage or the clock"; exit 1
fi
if grep -q 'Com hora' documentation/40-engineering/ui-layout-standard.md; then
  echo "FAIL: the unimplementable Com hora chip is still prescribed"; exit 1
fi
```

The last three are the structural half of AC-A1, AC-A7 and AC-A9: no test file was
touched, the filter module is pure (which is what makes the cold-start rule
provable), and the layout standard no longer prescribes a chip the domain cannot
express. The behavioural halves are asserted by the suite and by the browser pass.

## Acceptance Criteria

- **AC-A1 (PRD AC-12):** `src/shared/task-filter.ts` exports `TaskFilter`, `EMPTY_FILTER`, `toQuery`, `activeCount`, `isChipActive` and `toggleChip`; toggling *Abertas*, *Para hoje* and *Alta prioridade* on an empty filter yields `{status:"open"}`, `{to:today}` and `{priority:"high"}`; toggling the same chip again clears exactly its own dimension and nothing else; all three active produce ONE query string carrying `status=open&to=<today>&priority=high`; an empty filter produces `""`; `activeCount` counts a `from`/`to` range as ONE period dimension; and no function reads storage or the clock.
- **AC-A2 (PRD AC-11):** the chip, sheet and filter-icon strings exist in the approved microcopy table of `documentation/10-product/visual-identity.md` before any component renders them, with a dated History line.
- **AC-A3 (PRD AC-12):** `listTasks` takes the filter and issues exactly one `GET /api/tasks` per filter change, with an empty filter producing the same request the screen makes today.
- **AC-A4 (PRD AC-11, PRD AC-13):** the chip row shows *Abertas · Para hoje · Alta prioridade* plus a trailing *Filtros…*; each chip's pressed state is derived from the filter, so pressing a chip and choosing the same value in the sheet are the same act and each surface reflects the other.
- **AC-A5 (PRD AC-15):** the filter sheet opens as a native `<dialog>` via `showModal()` carrying *Status*, *Prioridade* and *Período* (two native date inputs with visible *De* / *Até* labels), applies every change immediately with no *Aplicar* button, and offers *Limpar filtros*.
- **AC-A6 (PRD AC-15):** the filter sheet light-dismisses (`closedby="any"`), `Esc` and the Android back gesture close it, focus returns to the opener — and the detail sheet's behaviour is unchanged, because `lightDismiss` is opt-in and the editor never passes it.
- **AC-A7 (PRD AC-11):** layout standard §2.3 no longer prescribes *Com hora*; it prescribes *Para hoje*, with a dated in-place amendment and a History row naming what proved the old rule wrong.
- **AC-A8 (PRD AC-11, PRD AC-14):** the header carries a 48 px *Filtros* button whose accessible name names the active count, with a numeric badge when `activeCount > 0` and none at zero; and a filtered response with zero Tasks renders *Nenhuma tarefa com esse filtro.* with a *Limpar filtros* action that clears every dimension and restores the grouped list.
- **AC-A9 (PRD AC-16):** the filter state is held in React and persisted nowhere, so a reload restores no chip, no badge and no filter parameter; group collapse state, by contrast, still survives. The filter sheet can never be open at the same time as the detail sheet.
- **AC-A10 (PRD AC-17):** `npm test` and `npm run check` are green with the count at or above 349 and no test file edited, `npm run build` stays inside guidelines §11, and the phase record — including the Tier A / Tier B result — is filed under `PRPs/reports/today-view-and-filters/phase-3/`.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The chip row and the sheet drift into two states | M | H | Both derive from one `TaskFilter` via `isChipActive`; neither holds local selection state. AC-A4 states it and the browser pass checks the round trip |
| A filter silently survives a reload | M | H | The state is seeded from `EMPTY_FILTER` and written nowhere; Task 8's VALIDATE greps for any persistence of it, and Level 3 greps the module for storage APIs |
| Light dismiss leaks onto the detail sheet and drops an unsaved draft | L | H | The prop is opt-in and defaults false; Task 4 forbids touching anything else, and the browser pass re-checks the editor's Esc/close behaviour |
| A chip tap fires more than one request | M | M | AC-A3 states exactly one; the browser pass counts requests in the network panel |
| The badge reads as decoration rather than state | L | M | It is a number in text, never a bare dot — guidelines §4.4, stated in Task 7 |
| Two sheets open at once | L | M | The filter sheet's `open` is gated on `sheet.taskId === null`, the condition the toast slot already uses; layout standard §3 forbids stacking |
| The `closedby` attribute is not supported on the owner's Chrome | L | M | It degrades to the default (`closerequest`): the sheet still closes by Esc, back and the close button — only the tap-outside shortcut is missing. Verified on the device, not assumed |

## Notes

**TDD routing (this plan):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **Only AC-A1 is automatable, and that is the methodology working.** The
  decidable half — the chip vocabulary, the query string, the dimension count —
  is extracted to `src/shared/task-filter.ts` precisely so it can be tested
  without a DOM. AC-A4 through AC-A9 are glue: which chip looks pressed, whether a
  dialog light-dismisses, what a reload restores. They are verified in the browser
  pass and recorded, which is the `EXISTING_COVERAGE_SUFFICIENT` path.
- **The browser pass is a real step and it now has a working method.** Phase 2
  established it: the embedded pane keeps its own storage and sits at the token
  gate, so the pass runs in the owner's own Chrome, where a real screenshot is
  possible. This phase's pass must additionally check the round trip between chip
  and sheet, count network requests per chip tap, verify the reload restores
  nothing, and confirm the detail sheet still does NOT light-dismiss.
- **`resize_window` does not change the viewport in that Chrome** (phase 2
  measured it reporting success while `innerWidth` stayed 1920). The 375 px check
  is therefore a forced-column proxy, and must be labelled as one — never reported
  as a real viewport.
- **The Android back gesture is a device check, not a pane check.** `Sheet`'s own
  header comment records that the `history.pushState` fallback is specified but
  unbuilt; if the owner's device shows the back gesture failing to close the
  filter sheet, that fallback is the fix and it belongs in `Sheet`, not in a
  second implementation here.
- **No task edits a test file.** Task 9 only *runs* the suite, and
  `git diff --quiet -- test/` makes that a machine-checked claim.

*Generated: 2026-08-24*
*Approved: 2026-08-24*
*Implemented: 2026-08-24*
*Status: IMPLEMENTED*
