# Feature: Today screen (Phase 2 of ui-design-pass)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: cross-cutting artifact (a plan the Implementer consumes); rebuilds the app's main screen and splits src/app/App.tsx into components under src/app/components/; creates the first reusable UI primitives beyond phase 1 (Toast, Banner, Skeleton) and the app-level toast store and connectivity hook; Task domain rules (open / done / missed, deadline vs scheduled date) surface in the row meta line; replaces the service-worker update prompt (window.confirm) the whole app shares
- Decisions found:
  - ADR-0009 — visible copy in pt-BR from the approved microcopy table; identifiers, comments and keys stay English
  - ADR-0010 — tokens.css is machine truth; one elevated plane per screen (the capture deck carries `shadow-deck`; rows carry `shadow-row`); the signature completion moment (check sinks, one amber ring, ~400 ms; shortened under reduced motion); `#ff5c1f` only for overdue and live
  - ADR-0011 — owned components under src/app/components/ui/ (cva + cn, Base UI data attributes); no library for toasts; Sheet stays on Base UI Dialog until Phase 3 swaps it
  - ADR-0003 — no offline writes: the banner disables the deck and the row actions, queues nothing
  - ADR-0008 + docs/context/methodology.md — tdd: true; the decidable slices of this screen already live in src/shared (format.ts, connectivity.ts, phase 1); this phase adds one more (the toast reducer) test-first and leaves the React glue manual
  - Layout standard §2 (header / banner / list / toast / deck anatomy, 64 px rows, no bottom bar) and §4 (100dvh grid with `overflow: clip`, the list as its own scroll container, the safe-area inset dropped while a field has focus); guidelines §8 (states), §12.4 (lists: two-line titles, content-visibility, refetch on visibilitychange and reconnect) and §12.5 (`autofocus` only on the capture input when the app opens on Hoje)
  - Owner, 2026-08-21 — the row opens the detail and a 48 px pencil enters inline title editing; the two-pane desktop is deferred (the column stays capped at 640 px)
  - PRD Decisions Log — optimistic complete/reopen with rollback; connectivity reducer + one hook; toast store fed by main.tsx's onNeedRefresh; *Concluídas* collapsed by default with persisted state; `done` rows carry no meta line
- Applicable anti-patterns:
  - Weakening tests to force green — no task touches test/; the suite of phase 1 stays as it is and the test pair owns any new file
  - Portuguese in artifacts — carve-out: only UI string values are pt-BR
  - Offline write queue — none; `canWrite` gates the deck and the row actions
  - Hand-duplicated entity types — TaskDto stays the only Task type; optimistic updates map over TaskDto values
  - Version ranges — no package added
- Applicable architectural rules:
  - src/shared stays DOM-free and dependency-free (the toast reducer takes events, never timers)
  - tokens.css is the only style scale: the rebuilt screen carries no `style={}` object; the two screens this phase merely relocates (TaskDetail, TokenGate) keep theirs until Phase 3 rebuilds them
  - One Worker; the service worker and src/app/pwa.ts stay untouched — only main.tsx's handler changes
  - UI verification stays manual: the browser-pane Tier A / Tier B check of the Hoje screen is the main session's job after implementation
  - Pillar 2 never commits
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/ui-design-pass.prd.md` — Implementation Phases row 2: "Today
  screen" — Goal: the screen the owner uses most looks and behaves like the
  layout standard and the identity say — Success signal: Tier A ✔ on every
  change and Tier B ✔ for the *Hoje* screen in the pane (375 px and 1280 px,
  contrast recorded, states simulated), filed under
  `PRPs/reports/ui-design-pass/`; the 2026-08-19 board findings closed except
  those owned by Phase 3 (history/back, delete confirmation).

## Summary

This phase turns the walking-skeleton board into the *Hoje* screen of the
layout standard, built from the phase-1 foundation. `src/app/App.tsx` is split
into components: a `100dvh` grid shell (`TodayScreen`) with the header (*Hoje*,
the `Intl` date, the remaining count in Unbounded), the offline / unreachable
banner, the scrolling list of 64 px rows (`CompleteControl`, a two-line title,
the meta line from `taskMetaLine`, one trailing pencil that enters inline
editing), the *Concluídas* section (collapsed by default, state persisted), the
empty state with its CTA, a skeleton that mirrors the pre-JavaScript
silhouette, a toast slot above the deck, and the capture deck as the single
elevated plane. Completing is optimistic with rollback and a *Desfazer* toast;
the list refetches when the tab becomes visible again and when the browser
reconnects; `window.confirm` gives way to the *Nova versão disponível* toast.
The only new decidable logic — the toast rules (one at a time, 4 s without an
action, persistent with one, *Depois* remembered for the session) — is a pure
reducer in `src/shared/toast.ts`, authored test-first; everything else is
React glue over the phase-1 modules and is verified in the browser pane. The
old detail and token-gate screens are moved to their own files verbatim and
rebuilt in Phase 3; they are the last inline-styled surfaces.

## User Story

```
As the owner
I want the screen I open several times a day to be the Hoje screen of the
standard — dark, in Portuguese, one thumb, one primary action, honest about
what is overdue and whether I am online
So that capturing and completing Tasks feels like the app the plan promised,
and unit 3 builds its groups on this shell instead of over the old board
```

## Problem Statement

After phase 1 the canvas is dark and the fonts are the identity's, but the
board itself is still the 2026-08-03 skeleton: `src/app/App.tsx:117-319`
renders the capture form, the open list and the "Closed" list from the inline
`styles` object, rows act through the `○ ⋯ ×` glyph buttons (~18 px targets),
the empty state has no CTA, there is no skeleton, no offline banner, no toast
and no *Desfazer*, `justSaved` is a two-second English "Saved", and
`src/app/main.tsx:56-64` still asks `window.confirm("A new version is
available. Update now?")`. Nine of the thirteen checklist findings of
2026-08-19 live on this screen, and every later unit plugs into its anatomy —
unit 3's groups and chip row, unit 4's agenda stack, unit 7's live toast —
so until it exists, nothing after it can be built on the standard.

## Solution Statement

Build the anatomy the standard draws, with the parts phase 1 left ready.
`TodayScreen` owns the shell grid (`header / banner / list / toast / deck`,
`h-dvh`, `overflow-clip`, the list as its own scroll container with
`overscroll-contain`) and the screen state: the Task list, one optimistic
status change at a time with rollback, the connectivity state from
`useConnectivity()` over `reduceConnectivity`, the refetch on
`visibilitychange` and reconnect, the *Concluídas* collapse persisted in
`localStorage`, and the selected Task that still opens the old `TaskDetail`
until Phase 3 swaps in the sheet. `TaskRow` renders `CompleteControl` (48 px),
a two-line title, the meta line from `taskMetaLine(task, today)` in mono with
the overdue hue only when the text already says *atrasada*, and the pencil;
`InlineTitle` replaces the row body while editing; `CaptureDeck` is the one
elevated plane, its eyebrow *Nova tarefa* being the field's visible `<label>`,
its submit the icon-only 48 px primary button, disabled with the hint while
`canWrite` is false; `EmptyState`, `Skeleton`, `Banner` and `Toast` are the §8
states designed once. The toast store (`src/app/toast-store.ts`) is a
module-level `useSyncExternalStore` source so `main.tsx` can show the update
toast without moving service-worker registration; its rules come from the pure
`reduceToast` in `src/shared/toast.ts`, which the test pair authors first. The
shell anchors the "drop the safe-area inset while a field has focus" rule on
the shell element (`[data-shell]:has(…)`), not on `:root`, because MDN advises
against anchoring `:has()` on the root; the deck is an in-flow grid row, never
`position: fixed`, because `interactive-widget=resizes-content` shrinks the
layout viewport and fixed elements drift.

## Metadata

| Key | Value |
|---|---|
| Type | UI phase (the main screen) + one small pure module + app-level glue (store, hook) |
| Complexity | High — many new components, optimistic state, animation, connectivity; no API change |
| Systems Affected | `src/app/App.tsx`, `src/app/main.tsx`, `src/app/styles.css`, `src/app/components/` (new screen components), `src/app/components/ui/` (Toast, Banner, Skeleton), `src/app/hooks/`, `src/app/toast-store.ts`, `src/shared/toast.ts`, `src/app/components/DesignPlayground.tsx`, `documentation/` (roadmap backlog row, identity microcopy row) |
| Dependencies | Phase 1 (`implemented`): `styles.css` imported, `src/shared/format.ts`, `src/shared/connectivity.ts`, the Portuguese messages, the fonts, the `index.html` skeleton |
| Estimated Tasks | 11 |
| Source PRD line ref | `PRPs/prds/ui-design-pass.prd.md:414` (Implementation Phases row 2); Phase Details at `:457-460`; the criteria at `:173-196` (AC-2, AC-3, AC-8, AC-9, AC-10, AC-13, AC-14, AC-15, AC-16, AC-17, AC-20, AC-22) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/ui-design-pass.prd.md` | 165-196, 225-271, 316-395, 457-460 | The AC text verbatim, the MoSCoW table and the microcopy rows (header, deck, row meta, section, toasts), the Architecture Notes (component layout, toasts in the top layer, update flow, connectivity, keyboard shell) and this phase's own scope |
| P0 | `src/app/App.tsx` | 26-68, 117-319, 329-384, 395-526, 528-566 | The file being split: the token gate switch, `TaskBoard` (state, `handleFailure`, `refresh`, `run`, the capture invariant, the two lists), `InlineTitle`, `TaskDetail`, and the inline `styles` object that leaves with the board |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 23-36, 44-46 | The phone anatomy this phase builds (header, banner, row anatomy, empty state, toast placement, capture deck, no bottom bar) and the keyboard decision (`100dvh` grid, list as its own scroll container, inset dropped while a field has focus) |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 68-72, 74-90, 135-141 | Motion bands and reduced motion; the §8 state table (pending request, loading, empty, request error, offline, toast, update, reversible destructive); §12 component and list rules (two-line titles, content-visibility, refetch on visibility/reconnect, `autofocus` once) |
| P0 | `src/shared/format.ts` | 1-34, 62-70, 98-124 | The contracts the header and the rows consume: `formatRemaining`, `formatHeaderDate`, `taskMetaLine(task, today)` and the rules they encode |
| P0 | `src/shared/connectivity.ts` | 1-65 | The reducer the `useConnectivity` hook feeds, and its header naming that hook as the only caller of the browser events |
| P0 | `src/app/main.tsx` | 32-71 | `mountApp`, the pathname detection, and the `setupPwa({ onNeedRefresh … })` block whose `window.confirm` this phase replaces |
| P0 | `src/app/pwa.ts` | 1-42 | The `onNeedRefresh(update)` contract: `update()` is `updateSW()`, which posts SKIP_WAITING and reloads on Workbox's `controlling` event — the toast only has to call it |
| P1 | `src/app/components/ui/CompleteControl.tsx` | 1-32 | The completion control the rows use; its `group-data-checked` classes are where the completion moment attaches |
| P1 | `src/app/components/ui/Button.tsx` | 1-30 | `cva` variants (`primary`, `secondary`, `ghost`, `icon`) for the submit, the CTA, the pencil and the toast actions |
| P1 | `src/app/components/ui/Chip.tsx` | 1-46 | The second owned-component example (Base UI Toggle) whose shape Toast, Banner and Skeleton follow |
| P1 | `src/app/components/DesignPlayground.tsx` | 1-70, 174-239 | The token lists and the *Componentes* section this phase extends with the new states |
| P1 | `src/app/tokens.css` | 44-66, 84-110 | Elevation recipes (`--elevation-row`, `--elevation-deck`, `--halo-done`), hit/row/field minima, durations (`--duration-complete`), easings, the focus ring and the reduced-motion overrides |
| P1 | `src/app/styles.css` | 1-68 | The Tailwind token namespace (`shadow-row`, `shadow-deck`, `text-t1`…`text-t5`, `font-data`, `font-display`) and the `@layer base` block the new rules join |
| P1 | `index.html` | 58-110 | The critical CSS and the `.shell-skeleton` grid (`64px 1fr 96px`, `100dvh`, `overflow: clip`) the React `Skeleton` and the shell mirror |
| P1 | `src/app/api.ts` | 86-133 | `listTasks`, `createTask`, `updateTask`, `completeTask`, `reopenTask` signatures the screen calls |
| P1 | `documentation/10-product/visual-identity.md` | 73-101 | The approved microcopy table (empty, saved / completed / reopened, request error, offline, update) plus the rows phase 1 added (header, deck, row meta, section, toasts) — every visible string comes from here |
| P2 | `docs/context/methodology.md` | 37-62 | The "split the logic out, then the glue is exempt" rule — why only the toast reducer is a new tested module and the hooks/components are manual |
| P2 | `documentation/50-planning/roadmap.md` | 147 | The backlog row "Refresh the view when a window returns to the foreground" this phase closes |

## Patterns to Mirror

```ts
# SOURCE: src/app/App.tsx:132-141
  const handleFailure = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setError(classifyRequestFailure(cause).message);
    },
    [onUnauthorized],
  );
