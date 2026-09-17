# Feature: The search route (Phase 2 of text-search)

```
**Decision Gate**
- Active context: none
- Activated criteria: modifies the client routing seam (`AppRoute`/`routeFromPath`/`pathOf` in src/shared/); adds a new SPA route and screen (interface change under docs/context/ui-guidelines.md — the UI/UX guidelines review checklist is mandatory); modifies the header component (TodayScreen/TodayHeader); reuses TaskFilter/TaskGroup/TaskSheet without introducing a second copy of filter or grouping state; cross-cutting documentation updates (documentation/ and docs/)
- Decisions found: ADR-0003 (thin client over a canonical server store — search stays online-only, and the offline banner must never present a stale result list as current, AC-A7); ADR-0009 (visible UI copy in pt-BR; identifiers/comments/tests stay English); unit-3's decision that `TaskFilter` in `src/shared/task-filter.ts` is the single source of truth for filter state (the search screen calls `listTasks({ ...EMPTY_FILTER, q })`, never a second filter struct); the layout standard's navigation model (owner decision 2026-08-20, model B — single screen + sheets: *Pesquisar* is a header icon opening a route, not a bottom-bar destination) and its unit-8 row ("The header search icon opens a search route with the field at the top", `documentation/40-engineering/ui-layout-standard.md:64`) and keyboard model (`/` focuses search, `Esc` closes, same document §5); the UI/UX guidelines' mandatory review checklist (`documentation/40-engineering/ui-ux-guidelines.md`) on every interface change; phase 1's already-complete `q` plumbing (`TaskFilter.q`, `toQuery`, `GET /api/tasks?q=`) that this phase consumes without changing; the phase-lifecycle back-fill convention (this agent writes only `in-progress` to row 2; `implemented`/`tested`/`complete` are written later by other components)
- Applicable anti-patterns: Hand-duplicated entity types (search results stay `TaskDto` via the existing `listTasks`/`toTaskDto` path — no new result type); Portuguese in artifacts (every new identifier, comment, prop and file name here is English; the pt-BR carve-out covers only the strings the owner reads on screen); Glossary synonym drift ("Task", never "item"/"resultado"); Offline write queue / offline search (search issues a real request every time — no local cache is ever presented as a live result, AC-A7); Weakening tests to force green (the test-file routing note below keeps the Implementer out of `test/app-route.test.ts` and `test/search.test.ts`, the two files this phase touches that carry automated coverage)
- Applicable architectural rules: one Worker serves everything (unaffected — this phase is 100% client-side); `src/shared/` stays DOM-free, clock-free and dependency-free (the `AppRoute` union and `routeFromPath`/`pathOf` additions in Task 1 add no `history`/`window` call — that glue stays in `src/app/hooks/useRoute.ts`, per `docs/context/methodology.md`'s "Browser-API work" split); `TaskFilter` is the single filter-state source of truth (no second filter type for search); UI verification stays manual (ADR-0008's scope carve-out — this phase produces no React component test file, consistent with every other screen in this codebase); PRPs artifact path convention (this plan and its back-fill stay under `PRPs/`)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/text-search.prd.md` — Implementation Phases row 2: "The
  search route" — Goal: the owner reaches any Task from the header in a
  few taps — Success signal: AC-12 verified on the Android phone and the
  Windows PC, the UI/UX checklist result recorded, and the whole suite
  green.

## Summary

Adds the client half of text search: a header *Pesquisar* icon (mirroring
the existing *Configurações* icon button) opens a new `search` `AppRoute`
— a full-screen route, not a sheet, per the layout standard's "long flows
are routes" rule — whose field is focused immediately. Typing debounces
(300 ms) before issuing `GET /api/tasks?q=…` through the already-shipped
`listTasks(filter, limit, signal)`, aborting any request a newer keystroke
supersedes; results render through the exact same `collectDayItems` /
`TaskGroup` / `TaskRow` grouping *Hoje* already uses, and tapping a result
opens the same `TaskSheet` component *Hoje* uses (as a dialog overlay on
top of the search route, so the query is preserved when the owner closes
it — resolving the PRD's own Open Question). `Esc` (desktop) and the
Android back gesture return to *Hoje* through the existing `useRoute`
`back()`; `/` on the PC opens search from *Hoje* when focus is not
already in a text field. Every state — the below-minimum-length prompt,
the no-match empty state (naming the query, in pt-BR), the offline
banner, and a failed-request message — is designed once here, matching
the shape `guidelines §8` already uses elsewhere in this app. No server
change: this phase consumes phase 1's `q` plumbing (`TaskFilter.q`,
`toQuery`, `GET /api/tasks?q=`) unmodified. Documentation updates close
out the two docs/ files phase 1 already kept current and the one
authoritative `documentation/` file phase 1 explicitly left for this
phase, plus a narrow, explicitly-scoped correction to the one API-contract
doc phase 1 left stale.

## User Story

As the owner, I want to tap a search icon, type a word or two, and see
every matching Task — open, done or missed — grouped the same way *Hoje*
already shows them, so that I can reach a Task I cannot place by date,
status or priority within a few seconds on my phone or PC.

## Problem Statement

The owner has no way to find a Task again except by scrolling *Hoje* or
narrowing it with the unit-3 filters — and a completed Task falls into
the collapsed *Concluídas* group where scrolling stops working as a
retrieval method. Phase 1 gave the server a `q` parameter that answers
this, but nothing in the client can reach it: there is no search icon,
no search route, and no UI at all that calls `GET /api/tasks?q=`. Phase 2
narrows the PRD's remaining scope to exactly that: the entry point, the
route, the debounced/abortable request, the reused grouping and sheet,
the keyboard model, and the pt-BR states — plus the documentation the
PRD's own Phase 2 Details name, and one doc phase 1 left stale.

## Solution Statement

