# WCAG 2.2 Level A walk — ui-design-pass, activity A5, phase 4

Date: 2026-08-22 · Source plan: `PRPs/plans/ui-design-pass-phase-4-device-verification-pass.plan.md` (Task 4) · PRD: `PRPs/prds/ui-design-pass.prd.md` AC-21.

The pass guidelines §10 says runs "once per screen in A5" — this is that pass. It
covers the three screens the PRD names: the **token gate** (`TokenGate.tsx`),
**Hoje** (`TodayScreen.tsx` and its children), and the **detail sheet**
(`Sheet.tsx` + `TaskSheet.tsx` + `ConfirmView.tsx`).

## Method

**Criteria source.** `documentation/40-engineering/ui-ux-guidelines.md` §10,
verbatim — no criterion below was invented or added from outside that section.
§10 states "31 Level A criteria" and lists them as prose bullets, several of
which name more than one criterion id per bullet (e.g. "1.3.1 ... 2.4.1 ...").
Expanded one row per id, the section names exactly:

- **24 criteria judged applicable** to this app: 1.1.1, 1.3.1, 2.4.1, 1.3.2,
  1.3.3, 1.4.1, 2.1.1, 2.1.2, 2.2.1, 2.2.2, 2.4.2, 2.4.3, 2.4.4, 2.5.1, 2.5.2,
  2.5.3, 3.1.1, 3.2.1, 3.2.2, 3.2.6, 3.3.1, 3.3.2, 3.3.7, 4.1.2.
- **7 criteria the guidelines mark N/A by design**: the plan's own Task 4
  wording names these explicitly — "the media criteria 1.2.x, 1.4.2, 2.3.1 and
  2.5.4 are vacuous here — no media, no flashing, no motion actuation — and
  2.1.4 has no single-key shortcut to switch off." §10's own text writes the
  media group as the shorthand "1.2.x"; expanded to the three WCAG 2.2 success
  criteria it stands for (1.2.1 Audio-only/Video-only, 1.2.2 Captions
  Prerecorded, 1.2.3 Audio Description or Media Alternative) plus 1.4.2, 2.3.1
  and 2.5.4, that is 6 ids, plus 2.1.4 named separately by the task = **7**.

24 + 7 = **31**, matching §10's count exactly with nothing added and nothing
dropped.

**A note on "vacuously true" vs. "n/a".** A few of the 24 applicable criteria
govern a pattern this app does not currently use at all (a link, a swipe
gesture, a consistent help mechanism, a visible label on an icon-only
control). Guidelines §10 does not list these among its 7 named N/A criteria,
so this walk does not either — marking them "n/a" instead of the app's actual,
narrower reason ("there is no instance of the pattern to violate this") would
quietly grow the N/A bucket past what §10 authorizes, which is exactly the
plan's own named risk ("a criterion is marked n/a to avoid work"). Each such
row is marked **✔ (vacuous)** instead, with the absence itself as the evidence
(confirmed by a repo-wide search, cited per row).

**Method for each row.** Every row is decided one of two ways, named in its
evidence:

1. **Source read** — the component file and line(s) that settle the question
   structurally (a real `<label>`, a `role`, an `aria-*` attribute, DOM order,
   the absence of a pattern confirmed by search). Most Level A criteria are
   structural/semantic and are legitimately decidable this way.
2. **An existing browser-pane measurement** from phases 1–3's build reports
   (`PRPs/reports/ui-design-pass/phase-{1,2,3}/build-report.md`) — contrast
   numbers, the focus-ring sweep, hit-area measurements, the Tab/Enter/Esc
   walk-throughs already run on `/design` and on the live screens. Cited by
   report path and line.

Nothing below is measured fresh in a browser by this walk: per the plan's own
Notes, the browser pane is the main session's job and the phone/PC are the
owner's. Where neither source nor an existing measurement settles a question,
the row says so and the item is carried to **## Owed** at the end, never
guessed.

---

## Screen 1 — Token gate (`src/app/components/TokenGate.tsx`)

