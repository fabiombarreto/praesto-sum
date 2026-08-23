# Feature: Detail sheet, delete confirmation and token gate (Phase 3 of ui-design-pass)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: cross-cutting artifact (a plan the Implementer consumes); swaps the app's only dialog primitive (Sheet) from Base UI Dialog to a native <dialog>; adds the first irreversible destructive action of the UI (delete) behind the guidelines §8 confirmation; rebuilds the two last inline-styled screens (the detail, the token gate); Task domain rules (the PATCH diff, date exclusivity) are consumed, not changed
- Decisions found:
  - ADR-0009 — visible copy in pt-BR from the approved microcopy table; identifiers, comments and keys stay English
  - ADR-0010 — tokens.css is machine truth; `#ff5c1f` only for live and overdue, never for a destructive button; relief only on controls, the deck and the field
  - ADR-0011 — owned components under src/app/components/ui/ (cva + cn, Base UI data attributes); "native first": the Sheet moves to a native <dialog> and the Base UI Dialog import goes away while Button, Checkbox and Toggle stay on Base UI
  - ADR-0003 — no offline writes: `canWrite` still gates every write; create, edit and delete wait for the server (guidelines §8)
  - ADR-0008 + docs/context/methodology.md — tdd: true; the decidable slice of this phase (the sheet's view / draft state machine) is a pure reducer in src/shared authored test-first; the dialog, the fields and the token gate are React glue verified in the browser pane and on the device
  - Layout standard §3 (native <dialog> sheets with showModal(), bottom-docked on compact, centred 560 px from 600 dp, no light dismiss on an editor, never stack sheets, the draft kept in memory on close; the detail content order) and §2 item 8 (the toast rendered inside the open dialog's subtree); guidelines §2.2 (Android back is a close request), §8 (irreversible delete: one confirmation repeating the verb, destructive button second, default focus on Cancelar; dirty editor closed keeps the draft), §10 (labels, focus returns to the opener, explicit Salvar) and §12.5 (native <input type="date">; autofocus only on the capture input)
  - Owner, 2026-08-21 — the row opens the sheet; PRD Decisions Log: native <dialog> with the same Sheet API; *Excluir* lives in the sheet and the confirmation replaces the sheet's content in place; rows carry no delete
  - PRD Open Question 1 — the Android back gesture is verified on the owner's phone; the fallback (a history entry pushed on open, popped on close, inside Sheet) is switched on only if that check fails
- Applicable anti-patterns:
  - Weakening tests to force green — no task touches test/; the test pair owns the new suite for src/shared/task-sheet.ts
  - Portuguese in artifacts — carve-out: only UI string values are pt-BR
  - Offline write queue — none; the sheet's Salvar and Excluir wait for the server and surface the request error in place
  - Hand-duplicated entity types — TaskDto and TaskDraft stay the only shapes; buildTaskPatch keeps owning the diff
  - Version ranges — no package added; @base-ui/react stays pinned (Dialog is simply no longer imported)
  - `outline: none` without a replacement (phase 2's pane finding) — no input in this phase carries `outline-none`
- Applicable architectural rules:
  - src/shared stays DOM-free and dependency-free (the sheet reducer takes events, never a dialog element)
  - tokens.css is the only style scale: after this phase no file under src/app carries a `style={}` object except the playground's dynamic swatches (PRD AC-2 completes)
  - One Worker; no API, schema or service-worker change; src/app/api.ts keeps updateTask / deleteTask / saveToken as they are
  - UI verification stays manual: the browser-pane Tier A / Tier B check of the sheet and the gate is the main session's job after implementation; the back gesture is the owner's device check
  - Pillar 2 never commits
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/ui-design-pass.prd.md` — Implementation Phases row 3: "Detail
  sheet, delete confirmation and token gate" — Goal: everything one tap away
  works through the native sheet, destructive actions follow §8, and the
  first-run screen carries the identity — Success signal: Tier A/B ✔ for the
  sheet and the gate; the back gesture verified on the phone (or the fallback
  switched on and verified); the 2026-08-19 findings list at 0 open.

## Summary

This phase finishes the screens of activity A5. The owned `Sheet` keeps its
`{ open, onOpenChange, title, children }` API but becomes a native `<dialog>`
opened with `showModal()` — bottom-docked with a handle on compact widths,
centred at 560 px from 600 px, slid in with `@starting-style` and
`transition-behavior: allow-discrete`, closed by Esc, the close button and the
Android back gesture through the platform's own close request, with focus
returning to the row natively and the page scroll-locked behind it. The old
full-screen `TaskDetail` gives way to `TaskSheet`: the Task title as the
sheet's heading, *Título* and *Descrição* fields, the date as the three chips
*Sem data · Concluir até · Fazer em* plus the native date input, the priority
chips *Alta · Normal · Baixa*, *Cancelar / Salvar*, and *Excluir* at a
distance — which swaps the sheet's content for the in-place confirmation
*Excluir esta tarefa? Não dá para desfazer.* (*Cancelar* focused, *Excluir*
second) without ever stacking a second sheet. *Salvar* sends only the diff
`buildTaskPatch` computes and closes with *Tarefa salva*; a failed request
keeps the sheet open with the sentence under *Salvar*; a confirmed delete
closes with *Tarefa excluída*; a draft edited then closed is restored when the
same Task is reopened in the session. All of that state — which view the
sheet shows, which Task it edits, the per-Task drafts — is a pure reducer in
`src/shared/task-sheet.ts`, the one new decidable module, authored
test-first. The token gate is rebuilt on the tokens with the flat mark and the
`praesto` wordmark, a visible *Token da API* label, *Salvar*, and the reason
*Este dispositivo precisa do token de novo.* when a 401 sent the owner back to
it; `App.tsx` carries that reason and nothing else new. With `TaskDetail.tsx`
deleted and `TokenGate.tsx` rebuilt, no inline `styles` object survives
anywhere under `src/app/` (PRD AC-2 completes), and dropping the Base UI
`Dialog` import shrinks the bundle. The `/design` playground gains the task
sheet in both views and the confirmation so the pane can measure them
without a token.

## User Story

```
As the owner
I want the second moment of every Task — deciding when, how important, and
whether it still belongs — to happen in a sheet that the back gesture closes,
that never loses what I typed, and that asks once before deleting
So that nothing one tap away feels like a different app, and a slip of the
thumb never costs me a Task
```

## Problem Statement

After phase 2 the *Hoje* screen is the standard's, but a row tap still
replaces the whole shell with the 2026-08-03 `TaskDetail`
(`src/app/components/TaskDetail.tsx:56-154`): English labels, radio buttons,
a `<select>`, the inline `styles` object, "← Back" as the only way out with
no history entry — so the Android back gesture leaves the app (checklist
finding of 2026-08-19, `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md:28,40`) —
and no delete at all since the row's `×` went (the phase-2 plan accepted that
gap on purpose). `TokenGate.tsx` is the other survivor: 41 px controls,
English copy, a placeholder for a label (`checklist-run-2026-08-19.md:37,41`),
and no way to tell the owner *why* he is back on it after a 401
(`src/app/App.tsx:53` passes a bare `onUnauthorized`). The `Sheet` primitive
still wraps Base UI's `Dialog`, whose popup is a `<div>` — the layout standard
§3 and ADR-0011 asked for a native `<dialog>` precisely so that back = close
is the platform's behaviour, not a history trick. Until these three surfaces
exist, PRD AC-2, AC-3 (gate + sheet), AC-11 and AC-12 stay open and the
findings list cannot reach zero.

## Solution Statement

Build the three surfaces on what phases 1–2 left ready, and move the only
new decidable logic out of React first. `src/shared/task-sheet.ts` owns the
sheet's state machine — `open(task)` seeds or restores the Task's draft,
`edit(changes)` updates it, `request-delete` / `cancel-delete` switch the view
between `detail` and `confirm`, `close` hides the sheet and keeps every draft,
`saved` / `deleted` drop the draft of that Task — and exposes `draftFromTask`
(the seed `TaskDetail` computed inline) and `currentDraft`. `Sheet.tsx`
renders a `<dialog data-sheet>` driven by a ref: `showModal()` when `open`
turns true, `close()` when it turns false, the `close` event feeding
`onOpenChange(false)` so Esc, the close button and the back gesture all flow
through one path; `closedby` is left at its `closerequest` default (no light
dismiss on an editor); `styles.css` adds the slide-up transition
(`translate` + `overlay` + `display` with `allow-discrete`, durations and
easings from the tokens), the backdrop fade and `html:has(dialog[open]) {
overflow: hidden }`. `TaskSheet.tsx` composes the fields from `ChipGroup` /
`Chip` (single-select), the native date input, token-styled text fields with
real `<label for>`s, the `Cancelar / Salvar` pair, the distant *Excluir*
(ghost, icon + text), the `ConfirmView` primitive for the in-place
confirmation, and a slot where `TodayScreen` hands it the current toast while
the sheet is open — the standard's "toast inside the open dialog's subtree"
rule, without a `popover`. `TodayScreen` replaces `selectedTaskId` and the
early-return with `useReducer(reduceTaskSheet, …)`, a `runSheet` mutation path
whose errors land under *Salvar* or under the confirmation, the *Tarefa salva*
and *Tarefa excluída* toasts, and `deleteTask`. `TokenGate.tsx` is rebuilt on
the tokens with a `reason` prop `App.tsx` sets on a 401. The playground
registers the sheet in both views and the confirmation with fixture data.
Nothing about the API, the service worker, the fonts or the shell changes.

## Metadata

| Key | Value |
|---|---|
| Type | UI phase (the detail sheet and the token gate) + one small pure module + the dialog primitive swap |
| Complexity | Medium–high — a native dialog with transitions and focus rules, a two-view editor with per-Task drafts, a destructive flow; no API change |
| Systems Affected | `src/shared/task-sheet.ts` (new), `src/app/components/ui/Sheet.tsx`, `src/app/components/ui/ConfirmView.tsx` (new), `src/app/components/TaskSheet.tsx` (new), `src/app/components/TodayScreen.tsx`, `src/app/components/TaskDetail.tsx` (deleted), `src/app/components/TokenGate.tsx`, `src/app/App.tsx`, `src/app/styles.css`, `src/app/components/DesignPlayground.tsx`, `PRPs/reports/ui-design-pass/phase-3/` |
| Dependencies | Phase 2 (`implemented`): `TodayScreen` and its row `onOpen`, the toast store and `Toast`, `ChipGroup` / `Chip`, `Button`, the tokens and `styles.css`, `src/shared/task-edit.ts` (`buildTaskPatch`, `dateModeOf`, `TaskDraft`) |
| Estimated Tasks | 8 |
| Source PRD line ref | `PRPs/prds/ui-design-pass.prd.md:415` (Implementation Phases row 3); Phase Details at `:462-465`; the criteria at `:175-176, 181, 184-185, 191, 193-195` (AC-2, AC-3, AC-8 for the two rebuilt screens, AC-11, AC-12, AC-18 for the budget, AC-20, AC-22) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/ui-design-pass.prd.md` | 175-176, 184-185, 193-195, 232, 234, 259-260, 266, 268-269, 331-344, 389-391, 400, 462-465, 481-482 | The AC text verbatim (AC-2, AC-3, AC-11, AC-12, AC-20, AC-22), the MoSCoW rows for the sheet and the gate, the microcopy rows (token gate, toasts, detail sheet, `<title>`), the Architecture Notes on the native `Sheet` and the toast placement, "no API change", the back-gesture risk row, this phase's own scope, and the two Decisions Log rows (sheet primitive; delete placement) |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 34, 38-42, 46 | The toast inside an open `<dialog>` subtree; the sheet anatomy (native `<dialog>` + `showModal()`, handle, `max-height: 90dvh`, internal scroll, centred at 560 px from 600 dp, back/Esc close, focus returns natively, the scroll lock, never stack, no light dismiss on an editor, draft kept in memory); the detail content order; the keyboard decision the sheet must respect |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 32-33, 38, 43, 51, 54, 65-66, 76-90, 108-117, 137-142 | Back as a close request; sheets and toasts carry no safe-area padding; destructive actions get distance, confirmation or undo; the live colour is never a button colour; focus visible without `outline: none`; icon + text on destructive actions; the §8 table (pending request, request error under *Salvar*, toast, irreversible delete, dirty editor); the Level A rules that bite (labels, focus returns to the opener, explicit *Salvar*, native elements); §12 component rules (owned components, tokens only, pt-BR literals, native date input, `autofocus` only on capture, manual verification) |
| P0 | `src/app/components/ui/Sheet.tsx` | 1-47 | The primitive being swapped: its API (kept verbatim), its compact / 560 px geometry, the handle, the title row and the *Fechar* close button, and its own note that A5 swaps the primitive |
| P0 | `src/app/components/TaskDetail.tsx` | 24-43, 131-152 | The props, the draft seed (`dateModeOf`, `deadline ?? scheduledDate ?? ""`) that moves into `draftFromTask`, and the save rule (empty patch = close without a request) that `TodayScreen` keeps |
| P0 | `src/app/components/TodayScreen.tsx` | 48-69, 73-82, 96-109, 218-240, 336-364 | The screen state this phase rewires (the `selectedTaskId` early-return goes), `handleFailure` (the 401 route), `run` (the server-first mutation path `runSheet` mirrors), the toast host row that moves inside the sheet while it is open, and the deck the sheet sits after |
| P0 | `src/app/components/TokenGate.tsx` | 9-54 | The gate being rebuilt: the `saveToken` submit path and the "never lose what was typed" comment that survive, the English strings and inline styles that do not |
| P0 | `src/app/App.tsx` | 16-54 | The three-valued token state and the screen switch that gain the 401 reason |
| P0 | `src/shared/task-edit.ts` | 26-38, 50-67 | `TaskDraft`, `dateModeOf`, `buildTaskPatch` — the shapes and the diff the sheet consumes unchanged |
| P0 | `documentation/10-product/visual-identity.md` | 79-80, 83, 91-92, 98, 101 | The approved strings: saved / completed, the delete confirmation, the token rejected reason, the token gate copy and its tested store failure, the toasts, the detail sheet labels and chips |
| P1 | `src/app/components/ui/Chip.tsx` | 10-46 | `ChipGroup` (`multiple` defaults to `true` — the sheet passes `false`) and `Chip` (pressed = fill + weight + check, never colour alone) |
| P1 | `src/app/components/ui/Button.tsx` | 9-23 | The variants: `secondary` for *Cancelar* and both confirmation buttons, `primary` for *Salvar*, `ghost` for *Excluir* in the detail, `icon` for *Fechar* |
| P1 | `src/app/components/ui/Toast.tsx` | 11-53 | The toast element `TodayScreen` builds once and hands to whichever host is active (the shell row or the open sheet) |
| P1 | `src/app/components/InlineTitle.tsx` | 21-25 | Programmatic focus after a tap — the idiom `ConfirmView` uses to focus *Cancelar* and `Sheet` uses to land focus on the dialog itself |
| P1 | `src/app/styles.css` | 49-68, 70-77 | The base layer (the `:focus-visible` ring every field must keep) and the components layer the dialog rules join |
| P1 | `src/app/tokens.css` | 45-57, 88-98 | `--elevation-deck` (the sheet's plane), `--duration-medium` and the three easings the transition reads, the reduced-motion overrides |
| P1 | `src/app/components/DesignPlayground.tsx` | 121-128, 263-281, 285-345 | The playground state, the existing chips / mark / sheet demo to update, and the *Tela Hoje* section whose shape the new *Sheet de tarefa* section follows |
| P1 | `src/app/api.ts` | 50-75, 113-133 | The 401 path (`clearToken` then `ApiError(401)`), `updateTask`, `deleteTask` |
| P1 | `src/worker/auth.ts` | 11-26 | The 401 body `{ error: "Unauthorized" }` — the reason the gate shows is the app's sentence, never that string |
| P1 | `src/worker/routes/tasks.ts` | 149-158, 255-262 | PATCH rejects an empty body (why an empty patch never becomes a request); DELETE answers 204 |
| P1 | `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md` | 28, 37, 40-43 | The findings this phase closes: back leaves the app, 41 px gate controls, placeholder-only token field, delete without confirmation |
| P2 | `docs/context/methodology.md` | 37-61 | The "split the logic out, then the glue is exempt" rule — why the reducer is tested and the dialog is verified by hand |
| P2 | `test/task-edit.test.ts` | 35-44 | The `draftOf` helper that mirrors the seed `draftFromTask` formalises — the test pair can reuse its shape |

## Patterns to Mirror

```tsx
# SOURCE: src/app/components/ui/Sheet.tsx:11-21
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
```

The API that survives the swap byte for byte: `DesignPlayground.tsx:277`
already calls it, `TaskSheet` calls it the same way. Only the body changes —
a `<dialog>` driven by a ref instead of `Dialog.Root`. Kept by Task 2.

```ts
# SOURCE: src/app/components/TaskDetail.tsx:37-43
  const [draft, setDraft] = useState<TaskDraft>({
    title: task.title,
    description: task.description ?? "",
    dateMode: dateModeOf(task),
    date: task.deadline ?? task.scheduledDate ?? "",
    priority: task.priority,
  });
```

The draft seed, computed inline today and lost on every close. It becomes
`draftFromTask(task)` in `src/shared/task-sheet.ts`, and the reducer keeps one
draft per Task id for the session — the AC-12 restore rule. Moved by Task 1.

```tsx
# SOURCE: src/app/components/TaskDetail.tsx:136-145
          onClick={() => {
            const changes = buildTaskPatch(task, draft);
            // Nothing changed: the route rejects an empty body by design, so
            // never issue the request at all.
            if (Object.keys(changes).length === 0) {
              onClose();
              return;
            }
            onSave(changes);
          }}
```

The save rule: the diff comes from `buildTaskPatch`, and an empty diff closes
the sheet without a request. `TodayScreen`'s `saveSheet` keeps it verbatim.
Mirrored by Task 5.

```ts
# SOURCE: src/app/components/TodayScreen.tsx:96-109
  /** The server-first mutation path (busy → action → refresh) — capture and inline title edits. */
  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      setCaptureError(null);
      await refresh();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setCaptureError(message);
    } finally {
      setBusy(false);
    }
  }
```

The path *Salvar* and *Excluir* take (guidelines §8: create, edit and delete
wait for the server), with one difference — the failure message lands in the
sheet (`sheetError`), not under the capture field. Mirrored by Task 5 as
`runSheet`.

```ts
# SOURCE: src/app/components/TodayScreen.tsx:73-82
  /** A 401 routes to the token gate; otherwise reports the failure kind and returns its message (`null` on the 401 route, since the caller is about to unmount). */
  function handleFailure(cause: unknown): string | null {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return null;
    }
    const failure = classifyRequestFailure(cause);
    report({ type: "request-failed", kind: failure.kind });
    return failure.message;
  }
```

The one failure path; `onUnauthorized` is the hook `App.tsx` uses to set the
gate's reason. Unchanged; consumed by Task 5 and Task 6.

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:336-353
      {currentToast !== null ? (
        <div className="px-4 pb-2">
          <Toast
            toast={currentToast}
            onAction={() => {
              currentToast.action?.run?.();
              dismissToast(currentToast.key);
            }}
            onSecondary={() => {
              currentToast.secondary?.run?.();
              dismissToast(currentToast.key, true);
            }}
            onDismiss={() => dismissToast(currentToast.key)}
          />
        </div>
      ) : (
        <div />
      )}
```

The toast host. The element is built once into `toastElement` and rendered
here only while the sheet is closed; while it is open the same element is
handed to `TaskSheet`'s `toastSlot`, inside the dialog's subtree, where it is
not inert. Rewired by Task 5.

```tsx
# SOURCE: src/app/components/ui/Chip.tsx:36-46
export function Chip({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Toggle
      value={value}
      className="inline-flex min-h-12 flex-none items-center gap-1 rounded-pill border border-line bg-surface-2 px-3 font-text text-t2 font-medium whitespace-nowrap text-ink data-pressed:border-transparent data-pressed:bg-accent data-pressed:font-semibold data-pressed:text-on-accent"
    >
      <Check className="hidden size-4 in-data-pressed:block" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </Toggle>
  );
}
```

The chips the sheet's date mode and priority are built from — 48 px pills,
pressed = fill + weight + check. `ChipGroup multiple={false}` makes each group
exclusive; an empty selection maps to *Sem data* / no priority. Consumed by
Task 4.

```tsx
# SOURCE: src/app/components/InlineTitle.tsx:21-25
  useEffect(() => {
    // Programmatic focus after the pencil tap — not the `autofocus`
    // attribute, which guidelines §12.5 reserves for the capture field.
    inputRef.current?.focus();
  }, []);
```

Focus management by effect, never `autofocus`: `ConfirmView` focuses
*Cancelar* on mount this way (guidelines §8), and `Sheet` lands focus on the
dialog itself after `showModal()` so no field pops the keyboard on the phone.
Mirrored by Task 2 and Task 3.

```tsx
# SOURCE: src/app/components/TokenGate.tsx:17-38
      <form
        style={styles.row}
        onSubmit={async (event) => {
          event.preventDefault();
          const token = value.trim();
          if (!token) return;
          try {
            await saveToken(token);
          } catch (cause) {
            // `saveToken` rejects in exactly one case: the token reached
            // NEITHER store (`src/shared/token-store.ts`). That message is
            // written for the owner and pinned by a test, so surface it as-is
            // instead of restating it here. `value` is deliberately not
            // cleared — the same "never lose what was typed" invariant the
            // capture form keeps (FR-045).
            setError(cause instanceof Error ? cause.message : "Could not store the API token.");
            return;
          }
          setError(null);
          onAuthorized();
        }}
      >
```

The gate's submit path and its two invariants (the store's message surfaces
verbatim; the typed value survives a failure) stay; the `style` prop, the
English fallback string and the placeholder-as-label go. Rebuilt by Task 6.

```tsx
# SOURCE: src/app/App.tsx:50-53
  if (!authorized) {
    return <TokenGate onAuthorized={() => setAuthorized(true)} />;
  }
  return <TodayScreen onUnauthorized={() => setAuthorized(false)} initialShare={initialShare} />;
```

The screen switch; it gains one piece of state — why the gate is showing —
set on the 401 route and cleared when a token is saved. Edited by Task 6.

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

The shape every `src/shared` reducer follows (a total switch over a
discriminated event union, a new state or the same object, no mutation) —
`src/shared/toast.ts` (phase 2) did the same; `reduceTaskSheet` does too.
Mirrored by Task 1.

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

The owned-component idiom every new file is written in (token utilities,
`cva` where there are variants, `cn()` for composition). *Salvar* is
`primary`, *Cancelar* and both confirmation buttons `secondary`, *Excluir* in
the detail `ghost` with `text-muted`, *Fechar* `icon`. Mirrored by Task 3,
Task 4 and Task 6.

```css
# SOURCE: src/app/styles.css:70-77
@layer components {
  /* Layout standard §4: the deck's safe-area inset does not update under the
     keyboard, so it is dropped while a field has focus. Anchored on the
     shell element rather than :root — MDN advises against anchoring :has()
     on the root, since every DOM mutation then re-evaluates it. */
  [data-shell]:has(input:focus-visible, textarea:focus-visible) [data-deck] {
    padding-bottom: var(--space-4);
  }
```

The components layer the dialog rules join: a data-attribute selector, a
comment naming the standard's rule, durations and easings read from the
tokens. Extended by Task 2.

```tsx
# SOURCE: src/app/components/DesignPlayground.tsx:274-281
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Abrir sheet de exemplo
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Sheet de exemplo">
            <p className="font-text text-t2 text-ink">
              Um corpo curto para mostrar a folha, ainda sobre o Base UI Dialog nesta fase.
            </p>
          </Sheet>
```

How the playground exercises the sheet — a button and a controlled `open`.
The body text changes with the primitive, and a *Sheet de tarefa* section
registers `TaskSheet` in both views the same way. Updated by Task 7.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/task-sheet.ts` | CREATE | The pure sheet state machine (which Task, which view, one draft per Task kept for the session) + `draftFromTask` / `currentDraft` — the decidable slice of this phase, authored test-first |
| `src/app/components/ui/Sheet.tsx` | UPDATE | Native `<dialog>` with `showModal()` / `close()` driven by `open`, the `close` event → `onOpenChange(false)`, focus on the dialog itself, same API, same geometry; the Base UI `Dialog` import goes |
| `src/app/styles.css` | UPDATE | The sheet transition (`translate` / `overlay` / `display` with `allow-discrete`, `@starting-style`), the backdrop fade, the scroll lock `html:has(dialog[open])` |
| `src/app/components/ui/ConfirmView.tsx` | CREATE | The in-place confirmation primitive (heading, body, optional error, *Cancelar* focused first, destructive button second with icon + text) |
| `src/app/components/TaskSheet.tsx` | CREATE | The detail editor inside `Sheet`: title / description fields, date chips + native date input, priority chips, *Cancelar / Salvar*, the distant *Excluir*, the confirmation view, the toast slot |
| `src/app/components/TodayScreen.tsx` | UPDATE | `useReducer(reduceTaskSheet)` replaces `selectedTaskId` and the early-return; `runSheet`, `saveSheet`, `deleteSheetTask`; the toast element hosted in the shell row or inside the sheet; `deleteTask` imported |
| `src/app/components/TaskDetail.tsx` | DELETE | The transitional full-screen detail — the last inline-styled screen part — replaced by `TaskSheet` |
| `src/app/components/TokenGate.tsx` | UPDATE | Rebuilt on the tokens: flat mark + `praesto` wordmark as the `<h1>`, the 401 reason, the instruction, a visible *Token da API* label, *Salvar*, the store failure under the form; `<title>` restored to *Praesto Sum* |
| `src/app/App.tsx` | UPDATE | Holds the gate reason (`"unauthorized"` after a 401, `null` otherwise) next to the token state; header comment updated |
| `src/app/components/DesignPlayground.tsx` | UPDATE | The sheet demo's body text; a *Sheet de tarefa* section with `TaskSheet` (detail and confirmation views over the fixture Task) and a standalone `ConfirmView` |
| `PRPs/reports/ui-design-pass/phase-3/build-report.md` | CREATE | The phase record: the `vite build` size table (the Base UI Dialog removal measured), the §11 probe output, and (added by the main session) the browser-pane Tier A / Tier B result for the sheet and the gate plus the owner's device check of the back gesture |

## NOT Building (Scope Limits)

- **No change to the API, the schema, the service worker, the fonts, the
  manifest or `index.html`** — `updateTask`, `deleteTask` and `saveToken` are
  called as they are; `buildTaskPatch` keeps owning the diff.
- **No second dialog, ever** — the confirmation is a view inside the same
  sheet (standard §3 "never stack sheets"); a close request from the
  confirmation closes the whole sheet without deleting.
- **No `popover="manual"` toast region** — the toast is rendered inside the
  open dialog's subtree through a slot, which is the standard §2 item 8 rule
  and needs no top-layer element of its own.
- **No light dismiss** (`closedby="any"`) on the editor — the standard allows
  it only on the future filter sheet.
- **No history fallback switched on** — the native close request is the
  platform's own behaviour (MDN: the `cancel` event fires for Esc and "the
  back button on mobile platforms"); the `history.pushState` fallback is
  documented in `## Notes` and implemented only if the owner's device check
  fails.
- **No two-pane desktop** — from 600 px the sheet is centred at 560 px, as the
  standard's 600–839 dp rule says; the ≥ 840 px layout is deferred (owner,
  2026-08-21).
- **No `Textarea` primitive, no custom calendar, no password-visibility
  toggle** — the description is a token-styled `<textarea>` inside the sheet;
  the date is the native `<input type="date">` (guidelines §12.5); the token
  field stays `type="password"`.
- **No authoring or editing of test files.** The `test-writer` /
  `test-reviewer` pair owns `test/` (R-X); Task 8 only runs the suites.
- **No deploy, no Lighthouse, no Level A walk** — Phase 4; the manual check of
  this phase is the browser pane at 375 px plus the owner's back-gesture check
  on the phone.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/task-sheet.ts`

- **ACTION**: Create a pure module (no DOM globals, no timers, no runtime
  dependency beyond `./task-edit` and `./api` types; same header discipline
  as `src/shared/toast.ts`) that exports exactly:
  `export type SheetView = "detail" | "confirm";`
  `export interface TaskSheetState { taskId: string | null; view: SheetView; drafts: Readonly<Record<string, TaskDraft>> }`
  `export const INITIAL_TASK_SHEET_STATE: TaskSheetState = { taskId: null, view: "detail", drafts: {} };`
  `export type TaskSheetEvent = { type: "open"; task: TaskDto } | { type: "edit"; changes: Partial<TaskDraft> } | { type: "request-delete" } | { type: "cancel-delete" } | { type: "close" } | { type: "saved"; taskId: string } | { type: "deleted"; taskId: string };`
  `export function draftFromTask(task: TaskDto): TaskDraft` — `{ title: task.title, description: task.description ?? "", dateMode: dateModeOf(task), date: task.deadline ?? task.scheduledDate ?? "", priority: task.priority }` (the seed `TaskDetail.tsx:37-43` computed inline);
  `export function currentDraft(state: TaskSheetState, task: TaskDto): TaskDraft` — `state.drafts[task.id] ?? draftFromTask(task)`;
  `export function reduceTaskSheet(state: TaskSheetState, event: TaskSheetEvent): TaskSheetState` with these rules — `open`: `taskId` becomes `task.id`, `view` becomes `"detail"`, and `drafts` gains `draftFromTask(task)` under `task.id` only when no draft for that id exists yet (an existing draft is restored untouched — the AC-12 rule); `edit`: when `taskId` is `null` return `state` unchanged, otherwise `drafts[taskId]` becomes `{ ...drafts[taskId], ...event.changes }`; `request-delete`: when closed return `state`, otherwise `view` becomes `"confirm"`; `cancel-delete`: when closed return `state`, otherwise `view` becomes `"detail"` with the draft untouched; `close`: when already closed return `state`, otherwise `taskId` becomes `null` and `view` `"detail"` while `drafts` is kept (the same object reference); `saved` / `deleted`: `drafts` loses `event.taskId` (a later `open` seeds from the fresh Task), `taskId` becomes `null`, `view` `"detail"`. The function never mutates its inputs and always returns a state. Document in the header that the `<dialog>`, the fields and the requests live in `src/app/components/TaskSheet.tsx` and `TodayScreen.tsx` (glue), that a close request from the confirmation is just `close` (the sheet closes without deleting), and that drafts are per session (in memory, never persisted — guidelines §8 "dirty editor closed").
- **MIRROR**: `# SOURCE: src/shared/connectivity.ts:43-60` (the total switch
  over a discriminated event union, returning a new state or the same
  object); `# SOURCE: src/app/components/TaskDetail.tsx:37-43` (the seed).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function reduceTaskSheet' src/shared/task-sheet.ts
  grep -q 'export function draftFromTask' src/shared/task-sheet.ts
  grep -q 'export function currentDraft' src/shared/task-sheet.ts
  grep -qF 'export const INITIAL_TASK_SHEET_STATE: TaskSheetState' src/shared/task-sheet.ts
  grep -qF 'export type SheetView = "detail" | "confirm";' src/shared/task-sheet.ts
  if grep -nE 'window|document|navigator|setTimeout|localStorage|HTMLDialogElement' src/shared/task-sheet.ts; then
    echo "FAIL: src/shared/task-sheet.ts must stay DOM-free"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A8.

### Task 2: UPDATE `src/app/components/ui/Sheet.tsx` and `src/app/styles.css`

- **ACTION**: Rewrite `Sheet.tsx` on a native `<dialog>`, keeping the
  exported signature of `Sheet.tsx:11-21` verbatim. Remove the
  `@base-ui/react/dialog` import. Body: `const ref = useRef<HTMLDialogElement>(null); const titleId = useId();`
  and one effect on `[open]` — `const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) { dialog.showModal(); dialog.focus(); } else if (!open && dialog.open) { dialog.close(); }`
  (focus lands on the dialog itself — `tabIndex={-1}` — so no field pops
  the keyboard on the phone; Tab reaches the close button first; this is
  focus management, not `autofocus`). Render
  `<dialog ref={ref} data-sheet tabIndex={-1} aria-labelledby={titleId} onClose={() => onOpenChange(false)} className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[24px] border-0 bg-surface-1 p-0 px-4 pt-2 pb-4 text-ink shadow-deck outline-none sm:inset-0 sm:m-auto sm:h-fit sm:w-[560px] sm:max-w-[calc(100vw-2rem)] sm:rounded-card">`
  containing, in order: the handle `<div className="mx-auto mb-3 h-1 w-8 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />`;
  the title row `<div className="flex items-center gap-2"><h2 id={titleId} className="m-0 flex-1 font-text text-t4 font-semibold">{title}</h2><Button type="button" variant="icon" aria-label="Fechar" onClick={() => onOpenChange(false)}><X className="size-[22px]" aria-hidden="true" /></Button></div>`;
  then `{children}`. No `closedby` attribute (the `showModal()` default is
  `closerequest`: Esc, the close button and the Android back gesture close
  it, a tap on the backdrop does not — standard §3, no light dismiss on an
  editor); no `onCancel` handler (the platform's cancel → close path is the
  whole point); no Tailwind `translate-*` utility on the dialog (the slide
  uses the `translate` property from `styles.css`, and the 560 px centring
  comes from the dialog's own `margin: auto` with `inset: 0`). The header
  comment names the standard §3 rules, that `showModal()` makes the page
  inert and scroll-locked, that focus returns to the opener natively, and
  that the `history.pushState` fallback of PRD risk row 400 is NOT built
  unless the owner's device check fails.
  In `src/app/styles.css`, inside `@layer components`, after the
  `[data-shell]:has(...)` rule, add — with a comment naming layout standard
  §3 and the tokens:
  ```css
  dialog[data-sheet] {
    translate: 0 100%;
    transition:
      translate var(--duration-medium) var(--ease-exit),
      overlay var(--duration-medium) allow-discrete,
      display var(--duration-medium) allow-discrete;
  }
  dialog[data-sheet][open] {
    translate: 0 0;
    transition-timing-function: var(--ease-enter);
    @starting-style {
      translate: 0 100%;
    }
  }
  dialog[data-sheet]::backdrop {
    background: rgb(0 0 0 / 0.5);
    transition:
      opacity var(--duration-medium) var(--ease-standard),
      overlay var(--duration-medium) allow-discrete,
      display var(--duration-medium) allow-discrete;
  }
  dialog[data-sheet]:not([open])::backdrop {
    opacity: 0;
  }
  dialog[data-sheet][open]::backdrop {
    @starting-style {
      opacity: 0;
    }
  }
  @media (min-width: 640px) {
    dialog[data-sheet] {
      translate: 0 24px;
      opacity: 0;
      transition:
        translate var(--duration-medium) var(--ease-exit),
        opacity var(--duration-medium) var(--ease-exit),
        overlay var(--duration-medium) allow-discrete,
        display var(--duration-medium) allow-discrete;
    }
    dialog[data-sheet][open] {
      translate: 0 0;
      opacity: 1;
      @starting-style {
        translate: 0 24px;
        opacity: 0;
      }
    }
  }
  html:has(dialog[open]) {
    overflow: hidden;
  }
  ```
  (`640px` is Tailwind's `sm` breakpoint the class list above already uses —
  the standard's "from 600 dp" rounds to the existing breakpoint rather than
  adding a second one; durations and easings come from the tokens, so
  reduced motion shortens the slide through `tokens.css` with no extra media
  query.) Keep the `@keyframes` and every existing rule untouched.
- **MIRROR**: `# SOURCE: src/app/components/ui/Sheet.tsx:11-21` (the API
  kept verbatim); `# SOURCE: src/app/styles.css:70-77` (the components layer
  idiom); `# SOURCE: src/app/components/InlineTitle.tsx:21-25` (focus by
  effect).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'showModal()' src/app/components/ui/Sheet.tsx
  grep -qF 'onClose={() => onOpenChange(false)}' src/app/components/ui/Sheet.tsx
  grep -qF 'aria-label="Fechar"' src/app/components/ui/Sheet.tsx
  grep -qF 'data-sheet' src/app/components/ui/Sheet.tsx
  if grep -rnF '@base-ui/react/dialog' src; then
    echo "FAIL: the Base UI Dialog import must be gone (ADR-0011 native first)"; exit 1
  fi
  if grep -nE 'closedby|translate-[xy]' src/app/components/ui/Sheet.tsx; then
    echo "FAIL: no light dismiss and no Tailwind translate utility on the dialog"; exit 1
  fi
  grep -qF 'dialog[data-sheet][open]' src/app/styles.css
  grep -qF 'allow-discrete' src/app/styles.css
  grep -qF '@starting-style' src/app/styles.css
  grep -qF 'html:has(dialog[open])' src/app/styles.css
  npx tsc -b
  ```
- Delivers AC-A1 (the primitive half) and AC-A9.

### Task 3: CREATE `src/app/components/ui/ConfirmView.tsx`

- **ACTION**: Create the owned confirmation primitive:
  `export function ConfirmView({ title, body, cancelLabel, confirmLabel, busy, error, onCancel, onConfirm }: { title: string; body: string; cancelLabel: string; confirmLabel: string; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void })`.
  A `useRef<HTMLButtonElement>` on the cancel button and an effect on mount
  that calls `cancelRef.current?.focus()` (guidelines §8: default focus on
  *Cancelar* — programmatic, never `autofocus`). Render
  `<div className="flex flex-col gap-4 py-2">` with
  `<h3 className="m-0 font-text text-t4 font-semibold text-ink">{title}</h3>`,
  `<p className="m-0 font-text text-t3 text-muted">{body}</p>`,
  `{error !== null && <p role="alert" className="m-0 font-text text-t2 text-overdue">{error}</p>}`,
  and the button row `<div className="flex gap-2">` holding
  `<Button ref={cancelRef} type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>`
  then
  `<Button type="button" variant="secondary" className="flex-1" onClick={onConfirm} disabled={busy}><Trash2 className="size-5" aria-hidden="true" />{confirmLabel}</Button>`
  — the destructive button second, icon + text (guidelines §6.3), neutral
  `secondary` styling because the live colour is reserved for live and
  overdue states (ADR-0010, guidelines §4.2). The header comment names the
  §8 row it implements and that the strings are passed in by the screen
  (pt-BR literals live in the component that owns the flow, guidelines
  §12.3).
- **MIRROR**: `# SOURCE: src/app/components/ui/Button.tsx:9-23` (the
  variants); `# SOURCE: src/app/components/InlineTitle.tsx:21-25` (focus by
  effect).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function ConfirmView' src/app/components/ui/ConfirmView.tsx
  grep -qF 'cancelRef.current?.focus()' src/app/components/ui/ConfirmView.tsx
  grep -qF 'role="alert"' src/app/components/ui/ConfirmView.tsx
  grep -qF 'Trash2' src/app/components/ui/ConfirmView.tsx
  if grep -nE 'autoFocus|text-overdue"[^>]*>\{confirmLabel\}|bg-live|bg-overdue' src/app/components/ui/ConfirmView.tsx; then
    echo "FAIL: no autofocus attribute and no live colour on the destructive button"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A2 (the primitive half).

### Task 4: CREATE `src/app/components/TaskSheet.tsx`

- **ACTION**: Create the detail editor. Signature:
  `export function TaskSheet({ task, open, view, draft, busy, error, toastSlot, onDraftChange, onClose, onSave, onDeleteRequest, onDeleteCancel, onDeleteConfirm }: { task: TaskDto | null; open: boolean; view: SheetView; draft: TaskDraft | null; busy: boolean; error: string | null; toastSlot: ReactNode; onDraftChange: (changes: Partial<TaskDraft>) => void; onClose: () => void; onSave: () => void; onDeleteRequest: () => void; onDeleteCancel: () => void; onDeleteConfirm: () => void })`.
  Keep rendering the last Task while the dialog closes: `const lastTask = useRef<TaskDto | null>(null); if (task !== null) lastTask.current = task; const shown = task ?? lastTask.current; const shownDraft = draft ?? (shown === null ? null : draftFromTask(shown));`
  and return `null` when `shown === null`. Render
  `<Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={shown.title}>`
  (the sheet's heading is the Task title — PRD microcopy row 268) and, when
  `view === "detail"`, a `<form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); onSave(); }}>` holding, in the standard §3 order:
  `<label htmlFor="sheet-title" className="m-0 font-data text-t1 font-semibold text-muted">Título</label>` + `<input id="sheet-title" type="text" value={shownDraft.title} onChange={(event) => onDraftChange({ title: event.target.value })} disabled={busy} className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field" />`;
  `<label htmlFor="sheet-description" …>Descrição</label>` + `<textarea id="sheet-description" rows={3} value={shownDraft.description} onChange={(event) => onDraftChange({ description: event.target.value })} disabled={busy} className="min-h-24 rounded-control border border-line-strong bg-surface-1 px-4 py-3 font-text text-t3 text-ink shadow-field" />`;
  `<p id="sheet-date-label" className="m-0 font-data text-t1 font-semibold text-muted">Data</p>` + `<ChipGroup multiple={false} label="Data" value={[shownDraft.dateMode]} onValueChange={(next) => onDraftChange({ dateMode: (next[0] as TaskDateMode | undefined) ?? "none" })}>` with `<Chip value="none">Sem data</Chip><Chip value="deadline">Concluir até</Chip><Chip value="scheduled">Fazer em</Chip>` + `<input id="sheet-date" type="date" aria-label="Data" value={shownDraft.date} disabled={busy || shownDraft.dateMode === "none"} onChange={(event) => onDraftChange({ date: event.target.value })} className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field disabled:opacity-55" />`;
  `<p className="m-0 font-data text-t1 font-semibold text-muted">Prioridade</p>` + `<ChipGroup multiple={false} label="Prioridade" value={shownDraft.priority === null ? [] : [shownDraft.priority]} onValueChange={(next) => onDraftChange({ priority: (next[0] as TaskPriority | undefined) ?? null })}>` with `<Chip value="high">Alta</Chip><Chip value="normal">Normal</Chip><Chip value="low">Baixa</Chip>` (no chip selected = no priority);
  the button row `<div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" variant="primary" className="flex-1" disabled={busy}>Salvar</Button></div>`;
  `{error !== null && <p role="alert" className="m-0 font-text text-t2 text-overdue">{error}</p>}` (under *Salvar* — guidelines §8 request error);
  and, at a distance, `<Button type="button" variant="ghost" className="mt-4 self-start text-muted" onClick={onDeleteRequest} disabled={busy}><Trash2 className="size-5" aria-hidden="true" />Excluir</Button>`.
  When `view === "confirm"` render instead
  `<ConfirmView title="Excluir esta tarefa?" body="Não dá para desfazer." cancelLabel="Cancelar" confirmLabel="Excluir" busy={busy} error={error} onCancel={onDeleteCancel} onConfirm={onDeleteConfirm} />`.
  After either view render `{toastSlot}` wrapped in `<div className="mt-4 empty:hidden">` — the standard §2 item 8 place for a toast while a sheet is open. No input carries `outline-none`; nothing carries `autoFocus` or a `style` prop; every visible string is one of the microcopy rows (`visual-identity.md:101`). Imports: `Trash2` from `lucide-react`, `useRef` and `type ReactNode` from `react`, `TaskDto` / `TaskPriority` from `../../shared/api`, `TaskDateMode` / `TaskDraft` from `../../shared/task-edit`, `draftFromTask` / `SheetView` from `../../shared/task-sheet`, `Button`, `Chip` / `ChipGroup`, `ConfirmView`, `Sheet` from `./ui/...`. The header comment names the standard §3 order, the "draft kept in memory" rule (the parent owns the draft; this component is glue), and why the last Task keeps rendering during the exit transition.
- **MIRROR**: `# SOURCE: src/app/components/ui/Chip.tsx:36-46` (the chips);
  `# SOURCE: src/app/components/ui/Button.tsx:9-23` (the variants);
  `# SOURCE: src/app/components/ui/Sheet.tsx:11-21` (the API it calls).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function TaskSheet' src/app/components/TaskSheet.tsx
  grep -qF 'htmlFor="sheet-title"' src/app/components/TaskSheet.tsx
  grep -qF 'htmlFor="sheet-description"' src/app/components/TaskSheet.tsx
  grep -qF '<Chip value="none">Sem data</Chip>' src/app/components/TaskSheet.tsx
  grep -qF '<Chip value="deadline">Concluir até</Chip>' src/app/components/TaskSheet.tsx
  grep -qF '<Chip value="scheduled">Fazer em</Chip>' src/app/components/TaskSheet.tsx
  grep -qF '<Chip value="high">Alta</Chip>' src/app/components/TaskSheet.tsx
  grep -qF 'type="date"' src/app/components/TaskSheet.tsx
  grep -qF 'title="Excluir esta tarefa?"' src/app/components/TaskSheet.tsx
  grep -qF 'body="Não dá para desfazer."' src/app/components/TaskSheet.tsx
  grep -qF 'multiple={false}' src/app/components/TaskSheet.tsx
  grep -qF '{toastSlot}' src/app/components/TaskSheet.tsx
  if grep -nE 'outline-none|autoFocus|style=\{' src/app/components/TaskSheet.tsx; then
    echo "FAIL: no outline-none, no autofocus, no inline style in the sheet"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A1 (the editor half), AC-A2 (the flow half), AC-A3 (sheet
  copy) and AC-A7 (sheet targets).

### Task 5: UPDATE `src/app/components/TodayScreen.tsx` and DELETE `src/app/components/TaskDetail.tsx`

- **ACTION**: In `TodayScreen.tsx`: replace the `TaskDetail` import with
  `TaskSheet`, import `useReducer` from `react`, `deleteTask` from `../api`,
  `buildTaskPatch` from `../../shared/task-edit`, and `currentDraft`,
  `INITIAL_TASK_SHEET_STATE`, `reduceTaskSheet` from
  `../../shared/task-sheet`. Replace the `selectedTaskId` state with
  `const [sheet, dispatchSheet] = useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE);`
  and add `const [sheetError, setSheetError] = useState<string | null>(null);`.
  Derive `const sheetTask = tasks?.find((task) => task.id === sheet.taskId) ?? null;`
  (replacing `selected`). Add
  `async function runSheet(action: () => Promise<unknown>): Promise<void>`
  — the `run` shape with `setSheetError` in place of `setCaptureError`;
  `function openSheet(task: TaskDto): void { setSheetError(null); dispatchSheet({ type: "open", task }); }`;
  `function saveSheet(): void` — returns when `sheetTask === null`; computes
  `const changes = buildTaskPatch(sheetTask, currentDraft(sheet, sheetTask));`;
  when `Object.keys(changes).length === 0` dispatches `{ type: "close" }` and
  returns (the `TaskDetail.tsx:136-145` rule — the route rejects an empty
  body, so nothing changed never becomes a request); otherwise
  `void runSheet(async () => { await updateTask(sheetTask.id, changes); dispatchSheet({ type: "saved", taskId: sheetTask.id }); showToast({ key: "task-saved", text: "Tarefa salva" }); });`
  — the dispatch sits AFTER the awaited call, so a failed save leaves the
  sheet open with the draft intact and the message under *Salvar*;
  `function deleteSheetTask(): void` — returns when `sheet.taskId === null`,
  else `const id = sheet.taskId; void runSheet(async () => { await deleteTask(id); dispatchSheet({ type: "deleted", taskId: id }); showToast({ key: "task-deleted", text: "Tarefa excluída" }); });`
  (no action on the toast — the delete is irreversible, guidelines §8).
  Remove the `if (selected !== null) { return (<TaskDetail … />); }` block
  entirely. Every `onOpen={() => setSelectedTaskId(task.id)}` becomes
  `onOpen={() => openSheet(task)}`. Build the toast element once:
  `const toastElement = currentToast !== null ? (<Toast toast={currentToast} onAction={…} onSecondary={…} onDismiss={…} />) : null;`
  (the three handlers exactly as today), render the shell row as
  `{sheet.taskId === null && toastElement !== null ? (<div className="px-4 pb-2">{toastElement}</div>) : (<div />)}`,
  and after `<CaptureDeck … />` (still inside the `data-shell` div — the
  dialog lives in the top layer regardless) render
  `<TaskSheet task={sheetTask} open={sheet.taskId !== null} view={sheet.view} draft={sheetTask === null ? null : currentDraft(sheet, sheetTask)} busy={busy} error={sheetError} toastSlot={sheet.taskId !== null ? toastElement : null} onDraftChange={(changes) => dispatchSheet({ type: "edit", changes })} onClose={() => dispatchSheet({ type: "close" })} onSave={saveSheet} onDeleteRequest={() => { setSheetError(null); dispatchSheet({ type: "request-delete" }); }} onDeleteCancel={() => { setSheetError(null); dispatchSheet({ type: "cancel-delete" }); }} onDeleteConfirm={deleteSheetTask} />`.
  Update the header comment (the sheet is no longer "the old TaskDetail
  until Phase 3"). `document.title` stays *Hoje · Praesto Sum* while the
  sheet is open (AC-3). Then delete `src/app/components/TaskDetail.tsx`
  (`git rm`); nothing else imports it.
- **MIRROR**: `# SOURCE: src/app/components/TodayScreen.tsx:96-109` (the
  mutation path); `# SOURCE: src/app/components/TaskDetail.tsx:136-145` (the
  empty-patch rule); `# SOURCE: src/app/components/TodayScreen.tsx:336-353`
  (the toast host being split in two).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  test ! -f src/app/components/TaskDetail.tsx
  if grep -rn 'TaskDetail' src/app; then
    echo "FAIL: TaskDetail must be gone"; exit 1
  fi
  grep -qF 'useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE)' src/app/components/TodayScreen.tsx
  grep -qF 'key: "task-deleted"' src/app/components/TodayScreen.tsx
  grep -qF 'text: "Tarefa excluída"' src/app/components/TodayScreen.tsx
  grep -qF 'text: "Tarefa salva"' src/app/components/TodayScreen.tsx
  grep -qF 'buildTaskPatch(sheetTask, currentDraft(sheet, sheetTask))' src/app/components/TodayScreen.tsx
  grep -qF 'toastSlot={sheet.taskId !== null ? toastElement : null}' src/app/components/TodayScreen.tsx
  grep -qF 'document.title = "Hoje · Praesto Sum"' src/app/components/TodayScreen.tsx
  npx tsc -b
  ```
- Delivers AC-A1 (save / restore / error rules), AC-A2 (delete flow, no
  delete on rows) and AC-A4 (the last transitional file gone).

### Task 6: UPDATE `src/app/components/TokenGate.tsx` and `src/app/App.tsx`

- **ACTION**: Rewrite `TokenGate.tsx` on the tokens (no `CSSProperties`, no
  `styles` object, no English string):
  `export type TokenGateReason = "unauthorized" | null;`
  `export function TokenGate({ onAuthorized, reason }: { onAuthorized: () => void; reason: TokenGateReason })`.
  State `value`, `error`, `busy`. An effect on mount sets
  `document.title = "Praesto Sum"` (the gate's title per PRD microcopy row
  269 — `TodayScreen` may have set *Hoje · Praesto Sum* before a 401 sent
  the owner back here). Render
  `<main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center gap-6 bg-bg px-4 py-8 text-ink">`:
  the identity row `<div className="flex items-center gap-3"><img src="/brand/mark-flat.svg" alt="" className="size-10" /><h1 className="m-0 font-display text-t5 font-extrabold">praesto</h1></div>`
  — the wordmark is written in lowercase in the source (the identity ships
  it lowercase; no `text-transform`);
  when `reason === "unauthorized"`, `<p className="m-0 flex items-center gap-2 font-text text-t2 text-ink"><KeyRound className="size-5 flex-none text-muted" aria-hidden="true" />Este dispositivo precisa do token de novo.</p>`
  (text + icon — never colour alone);
  `<p className="m-0 font-text text-t3 text-muted">Cole o token da API deste dispositivo.</p>`;
  `<form className="flex flex-col gap-3" onSubmit={…}>` with
  `<label htmlFor="api-token" className="m-0 font-data text-t1 font-semibold text-muted">Token da API</label>`,
  `<input id="api-token" type="password" autoComplete="off" enterKeyHint="done" value={value} onChange={(event) => setValue(event.target.value)} disabled={busy} className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field" />`
  (no placeholder doing a label's job, no `autoFocus` — guidelines §12.5
  keeps `autofocus` for the capture field; no `outline-none`), and
  `<Button type="submit" variant="primary" disabled={busy}>Salvar</Button>`;
  then `{error !== null && <p role="alert" className="m-0 font-text text-t2 text-overdue">{error}</p>}`.
  The submit handler keeps `TokenGate.tsx:17-38`'s logic — `preventDefault`,
  trim, return on empty, `setBusy(true)`, `await saveToken(token)` in a
  try/catch whose catch surfaces `cause instanceof Error ? cause.message : "Não foi possível guardar o token neste dispositivo."`
  and returns without clearing `value` (the FR-045 invariant comment stays),
  `setBusy(false)` in a `finally`, then `setError(null); onAuthorized();`.
  Header comment: the gate carries the identity (flat mark + wordmark as the
  screen's `<h1>`), shows the 401 reason `App.tsx` passes, and is the only
  screen whose `<title>` is *Praesto Sum*.
  In `App.tsx`: import `type TokenGateReason` from `./components/TokenGate`,
  add `const [gateReason, setGateReason] = useState<TokenGateReason>(null);`,
  render `<TokenGate reason={gateReason} onAuthorized={() => { setGateReason(null); setAuthorized(true); }} />`
  and `<TodayScreen onUnauthorized={() => { setGateReason("unauthorized"); setAuthorized(false); }} initialShare={initialShare} />`;
  update the header comment (no transitional `TaskDetail` / `TokenGate`
  mention).
- **MIRROR**: `# SOURCE: src/app/components/TokenGate.tsx:17-38` (the submit
  path kept); `# SOURCE: src/app/App.tsx:50-53` (the switch); `# SOURCE:
  src/app/components/ui/Button.tsx:9-23` (the primary submit).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'export type TokenGateReason = "unauthorized" | null;' src/app/components/TokenGate.tsx
  grep -qF 'Este dispositivo precisa do token de novo.' src/app/components/TokenGate.tsx
  grep -qF 'Cole o token da API deste dispositivo.' src/app/components/TokenGate.tsx
  grep -qF 'htmlFor="api-token"' src/app/components/TokenGate.tsx
  grep -qF '>Token da API</label>' src/app/components/TokenGate.tsx
  grep -qF '/brand/mark-flat.svg' src/app/components/TokenGate.tsx
  grep -qF 'document.title = "Praesto Sum"' src/app/components/TokenGate.tsx
  if grep -nE 'CSSProperties|const styles|style=\{|placeholder=|autoFocus|outline-none|"Save"|"API token"' src/app/components/TokenGate.tsx; then
    echo "FAIL: the gate must carry no inline style, no placeholder-as-label, no autofocus, no English"; exit 1
  fi
  grep -qF 'setGateReason("unauthorized")' src/app/App.tsx
  grep -qF 'reason={gateReason}' src/app/App.tsx
  npx tsc -b
  ```
- Delivers AC-A3 (gate copy and `<title>`), AC-A4 (no inline style left)
  and AC-A7 (gate targets).

### Task 7: UPDATE `src/app/components/DesignPlayground.tsx`

- **ACTION**: Change the sheet demo's body text
  (`DesignPlayground.tsx:278-280`) to
  `Um corpo curto para mostrar a folha — agora um <dialog> nativo aberto com showModal().`
  (write `&lt;dialog&gt;` as `{"<dialog>"}` or plain text inside the JSX as
  the implementer sees fit; the literal must read `<dialog>` on screen).
  Add, after *Tela Hoje*, `<Section title="Sheet de tarefa">` that renders
  with local state only (no API call): a
  `useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE)` pair, a
  `<Button variant="secondary" onClick={() => dispatchSheet({ type: "open", task: PLAYGROUND_TASKS[0] })}>Abrir sheet de tarefa</Button>`,
  and a `<TaskSheet>` bound to that state — `task` = the fixture Task whose
  id matches `sheetState.taskId` (or `null`), `open={sheetState.taskId !== null}`,
  `view`, `draft` via `currentDraft`, `busy={false}`, `error={null}`,
  `toastSlot={null}`, `onDraftChange` dispatching `edit`, `onClose`
  dispatching `close`, `onSave` dispatching `saved` (no request on the
  playground), `onDeleteRequest` / `onDeleteCancel` dispatching the two
  confirmation events, `onDeleteConfirm` dispatching `deleted`; plus, below
  the button, a standalone
  `<ConfirmView title="Excluir esta tarefa?" body="Não dá para desfazer." cancelLabel="Cancelar" confirmLabel="Excluir" busy={false} error={null} onCancel={() => {}} onConfirm={() => {}} />`
  inside a `<div className="rounded-card border border-line bg-surface-1 px-4">`
  so the confirmation's geometry and focus can be measured without opening
  the sheet. Update the header comment's list of what the page renders.
  Keep every existing section untouched. The token gate is NOT embedded
  (its root is the screen's `<main>` landmark); it is verified on `/`
  itself — see `## Notes`.
- **MIRROR**: `# SOURCE: src/app/components/DesignPlayground.tsx:274-281`
  (the controlled sheet demo).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF '<Section title="Sheet de tarefa">' src/app/components/DesignPlayground.tsx
  grep -qF 'Abrir sheet de tarefa' src/app/components/DesignPlayground.tsx
  grep -qF 'useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE)' src/app/components/DesignPlayground.tsx
  grep -qF 'ConfirmView' src/app/components/DesignPlayground.tsx
  grep -qF 'TaskSheet' src/app/components/DesignPlayground.tsx
  grep -qF 'showModal()' src/app/components/DesignPlayground.tsx
  grep -qF 'Design — tokens e estados' src/app/components/DesignPlayground.tsx
  if grep -nF 'Base UI Dialog' src/app/components/DesignPlayground.tsx; then
    echo "FAIL: the sheet demo still describes the old primitive"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A5.

### Task 8: RUN the gates and the budget probe

- **ACTION**: Run `npm run check`, `npm test` and `npm run build` and confirm
  all three green — a failure is fixed in production code, never in a test.
  Then measure the built bundle against guidelines §11 with the probe below
  and write `PRPs/reports/ui-design-pass/phase-3/build-report.md` with the
  `vite build` size table, the probe output and the JS delta against phase
  2's 87,589 B gzip (the Base UI `Dialog` removal should show as a
  reduction; record the number either way), in the same shape as
  `PRPs/reports/ui-design-pass/phase-2/build-report.md`. The browser-pane
  Tier A / Tier B check of the sheet and the gate (checklist items 1–9, the
  §8 states simulated, contrast, 375 px) is performed by the main session
  after this task and recorded in the same report, together with the
  owner's device check of the back gesture when it happens. Leave a clearly
  marked placeholder section for both.
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
  test -f PRPs/reports/ui-design-pass/phase-3/build-report.md
  ```
- Delivers AC-A6 (and re-verifies AC-A1 through AC-A9 through the suites
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
`worker` project carries the phase-1 and phase-2 suites (including
`test/task-edit.test.ts`, which keeps pinning the diff the sheet sends) and
whatever the test pair authors for `src/shared/task-sheet.ts`; the `docs`
project guards the derived docs.

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
if grep -rn "style={" src/app --include="*.tsx" | grep -v "DesignPlayground.tsx"; then
  echo "FAIL: an inline style object survived outside the playground (PRD AC-2)"; exit 1
fi
if grep -rnE "CSSProperties|const styles = " src/app --include="*.tsx"; then
  echo "FAIL: no inline styles scale may remain (guidelines §12.2)"; exit 1
fi
if grep -rnF "@base-ui/react/dialog" src; then
  echo "FAIL: the Base UI Dialog import must be gone"; exit 1
fi
if grep -rnF "window.confirm" src/app; then
  echo "FAIL: window.confirm is not UI (guidelines §2.8)"; exit 1
fi
if grep -rnE "textTransform|uppercase" src/app --include="*.tsx"; then
  echo "FAIL: no all-caps UI text (guidelines §9.2)"; exit 1
fi
if grep -rnE '"(Save|Cancel|Delete|Edit Task|API token|No date|Complete by|Do on|Not set)"' src/app --include="*.tsx"; then
  echo "FAIL: an English UI string survived (ADR-0009)"; exit 1
fi
test ! -f src/app/components/TaskDetail.tsx
grep -qF 'showModal()' src/app/components/ui/Sheet.tsx
grep -qF 'html:has(dialog[open])' src/app/styles.css
grep -qF 'title="Excluir esta tarefa?"' src/app/components/TaskSheet.tsx
grep -qF 'Este dispositivo precisa do token de novo.' src/app/components/TokenGate.tsx
grep -qF 'key: "task-deleted"' src/app/components/TodayScreen.tsx
if grep -rnE "outline-none" src/app/components/TaskSheet.tsx src/app/components/TokenGate.tsx src/app/components/ui/ConfirmView.tsx; then
  echo "FAIL: no outline-none on a field without a replacement ring (guidelines §4.5)"; exit 1
fi
if grep -rlF 'tokens e estados' dist/client >/dev/null; then
  echo "FAIL: the /design playground leaked into the production bundle"; exit 1
fi
```

`npm run build` (`tsc -b && vite build`) stays the real Level 3: it
type-checks every new component and bundles Tailwind over the tokens. The
greps pin the phase's structural commitments — no inline style object or
scale anywhere under `src/app/` except the playground's swatches (PRD AC-2
complete), the Base UI `Dialog` import gone, no `window.confirm`, no
all-caps, no English UI string, the old detail file gone, the native dialog
and its scroll lock present, the confirmation and the 401 reason copy
present, the delete toast wired, no `outline-none` on the new fields, the
playground still absent from the bundle. **The behaviour of the sheet and
the gate is NOT covered by any command here and is verified in the browser
pane by the main session and on the phone by the owner** — see `## Notes`
for the script.

## Acceptance Criteria

- **AC-A1 (PRD AC-12):** a row tap opens the detail as a native `<dialog>`
  opened with `showModal()` (`dialog.open === true`, `:modal` matches) — a
  bottom sheet with a handle below 640 px, centred at 560 px above it — the
  page behind is scroll-locked (`html` overflow hidden while a dialog is
  open) and inert; Esc, the *Fechar* button and the Android back gesture all
  close it through the `close` event; focus returns to the row; a draft
  edited then closed is restored when the same Task is reopened in the
  session; *Salvar* sends only the diff `buildTaskPatch` computes (an empty
  diff closes without a request), keeps the sheet open with the request-error
  sentence under *Salvar* on failure, and closes with the toast *Tarefa
  salva* on success.
- **AC-A2 (PRD AC-11):** *Excluir* in the sheet swaps the sheet's content for
  *Excluir esta tarefa? Não dá para desfazer.* with *Cancelar* (focused by
  default) before *Excluir*; *Cancelar* returns to the detail with the draft
  intact; *Excluir* deletes, closes the sheet and shows *Tarefa excluída*
  (no undo — irreversible); a close request from the confirmation closes the
  sheet without deleting; no delete control exists on any row; a failed
  delete keeps the confirmation open with the request-error sentence.
- **AC-A3 (PRD AC-3):** every visible string on the sheet and the gate comes
  from the approved microcopy (*Título · Descrição · Data · Prioridade*, *Sem
  data · Concluir até · Fazer em*, *Alta · Normal · Baixa*, *Cancelar /
  Salvar / Excluir*, *Fechar*, the confirmation, *Tarefa salva / Tarefa
  excluída*, `praesto`, *Cole o token da API deste dispositivo.*, *Token da
  API*, *Salvar*, *Este dispositivo precisa do token de novo.*); sentence
  case, infinitive buttons, no all-caps; `<title>` reads *Praesto Sum* on the
  gate (also after a 401 sent the owner back to it) and *Hoje · Praesto Sum*
  on the board, sheet open or closed.
- **AC-A4 (PRD AC-2):** after this phase no `.tsx` file under `src/app/`
  carries a `style={}` prop, a `CSSProperties` import or a `const styles`
  object except `DesignPlayground.tsx`'s dynamic `var(--token)` swatches;
  `TaskDetail.tsx` no longer exists; no colour literal appears outside the
  exempt set.
- **AC-A5 (PRD AC-20):** `/design` shows the sheet demo on the native dialog,
  a *Sheet de tarefa* section with `TaskSheet` in the detail view and the
  confirmation view over the fixture Task, and a standalone `ConfirmView` —
  and the production bundle still contains no trace of the playground.
- **AC-A6 (PRD AC-22):** `npm run check`, `npm test` and `npm run build` are
  green with no test weakened, the build report is filed under
  `PRPs/reports/ui-design-pass/phase-3/`, and the browser-pane Tier A /
  Tier B result for the sheet and the gate is recorded there by the main
  session, with the owner's device check of the back gesture recorded when
  it happens.
- **AC-A7 (PRD AC-8):** on the sheet and the gate every tappable control
  measures ≥ 48 × 48 CSS px with ≥ 8 px to its neighbours (the chips, the
  date input, *Cancelar / Salvar / Excluir*, *Fechar*, the confirmation's
  two buttons, the token field and *Salvar*), and every text field is ≥ 48
  px tall — the 41 px finding of 2026-08-19 closes.
- **AC-A8 (PRD AC-11, PRD AC-12):** `reduceTaskSheet` opens a Task in the
  `detail` view seeding `draftFromTask(task)` only when no draft exists for
  that id (an existing draft is restored untouched); `edit` merges changes
  into the open Task's draft and is a no-op while closed; `request-delete` /
  `cancel-delete` switch `view` between `confirm` and `detail` without
  touching the draft; `close` clears `taskId`, resets `view` and keeps every
  draft; `saved` and `deleted` drop that Task's draft and close; the reducer
  never mutates its inputs and returns the same state object for every
  no-op; `currentDraft` falls back to `draftFromTask` when no draft is kept.
- **AC-A9 (PRD AC-18):** `vite build` stays inside §11 and the JS figure is
  recorded against phase 2's 87,589 B gzip with the Base UI `Dialog` no
  longer imported anywhere under `src/`.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The owner's Android Chrome does not treat the back gesture as a close request for the modal `<dialog>` | Low | Medium — back would leave the app from the sheet, the finding this phase exists to close | MDN documents the `cancel` event for "the back button on mobile platforms" (Baseline 2022) and guidelines §2.2 cites Chrome ≥ 126; the owner checks it on the phone (`## Notes`); the fallback (`history.pushState` on open, `popstate` → `close()`, inside `Sheet` only) is specified there and built only if the check fails |
| The exit transition leaves an empty sheet for 300 ms because the parent drops the Task on `close` | Medium | Low | `TaskSheet` keeps rendering the last Task (`lastTask` ref) while `open` is false; the reducer keeps the draft on `close`, so the content does not change during the slide |
| `dialog.close()` from the close button fires the `close` event and `onOpenChange(false)` a second time | High (by design) | None | The parent's state is already `closed`; the reducer returns the same object for `close` on a closed sheet (AC-A8) |
| A refetch while the sheet is open replaces the Task object under the draft | Low | Low | The draft lives in the reducer keyed by id, not in the Task object; `sheetTask` is re-derived from the fresh list; only a deleted-elsewhere Task would close the sheet (its id no longer resolves) |
| Tailwind `translate-*` utilities and the `translate` property of the transition fight on the dialog | Medium | Medium — the sheet would not slide or would sit off-centre | The dialog class list uses no `translate-*` utility (Task 2 grep); the 560 px centring relies on the dialog's UA `margin: auto` + `inset: 0` |
| `@starting-style` / `allow-discrete` / `overlay` unsupported on the owner's browser | Low | Low — the sheet appears and disappears without the slide | Baseline since August 2024 (Chrome 117+); the dialog itself works without the transition |
| The toast slot inside the sheet shows a toast raised by a row action that cannot happen while the page is inert | Low | None | Only the update toast can arrive while the sheet is open; it renders inside the dialog and stays operable |
| `ChipGroup multiple={false}` yields `[]` when the pressed chip is tapped again | High (by design) | Low | Mapped explicitly: `[]` → `dateMode: "none"` / `priority: null` — both legitimate states (*Sem data*, no priority) |
| The test pair reads the [manual] criteria of this phase as ambiguous | Medium | Medium | Only AC-A8 is automated; the PRD tags AC-11 [manual] and AC-12 [manual, device]; this plan's `## Notes` routes them to the pane script and the owner's device check |
| The Base UI `Dialog` removal changes the bundle less than expected or the new CSS grows it | Low | Low | Measured and recorded in Task 8; both budgets are at 50 % / 24 % |

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
  suites (Task 8 and Level 2), never to author or edit a test. The pair is
  expected to CREATE `test/task-sheet.test.ts` from AC-A8 (the only
  automated criterion of this phase) and to leave every existing suite
  untouched — `test/task-edit.test.ts` keeps covering `buildTaskPatch`, which
  this phase consumes unchanged; the suite is RED for the right reason —
  module missing — until Task 1 lands.
- **What is automated and what is verified by hand.** `src/shared/task-sheet.ts`
  is the one new decidable module. The dialog (`showModal()`, the `close`
  event, focus return, the transition), the fields, the requests and the gate
  are React glue or markup, verified in the browser pane and on the device —
  the split `docs/context/methodology.md` prescribes.
- **Manual verification script (main session, after Task 8, browser pane at
  375 px, dark, `npm run dev`, recorded under
  `PRPs/reports/ui-design-pass/phase-3/`):** (1) `/design` → *Sheet de
  tarefa* → *Abrir sheet de tarefa*: `document.querySelector("dialog[data-sheet]").open`
  is `true`, `matches(":modal")` is `true`, `getComputedStyle(document.documentElement).overflow`
  is `hidden`, the title is the fixture Task's title, `document.activeElement`
  is the dialog, and the elements outside are inert; (2) measure every
  control ≥ 48 px (`getBoundingClientRect`): chips, date input, *Cancelar*,
  *Salvar*, *Excluir*, *Fechar*; (3) change a chip and the title, close with
  the *Fechar* button, reopen — the draft is back; press Esc — the dialog
  closes (`open === false`), focus is on the opener button; (4) *Excluir* →
  the confirmation replaces the content, `document.activeElement` is
  *Cancelar*, *Cancelar* returns with the draft intact, Esc on the
  confirmation closes the whole sheet; (5) the standalone `ConfirmView`
  measurements and contrast; (6) `/` without a stored token: the gate with
  the mark, `praesto` as the `<h1>`, the visible label, the 48 px field and
  button, `<title>` *Praesto Sum*, no `autofocus`; (7) the 401 reason: type a
  deliberately invalid string (e.g. `not-a-token`) into the gate and *Salvar*
  — the app stores it, `GET /api/tasks` answers 401, the token is cleared and
  the gate returns with *Este dispositivo precisa do token de novo.* and
  `<title>` back to *Praesto Sum*; (8) contrast of the sheet's text on
  `surface-1` and the chips' pressed state; (9) `npm run build` size against
  phase 2; (10) screenshots, or the written reason none exists. **Steps that
  need a real token** (save → *Tarefa salva*, delete → *Tarefa excluída*, a
  failed save with the sentence under *Salvar*, the board refetch after
  both) are owed to the owner in the pane or on the phone, as in phase 2.
- **Owner's device check (PRD Open Question 1, risk row 400):** on the
  phone, open a Task, press the back gesture — the sheet must close and the
  app must stay; then open *Excluir* and press back — the sheet closes
  without deleting. Recorded in the phase-3 build report and in the UI/UX
  plan's History. If the gesture leaves the app instead: switch on the
  fallback inside `Sheet.tsx` only — `history.pushState({ sheet: true }, "")`
  right after `showModal()`, a `popstate` listener that calls
  `dialog.close()` when the state entry is gone, and `history.back()` on the
  programmatic close when the entry is still present — keeping the same API,
  then re-verify. (The CloseWatcher explainer calls the history trick fragile
  for UI state, which is why it is the fallback, not the default.)
- **Why the toast is a slot and not a `popover="manual"`.** The PRD's
  Architecture Notes suggested a manual popover in the top layer; the
  phase-2 research and the standard §2 item 8 both say a popover opened
  before `showModal()` is inert under the modal unless it lives inside the
  dialog's subtree. Handing the same toast element to the open sheet is the
  standard's rule with no extra top-layer element and no stacking question;
  the phase-2 toast host stays as it is while no sheet is open. Recorded for
  A6 so the PRD note and the standard agree.
- **Divergences to settle at A6 (recorded, not decided here):** (a) the
  standard §3 says "centred at max 560 px from 600 dp" while the component
  library breaks at Tailwind's `sm` (640 px) — this plan keeps the single
  existing breakpoint; the standard should name it; (b) the standard §3
  lists the title as the first editable field and the identity's microcopy
  makes the Task title the sheet's heading — this plan does both (heading =
  the Task title, *Título* = the first field); (c) PRD AC-12 says "focus
  returns to the row" — the native behaviour returns it to the row's open
  button, which is the row body; (d) the phase-2 plan's literal class
  strings carried `outline-none` on text inputs — superseded by the fix
  round of 2026-08-21; no field in this phase carries it.
- **Research grounding.** `research-codebase` returned 8 findings (scope cap
  reached; every `# SOURCE:` anchor above was re-opened at the cited lines in
  the main session — `Sheet.tsx` 1-47, `TaskDetail.tsx` 24-43 / 131-152,
  `TokenGate.tsx` 9-54, `TodayScreen.tsx` 73-82 / 96-109 / 218-240 /
  336-353, `App.tsx` 16-54, `Chip.tsx` 10-46, `task-edit.ts` 26-38 / 50-67,
  `api.ts` 50-75 / 113-133, `auth.ts` 11-26, `routes/tasks.ts` 149-158 /
  255-262; gaps: no native `<dialog>` exists yet, `TaskDetail` has no delete
  code, `TokenGate` has no reason channel, DELETE has one happy-path test, no
  draft outlives the sheet) and `research-web` returned 8 findings (scope
  cap reached): Base UI's `Dialog.Popup` renders a `<div>`
  (https://base-ui.com/react/components/dialog); `closedby` defaults to
  `closerequest` under `showModal()` and `showModal()` brings `:modal`,
  `::backdrop`, implicit `aria-modal` and inertness
  (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog);
  `requestClose()` fires `cancel` before `close` (Baseline May 2025)
  (https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/requestClose);
  the `cancel` event fires for Esc and "the back button on mobile platforms"
  (Baseline March 2022)
  (https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/cancel_event);
  CloseWatcher frames close requests per platform and calls the
  `history.pushState` trick fragile (https://github.com/WICG/close-watcher);
  `@starting-style` + `allow-discrete` Baseline August 2024, `overlay` for
  the backdrop (https://web.dev/blog/baseline-entry-animations?hl=en); WCAG
  3.3.4 accepts a confirmation step for deletion
  (https://www.w3.org/WAI/WCAG21/Understanding/error-prevention-legal-financial-data.html);
  browsers may ignore `autocomplete="off"` on password fields
  (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete).
  Open gaps from the web agent: no source pinned the exact Chrome version for
  `closedby`; the bottom-sheet CSS (`90dvh`, safe areas, keyboard) has no
  single source — the standard §3/§4 rules apply; whether a popover outside
  the dialog is inert under `showModal()` was not re-confirmed — the slot
  design sidesteps the question.
- **Not changed in this phase, on purpose:** `src/app/pwa.ts`, `src/sw.ts`,
  `src/app/api.ts`, `src/app/tokens.css`, `src/app/main.tsx`,
  `src/app/toast-store.ts`, `src/shared/task-edit.ts`, `src/shared/toast.ts`,
  `index.html`, `public/`, every worker file and every test file.

*Generated: 2026-08-22*
*Approved: 2026-08-22*
*Implemented: 2026-08-22*
*Status: IMPLEMENTED*