Add a `search` variant to the existing `AppRoute` union (`src/shared/app-route.ts`),
following the exact shape of the existing flat-literal routes (`settings`,
`notifications`) rather than the parameterized `task/${string}` variant,
since the query text lives in local component state, not the URL. Wire a
new `SearchScreen` component into `App.tsx`'s existing route switch,
mirroring `SettingsScreen`'s route-shell shape (100dvh grid, back button,
`Escape`-listener calling the threaded `back()`). Add a `Pesquisar` icon
button to `TodayHeader`, mirroring the existing `Configurações` button
exactly, and thread a new `onOpenSearch` prop through `TodayScreen` from
`App.tsx`, alongside a new `/`-key listener on `TodayScreen` (ignoring
the keystroke when focus is already inside a text field, the same guard
GitHub's own `/`-focuses-search shortcut uses). Inside `SearchScreen`,
debounce the query (300 ms) into a second piece of state, and run one
`useEffect` per debounced value that builds an `AbortController`, calls
`listTasks({ ...EMPTY_FILTER, q: debounced }, undefined, controller.signal)`,
and aborts the controller in the effect's own cleanup — the same
debounce-plus-cancellation pattern used by every production search box
research turned up. Results feed the *same* `collectDayItems` call and
`TaskGroup`/`TaskRow` rendering block `TodayScreen` already uses, and a
tap opens the *same* `TaskSheet`, driven by a second `useReducer(reduceTaskSheet, …)`
instance scoped to this screen — a dialog overlay on top of the `search`
route, never a route change, which is what lets the query text survive
opening and closing a result (the PRD's own proposed answer to its Open
Question about that). `listTasks` gains one new optional third parameter,
`signal?: AbortSignal`, forwarded into the existing `request()` call's
`init` — `request()` already spreads `init` into `fetch()`, so no other
change is needed there.

## Metadata

| Field | Value |
|---|---|
| Type | Feature (client UI capability) |
| Complexity | Medium — one new route/screen reusing existing grouping and sheet components verbatim, plus one genuinely new technique for this codebase (debounce + `AbortController`), but no schema/server change and no new dependency |
| Systems Affected | Client SPA (`src/app/`, `src/shared/app-route.ts`, `src/shared/search.ts`); documentation (`documentation/50-planning/roadmap.md`, `docs/domain/areas/tasks.md`, `docs/context/architecture.md`, `docs/api-reference.md`) |
| Dependencies | Phase 1 (`Depends: 1` in the PRD's Implementation Phases row 2) — `complete`: `TaskFilter.q`, `toQuery`, `GET /api/tasks?q=` |
| Estimated Tasks | 10 |
| Source PRD line ref | `PRPs/prds/text-search.prd.md` lines 268, 281-292 (Implementation Phases row 2 + Phase 2 Details) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/shared/app-route.ts` | 1-65 | The exact `AppRoute` union shape, and the flat-literal (`settings`/`notifications`) vs. parameterized (`task/${string}`) distinction the new `search` variant must follow; the module's own doc comment explains why the glue (`history`, `postMessage`) stays out of this file |
| P0 | `src/app/App.tsx` | 22-108 | The route-switch shape a `search` branch joins, and the exact prop-threading convention (`onUnauthorized`, `back`, `navigate`) `SettingsScreen` already uses |
| P0 | `src/app/components/SettingsScreen.tsx` | 21-115 | The route-shell shape to mirror: the 100dvh grid, the back-button + wordmark header, the `Escape`-listener calling `back()`, and the connectivity banner slot |
| P0 | `src/app/components/TodayHeader.tsx` | 1-67 | The icon-button pattern (`variant="icon"`, `aria-label`, lucide icon) to mirror for the new *Pesquisar* button |
| P0 | `src/app/components/TodayScreen.tsx` | 131-256, 673-720, 774-1034 | The exact grouping (`collectDayItems`), row-rendering (`renderDayItems`) and `TaskSheet` wiring (`useReducer(reduceTaskSheet, …)`, `sheetTask`, `runSheet`) this phase reuses verbatim inside `SearchScreen` |
| P1 | `src/app/hooks/useRoute.ts` | 1-93 | `navigate`/`back`/`pathOf` glue the new route rides on unchanged; its own doc comment states the "no path literal in this file" rule, which the `search` branch must also respect |
| P1 | `src/shared/task-filter.ts` | 20-60 | Confirms `TaskFilter.q`/`EMPTY_FILTER.q`/`toQuery` are already in place (phase 1, uncommitted in this worktree) and shows the fixed-order `URLSearchParams` shape `SearchScreen` calls through unmodified |
| P1 | `src/app/api.ts` | 109-129 | `listTasks`'s current two-parameter signature and the `request()` call it is built on, which already spreads `init` into `fetch()` — the exact seam Task 2 extends with a `signal` parameter |
| P0 | `src/shared/search.ts` | 1-63 | Phase 1's already-shipped module and its pure/DOM-free/clock-free discipline (stated in its own header comment), extended by the new Task 6 with the `SEARCH_MIN_QUERY_LENGTH` constant and the `shouldSearch` predicate — the decidable half of AC-A2 |
| P2 | `src/app/components/EmptyState.tsx` | 1-39 | The two-branch, centred, pt-BR empty-state shape (title + one line of body + one action) `SearchScreen`'s own no-match state is modelled on, without reusing this component directly (its CTA focuses the capture field, which does not exist on this screen) |
| P2 | `src/app/hooks/useConnectivity.ts` | 1-53 | The exempt glue hook `SearchScreen` reuses unmodified for its own offline banner |
| P2 | `documentation/40-engineering/ui-layout-standard.md` | §1 (14-21), §2.1 (27), §5 (52), §6 (64) | The navigation model (single screen + sheets), the header icon-button budget, the desktop `/`-focuses-search / `Esc`-closes keyboard model, and the unit-8 row this phase implements |
| P2 | `documentation/40-engineering/ui-ux-guidelines.md` | Review checklist (146-168), §8 (75-91) | The mandatory Tier A/B checklist to run and record on this interface change, and the designed-once state shapes (empty, offline, request error) this phase's new states must match |
| P2 | `docs/context/methodology.md` | 1-36 | `tdd: true` for the automated-scope files this phase touches (`src/shared/app-route.ts`); confirms React components stay outside TDD scope (manual verification), per its own "Scope of the practice" section |

## Patterns to Mirror

```
# SOURCE: src/shared/app-route.ts:25-65
export type AppRoute =
  "today" | "settings" | "notifications" | "notifications-diagnostics" | `task/${string}`;

export function routeFromPath(pathname: string): AppRoute {
  const path = withoutTrailingSlash(pathname);
  const taskMatch = TASK_PATH_PATTERN.exec(path);
  if (taskMatch !== null) {
    const taskId = taskMatch[1];
    if (taskId !== undefined && taskId !== "") return taskRouteOf(taskId);
  }
  if (path === "/settings/notifications/diagnostics") return "notifications-diagnostics";
  if (path === "/settings/notifications") return "notifications";
  if (path === "/settings") return "settings";
  return "today";
}

export function pathOf(route: AppRoute): string {
  if (route.startsWith("task/")) return `/tasks/${taskIdFromRoute(route)}`;
  if (route === "notifications-diagnostics") return "/settings/notifications/diagnostics";
  if (route === "notifications") return "/settings/notifications";
  if (route === "settings") return "/settings";
  return "/";
}
```
Copies into: Task 1 (`search` joins the union as a flat literal exactly
like `settings`/`notifications`; `/search` <-> `"search"` is added as one
more `if` in each direction, above the final `return "today"`/`return "/"`
fallback).

```
# SOURCE: src/app/App.tsx:79-107
if (route === "settings") {
  return <SettingsScreen onUnauthorized={onUnauthorized} back={back} navigate={navigate} />;
}
...
return (
  <TodayScreen
    onUnauthorized={onUnauthorized}
    initialShare={initialShare}
    initialTaskId={taskIdFromRoute(route)}
    onOpenSettings={() => navigate("settings")}
  />
);
```
Copies into: Task 5 (a new `if (route === "search") return <SearchScreen ... />`
branch joins the others, before the `TodayScreen` fallthrough; `TodayScreen`
gains an `onOpenSearch={() => navigate("search")}` prop the same way it
already receives `onOpenSettings`).

```
# SOURCE: src/app/components/SettingsScreen.tsx:52-66
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") back();
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [back]);
```
Copies into: Task 7 (`SearchScreen`'s own `Escape`-listener, gated to skip
`back()` while the Task sheet is open — the sheet is a native `<dialog>`
and handles its own `Escape`/back-gesture close, so this listener must
not also navigate away underneath it).

```
# SOURCE: src/app/components/TodayHeader.tsx:35-64
<span className="relative">
  <Button type="button" variant="icon" aria-label={filterLabel} onClick={onOpenFilters}>
    <SlidersHorizontal className="size-[22px]" aria-hidden="true" />
  </Button>
  ...
</span>
<Button type="button" variant="icon" aria-label="Configurações" onClick={onOpenSettings}>
  <Settings className="size-[22px]" aria-hidden="true" />
</Button>
```
Copies into: Task 3 (a third `Button variant="icon"` with `aria-label="Pesquisar"`
and a `Search` lucide icon, calling a new `onOpenSearch` prop, placed
before the settings button per the layout standard's icon order — filters,
then search, then settings).

```
# SOURCE: src/app/components/TodayScreen.tsx:250-256
const groups = collectDayItems(
  [{ id: "tasks", items: (tasks ?? []).map(dayItemFromTask) }],
  today,
);
```
and
```
# SOURCE: src/app/components/TodayScreen.tsx:682-720
function renderDayItems(rows: DayItem[]): ReactNode {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((item) => {
        switch (item.source) {
          case "task": { /* TaskRow ... */ }
          case "google": throw new Error(...);
          default: return assertNeverDaySource(item);
        }
      })}
    </ul>
  );
}
```
Copies into: Task 7 (`SearchScreen` calls `collectDayItems` over its own
search results and reuses the identical `renderDayItems`-shaped switch
and `TaskGroup` wrapping, so grouping is pixel-for-pixel what *Hoje*
produces — AC-A4).

```
# SOURCE: src/app/components/TodayScreen.tsx:942-1001
<TaskSheet
  task={sheetTask}
  open={sheet.taskId !== null}
  ...
  onSave={saveSheet}
  ...
