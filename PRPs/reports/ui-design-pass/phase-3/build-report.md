# Build report — ui-design-pass phase 3 (Detail sheet, delete confirmation and token gate)

Source plan: `PRPs/plans/ui-design-pass-phase-3-sheet-confirmation-and-token-gate.plan.md`
(Task 8 — gates + budget probe; plan AC-A6, AC-A9, PRD AC-18, AC-22).

## Gates (Task 8 / Validation Level 1–2)

All three green, no test weakened or skipped:

- `npm run check` (`wrangler types --check && tsc -b && eslint . && prettier --check .`) — **PASS**
- `npm test` (`vitest run`, both the `worker` and `docs` projects) — **PASS**, 14 test
  files / 313 tests, including the test pair's new `test/task-sheet.test.ts` (24 cases,
  `src/shared/task-sheet.ts`'s `reduceTaskSheet` / `draftFromTask` / `currentDraft`) — RED
  for module-not-found before Task 1, GREEN after it, exactly as the TDD routing predicted;
  every phase-1 and phase-2 suite (`test/task-edit.test.ts` — which keeps pinning the diff
  the sheet's *Salvar* sends — `test/toast.test.ts`, `test/connectivity.test.ts`, and the
  rest) stayed untouched and green:
  - `worker` project — 13 test files / 251 tests
  - `docs` project — 1 test file / 62 tests
- `npm run build` (`tsc -b && vite build`, then the PWA service-worker inject pass) — **PASS**

## `vite build` size table

```
dist/praesto/.dev.vars              0.15 kB
dist/praesto/.vite/manifest.json    0.15 kB │ gzip:  0.11 kB
dist/praesto/wrangler.json          1.53 kB │ gzip:  0.79 kB
dist/praesto/index.js             216.97 kB │ gzip: 50.75 kB

dist/client/.assetsignore                                 0.02 kB
dist/client/index.html                                    3.96 kB │ gzip:  1.46 kB
dist/client/assets/index--IN80dHQ.css                    39.29 kB │ gzip:  7.80 kB
dist/client/assets/workbox-window.prod.es5-Bd17z0YL.js    5.65 kB │ gzip:  2.20 kB
dist/client/assets/index-DvviBeg7.js                    285.08 kB │ gzip: 91.61 kB

dist/client/sw.mjs  17.37 kB │ gzip: 5.86 kB

PWA v1.3.0
mode      injectManifest
format:   es
precache  25 entries (415.24 KiB)
files generated
  dist/client/sw.js
```

Baseline before this phase (phase 2's report, build of the same branch on
2026-08-21): JS 87,589 B gzip, CSS 7,447 B gzip. After this phase — the native
`<dialog>` sheet (`Sheet.tsx` rewritten, the transition CSS added to
`styles.css`), the new `TaskSheet.tsx` and `ConfirmView.tsx` components, the
`src/shared/task-sheet.ts` reducer, the `TokenGate.tsx` rebuild (adds the
`KeyRound` icon) and the `Trash2` icon on the delete controls, and the
`/design` playground's new *Sheet de tarefa* section — the precise gzip probe
(below) reads **JS 92,902 B gzip (+5,313 B, +6.1%)** and **CSS 7,756 B gzip
(+309 B, +4.1%)**. The Base UI `Dialog` import is confirmed gone from `src/`
(structural gate below), which the plan expected to show as a reduction; the
new sheet/confirmation/gate markup, the two new icons and the transition CSS
this phase adds outweigh what removing `Dialog` saved, so the net figure is a
small increase — recorded honestly, as the plan's Task 8 asks either way. Both
totals stay well inside budget: JS at 53% and CSS at 25% (phase 2 was 50% /
24%). The `/design` route stays tree-shaken out of this bundle entirely
(verified below); the PWA precache grows from 25 entries / 395.82 KiB to 25
entries / 415.24 KiB (the same 25 precached assets, larger because the JS and
CSS bundles themselves grew) — still far inside the guidelines §11 ≤ 1 MB
precache ceiling.

## §11 budget probe (Task 8 / Validation Level 3)

```
JS 92902 B gzip (budget 174080) · CSS 7756 B gzip (budget 30720)
PASS: inside the §11 budget
```

## Structural gate (Level 3)

- No inline `style={}` prop, `CSSProperties` import or `const styles` object
  survives anywhere under `src/app/` except `DesignPlayground.tsx`'s dynamic
  `var(--token)` swatches — `TaskDetail.tsx` (the last one) is deleted and
  `TokenGate.tsx` is rebuilt on the tokens; **PRD AC-2 completes this phase**.