```

The one failure path every request shares: a 401 routes to the token gate,
everything else becomes the Portuguese `classifyRequestFailure` message. The
new screen keeps this exact shape and adds one line — reporting the failure's
`kind` to the connectivity reducer — so the banner and the error text come
from the same event. Copied by Task 6.

```ts
# SOURCE: src/app/App.tsx:156-166
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

The server-first mutation path (busy → action → refresh). Capture and inline
title edits keep using it; complete and reopen leave it for the optimistic
path (local status change first, rollback on failure), which is the only
behavioural change in how writes are made. Mirrored by Task 6.

```tsx
# SOURCE: src/app/App.tsx:205-219
          void run(async () => {
            await createTask({ title: trimmed });
            // Phase 4 (install-and-quick-capture) invariant, locked in
            // explicitly: `setTitle("")` is deliberately sequenced AFTER the
            // awaited `createTask(...)` call above, never before or
            // unconditionally. A thrown failure — network-unreachable or
            // HTTP-level, both now surfaced via `classifyRequestFailure` in
            // `handleFailure` — exits this callback before this line runs,
            // so on any failed save the owner's typed text is not lost; it
            // remains exactly as typed in the input's `value={title}`
            // binding (PRD AC-4).
            setTitle("");
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
          });
```

The capture invariant (the typed text survives a failed save) moves into
`CaptureDeck` + `TodayScreen` unchanged; the two-second `justSaved` text
becomes the *Tarefa salva* toast. Copied by Task 4 and Task 6.

```ts
# SOURCE: src/app/App.tsx:357-362
  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === "" || trimmed === task.title) return;
    onCommit(trimmed);
  }
```

The inline-edit commit rule (Enter / blur commit, empty or unchanged = no
request) moves verbatim into `InlineTitle.tsx`; only the trigger changes — the
pencil instead of the title text. Copied by Task 5.

```tsx
# SOURCE: src/app/components/ui/CompleteControl.tsx:18-31
  return (
    <Checkbox.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="group flex size-12 flex-none items-center justify-center rounded-control bg-transparent"
    >
      <span className="flex size-[26px] items-center justify-center rounded-full border-2 border-faint transition-transform duration-150 group-active:scale-90 group-data-checked:border-accent group-data-checked:bg-accent group-data-checked:shadow-halo-done">
        <Checkbox.Indicator>
          <Check className="size-4 text-on-accent" strokeWidth={2.5} aria-hidden="true" />
        </Checkbox.Indicator>
      </span>
    </Checkbox.Root>
  );
```

The 48 px control with its 26 px ring; the completion moment is a CSS
animation on this ring (the `praesto-complete` keyframes of Task 7), attached
through a `data-completing` attribute the row sets, so the control itself
gains one optional prop and nothing else. Mirrored by Task 5 and Task 7.

```tsx
# SOURCE: src/app/components/ui/Button.tsx:9-23
const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-4 font-text text-t2 font-semibold transition-transform duration-150 ease-out select-none disabled:opacity-55",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-on-accent shadow-control active:translate-y-[3px] active:shadow-control-pressed",
        secondary: "border border-line bg-surface-2 text-ink",
        ghost: "bg-transparent text-accent",
        icon: "size-12 bg-transparent px-0 text-ink",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);
```

The owned-component idiom every new primitive (Toast, Banner, Skeleton) and
screen part is written in: token utilities, `cva` where there are variants,
`cn()` for composition. The submit is `primary`, the empty-state CTA and the
*Concluídas* header are `secondary`/`ghost`, the pencil and the toast close are
`icon`. Mirrored by Task 3, Task 4 and Task 5.

```ts
# SOURCE: src/shared/format.ts:121-124
export function taskMetaLine(
  task: TaskDto,
  today: string,
): { text: string; overdue: boolean } | null {
```

The row meta contract: `today` is an argument (`todayIn(new Date())` in the
screen), `null` means no second line, `overdue` is the only thing that picks
the `text-overdue` colour — and the text already says *atrasada*, so colour is
never the only cue. Consumed by Task 5.

```ts
# SOURCE: src/shared/connectivity.ts:43-60
export function reduceConnectivity(
  state: ConnectivityState,
  event: ConnectivityEvent,
): ConnectivityState {
  switch (event.type) {
    case "browser-offline":
      return "offline";
    case "browser-online":
      return "online";
    case "request-succeeded":
      return "online";
    case "request-failed":
      if (event.kind === "http-error") return state;
      // server-unreachable: offline wins — airplane mode already explains
      // every failed request, so a request outcome must never override it.
      return state === "offline" ? "offline" : "unreachable";
  }
}
```

The pure reducer the hook wraps; the hook only adds the `online` / `offline`
listeners and the initial `navigator.onLine` read. The toast reducer of Task 1
follows the same shape (a total switch over a discriminated event union).
Mirrored by Task 1 and Task 2.

```tsx
# SOURCE: src/app/main.tsx:55-64
  // Registered after render so it does not compete with first paint.
  setupPwa({
    onNeedRefresh(update) {
      // Replace with real UI (toast/snackbar) later.
      if (window.confirm("A new version is available. Update now?")) void update();
    },
    onOfflineReady() {
      console.info("[pwa] ready for offline use");
    },
  });
```

The placeholder this phase retires: the handler keeps its position (after
render, before the persist request) and its `update` argument; only the body
changes to a `showToast` call. Edited by Task 8.

```tsx
# SOURCE: src/app/components/DesignPlayground.tsx:174-195
      <Section title="Componentes">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="primary" disabled>
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="secondary" disabled>
              Secondary
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="ghost" disabled>
              Ghost
            </Button>
            <Button variant="icon" aria-label="Ícone de exemplo">
              <span aria-hidden="true">+</span>
            </Button>
            <Button variant="icon" aria-label="Ícone de exemplo desabilitado" disabled>
              <span aria-hidden="true">+</span>
            </Button>
          </div>
```

How a state is registered on the playground — a `Section` with rendered
instances in every state. Task 9 adds a *Tela Hoje* section in this shape.