/>
```
Copies into: Task 7 (a second `useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE)`
instance and a second `<TaskSheet>` render, scoped to `SearchScreen`'s own
results array, with `runSheet`'s post-save refresh re-running the current
debounced search instead of `TodayScreen`'s full unfiltered `refresh()`).

```
# SOURCE: src/app/api.ts:118-128
export async function listTasks(
  filter: TaskFilter = EMPTY_FILTER,
  limit?: number,
): Promise<TaskDto[]> {
  const base = toQuery(filter);
  const query =
    limit === undefined ? base : `${base}${base === "" ? "?" : "&"}limit=${String(limit)}`;

  const body = await request<{ tasks: TaskDto[] }>(`/api/tasks${query}`);
  return body.tasks;
}
```
Copies into: Task 2 (a third parameter `signal?: AbortSignal` is added and
forwarded as `request<{ tasks: TaskDto[] }>(\`/api/tasks${query}\`, { signal })`
— `request()`'s own body at `src/app/api.ts:77-103` already does
`fetch(path, { ...init, headers })`, so no change is needed there).

```
# SOURCE: src/app/hooks/useConnectivity.ts:1-53 (hook) and src/app/components/TodayScreen.tsx:798-808 (usage)
{connectivity !== "online" ? (
  <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
) : (
  <div />
)}
```
Copies into: Task 7 (`SearchScreen` calls `useConnectivity()` the same
way and renders `Banner` in the same always-render-a-slot shape, with new
copy — see Task 7's own `**ACTION**` — since "cannot save" is not the
condition on this screen; search itself cannot run offline, per ADR-0003).

```
# SOURCE: src/shared/search.ts:56-63
export function normalizeSearchText(text: string): string {
  const lowered = text.toLowerCase();
  let result = "";
  for (const char of lowered) {
    result += DIACRITIC_MAP[char] ?? char;
  }
  return result;
}
```
Copies into: Task 6 (the new `shouldSearch` predicate — a single-argument,
pure, no-DOM function appended to this same module — mirrors this
function's discipline exactly: no clock, no dependency, a plain value in
and a plain value out).

