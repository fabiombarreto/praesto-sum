# Feature: Grouping and the grouped list (Phase 2 of today-view-and-filters)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: reuse and creation of components (a group section joins
  `src/app/components/`); impact on shared UI (the one screen every later unit
  plugs into); a new pure module in `src/shared`; the phase that satisfies the
  unit's own exit signal; business rules for tasks (which Task belongs to which
  group)
- Decisions found:
  - Frozen Task read contract (unit 2, 2026-08-15) — ordering is produced by the
    API and must NOT be re-derived in a client. A partition preserves order by
    construction; this phase must prove that rather than assert it
  - Owner, 2026-08-23 (PRD Decisions Log) — grouping happens in the CLIENT as a
    pure stable partition; grouping is explicitly NOT an API concern
    (`docs/api-reference.md` was corrected the same day to say so)
  - Layout standard §2.5 — the group set, their order (*Atrasadas → Hoje →
    Próximas → Sem data*), the collapse defaults, and the rule that a count
    stays visible while its group is collapsed (the "my tasks vanished" trap)
  - Layout standard §2.7 / guidelines §8 — a per-group empty collapses to one
    line or is omitted; the whole-list empty keeps *Nada para hoje.*
  - ADR-0009 — visible copy in pt-BR; new strings enter
    `documentation/10-product/visual-identity.md` BEFORE they enter code
  - ADR-0010 / ADR-0011 — tokens only; owned components under
    `src/app/components/ui/`; 48 px hit areas
  - ADR-0008 — `tdd: true`; the partition is decidable and goes to `src/shared`
    test-first, the React glue is verified by hand
- Applicable anti-patterns:
  - Hand-duplicated entity types — the partition takes and returns `TaskDto`
  - Weakening tests to force green — phase 1's 20 filter tests and the 22
    contract tests stay untouched and green
  - Portuguese in artifacts — carve-out: the four group names are UI string
    values; the module, its keys and its tests stay English (`overdue`,
    `today`, `upcoming`, `undated`, `closed`)
  - Glossary synonym drift — overdue → *atrasada*, done → *concluída*