```css
# SOURCE: index.html:70-75
      .shell-skeleton {
        display: grid;
        grid-template-rows: 64px 1fr 96px;
        height: 100dvh;
        overflow: clip;
      }
```

The pre-JavaScript silhouette: the React `Skeleton` and the real shell reuse
the same bands (a 64 px header, 64 px rows, a deck) so the hand-over from the
critical CSS to React does not jump. Mirrored by Task 3 and Task 6.

```css
# SOURCE: src/app/tokens.css:88-98
  --duration-short: 150ms;
  --duration-medium: 300ms;
  --duration-long: 500ms;
  --duration-complete: 400ms;
  --pulse-count: 3;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);

  /* Focus — two-tone ring that survives any surface */
  --focus-ring: 0 0 0 2px var(--color-accent), 0 0 0 6px var(--color-bg);
```

The only durations and easings any animation in this phase may use; the
reduced-motion block of the same file shortens them, so the keyframes of
Task 7 read `var(--duration-complete)` and `var(--duration-medium)` and need no
media query of their own. Mirrored by Task 7.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/toast.ts` | CREATE | The pure toast rules (one at a time, auto-dismiss only without an action, *Depois* remembered for the session) — the decidable slice of this phase, authored test-first |
| `src/app/toast-store.ts` | CREATE | Module-level store over the reducer (`useSyncExternalStore` source, the 4 s timer) so `main.tsx` and the screen share one toast slot |
| `src/app/hooks/useConnectivity.ts` | CREATE | The exempt glue over `reduceConnectivity`: `navigator.onLine`, `online` / `offline` events, request outcomes |
| `src/app/components/ui/Toast.tsx` | CREATE | The toast primitive: `role="status"` (or `alert` for errors), text + icon, optional action / secondary / close buttons at 48 px |
| `src/app/components/ui/Banner.tsx` | CREATE | The offline / unreachable banner primitive (icon + text, not dismissible) |
| `src/app/components/ui/Skeleton.tsx` | CREATE | The loading skeleton mirroring the shell silhouette, with the *Ainda carregando…* line after ~10 s |
| `src/app/components/TodayHeader.tsx` | CREATE | *Hoje* · `Intl` date · remaining count (figure in Unbounded) |
| `src/app/components/CaptureDeck.tsx` | CREATE | The single elevated plane: eyebrow-as-label, 56 px field, icon-only submit, offline hint, inline request error |
| `src/app/components/EmptyState.tsx` | CREATE | *Nada para hoje.* + cue + the *Nova tarefa* CTA that focuses capture |
| `src/app/components/TaskRow.tsx` | CREATE | The 64 px row: `CompleteControl`, two-line title, meta line, the trailing pencil, the completion moment |
| `src/app/components/InlineTitle.tsx` | CREATE | The in-place title editor (Enter / blur commit, Esc abandons) |
| `src/app/components/TodayScreen.tsx` | CREATE | The shell grid and the screen state (list, optimistic status, connectivity, refetch, collapse, selection) |
| `src/app/components/TaskDetail.tsx` | CREATE | `TaskDetail` moved out of `App.tsx` verbatim with the `styles` entries it uses — transitional until Phase 3 |
| `src/app/components/TokenGate.tsx` | CREATE | `TokenGate` moved out of `App.tsx` verbatim with the `styles` entries it uses — transitional until Phase 3 |
| `src/app/App.tsx` | UPDATE | Keeps only the three-valued token state and the screen switch; renders `TokenGate` / `TodayScreen`; the inline `styles` object leaves this file |
| `src/app/main.tsx` | UPDATE | `onNeedRefresh` shows the *Nova versão disponível* toast instead of `window.confirm` |
| `src/app/styles.css` | UPDATE | The shell rule that drops the safe-area inset while a field has focus, and the `praesto-complete` / `praesto-leave` keyframes |
| `src/app/components/ui/CompleteControl.tsx` | UPDATE | The inner ring gains the `praesto-ring` class the completion animation targets — the only change to the primitive |
| `src/app/components/DesignPlayground.tsx` | UPDATE | A *Tela Hoje* section registering rows (open, overdue, done, missed), toast, banner, empty, skeleton and deck |
| `documentation/50-planning/roadmap.md` | UPDATE | The backlog row "Refresh the view when a window returns to the foreground" closes (refetch on visibility and reconnect) |
| `documentation/10-product/visual-identity.md` | UPDATE | One new microcopy row for the list load error (*Tentar de novo*), added before it enters code |
| `PRPs/reports/ui-design-pass/phase-2/build-report.md` | CREATE | The phase record: the `vite build` size table, the §11 probe output, and (added by the main session) the browser-pane Tier A / Tier B result for *Hoje* |

## NOT Building (Scope Limits)

- **No groups, chip row, filters, header icons, agenda stack** — unit 3 and
  unit 4. The list stays one open list in the API's urgency order plus the
  *Concluídas* section; the header carries no buttons.
- **No detail sheet, no delete, no confirmation, no token-gate restyle** —
  Phase 3. A row tap still opens the old full-screen `TaskDetail` (moved to
  its own file, inline styles and English labels intact); because the `×` row
  button is gone and the old detail never had a delete action, **Tasks cannot
  be deleted between this phase and Phase 3** — accepted, since nothing is
  deployed before Phase 4.
- **No native `<dialog>`, no `popover="manual"` toast region** — with no sheet
  on the screen yet, the toast is an in-flow grid row above the deck; Phase 3
  moves it inside the open sheet's subtree (a `popover="manual"` in the top
  layer is inert under a modal dialog — see `## Notes`).
- **No two-pane desktop** — the column stays capped at 640 px (owner,
  2026-08-21).
- **No haptics, no gamification, no library, no router, no i18n.**
- **No authoring or editing of test files.** The `test-writer` /
  `test-reviewer` pair owns `test/` (R-X); Task 11 only runs the suites.
- **No deploy, no device run** — Phase 4; the manual check of this phase is
  the browser pane at 375 px.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/toast.ts`

- **ACTION**: Create a pure module (no DOM globals, no timers, no runtime
  dependency; same header discipline as `src/shared/connectivity.ts`) that
  exports exactly:
  `export const TOAST_AUTO_DISMISS_MS = 4000;`
  `export interface ToastSpec { key: string; text: string; tone?: "info" | "error"; action?: { label: string; run?: () => void }; secondary?: { label: string; run?: () => void } }`
  `export interface ToastState { current: ToastSpec | null; suppressed: readonly string[] }`
  `export const INITIAL_TOAST_STATE: ToastState = { current: null, suppressed: [] };`
  `export type ToastEvent = { type: "show"; toast: ToastSpec } | { type: "dismiss"; key: string; remember?: boolean } | { type: "expire"; key: string };`
  `export function autoDismisses(toast: ToastSpec): boolean` — `true` only
  when `toast.action` is `undefined` (a toast with an action persists until
  used, dismissed or replaced — guidelines §8);
  `export function reduceToast(state: ToastState, event: ToastEvent): ToastState`
  — `show`: when `toast.key` is in `state.suppressed`, return `state`
  unchanged; otherwise `current` becomes the new toast (one at a time — a
  new toast replaces the current one, whatever its kind); `dismiss`: clears
  `current` only when `current.key === event.key`, and when `remember` is
  `true` appends `event.key` to `suppressed` (idempotent — never twice)
  whether or not it was current; `expire`: clears `current` only when
  `current.key === event.key` AND `autoDismisses(current)` is `true` — an
  expiry for a toast with an action, for a stale key or for no toast is a
  no-op. The function never mutates its inputs and always returns a state.
  Document in the header that the 4 s timer lives in `src/app/toast-store.ts`
  (glue), that `key` is what lets *Depois* suppress the update toast for the
  session (`dismiss` with `remember: true` on key `sw-update`), and that
  `run` callbacks are opaque to the reducer.
- **MIRROR**: `# SOURCE: src/shared/connectivity.ts:43-60` (the total
  switch over a discriminated event union, returning a new state).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'export const TOAST_AUTO_DISMISS_MS = 4000;' src/shared/toast.ts
  grep -q 'export function reduceToast' src/shared/toast.ts
  grep -q 'export function autoDismisses' src/shared/toast.ts
  grep -qF 'export const INITIAL_TOAST_STATE: ToastState' src/shared/toast.ts
  if grep -nE 'window|document|navigator|setTimeout|localStorage' src/shared/toast.ts; then
    echo "FAIL: src/shared/toast.ts must stay DOM-free and timer-free"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A13.

### Task 2: CREATE `src/app/toast-store.ts` and `src/app/hooks/useConnectivity.ts`

- **ACTION**: `src/app/toast-store.ts` is a module-level store over the
  reducer of Task 1: a private `state` starting at `INITIAL_TOAST_STATE`, a
  `Set` of listeners, and exactly these exports —
  `export function showToast(toast: ToastSpec): void` (dispatches `show`;
  when `autoDismisses(toast)` it arms one `setTimeout` of
  `TOAST_AUTO_DISMISS_MS` that dispatches `expire` for that key, clearing any
  previously armed timer first), `export function dismissToast(key: string, remember = false): void`,
  `export function subscribeToast(listener: () => void): () => void`,
  `export function getToastSnapshot(): ToastState` (returns the same object
  until the state changes, as `useSyncExternalStore` requires) and
  `export function useToast(): ToastState` built on `useSyncExternalStore`.
  `src/app/hooks/useConnectivity.ts` exports
  `export function useConnectivity(options?: { onOnline?: () => void }): { state: ConnectivityState; report: (event: ConnectivityEvent) => void }`:
  the initial state is `"online"` when `navigator.onLine` is `true` and
  `"offline"` otherwise; an effect registers `window` `online` / `offline`
  listeners that dispatch `browser-online` / `browser-offline` through
  `reduceConnectivity` (and call `options.onOnline` after an `online` event)
  and removes them on unmount; `report` feeds request outcomes
  (`request-succeeded`, `request-failed` with the `kind` from
  `classifyRequestFailure`). Both files carry a header comment naming them as
  the exempt glue of `docs/context/methodology.md`'s browser-API rule — every
  decision they make lives in `src/shared/toast.ts` /
  `src/shared/connectivity.ts`.