The debounce-plus-`AbortController` technique itself has **no existing
in-repo precedent** — confirmed by `research-codebase` (no `AbortController`
or debounce utility anywhere under `src/app/` or `src/shared/`) and is the
one genuinely new piece of this phase; `research-web` confirms it as the
standard production pattern (debounce reduces request volume, the
`AbortController` in the effect's own cleanup cancels whatever the next
keystroke superseded).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/app-route.ts` | UPDATE | Add the `search` `AppRoute` variant and its `/search` <-> `"search"` mapping in `routeFromPath`/`pathOf` (AC-A1) |
| `src/app/api.ts` | UPDATE | `listTasks` gains an optional third `signal?: AbortSignal` parameter, forwarded into `request()`'s `init`, so `SearchScreen` can abort a superseded request (AC-A3) |
| `src/app/components/TodayHeader.tsx` | UPDATE | Add the *Pesquisar* icon button + `onOpenSearch` prop (AC-A1) |
| `src/app/components/TodayScreen.tsx` | UPDATE | Thread `onOpenSearch` to `TodayHeader`; add the `/`-focuses-search keydown listener, guarded against an active text field (AC-A1) |
| `src/app/App.tsx` | UPDATE | New `search` route branch rendering `SearchScreen`; thread `onOpenSearch={() => navigate("search")}` into `TodayScreen` (AC-A1, AC-A5) |
| `src/shared/search.ts` | UPDATE | Add `SEARCH_MIN_QUERY_LENGTH` and the pure `shouldSearch` predicate — the decidable half of AC-A2, extracted so the test pair can cover it (AC-A2) |
| `src/app/components/SearchScreen.tsx` | CREATE | The route shell, focused input, debounce + abort, grouped results, reused `TaskSheet`, and the pt-BR initial/no-match/offline/error states (AC-A1..AC-A7) |
| `documentation/50-planning/roadmap.md` | UPDATE | Unit 8 row + a new Delivery history entry recording phase 2's code delivery (documented in the PRD's own Phase 2 Details) |
| `docs/domain/areas/tasks.md` | UPDATE | Remove the stale "not yet built" clause for the search route UI now that this phase ships it |
| `docs/context/architecture.md` | UPDATE | Remove "the search route UI" from the "Not built yet" list |
| `docs/api-reference.md` | UPDATE | Document `q` on `GET /api/tasks` (missing since phase 1) and correct the stale unit-number reference for `text-search` — narrowly scoped, see Task 10 and the Risks table |

## NOT Building (Scope Limits)

- Search over Events or standalone Reminders — out of this PRD entirely.
- Relevance ranking, match highlighting, snippets, query operators, or
  typo tolerance/stemming — all still out (phase 1's own scope limits,
  unchanged).
- Search history, saved searches, or the query in the URL — the `search`
  route carries no query text of its own; the debounced value lives in
  component state only.
- Keeping the query across a **cold start** — resolved per the PRD's own
  proposed answer: never. Keeping it **for the session across opening and
  closing a result** falls out for free, because opening a Task's sheet
  is a dialog overlay on the `search` route, never a route change — see
  the Summary.
- Status/priority/date filter chips on the search screen itself — the
  screen always searches every status via `{ ...EMPTY_FILTER, q }`
  (mirroring AC-5's "no filter selected first"); the PRD's AC-12 does not
  ask for narrowing controls here, only for `q` to compose with those
  filters at the API layer, which phase 1 already proved.
- Per-group collapse/expand persistence on the search results screen —
  every group renders fully expanded (no `onToggle`, matching `TaskGroup`'s
  own "never collapsible" shape for *Hoje*'s own *Hoje* group); this is a
  deliberate simplification with no AC behind it, recorded here rather
  than silently decided.
- Renumbering `docs/api-reference.md`'s `data-export`/`push-channel-proven`/
  `reminders` rows — Task 10 corrects the contiguous block from
  `recurring-tasks` through the Phase-2 aggregate row (the exact span
  this phase's own `text-search` renumbering collides with — see Task 10),
  but stops there. **Scope note, corrected from an earlier draft of this
  plan:** a single-row fix (`text-search` alone) cannot leave the table
  internally consistent — it either collides with `recurring-tasks`'s
  stale number or, patched in isolation, merely relocates the same
  collision one row further down — so once phase 2 introduced the
  colliding row, fixing the whole contiguous block it collides with is
  the only way to leave the table correct. The three earlier rows stay
  untouched because they need a different, deeper fix (they have
  shipped, so "Not built yet" is the wrong category for them, not only
  the wrong number), which this phase does not attempt.
- Any schema, column, index or migration change — none needed; phase 1
  already proved AC-13's zero-schema-change claim.

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/app-route.ts — add the `search` route

**ACTION**: Add `"search"` to the `AppRoute` union (placed after
`"notifications-diagnostics"`, before the parameterized `` `task/${string}` ``
variant). In `routeFromPath`, add `if (path === "/search") return "search";`
above the final `return "today";`. In `pathOf`, add
`if (route === "search") return "/search";` above the final `return "/";`.
No other function in this file changes; `taskRouteOf`/`taskIdFromRoute`
are untouched. This is the route AC-A1 depends on existing before Task
3's icon button and Task 4's `/` shortcut can navigate to it.

**MIRROR**: `# SOURCE: src/shared/app-route.ts:25-65` (flat-literal route
shape, `routeFromPath`/`pathOf` if-ladder pattern).

**VALIDATE**:
```
npx vitest run test/app-route.test.ts
```
(The test-first suite the test pair extends with `search`/`/search` cases
before this task runs, per `tdd: true`. Must exit 0.)

### Task 2: UPDATE src/app/api.ts — listTasks accepts an AbortSignal

**ACTION**: Change `listTasks`'s signature to
`listTasks(filter: TaskFilter = EMPTY_FILTER, limit?: number, signal?: AbortSignal): Promise<TaskDto[]>`
and forward it into the existing `request()` call as
`request<{ tasks: TaskDto[] }>(\`/api/tasks${query}\`, { signal })`. No
change to `request()` itself — it already spreads `init` into `fetch()`.
This is the parameter AC-A3's abort-on-supersede behaviour calls in Task
7 — without it, a superseded request has nothing to abort.

**MIRROR**: `# SOURCE: src/app/api.ts:118-128` (the function being
extended) and `src/app/api.ts:77-103`'s own `request<T>()` body, which
already spreads `init` into `fetch(path, { ...init, headers })`.

**VALIDATE**:
```
npx tsc -b
```
(No dedicated test file exists for `src/app/api.ts` — consistent with
every other client-only glue module in this codebase, e.g. `useRoute.ts`,
`useConnectivity.ts` — so type-checking is the automated proof available
for this task; the actual abort behaviour is exercised by Task 7's usage
and confirmed manually per the Tier A/B checklist. Must exit 0.)

### Task 3: UPDATE src/app/components/TodayHeader.tsx — the Pesquisar icon