| ID | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1.1.1 | Non-text content has a text alternative | ✔ | The mark `<img src="/brand/mark-flat.svg" alt="" .../>` is decorative, sitting beside the visible `<h1>praesto</h1>` that names it in text; the `KeyRound` icon is `aria-hidden="true"` beside a full visible sentence; no icon-only control exists on this screen (*Salvar* carries visible text) — `TokenGate.tsx:35-36,41,90-92` |
| 1.3.1 | Info and relationships (real semantics) | ✔ | `<label htmlFor="api-token">Token da API</label>` bound to `<input id="api-token">`; one `<h1>`; one `<main>` — `TokenGate.tsx:33,36,79-88` |
| 2.4.1 | Bypass blocks (landmarks, one `<h1>`) | ✔ | `<main>` wraps the whole screen (`:33`), one `<h1>praesto</h1>` (`:36`); no repeated nav block precedes it, so there is nothing to bypass — `TokenGate.tsx:33,36` |
| 1.3.2 | Meaningful sequence (DOM order = reading order) | ✔ | Linear JSX, no CSS `order`/flex-order/grid-area override anywhere in the file: mark+wordmark → conditional 401 reason → instruction → form → error, matching the visual stack top-to-bottom — `TokenGate.tsx:32-99` |
| 1.3.3 | Sensory characteristics (never shape/position/colour alone) | ✔ | The only instruction is the sentence "Cole o token da API deste dispositivo." — text, not shape or position — `TokenGate.tsx:47` |
| 1.4.1 | Use of colour (never the only cue) | ✔ | The 401 reason pairs the `KeyRound` icon with a full sentence, never colour alone; the error is `role="alert"` text in `text-overdue`, always with the message itself — `TokenGate.tsx:39-44,95-98` |
| 2.1.1 | Keyboard (everything operable by keyboard) | ✔ | One native `<form>`, one `<input>`, one submit `<button>` (Base UI `Button`, a real `<button>` — `src/app/components/ui/Button.tsx:5,28-29`); no custom pointer-only handling anywhere in the file — `TokenGate.tsx:49-93` |
| 2.1.2 | No keyboard trap | ✔ | No dialog, no focus-management effect on this screen — nothing to trap focus in; Tab cycles the two controls and leaves normally — `TokenGate.tsx:49-93` |
| 2.2.1 | Timing adjustable (no time limits) | ✔ | No timer, countdown or auto-expiring content anywhere in the file (confirmed by reading the full component) |
| 2.2.2 | Pause, stop, hide | ✔ (vacuous) | No toast, no moving or auto-updating content is rendered on this screen at all |
| 2.4.2 | Page titled | ✔ | `document.title = "Praesto Sum"` set on mount — `TokenGate.tsx:29` |
| 2.4.3 | Focus order (follows the layout) | ✔ | Two focusables in visual order top-to-bottom: the input, then *Salvar* — no `tabIndex` override in the file — `TokenGate.tsx:80-92` |
| 2.4.4 | Link purpose (in context) | ✔ (vacuous) | No `<a>` element exists anywhere in `TokenGate.tsx` (confirmed by search) |
| 2.5.1 | Pointer gestures | ✔ (vacuous) | No gesture handler exists in the file; submission is a plain tap/click or Enter, never a multipoint or path gesture |
| 2.5.2 | Pointer cancellation | ✔ | The submit control is a native/Base UI `<button type="submit">` — standard click/keyup activation, no `onPointerDown`-triggered action anywhere in the file — `TokenGate.tsx:90-92` |
| 2.5.3 | Label in name | ✔ | The visible label text "Token da API" *is* the input's accessible name via `htmlFor` — no `aria-label` override exists to diverge from it — `TokenGate.tsx:79-88` |
| 3.1.1 | Language of page | ✔ | `<html lang="pt-BR">`, document-level, applies to every screen — `index.html:2` |
| 3.2.1 | On focus (no context change) | ✔ | No `onFocus` handler exists anywhere in the file |
| 3.2.2 | On input (no unrequested context change) | ✔ | The input's `onChange` only calls `setValue`; the request fires solely from the form's explicit `onSubmit` (Enter or tapping *Salvar*) — `TokenGate.tsx:49-76,86` |
| 3.2.6 | Consistent help | ✔ (vacuous) | No help mechanism exists anywhere in the app yet (repo-wide search for "ajuda"/"help" in `src/app` returns nothing) — nothing to place inconsistently |
| 3.3.1 | Error identification | ✔ | The failure message renders as a full sentence directly under the form, `role="alert"` — `TokenGate.tsx:95-98` |
| 3.3.2 | Labels or instructions | ✔ | `<label htmlFor="api-token">Token da API</label>` is a real, visible label; the input carries no `placeholder` attribute at all, so there is no "placeholder as label" trap to fall into — `TokenGate.tsx:79-88` |
| 3.3.7 | Redundant entry | ✔ | `value` is deliberately not cleared after a failed save (the FR-045 invariant), so the owner never has to retype the token — `TokenGate.tsx:63-64` (comment), `:86` |
| 4.1.2 | Name, role, value | ✔ | The only interactive control beyond native HTML is `Button`, which renders a real `<button>` under Base UI — native name/role/state, nothing custom to expose — `TokenGate.tsx:90-92`, `src/app/components/ui/Button.tsx:5,28-29` |
| 1.2.1 / 1.2.2 / 1.2.3 | Media alternatives (prerecorded) | n/a | No audio or video content exists anywhere in the app |
| 1.4.2 | Audio control | n/a | No audio plays anywhere in the app |
| 2.1.4 | Character key shortcuts | n/a | No single-key shortcut exists anywhere in `src/app` — the only `onKeyDown` handler in the whole tree is field-scoped (`InlineTitle.tsx:46`), which the guideline's own carve-out exempts regardless ("require focus in a field") |
| 2.3.1 | Three flashes or below threshold | n/a | No flashing content; motion is limited to the discrete, capped-duration transitions of guidelines §7 |
| 2.5.4 | Motion actuation | n/a | No feature is operated by device or user motion |