- **MIRROR**: `# SOURCE: src/shared/connectivity.ts:43-60` (the reducer the
  hook wraps — the hook adds listeners and nothing else).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function showToast' src/app/toast-store.ts
  grep -q 'export function dismissToast' src/app/toast-store.ts
  grep -q 'export function useToast' src/app/toast-store.ts
  grep -qF 'useSyncExternalStore' src/app/toast-store.ts
  grep -qF 'TOAST_AUTO_DISMISS_MS' src/app/toast-store.ts
  grep -q 'export function useConnectivity' src/app/hooks/useConnectivity.ts
  grep -qF 'reduceConnectivity' src/app/hooks/useConnectivity.ts
  grep -qF '"offline"' src/app/hooks/useConnectivity.ts
  npx tsc -b
  ```
- Delivers AC-A5, AC-A6, AC-A13.

### Task 3: CREATE `src/app/components/ui/Toast.tsx`, `src/app/components/ui/Banner.tsx` and `src/app/components/ui/Skeleton.tsx`

- **ACTION**: Three owned primitives in the `Button.tsx` idiom (token
  utilities, `cn()`), one per file, `PascalCase` exports.
  `Toast.tsx` exports
  `export function Toast({ toast, onAction, onSecondary, onDismiss }: { toast: ToastSpec; onAction: () => void; onSecondary: () => void; onDismiss: () => void })`:
  a `<div>` with `role="status"` (and `role="alert"` when `toast.tone ===
  "error"`), `aria-live="polite"`, `flex min-h-12 items-center gap-3 rounded-control border border-line bg-surface-2 px-4 py-2 text-t2 text-ink shadow-row`,
  a leading `lucide-react` icon (`Info`, `Undo2` when the action is
  *Desfazer*, `TriangleAlert` for `error`, all `aria-hidden="true"`), the
  text, then on the right the `secondary` button and the `action` button as
  `Button variant="ghost"` (≥ 48 px) when present, and a `Button
  variant="icon"` with `aria-label="Fechar aviso"` and an `X` icon when the
  toast has an action (a persistent toast must be dismissible — guidelines
  §8; an auto-dismissing one needs no close control).
  `Banner.tsx` exports
  `export function Banner({ lead, body }: { lead: string; body: string })`:
  a `<div role="status" className="flex min-h-12 items-center gap-3 border-b border-line bg-surface-1 px-4 text-t2 text-ink">`
  with a `WifiOff` icon (`aria-hidden="true"`), `<strong>{lead}</strong>`
  and the body; no dismiss control.
  `Skeleton.tsx` exports `export function Skeleton({ slow = false }: { slow?: boolean })`:
  a `<div role="status" aria-busy="true" aria-label="Carregando">` laying out
  the shell silhouette of `index.html` — a 64 px header band (`h-16
  bg-surface-1`), three 64 px row blocks (`h-16 rounded-card bg-surface-1`)
  inside a `gap-2 px-4 pt-4` list, and a deck block (`h-24 rounded-t-card
  bg-surface-2`) — every band `aria-hidden="true"`, plus, when `slow` is
  true, one line `<p className="px-4 font-text text-t2 text-muted">Ainda carregando…</p>`
  (the approved copy). No animation (stillness by default — guidelines §7.2).
- **MIRROR**: `# SOURCE: src/app/components/ui/Button.tsx:9-23` (token
  utilities + `cn()`; the ghost and icon variants the toast reuses) and
  `# SOURCE: index.html:70-75` (the silhouette the skeleton mirrors).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function Toast' src/app/components/ui/Toast.tsx
  grep -qF '"status"' src/app/components/ui/Toast.tsx
  grep -qF '"alert"' src/app/components/ui/Toast.tsx
  grep -qF 'aria-label="Fechar aviso"' src/app/components/ui/Toast.tsx
  grep -q 'export function Banner' src/app/components/ui/Banner.tsx
  grep -qF 'WifiOff' src/app/components/ui/Banner.tsx
  grep -q 'export function Skeleton' src/app/components/ui/Skeleton.tsx
  grep -qF 'Ainda carregando…' src/app/components/ui/Skeleton.tsx
  grep -qF 'aria-busy="true"' src/app/components/ui/Skeleton.tsx
  if grep -n 'style={' src/app/components/ui/Toast.tsx src/app/components/ui/Banner.tsx src/app/components/ui/Skeleton.tsx; then
    echo "FAIL: primitives must use token utilities, never inline style objects"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A5, AC-A6, AC-A7.

### Task 4: CREATE `src/app/components/TodayHeader.tsx`, `src/app/components/CaptureDeck.tsx` and `src/app/components/EmptyState.tsx`

- **ACTION**: `TodayHeader.tsx` exports
  `export function TodayHeader({ now, remaining }: { now: Date; remaining: number })`:
  a flat `<header className="flex items-end gap-3 px-4 pt-6 pb-2">` (never
  elevated) with `<h1 className="m-0 font-text text-t4 font-bold text-ink">Hoje</h1>`,
  the date `<span className="pb-0.5 font-data text-t1 font-medium text-muted tabular-nums">{formatHeaderDate(now)}</span>`,
  and the count from `formatRemaining(remaining)`: when `figure` is not
  `null`, the figure in `font-display text-t4 font-extrabold text-accent
  tabular-nums` followed by the label in `font-text text-t1 font-medium
  text-muted`; when it is `null`, only the label (*nenhuma restante*). No
  icon buttons (nothing exists behind them yet).
  `CaptureDeck.tsx` exports
  `export function CaptureDeck({ value, onChange, onSubmit, busy, canWrite, error, autoFocus, inputRef }: { value: string; onChange: (value: string) => void; onSubmit: () => void; busy: boolean; canWrite: boolean; error: string | null; autoFocus: boolean; inputRef: React.Ref<HTMLInputElement> })`:
  a `<section data-deck className="border-t border-line bg-surface-2 px-4 pt-3 shadow-deck [padding-bottom:calc(var(--space-4)+env(safe-area-inset-bottom,0px))]">`
  — the one elevated plane, in-flow (never `position: fixed`) — containing
  `<label htmlFor="capture-title" className="m-0 mb-2 block font-data text-t1 font-semibold text-muted">Nova tarefa</label>`
  (the eyebrow IS the visible label, WCAG 3.3.2), a `<form>` with
  `flex min-h-14 items-center rounded-control border border-line-strong bg-surface-1 pr-1 pl-4 shadow-field`
  holding `<input id="capture-title" type="text" enterKeyHint="done" placeholder="O que precisa ser feito?" autoComplete="off"`
  (`autoFocus={autoFocus}`, `disabled={!canWrite}`, `className="min-h-12 min-w-0 flex-1 bg-transparent font-text text-t3 text-ink outline-none placeholder:text-muted disabled:opacity-55"`)
  and the submit `<Button type="submit" aria-label="Adicionar" className="size-12 px-0" disabled={busy || !canWrite}>`
  whose icon is `Plus` (`aria-hidden="true"`) normally and, only after the
  request has been pending for 400 ms (a timer in this component),
  `LoaderCircle` with `animate-spin motion-reduce:animate-none` — no
  indicator flashes on a fast save; `onSubmit` calls `event.preventDefault()`
  and ignores the submit when the trimmed value is empty or `busy` is true.
  Below the form: when `!canWrite`, `<p className="mt-2 font-text text-t1 text-muted">Captura indisponível sem conexão.</p>`;
  when `error` is not `null`, `<p role="alert" className="mt-2 font-text text-t2 text-overdue">{error}</p>`
  (the text names the failure; the hue is the identity's failure colour, never
  the only cue). `EmptyState.tsx` exports
  `export function EmptyState({ onCapture }: { onCapture: () => void })`:
  `<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">`
  with `<p className="m-0 font-display text-t4 font-extrabold text-ink">Nada para hoje.</p>`,
  `<p className="m-0 font-text text-t2 text-muted">Bora capturar a primeira?</p>`
  and `<Button variant="secondary" onClick={onCapture}>Nova tarefa</Button>`.