**ACTION**: Import `Search` from `lucide-react` alongside the existing
`Settings`/`SlidersHorizontal` imports. Add a new `onOpenSearch: () => void`
prop to `TodayHeader`'s props type, and render a third icon button —
`<Button type="button" variant="icon" aria-label="Pesquisar" onClick={onOpenSearch}><Search className="size-[22px]" aria-hidden="true" /></Button>`
— placed between the filters button and the settings button, matching
the layout standard's stated icon order (filters, then search, then
settings, `documentation/40-engineering/ui-layout-standard.md` §2.1) —
the tappable entry point AC-A1 requires.

**MIRROR**: `# SOURCE: src/app/components/TodayHeader.tsx:35-64` (the
existing icon-button shape and `aria-label` convention).

**VALIDATE**:
```
grep -q 'aria-label="Pesquisar"' src/app/components/TodayHeader.tsx
```
(The accessible label is this task's literal deliverable, per the plan
template's "effect over declaration" carve-out for text whose deliverable
IS the text; `npx tsc -b` at Level 1 additionally proves the new prop
threads correctly. Must exit 0.)

### Task 4: UPDATE src/app/components/TodayScreen.tsx — wire onOpenSearch + `/`

**ACTION**: Add an `onOpenSearch: () => void` prop to `TodayScreen`'s
props type and pass it straight through to `<TodayHeader onOpenSearch={onOpenSearch} .../>`.
Add one more `useEffect` (beside the existing `Escape`-free keydown
effects in this file) that listens for `keydown` on `window` and calls
`onOpenSearch()` when `event.key === "/"` **and** `document.activeElement`
is not an `<input>`, `<textarea>`, or an element with `isContentEditable`
— the same guard GitHub's own `/`-focuses-search shortcut uses, so typing
a literal `/` into the capture field or a Task title never navigates away.
Together with Task 3's icon, this is what makes AC-A1 reachable the two
ways the PRD's Architecture Notes name explicitly (icon tap or `/`).

**MIRROR**: `# SOURCE: src/app/components/SettingsScreen.tsx:52-66`
(the keydown-listener-in-a-`useEffect` shape, adapted from `Escape`+`back()`
to `/`+`onOpenSearch()` with the added activeElement guard).

**VALIDATE**:
```
npx tsc -b
```
(No dedicated test file exists for `TodayScreen.tsx`'s keyboard wiring —
manual Tier A verification confirms the actual keypress behaviour, per
`docs/context/methodology.md`'s UI-stays-manual scope. Must exit 0.)

### Task 5: UPDATE src/app/App.tsx — the search route branch

**ACTION**: Add `if (route === "search") return <SearchScreen onUnauthorized={onUnauthorized} back={back} />;`
alongside the existing `settings`/`notifications` branches, before the
`TodayScreen` fallthrough. Pass `onOpenSearch={() => navigate("search")}`
into the existing `<TodayScreen ... />` call. The new branch is what
AC-A1 opens into, and the `back` prop it threads to `SearchScreen` — the
same prop every other route screen already receives from this switch —
is what AC-A5's return-to-*Hoje* behaviour calls.

**MIRROR**: `# SOURCE: src/app/App.tsx:79-107` (the existing route-branch
and prop-threading shape).

**VALIDATE**:
```
npx tsc -b
```
(Proves the new branch and the new `onOpenSearch` prop type-check against
`SearchScreen`'s and `TodayScreen`'s own prop types from Tasks 3-4 and 7.
Must exit 0.)

### Task 6: UPDATE src/shared/search.ts — the AC-A2 search-trigger predicate

**ACTION**: Add two new exports to the existing `src/shared/search.ts`
(phase 1's module, already in this worktree): `export const
SEARCH_MIN_QUERY_LENGTH = 2;` and
`export function shouldSearch(raw: string): boolean { return raw.trim().length >= SEARCH_MIN_QUERY_LENGTH; }`.
This is the decidable half of AC-A2 ("typing fewer than 2 characters
fires no request") — `docs/context/methodology.md`'s "Browser-API work"
section requires decidable logic to be extracted into `src/shared`
before the glue that calls it (Task 7's `SearchScreen`) is allowed the
manual-verification exemption. `shouldSearch` is a pure, single-argument,
no-DOM, no-clock predicate, exactly like every other function in this
module.

**MIRROR**: `# SOURCE: src/shared/search.ts:56-63` (`normalizeSearchText`'s
pure, single-argument, no-DOM shape — the same discipline this module's
own header comment already states for every function in it).

**VALIDATE**:
```
npx vitest run test/search.test.ts
```
(The test pair extends the existing phase-1 suite with `shouldSearch`/
`SEARCH_MIN_QUERY_LENGTH` cases before this task runs, per `tdd: true` —
this plan states the exact exported names and signature above so the
test pair invents nothing. Must exit 0.)

### Task 7: CREATE src/app/components/SearchScreen.tsx — the search route

**ACTION**: Create the route shell, mirroring `SettingsScreen`'s shape
(100dvh grid, back button with `aria-label="Voltar"`, `Escape`-listener
calling `back()` — but gated with `if (sheet.taskId !== null) return;`
first, so the native `<dialog>`'s own `Escape` handling for an open
`TaskSheet` is never double-handled). In place of a page title, the
header's remaining width holds the search `<input type="text" autoFocus
placeholder="Pesquisar tarefas…" enterkeyhint="search">`, matching the
layout standard's "field at the top" wording (`documentation/40-engineering/ui-layout-standard.md:64`)
— one primary element, not a title plus a separate field.

State: `query` (raw input), `debounced` (query, delayed 300 ms via one
`useEffect`+`setTimeout`, `SEARCH_DEBOUNCE_MS = 300`), `results:
TaskDto[] | null`, `searchError: string | null`. A second `useEffect`,
keyed on `debounced`: imports `shouldSearch` from `../../shared/search`
(Task 6) and, when `!shouldSearch(debounced)`, clears `results`/
`searchError` and returns (no request — AC-A2); otherwise builds a fresh `AbortController`,
calls `listTasks({ ...EMPTY_FILTER, q: debounced }, undefined,
controller.signal)`, sets `results` on success, and on failure — after
checking `controller.signal.aborted` and returning silently if so, since
an aborted request is a superseded one, not a real failure — routes a
401 through the threaded `onUnauthorized`, else sets `searchError` from
`classifyRequestFailure(cause).message`; the effect's cleanup calls
`controller.abort()` (AC-A3).

Rendering: `useConnectivity()` + `Banner` in the same always-render-a-slot
shape as `SettingsScreen`, with new copy — `lead="Sem conexão."
body="Não é possível pesquisar sem conexão."` (distinct from *Hoje*'s
"...não para salvar..." text, per guidelines §12.3's rule that shared
copy applies only to the *same* condition on two screens; here the
condition differs — search cannot even read without the network, unlike
*Hoje*'s cached list). Below that: when `!shouldSearch(debounced)`, a
centred pt-BR prompt ("Digite pelo menos 2 letras para buscar."); else when `results === null` and no `searchError`,
a `Skeleton`; else when `searchError !== null`, the inline error + a
"Tentar de novo" retry button (mirrors `TodayScreen`'s own `loadError`
branch); else when `results.length === 0`, a centred pt-BR empty state
naming the query ("Nenhuma tarefa encontrada para “{debounced}”." — AC-A6);
else the grouped results via `collectDayItems([{ id: "tasks", items:
results.map(dayItemFromTask) }], today)` and the same `TaskGroup`
sections/`renderDayItems` switch `TodayScreen` uses, every group with no
`onToggle` (always expanded — see NOT Building). A tap on a row opens a
second `useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE)` instance's
`TaskSheet`, wired the same way `TodayScreen`'s is, whose post-save/-delete
refresh re-issues the current `debounced` search (not a full list fetch).

**MIRROR**: `# SOURCE: src/app/components/SettingsScreen.tsx:52-66`
(shell + `Escape` listener), `# SOURCE: src/app/components/TodayScreen.tsx:250-256`
and `:682-720` (grouping + row rendering), `# SOURCE: src/app/components/TodayScreen.tsx:942-1001`
(`TaskSheet` wiring), `# SOURCE: src/app/hooks/useConnectivity.ts:1-53`
+ `src/app/components/TodayScreen.tsx:798-808` (offline banner); the
`shouldSearch`/`SEARCH_MIN_QUERY_LENGTH` predicate consumed here is
Task 6's own deliverable, not re-derived in this component.