- `grep -rnF "@base-ui/react/dialog" src` finds nothing — the Base UI `Dialog`
  import is gone from the whole `src/` tree; `Button`, `Checkbox` and `Toggle`
  stay on `@base-ui/react` (ADR-0011 unchanged for those three).
- No `window.confirm`, no `textTransform` / CSS `uppercase`, and none of the
  retired English strings (`"Save"`, `"Cancel"`, `"Delete"`, `"Edit Task"`,
  `"API token"`, `"No date"`, `"Complete by"`, `"Do on"`, `"Not set"`) survive
  anywhere under `src/app` — the token gate and the old detail screen were the
  last carriers of all of them.
- `test ! -f src/app/components/TaskDetail.tsx` — confirmed absent; `grep -rn
  'TaskDetail' src/app` finds no reference outside historical provenance
  comments citing the deleted file's old line numbers (`task-sheet.ts`'s
  header, outside `src/app`, and two comments inside `src/app` that cite the
  file by name without triggering the plan's own literal-string check —
  verified directly).
- `Sheet.tsx` contains `showModal()`; `styles.css` contains
  `html:has(dialog[open]) { overflow: hidden; }`; `TaskSheet.tsx` contains the
  confirmation's exact title `Excluir esta tarefa?`; `TokenGate.tsx` contains
  the 401 reason `Este dispositivo precisa do token de novo.`; `TodayScreen.tsx`
  contains the delete toast key `"task-deleted"` — all five present.