- **MIRROR**: `# SOURCE: src/app/App.tsx:205-219` (the capture invariant the
  deck's `onSubmit` contract preserves — the parent clears the value only
  after the awaited create) and `# SOURCE: src/app/components/ui/Button.tsx:9-23`.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function TodayHeader' src/app/components/TodayHeader.tsx
  grep -qF '>Hoje</h1>' src/app/components/TodayHeader.tsx
  grep -qF 'formatHeaderDate' src/app/components/TodayHeader.tsx
  grep -qF 'formatRemaining' src/app/components/TodayHeader.tsx
  grep -q 'export function CaptureDeck' src/app/components/CaptureDeck.tsx
  grep -qF 'htmlFor="capture-title"' src/app/components/CaptureDeck.tsx
  grep -qF 'placeholder="O que precisa ser feito?"' src/app/components/CaptureDeck.tsx
  grep -qF 'aria-label="Adicionar"' src/app/components/CaptureDeck.tsx
  grep -qF 'enterKeyHint="done"' src/app/components/CaptureDeck.tsx
  grep -qF 'Captura indisponível sem conexão.' src/app/components/CaptureDeck.tsx
  grep -qF 'env(safe-area-inset-bottom,0px)' src/app/components/CaptureDeck.tsx
  if grep -nE 'className=.*\bfixed\b' src/app/components/CaptureDeck.tsx; then
    echo "FAIL: the deck is an in-flow grid row, never a fixed-position element"; exit 1
  fi
  grep -q 'export function EmptyState' src/app/components/EmptyState.tsx
  grep -qF 'Nada para hoje.' src/app/components/EmptyState.tsx
  grep -qF 'Bora capturar a primeira?' src/app/components/EmptyState.tsx
  grep -qF '>Nova tarefa</Button>' src/app/components/EmptyState.tsx
  npx tsc -b
  ```
- Delivers AC-A2, AC-A7, AC-A10.

### Task 5: CREATE `src/app/components/TaskRow.tsx` and `src/app/components/InlineTitle.tsx`

- **ACTION**: `TaskRow.tsx` exports
  `export function TaskRow({ task, today, busy, editing, onToggle, onOpen, onEdit, onCommitTitle, onCancelEdit }: { task: TaskDto; today: string; busy: boolean; editing: boolean; onToggle: (next: boolean) => void; onOpen: () => void; onEdit: () => void; onCommitTitle: (title: string) => void; onCancelEdit: () => void })`:
  an `<li className="flex min-h-16 items-center gap-2 rounded-card bg-surface-2 py-2 pr-2 pl-2 shadow-row [content-visibility:auto] [contain-intrinsic-size:auto_64px]">`
  with three parts. (1) `CompleteControl` with `checked={task.status !== "open"}`,
  `label` = `Concluir ${task.title}` for an open Task and `Reabrir ${task.title}`
  for a closed one, `disabled` when `task.status === "missed"` (terminal,
  ADR-0006) or `busy`. (2) The row body: when `editing` is false, a
  `<button type="button" onClick={onOpen} className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center rounded-control bg-transparent text-left">`
  holding the title `<span className="line-clamp-2 w-full font-text text-t3 font-medium text-ink">`
  (with `text-muted line-through` when `task.status === "done"`) and, when
  `taskMetaLine(task, today)` is not `null`, the meta line
  `<span className="font-data text-t1 font-medium text-muted tabular-nums">`
  carrying the text, with `text-overdue` added only when `overdue` is true
  and a small `ChevronUp` / `ChevronDown` glyph (`aria-hidden="true"`)
  before the word *alta* / *baixa*; when `editing` is true, the body is
  `<InlineTitle task={task} onCommit={onCommitTitle} onCancel={onCancelEdit} />`.
  (3) For an open Task only, the single trailing element:
  `<Button variant="icon" aria-label={`Editar título de ${task.title}`} onClick={onEdit} disabled={busy}>`
  with a `Pencil` icon (`aria-hidden="true"`) — never a chevron, never a
  delete. The completion moment: when the control is checked on an open
  Task, the row sets `data-completing` on itself and plays the `praesto-leave`
  animation (Task 7) on the `<li>` while the control's ring plays
  `praesto-complete`; `onToggle(true)` is called from the `<li>`'s
  `onAnimationEnd`, so the optimistic status change and the move to
  *Concluídas* happen after the ring fired — under `prefers-reduced-motion`
  the tokens shorten both animations, nothing is removed. Reopening calls
  `onToggle(false)` immediately.
  `InlineTitle.tsx` exports
  `export function InlineTitle({ task, onCommit, onCancel }: { task: TaskDto; onCommit: (title: string) => void; onCancel: () => void })`:
  an `<input>` seeded with `task.title`, `aria-label={`Editar título de ${task.title}`}`,
  `className="min-h-12 min-w-0 flex-1 rounded-control border border-line-strong bg-surface-1 px-3 font-text text-t3 text-ink outline-none"`,
  focused on mount (programmatic focus after the pencil tap — not the
  `autofocus` attribute), committing on Enter and on blur through the exact
  `commit()` rule of the old `InlineTitle` (trimmed; empty or unchanged → no
  request, just leave edit mode), and calling `onCancel` on Escape.
- **MIRROR**: `# SOURCE: src/app/components/ui/CompleteControl.tsx:18-31`
  (the control the row leads with), `# SOURCE: src/shared/format.ts:121-124`
  (the meta contract), `# SOURCE: src/app/App.tsx:357-362` (the commit rule
  copied into `InlineTitle`).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function TaskRow' src/app/components/TaskRow.tsx
  grep -qF 'CompleteControl' src/app/components/TaskRow.tsx
  grep -qF 'taskMetaLine' src/app/components/TaskRow.tsx
  grep -qF '[content-visibility:auto]' src/app/components/TaskRow.tsx
  grep -qF 'line-clamp-2' src/app/components/TaskRow.tsx
  grep -qF 'Editar título de' src/app/components/TaskRow.tsx
  grep -qF 'data-completing' src/app/components/TaskRow.tsx
  grep -qF 'onAnimationEnd' src/app/components/TaskRow.tsx
  if grep -nE '○|⋯|×|ChevronRight' src/app/components/TaskRow.tsx; then
    echo "FAIL: no glyph buttons, no chevron, no delete on a row"; exit 1
  fi
  grep -q 'export function InlineTitle' src/app/components/InlineTitle.tsx
  grep -qF 'trimmed === "" || trimmed === task.title' src/app/components/InlineTitle.tsx
  grep -qF '"Escape"' src/app/components/InlineTitle.tsx
  npx tsc -b
  ```
- Delivers AC-A1, AC-A3, AC-A4.

### Task 6: CREATE `src/app/components/TodayScreen.tsx`, `src/app/components/TaskDetail.tsx`, `src/app/components/TokenGate.tsx`; UPDATE `src/app/App.tsx`

- **ACTION**: Move `TokenGate` (`src/app/App.tsx:70-115`) into
  `src/app/components/TokenGate.tsx` and `TaskDetail` (`:395-526`) into
  `src/app/components/TaskDetail.tsx` **verbatim**, each file carrying a
  private `styles` object holding only the entries it uses, and a header
  comment stating the file is transitional and is rebuilt in Phase 3 (the
  inline styles and the English labels are allowed there until then). Delete
  `TaskBoard`, the old `InlineTitle` and the shared `styles` object from
  `App.tsx`, so `App.tsx` keeps only the three-valued `authorized` state, the
  `readToken` effect and the switch — rendering `<Skeleton />` while
  `authorized === null` (instead of the "Loading…" paragraph), `<TokenGate>`
  when false, and `<TodayScreen onUnauthorized={…} initialShare={initialShare} />`
  when true — and no longer imports `CSSProperties`. Create
  `src/app/components/TodayScreen.tsx` exporting
  `export function TodayScreen({ onUnauthorized, initialShare }: { onUnauthorized: () => void; initialShare: ShareTarget | null })`
  with this behaviour: state `tasks: TaskDto[] | null`, `loadError: string | null`,
  `captureError: string | null`, `title` (seeded from `initialShare?.title ?? ""`),
  `busy`, `slow` (true once the first load has been pending for 10 s),
  `selectedTaskId`, `editingId`, `doneCollapsed` (initialised from
  `localStorage.getItem("praesto.today.doneCollapsed") === "1"` and written
  back on every toggle; guarded in try/catch like the legacy token storage);
  `today = todayIn(new Date())` and `now = new Date()` computed on render.
  `const { state: connectivity, report } = useConnectivity({ onOnline: () => void refresh() })`
  and `const toast = useToast()`. `handleFailure` keeps the exact shape of the
  old one (a 401 → `onUnauthorized`; otherwise `classifyRequestFailure`) and
  additionally calls `report({ type: "request-failed", kind })` with the
  classification's `kind`; `refresh()` calls `listTasks()`, sets `tasks`,
  clears `loadError` and calls `report({ type: "request-succeeded" })`. An
  effect runs `refresh()` on mount; another adds a `document`
  `visibilitychange` listener that calls `refresh()` when
  `document.visibilityState === "visible"` (removed on unmount); another
  sets `document.title = "Hoje · Praesto Sum"`. Capture: on submit, with the
  trimmed title, `await createTask({ title })`, then `setTitle("")` — only
  after the await, the FR-045 invariant — then `showToast({ key: "task-saved", text: "Tarefa salva" })`
  and `refresh()`; a failure keeps the text and sets `captureError` (the
  deck shows it). Complete: `setTasks` optimistically (the Task with
  `status: "done"` and `completedAt: Math.floor(Date.now() / 1000)`), then
  `await completeTask(id)`; on success
  `showToast({ key: "task-done", text: "Tarefa concluída", action: { label: "Desfazer", run: () => void reopen(id) } })`
  and `refresh()`; on failure restore the previous array and
  `showToast({ key: "task-error", tone: "error", text: classifyRequestFailure(cause).message })`.
  Reopen mirrors it with `status: "open"`, `completedAt: null`,
  `reopenTask(id)` and the toast `Tarefa reaberta` with its own *Desfazer*
  (which completes again). Inline title commit uses `updateTask(id, { title })`
  through the server-first path (busy → request → refresh), exactly as today.
  Render, when `selectedTaskId` names a Task in the list, the moved
  `<TaskDetail>` full-screen (its `onSave` path unchanged: `updateTask`, close
  only after the await); otherwise the shell:
  `<div data-shell className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr_auto_auto] overflow-clip bg-bg">`
  → `<TodayHeader now={now} remaining={open.length} />` → when
  `connectivity !== "online"`, `<Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />`
  (else an empty `<div />` so the grid rows stay fixed) →
  `<main className="flex flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-2">`
  containing: `<Skeleton slow={slow} />` while `tasks === null && loadError === null`;
  when `loadError` is not `null`, `<p role="alert" className="font-text text-t2 text-overdue">{loadError}</p>`
  followed by `<Button variant="secondary" onClick={() => void refresh()}>Tentar de novo</Button>`;
  when `tasks` is an empty array, `<EmptyState onCapture={…} />` (focuses the
  capture input through the ref passed to the deck); otherwise a `<ul className="m-0 flex list-none flex-col gap-2 p-0">`
  of `TaskRow`s for the open Tasks in the API's order and, when any closed
  Task exists, a `<section aria-label="Concluídas">` whose header is a
  `<button type="button" aria-expanded={!doneCollapsed} className="flex min-h-12 w-full items-center gap-2 rounded-control text-left">`
  with `<h2 className="m-0 font-text text-t2 font-semibold text-ink">Concluídas</h2>`,
  the count in `font-data text-t1 font-semibold text-muted tabular-nums`,
  and a `ChevronDown` (`aria-hidden="true"`) rotated 180° when expanded;
  the closed rows render only when expanded. The next grid row is the toast
  slot: when `toast.current` is not `null`,
  `<div className="px-4 pb-2"><Toast toast={toast.current} onAction={…} onSecondary={…} onDismiss={…} /></div>`
  where `onAction` runs `toast.current.action?.run?.()` then
  `dismissToast(key)`, `onSecondary` runs `secondary.run?.()` then
  `dismissToast(key, true)` (remembered — this is *Depois*), `onDismiss`
  runs `dismissToast(key)`; otherwise an empty `<div />`. The last row is
  `<CaptureDeck … autoFocus={true} canWrite={canWrite(connectivity)} inputRef={captureRef} />`
  — `autoFocus` is true here and nowhere else, because the app opens on
  *Hoje*. Row actions (`onToggle`, `onEdit`) are disabled while
  `!canWrite(connectivity)`.
