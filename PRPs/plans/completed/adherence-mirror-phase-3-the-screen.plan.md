# Feature: The screen (Phase 3 of adherence-mirror)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test and implement stages consume); domain rules for tasks (Recurrence Series, `missed`, adherence); reuse or creation of components (a new screen, an entry card, two new pure modules in `src/shared`); impact on shared UI (the *Hoje* screen's vertical order, the settings screen, the route table); impact on the layout standard (a dated §2 amendment); the UI/UX review checklist gate (CLAUDE.md, mandatory on every `src/app/` change)
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: adherence history derives from real rows; missed-recording chosen so misses stay constantly visible (honest mirror, FR-011)
  - adherence-mirror PRD D-E (one plain-text line directly below the chip row, only for an active series with >= 2 misses in the window, tap opens the route, dated amendment to ui-layout-standard §2), D-F (the route lives at `/settings/adherence`), D-G (ended series listed last, never on the *Hoje* line), D-H (visible vocabulary is *não concluída*)
  - missed-sweep PRD D-G / D-H (*Não concluídas* is the home for `missed` rows until this view; no notification per miss)
  - ADR-0008 test-first, scoped to `src/shared` pure logic; React components verified manually
  - ADR-0009 visible copy pt-BR, everything else English; ADR-0010 / ADR-0011 identity and owned `src/app/components/ui/` components
  - ui-layout-standard §2.1 (never a ratio or progress bar in the header) and §6 (adherence is a settings-level route, surfaced on *Hoje* only by counts and plain text)
  - ui-ux-guidelines §12.3 (a string chosen by a function lives in `src/shared/*` and is tested in Portuguese) and §8 (a request error is inline and persistent; the screen never blanks)
- Applicable anti-patterns:
  - Glossary synonym drift: never "falha", "falhando", "pulada", "habit"; the shipped term is *não concluída*
  - Portuguese in artifacts: identifiers, comments, tests and docs stay English (only the string VALUES the owner reads are pt-BR)
  - Hand-duplicated entity types: the adherence wire types are imported from `src/shared/api.ts`, never redeclared
  - Weakening tests to force green; Editing accepted ADRs (none edited)
  - Writing pipeline artifacts under `.claude/` (all artifacts go under `PRPs/`)
  - Offline write queue (not approached; the screen is read-only)
- Applicable architectural rules:
  - `src/shared/` stays DOM-free, clock-free and dependency-free: the two new modules take their inputs as arguments
  - `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay unchanged by this phase
  - A failed adherence fetch on *Hoje* never blanks the Task list, agenda or Reminders and never goes through `report()` (the isolation the agenda and Reminders regions already keep)
  - One Worker serves everything; this phase adds no endpoint, no table, no migration
  - The UI/UX review checklist's result is recorded before the merge
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/adherence-mirror.prd.md` — Implementation Phases row 3: "The screen" — Goal: The owner sees which series is slipping without going to look, and its record in one tap. — Success signal: AC-15..AC-19 verified, the line's pure function tested; UI/UX checklist ✔/✘ recorded before the merge; AC-20 observed on the owner's device and recorded in Delivery history.

## Summary

Phases 1 and 2 put the adherence record on the wire (`GET /api/series/adherence`, `fetchAdherence`). This phase makes the owner able to see it: a new *Aderência* route at `/settings/adherence` reached from the settings screen, listing every series with *N de M feitas*, the current streak and the dates of its recent misses; and one plain-text line on *Hoje*, directly below the quick-filter chip row, that appears only when an active series has at least two misses in the 30-day window, names the top series and "+N" others, and opens the route. The decidable parts (show or hide, which text, the section split and the per-series copy) live in two new pure `src/shared` modules and are the test-first surface; the React glue (route, screen, entry card, the isolated fetch on *Hoje*) is verified manually. The phase also records the dated amendment to ui-layout-standard §2, the UI/UX checklist result, and the owner's device-proof record (AC-20, owner-observed, owed).

## User Story

As the owner of Praesto Sum, I want to open *Hoje* and see, in one plain line, which recurring commitment I keep not doing, and in one tap its full record, so that I can replan it or change my behavior.

## Problem Statement

Since unit 10, every occurrence of a recurring Task the owner does not do becomes a permanent `missed` row, shown alone, as one line in a collapsed *Não concluídas* group. Nothing adds them up per Recurrence Series, so a pattern ("I miss the gym every week") is invisible unless the owner counts by hand. The data and the endpoint exist (phases 1 and 2); what is missing is the surface. This phase narrows the PRD problem to that surface: the *Aderência* route and the *Hoje* line.

## Solution Statement