**VALIDATE**:
```
npx tsc -b
```
(No React component in this codebase carries a dedicated test file —
`docs/context/methodology.md`'s declared TDD scope excludes them by
design, matching `TodayHeader.tsx`, `SettingsScreen.tsx`, `useRoute.ts`
and every other file this plan's Mandatory Reading cites. Type-checking
plus Level 3's full bundle build are this task's automated proof; AC-A1
and AC-A3 through AC-A7 are confirmed by the Tier A/B checklist and the
owner's own device pass (AC-A12), per the same manual-verification
convention already governing every other screen in this app — AC-A2's
own decidable gate is instead proven by Task 6's `test/search.test.ts`
run, and this task's glue only renders the prompt `shouldSearch` already
decided. Must exit 0.)

### Task 8: UPDATE documentation/50-planning/roadmap.md — record the delivery

**ACTION**: In the unit 8 `text-search` row's `State` cell, append the
literal sentence `Phase 2 code delivered; device verification (AC-12)
and the UI/UX checklist recording remain owed before the unit can
close.` Prepend one new row to the `## Delivery history` table (dated the
day this task runs, newest-first per the table's own convention) whose
`Delivered` cell begins with the exact bold lead-in
`**Unit 8 phase 2 (the search route) — code delivered, device
verification and the UI/UX checklist still owed.**`, followed by a short
prose summary of what shipped (the header icon, the `search` route, the
debounce/abort technique, the reused grouping and sheet) — mirroring the
style of the existing 2026-09-15/2026-09-10 rows for units 7 and 8.

**MIRROR**: `# SOURCE: documentation/50-planning/roadmap.md:170-179`
(the existing Delivery history row shape and the "code delivered, X
remains owed" phrasing already used for units 6 and 7's phase closes).

**VALIDATE**:
```
if ! grep -q '\*\*Unit 8 phase 2 (the search route) — code delivered, device verification and the UI/UX checklist still owed\.\*\*' documentation/50-planning/roadmap.md; then
  echo "FAIL: Delivery history entry for unit 8 phase 2 not found"; exit 1
fi
if ! grep -q 'Phase 2 code delivered; device verification (AC-12) and the UI/UX checklist recording remain owed' documentation/50-planning/roadmap.md; then
  echo "FAIL: unit 8 row's State cell was not updated"; exit 1
fi
echo "PASS: roadmap.md records phase 2's delivery"
```
(Both greps must find the literal text Task 8's own `**ACTION**` requires;
either miss exits 1. Must exit 0.)

### Task 9: UPDATE docs/domain/areas/tasks.md and docs/context/architecture.md

**ACTION**: In `docs/domain/areas/tasks.md`, replace the sentence "The
search route (UI) is unit 8 phase 2, not yet built." with "The search
route (UI) — reached from the header's *Pesquisar* icon, results grouped
like *Hoje* — shipped in unit 8 phase 2." In `docs/context/architecture.md`'s
"Not built yet" sentence, remove the clause "the search route UI (FR-040
— the server-side `q` parameter on `GET /api/tasks` shipped in text-search
unit 8 phase 1, 2026-09-15; see `src/shared/search.ts` above)," entirely
(including its trailing comma), leaving the surrounding list
grammatically intact.

**Infrastructure note (no phase-2 AC applies):** No `AC-A<i>` in this
plan exercises documentation prose directly — AC-A1 through AC-A7 and
AC-A12 are all about the running app and the owner's device pass. This
task is documentation upkeep the PRD's own Phase 2 Details name
explicitly (`docs/domain/areas/tasks.md` "the search rule",
`docs/context/architecture.md` "FR-040 no longer 'not built yet'"). It is
consumed by no later task in this plan; it exists because the PRD text
requires it, not because an Acceptance Criterion exercises it.

**MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:53-118`'s own already-
shipped phase-1 precedent for how this project narrates a shipped
capability in these two files (n/a as code, but the two target sentences
already read exactly this way for phase 1's own server-side facts — see
Mandatory Reading).

**VALIDATE**:
```
if grep -q 'not yet built' docs/domain/areas/tasks.md; then
  echo "FAIL: stale not-yet-built clause remains in tasks.md"; exit 1
fi
if grep -q 'the search route UI' docs/context/architecture.md; then
  echo "FAIL: architecture.md still lists the search route UI as not built"; exit 1
fi
echo "PASS: both docs reflect the shipped search route UI"
```
(Must exit 0.)

### Task 10: UPDATE docs/api-reference.md — document q, fix the unit numbering block

**ACTION**: In the `Implemented` table's `GET /api/tasks` row, add
`&q=<text>` to the route's parameter list and extend its behaviour cell
with: "`q` (optional): every whitespace-separated word must occur, in any
order and anywhere, in the title or description, case- and
diacritic-insensitive, across every status; blank/whitespace-only or over
100 characters → 400 naming `q`."

In the `Not built yet` table, apply the following renumbering — the
exact old → new mapping, read off `documentation/50-planning/roadmap.md`'s
own Delivery units table (the authoritative source; do not infer):

| Row (`Surface to add` unchanged unless noted) | Old leading cell | New leading cell |
|---|---|---|
| `text-search` | `\| 7 \|` | `\| 8 \|` — also change `Surface to add` from "Text search over Tasks" to "The search route (UI) — the server-side `q` parameter shipped in phase 1" |
| `recurring-tasks` | `\| 8 \|` | `\| 9 \|` |
| `missed-sweep` | `\| 9 \|` | `\| 10 \|` |
| `adherence-mirror` | `\| 10 \|` | `\| 11 \|` |
| `repeated-miss-nudge` | `\| 11 \|` | `\| 12 \|` |
| `life-areas` | `\| 12 \|` | `\| 13 \|` |
| Phase-2 aggregate row | `13–17 (Phase 2)` | `14–18 (Phase 2)` |

This is a contiguous block, not a single row: `text-search`'s own correct
renumbering (7→8, unchanged from this task's original scope) collides
with `recurring-tasks`'s stale `8`, and every row after it inherits the
same drift by one — each must move by exactly one to stay unique and
correct, ending at the Phase-2 aggregate row, the table's last entry.
`documentation/50-planning/roadmap.md`'s own 2026-08-12 Delivery history
entry is the authority for *why* this drift exists: it records finding
"the authoritative traceability table still carried the pre-ADR-0007 unit
numbering" the day unit 2 opened — the same ADR-0007 insertion of
`google-calendar-read` as unit 4 (accepted 2026-08-04, before that, every
unit from `data-export` onward sat one lower) that this table's `Not
built yet` section was never swept for afterwards. **Deliberately
excluded from this task:** the `data-export`/`push-channel-proven`/
`reminders` rows (currently numbered 4/5/6, correctly 5/6/7) carry the
same numbering drift but ALSO a deeper content staleness — all three have
shipped, so "Not built yet" is the wrong category for them, not just the
wrong number — and fixing that is a distinct edit this task does not
attempt (see NOT Building and Risks).

**Infrastructure note (no phase-2 AC applies):** No `AC-A<i>` in this
plan exercises `docs/api-reference.md`'s prose either. This task
corrects a pre-existing documentation gap left over from phase 1 (the
`q` parameter was never added to this file) and the unit-numbering block
above — a decision this plan's own Summary and Risks table record, not
an Acceptance Criterion. It is consumed by no later task in this plan.

**MIRROR**: `# SOURCE: src/shared/task-filter.ts:47-54`'s own already-
correct phase-1 doc comment describing `q`'s fixed-order placement (the
prose this task's parameter description is grounded in, so the wording
matches what the code actually does rather than being invented).