- No `outline-none` on any field in `TaskSheet.tsx`, `TokenGate.tsx` or
  `ConfirmView.tsx` — every field keeps the base `:focus-visible` ring from
  `styles.css` (the phase-2 pane finding this plan's Decision Gate names).
- `grep -rlF 'tokens e estados' dist/client` finds nothing — the `/design`
  playground (now carrying the *Sheet de tarefa* section) is still absent
  from the production bundle after the dynamic-import + `import.meta.env.DEV`
  tree-shake.

## Browser-pane Tier A / Tier B check — main session

Run on 2026-08-22 (21:45–22:30 UTC) by the main session against the running
`npm run dev` server (port 5173, Vite HMR + workerd + local D1), following the
plan's `## Notes` "Manual verification script". Checklist:
`documentation/40-engineering/ui-ux-guidelines.md` §"Review checklist".

**Pane conditions (recorded, as in phases 1 and 2).** The Browser pane was not
displayed: `document.visibilityState === "hidden"`, no frames composited — so
`screenshot` fails ("the page is not compositing frames"), no CSS transition
ever advances, and the desktop preset does not apply (1280 px stays
unmeasured). The 375 × 812 mobile preset did apply, `prefers-color-scheme:
dark`. Every figure below is a `getBoundingClientRect` / `getComputedStyle`
read at 375 × 812. The token gate was measured on `/` itself; the sheet, the
confirmation and the standalone `ConfirmView` on `/design` → *Sheet de tarefa*,
which mounts the very same components with the fixture Task (the pane holds no
API token and the main session does not enter tokens).

### Tier A — the nine checklist items

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ the sheet has one primary (*Salvar*) with *Cancelar* beside it and *Excluir* set apart (ghost, `margin-top: 16px`); the gate has one field and one *Salvar*; the confirmation has exactly two buttons |
| 2 | Every tappable control ≥ 48 × 48 px, ≥ 8 px apart | ✔ 13 controls measured inside the sheet: *Fechar* 48 × 48, *Título* 343 × 48, *Descrição* 343 × 98, the three date chips 89/128/88 × 48, the date input 343 × 48, the three priority chips 73/75/62 × 48, *Cancelar* 169 × 48, *Salvar* 167 × 48, *Excluir* 112 × 48; the confirmation's *Cancelar* / *Excluir* 168 × 48 each (standalone `ConfirmView` 151 × 48); the gate's field 343 × 48 and *Salvar* 343 × 48 — the 41 px finding of 2026-08-19 is closed |
| 3 | No meaning by colour alone | ✔ the pressed chip carries fill **and** weight **and** a check glyph; *Excluir* is icon + word in `muted`, never the live hue; the confirmation states the consequence in words (*Não dá para desfazer.*) |
| 4 | Copy pt-BR, sentence case, infinitive buttons | ✔ sheet: *Título · Descrição · Data · Prioridade*, *Sem data · Concluir até · Fazer em*, *Alta · Normal · Baixa*, *Cancelar / Salvar / Excluir*, *Fechar*; confirmation: *Excluir esta tarefa?* / *Não dá para desfazer.*; gate: `praesto`, *Cole o token da API deste dispositivo.*, *Token da API*, *Salvar*, and the 401 reason *Este dispositivo precisa do token de novo.*; zero elements with `text-transform: uppercase` |
| 5 | Tab / Enter / Esc work, focus visible, focus returns | ✔ after a real Tab, all 13 focusables inside the sheet show the ring `outline: solid 2px rgb(245,165,36)`, `outline-offset: 2px` (the three fields and *Salvar* keep their own `shadow-field` / `shadow-control` instead of the dark halo — ring + offset, which §4.5 accepts); the confirmation focuses *Cancelar* on mount; Esc itself could not be raised in the hidden pane — the equivalent `requestClose()` path was exercised instead (see the defect below) |
| 6 | `aria-label` on icon-only controls; visible labels; `lang`; `<title>` | ✔ `<html lang="pt-BR">`; `<title>` *Design · Praesto Sum* on the playground and *Praesto Sum* on the gate; `aria-labelledby` on the dialog points at its `<h2>` (the Task title); real `<label for>` on `sheet-title`, `sheet-description` and `api-token` (both resolve); *Fechar* and the date input carry `aria-label`; the mark is `alt=""` beside the `praesto` `<h1>` |
| 7 | Tokens only; durations from the bands; reduced motion honoured | ✔ sheet plane `rgb(31,24,22)` = `--color-surface-1`, radius 24 px, `max-height: 730.8px` = 90 dvh, `overflow-y: auto` + `overscroll-behavior: contain`; the slide reads `translate` with `--duration-medium` and the two easings, the backdrop `rgb(0 0 0 / 0.5)`; zero `style=` attributes rendered on `/` |
| 8 | Destructive actions follow §8 | ✔ *Excluir* opens the in-place confirmation inside the same dialog (`document.querySelectorAll("dialog[open]").length === 1` — never two sheets), *Cancelar* is focused and comes first, *Excluir* is second with icon + text, a close request from the confirmation closes the whole sheet without deleting, and no row carries a delete control |
| 9 | No request to another origin | ✔ every request is `http://localhost:5173/...` (Vite modules, `lucide-react`, Base UI chunks, `/brand/mark-flat.svg`) |

Console: no errors on `/` or `/design`, before or after the fix round.

### Tier B — measured and reported

| # | Item | Result |
|---|---|---|
| 10 | Contrast, five pairs of §4.3 | on the sheet plane (`surface-1`): heading `ink` **15,65:1** ✔ · field text `ink` **15,65:1** ✔ · field labels `muted` **6,74:1** ✔ · unpressed chip `ink` **14,07:1** ✔ · pressed chip `on-accent` on `accent` **9,08:1** ✔ · *Salvar* `on-accent` on `accent` **9,08:1** ✔ · *Excluir* `muted` **6,74:1** ✔; on the gate: instruction and label `muted/bg` **7,24:1** ✔ |
| 11 | §8 states the screen can reach, simulated | ✔ detail, confirmation, and the closed/exiting state exercised on the playground; the request-error and busy states are wired to the parent (`error` under *Salvar*, `busy` disabling every control) and are owed with a real token |
| 12 | 375 px and 1280 px; safe areas, keyboard, overscroll on the phone; back closes sheets | 375 px ✔ (sheet 375 × 731 docked to the bottom edge, `padding-bottom: 16px`, handle visible, no horizontal overflow). **1280 px not measured** (desktop preset not applied in the hidden pane) — the `sm:` centred 560 px layout is static-only for now. The Android back gesture is the owner's device check, still owed |
| 13 | `vite build` size report read against §11 | ✔ JS 92 902 B gzip (≤ 174 080, 53 %), CSS 7 756 B gzip (≤ 30 720, 25 %) |
| 14 | Screenshots filed, or the reason none exists | **None — the Browser pane was not displayed** (screenshot fails: "the page is not compositing frames"); DOM measurements recorded instead |

### The plan's script, step by step

| Step | Status |
|---|---|
| 1 sheet opens as a modal `<dialog>`, scroll-locked, focus on the dialog | ✔ `open === true`, `:modal` matches, `html { overflow: hidden }`, `document.activeElement` is the `<dialog>` |
| 2 every control ≥ 48 px | ✔ (Tier A item 2) |
| 3 edit + close via *Fechar* + reopen restores the draft; Esc closes; focus returns to the opener | ✔ for *Fechar* (title, description and both chip groups all restored on reopen); the close-request path needed a fix (below); focus-return could not be judged — the scripted `.click()` never moves focus to the opener, so the browser correctly returned focus to whatever held it |
| 4 *Excluir* → confirmation, *Cancelar* focused, back to the detail with the draft intact | ✔ one dialog throughout, *Cancelar* focused on mount, the draft survived the round trip; confirming closed the sheet and a later reopen seeded a **fresh** draft (the reducer's `deleted` drop, working end to end) |
| 5 standalone `ConfirmView` measurements and contrast | ✔ 151 × 48 buttons, same copy, same focus rule |
| 6 the gate: mark + `praesto` `<h1>`, visible label, 48 px controls, `<title>`, no `autofocus` | ✔ all of it, plus `autocomplete="off"`, `enterkeyhint="done"` and zero inline styles |
| 7 the 401 reason round-trip | owed — it needs a token to be stored and rejected (the main session does not enter tokens); the string and its wiring are pinned by the Task 6 VALIDATE greps and by `App.tsx`'s `setGateReason("unauthorized")` on the 401 route |
| 8 contrast | ✔ (Tier B item 10) |
| 9 build size vs phase 2 | ✔ +5 313 B JS gzip; the Base UI `Dialog` removal was outweighed by the sheet, the confirmation and the rebuilt gate — recorded honestly above |
| 10 screenshots | reason recorded (Tier B item 14) |

### Defects found in this check — both fixed in attempt 2

1. **The draft reverted during the exit slide** (also caught independently by
   the code-reviewer as `R-SEM`): `TaskSheet` kept the last **Task** in a ref
   for the ~300 ms exit transition but recomputed the **draft** from the Task,
   so every edit-then-close visibly reverted the fields while the sheet slid
   away. Fixed with a `lastDraft` ref mirroring `lastTask`
   (`draft ?? lastDraft.current ?? draftFromTask(shown)`). Re-measured: 120 ms
   after the close request the field still reads the edited text.
2. **A close request could leave the sheet stuck open.** After
   `dialog.requestClose()` — the exact path Esc and the Android back gesture
   take — the dialog closed natively but **no `close` event was ever
   dispatched** in this browser, so `onOpenChange(false)` never ran, React's
   state stayed "open", and the sheet could not be reopened short of a reload.
   A control experiment settled the cause: a bare, React-free `<dialog>`
   created in the same page behaves identically (only `cancel` fires,
   `open` flips to `false`), so this is an artefact of the verification
   browser (Chrome/148 in a hidden pane), **not** a defect in `Sheet.tsx` —
   the HTML spec's `close` contract the plan relies on is correct. Because the
   failure mode is severe where it does occur (the editor becomes unreachable),
   `Sheet.tsx` now also mirrors the `cancel` event into `onOpenChange(false)`
   through a native listener with cleanup — spec-neutral on a healthy browser
   (the reducer's `close` is idempotent, and `test/task-sheet.test.ts` pins
   that) and self-healing where `close` is missing. Re-measured: the state
   clears, the scroll lock releases, and the sheet reopens with the draft
   restored. The plan's Task 2 line "no `onCancel` handler" is superseded by
   this measurement — recorded for A6.

### Owed checks — recipe for the owner

Open `http://localhost:5173/` in the pane (or the phone on the same network),
paste the API token from `.dev.vars` once, then: open a Task from a row, change
a chip, *Salvar* → *Tarefa salva* and the row's meta line updates; reopen,
*Excluir* → *Excluir* → *Tarefa excluída* and the row is gone; with DevTools
offline, *Salvar* → the request-error sentence under *Salvar* with the sheet
still open; then the 401 round trip of step 7. On the phone, the back-gesture
check below. Nothing in this list blocks `/relay-test`: the decidable rules are
green and every structural claim above is measured.

### Verdict for this phase

Tier A: 9 of 9 items hold after one fix round. Tier B: contrast and build
recorded; 1280 px, the phone, the live-API steps and the screenshot are owed to
the owner / Phase 4 with the reasons above. No further change requested.

### Owner's device check — OWED, not yet run

- [ ] PRD Open Question 1 / risk row 400: on the phone, open a Task, press the
      Android back gesture — the sheet must close and the app must stay; then
      open *Excluir* and press back — the sheet closes without deleting.
- [ ] If the gesture leaves the app instead of closing the sheet: switch on the
      `history.pushState` fallback documented in the plan's `## Notes` (inside
      `Sheet.tsx` only, same API), then re-verify.
- [ ] Worth watching on the device, given the finding above: that the sheet can
      be reopened after a back-gesture close (it can in the pane now, thanks to
      the `cancel` guard).

*Generated by the Implementer agent, attempt 1, 2026-08-22; the Tier A / Tier B
section and the attempt-2 figures added by the main session the same day.*