Two pure modules decide everything decidable: `src/shared/adherence-line.ts` (the *Hoje* line: show or not, and the text) and `src/shared/adherence-view.ts` (the route's three sections, and the per-series count/streak/miss-date copy). `src/shared/app-route.ts` gains the `adherence` route. A new `AdherenceScreen` (shell copied from `SettingsScreen`) loads `fetchAdherence`, shows a skeleton, an inline persistent error with a retry, or the sections. `SettingsScreen` gets a stateless entry card. `TodayScreen` gets an independent adherence state, fetched on mount and on `visibilitychange` exactly like the agenda and Reminders regions, rendered as one line inside the same grid cell as the chip row so that its absence reserves no space. Completion stays a count (*7 de 10 feitas*), never a percentage.

## Metadata

| Field | Value |
|-------|-------|
| Type | feature |
| phase_type | feature |
| Complexity | Medium |
| Systems Affected | `src/shared/` (two new pure modules, `app-route.ts`), `src/app/` (new `AdherenceScreen`, new `AdherenceEntryCard`, `SettingsScreen`, `App.tsx`, `TodayScreen`), `documentation/` and `docs/` (layout standard amendment, tasks domain area, architecture, roadmap) |
| Dependencies | Phase 2 (`fetchAdherence`, `AdherenceResponse`, `SeriesAdherenceDto`) and phase 1 (`RECENT_WINDOW_DAYS`) — both present in the worktree; no new package |
| Estimated Tasks | 10 |
| Source PRD | `PRPs/prds/adherence-mirror.prd.md`, Implementation Phases row 3; Phase Details "Phase 3: The screen" |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/adherence-mirror.prd.md` | 135-157, 287-300 | AC-15..AC-20 and decisions D-E..D-H this phase implements |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 75-103, 146-168 | §8 states (inline persistent error, empty, skeleton), §9 copy rules (pt-BR, zero special-cased, term table), and the review checklist this phase must run and record |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 23-36, 54-65, 67-73 | §2 anatomy the amendment extends, §6 unit 9-12 row, History table format |
| P0 | `.worktrees/adherence-mirror/src/shared/adherence.ts` | 25-45, 80-98 | `SeriesAdherence`, `RECENT_WINDOW_DAYS`, `rankAdherence` — the ordering the display comparator must agree with |
| P0 | `.worktrees/adherence-mirror/src/shared/api.ts` | 371-392 | `SeriesAdherenceDto` and `AdherenceResponse`, the only input types of the new modules |
| P0 | `.worktrees/adherence-mirror/src/app/components/TodayScreen.tsx` | 312-330, 732-753, 910-947 | The independent region fetch, the mount/visibility effects and the chip-row insertion point |
| P0 | `.worktrees/adherence-mirror/src/app/components/SettingsScreen.tsx` | 69-128 | The route-shell to copy and the card list the entry card joins |
| P1 | `.worktrees/adherence-mirror/src/shared/app-route.ts` | 25-72 | The route union and both mapping directions |
| P1 | `.worktrees/adherence-mirror/src/app/App.tsx` | 80-112 | The route switch and the `TodayScreen` props |
| P1 | `.worktrees/adherence-mirror/src/app/components/NotificationsEntryCard.tsx` | 18-36 | The stateless entry-card template |
| P1 | `.worktrees/adherence-mirror/src/shared/missed-sweep.ts` | 1-36 | The pure-module header and shape convention |
| P1 | `.worktrees/adherence-mirror/src/app/components/ui/Banner.tsx` | 15-36 | The offline banner slot the new screen reuses |
| P1 | `documentation/10-product/visual-identity.md` and `.worktrees/adherence-mirror/src/app/tokens.css` | all | Identity rules and the tokens the new UI may use (tokens only) |
| P2 | `.worktrees/adherence-mirror/src/app/api.ts` | 223-226 | `fetchAdherence`, read-only here (already shipped in phase 2) |

## Patterns to Mirror

```
# SOURCE: .worktrees/adherence-mirror/src/shared/missed-sweep.ts:1-11
/**
 * Pure planning of the missed sweep (unit 10, ADR-0006): ...
 *
 * It is clock-free and database-free: it compares only local `YYYY-MM-DD`
 * strings it is handed (`today` is the series' local day, supplied by the
 * caller), reads no ambient clock, and imports only its same-directory sibling
 * `./recurrence`, whose `nextOccurrence` it composes without changing.
 */
import { nextOccurrence, type RecurrenceRule } from "./recurrence";
```
Copied by Tasks 1 and 2 (module header: purity statement, sibling-only imports).

```
# SOURCE: .worktrees/adherence-mirror/src/shared/app-route.ts:25-31
export type AppRoute =
  | "today"
  | "settings"
  | "notifications"
  | "notifications-diagnostics"
  | "search"
  | `task/${string}`;
```
```
# SOURCE: .worktrees/adherence-mirror/src/shared/app-route.ts:58-61
  if (path === "/settings/notifications/diagnostics") return "notifications-diagnostics";
  if (path === "/settings/notifications") return "notifications";
  if (path === "/settings") return "settings";
  if (path === "/search") return "search";
```
Copied by Task 3 (most specific path first; `adherence` is checked before `/settings`).

```
# SOURCE: .worktrees/adherence-mirror/src/app/components/NotificationsEntryCard.tsx:25-35
    <section
      aria-label="Notificações"
      className="flex flex-col gap-4 rounded-card bg-surface-1 p-4"
    >
      <p className="m-0 font-text text-t2 text-muted">{STATUS_LABEL[view]}</p>
      <Button type="button" variant="primary" onClick={onOpenNotifications}>
        Abrir
      </Button>
    </section>
```
Copied by Task 4.

```
# SOURCE: .worktrees/adherence-mirror/src/app/components/SettingsScreen.tsx:69-93
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr] overflow-clip bg-bg"
    >
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        ...
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Configurações</h1>
      </header>