**VALIDATE**:
```
if grep -q '| 8 | `recurring-tasks`' docs/api-reference.md; then
  echo "FAIL: recurring-tasks still numbered 8, colliding with text-search"; exit 1
fi
if [ "$(grep -c '^| 8 |' docs/api-reference.md)" -gt 1 ]; then
  echo "FAIL: duplicate unit-8 row survives in the Not built yet table"; exit 1
fi
if ! grep -q '| 9 | `recurring-tasks`' docs/api-reference.md; then
  echo "FAIL: recurring-tasks not renumbered to 9"; exit 1
fi
if ! grep -q '| 10 | `missed-sweep`' docs/api-reference.md; then
  echo "FAIL: missed-sweep not renumbered to 10"; exit 1
fi
if ! grep -q '| 11 | `adherence-mirror`' docs/api-reference.md; then
  echo "FAIL: adherence-mirror not renumbered to 11"; exit 1
fi
if ! grep -q '| 12 | `repeated-miss-nudge`' docs/api-reference.md; then
  echo "FAIL: repeated-miss-nudge not renumbered to 12"; exit 1
fi
if ! grep -q '| 13 | `life-areas`' docs/api-reference.md; then
  echo "FAIL: life-areas not renumbered to 13"; exit 1
fi
if grep -q '13–17 (Phase 2)' docs/api-reference.md; then
  echo "FAIL: stale 13-17 Phase 2 aggregate row remains"; exit 1
fi
if ! grep -q '14–18 (Phase 2)' docs/api-reference.md; then
  echo "FAIL: Phase 2 aggregate row not renumbered to 14-18"; exit 1
fi
if ! grep -q 'q=' docs/api-reference.md; then
  echo "FAIL: q parameter still undocumented in api-reference.md"; exit 1
fi
echo "PASS: api-reference.md documents q and the recurring-tasks..Phase-2 block renumbers cleanly, with no collision and no stale row"
```
(Must exit 0. This task deliberately does not touch the `data-export`/
`push-channel-proven`/`reminders` rows — see NOT Building and the Risks
table.)

## Validation Commands