- **MIRROR**: `# SOURCE: src/app/App.tsx:132-141` (`handleFailure`),
  `# SOURCE: src/app/App.tsx:156-166` (the server-first `run` path kept for
  capture and title edits), `# SOURCE: src/app/App.tsx:205-219` (the capture
  invariant), `# SOURCE: index.html:70-75` (the shell bands).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function TodayScreen' src/app/components/TodayScreen.tsx
  grep -qF 'data-shell' src/app/components/TodayScreen.tsx
  grep -qF 'grid-rows-[auto_auto_1fr_auto_auto]' src/app/components/TodayScreen.tsx
  grep -qF 'visibilitychange' src/app/components/TodayScreen.tsx
  grep -qF 'praesto.today.doneCollapsed' src/app/components/TodayScreen.tsx
  grep -qF 'document.title = "Hoje · Praesto Sum"' src/app/components/TodayScreen.tsx
  grep -qF 'text: "Tarefa concluída"' src/app/components/TodayScreen.tsx
  grep -qF 'label: "Desfazer"' src/app/components/TodayScreen.tsx
  grep -qF '>Tentar de novo</Button>' src/app/components/TodayScreen.tsx
  grep -qF '>Concluídas</h2>' src/app/components/TodayScreen.tsx
  grep -qF 'lead="Sem conexão."' src/app/components/TodayScreen.tsx
  grep -q 'export function TaskDetail' src/app/components/TaskDetail.tsx
  grep -q 'export function TokenGate' src/app/components/TokenGate.tsx
  if grep -n 'style={' src/app/App.tsx src/app/components/TodayScreen.tsx src/app/components/TaskRow.tsx src/app/components/InlineTitle.tsx src/app/components/CaptureDeck.tsx src/app/components/TodayHeader.tsx src/app/components/EmptyState.tsx; then
    echo "FAIL: the rebuilt board must carry no inline style object"; exit 1
  fi
  if grep -nF 'CSSProperties' src/app/App.tsx; then
    echo "FAIL: App.tsx must no longer hold the inline styles object"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A3, AC-A5, AC-A7, AC-A8, AC-A9, AC-A10.

### Task 7: UPDATE `src/app/styles.css`

- **ACTION**: Append, after the existing `@layer base` block, an
  `@layer components` block with exactly these rules, written in the shape
  Prettier emits (run `npx prettier --write src/app/styles.css` after
  editing): (1) the keyboard rule of the layout standard §4, anchored on the
  shell element instead of `:root` (MDN advises against anchoring `:has()` on
  the root because every DOM mutation then re-evaluates it):
  `[data-shell]:has(input:focus-visible, textarea:focus-visible) [data-deck] { padding-bottom: var(--space-4); }`
  — the deck's safe-area inset is dropped while a field has focus, because
  the inset does not update under the keyboard; (2)
  `[data-completing] .praesto-ring { animation: praesto-complete var(--duration-complete) var(--ease-standard); }`
  and `[data-completing] { animation: praesto-leave var(--duration-medium) var(--ease-exit) forwards; }`;
  (3) the keyframes: `@keyframes praesto-complete` — from `transform: translateY(2px) scale(0.92); box-shadow: 0 0 0 0 rgb(var(--color-accent-rgb) / 0.45);`
  to `transform: translateY(0) scale(1); box-shadow: var(--halo-done);`
  (the check sinks 2 px and fires one amber ring — ADR-0010) — and
  `@keyframes praesto-leave` — to `opacity: 0; transform: translateX(24px);`.
  Add `className="praesto-ring"` to the inner `<span>` of
  `src/app/components/ui/CompleteControl.tsx` through the `cn()` call so the
  selector matches (the only change to that file). Durations and easings
  come from the tokens, so `prefers-reduced-motion` shortens them through
  `tokens.css` with no extra media query here.
- **MIRROR**: `# SOURCE: src/app/tokens.css:88-98` (the only durations and
  easings the keyframes may reference) and
  `# SOURCE: src/app/components/ui/CompleteControl.tsx:18-31` (the ring the
  animation targets).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF '[data-shell]:has(input:focus-visible, textarea:focus-visible) [data-deck]' src/app/styles.css
  grep -qF '@keyframes praesto-complete' src/app/styles.css
  grep -qF '@keyframes praesto-leave' src/app/styles.css
  grep -qF 'var(--duration-complete)' src/app/styles.css
  grep -qF 'praesto-ring' src/app/components/ui/CompleteControl.tsx
  if grep -nE '[0-9]+ms' src/app/styles.css; then
    echo "FAIL: durations in styles.css must come from the tokens, never a literal"; exit 1
  fi
  if grep -nF ':root:has(' src/app/styles.css; then
    echo "FAIL: anchor :has() on the shell element, not on :root"; exit 1
  fi
  npx prettier --check src/app/styles.css
  ```
- Delivers AC-A3, AC-A8.

### Task 8: UPDATE `src/app/main.tsx`

- **ACTION**: Import `showToast` from `./toast-store` and replace the body of
  the `onNeedRefresh(update)` handler — and only that body — with
  `showToast({ key: "sw-update", text: "Nova versão disponível", action: { label: "Atualizar", run: () => void update() }, secondary: { label: "Depois" } });`
  (the approved copy: **Nova versão disponível** · *Atualizar* / *Depois*).
  Remove the `window.confirm` line and the "Replace with real UI" comment;
  keep `setupPwa`'s position after the render, the `onOfflineReady` handler
  and the persistent-storage request exactly as they are. `update()` is
  `updateSW()`, which posts `SKIP_WAITING` and reloads on Workbox's
  `controlling` event, so the toast needs no reload code of its own; the
  *Depois* secondary is remembered for the session by the store
  (`dismissToast("sw-update", true)`), so the hourly `registration.update()`
  poll cannot re-raise the toast until the next app start.
- **MIRROR**: `# SOURCE: src/app/main.tsx:55-64` (the handler being edited
  in place).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'text: "Nova versão disponível"' src/app/main.tsx
  grep -qF 'label: "Atualizar"' src/app/main.tsx
  grep -qF 'label: "Depois"' src/app/main.tsx
  grep -qF 'key: "sw-update"' src/app/main.tsx
  if grep -rnF 'window.confirm' src/app; then
    echo "FAIL: window.confirm is not UI (guidelines §2.8)"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A6.

### Task 9: UPDATE `src/app/components/DesignPlayground.tsx`

- **ACTION**: Add a `<Section title="Tela Hoje">` after *Componentes* that
  renders, with a fixed `today = "2026-08-21"` and local state only (no API
  call): four `TaskRow`s inside a `<ul>` — open with `deadline: "2026-08-21"`
  and `priority: "high"`, open and overdue with `deadline: "2026-08-18"`,
  `done`, and `missed` — plus one row in `editing` mode; a `Toast` with an
  action (*Tarefa concluída · Desfazer*), a `Toast` without one (*Tarefa
  salva*) and an error toast; the `Banner` with the offline copy; the
  `EmptyState`; the `Skeleton` (with `slow`); and a `CaptureDeck` bound to
  local state with `autoFocus={false}` (the playground never autofocuses).
  Update the header comment's list of what the page now renders. Keep every
  existing section untouched.