```
```
# SOURCE: .worktrees/adherence-mirror/src/app/components/SettingsScreen.tsx:62-67
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
```
Copied by Task 5 (shell, back button, `Esc` -> `back()`, title effect, the always-render-a-slot banner row).

```
# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:339-354
  async function refreshReminders(): Promise<ReminderDto[] | null> {
    try {
      const next = await listReminders();
      setReminders(next);
      return next;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return null;
      }
      // A failed Reminder fetch must not blank the Task list or the agenda —
      // the same isolation `refreshEvents` already keeps.
      setReminders(null);
      return null;
    }
  }
```
```
# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:732-753
  useEffect(() => {
    void refreshEvents();
    void refreshReminders();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void refresh();
      void refreshEvents();
      void refreshReminders();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
```
Copied by Task 7 (own state, 401 routes to the gate, any other failure sets the state to `null` and never calls `report()`).

```
# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:910-914,947-949
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_auto_1fr_auto_auto] overflow-clip bg-bg"
    >
...
      <FilterChips filter={filter} today={today} onToggleChip={handleToggleChip} />

      <main className="flex flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-2">
```
Copied by Task 7 (the grid template stays unchanged: the chip row and the line share ONE grid cell).

```
# SOURCE: .worktrees/adherence-mirror/src/app/App.tsx:95-97
  if (route === "search") {
    return <SearchScreen onUnauthorized={onUnauthorized} back={back} />;
  }
```
Copied by Task 6.

## Files to Change

Paths are relative to the worktree root (`C:/repos/assistente-pessoal/.worktrees/adherence-mirror/`) unless marked "artifact root" (`C:/repos/assistente-pessoal/`).

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/adherence-line.ts` | CREATE | Pure decision of the *Hoje* line (threshold, active-only, top series, "+N", text) and the display ordering shared with the route |
| `src/shared/adherence-view.ts` | CREATE | Pure sections split and per-series copy (*N de M feitas*, streak, miss dates) for the *Aderência* route |
| `src/shared/app-route.ts` | UPDATE | New `adherence` route at `/settings/adherence` in the union, `routeFromPath` and `pathOf` |
| `src/app/components/AdherenceEntryCard.tsx` | CREATE | Stateless settings entry into the route |
| `src/app/components/SettingsScreen.tsx` | UPDATE | Render the entry card; navigate to `adherence` |
| `src/app/components/AdherenceScreen.tsx` | CREATE | The *Aderência* route screen with loading, inline persistent error + retry, empty and ready states |
| `src/app/App.tsx` | UPDATE | Route branch for `adherence`; thread `onOpenAdherence` to `TodayScreen` |
| `src/app/components/TodayScreen.tsx` | UPDATE | Independent adherence fetch and the one-line region below the chip row |
| `documentation/40-engineering/ui-layout-standard.md` | UPDATE | Dated §2 amendment (new slot below the chip row), §6 row, History row |
| `docs/domain/areas/tasks.md`, `docs/context/architecture.md`, `documentation/30-architecture/architecture-overview.md`, `documentation/50-planning/roadmap.md` | UPDATE | Maintenance-map updates: adherence surface in the tasks area, the new modules and screen in the architecture listing, the roadmap Delivery history |
| `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` (artifact root) | CREATE | The UI/UX review checklist's recorded ✔/✘ result |
| `PRPs/reports/adherence-mirror/phase-3/device-proof.md` (artifact root) | CREATE | The owner's AC-20 procedure, left OWED |

No test file appears in this table: the tests for the two new modules and the `app-route` additions are authored and updated by the `test-writer`/`test-reviewer` pair (see Notes).

## NOT Building (Scope Limits)

- Any notification about misses — unit 12 owns it.
- Percentages, charts, progress bars, heatmaps, any ratio (layout standard §2.1/§6).
- Longest streak, streak shields or freezes, decaying scores.
- Editing, undoing or excusing a miss; any write from this screen (it is read-only).
- A new endpoint, table, index or migration; any change to `src/shared/recurrence.ts` or `src/shared/adherence.ts`.
- An adherence block inside an occurrence's series sheet (a Could item the PRD defers).
- A toast, banner or any visible error on *Hoje* when the adherence fetch fails (AC-17: the line is simply absent).
- Component tests: React components are verified manually per `docs/context/methodology.md`; only the pure functions get tests.
- Observing AC-20 on the owner's device: it is owner-observed and cannot be completed by the Implementer (see Task 10).

## Step-by-Step Tasks

Every `VALIDATE` command runs from the worktree root unless it says otherwise.

### Task 1: CREATE src/shared/adherence-line.ts

- **ACTION**: Create the pure module that decides the *Hoje* line, delivering AC-A1 and AC-A2 and the vocabulary of AC-A5. Start with the module header of the Patterns-to-Mirror `missed-sweep.ts` snippet (clock-free, DOM-free, imports only siblings: `./api` for the types and `./adherence` for `RECENT_WINDOW_DAYS`). Export: `ADHERENCE_LINE_MIN_MISSES = 2`; `UNTITLED_SERIES_LABEL = "Sem título"`; `seriesDisplayTitle(series)` returning the title or `UNTITLED_SERIES_LABEL` when it is the empty string; `orderByMisses(series: SeriesAdherenceDto[]): SeriesAdherenceDto[]` — the active series that have at least one recent miss, ordered by recent-miss count descending, then newest miss descending, then title ascending using `localeCompare(b, "pt-BR")` (the collation the code-review advisory asks for; it differs from the server `ranking` only on title ties), then `seriesId` ascending — and `decideAdherenceLine(response: AdherenceResponse): { text: string; seriesId: string } | null`. `decideAdherenceLine` returns `null` unless at least one `active` series has `recentMisses.length >= ADHERENCE_LINE_MIN_MISSES` (an `ended` series never qualifies, even when it would rank first). Otherwise it takes the first qualifying series in `orderByMisses` order and returns its id and the text `<title> · <n> não concluídas em <RECENT_WINDOW_DAYS> dias`, followed by ` · +<k> séries` when `k` other qualifying active series exist (`+1 série` when `k` is 1). The literal `não concluídas em` is the exact wording the VALIDATE below searches for. Never write "falha", "falhando" or "pulada". Do not read `response.ranking`; the order is recomputed so the line and the route always agree.
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/shared/missed-sweep.ts:1-11` (module header and sibling-only imports).
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q 'não concluídas em' src/shared/adherence-line.ts
  if grep -nE '^import ' src/shared/adherence-line.ts | grep -vqE 'from "\./(api|adherence)"'; then echo "FAIL: non-sibling import in adherence-line.ts"; exit 1; else echo "PASS: only sibling imports"; fi
  if grep -niE 'falha|falhando|pulada' src/shared/adherence-line.ts; then echo "FAIL: forbidden vocabulary"; exit 1; else echo "PASS: vocabulary clean"; fi
  ```

### Task 2: CREATE src/shared/adherence-view.ts

- **ACTION**: Create the pure module behind the route's content, delivering AC-A4 and the copy rules of AC-A5. Same header convention; imports only `./api` types and `./adherence-line` (for `orderByMisses`, `seriesDisplayTitle`). Export `adherenceSections(response: AdherenceResponse): { missed: SeriesAdherenceDto[]; otherActive: SeriesAdherenceDto[]; ended: SeriesAdherenceDto[] }`: `missed` is `orderByMisses(response.series)` (active series with misses in the window, in ranking order); `otherActive` is the remaining `active` series ordered by title with `localeCompare(b, "pt-BR")` then `seriesId`; `ended` is every `ended` series (including ones with misses, per PRD D-G) in the same title order. Export `formatDoneOfClosed(done, closed): string` returning `<done> de <closed> feitas` (and `Nenhuma ocorrência concluída ainda` when `closed` is 0 — zero special-cased, no division, no percentage); `formatStreak(currentStreak): string` (`Sequência atual: <n>` for n >= 1, `Sem sequência` for 0); `formatMissDates(recentMisses: string[]): string` returning `Não concluída em 20/10, 01/10` for one or more dates (plural `Não concluídas em ...` for two or more, dates in the given newest-first order, each formatted `dd/mm` from the `YYYY-MM-DD` string without reading a clock) and `Nenhuma não concluída em 30 dias` for none. Never emit a percentage sign, "falha", "falhando" or "pulada".
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/shared/missed-sweep.ts:1-11`.
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q 'feitas' src/shared/adherence-view.ts
  if grep -nE '^import ' src/shared/adherence-view.ts | grep -vqE 'from "\./(api|adherence-line)"'; then echo "FAIL: non-sibling import in adherence-view.ts"; exit 1; else echo "PASS: only sibling imports"; fi
  if grep -nE '[0-9] ?%|progressbar|<progress|falha|falhando|pulada' src/shared/adherence-view.ts; then echo "FAIL: ratio or forbidden vocabulary"; exit 1; else echo "PASS: no ratio, vocabulary clean"; fi
  ```

### Task 3: UPDATE src/shared/app-route.ts

- **ACTION**: Add the `"adherence"` member to `AppRoute`; in `routeFromPath` add `if (path === "/settings/adherence") return "adherence";` BEFORE the `/settings` check (trailing slash is already stripped); in `pathOf` add `if (route === "adherence") return "/settings/adherence";`. Delivers AC-A4 (the route is reachable by path and by `navigate`). Update the module comment only if it enumerates the routes. Do not touch any test file: `test/app-route.test.ts` gets its additive assertions from the test pair.
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/shared/app-route.ts:58-61`.
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q '"/settings/adherence"' src/shared/app-route.ts
  grep -q '"adherence"' src/shared/app-route.ts
  ```

### Task 4: CREATE AdherenceEntryCard.tsx and UPDATE SettingsScreen.tsx

- **ACTION**: Create `src/app/components/AdherenceEntryCard.tsx`, a stateless card copying `NotificationsEntryCard`: `<section aria-label="Aderência">` with one muted line (`Veja quais tarefas repetidas você não concluiu.`) and a primary `Abrir` button calling `onOpenAdherence`. In `SettingsScreen.tsx` render it in `<main>` after `NotificationsEntryCard`, wired to `navigate("adherence")`. Delivers AC-A4 (the settings entry). Tokens only, no new literal, 48 px button from the owned `Button`. Copy is pt-BR sentence case, infinitive button.
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/app/components/NotificationsEntryCard.tsx:25-35`.
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q 'navigate("adherence")' src/app/components/SettingsScreen.tsx
  grep -q 'aria-label="Aderência"' src/app/components/AdherenceEntryCard.tsx
  ```

### Task 5: CREATE src/app/components/AdherenceScreen.tsx

- **ACTION**: Create the route screen, delivering AC-A3 (its half: the route's inline persistent error), AC-A4 and AC-A5. Props `{ onUnauthorized, back }`. Copy the `SettingsScreen` shell (`data-shell` 100dvh grid, header with `Voltar` icon button, `<h1>` *Aderência*, `Esc` -> `back()`, `document.title = "Aderência · Praesto Sum"`, always-render-a-slot offline `Banner` row using `useConnectivity`). Load with `fetchAdherence()` on mount and again on `visibilitychange` to visible; hold a local state of `loading | ready | failed`. `loading` renders the owned `Skeleton`; `failed` renders the message from `classifyRequestFailure` inline and persistently (role `alert`, no toast) with a *Tentar de novo* button, a 401 calls `onUnauthorized()`; `ready` renders three labelled sections from `adherenceSections` — *Com não concluídas nos últimos 30 dias*, *Outras séries ativas*, *Séries encerradas* (a section with no series is omitted) — as `<ul>` lists whose rows show `seriesDisplayTitle`, `formatDoneOfClosed`, `formatStreak` and `formatMissDates`, all from `src/shared/adherence-view.ts` (no copy of those strings in the component). An empty response renders one plain line (`Nenhuma tarefa repetida ainda.`) inside the main region, never a blank region. No percentage, chart or progress bar; no fetch to another origin; tokens only; meaning never by colour alone.
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/app/components/SettingsScreen.tsx:69-93` and `# SOURCE: .worktrees/adherence-mirror/src/app/components/SettingsScreen.tsx:62-67`.
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q 'fetchAdherence' src/app/components/AdherenceScreen.tsx
  grep -q 'adherenceSections' src/app/components/AdherenceScreen.tsx
  grep -q 'Tentar de novo' src/app/components/AdherenceScreen.tsx
  if grep -nE '[0-9] ?%|progressbar|<progress|falha|falhando|pulada' src/app/components/AdherenceScreen.tsx src/app/components/AdherenceEntryCard.tsx; then echo "FAIL: ratio or forbidden vocabulary in a new component"; exit 1; else echo "PASS: no ratio, vocabulary clean"; fi
  ```

### Task 6: UPDATE src/app/App.tsx

- **ACTION**: Import `AdherenceScreen`; add `if (route === "adherence") { return <AdherenceScreen onUnauthorized={onUnauthorized} back={back} />; }` beside the `search` branch, before the `TodayScreen` fallthrough; pass `onOpenAdherence={() => navigate("adherence")}` to `TodayScreen`. Delivers AC-A4 (reachable from the *Hoje* line and by deep link) and is the wiring half of AC-A1.
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/app/App.tsx:95-97`.
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q 'route === "adherence"' src/app/App.tsx
  grep -q 'onOpenAdherence' src/app/App.tsx
  ```

### Task 7: UPDATE src/app/components/TodayScreen.tsx

- **ACTION**: Delivers AC-A1, AC-A2 and AC-A3. Add a required `onOpenAdherence: () => void` prop. Add its own state `const [adherence, setAdherence] = useState<AdherenceResponse | null>(null)`, never folded into `tasks`, `loadError`, `busy` or the agenda state. Add `refreshAdherence()` copying `refreshReminders`: success sets the state; a 401 calls `onUnauthorized()`; any other failure sets the state to `null` and shows nothing — no `report()`, no toast, no banner, no error state. Call it from the mount-only effect and from `handleVisibilityChange`, beside `refreshReminders()`. Compute `const adherenceLine = adherence === null ? null : decideAdherenceLine(adherence)`. Render the line in the SAME grid cell as the chip row: wrap `<FilterChips ... />` and the line in one `<div>` so the shell's `grid-rows-[auto_auto_auto_1fr_auto_auto]` template is unchanged; when `adherenceLine` is `null` render nothing at all for it (no placeholder, no empty element, no reserved space). When present, render one `<button type="button">` with `onClick={onOpenAdherence}`, `min-h-12` (48 px target), full width, left-aligned plain muted text (`font-text text-t2 text-muted`, tokens only, no relief, no ratio, no icon-only control) whose content is `adherenceLine.text`. Do not change `refresh`, the connectivity reducer or any existing region.
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:339-354` and `# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:732-753` and `# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:910-914,947-949`.
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  grep -q 'decideAdherenceLine' src/app/components/TodayScreen.tsx
  grep -q 'refreshAdherence' src/app/components/TodayScreen.tsx
  grep -q 'grid-rows-\[auto_auto_auto_1fr_auto_auto\]' src/app/components/TodayScreen.tsx
  if sed -n '/async function refreshAdherence/,/^  }/p' src/app/components/TodayScreen.tsx | grep -q 'report('; then echo "FAIL: adherence fetch must not feed the connectivity reducer"; exit 1; else echo "PASS: fetch isolated from connectivity"; fi
  ```

### Task 8: UPDATE documentation/40-engineering/ui-layout-standard.md

- **ACTION**: Edit the worktree copy (run from the worktree root). Add a dated amendment, `2026-10-04`, delivering AC-A1/AC-A2/AC-A5's documentation half: in §2 add, between item 3 (chip row) and item 4 (agenda stack), a new item *Adherence line* — one plain-text line directly below the chip row, present only when an active series has at least two misses in the 30-day window, names the top series and "+N", opens `/settings/adherence`, absent with no placeholder and no reserved space otherwise; never a ratio or a progress bar (§2.1 unchanged). Amend §6's unit 9-12 row to name the route `/settings/adherence` and the line. Add a History row dated 2026-10-04 (newest first, matching the table's format) citing `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md`, and bump the front-matter `last_updated`. Edit the existing text in place; do not renumber other rules in a way that breaks an existing cross-reference (§2 items are referenced elsewhere as "§2.3", "§2.5": insert the new rule as an unnumbered-in-sequence addition or number it 3.5 so no existing item moves).
- **MIRROR**: `# SOURCE: .worktrees/adherence-mirror/src/app/components/TodayScreen.tsx:910-914,947-949` (the anatomy the amendment describes) — the doc's own History table rows at `documentation/40-engineering/ui-layout-standard.md:69-80` are the format to follow.
- **VALIDATE**:
  ```
  set -euo pipefail
  grep -q '/settings/adherence' documentation/40-engineering/ui-layout-standard.md
  grep -q '2026-10-04' documentation/40-engineering/ui-layout-standard.md
  ```

### Task 9: UPDATE docs/domain/areas/tasks.md, docs/context/architecture.md, documentation/30-architecture/architecture-overview.md, documentation/50-planning/roadmap.md

- **ACTION**: Edit the worktree copies (run from the worktree root). Infrastructure/documentation task satisfying the Definition of Done named in CLAUDE.md; it delivers no behavioral criterion of its own, supporting AC-A5's traceability. Read `documentation/README.md`'s maintenance map first and touch only what it assigns. (1) `docs/domain/areas/tasks.md`: add one sentence to the `missed` business rule that the per-series record is surfaced by the *Aderência* route and the *Hoje* line (counts and plain text, never a ratio). (2) `docs/context/architecture.md`: list `adherence.ts`, `adherence-line.ts`, `adherence-view.ts` in the `src/shared/` row, and `AdherenceScreen`/`AdherenceEntryCard` and the `adherence` route in the `src/app/` row; mirror the same listing in `documentation/30-architecture/architecture-overview.md` if it carries the same table. (3) `documentation/50-planning/roadmap.md`: record unit 11 phase 3 in the Delivery history as delivered in code with AC-20 OWED to the owner; do NOT mark the unit `shipped` and do NOT write an AC-20 observation that did not happen. Do not edit any accepted ADR. Visible-copy examples in docs may quote pt-BR; all prose stays English.
- **MIRROR**: none from Patterns to Mirror (documentation task, no code anchor); follow each file's own existing entry style (e.g. the `docs/context/architecture.md` `src/shared/` row's "behind ..., unit N phase M, date" phrasing).
- **VALIDATE**:
  ```
  set -euo pipefail
  grep -q 'adherence-line' docs/context/architecture.md
  grep -q 'Aderência' docs/domain/areas/tasks.md
  grep -q 'adherence' documentation/50-planning/roadmap.md
  ```

### Task 10: CREATE the UI checklist record and the owner's device-proof record

- **ACTION**: Run from the artifact root; create `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` and `PRPs/reports/adherence-mirror/phase-3/device-proof.md`. Delivers AC-A5 (the checklist's ✔/✘ is recorded before the merge) and prepares AC-A6. For the checklist: read `documentation/40-engineering/ui-ux-guidelines.md` "Review checklist" and, after Tasks 1-7 are in place, run Tier A items 1-9 at 375 px dark in the browser pane on both the *Aderência* route and *Hoje* (with the endpoint returning a qualifying series, a non-qualifying one, an ended-only qualifying one, and forced to fail), recording one ✔/✘ per item with a one-line reason for each ✘ (format of `PRPs/reports/missed-sweep/phase-3/ui-checklist.md`). Tier B items the browser pane cannot reach (items 10 phone contrast, 12 phone checks, 14 screenshots) are recorded as `owed to the owner's device`, never as ✔; never claim a screenshot that was not taken. One ✘ without a recorded exception means the phase is not done. For `device-proof.md`: write the AC-20 procedure (take a same-day production export; open *Hoje* and *Configurações -> Aderência* on the device; compare the line or its correct absence and every count, streak and date with the export's rows) with a status line reading `Status: OWED — owner-observed; the Implementer does not complete this` and an empty observation block for the owner. AC-20 is NOT completed by this plan.
- **MIRROR**: none from Patterns to Mirror (report task, no code anchor); copy the structure of the existing record `PRPs/reports/missed-sweep/phase-3/ui-checklist.md`.
- **VALIDATE**:
  ```
  set -euo pipefail
  cd C:/repos/assistente-pessoal
  test -s PRPs/reports/adherence-mirror/phase-3/ui-checklist.md
  grep -q 'OWED' PRPs/reports/adherence-mirror/phase-3/device-proof.md
  if grep -nE '^\s*(1[0-4]|[1-9])\.?.*(✘)' PRPs/reports/adherence-mirror/phase-3/ui-checklist.md | grep -viE 'exception|owed'; then echo "FAIL: an unexplained ✘ remains in the checklist"; exit 1; else echo "PASS: no unexplained ✘"; fi
  ```

## Validation Commands

Run from the worktree root `C:/repos/assistente-pessoal/.worktrees/adherence-mirror/` unless a `cd` is shown.

### Level 1 STATIC_ANALYSIS

```
set -euo pipefail
npm run check
```

(`npm run check` is types + `tsc -b` + lint + the format gate. Run `npx prettier --write` on the touched non-test files first if the gate reports formatting.)

### Level 2 CONTENT_INVARIANTS and UNIT_TESTS

```
set -euo pipefail
# the series-counter module and the expansion function are untouched by this phase
git diff --quiet HEAD -- src/shared/recurrence.ts
# no percentage, progress bar or forbidden vocabulary in any file this phase adds
if grep -nE '[0-9] ?%|progressbar|<progress|falha|falhando|pulada' src/shared/adherence-line.ts src/shared/adherence-view.ts src/app/components/AdherenceScreen.tsx src/app/components/AdherenceEntryCard.tsx; then echo "FAIL: ratio or forbidden vocabulary"; exit 1; else echo "PASS: clean"; fi
# the two new pure modules import nothing outside their siblings
if grep -hE '^import ' src/shared/adherence-line.ts src/shared/adherence-view.ts | grep -vqE 'from "\./(api|adherence|adherence-line)"'; then echo "FAIL: non-sibling import"; exit 1; else echo "PASS: sibling imports only"; fi
# the whole suite, including the pair-authored tests for the two modules and app-route
npm test
```

### Level 3 INTEGRATION and DRY-RUN END-TO-END

```
set -euo pipefail
npm run build
```

Then, manually (guidelines §12.6; not an exit-code gate): `npm run dev`, open *Hoje* and *Configurações -> Aderência* at 375 px dark; with fixtures for a qualifying active series, a non-qualifying one, an ended-only qualifying one, and the endpoint forced to fail (DevTools Network, block `/api/series/adherence`) confirm: the line appears or is absent as AC-A1/AC-A2 state, the Task list, agenda and Reminders render unchanged when the fetch fails, and the route shows its failure inline with *Tentar de novo*. Record the result in `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md`.

## Acceptance Criteria

- **AC-A1 (PRD AC-15):** Given an `active` series with at least two misses in the 30-day window, when *Hoje* loads, then one plain-text line directly below the quick-filter chip row names the top-ranked active series and its miss count in the window, plus how many other qualifying active series exist when there are any, and tapping it opens the *Aderência* route; the show/hide and text decision is the pure `decideAdherenceLine` in `src/shared/adherence-line.ts`, with tests.
- **AC-A2 (PRD AC-16):** Given no active series with at least two misses in the window (including when the only qualifying series is `ended`), then no line, no placeholder and no reserved space is rendered on *Hoje*.
- **AC-A3 (PRD AC-17):** Given the adherence endpoint fails or times out, then the Task list, agenda and Reminders on *Hoje* render exactly as without this phase and the line is simply absent (no banner, no toast, no blanked list, no connectivity report); on the *Aderência* route the same failure is shown inline and persistently with a retry.
- **AC-A4 (PRD AC-18):** Given the owner opens *Configurações -> Aderência* (path `/settings/adherence`), then he sees, in this order, active series with misses in the window (in ranking order), the other active series, then ended series; each shows its title, *N de M feitas*, the current streak and the dates of its recent misses, with no percentage, chart or progress bar; the path and route round-trip through `routeFromPath`/`pathOf`.
- **AC-A5 (PRD AC-19):** Given any screen this phase adds or changes, when its visible copy is read, then it is pt-BR and uses *não concluída* for `missed` (never "falha", "falhando" or "pulada"), the layout standard carries the dated §2 amendment, and the UI/UX review checklist's ✔/✘ result is recorded before the merge.
- **AC-A6 (PRD AC-20):** Given a same-day production export, when the owner opens *Hoje* and the *Aderência* route on his own device, then the line (or its correct absence) and every count, streak and date match the export's rows, and the observation is recorded in the roadmap Delivery history. This criterion is OWED to the owner and cannot be completed autonomously; Task 10 only prepares its procedure.

R8b note: this is PRD mode, so every bullet above carries its `(PRD AC-N)` token.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| The server `ranking` breaks title ties by code point, the screen by pt-BR collation, so the two could disagree | L | L | The screen never reads `ranking`: both the line and the route use the same `orderByMisses`, so they agree with each other; only title-tied series can order differently from the raw response, which no test or AC pins |
| The *Hoje* line becomes noise or reserves space when absent | L | M | One conditional element inside the chip row's own grid cell, so the shell's row template is unchanged; AC-A2 checked manually and Task 7's VALIDATE pins the template |
| A failed adherence fetch blanks or banners *Hoje* | L | H | Own state, never `report()`, never an error state; Task 7's VALIDATE asserts `refreshAdherence` does not call `report(`; AC-A3 forced-failure check in Level 3 |
| The ranking includes ended series, so a naive top-of-ranking line would nudge about a finished commitment | M | M | `orderByMisses` and the threshold filter to `active` only; the ended-only case is an explicit manual fixture and a pure-function test case |
| Too little real data to observe the exit signal for weeks (PRD counter-evidence) | M | L | AC-A6 checks fidelity on whatever data exists; the unit stays open until the owner observes it |
| research-web found no source on a passive home-screen summary line | L | L | Recorded gap; the design is the PRD's own decision (D-E), and its two parts (counts over percentages, plain text) are what the layout standard already mandates |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework.
- Test surface for the pair (decidable parts only; React components stay manual per `docs/context/methodology.md`): `decideAdherenceLine` (threshold exactly 2 vs 1, ended-only returns `null`, top series chosen by `orderByMisses`, "+N" singular and plural, untitled fallback, the `não concluídas em 30 dias` wording and absence of forbidden vocabulary), `orderByMisses` (pt-BR tie-break, id last), `adherenceSections` (the three-way split and each section's order, ended series with misses stay in `ended`), the three formatters (zero special-cased, no `%`, `dd/mm` dates), and additive `app-route` assertions for `/settings/adherence` (round-trip, trailing slash, `/settings` still resolving to `settings`).
- The unit stays `in-progress` after this phase: AC-A6 is observed by the owner on his device. Do not mark the unit or the roadmap row `shipped`.
- The PRD's Open Question on the exact pt-BR wording is settled here against the working form: `<title> · <n> não concluídas em 30 dias · +<k> séries`.
- The CLAUDE.md UI/UX gate applies: the Implementer reads `documentation/40-engineering/ui-ux-guidelines.md` before touching `src/app/` and Task 10 records the checklist result.
- Research gaps recorded: `research-web` found no source on passive one-line home-screen summaries; sources on counts versus percentages disagree. Neither changes the plan, which follows the PRD and the layout standard.

*Generated: 2026-10-04*
*Approved: 2026-10-04*
*Implemented: 2026-10-04*
*Status: IMPLEMENTED*