### Level 1: STATIC_ANALYSIS
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` —
must exit 0.)

### Level 2: CONTENT_INVARIANTS
```
npx vitest run test/app-route.test.ts test/search.test.ts
```
(The two files this phase touches that carry automated coverage, per
`docs/context/methodology.md`'s declared TDD scope — React components
and client-only glue are manually verified, matching every other UI
phase in this codebase. Must exit 0.)

### Level 3: DRY-RUN END-TO-END
```
npm run build
```
(`tsc -b && vite build && node scripts/check-dev-token-absent.mjs` —
proves the whole Worker + client + service-worker bundle, including the
new route, screen, icon button and `listTasks` signature change, actually
compiles and bundles together. The Implementer runs this and the approved
`test/app-route.test.ts`/`test/search.test.ts` suites but authors no test
file — the test pair owns those files exclusively.)

## Acceptance Criteria

- **AC-A1 (PRD AC-12):** Tapping the header's *Pesquisar* icon, or
  pressing `/` on the PC while focus is not already inside a text field,
  opens the `search` route with the field focused.
- **AC-A2 (PRD AC-12):** Typing fewer than 2 characters fires no request
  and shows the pt-BR "type to search" prompt.
- **AC-A3 (PRD AC-12):** Typing 2 or more characters issues at most one
  request per 300 ms debounce window — never one per keystroke — and a
  request a newer keystroke supersedes is aborted via `AbortController`.
- **AC-A4 (PRD AC-12):** Matching Tasks — across every status, per phase
  1's `q` semantics — render grouped exactly as on *Hoje* (Atrasadas,
  Hoje, Próximas, Sem data, Concluídas).
- **AC-A5 (PRD AC-12):** Tapping a result opens that Task's existing
  `TaskSheet`; the Android back gesture or `Esc` (when no sheet is open)
  returns to *Hoje*, and the query text is still there if the owner had
  typed one.
- **AC-A6 (PRD AC-12):** A query with no match shows a pt-BR empty state
  naming the query.
- **AC-A7 (PRD AC-12):** Offline shows the connectivity banner and never
  presents a stale result list as current — search has no offline copy
  (ADR-0003).
- **AC-A12 (PRD AC-12 — owner's device pass, not a Step-by-Step Task):**
  verified on the owner's Android phone and Windows PC, with the UI/UX
  guidelines review checklist (Tier A now, Tier B once shipped) run and
  its ✔/✘ result recorded — the PRD's own Phase 2 success signal. This
  is performed by the owner, mirroring how every other device-proof step
  in this project's roadmap (units 5, 6, 7) is recorded as owed rather
  than authored as a plan task.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A request per keystroke, or a slow response overwriting a newer one, shows wrong results (named directly in the PRD's own Technical Risks table) | M | The owner sees stale or flickering results | 300 ms debounce plus `AbortController`-based cancellation of any superseded request (Task 7); verified in Tier B under throttled network per the UI/UX checklist |
| No automated test tier reaches this phase's React components or client-only glue (`api.ts`'s new parameter, `TodayHeader`/`TodayScreen`/`App.tsx` wiring, `SearchScreen` itself) | M | A regression in the wiring ships unnoticed | `npx tsc -b` on every task plus `npm run build` at Level 3 catch every type-level regression; the mandatory Tier A/B UI/UX checklist and the owner's own device pass (AC-A12) are this codebase's established substitute for component tests, matching every other shipped screen |
| The new `/`-focuses-search shortcut steals the keystroke while the owner is typing a literal `/` into the capture field or a Task title/description | M | Typing a fraction or a date abbreviation unexpectedly navigates away from what the owner was doing | The keydown listener (Task 4) ignores the keystroke whenever `document.activeElement` is an `<input>`/`<textarea>`/content-editable element — the same guard GitHub's own identical shortcut uses |
| `docs/api-reference.md`'s "Not built yet" table has a pre-existing off-by-one unit-numbering drift (from `google-calendar-read`'s unit-4 insertion, ADR-0007 — see `documentation/50-planning/roadmap.md`'s 2026-08-12 Delivery history entry) that a single-row `text-search` fix cannot leave consistent: it either collides with `recurring-tasks`'s stale number, or relocates the same collision further down the table | M — realized once already in this plan's own amendment history | A reader trusts a still-wrong row, or two rows claim the same unit number | Task 10 renumbers the whole contiguous block `recurring-tasks` through the Phase-2 aggregate row (the span the collision actually spans), with a VALIDATE that fails on either the old collision or a stale row; the `data-export`/`push-channel-proven`/`reminders` rows stay deliberately out of scope (see NOT Building) since they need a category fix, not just a number fix |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of
  `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering —
  the test pair (test-writer/test-reviewer) produces the initial test
  suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** `test/app-route.test.ts` and `test/search.test.ts`
  are the two files this phase touches that carry automated coverage;
  their `search`/`/search` and `shouldSearch`/`SEARCH_MIN_QUERY_LENGTH`
  cases are added by the `test-writer`/`test-reviewer` pair's lifecycle
  ledger before this plan's Tasks 1 and 6 run, and this plan's Implementer
  only RUNS those suites (`npx vitest run test/app-route.test.ts
  test/search.test.ts`), never edits either — R-X is a blanket
  straight-fail on any test glob in the Implementer's diff. No task above
  and no `## Files to Change` row targets a test file. Every other file
  in this phase is a React component or client-only glue module, which
  `docs/context/methodology.md`'s own "Scope of the practice" section
  places outside TDD — consistent with every other UI phase already
  shipped in this codebase (none of `TodayHeader.tsx`, `SettingsScreen.tsx`,
  `useRoute.ts` or `useConnectivity.ts` carries a test file either).
- **Resolved PRD Open Question — keeping the query across a returned
  result.** The PRD proposed "yes for the session, never across a cold
  start." This plan resolves it structurally rather than with extra
  state: opening a Task's sheet from the search results is a `<dialog>`
  overlay on top of the `search` route (Task 7), never a route change, so
  the query text is simply still in `SearchScreen`'s own component state
  when the sheet closes. Leaving the `search` route entirely (back/`Esc`
  to *Hoje*, or a cold start landing on `/`) unmounts `SearchScreen` and
  its state with it, which is the "never across a cold start" half.
- **Debounce (300 ms) and the 2-character minimum are starting values**,
  exactly as the PRD's own Open Questions flagged them — confirmed or
  adjusted on the owner's device as part of AC-A12, not treated as
  measured constants by this plan.
- `research-web` found no public disclosure of Todoist's/Things'/Google
  Tasks' actual debounce or minimum-character values (closed products,
  no engineering-blog coverage) — the 300 ms / 2-character starting
  values above come from Algolia's published autocomplete guidance (200
  ms ideal, >300 ms starts degrading) and the PRD's own AC-12 wording
  ("typing two or more characters"), not from a competitor's measured
  number.
- The debounce-plus-`AbortController` technique and the `/`-focuses-search
  keydown guard are genuinely new to this codebase (no existing
  precedent — see "Patterns to Mirror"); every other piece of this phase
  (route-shell shape, icon-button shape, grouping/sheet reuse, offline
  banner shape) mirrors an existing, cited pattern.

*Generated: 2026-09-16*
*Approved: 2026-09-16*
*Implemented: 2026-09-16*
*Status: IMPLEMENTED*