- **MIRROR**: `# SOURCE: src/app/components/DesignPlayground.tsx:174-195`
  (how a section registers states).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF '<Section title="Tela Hoje">' src/app/components/DesignPlayground.tsx
  grep -qF 'TaskRow' src/app/components/DesignPlayground.tsx
  grep -qF 'EmptyState' src/app/components/DesignPlayground.tsx
  grep -qF 'Skeleton' src/app/components/DesignPlayground.tsx
  grep -qF 'Banner' src/app/components/DesignPlayground.tsx
  grep -qF 'autoFocus={false}' src/app/components/DesignPlayground.tsx
  grep -qF 'Design — tokens e estados' src/app/components/DesignPlayground.tsx
  npx tsc -b
  ```
- Delivers AC-A11.

### Task 10: UPDATE `documentation/50-planning/roadmap.md` and `documentation/10-product/visual-identity.md`

- **ACTION**: In `documentation/50-planning/roadmap.md`, in the backlog
  table, change the row that begins
  `| Refresh the view when a window returns to the foreground | 2026-08-04 | open |`
  so its state cell reads `done 2026-08-21` and append to its last cell the
  sentence `Closed by the UI/UX plan's A5 phase 2: the Hoje screen refetches on visibilitychange → visible and on reconnect (guidelines §12.4).`;
  the `last_updated` frontmatter already reads `2026-08-21`. In
  `documentation/10-product/visual-identity.md`, add one row to the
  microcopy table, after the *Toasts* row:
  `| List load error | the approved request-error sentence · *Tentar de novo* |`
  (the infinitive retry button the list shows under a failed first load —
  new copy enters the identity doc before code, per the doc's own rule) and
  a History row dated 2026-08-21 naming the addition; keep `last_updated`
  at `2026-08-21`.
- **MIRROR**: `# SOURCE: src/app/App.tsx:132-141` — the failure path whose
  message the new row pairs with the retry button.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF '| Refresh the view when a window returns to the foreground | 2026-08-04 | done 2026-08-21 |' documentation/50-planning/roadmap.md
  grep -qF 'Closed by the UI/UX plan' documentation/50-planning/roadmap.md
  grep -qF '| List load error |' documentation/10-product/visual-identity.md
  grep -qF 'Tentar de novo' documentation/10-product/visual-identity.md
  npx vitest run --project docs
  ```
- Delivers AC-A5 (the refetch rule recorded where the backlog raised it) and
  AC-A10 (the one new string tabled before it enters code).

### Task 11: RUN the gates and the budget probe

- **ACTION**: Run `npm run check`, `npm test` and `npm run build` and confirm
  all three green — a failure is fixed in production code, never in a test.
  Then measure the built bundle against guidelines §11 with the probe below
  and write `PRPs/reports/ui-design-pass/phase-2/build-report.md` with the
  `vite build` size table and the probe output (same shape as the phase-1
  report). The browser-pane Tier A / Tier B check of *Hoje* (checklist items
  1–9, the §8 states simulated, contrast, 375 px) is performed by the main
  session after this task and recorded in the same report.
- **MIRROR**: `# SOURCE: src/app/components/ui/Button.tsx:9-23` — the token
  utilities every new component is written in; the CSS the probe weighs is
  what Tailwind emits for class lists like this one.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  npm run check
  npm test
  npm run build
  node --input-type=module -e '
  import { readdirSync, readFileSync } from "node:fs";
  import { join } from "node:path";
  import { gzipSync } from "node:zlib";
  const dir = "dist/client/assets";
  let js = 0, css = 0;
  for (const f of readdirSync(dir)) {
    const size = gzipSync(readFileSync(join(dir, f))).length;
    if (f.endsWith(".js")) js += size;
    if (f.endsWith(".css")) css += size;
  }
  console.log(`JS ${js} B gzip (budget 174080) · CSS ${css} B gzip (budget 30720)`);
  if (js > 174080 || css > 30720) { console.error("FAIL: guidelines §11 budget exceeded"); process.exit(1); }
  console.log("PASS: inside the §11 budget");
  '
  test -f PRPs/reports/ui-design-pass/phase-2/build-report.md
  ```
- Delivers AC-A12 (and re-verifies AC-A1 through AC-A11 through the suites
  and the build). This task changes no source file; its only write is the
  phase record — it is the infrastructure / gate step of the phase.

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

`npm run check` is `wrangler types --check && tsc -b && eslint . && prettier --check .`
(`package.json`); each stage exits non-zero on failure and `&&` propagates.

**Level 2 — UNIT TESTS**

```bash
set -euo pipefail
npx vitest run --project worker
npx vitest run --project docs
```

`vitest run` exits non-zero when any test fails — no output parsing. The
`worker` project carries the phase-1 suites and whatever the test pair
authors for `src/shared/toast.ts`; the `docs` project guards the derived
docs after Task 10.

**Level 3 — BUILD + STRUCTURAL GATE**

```bash
set -euo pipefail
npm run build
node --input-type=module -e '
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
let js = 0, css = 0;
for (const f of readdirSync("dist/client/assets")) {
  const size = gzipSync(readFileSync(join("dist/client/assets", f))).length;
  if (f.endsWith(".js")) js += size;
  if (f.endsWith(".css")) css += size;
}
if (js > 174080 || css > 30720) { console.error(`FAIL: JS ${js} / CSS ${css} gzip over budget`); process.exit(1); }
console.log(`PASS: JS ${js} B gzip, CSS ${css} B gzip`);
'
if grep -rn "style={" src/app --include="*.tsx" | grep -v "DesignPlayground.tsx" | grep -v "TaskDetail.tsx" | grep -v "TokenGate.tsx"; then
  echo "FAIL: an inline style object survived outside the two transitional files and the playground"; exit 1
fi
if grep -rnF "window.confirm" src/app; then
  echo "FAIL: window.confirm is not UI (guidelines §2.8)"; exit 1
fi
if grep -rnE "textTransform|uppercase" src/app --include="*.tsx"; then
  echo "FAIL: no all-caps UI text (guidelines §9.2)"; exit 1
fi
grep -qF 'text: "Nova versão disponível"' src/app/main.tsx
grep -qF '[content-visibility:auto]' src/app/components/TaskRow.tsx
grep -qF '@keyframes praesto-complete' src/app/styles.css
grep -qF 'visibilitychange' src/app/components/TodayScreen.tsx
if grep -rlF 'tokens e estados' dist/client >/dev/null; then
  echo "FAIL: the /design playground leaked into the production bundle"; exit 1
fi
```

`npm run build` (`tsc -b && vite build`) stays the real Level 3: it
type-checks every new component and bundles Tailwind over the tokens. The
greps pin the phase's structural commitments — no inline style object outside
the two files Phase 3 rebuilds and the playground, no `window.confirm`, no
all-caps, the update toast wired, `content-visibility` on rows, the keyframes
and the visibility refetch present, the playground still absent from the
bundle. **The behaviour of the screen is NOT covered by any command here and
is verified in the browser pane by the main session** — see `## Notes` for
the script.

## Acceptance Criteria

- **AC-A1 (PRD AC-8):** every tappable control on *Hoje* measures ≥ 48 × 48
  CSS px with ≥ 8 px to its neighbours (the completion control, the row body,
  the pencil, the *Concluídas* header, the toast buttons, the submit), every
  Task row is ≥ 64 px tall, the capture field is 56 px and its input ≥ 48 px.
- **AC-A2 (PRD AC-9):** the deck is the only elevated plane (`shadow-deck`),
  its eyebrow *Nova tarefa* is the field's `<label for>`, the submit is the
  icon-only 48 px primary *Adicionar* with the 3 px lower face, `autofocus`
  sits on that field and nowhere else, Enter or the submit creates the Task,
  a failed save keeps the typed text and shows the request-error sentence
  under the field, and while the connectivity state is not `online` the
  field and the submit are disabled with *Captura indisponível sem conexão.*
- **AC-A3 (PRD AC-10):** tapping the completion control of an open Task plays
  the `praesto-complete` ring and the `praesto-leave` row animation (durations
  from the tokens, shortened under reduced motion), moves the Task to
  *Concluídas* immediately (optimistic), shows *Tarefa concluída · Desfazer*
  persisting until used, dismissed or replaced, *Desfazer* reopens it with the
  toast *Tarefa reaberta*, and a failed request rolls the row back and shows
  the request-error sentence as an error toast.
- **AC-A4 (PRD AC-13):** the row's single trailing element is the 48 px
  pencil (*Editar título de …*); tapping it turns the title into an input,
  Enter or blur commits (no request when unchanged or empty), Esc abandons,
  and tapping the row body still opens the detail.
- **AC-A5 (PRD AC-14):** with DevTools Network set to Offline, or the server
  unreachable, the banner *Sem conexão. Dá para ler, mas não para salvar por
  enquanto.* sits under the header, the deck and the row actions are
  disabled, the loaded list stays visible, and on reconnect the banner clears
  and the list refetches; the list also refetches when the tab becomes
  visible again (the roadmap backlog item closes).
- **AC-A6 (PRD AC-15):** on a `npm run preview` build with a newer build
  waiting, the service worker's `waiting` state produces the toast *Nova
  versão disponível · Atualizar / Depois*; *Atualizar* calls `update()` (the
  page reloads on `controlling`); *Depois* dismisses it and it does not
  return in the session.
- **AC-A7 (PRD AC-16):** with zero Tasks the list region shows *Nada para
  hoje. Bora capturar a primeira?* with the *Nova tarefa* CTA that focuses the
  capture field; while the first load is pending the React `Skeleton` mirrors
  the `index.html` silhouette and after ~10 s adds *Ainda carregando…*; a
  failed first load shows the request-error sentence and *Tentar de novo*.
- **AC-A8 (PRD AC-17):** the shell is a `100dvh` grid with `overflow: clip`
  whose list is its own scroll container with `overscroll-behavior: contain`;
  the deck is an in-flow row padded with `env(safe-area-inset-bottom)` that
  drops to the normal padding while a field has focus (the `[data-shell]:has`
  rule); nothing on the screen is `position: fixed`.
- **AC-A9 (PRD AC-2):** `src/app/App.tsx` and every new component under
  `src/app/components/` carry no `style={}` object and no colour literal;
  only `TaskDetail.tsx` and `TokenGate.tsx` (moved verbatim, rebuilt in
  Phase 3) and the playground's dynamic swatches keep inline styles.
- **AC-A10 (PRD AC-3):** every visible string on *Hoje* comes from the
  approved microcopy table (header, deck, rows, section, toasts, banner,
  empty, loading, update) plus the one row Task 10 adds; sentence case,
  infinitive buttons, no all-caps; `<title>` reads *Hoje · Praesto Sum*.
- **AC-A11 (PRD AC-20):** `/design` gains the *Tela Hoje* section rendering a
  row in open, overdue, done, missed and editing states, toasts with and
  without an action, the banner, the empty state, the skeleton and the deck
  — and the production bundle still contains no trace of the playground.
- **AC-A12 (PRD AC-22):** `npm run check`, `npm test` and `npm run build` are
  green with no test weakened, the build report is filed under
  `PRPs/reports/ui-design-pass/phase-2/`, and the browser-pane Tier A / Tier B
  result for *Hoje* is recorded there by the main session.
- **AC-A13 (PRD AC-10, PRD AC-15):** `reduceToast` keeps one toast at a time
  (a `show` replaces the current toast), `expire` clears only a toast without
  an action (`autoDismisses`) and only for the matching key, `dismiss` clears
  the matching toast and, with `remember`, suppresses its key so a later
  `show` of the same key is ignored for the rest of the session — the rule
  that makes *Desfazer* persist and *Depois* stick.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The optimistic complete and the leave animation fight the list re-render (the row disappears before the ring fires, or stays after) | Medium | Medium — the signature moment is the one animation the identity asks for | The row owns the sequence: `data-completing` → CSS animations → `onAnimationEnd` → `onToggle(true)`; the optimistic state change happens only in that callback, so the DOM node survives until its animation ends. Reduced motion shortens both durations through the tokens, never removing the callback |
| A rollback races a refetch (the failed complete's rollback restores a list the next `refresh()` overwrites) | Low | Low | Rollback restores the array captured before the optimistic change and the error toast is shown; a later refetch brings the server truth, which is the state the owner should see anyway |
| `[data-shell]:has(…)` does not fire on the owner's Chrome | Low | Low — the deck keeps its safe-area padding under the keyboard | `:has()` is Baseline since December 2023 (MDN); the rule only removes padding, so a miss degrades to a slightly taller deck |
| `content-visibility: auto` skips the row's leave animation or its intrinsic size jumps | Low | Low | `contain-intrinsic-size: auto 64px` matches the row minimum; the pane check of AC-A3 watches the animation explicitly; if it misbehaves the utility is removed from the open list only |
| The toast slot is a grid row, so a toast shifts the list height by ~56 px while shown | Medium (by design) | Low | Accepted for this phase: the standard puts the toast above the deck; Phase 3 revisits the placement together with the sheet rule (inside the open dialog's subtree) |
| `TaskDetail` and `TokenGate` moved verbatim still carry inline styles and English labels | High (expected) | Low — nothing is deployed before Phase 4 | Named transitional in their headers and in `## NOT Building`; Phase 3 rebuilds both; the Level 3 grep exempts exactly those two files |
| The playground renders `TaskRow` with no API, but `TaskRow` calls `taskMetaLine` with a fixed `today` — the examples drift from real dates | Low | Low | The fixed `today = "2026-08-21"` and the fixture dates are the ones `test/format.test.ts` pins, so the rendered phrases are known |
| The test pair reads the [manual] criteria of this phase as ambiguous | Medium | Medium | Only AC-A13 is automated; the PRD tags AC-8 … AC-17 [manual] and this plan's `## Notes` routes them to the pane script |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **Test-file routing:** this phase's test-file creation and updates are
  routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger
  (`/relay-write-test` → `/relay-test-write-review`), not authored by the
  Implementer — R-X is a blanket straight-fail on any test glob in the
  Implementer's diff. No task above and no `## Files to Change` row targets a
  test file, so this plan's per-task `**VALIDATE**` commands exercise each
  change directly (compiled modules, literal greps, the built bundle); the
  declared framework is invoked only to *run* the existing and pair-authored
  suites (Task 10's `docs` project, Task 11 and Level 2), never to author or
  edit a test. The pair is expected to CREATE `test/toast.test.ts` from
  AC-A13 (the only automated criterion of this phase) and to leave the
  phase-1 suites untouched; the suite is RED for the right reason — module
  missing — until Task 1 lands.
- **What is automated and what is verified by hand.** `src/shared/toast.ts`
  is the one new decidable module; `format.ts` and `connectivity.ts` (phase 1)
  already carry the header, the meta line and the banner rules. Everything
  else in this phase is React glue or markup, verified in the browser pane —
  the split `docs/context/methodology.md` prescribes.
- **Manual verification script (main session, after Task 11, browser pane at
  375 px, dark, `npm run dev`, recorded under
  `PRPs/reports/ui-design-pass/phase-2/`):** (1) open `/` with a stored token
  — the skeleton shows, then *Hoje* with the date and the count; `<title>`
  is *Hoje · Praesto Sum*, one `<h1>`; (2) measure every control ≥ 48 px and
  every row ≥ 64 px (`getBoundingClientRect`); (3) the deck's label is a
  real `<label for>`, the input has focus on open, Enter creates a Task and
  *Tarefa salva* shows for ~4 s; (4) complete a Task — the ring fires, the row
  leaves, the count drops, the toast with *Desfazer* persists; *Desfazer*
  brings it back with *Tarefa reaberta*; (5) tap the pencil — the title
  becomes an input; Esc restores; Enter with a change persists after reload;
  (6) DevTools Network → Offline: the banner appears, the deck shows the
  hint and is disabled, the list stays; Online: the banner clears and the
  list refetches; switch tabs and come back: a `GET /api/tasks` fires;
  (7) empty the local D1 (`npx wrangler d1 execute praesto-db --local --command "DELETE FROM tasks"`)
  and reload: the empty state with *Nova tarefa* focusing the field; (8)
  block `/api/tasks` in DevTools and reload: the request-error sentence and
  *Tentar de novo*; (9) collapse and expand *Concluídas*, reload — the state
  persists; (10) contrast of the five pairs on the row surface and the deck;
  (11) `npm run preview` with a second build: the update toast appears,
  *Depois* hides it, *Atualizar* reloads; (12) screenshots, or the written
  reason none exists.
- **Divergences to settle at A6 (recorded, not decided here):** (a) the
  layout standard §2.6 says "title on one line with ellipsis" while guidelines
  §12.4 say "titles wrap to 2 lines then ellipsis" — this plan follows the
  guidelines (they sit above the standard) with `line-clamp-2`, and the
  standard should say so; (b) the standard §2.7 empty state ("no duplicate
  button") predates the approved microcopy (*Nada para hoje.* + CTA *Nova
  tarefa*) and the PRD's AC-16 — the PRD wins; (c) standard §4's
  `:root:has(input:focus-visible…)` is anchored on the shell element here on
  MDN's advice — the standard should name the shell.
- **Why the toast is not a `popover="manual"` yet.** The research confirmed
  that a manual popover in the top layer becomes inert under a later
  `showModal()` dialog unless it lives inside the dialog's subtree — exactly
  the standard's §2.8 rule. With no dialog on the screen in this phase, an
  in-flow grid row above the deck is simpler and fully visible; Phase 3,
  which adds the native sheet, moves the toast into the sheet's subtree when
  one is open.
- **Research grounding.** `research-codebase` returned 8 findings (scope cap
  reached; every `# SOURCE:` anchor above was re-opened at the cited lines in
  the main session — `App.tsx` boundaries 26-68 / 70-115 / 117-319 / 329-384
  / 395-526 / 528-566, `main.tsx` 56-64, `CompleteControl.tsx` 19-29,
  `format.ts` 121-124, `index.html` 70-75; gaps: no `popover`/`aria-live`/
  optimistic pattern exists yet, no component test tier) and `research-web`
  returned 8 findings (scope cap reached): top-layer stacking follows
  promotion order (https://www.htmhell.dev/adventcalendar/2025/1/); a
  `popover="manual"` is inert under `showModal()` unless inside the dialog
  (https://www.oidaisdes.org/blog/native-dialog-and-popover/); `role=status`
  implies `aria-live=polite`
  (https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role);
  `interactive-widget=resizes-content` shrinks the layout viewport and fixed
  elements drift (https://developer.chrome.com/blog/viewport-resize-behavior);
  the vite-plugin-pwa prompt flow is `onNeedRefresh` → `updateSW()`
  (https://vite-pwa-org.netlify.app/guide/prompt-for-update.html), which
  reloads on Workbox's `controlling` event
  (https://github.com/vite-pwa/vite-plugin-pwa/blob/main/src/client/build/register.ts);
  `content-visibility: auto` + `contain-intrinsic-size`
  (https://web.dev/articles/content-visibility); MDN advises against anchoring
  `:has()` on `:root` (https://developer.mozilla.org/en-US/docs/Web/CSS/:has).
  Open gap from the web agent: the interaction of `content-visibility: auto`
  with a leave animation on the toggled row is unverified — watched in the
  pane script, step 4.
- **Not changed in this phase, on purpose:** `src/app/pwa.ts`, `src/sw.ts`,
  `src/app/api.ts`, `src/app/tokens.css`, `src/app/components/ui/Sheet.tsx`
  (Phase 3), `index.html`, every route and test file.

*Generated: 2026-08-21*
*Approved: 2026-08-21*
*Implemented: 2026-08-21*
*Status: IMPLEMENTED*