- Applicable architectural rules:
  - `src/shared` is DOM-free, dependency-free and clock-free: `groupTasks` takes
    `today` as an argument, exactly as `taskMetaLine` and `todayIn` already do
  - Decidable logic sits in `src/shared/`, not in components — the components
    are glue and the glue is verified by hand
    (`documentation/30-architecture/architecture-overview.md`, "Inside the PWA
    client")
  - One screen plus sheets; the `100dvh` grid shell and the list as its own
    scroll container are unchanged by this phase
  - Storage access is guarded — a denial or a missing API degrades to the
    default and never throws (the pattern already shipped for *Concluídas*)
- Result: PROCEED
```

## Source

- `PRPs/prds/today-view-and-filters.prd.md` — Implementation Phases row 2 (line
  277): "Grouping and the grouped list" — Goal: the screen answers "what is
  today?" in its first screenful, without a filter being touched — the unit's
  exit signal — Success signal (PRD Phase Details): Tier A ✔ on the change and
  Tier B ✔ for *Hoje* (375 px and 1280 px, contrast pairs recorded,
  empty/offline states simulated) filed under
  `PRPs/reports/today-view-and-filters/phase-2/`; the four buckets proved to be
  a stable partition by test; `npm test` and `npm run check` green.

## Summary

This is the phase the unit exists for. A pure `groupTasks(tasks, today)` in
`src/shared` walks the API-ordered array once and appends each open Task to one
of four buckets — overdue, today, upcoming, undated — with every closed Task
going to a fifth. It sorts nothing: a test asserts that concatenating the four
buckets reproduces the input's open Tasks in exactly the same relative order, so
the frozen contract's ordering guarantee is preserved by construction rather
than by good intentions. `TodayScreen` then renders those buckets as the four
sections layout standard §2.5 specifies, each with a count that stays visible
while collapsed, *Atrasadas* expanded and collapsible, *Hoje* with no collapse
control at all, *Próximas* and *Sem data* collapsed by default, every state
persisted per group, and an empty group omitted entirely rather than rendered as
an empty region.

## User Story

As the owner
I want the day's real work separated from everything else the moment the app
opens
So that I can answer "what is today?" from the first screenful — without
scrolling the whole list and without touching a filter.

## Problem Statement

The API has answered "what is urgent" since unit 2, and since phase 1 it also
answers "which subset". The screen still throws that structure away: it splits
the response into `open` and `closed` (`src/app/components/TodayScreen.tsx:84-85`)
and renders one undifferentiated column, so the owner reads every row and does
the date arithmetic himself. The four groups, their order and their collapse
behaviour have been specified since the design pass
(`documentation/40-engineering/ui-layout-standard.md` §2.5) and unbuilt since —
§6 of that document lists unit 3 against "this anatomy as is".

## Solution Statement

Split the work the way the architecture already splits it. The decidable half —
which Task belongs to which bucket, and the guarantee that bucketing does not
re-order — becomes `src/shared/task-groups.ts`, a pure module with no DOM, no
dependencies and no clock read, authored test-first. The presentational half
becomes one small `TaskGroup` component holding the 40 px header (name + count +
an optional collapse toggle) and the row list, reused four times by
`TodayScreen`, with `Concluídas` left exactly as it is. Collapse state is
persisted per group through the same guarded `localStorage` helpers that already
ship, generalized to take a key and a per-group default so *Atrasadas* can
default open while *Próximas* and *Sem data* default closed.

## Metadata

| Key | Value |
|---|---|
| Type | UI feature on an existing screen + one new pure module |
| Complexity | Medium — one new shared module, one new component, one screen restructured; no API change, no migration, no new dependency |
| Systems Affected | `src/shared/`, `src/app/components/`, the approved microcopy table |
| Dependencies | Phase 1 (`complete`). The filters it added are not consumed until phase 3 |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/today-view-and-filters.prd.md:277` (Implementation Phases row 2) |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| 1 | `src/app/components/TodayScreen.tsx` | 39-56, 84-85, 312-372 | The guarded storage helpers to generalize, the two-bucket split to replace, and the list region + *Concluídas* section whose shape the new groups mirror |
| 1 | `documentation/40-engineering/ui-layout-standard.md` | §2.5, §2.6, §2.7 | The group set, their order, the collapse defaults, the count-stays-visible rule, the row anatomy that must not change, and the empty-state rules |
| 1 | `src/shared/format.ts` | 1-40, 121-155 | The house shape for a pure module in `src/shared`: the module header stating why it is environment-agnostic, and `taskMetaLine(task, today)` taking the day as an argument |
| 2 | `src/shared/dates.ts` | 1-37 | `todayIn` and the reason a calendar day is compared as a string, never against a UTC timestamp |
| 2 | `src/app/components/TaskRow.tsx` | 1-60 | The row contract the groups wrap; its props are unchanged by this phase |
| 2 | `documentation/10-product/visual-identity.md` | 80-100 | The approved microcopy table the four group names must enter before they enter code |
| 3 | `PRPs/prds/today-view-and-filters.prd.md` | 109-145 | AC-7 through AC-10 and AC-17, the contract the test pair authors from |
| 3 | `docs/context/methodology.md` | 30-60 | Why only the partition is authored test-first and the component glue is verified by hand |

## Patterns to Mirror

```ts
# SOURCE: src/app/components/TodayScreen.tsx:40-56
const DONE_COLLAPSED_KEY = "praesto.today.doneCollapsed";

/** Guarded like the legacy token storage (`src/app/token-storage.ts`): a denial or a missing API degrades to the default, never throws. */
function readDoneCollapsed(): boolean {
  try {
    return window.localStorage.getItem(DONE_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDoneCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(DONE_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Best-effort — a denial or a missing API must never break the toggle.
  }
}
```

The exact degradation contract the generalized helpers must keep: a `try/catch`
around both reads and writes, falling back to the caller's default rather than
throwing. Note the read currently hard-codes `false` as its fallback — the
generalization is what lets *Próximas* and *Sem data* default to collapsed.

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:326-372
            {closed.length > 0 && (
              <section aria-label="Concluídas">
                <button
                  type="button"
                  aria-expanded={!doneCollapsed}
                  onClick={toggleDoneCollapsed}
                  className="flex min-h-12 w-full items-center gap-2 rounded-control text-left"
                >
                  {/* prettier-ignore */}
                  <h2 className="m-0 font-text text-t2 font-semibold text-ink">Concluídas</h2>
                  <span className="font-data text-t1 font-semibold text-muted tabular-nums">
                    {closed.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-auto size-4 transition-transform",
                      !doneCollapsed && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
```

The shipped group-section shape the new `TaskGroup` generalizes: a `<section>`
with an `aria-label`, a `<button>` carrying `aria-expanded`, an `<h2>` name, the
count in the mono/tabular face, and a rotating chevron. `Concluídas` keeps this
markup by using the same component — it is not a second implementation.

```ts
# SOURCE: src/shared/format.ts:1-20
/**
 * Decidable header and row copy — the pure formatting rules the header and
 * every Task row read from, extracted so they can be tested without a DOM
 * (PRD AC-5, AC-6; ADR-0009 pt-BR copy).
 *
 * Like `src/shared/dates.ts`, this module is compiled into BOTH the browser
 * and the Worker projects, so it stays environment-agnostic: no DOM globals,
 * no runtime dependencies, and no reads of the clock. `now` (formatHeaderDate)
 * and `today` (taskMetaLine) are always ARGUMENTS, never read from the clock
 * internally — that is what keeps every test below deterministic regardless
 * of when or where it runs.
 */
```

The module-header discipline `task-groups.ts` copies: state the environment
constraint and state that the day is an argument, because that is what makes the
tests deterministic.

```ts
# SOURCE: src/shared/format.ts:121-140
export function taskMetaLine(
  task: TaskDto,
  today: string,
): { text: string; overdue: boolean } | null {
  if (task.status === "missed") {
    return { text: "não concluída", overdue: true };
  }
  if (task.status === "done") {
    return null;
  }

  let phrase: { text: string; overdue: boolean } | null = null;
  if (task.deadline !== null) {
```

The status-before-dates precedence the partition must mirror: a Task's status is
read first, and only an `open` Task reaches the date comparison. That is why a
`done` Task with an overdue deadline belongs in `closed`, never in *Atrasadas*.

```ts
# SOURCE: src/worker/routes/tasks.ts:86-93
  const today = todayIn(new Date());
  const dueDate = sql`coalesce(${tasks.deadline}, ${tasks.scheduledDate})`;
  const urgencyBucket = sql`case
      when ${dueDate} is null then 3
      when ${dueDate} < ${today} then 0
      when ${dueDate} = ${today} then 1
      else 2
    end`;
```

The server-side bucket definition the client partition must agree with exactly:
undated last, then `< today`, `= today`, `> today`. The partition is a
re-expression of this same `CASE` over the same coalesced key — which is
precisely why concatenating the buckets reproduces the API's order.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/task-groups.ts` | CREATE | The pure partition and its bucket rule — the decidable half, authored test-first |
| `documentation/10-product/visual-identity.md` | UPDATE | The four group names are new visible copy; ADR-0009 requires them in the approved table before they enter code |
| `src/app/components/TaskGroup.tsx` | CREATE | The 40 px header + row list, used five times (four groups plus *Concluídas*) so the section markup exists once |
| `src/app/components/TodayScreen.tsx` | UPDATE | Render the buckets instead of the flat open list; generalize the storage helpers to a key + per-group default |

## NOT Building (Scope Limits)

- **The chip row, the filter sheet, the filter badge and the filtered empty state** — phase 3. This phase consumes no filter and issues no filtered request; `listTasks()` is called exactly as it is today.
- **A `missed` group.** Nothing produces `missed` rows until unit 10; they stay in *Concluídas* with the *não concluída* meta line.
- **The *Reagendar para hoje* header action** on *Atrasadas* (layout standard §2.5) — deferred by the PRD with its own Open Question.
- **Any change to the row** (`TaskRow`), the header, the capture deck, the detail sheet, the toast or the banner. The groups wrap existing rows; the row anatomy of §2.6 is untouched.
- **Any change to `Concluídas`' behaviour or its storage key.** It adopts the shared component, keeps its name, its position below the four groups, and its existing `praesto.today.doneCollapsed` preference.
- **Windowing or virtualisation.** `content-visibility: auto` stays the answer (guidelines §12.4); windowing waits for the "all Tasks" view.
- **The ≥ 840 px two-pane desktop** — deferred by the PRD with a named trigger.
- **Test files.** Under `tdd: true` the suite for AC-7 is authored by the test pair before the Implementer runs; no task below edits or creates a test file.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/task-groups.ts`

- **ACTION**: Create a pure module with no imports other than the `TaskDto` type
  from `./api`. Open with a module header in the register of
  `src/shared/format.ts:1-20`: state that the module is compiled into both
  targets so it carries no DOM globals, no runtime dependencies and no clock
  read; that `today` is always an ARGUMENT; and — the load-bearing sentence —
  that the function PARTITIONS the array it is given and never sorts it, because
  the order is the frozen read contract's guarantee and is produced by the API
  (`docs/api-reference.md`), so re-deriving it here would put the one thing every
  consumer must agree on in the one place they cannot share.
  Export `interface TaskGroups { overdue: TaskDto[]; today: TaskDto[]; upcoming: TaskDto[]; undated: TaskDto[]; closed: TaskDto[]; }`
  and `export function groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups`.
  Implement as a single pass in encounter order: for each Task, if
  `task.status !== "open"` push to `closed` and continue (status is read BEFORE
  the dates, mirroring `taskMetaLine`, so a `done` Task with an overdue deadline
  is closed rather than overdue); otherwise compute
  `const due = task.deadline ?? task.scheduledDate` and push to `undated` when
  it is `null`, to `overdue` when `due < today`, to `today` when `due === today`,
  and to `upcoming` otherwise. Compare the `YYYY-MM-DD` strings directly — they
  are zero-padded, so lexicographic order is chronological order, the same
  reasoning `taskMetaLine` records. Keys are English; the pt-BR names live in the
  component. Use `push` into four arrays rather than four `filter` passes, so
  "single pass, encounter order" is a property of the code and not a comment.
- **MIRROR**: `# SOURCE: src/shared/format.ts:1-20` (the module-header
  discipline), `# SOURCE: src/shared/format.ts:121-140` (status before dates) and
  `# SOURCE: src/worker/routes/tasks.ts:86-93` (the server bucket definition this
  must agree with).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function groupTasks' src/shared/task-groups.ts
  if grep -qE '\.(sort|reverse)\(' src/shared/task-groups.ts; then
    echo "FAIL: the partition must not sort or reverse"; exit 1
  fi
  if grep -qE '^import .*(react|window|document)' src/shared/task-groups.ts; then
    echo "FAIL: src/shared must stay DOM-free and dependency-free"; exit 1
  fi
  npx tsc -b
  npx vitest run --project worker
  ```
- Delivers AC-A1.

### Task 2: UPDATE `documentation/10-product/visual-identity.md`

- **ACTION**: Add one row to the approved microcopy table, immediately after the
  existing `| Section | **Concluídas** · count |` row, reading
  `| Group headers | **Atrasadas** · **Hoje** · **Próximas** · **Sem data** — each followed by its count |`.
  Add a dated line to that document's `## History` table recording that the four
  group names were added ahead of the code that uses them, naming this plan.
  Set the frontmatter `last_updated` to `2026-08-23`. Change no other row: the
  strings this phase reuses (*Concluídas*, *Nada para hoje.*, the row meta line)
  are already approved and are used verbatim. This task runs BEFORE Task 3 and
  Task 4 on purpose — ADR-0009's rule is that a new visible string enters the
  identity table first and the code second.
- **MIRROR**: `# SOURCE: documentation/10-product/visual-identity.md:80-100` —
  the approved microcopy table whose row shape and `**bold** · plain` convention
  the new row copies.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'Group headers' documentation/10-product/visual-identity.md
  grep -q 'Atrasadas' documentation/10-product/visual-identity.md
  grep -q 'last_updated: 2026-08-23' documentation/10-product/visual-identity.md
  npx vitest run --project docs
  ```
- Delivers AC-A2.

### Task 3: CREATE `src/app/components/TaskGroup.tsx`

- **ACTION**: Create one component that renders a group section, so the markup
  exists once and *Concluídas* stops being a bespoke copy of it. Props:
  `name: string`, `count: number`, `children: ReactNode`, and an optional
  collapse pair — `collapsed?: boolean` and `onToggle?: () => void`. When
  `onToggle` is undefined the header is NOT a button and carries no chevron and
  no `aria-expanded` (that is the *Hoje* case: layout standard §2.5 says it is
  never collapsible, so it must not present a control that does nothing); when
  `onToggle` is supplied the header is the `<button type="button">` of the
  shipped *Concluídas* markup with `aria-expanded={!collapsed}` and the rotating
  `ChevronDown`. In both cases the header is a `<section aria-label={name}>`
  containing an `<h2>` with the name and a `<span>` with the count in the
  mono/tabular face — **the count renders whether or not the group is
  collapsed**, which is the "my tasks vanished" rule of §2.5 and the single most
  load-bearing detail in this component. Render `children` only when not
  collapsed. Keep the header's hit area ≥ 48 px (`min-h-12`, as shipped) and take
  every colour, radius and type size from the existing token classes — introduce
  no literal. Do not render anything when `count === 0`; the caller decides, but
  a defensive early return keeps an empty section from ever reaching the DOM.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:326-372` — the
  shipped *Concluídas* section, whose markup, classes and chevron rotation this
  component generalizes verbatim.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'aria-expanded' src/app/components/TaskGroup.tsx
  grep -q 'min-h-12' src/app/components/TaskGroup.tsx
  if grep -qE '#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(' src/app/components/TaskGroup.tsx; then
    echo "FAIL: colour literal outside tokens.css (guidelines 3.5)"; exit 1
  fi
  if grep -q 'style={' src/app/components/TaskGroup.tsx; then
    echo "FAIL: inline style object (guidelines 12.2)"; exit 1
  fi
  npx tsc -b
  npx eslint src/app/components/TaskGroup.tsx
  ```
- Delivers AC-A3, AC-A4.

### Task 4: UPDATE `src/app/components/TodayScreen.tsx`

- **ACTION**: Replace the two-bucket split and the flat open list with the five
  groups; change nothing else about the screen — the shell grid, the header, the
  banner, the toast slot, the capture deck, the sheet wiring, the optimistic
  complete/reopen path and the refetch effects all stay exactly as they are.
  **(a) Generalize the storage helpers.** Replace `DONE_COLLAPSED_KEY` /
  `readDoneCollapsed` / `writeDoneCollapsed` with
  `readCollapsed(key: string, fallback: boolean): boolean` and
  `writeCollapsed(key: string, value: boolean): void`, keeping the `try/catch`
  degradation exactly as it is: a denial or a missing API returns `fallback` and
  a failed write is swallowed. Keep the literal string
  `"praesto.today.doneCollapsed"` as the *Concluídas* key so the owner's existing
  preference is not migrated or lost, and give the new groups
  `"praesto.today.collapsed.overdue"`, `"praesto.today.collapsed.upcoming"` and
  `"praesto.today.collapsed.undated"`.
  **(b) Group.** Replace `const open = ...` / `const closed = ...` with a single
  `const groups = groupTasks(tasks ?? [], today)`. Keep passing `open.length` to
  `TodayHeader` as `groups.today.length + groups.overdue.length + groups.upcoming.length + groups.undated.length`
  — the header's *N restantes* keeps its current meaning (every open Task),
  which PRD AC-11 fixes and this phase must not change.
  **(c) Render.** In the list region, render in this order: *Atrasadas*
  (collapsible, default expanded), *Hoje* (no collapse control at all),
  *Próximas* (collapsible, default collapsed), *Sem data* (collapsible, default
  collapsed), then *Concluídas* (collapsible, its existing default). Each is a
  `TaskGroup` whose children are the same `<ul>` of `TaskRow`s the screen renders
  today, with every prop unchanged. Skip any group whose array is empty so no
  empty header reaches the DOM. Keep the whole-list `EmptyState` for the
  `tasks.length === 0` case exactly as it is.
  **(d) State.** Hold one collapse boolean per collapsible group in `useState`
  seeded from `readCollapsed(<key>, <default>)`, and write through on toggle —
  the same shape `doneCollapsed` uses today, four times rather than once.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:40-56` (the guarded
  helpers being generalized) and
  `# SOURCE: src/app/components/TodayScreen.tsx:326-372` (the section being
  replaced by the component from Task 3).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'groupTasks' src/app/components/TodayScreen.tsx
  grep -q 'praesto.today.doneCollapsed' src/app/components/TodayScreen.tsx
  grep -q 'praesto.today.collapsed.overdue' src/app/components/TodayScreen.tsx
  if grep -q 'DONE_COLLAPSED_KEY' src/app/components/TodayScreen.tsx; then
    echo "FAIL: the single-purpose key constant should be gone after generalization"; exit 1
  fi
  npx tsc -b
  npx eslint src/app/components/TodayScreen.tsx
  npm test
  ```
- Delivers AC-A3, AC-A4, AC-A5.

### Task 5: RUN the full gate and the build budget

- **ACTION**: Run the whole suite, the check gate and a production build, and
  read three things rather than only the exit codes. First, that phase 1's 20
  filter tests and the 22 contract tests are still green and still unedited — a
  screen change must not have reached them. Second, that the total test count did
  not fall below 333. Third, that the `vite build` size report is still inside
  guidelines §11 (JS ≤ 170 KB gzip, CSS ≤ 30 KB gzip): this phase adds a
  component and a module, so the number should barely move, and a jump means
  something unintended was pulled into the bundle. Do not modify any test to make
  this pass.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:84-85` — the
  two-bucket split whose disappearance is what this gate is confirming, since
  every other behaviour of the screen is supposed to be untouched.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  git diff --quiet -- test/
  npm test
  npm run check
  npm run build
  ```
- Delivers AC-A6.

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
if grep -qE '\.(sort|reverse)\(' src/shared/task-groups.ts; then
  echo "FAIL: the partition must not sort or reverse"; exit 1
fi
grep -q 'praesto.today.doneCollapsed' src/app/components/TodayScreen.tsx
```

The last three are the structural half of AC-A1 and AC-A4: no test file was
touched at all, the partition never sorts (which is what keeps the API's order
intact), and the owner's existing *Concluídas* preference key survives the
generalization rather than being silently renamed. The behavioural halves are
asserted by the suite and by the browser-pane pass.

## Acceptance Criteria

- **AC-A1 (PRD AC-7):** `groupTasks(tasks, today)` in `src/shared/task-groups.ts` returns `{ overdue, today, upcoming, undated, closed }`; an open Task lands in `overdue` when `deadline ?? scheduledDate < today`, in `today` when equal, in `upcoming` when greater and in `undated` when both are null; every Task whose `status !== "open"` lands in `closed` regardless of its dates; and `[...overdue, ...today, ...upcoming, ...undated]` equals the input's open Tasks in exactly the same relative order — the partition never re-sorts. The module reads no clock, imports nothing at runtime and touches no DOM global.
- **AC-A2 (PRD AC-8):** the four group names exist in the approved microcopy table of `documentation/10-product/visual-identity.md` before any component renders them, with a dated History line recording the addition.
- **AC-A3 (PRD AC-8):** the screen renders the groups top to bottom as *Atrasadas → Hoje → Próximas → Sem data*, with *Concluídas* below them; each header is ≥ 40 px, carries its pt-BR name and its count, and the rows inside each group keep the order the API returned with the row anatomy of layout standard §2.6 unchanged.
- **AC-A4 (PRD AC-9):** *Atrasadas* is collapsible and expanded by default; *Hoje* has no collapse control at all; *Próximas* and *Sem data* are collapsed by default; every count stays visible while its group is collapsed; each group's state survives a reload, with `praesto.today.doneCollapsed` keeping its name and meaning for *Concluídas* and the new groups taking their own keys; and a `localStorage` denial degrades to the per-group default without throwing.
- **AC-A5 (PRD AC-10):** a group whose array is empty renders no header at all, and with zero Tasks the list region still shows *Nada para hoje. Bora capturar a primeira?* with the *Nova tarefa* CTA that focuses the capture field.
- **AC-A6 (PRD AC-17):** `npm test` and `npm run check` are green with the test count at or above 333 and no test file edited, `npm run build` stays inside guidelines §11, and the phase record — including the Tier A / Tier B checklist result — is filed under `PRPs/reports/today-view-and-filters/phase-2/`.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The partition quietly re-orders (e.g. someone "tidies" it into four `filter` passes with a sort) | M | H | AC-A1 asserts the concatenation identity by test; Level 3 additionally fails on any `.sort(`/`.reverse(` in the module |
| The *Concluídas* preference is lost when the helpers are generalized | M | M | Task 4(a) keeps the literal key; Task 4 and Level 3 both grep for it |
| *Hoje* is given a collapse control "for consistency" | M | M | Layout standard §2.5 forbids it; Task 3 makes it structural — no `onToggle`, no button, no chevron — and AC-A4 states it |
| A count disappears when its group collapses (the trap §2.5 names) | M | H | Task 3 renders the count outside the collapsed branch; the browser-pane pass checks it in the collapsed state |
| Four empty headers on a quiet day | M | L | Task 4(c) skips empty groups and Task 3 early-returns on `count === 0`; AC-A5 states it |
| The browser pane cannot composite frames, so no screenshot exists | H | L | Guidelines §12.6: measure the DOM and say so; the owner's device photos are the artefact when one is genuinely needed |

## Notes

**TDD routing (this plan):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **Only AC-A1 is automatable, and that is the methodology working rather than a
  gap.** `documentation/40-engineering/testing-strategy.md` keeps UI verification
  manual and there is no browser tier; `docs/context/methodology.md` answers that
  by requiring the decidable part to be extracted somewhere testable — which is
  exactly what `src/shared/task-groups.ts` is. AC-A3, AC-A4 and AC-A5 are the
  glue: which group is collapsed, what the DOM contains, whether a count is
  visible. They are verified in the browser pane against the review checklist and
  recorded, which is the `EXISTING_COVERAGE_SUFFICIENT` path, not a lapse.
- **The browser-pane pass is a real step of this phase, not an afterthought.**
  Guidelines §12.6 is explicit about what the pane can and cannot do: with no
  displayed frame there is no screenshot and no transition ever advances, but
  `getBoundingClientRect`, `getComputedStyle`, the accessibility-relevant DOM and
  real key presses all work. So the pass asserts geometry (header ≥ 40 px, hit
  areas ≥ 48 px, rows ≥ 64 px), the collapsed-state DOM (the count element still
  present, `aria-expanded="false"`, the row list absent), the group order in DOM
  order, and the empty-group omission — and it does NOT claim a screenshot.
  `:focus-visible` is only asserted after a REAL Tab keypress on the page, never
  after a programmatic `.focus()`, which reports `outline: none` and produces a
  false positive.
- **Why the client may partition without breaking the freeze.** The contract
  forbids re-deriving the ORDER. A stable partition preserves relative order
  inside each bucket and reproduces the whole ordering when concatenated in
  bucket order — which is why AC-A1's concatenation assertion is the honest test
  of the rule rather than a restatement of the implementation.
- **No task edits a test file.** Under `tdd: true` the pair authors AC-A1's suite
  before the Implementer runs, and R-X forbids the Implementer from touching test
  files. Task 5 only *runs* the suite, and `git diff --quiet -- test/` makes "no
  test file was touched at all" a machine-checked claim.

*Generated: 2026-08-23*
*Approved: 2026-08-23*
*Implemented: 2026-08-23*
*Status: IMPLEMENTED*