## Screen 2 — Hoje (`TodayScreen.tsx`, `TodayHeader.tsx`, `TaskRow.tsx`, `InlineTitle.tsx`, `CaptureDeck.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `ui/Toast.tsx`, `ui/Banner.tsx`)

| ID | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1.1.1 | Non-text content has a text alternative | ✔ | Every icon-only control carries `aria-label` (*Adicionar*, *Fechar aviso*, `Editar título de …`, `Concluir …`/`Reabrir …`); decorative icons (`WifiOff`, `ChevronDown`, `Check`, the spinner) are `aria-hidden="true"` — `CaptureDeck.tsx:76,81-86`, `ui/Toast.tsx:36,51`, `TaskRow.tsx:89-91,132-137`, `ui/Banner.tsx:12` |
| 1.3.1 | Info and relationships (real semantics) | ✔ | `<header>` + `<main>`, one `<h1>Hoje</h1>`, a real `<ul>/<li>` list, a disclosure `<button aria-expanded>` for *Concluídas* — `TodayHeader.tsx:11-12`, `TodayScreen.tsx:300-312,331,349-368` |
| 2.4.1 | Bypass blocks (landmarks, one `<h1>`) | ✔ | `<header>` (`TodayHeader`) + `<main>` (the scroll region), one `<h1>Hoje</h1>`; the layout standard keeps a single-screen model with no repeated nav block to bypass — `TodayScreen.tsx:304,312`, `TodayHeader.tsx:11-12` |
| 1.3.2 | Meaningful sequence | ✔ | DOM order = header → banner slot → main (skeleton / error / empty / list) → toast slot → capture deck; no CSS reordering anywhere in these components — `TodayScreen.tsx:299-410` |
| 1.3.3 | Sensory characteristics | ✔ | Overdue/priority/done/missed states are named in words (*atrasada · venceu …*, *· alta*, *não concluída*), never by shape or position alone — `TaskRow.tsx:109-125`, `src/shared/format.ts` (`taskMetaLine`) |
| 1.4.1 | Use of colour | ✔ | Overdue meta pairs `text-overdue` with the word *atrasada*; priority pairs the chevron glyph with the word *alta*/*baixa*; done pairs `text-muted` + line-through with the control name *Reabrir …*; the offline banner pairs the `WifiOff` icon with a full sentence — `TaskRow.tsx:109-125`, `ui/Banner.tsx:6-15` |
| 2.1.1 | Keyboard | ✔ | Every control is a real `<button>` or Base UI primitive, reachable and activatable by Tab + Enter/Space; no hover-only or drag-only action anywhere in `src/app` (confirmed by search: no `onTouchStart`/`onDrag`/gesture handler exists) |
| 2.1.2 | No keyboard trap | ✔ | No dialog lives on this screen; the one disclosure (*Concluídas*) is inline content, not a modal — `TodayScreen.tsx:349-388` |
| 2.2.1 | Timing adjustable | ✔ | The only auto-expiring content is the informational toast (4 s, `TOAST_AUTO_DISMISS_MS`), and only when it carries **no** action; a toast with an action (*Desfazer*, *Atualizar*) never auto-expires — `autoDismisses()` is `false` whenever `action !== undefined`, and `reduceToast`'s `expire` case is then a no-op — `src/shared/toast.ts:63,73-75,92-97` |
| 2.2.2 | Pause, stop, hide | ✔ | Same evidence as 2.2.1 (actionable toasts persist until used, dismissed or replaced); nothing else on the screen moves continuously — the only `setInterval` in `src/app` is a silent 1-hour SW-update poll with no visible UI (`pwa.ts:27`), and no CSS animation is `infinite` anywhere (confirmed by search) |
| 2.4.2 | Page titled | ✔ | `document.title = "Hoje · Praesto Sum"` set on mount — `TodayScreen.tsx:270` |
| 2.4.3 | Focus order | ✔ | Tab order follows the visual stack top-to-bottom: header → banner (if shown) → each row's controls → pencil → *Concluídas* disclosure → toast → deck field → submit; no `tabIndex` override anywhere in these components (confirmed by search) |
| 2.4.4 | Link purpose | ✔ (vacuous) | No `<a>` element exists on this screen (confirmed by search); every navigable action is a `<button>` naming its own effect |
| 2.5.1 | Pointer gestures | ✔ (vacuous) | No swipe or drag gesture is implemented anywhere in `src/app` (confirmed by search); guidelines §12.4 reserves swipe as a shortcut to a visible control for later, not yet built |
| 2.5.2 | Pointer cancellation | ✔ | Every control is a native/Base UI `<button>` or `Toggle`, activated on click/keyup; no `onPointerDown`-triggered action exists anywhere in `src/app` (confirmed by search) |
| 2.5.3 | Label in name | ✔ | Text buttons' accessible name equals their visible text exactly (*Nova tarefa*, *Desfazer*, *Tentar de novo*); icon-only controls carry no visible text to diverge from (1.1.1 governs those) — `EmptyState.tsx:13`, `TodayScreen.tsx:321` |
| 3.1.1 | Language of page | ✔ | `<html lang="pt-BR">`, document-level — `index.html:2` |
| 3.2.1 | On focus | ✔ | No `onFocus` handler triggers navigation or a request anywhere in these components (confirmed by search) |
| 3.2.2 | On input | ✔ | Every `onChange` only updates local state (`setTitle`, `InlineTitle`'s `setDraft`); a request fires only from an explicit submit or tap — `CaptureDeck.tsx:71`, `InlineTitle.tsx:44` |
| 3.2.6 | Consistent help | ✔ (vacuous) | No help mechanism exists anywhere in the app yet (confirmed by search) |
| 3.3.1 | Error identification | ✔ | The load error and the capture error render as a full sentence next to what failed (`role="alert"`, under the list / under the field) — `TodayScreen.tsx:315-322`, `CaptureDeck.tsx:98-102` |
| 3.3.2 | Labels or instructions | ✔ — after this phase's fix | The capture field has a real, visible `<label for="capture-title">Nova tarefa</label>` (the field's own `placeholder` is a second, separate hint, not the label); the inline title editor carries `aria-label` (naming the Task) **and**, new this phase, `aria-describedby` (the *Enter salva, Esc cancela.* instruction) — full ruling in **## This phase's four findings**, finding 4 — `CaptureDeck.tsx:47-52,66`; `InlineTitle.tsx` (this phase's edit) |
| 3.3.7 | Redundant entry | ✔ (vacuous) | The capture flow is single-step (title only); nothing already entered is ever re-asked |
| 4.1.2 | Name, role, value | ✔ | `CompleteControl` is a Base UI `Checkbox.Root` exposing checkbox role/checked state with `aria-label` (`ui/CompleteControl.tsx:23-27`); chips are Base UI `Toggle`s — real `<button>` + `aria-pressed` (`node_modules/@base-ui/react/toggle/Toggle.js:77,112`) inside a `role="group"` `ToggleGroup` (`node_modules/@base-ui/react/toggle-group/ToggleGroup.js:78`); the *Concluídas* disclosure is a native `<button aria-expanded>` (`TodayScreen.tsx:352`); the toast is `role="alert"`/`role="status"` (`ui/Toast.tsx:31`, this phase's fix) |
| 1.2.1 / 1.2.2 / 1.2.3 | Media alternatives (prerecorded) | n/a | No audio or video content exists anywhere in the app |
| 1.4.2 | Audio control | n/a | No audio plays anywhere in the app |
| 2.1.4 | Character key shortcuts | n/a | No single-key shortcut exists anywhere in `src/app` (same evidence as screen 1) |
| 2.3.1 | Three flashes or below threshold | n/a | No flashing content; the one signature completion animation is a single, capped-duration transition (guidelines §7), not a repeating flash |
| 2.5.4 | Motion actuation | n/a | No feature is operated by device or user motion |

## Screen 3 — Detail sheet (`ui/Sheet.tsx`, `TaskSheet.tsx`, `ui/ConfirmView.tsx`)

| ID | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1.1.1 | Non-text content has a text alternative | ✔ | *Fechar* carries `aria-label="Fechar"`; the `X`/`Trash2` icons inside it and beside *Excluir* are `aria-hidden="true"`; the drag handle `<div>` is `aria-hidden="true"` — `ui/Sheet.tsx:93-95,102-107`, `TaskSheet.tsx:172` |
| 1.3.1 | Info and relationships (real semantics) | ✔ | Real `<label htmlFor>` on *Título*/*Descrição*, a real `<form onSubmit>`, an `<h2>` naming the sheet via `aria-labelledby`; the confirmation uses a real `<h3>` — `TaskSheet.tsx:78-103`, `ui/Sheet.tsx:89,97-99`, `ui/ConfirmView.tsx:42` |
| 2.4.1 | Bypass blocks (landmarks, one `<h1>`) | ✔ — ruling | The sheet is a modal opened from *Hoje*, whose own `<h1>Hoje</h1>` stays the document's single `<h1>` while the page behind is made inert by `showModal()`. The native `<dialog>` carries the implicit ARIA role `dialog` (HTML spec) and is `aria-labelledby` its own `<h2>{title}</h2>` — the correct nested-heading pattern for a modal's title, not a second document `<h1>` — `ui/Sheet.tsx:53-54,84-99` |
| 1.3.2 | Meaningful sequence | ✔ | Field order in the DOM matches the layout standard §3 order (Título → Descrição → Data → Prioridade → Cancelar/Salvar → error → Excluir); no CSS reordering — `TaskSheet.tsx:70-175` |
| 1.3.3 | Sensory characteristics | ✔ | The pressed chip state is named by the group's own visible heading plus the pressed option's own text, never by position; the confirmation states the consequence in a full sentence (*Não dá para desfazer.*) — `TaskSheet.tsx:105-142`, `ui/ConfirmView.tsx:43` |
| 1.4.1 | Use of colour | ✔ | The pressed chip carries fill **and** font-weight **and** a check glyph, never colour alone — `ui/Chip.tsx:40-43`; *Excluir* is icon + word in `muted`, never the live/overdue hue (guidelines §4.2: the destructive button stays neutral) — `ui/ConfirmView.tsx:60-69` |
| 2.1.1 | Keyboard | ✔ | Every field and button is natively focusable/activatable; Esc, the *Fechar* button and the Android back gesture are all designed to route through the same `close`/`cancel` listener pair — `ui/Sheet.tsx:65-82` |
| 2.1.2 | No keyboard trap | ✔ (focus-return partially OWED — see ## Owed) | Focus cannot escape to the inert background while the dialog is open (`showModal()`); `ui/Sheet.tsx`'s header comment records that `<dialog>` "returns focus to the opener natively on close" (`:15-17`), and Tab reaches the close button first, never a hidden trap (`:55-59`). Phase 3's pane run could not itself confirm the return-to-opener step (a scripted `.click()` does not move focus the way a real tap does) — see Owed |
| 2.2.1 | Timing adjustable | ✔ | No timer or auto-expiring content inside the dialog itself; the shared toast rule (screen 2's 2.2.1 evidence) applies identically when `toastSlot` renders inside the sheet — `TaskSheet.tsx:188` |
| 2.2.2 | Pause, stop, hide | ✔ | Same toast-persistence rule as screen 2; the only motion inside the dialog is the one-shot open/close slide (a state transition, not looping content) — `styles.css:87-134` |
| 2.4.2 | Page titled | ✔ — ruling | The sheet does not set `document.title` itself; it is a dialog layered over *Hoje* (title *Hoje · Praesto Sum*) or, reached via a 401 route, over the gate (*Praesto Sum*) — the underlying document always carries a meaningful title while the dialog is open, so there is no untitled state to reach |
| 2.4.3 | Focus order | ✔ | Tab order inside the dialog follows the visual stack: *Fechar* → Título → Descrição → Data chips → Data input → Prioridade chips → Cancelar/Salvar → Excluir; the dialog root itself is `tabIndex={-1}` (skipped in the tab sequence by design, so Tab reaches *Fechar* first, never the invisible dialog wrapper) — `ui/Sheet.tsx:56-59,88` |
| 2.4.4 | Link purpose | ✔ (vacuous) | No `<a>` element exists inside the sheet or the confirmation (confirmed by search) |
| 2.5.1 | Pointer gestures | ✔ (vacuous) | No swipe-to-dismiss is implemented; the handle `<div>` at the top is decorative only (`aria-hidden="true"`, no gesture handler attached) — `ui/Sheet.tsx:92-95` |
| 2.5.2 | Pointer cancellation | ✔ | Every button (*Fechar*, *Cancelar*, *Salvar*, *Excluir*) is a native/Base UI `<button>`, activated on click, never on `pointerdown` |
| 2.5.3 | Label in name | ✔ | *Cancelar*/*Salvar*/*Excluir*/*Fechar* carry visible text (or, for *Fechar*, an `aria-label` with no competing visible text) equal to their accessible name; the date-mode/priority chips' visible text equals their accessible name (native text-content-derived name) — `TaskSheet.tsx:144-174`, `ui/ConfirmView.tsx:57-69` |
| 3.1.1 | Language of page | ✔ | Same document-level `<html lang="pt-BR">` — `index.html:2` |
| 3.2.1 | On focus | ✔ | No `onFocus` handler exists anywhere in `TaskSheet.tsx`, `ui/ConfirmView.tsx` or `ui/Sheet.tsx` |
| 3.2.2 | On input | ✔ | Every field's `onChange` only calls `onDraftChange` (updates the in-memory draft); the request fires solely from the form's explicit `onSubmit` (*Salvar*) — `TaskSheet.tsx:73-76,85,100,112-114,126,135-137` |
| 3.2.6 | Consistent help | ✔ (vacuous) | No help mechanism exists anywhere in the app yet |
| 3.3.1 | Error identification | ✔ | The save error renders as a full sentence directly under the form, `role="alert"`; the confirmation's own error uses the identical pattern — `TaskSheet.tsx:159-163`, `ui/ConfirmView.tsx:44-48` |
| 3.3.2 | Labels or instructions | ✔ — after this phase's + Task 2's fixes | *Título*/*Descrição* have real `<label for>`; the date-mode group's visible heading is *Data* (`<p id="sheet-date-label">`) and its `ChipGroup`'s own accessible name is `"Data"`; the native date input now carries `aria-label="Data — dia"` — a distinct name from the group while both stay visibly under the same *Data* heading for a sighted user; *Prioridade*'s heading and its `ChipGroup`'s name are both `"Prioridade"`, with no second control to collide (Task 2's check — see finding 2 below) — `TaskSheet.tsx:105-127,130-133` |
| 3.3.7 | Redundant entry | ✔ | The draft-in-memory rule means a Task edited then closed keeps its draft for the rest of the session; reopening the same Task restores exactly what was typed, so the owner never re-enters the same field twice — `TaskSheet.tsx:54-59` (comment + `lastDraft` ref), `src/shared/task-sheet.ts` (`currentDraft`) |
| 4.1.2 | Name, role, value | ✔ — after this phase's fix | The date-mode group and the date input now expose two distinct accessible names (*Data* vs *Data — dia*) instead of one shared name (AC-A2); chips are Base UI `Toggle`s with `aria-pressed`; the dialog exposes the native `dialog` role with `aria-labelledby`; *Excluir* replaces the dialog's own content with the confirmation in place — never a second, stacked dialog (`document.querySelectorAll("dialog[open]").length === 1`, confirmed in `PRPs/reports/ui-design-pass/phase-3/build-report.md:135`) — `TaskSheet.tsx:108-127` |
| 1.2.1 / 1.2.2 / 1.2.3 | Media alternatives (prerecorded) | n/a | No audio or video content exists anywhere in the app |
| 1.4.2 | Audio control | n/a | No audio plays anywhere in the app |
| 2.1.4 | Character key shortcuts | n/a | No single-key shortcut exists anywhere in `src/app` (same evidence as screen 1); the sheet's own Enter/Esc handling is native `<form>` submission and the dialog's own close contract, not a custom single-key binding |
| 2.3.1 | Three flashes or below threshold | n/a | No flashing content; the sheet's slide transition is a single, capped-duration state change |
| 2.5.4 | Motion actuation | n/a | No feature is operated by device or user motion |

**Verdict for this walk:** 24 of 24 applicable criteria hold ✔ on all three
screens (72 of 72), 7 of 7 n/a criteria hold vacuously on all three screens
(21 of 21) — 93 of 93 rows recorded, zero ✘. One structural nuance (2.1.2's
focus-return sub-step on the sheet) and the product-level Android back
gesture remain **OWED to the pane/device**, listed in full below — never
claimed as measured when they were not.

---

## This phase's four findings

The phase-4 grounding pass surfaced four defects the full Level A walk (not
any Tier A per-change check) was built to catch — each about how a state is
*announced*, not how it looks. All four are fixed in this attempt; here is
what each task did and why.

### 1. The toast's error announced no more urgently than a confirmation

`Toast.tsx` set `role={isError ? "alert" : "status"}` **and** an unconditional
`aria-live="polite"`. `role="alert"` already implies `aria-live="assertive"`
and `role="status"` already implies `aria-live="polite"` — an explicit
`aria-live` attribute overrides the role's own implicit value, so the error
toast (which should interrupt) was announced with the same politeness as
*Tarefa salva* (which should not). **Task 1** removed the explicit attribute,
leaving each role to carry its own politeness, and added a comment above the
`role` line naming the rule (phrased to avoid the same literal string the
plan's own validation greps for, so the fix and its guard do not collide).
Delivers AC-A1 / PRD AC-21.

### 2. Two adjacent controls on the detail sheet were both named *Data*

The date-mode `ChipGroup` (`label="Data"`) and the native date input
(`aria-label="Data"`) shared one accessible name — a Level A 4.1.2 problem in
a screen-reader's forms list, even though both are visibly grouped under one
*Data* heading for a sighted user. **Task 2** renamed the date input's
accessible name to `"Data — dia"`, keeping the chip group's name as `"Data"`
(the group is still what a sighted user reads as the section heading). The
priority pair was checked the same way: only the `ChipGroup` carries
`label="Prioridade"` — no second control on the sheet shares that name, so
`TaskSheet.tsx` needed no further change there. Delivers AC-A2 / PRD AC-21.

### 3. The capture field's offline hint appeared with no announcement

The connectivity state directly above it (`Banner.tsx`, `role="status"`) is
announced; the deck's own offline hint (`Captura indisponível sem conexão.`)
was a plain `<p>`, silent to a screen reader even though the field beside it
goes disabled at the same moment. **Task 3** wrapped the hint in
`role="status"` — the identical idiom `Banner.tsx` already uses for the same
underlying state — with a short comment naming why. The copy, the classes and
the `!canWrite` condition are byte-identical to before. Delivers AC-A3 / PRD
AC-21.

### 4. The inline title editor had a name but no instructions — the 3.3.2 ruling

**The finding.** `InlineTitle.tsx`'s `<input>` already carried
`aria-label={\`Editar título de ${task.title}\`}` — a real, programmatic
accessible *name*. What Level A 3.3.2 asks for is broader than a name alone:
"Labels **or instructions** are provided when content requires user input."
This editor requires input and offers two ways to leave it (Enter commits,
Esc abandons) that exist nowhere else in the app's vocabulary — a sighted
user has no visible affordance telling them this either, but infers it from
platform convention (a text field with a blinking caret invites Enter/Esc).
A screen-reader user gets neither the visual cue nor the naming convention;
without an explicit instruction, "Enter salva, Esc cancela" is knowledge only
a sighted, mouse-and-keyboard-experienced user would guess.

**The ruling.** The editor cannot carry a second *visible* label without
duplicating the Task's own title, which the editor replaces in place, in the
exact same visual position and at the exact same size the title just
occupied. This walk rules that the row's own (momentarily replaced) visible
title satisfies 3.3.2's "label" half by *spatial and temporal substitution*:
a sighted user was looking at the Task's name a fraction of a second before
the input appeared in its exact slot, so the "what does this field belong to"
question 3.3.2 exists to answer is never actually open for them — and the
pre-existing `aria-label` answers the identical question for a screen-reader
user by naming the Task directly, with no substitution needed. What was
genuinely missing was the "instructions" half: how to use this transient
control. **Task 4** closed that gap with `aria-describedby` pointing at a
visually-hidden `<span className="sr-only">Enter salva, Esc cancela.</span>`
rendered beside the input. (`sr-only` was confirmed to already exist as a
built-in Tailwind v4 utility — compiled into `node_modules/tailwindcss/dist/lib.js`
and `lib.mjs` — before it was used, per the plan's own instruction to check
first; no new CSS file and no new token were added.) Delivers AC-A4 / PRD
AC-21.

---

## The 2026-08-19 checklist findings, closed

`PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md` recorded **13
distinct ✘** against the pre-A5 app (its own summary line). Mapped to the
phase that closed each:

| # | Finding (2026-08-19) | Rule | Closed by |
|---|---|---|---|
| 1 | Touch targets under 48 px (gate inputs/buttons 41 px; board row actions ~18 px, the "worst offender") | §3.3 | Phase 2 (board rows/controls rebuilt ≥ 48 px) + Phase 3 (gate rebuilt on the tokens — "the 41 px finding of 2026-08-19 is closed", `phase-3/build-report.md:129`) |
| 2 | No dark canvas continuity (`color-scheme` meta absent; white canvas behind a dark splash) | §2.4 | Phase 1 (`index.html` chrome: `theme-color #161012`, `color-scheme: dark` meta and CSS — `phase-1/build-report.md:65-67`) |
| 3 | `overscroll-behavior` not contained (accidental pull-to-refresh risk) | §2.5 | Phase 1 (`overscroll-behavior-y: contain` confirmed live on `html`/`body` — `phase-1/build-report.md:116-118`) |
| 4 | Visible copy in English (gate and board) | §9 | Phase 2 (board strings) + Phase 3 (gate strings) — both Tier A item 4 in their build reports |
| 5 | All-caps CSS on the *Closed* label | §9.2 | Phase 2 (zero `text-transform: uppercase` confirmed by the structural gate — `phase-2/build-report.md:66-67`) |
| 6 | The `missed` state was a bare `!` glyph with no text label | §1.4.1 / §4.4 | Phase 2 (`taskMetaLine` renders the word *não concluída*, AC-6) |
| 7 | Placeholder-only fields, no visible label (gate token field; capture field) | §10 3.3.2 | Phase 2 (`<label for="capture-title">Nova tarefa</label>`) + Phase 3 (`<label htmlFor="api-token">Token da API</label>`) |
| 8 | Irreversible delete had no confirmation | §8 | Phase 3 (`ConfirmView`, the in-place confirmation) |
| 9 | Completing a Task had no *Desfazer* toast | §8 | Phase 2 (`showToast` with `action: {label: "Desfazer"}` on complete) |
| 10 | No offline / server-unreachable banner | §8, ADR-0004 | Phase 2 (`Banner.tsx` wired into `TodayScreen`) |
| 11 | The SW update prompt was `window.confirm` | §2.8 | Phase 2 (`main.tsx`'s `onNeedRefresh` → `showToast`; "no `window.confirm` anywhere under `src/app`" — `phase-2/build-report.md:64-65`) |
| 12 | The empty state had no CTA | §8 Empty | Phase 2 (`EmptyState.tsx`, the *Nova tarefa* CTA) |
| 13 | The detail screen's only way out was "← Back" with no history entry, so the Android back gesture left the app | §2.2 | **Structurally** closed by Phase 3 (native `<dialog>` + `showModal()`, whose `close`/`cancel` events are wired so Esc and the back gesture *should* close it per the HTML contract — `ui/Sheet.tsx:65-82`). **Still open as a device fact**: whether the owner's actual Android Chrome honours it has never been observed — PRD Open Question 1, phase-3's own "Owner's device check — OWED, not yet run" (`phase-3/build-report.md:210-220`). **Named here as the owner's check** — `PRPs/reports/ui-design-pass/phase-4/owner-runbook.md` step 4 is where it is finally run. |

12 of 13 are closed by code, measured and cited above. The 13th (the back
gesture) is a **device fact**, not a code question — the fallback
(`history.pushState` on open, `popstate` → `close()`) already exists as a
specified, ready-to-switch-on contingency inside `Sheet.tsx`'s own API surface
per the phase-3 plan's Notes, and is not activated unless the owner's check
finds it necessary.

---

## Owed

Everything below could not be settled from source or from an existing
phase 1–3 measurement, and is not guessed:

1. **2.1.2's focus-return sub-step on the sheet, interactively.** Phase 3's
   pane run could not confirm focus actually lands back on the opening row
   after a close, because a scripted `.click()` in that session never moved
   focus the way a real tap does (`phase-3/build-report.md:156`). The
   structural argument stands (native `<dialog>` returns focus to the opener
   per the HTML spec, and `ui/Sheet.tsx` adds no override), but a real,
   interactive confirmation is owed to the browser pane or the device.
2. **The Android back gesture, on the owner's actual phone and Chrome
   version** (finding 13 above; PRD Open Question 1; risk row 400). Owed to
   the owner — `owner-runbook.md` step 4.
3. **1280 px measurement.** Not a Level A criterion itself (WCAG's reflow
   criterion, 1.4.10, is AA), but the guidelines' own Tier B item 12 requires
   it once per shipped screen and it has never been taken in this feature —
   owed to the browser pane's Tier B pass, recorded in this phase's
   `build-report.md`, not duplicated here.
4. **Lighthouse** on the phone and on the built shell — optional, owed to the
   owner per `owner-runbook.md`; no Lighthouse tooling is installed in this
   repository and none will be (`testing-strategy.md:37`).
5. **Screenshots.** None exist for this phase, for the same reason none exist
   for phases 1–3: the verification browser pane has not composited a frame
   in this feature to date. Stated here again, not implied, per guidelines
   §12.6 ("never claim a screenshot you did not take").

None of the five block this walk's own verdict: every Level A criterion above
is either decided from source, decided from an existing phase 1–3
measurement, or explicitly carried here as owed — never asserted past what
the evidence in this document actually shows.

*Written by the Implementer agent, attempt 1, 2026-08-22.*
