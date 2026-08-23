# UI Design Pass

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: cross-cutting artifact (a PRD downstream stages consume); impact on shared UI (every existing screen, index.html, the manifest, the service-worker update flow); reuse and creation of components (src/app/components/ui/ consumed for the first time; Toast, Banner, ConfirmView, Skeleton added; Sheet moved to a native <dialog>); cross-cutting patterns (tokens-only styling, pt-BR copy, native <dialog> sheets, the 100dvh keyboard shell)
- Decisions found: ADR-0003, ADR-0004, ADR-0005, ADR-0008, ADR-0009, ADR-0010, ADR-0011, UI/UX plan Q8 and the owner decisions of 2026-08-18/20/21 —
  - ADR-0009 — visible UI copy in pt-BR; code, identifiers, tests and string keys stay English; tests that pin owner-facing messages pin the Portuguese wording from A5 on
  - ADR-0010 — direction "Arcade": tokens.css is machine truth; one elevated plane per screen (the capture deck); primary controls with a 3 px lower face that sinks on press; radius 18/14/pill; 48 px hit areas, 64 px rows, 56 px field; Inter + Unbounded in two files ≤ 100 KB; one signature completion moment; plumb-bob kept
  - ADR-0011 — owned shadcn-style components over Base UI + Tailwind v4; `shadcn init` never run; native <dialog> first for sheets unless Base UI Dialog is verified on the device
  - ADR-0004 / ADR-0005 — single installable PWA; React 19 SPA + Vite; exact pins; minimal tooling; no incidental dependency
  - ADR-0003 — no offline writes: the offline banner promises nothing and queues nothing
  - ADR-0008 — tdd: true; decidable logic goes to src/shared and is authored test-first; a purely visual AC produces no test file
  - UI/UX plan — Q8 "restyle before resuming" (A5 runs as ONE PRD: this file); owner decisions of 2026-08-18/20: dark-only with token pairs, WCAG 2.2 Level A + ≥ 48 px targets + prefers-reduced-motion, focus visible, no all-caps, no gamification, navigation model B (single screen + sheets), interactive-widget=resizes-content, voice & tone and microcopy approved
  - Owner, 2026-08-21 (this PRD's scope round): the row opens the detail and a 48 px pencil enters inline title editing; the ≥ 840 px two-pane desktop is deferred; downloading the two Google Fonts latin subsets is authorized
- Applicable anti-patterns: Portuguese in artifacts (carve-out), weakening tests to force green, offline write queue, version ranges, hand-duplicated entity types, glossary synonym drift —
  - Portuguese in artifacts — carve-out applies: only UI string values are pt-BR; identifiers, comments, tests and keys stay English
  - Weakening tests to force green — the message tests are updated to the new Portuguese intent, never loosened or skipped
  - Offline write queue — none; offline stays read-only behind a banner
  - Version ranges — no new package is added; the fonts are static files, not dependencies
  - Hand-duplicated entity types — TaskDto stays the only Task type; the formatters take a TaskDto
  - Glossary synonym drift — Task → "tarefa", done → "concluída", missed → "não concluída", overdue → "atrasada", deadline → "Concluir até", scheduled date → "Fazer em"
- Applicable architectural rules: src/shared DOM-free and dependency-free; app/worker boundary via tsconfig references; one Worker serves everything; tokens.css is the only style scale; UI verification stays manual —
  - src/shared stays DOM-free and dependency-free (the formatters and the connectivity reducer carry no window/navigator)
  - App/worker boundary via tsconfig project references; src/shared compiles into every target
  - One Worker serves assets + API; no second service; the service worker stays hand-owned (injectManifest)
  - tokens.css is the only style scale (guidelines §3.5); index.html critical CSS, the manifest and scripts/generate-icons.js carry the same background literal by design (§2.4)
  - UI verification stays manual (testing strategy); the browser-API glue is exempt, the logic is not (methodology)
- Result: PROCEED
```

## Problem Statement

The app the owner opens several times a day is still the 2026-08-03 walking
skeleton: one inline `styles` object, `system-ui`, English strings,
`window.confirm` for updates, 41 px inputs and ~18 px row actions, a white
canvas under a `#0b0b0c` splash. The UI/UX plan's activities A1–A4 produced the
rules, the identity, the layout standard and the library — and none of it is
applied: `src/app/tokens.css` and `src/app/styles.css` are imported nowhere, and
the components under `src/app/components/ui/` have zero consumers. Until that
changes the roadmap stays on hold (since 2026-08-18) and unit 3 cannot start
without becoming the design pass in disguise (plan Q8). The cost of not doing it
is paid daily by the one user, and paid again by every later unit that would
have to restyle whatever it touches.

## Evidence

- `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md` — the first
  checklist run found **13 distinct ✘** on the current screens: targets of
  41 px (inputs, buttons) and ~18 px (the `○ ⋯ ×` row glyphs), a white canvas
  against `theme-color #0b0b0c`, no `color-scheme`, no `overscroll-behavior`,
  English strings and a CSS-uppercased "Closed", an empty state without a CTA,
  no offline banner, `window.confirm` for the service-worker update, a detail
  screen without a history entry (Android back leaves the app),
  placeholder-only labels, a `!` glyph for `missed` with no text, delete
  without confirmation, complete without *Desfazer*.
- `src/app/App.tsx:528-566` — the single inline
  `const styles = {…} as const satisfies Record<string, CSSProperties>` drives
  every screen; `src/app/App.tsx:260-305` — the row actions are bare Unicode
  glyphs (`○`, `⋯`, `×`, `●`, `!`) inside `styles.link` buttons.
- `src/app/main.tsx:34-38` —
  `if (window.confirm("A new version is available. Update now?")) void update();`,
  already commented "Replace with real UI (toast/snackbar) later".
- `src/app/tokens.css:7-9` — "APPLIED in activity A5. Until A5 lands, App.tsx
  keeps its inline `styles` scale … and this file is not imported anywhere";
  neither `main.tsx` nor `App.tsx` imports any CSS, and nothing imports
  `Button`, `Chip`, `CompleteControl` or `Sheet` (codebase research,
  2026-08-21).
- `public/manifest.webmanifest:9-10`, `index.html:12`,
  `scripts/generate-icons.js:23`, `public/favicon.svg:10` — all four carry
  `#0b0b0c` while `--color-bg` is `#161012`, the literal `tokens.css` says must
  move together (guidelines §2.4, §3.5); the manifest's `name`, `short_name`
  and `shortcuts` text is English.
- `documentation/50-planning/ui-ux-plan.md`, activity A5 — "The existing app
  looks and feels like the plan says … verified on the Android phone and the
  Windows PC with screenshots kept"; exit signal: "the owner opens the app on
  both devices and does not want to change anything before unit 3 starts; both
  `npm test` and `npm run check` are green". Q8 (owner, 2026-08-18): restyle
  first, as one PRD.
- `PRPs/reports/ui-library/02-spike-shadcn.md` — the layout standard's Today
  screen rendered with the owned components measured **102.7 KB JS /
  5.5 KB CSS gzip** against the §11 budget of 170 / 30, every contrast pair
  above target and every control ≥ 48 px: the foundation is proven, only
  unapplied.
- `vite.config.ts:31-34` — the precache glob already includes `woff2`; no font
  file exists in the repository yet (codebase research, 2026-08-21).

## Proposed Solution

Apply everything A1–A4 decided to the screens that exist, in one pass and
nothing more: import `styles.css` (and with it `tokens.css`), retire the inline
`styles` object, break `App.tsx` into components that consume
`src/app/components/ui/`, and rebuild the three surfaces inside the layout
standard's anatomy — the token gate, the *Hoje* screen (header with the date
and the remaining count, 64 px rows with `CompleteControl` and a meta line, a
*Concluídas* section, the capture deck as the single elevated plane) and the
detail as a native `<dialog>` sheet with the delete confirmation inside it.
Replace every English string with the approved pt-BR microcopy, the
`window.confirm` with an update toast, and the missing states (empty with a
CTA, skeleton, offline banner, *Desfazer* toast) with the guidelines' §8
designs. Fix the PWA chrome so splash, first paint and app are one `#161012`
surface (critical CSS, `color-scheme`, manifest colours and pt-BR text,
regenerated icons and favicon), declare `interactive-widget=resizes-content`
with the `100dvh` shell, and self-host Inter + Unbounded as two precached WOFF2
files. The decidable parts — the Portuguese request and token messages, the
header and row formatters, the connectivity state machine — go to `src/shared`
test-first; the rest is verified manually per the checklist, in the browser
pane at 375 px and 1280 px, then on the owner's phone and PC. This approach over
the alternatives (restyling unit by unit; a rewrite around a router or a toast
library) because the plan already rejected unit-by-unit restyling (Q8), the
spike proved the components inside the budget, and the only things the pass
needs that do not exist yet — a toast, a banner, a confirmation view, a
skeleton and the native-dialog sheet — are small owned components, not
dependencies.

## Key Hypothesis

We believe applying the identity, the layout standard and the owned component
library to the existing screens in one pass will turn the skeleton into an app
the owner wants to open every day and give unit 3 a foundation to build *on*
rather than *over*. We will know we are right when the owner verifies the
deployed app on both devices and asks for no change before unit 3 starts, and
when unit 3's plan adds its groups, chip row and filter sheet without changing
`tokens.css`, the shell or any component under `src/app/components/ui/`.

## What We're NOT Building

- **The unit 3 Today view** — the groups *Atrasadas / Hoje / Próximas / Sem
  data*, the quick-filter chip row, the filter sheet and the filter badge:
  FR-007 belongs to unit 3. A5 restyles today's behaviour (one open list in the
  API's urgency order plus a *Concluídas* section) inside the anatomy those
  groups will occupy.
- **Header icon buttons** (search, filters, settings) — no destination exists
  behind them yet (units 3 and 8); nothing is added "just in case" (checklist
  item 1).
- **The ≥ 840 px two-pane desktop** (420 px list pane + flat detail pane) —
  deferred by the owner on 2026-08-21. A5 ships the standard's 600–839 dp rule
  at every width ≥ 600 px: the column capped at 640 px and centred, the sheet
  centred at 560 px. Recorded as an explicit gap for unit 3 or a dedicated
  unit.
- **A light theme** — plan Q1: dark-only now; the tokens keep their light slot
  empty.
- **Gamification mechanics** — plan Q3; the one signature completion moment is
  feedback, not reward.
- **Haptics** — guidelines §7.3 require a setting to disable them and no
  settings route exists.
- **A toast or UI library, a router, an i18n layer, a Figma track** — none is
  needed: a few owned components and two views on `useState` cover it.
- **A browser/e2e test tier** — the testing strategy keeps UI verification
  manual; the trigger stays unit 6.
- **Push, reminders, search, export, recurrence** — their own units; the shell
  only leaves room for them where the layout standard says.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Blocking change requests after the owner opens the deployed app on the Android phone and the Windows PC | 0 before unit 3 starts | Owner's verdict recorded in the plan's History (A5 exit signal) |
| Checklist findings of 2026-08-19 still open | 0 of 13 | Tier A + Tier B runs per screen, filed under `PRPs/reports/ui-design-pass/` |
| Production build against guidelines §11 | JS ≤ 170 KB gzip · CSS ≤ 30 KB gzip · fonts ≤ 100 KB in ≤ 2 files · precache ≤ 1 MB | `vite build` size report + the `dist/` precache manifest, read at the end of every phase |
| Contrast on every shipped screen | The 5 pairs of §4.3 at ≥ 4.5:1 text / ≥ 3:1 UI, measured and recorded | DevTools colour picker per screen (Tier B item 10) |
| Foundation files unit 3's first plan has to change (`tokens.css`, `styles.css`, the shell, `components/ui/`) | 0 edits (additions allowed) | Read from unit 3's plan when it is written |
| Quality gate | `npm test` and `npm run check` green; test count not below the 214 of 2026-08-21; no test weakened | Run locally at the end of every phase |

## Acceptance Criteria (test scenarios)

Each criterion carries a tag: **[auto]** — authored test-first in Vitest
against `src/shared` (per `docs/context/methodology.md`); **[static]** —
checked by a grep or the build output in the plan's validation commands;
**[manual]** — verified in the browser pane or on the device and recorded per
the checklist, which is the `EXISTING_COVERAGE_SUFFICIENT` path of the
methodology, not a gap.

- **AC-1 theme-continuity:** [manual] Given the installed PWA is cold-started on the phone, when the splash, the first paint and the running app are observed, then all three show the same `#161012` (manifest `background_color` and `theme_color`, inline critical CSS on `html`/`body` in `index.html`, `<meta name="color-scheme" content="dark">` and `color-scheme: dark` on `:root`), with no white flash and a status bar that matches the canvas.
- **AC-2 tokens-only:** [static] Given the final `src/app/` tree, when it is grepped, then no `style={` prop and no `const styles` object remain in any `.tsx` file except `DesignPlayground.tsx` (which may bind `var(--token)` values dynamically to render the token table), and no colour literal (`#hex`, `rgb(`, `hsl(`) appears outside `src/app/tokens.css`, `index.html`, `public/manifest.webmanifest`, `scripts/generate-icons.js` and the SVG files under `public/` — the exempt-by-design set of guidelines §3.5.
- **AC-3 pt-br-copy:** [manual] Given any screen, state or toast, when its visible text is read, then every string is pt-BR from the approved microcopy (the table under `## Solution Detail`), in sentence case, with infinitive buttons and no CSS `text-transform: uppercase`; `<html lang>` stays `pt-BR` and `<title>` reads *Hoje · Praesto Sum* on the board and *Praesto Sum* on the token gate.
- **AC-4 pt-br-shared-messages:** [auto] Given `classifyRequestFailure` in `src/shared/request-failure.ts`, when the cause carries a numeric `status`, then `kind` is `http-error` and the message is `O servidor recusou a operação (código <status>). Tente de novo.`; when it carries none, then `kind` is `server-unreachable` and the message is `Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.`; and given `createTokenStore().save()` when neither store accepts the token, then it rejects with `Não foi possível guardar o token neste dispositivo. O navegador recusou IndexedDB e o armazenamento local — verifique se ele está bloqueando dados do site.` — the existing assertions in `test/request-failure.test.ts` and `test/token-store.test.ts:450` are updated to the Portuguese wording, never loosened.
- **AC-5 header-formatters:** [auto] Given a pure module under `src/shared` (no DOM globals, no dependencies), when `formatRemaining(n)` is called, then `0` → `{ figure: null, label: "nenhuma restante" }`, `1` → `{ figure: "1", label: "restante" }`, `4` → `{ figure: "4", label: "restantes" }` (zero special-cased explicitly, never through `Intl.PluralRules`); and when `formatHeaderDate(new Date("2026-08-21T15:00:00Z"))` is called, then it returns `sex., 21/08` — the pt-BR short weekday from `Intl.DateTimeFormat(...).formatToParts`, assembled as `<weekday>, <dd>/<mm>` in `America/Sao_Paulo`.
- **AC-6 row-meta-formatter:** [auto] Given `taskMetaLine(task, today)` in the same module, when the Task is open with a deadline before `today`, then the result is `{ text: "atrasada · venceu <day>", overdue: true }`; a deadline equal to `today` → `até hoje`, `today + 1` → `até amanhã`, later → `até <weekday>, <dd>/<mm>` (e.g. `até sáb., 22/08`), all with `overdue: false`; a scheduled date maps the same way to `fazer hoje` / `fazer amanhã` / `fazer <weekday>, <dd>/<mm>` and to `atrasada · era para <day>` when past, where `<day>` is `ontem` for `today - 1` and `<weekday>, <dd>/<mm>` otherwise (e.g. `atrasada · venceu ter., 18/08`); `priority: "high"` appends ` · alta` and `"low"` appends ` · baixa` (`"normal"` and `null` append nothing); a `done` Task yields `null`; a `missed` Task yields `{ text: "não concluída", overdue: true }`; an open, undated, unprioritised Task yields `null`.
- **AC-7 connectivity-reducer:** [auto] Given `reduceConnectivity(state, event)` in `src/shared/connectivity.ts`, when events are applied, then `browser-offline` → `offline`; `browser-online` → `online`; `request-failed` with `kind: "server-unreachable"` → `unreachable` unless the state is `offline` (which wins); `request-failed` with `kind: "http-error"` → the state is unchanged (the server answered); `request-succeeded` → `online`; and `canWrite(state)` is true only for `online`.
- **AC-8 targets-and-rows:** [manual] Given the board at 375 px, when every tappable control is measured in DevTools, then each hit area is ≥ 48 × 48 CSS px with ≥ 8 px to its neighbours, every Task row is ≥ 64 px, the capture field is 56 px and the inputs inside the field and the rows are ≥ 48 px tall.
- **AC-9 capture-deck:** [manual] Given the board, when it opens on *Hoje*, then the deck is bottom-anchored as the only elevated plane (surface-2 with a top highlight), shows the eyebrow *Nova tarefa*, a 56 px field with a visible accessible label and `enterkeyhint="done"`, and an icon-only 48 px primary submit (*Adicionar*) with the 3 px lower face that sinks on press; the `autofocus` attribute is on that field and on no other element (focus moved after a tap — the inline title input, the empty-state CTA — is focus management, not autofocus); Enter or the submit creates the Task; a failed request keeps the typed text and shows the request-error message under the field (the FR-045 invariant); and while the connectivity state is not `online` the field and the submit are disabled with the inline hint *Captura indisponível sem conexão.*
- **AC-10 complete-with-undo:** [manual] Given an open Task, when its `CompleteControl` is tapped, then the row plays the signature moment (the check sinks 2 px and fires one amber ring, ~400 ms, shortened under `prefers-reduced-motion`), leaves the open list immediately (optimistic) while the *Concluídas* count increments, a toast *Tarefa concluída · Desfazer* appears above the deck and persists until used, dismissed or replaced by the next toast, *Desfazer* reopens the Task with the toast *Tarefa reaberta*, and a failed request rolls the row back and shows the request-error message in the toast slot.
- **AC-11 delete-confirmation:** [manual] Given the detail sheet, when *Excluir* is tapped, then the sheet's content becomes the confirmation *Excluir esta tarefa? Não dá para desfazer.* with *Cancelar* (focused by default) before *Excluir*, *Cancelar* returns to the detail with the draft intact, *Excluir* deletes, closes the sheet and shows *Tarefa excluída*, and no delete control exists on any row.
- **AC-12 detail-sheet-close-requests:** [manual, device] Given a row tap, when the detail opens, then it is a native `<dialog>` opened with `showModal()` (a bottom sheet with a handle on compact widths, centred at 560 px from 600 px), the page behind is scroll-locked, Esc, the close button and the Android back gesture all close it, focus returns to the row, and a draft edited then closed is restored when the same Task is reopened in the session; *Salvar* sends only the diff `buildTaskPatch` computes, keeps the sheet open with the error under *Salvar* on failure, and closes with the toast *Tarefa salva* on success.
- **AC-13 inline-title-pencil:** [manual] Given a Task row, when its 48 px trailing pencil (*Editar título*) is tapped, then the title becomes an input in place, Enter or blur commits (no request when unchanged or empty), Esc abandons, and tapping anywhere else on the row still opens the detail sheet — the pencil is the row's single trailing element.
- **AC-14 offline-banner:** [manual] Given the board, when DevTools Network is set to Offline or the server is unreachable, then a text + icon banner *Sem conexão. Dá para ler, mas não para salvar por enquanto.* sits directly under the header on every screen, is not dismissible, the deck and the row actions are disabled, the already-loaded list stays visible, and when connectivity returns the banner clears and the list refetches by itself; the list also refetches when the tab becomes visible again.
- **AC-15 update-toast:** [manual, preview build] Given a production build served by `npm run preview` with a newer build waiting, when the service worker reports `waiting`, then a toast *Nova versão disponível · Atualizar / Depois* appears instead of `window.confirm`; *Atualizar* sends `SKIP_WAITING` and the page reloads on `controlling`; *Depois* dismisses it for the session.
- **AC-16 empty-and-loading-states:** [manual] Given zero Tasks, when the board renders, then the list region shows *Nada para hoje. Bora capturar a primeira?* with one CTA *Nova tarefa* that focuses the capture field, and no blank region; given the first load still pending, then a skeleton mirroring header, rows and deck is shown (the `index.html` critical CSS paints the shell silhouette before JavaScript), and after ~10 s one line *Ainda carregando…* is added.
- **AC-17 keyboard-shell:** [manual, device] Given the capture field focused on the phone, when the keyboard opens, then the layout viewport shrinks (`interactive-widget=resizes-content`), the deck stays visible above the keyboard with no script, the list remains its own scroll container inside a `100dvh` grid with `overflow: clip`, the safe-area padding is dropped while a field has focus, and pull-to-refresh never triggers (`overscroll-behavior: contain` on `html`, `body` and scrollable sheets).
- **AC-18 fonts-and-budget:** [static] Given `vite build`, when its size report and the `dist/` precache manifest are read, then exactly two WOFF2 files (Inter variable 400–700 latin, Unbounded 800 latin) ship from the same origin, together ≤ 100 KB, declared with inline `@font-face` in `<head>` with `font-display: optional` and listed in the precache manifest; first-load JS ≤ 170 KB gzip, CSS ≤ 30 KB gzip, precache ≤ 1 MB; and DevTools Network shows no request to another origin.
- **AC-19 manifest-and-icons:** [static + manual] Given `public/manifest.webmanifest`, `public/favicon.svg` and `scripts/generate-icons.js`, when they are read after regeneration, then `theme_color` and `background_color` are `#161012`, `name` is *Praesto Sum*, `short_name` is *Praesto*, the shortcut reads *Nova tarefa* with a pt-BR description, the five PNGs under `public/icons/` are regenerated on the new background with the brass gradient kept, the maskable icon keeps its 80 % safe zone, the badge stays a white silhouette on transparency, and `favicon.svg` shares the same background.
- **AC-20 design-route-dev-only:** [manual + static] Given `npm run dev`, when `/design` is opened, then one page renders every token (the surface ladder, lines, text, accent and live colours, the five type rungs in Inter and Unbounded, the spacing scale, the radii, the three elevation recipes, the motion bands) and every component state (button variants at rest, pressed and disabled; `CompleteControl` unchecked, checked and animating; chips; a row in open, overdue, done and missed states; toast, banner, empty, skeleton, sheet, confirmation); and given `vite build`, then the route's module is absent from the production bundle.
- **AC-21 level-a-per-screen:** [manual] Given each of the three screens (token gate, *Hoje*, detail sheet), when the 31 WCAG 2.2 Level A criteria of guidelines §10 are walked, then every applicable criterion holds (landmarks and one `<h1>`, visible labels, `aria-label` on icon-only controls, focus visible and returned, no colour-only meaning, no time limit on toasts with actions) and the pass is recorded under `PRPs/reports/ui-design-pass/`.
- **AC-22 checklists-and-gates:** [static + artifact] Given the end of each phase, when its record is read, then a Tier A ✔/✘ result exists for every change and a Tier B result for every shipped screen (contrast pairs, simulated states, 375 px and 1280 px, the build report), with screenshots filed under `PRPs/reports/ui-design-pass/` or the written reason none exists, and `npm test` and `npm run check` are green.

## Open Questions

- [ ] Does the owner's Android Chrome honour close requests for a modal `<dialog>` — does the back gesture close the sheet without leaving the app? Verified on the device as the first task of Phase 3; the fallback is a history entry pushed on open and popped on close, inside the same `Sheet` API.
- [ ] Lighthouse on the phone (`chrome://inspect`, `--throttling-method=provided`) — run in Phase 4 if the owner connects the phone; otherwise only the local run on the built shell is recorded (Tier B item 13 asks for the phone run when a screen is new).
- [ ] The ≥ 840 px two-pane desktop — deferred by the owner on 2026-08-21; decide at A6 whether it rides with unit 3 or gets its own unit, and record it in the plan's History.
- [ ] Should a static "no colour literal outside the exempt files" check become a test in the `docs` Vitest project (plain Node, reads files)? It needs a row in the testing strategy first; the Phase 1 plan decides.
- [ ] `TBD - needs validation`: whether an explicitly set `normal` priority should appear in the row meta line (hidden for now, same as unset) — real use decides.

---

## Users & Context

**Primary User**
- **Who:** The owner — the single user (CON-002) — on an installed PWA on his Android phone (one thumb, sunlight and night) and on his Windows PC (CON-007).
- **Current behavior:** Opens the English walking skeleton several times a day to capture and complete Tasks; since unit 2 corrects titles inline and dates on the detail screen.
- **Trigger:** Every capture or check-in — the moments the vision calls "effortless in, effortless out" — and, for this pass, the decision of 2026-08-18 that the bare screens "stop now, before unit 3".
- **Success state:** A dark, Portuguese, fast app that looks and feels like the plan says on both devices, that he opens without noticing the interface — and that unit 3 builds on without touching its foundation.

**Job to Be Done**
When I open Praesto to capture or check a Task, I want a screen that feels like mine — fast, dark, in Portuguese, one gesture for the essential — so I can keep using the app instead of writing things down anywhere else.

**Non-Users**
Nobody but the owner. This pass is also not for a light theme (plan Q1), for gamification (Q3), or for the Today view with groups and filters (unit 3).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `styles.css` (+ `tokens.css`) imported in `main.tsx`; the inline `styles` object retired; `App.tsx` split into components under `src/app/components/` that consume `src/app/components/ui/` | Guidelines §3.5 and §12.2: tokens only; inline style objects retired in A5 and never reintroduced |
| Must | The `100dvh` shell: header (*Hoje* · `Intl` date · remaining count), scrolling list, capture deck as the single elevated plane | Layout standard §2 anatomy and §4 keyboard decision |
| Must | 64 px rows with `CompleteControl`, title, the meta line from the shared formatter (dates, overdue, priority words), one trailing pencil; the *Concluídas* section; a `missed` row labelled *não concluída* | Standard §2.6; the honest mirror made visible; checklist findings on targets and the `!` glyph |
| Must | Inline title edit behind the pencil; the detail as a native `<dialog>` sheet with *Sem data · Concluir até · Fazer em* chips, *Alta · Normal · Baixa* chips, description, *Cancelar / Salvar*, *Excluir* → in-place confirmation; the draft kept in memory on close | Standard §3; guidelines §8 destructive rules; the owner's choice (b) of 2026-08-21 |
| Must | Toasts (*Desfazer*, *Tarefa salva*, *Tarefa excluída*, update available), the offline/unreachable banner, the empty state with a CTA, skeleton + *Ainda carregando…*, request errors inline; optimistic complete/reopen with rollback; refetch on `visibilitychange` and on reconnect; the signature completion moment | Guidelines §8 states and §12.4; ADR-0004 offline rule; closes the roadmap backlog item "refresh on foreground" |
| Must | The token gate restyled: flat mark + `praesto` wordmark, a visible label, *Salvar*, the 401 reason *Este dispositivo precisa do token de novo.* | Checklist findings; approved microcopy |
| Must | PWA chrome: `index.html` critical CSS + `color-scheme` + viewport `viewport-fit=cover, interactive-widget=resizes-content` + `overscroll-behavior`; manifest `#161012` + pt-BR text; icons and favicon regenerated | Guidelines §2.3–2.6; ADR-0010 consequences |
| Must | Inter variable 400–700 + Unbounded 800, latin subsets, self-hosted, `font-display: optional`, precached, ≤ 100 KB together | ADR-0010; guidelines §5.3 |
| Must | All visible copy in pt-BR per the approved table plus the rows added below | ADR-0009 |
| Must | `src/shared` modules for the Portuguese messages, the header/row formatters and the connectivity reducer, authored test-first | Methodology: logic split out, glue exempt |
| Must | The dev-only `/design` route rendering every token and state | Identity doc step 2.9 (moved to A5 on 2026-08-20) |
| Must | Tier A per change, Tier B per screen, screenshots and measurements under `PRPs/reports/ui-design-pass/`; verification on the phone and the PC | Plan A5 deliverables and exit signal |
| Should | *Concluídas* collapsed by default with its collapse state persisted | Standard §2.5: counts visible when collapsed, state persists per group |
| Should | `content-visibility: auto` + `contain-intrinsic-size` on rows | Guidelines §12.4 |
| Should | Lighthouse ≥ 90 on the built shell, recorded | Guidelines §11 |
| Could | Lighthouse on the phone via `chrome://inspect` | Tier B item 13, only if the phone is connected |
| Could | A static "no colour literal" test in the `docs` Vitest project | A regression guard for §12.2 — needs a testing-strategy row first |
| Won't | Groups, chip row, filters, header icons, the two-pane desktop, a light theme, gamification, haptics, libraries, a router, i18n, an e2e tier | See "What We're NOT Building" |

### Microcopy added by this pass

Strings already in the approved table of
`documentation/10-product/visual-identity.md` are used verbatim (empty,
filtered-empty, saved / completed / reopened, delete, request error, offline,
token rejected, update available, still loading). The rows below are new,
approved by the owner on 2026-08-21 in this PRD's scope round, and are added to
the identity doc's table in Phase 1 before they enter code:

| Where | Copy |
|---|---|
| Token gate | wordmark `praesto` · **Cole o token da API deste dispositivo.** · label *Token da API* · button *Salvar* |
| Token gate — store failure (tested) | **Não foi possível guardar o token neste dispositivo.** O navegador recusou IndexedDB e o armazenamento local — verifique se ele está bloqueando dados do site. |
| Header | **Hoje** · `sex., 21/08` · *N restantes* / *1 restante* / *nenhuma restante* |
| Capture deck | eyebrow *Nova tarefa* · placeholder *O que precisa ser feito?* · submit *Adicionar* · offline hint *Captura indisponível sem conexão.* |
| Row meta line | *até hoje* · *até amanhã* · *até sáb., 22/08* · *fazer hoje* · *fazer sáb., 22/08* · *atrasada · venceu ontem* · *atrasada · venceu ter., 18/08* · *atrasada · era para ter., 18/08* · *alta* / *baixa* · *não concluída* |
| Row actions (accessible names) | *Concluir {título}* / *Reabrir {título}* · *Editar título* |
| Section | **Concluídas** · count |
| Toasts | *Tarefa reaberta* · *Tarefa excluída* |
| Request errors (tested) | **Sem conexão com o servidor.** Nada se perdeu — tente de novo quando a conexão voltar. · **O servidor recusou a operação (código N).** Tente de novo. |
| Detail sheet | title = the Task title · labels *Título · Descrição · Data · Prioridade* · chips *Sem data · Concluir até · Fazer em* and *Alta · Normal · Baixa* (no chip selected = no priority) · *Cancelar* / *Salvar* / *Excluir* · close button *Fechar* |
| `<title>` | *Hoje · Praesto Sum* · *Praesto Sum* |
| Manifest | `name` *Praesto Sum* · `short_name` *Praesto* · shortcut *Nova tarefa* — *Abrir o Praesto com o campo de captura vazio* |

### MVP Scope

The fallback split of plan Q8 becomes the phase order: Phase 1 and Phase 2
(chrome, fonts, foundation and the *Hoje* screen) are the `design-pass-a` the
plan said the hold could lift after; Phase 3 and Phase 4 (sheet, confirmation,
token gate, device pass) complete the activity. The hypothesis is only testable
at the end of Phase 4 — the exit signal is the owner on both devices — so the
MVP is the whole pass, delivered in that order.

### User Flow

Open the app → (paste the token once) → *Hoje* with the capture field focused →
type, Enter → the row appears in the open list with its meta line → tap the
check → the row leaves the list, *Tarefa concluída · Desfazer* → tap a row → the
sheet slides up → change a date chip or the priority, *Salvar* → *Tarefa salva*
→ tap *Excluir* → *Excluir esta tarefa?* → *Cancelar* → the back gesture closes
the sheet. Offline: the banner appears, the deck greys out, the list stays
readable.

---

## Technical Approach

**Feasibility:** HIGH — the tokens, the Tailwind pipeline and the components
exist on `main`, pass `npm run check` and were measured in a production build at
60 % of the JS budget and 18 % of the CSS budget; no new dependency is needed
(the fonts are static files; the toast, the banner, the confirmation view, the
skeleton and the native-dialog sheet are small owned components); the API is
untouched. The single unverified assumption is the Android back gesture closing
a native modal `<dialog>` on the owner's Chrome version, which Phase 3 verifies
first and for which a history-entry fallback exists behind the same API.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

AC-4, AC-5, AC-6 and AC-7 are pure `src/shared` logic and are authored
test-first (AC-4 updates two existing suites to the Portuguese intent; AC-5,
AC-6 and AC-7 create new ones). AC-2, AC-18 and AC-19 are static checks in the
plan's validation commands. Every other criterion is DOM- or device-bound and is
verified manually, per `documentation/40-engineering/testing-strategy.md` and
the methodology's "Browser-API work" rule — the `EXISTING_COVERAGE_SUFFICIENT`
path, stated here so the test pair never reads a visual criterion as ambiguous.

### Architecture Notes

- **Tokens flow one way.** `src/app/styles.css` stays the only Tailwind entry
  (`@import "tailwindcss"` + `@import "./tokens.css"` + `@theme inline
  reference`); components use Tailwind utilities that resolve to `var(--token)`;
  `tokens.css` remains the single source (ADR-0011). The inline `styles` object
  is deleted, not migrated.
- **Component layout.** `src/app/components/ui/` keeps the primitives
  (`Button`, `Chip`, `CompleteControl`, `Sheet`, plus `Toast`, `Banner`,
  `ConfirmView` and `Skeleton` added here); `src/app/components/` holds the
  screens and their parts (`TokenGate`, `TodayScreen`, `TodayHeader`,
  `TaskRow`, `InlineTitle`, `CaptureDeck`, `TaskSheet`, `EmptyState`,
  `DesignPlayground`); `App.tsx` keeps only the three-valued token state and the
  screen switch. One component per file, `PascalCase`, `cva` + `cn()`
  (engineering conventions).
- **`Sheet` moves to a native `<dialog>`** (layout standard §3, ADR-0011
  "native first"): `showModal()` on open, the `close` event drives
  `onOpenChange(false)`, `closedby` left at its `closerequest` default for the
  editor (no light dismiss), `@starting-style` + `transition-behavior:
  allow-discrete` on `display` and `overlay` for the slide-up (Baseline 2024),
  `html:has(dialog[open]) { overflow: hidden }`. The Base UI `Dialog` import
  goes away and the bundle shrinks; `@base-ui/react` stays for `Button`,
  `Checkbox` and `Toggle`. The delete confirmation is a *view inside the same
  dialog* (never two stacked sheets): a close request from the confirmation
  closes the whole sheet without deleting.
- **Toasts stay reachable when a sheet is open:** the toast region is a
  `popover="manual"` element, so it renders in the top layer above the modal
  dialog (standard §2.8); one toast at a time; 4 s without an action,
  persistent with one.
- **Update flow.** `setupPwa` keeps its `onNeedRefresh(update)` contract
  (`src/app/pwa.ts:5`); `main.tsx` hands the callback to a tiny module-level
  toast store that `TodayScreen` subscribes to, so the toast renders in React
  without moving service-worker registration into a component.
- **Connectivity.** `src/shared/connectivity.ts` (the pure reducer of AC-7) +
  a `useConnectivity()` hook that feeds it `online`/`offline` events, request
  outcomes from the API client and `visibilitychange` — the hook is the exempt
  glue. `canWrite` gates the deck and the row actions; the banner reads the
  state.
- **Formatting.** `src/shared/format.ts` (AC-5, AC-6) uses
  `Intl.DateTimeFormat("pt-BR", …).formatToParts` with `PRAESTO_TIMEZONE` from
  `src/shared/dates.ts` and day arithmetic on `YYYY-MM-DD` strings; it never
  reads `Date.now()` — `today` is an argument, so the tests are deterministic
  and unit 3's groups can reuse it.
- **Keyboard shell and safe areas.** The shell is a `100dvh` grid (`header /
  list / deck`, `overflow: clip`); the deck is an in-flow grid row, not a fixed
  element, so its edge-to-edge padding is
  `padding-bottom: env(safe-area-inset-bottom, 0px)` — the "never on a fixed
  element" rule of guidelines §2.3 targets fixed bars, and the static
  `safe-area-max-inset-bottom` + negative `bottom` recipe applies only to
  positioned elements. The padding is dropped under
  `:root:has(input:focus-visible, textarea:focus-visible)` (standard §4).
  Recorded here so the guidelines can say so at A6.
- **Fonts.** Two latin-subset WOFF2 files under `public/fonts/` (Inter
  variable 400–700, Unbounded 800; SIL OFL 1.1, licence files kept beside
  them), obtained once from the Google Fonts CSS2 API / `fonts.gstatic.com`
  (owner-authorized 2026-08-21), declared with inline `@font-face` in `<head>`
  (`font-display: optional`, latin `unicode-range`), picked up by the existing
  `woff2` precache glob; `includeAssets` gains `fonts/*.woff2`. The measured
  sizes are recorded in Phase 1; if they exceed 100 KB together, Unbounded is
  dropped and Inter 800 renders the count (ADR-0010's escape).
- **Chrome.** `index.html` gains `<meta name="color-scheme" content="dark">`,
  the viewport string of standard §4, a `<style>` block with
  `html { background: #161012; color-scheme: dark }` and the shell skeleton
  silhouette (the only allowed literal besides the manifest and the icon
  script), and its `theme-color` meta moves to `#161012` — it overrides the
  manifest's `theme_color`, so the two must agree.
- **Icons.** `scripts/generate-icons.js` changes only its `BACKGROUND` constant
  (and its comment); the five PNGs are regenerated with
  `node scripts/generate-icons.js`; `public/favicon.svg`'s rect moves to
  `#161012` (the same geometry as `public/brand/mark-brass.svg`).
- **`/design`.** Mounted only when
  `import.meta.env.DEV && location.pathname === "/design"` through a dynamic
  import, so the production bundle never contains it (AC-20).
- **No API change, no schema change, no new dependency.** `TaskDto` is the
  only Task type; `buildTaskPatch` / `dateModeOf` keep owning the edit
  semantics; `listTasks` keeps the API's urgency order.
- **Branch and merge.** Work happens on `feature/ui-design-pass`; the
  repository still has no remote, so the branch is merged locally into `main`
  after the owner's device verification, as unit 2 was.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The Android back gesture does not close the native modal `<dialog>` on the owner's Chrome version | L | Verify on the device as the first task of Phase 3 with a one-screen check; fallback = `history.pushState` on open + `popstate` → `close()`, inside `Sheet`, no other file changes |
| §11 budget creep — fonts (≈ 70 KB), dialog transitions, new components | L | Read `vite build` at the end of every phase; the spike's 102.7 KB JS already included Base UI `Dialog`, which this pass removes |
| The test pair reads a visual criterion as AMBIGUOUS and aborts | M | Every AC carries an explicit [auto] / [static] / [manual] tag and the TDD routing names the four automated ones |
| `font-display: optional` shows the system font on the very first cold load | H (by design) | Accepted by guidelines §5.3; the precache makes every later load render Inter immediately; recorded so the owner reads the first open correctly |
| Translating the pinned messages breaks the suite | H (expected) | The two suites are updated to the Portuguese intent in the same phase, test-first; no assertion is loosened |
| Scope creep toward unit 3 (groups, chips, filters) during the rebuild | M | "What We're NOT Building" and the Won't row; the list stays one open list + *Concluídas* |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Chrome, fonts and foundation | `index.html`, manifest, icons and favicon on `#161012`; two self-hosted WOFF2 + `@font-face` + precache; `styles.css` imported; global base; the `/design` route; Portuguese shared messages, header/row formatters and the connectivity reducer authored test-first | implemented | - | - | PRPs/plans/ui-design-pass-phase-1-chrome-fonts-and-foundation.plan.md |
| 2 | Today screen | The `100dvh` shell, header, capture deck, 64 px rows with `CompleteControl` and the meta line, pencil inline edit, *Concluídas*, empty and loading states, toasts (*Desfazer*, update), the offline banner, refetch on focus/reconnect, the signature completion moment | implemented | no | 1 | PRPs/plans/ui-design-pass-phase-2-today-screen.plan.md |
| 3 | Detail sheet, delete confirmation and token gate | `Sheet` on a native `<dialog>` with chips for date and priority, *Cancelar / Salvar*, *Excluir* → in-place confirmation, the draft kept in memory, back/Esc verified on the device; the token gate restyled with the 401 reason | implemented | no | 2 | PRPs/plans/ui-design-pass-phase-3-sheet-confirmation-and-token-gate.plan.md |
| 4 | Device verification pass | Tier B per screen (contrast, simulated states, 375 px and 1280 px, build report, Lighthouse), the Level A pass, screenshots and measurements filed, fixes, deploy and the owner's check on the phone and the PC | implemented | no | 3 | PRPs/plans/ui-design-pass-phase-4-device-verification-pass.plan.md |

#### Phase-status lifecycle

This table IS relay's canonical phase-state machine (`docs/decisions.md`,
2026-05-04) — there is no separate state file. Every row starts at
`pending` and advances through exactly five states, in order, never
skipping backwards:

| Status | Meaning | Written by |
|--------|---------|------------|
| `pending` | No plan yet. The only state from which a row is actionable. | Authored here, by hand or by `prd-writer` |
| `in-progress` | A DRAFT plan exists and the `PRP Plan` cell points at it. | `plan-writer` Step 5.1 back-fill |
| `implemented` | Code written and code-review APPROVED; tests not yet settled. | `/relay-implement` D8 Mutation c |
| `tested` | Test suite ran GREEN *and* post-green review confirmed the green was not obtained by weakening tests. | `/relay-execute` Step A.5.3 |
| `complete` | The orchestrator drove the phase end to end. | `/relay-execute` Step A.6.0 |

Three rules follow from this table and are enforced across the pipeline:

1. **`tested` is skipped, never faked, when nothing was tested.** A project
   with no declared test framework (or a phase whose test stage self-skipped)
   goes `implemented` → `complete` directly. The skip reason is recorded in
   `PRPs/reports/<feature>/orchestrator-run.json`, not hidden in the Status
   cell.
2. **A dependency is satisfied from `implemented` onward.** A row listed in
   another row's `Depends` cell unblocks it once it reaches `implemented`,
   `tested`, or `complete` — not only at `complete`.
3. **`complete` does not mean "merged".** It means the orchestrator finished
   the phase. Merge, branch cleanup, and post-merge docs sync belong to
   `/relay-approve`, which never edits this table.

To re-run a phase, hand-edit its `Status` cell back to `pending` — that is
the documented escape hatch, and the only sanctioned backwards transition.

### Phase Details

**Phase 1: Chrome, fonts and foundation**
- **Goal:** The app boots as one dark surface with its own fonts, the token pipeline is live, every decidable string and formatter exists and is tested, and the playground shows what the next phases will use.
- **Scope:** AC-1 (chrome side), AC-4, AC-5, AC-6, AC-7, AC-18, AC-19, AC-20. Add the new microcopy rows to `documentation/10-product/visual-identity.md` before they enter code; download and commit the two WOFF2 files with their licences; `index.html`, `public/manifest.webmanifest`, `scripts/generate-icons.js` + the regenerated PNGs, `public/favicon.svg`, `vite.config.ts` `includeAssets`; import `styles.css` in `main.tsx` (the existing screens render on the dark canvas with their inline styles still present — those go in Phase 2 and Phase 3); `src/shared/format.ts`, `src/shared/connectivity.ts`, the Portuguese messages in `src/shared/request-failure.ts` and `src/shared/token-store.ts` with their tests updated; `src/app/components/DesignPlayground.tsx` behind the dev-only gate.
- **Success signal:** `npm test` green with the new and updated suites, `npm run check` green, `vite build` within §11 with the fonts in the precache manifest, `/design` rendering every token and state in the pane at 375 px, and the shell painting `#161012` before JavaScript.

**Phase 2: Today screen**
- **Goal:** The screen the owner uses most looks and behaves like the layout standard and the identity say.
- **Scope:** AC-2 (board), AC-3 (board), AC-8, AC-9, AC-10, AC-13, AC-14, AC-15, AC-16, AC-17. Split `App.tsx`; `TodayScreen`, `TodayHeader`, `TaskRow`, `InlineTitle` (pencil), `CaptureDeck`, `EmptyState`, `Skeleton`, `Toast`, `Banner`; the `useConnectivity` hook and the toast store; the update toast wired from `main.tsx`; `visibilitychange` / `online` refetch; optimistic complete/reopen with rollback; the completion moment; `content-visibility: auto`; *Concluídas* collapsed with its state persisted.
- **Success signal:** Tier A ✔ on every change and Tier B ✔ for the *Hoje* screen in the pane (375 px and 1280 px, contrast recorded, states simulated), filed under `PRPs/reports/ui-design-pass/`; the 2026-08-19 board findings closed except those owned by Phase 3 (history/back, delete confirmation).

**Phase 3: Detail sheet, delete confirmation and token gate**
- **Goal:** Everything one tap away works through the native sheet, destructive actions follow §8, and the first-run screen carries the identity.
- **Scope:** AC-2 (complete — `App.tsx` holds no inline style), AC-3 (gate + sheet), AC-11, AC-12. `Sheet` swapped to `<dialog>` (same API); `TaskSheet` with `ChipGroup` for the date mode and the priority, the native `<input type="date">`, description, *Cancelar / Salvar / Excluir*, `ConfirmView`; the draft-in-memory rule; the device check of the back gesture as the first task; `TokenGate` with the flat mark, the wordmark, a visible label and the 401 reason.
- **Success signal:** Tier A/B ✔ for the sheet and the gate; the back gesture verified on the phone (or the fallback switched on and verified); the 2026-08-19 findings list at 0 open.

**Phase 4: Device verification pass**
- **Goal:** The exit signal of activity A5 is met and recorded, not assumed.
- **Scope:** AC-1 (device), AC-8, AC-12 and AC-17 on the phone, AC-21, AC-22. The full Level A walk per screen; Lighthouse on the built shell (and on the phone if connected); the `vite build` report against §11; screenshots at 375 px and 1280 px from the pane plus the owner's phone screenshots; any fix the device pass demands; `npm run deploy` by the owner; the owner's verdict on both devices recorded in the plan's History. The docs close-out itself (roadmap hold, plan `deprecated`, guideline amendments) stays with activity A6.
- **Success signal:** The owner opens the deployed app on the Android phone and the Windows PC and asks for no change before unit 3; `npm test` and `npm run check` green; the report under `PRPs/reports/ui-design-pass/` names every measurement and every screenshot.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| One PRD for the whole pass | A5 runs as this single PRD with four phases | One PRD per screen; restyle unit by unit | Plan Q8 (owner, 2026-08-18): restyle first, as one PRD through the relay pipeline; the `-a`/`-b` split survives as the phase order |
| Inline title edit vs. the row opening the detail | The whole row opens the sheet; a 48 px trailing pencil (*Editar título*) enters inline editing | (a) retire inline editing and make the title the sheet's first field; title text = edit and the rest of the row = detail | Owner, 2026-08-21 (choice b): keeps unit 2's "corrected in place" decision and the standard's "row opens the detail" with exactly one trailing element |
| Two-pane desktop ≥ 840 px | Deferred; A5 applies the 600–839 dp rule at every width ≥ 600 px | Build the 420 px list pane + flat detail pane now | Owner, 2026-08-21: unit 3 gives the list its final shape; a two-pane layout built over today's flat list would be rebuilt |
| Sheet primitive | Native `<dialog>` + `showModal()`, same `Sheet` API | Keep Base UI `Dialog` and verify close requests on the device | Layout standard §3 and ADR-0011 name native first; close requests are the platform's own back-gesture semantics; dropping Base UI `Dialog` also shrinks the bundle |
| Delete placement and confirmation | *Excluir* lives in the sheet; the confirmation replaces the sheet's content in place; rows carry no delete | A second `<dialog>` over the sheet; delete on the row with a confirmation dialog | Standard §3 ("*Excluir* is a secondary button" in the detail; "never stack sheets"); the row's single trailing element is the pencil |
| Section for closed Tasks | *Concluídas*, collapsed by default with persisted state; a `missed` row inside it reads *não concluída* | *Encerradas*; two sections; always expanded | No `missed` row can exist before unit 10 writes them; the text label satisfies 1.4.1 now, and unit 10 designs the missed presentation |
| Row meta line | Built by a tested `src/shared` formatter with relative words (hoje / amanhã / ontem) and `Intl` dates; `done` rows carry no meta line | Compute it in the component; show raw `YYYY-MM-DD`; repeat "concluída" under every done row | Methodology: decidable logic leaves the component; unit 3 reuses the same phrases; the section and the strike-through already say "done" twice |
| Priority in the meta line | Only *alta* and *baixa* are shown | Show *normal* when explicitly set | Normal is the default reading of an unset priority; showing it adds a word to most rows for no information (tracked in Open Questions) |
| Complete / reopen | Optimistic with rollback and the request-error message in the toast slot | Await the server, then refresh | Guidelines §8: "Prefer optimistic complete / reopen with rollback + inline error" |
| Connectivity | A pure reducer in `src/shared` + one hook; the banner whenever the state is not `online`; writes gated by `canWrite` | Derive everything from `navigator.onLine`; show the banner only after a failed request | `navigator.onLine` misses an unreachable server; a failed request alone misses airplane mode; the reducer is tested, the hook is glue |
| Update toast plumbing | A module-level store fed by `main.tsx`'s `onNeedRefresh`, rendered by the screen | Move `setupPwa` into a React effect | Keeps service-worker registration after first paint as today and `pwa.ts` unchanged |
| Deck safe-area padding | In-flow grid row with `env(safe-area-inset-bottom, 0px)`, dropped while a field has focus | The fixed-element recipe of guidelines §2.3 | The deck is not fixed in the `100dvh` grid; the fixed-element thrash the rule guards against cannot occur; to be reflected in the guidelines at A6 |
| Fonts source | Google Fonts CSS2 API / `fonts.gstatic.com` latin subsets, downloaded once and committed under `public/fonts/` with their OFL licences | Build subsets locally with `pyftsubset` / `glyphhanger`; ship the full Inter file | Owner-authorized 2026-08-21; the same measurement path as 2026-08-20 (48.3 + 21.8 KB); no tooling added |
| Toast, banner, confirmation, skeleton | Owned components in the shadcn style, no library | `sonner` or similar | ADR-0011: owned components; a few small components cost less than one dependency under exact pins |
| `/design` gating | `import.meta.env.DEV` + a dynamic import on `/design` | A Vite plugin; a separate HTML entry | Zero production footprint with one line; no router exists or is wanted |
| Header content | `<h1>` *Hoje*, the mono date, the remaining count in Unbounded; no icon buttons | Placeholder search/settings icons | Nothing exists behind them; checklist item 1 |
| Verification venue | Browser pane at 375 px / 1280 px per change; phone + PC after deploy for Tier B; Lighthouse on the built shell, phone optional | Lighthouse on the phone mandatory | The testing strategy keeps UI manual; Tier B item 13 asks for the phone run when a screen is new |
| Branch and merge | `feature/ui-design-pass`, merged locally into `main` after the device pass | Work on `main` | No remote exists; unit 2's precedent; the worktree keeps `main` deployable |

---

## Research Summary

Research ran through the relay `research-web` and `research-codebase`
subagents on 2026-08-21 (web: 8 findings, the 4-search cap reached, no
degradation; codebase: 8 findings, no degradation). Every codebase reference
below was re-opened at the cited line in this session.

**Market Context**

- **Android back is a close request for a modal `<dialog>`.** MDN's
  CloseWatcher reference frames dismissal per device — Esc on a keyboard, the
  back button on Android
  (https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher); a 2025
  deep-dive lists "pressing the back button (Android)" as a close request for
  `showModal()` dialogs and notes Chrome 134 added a separate click-outside
  light dismiss (https://matuzo.at/blog/2025/close-requests-dialog).
- **`closedby` defaults to `closerequest` for `showModal()`** — no light
  dismiss unless `closedby="any"` is set, which matches the standard's "never
  light-dismiss an editor"
  (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).
  With stacked modals the browser closes only the topmost on Esc (same page) —
  one more reason the confirmation lives inside the sheet.
- **Animating a native dialog:** `@starting-style` for the entry state plus
  `transition-behavior: allow-discrete` on `display` and `overlay`
  (https://developer.chrome.com/blog/entry-exit-animations); `allow-discrete`
  is Baseline since August 2024 — Chrome/Edge 117+, Firefox 128+, Safari 18+
  (https://developer.mozilla.org/docs/Web/CSS/transition-behavior).
- **`font-display: optional`** has an extremely small block period and no swap
  period: a font not ready in time is abandoned for that page view; a precached
  font is used immediately on later loads
  (https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display).
- **A page-level `theme-color` meta overrides the manifest's `theme_color`;**
  `background_color` is the canvas before stylesheets load
  (https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Customize_your_app_colors)
  — the three declarations must agree.
- Gaps recorded by the agent: no source dated the exact Chrome version for
  back-gesture dialog dismissal (verified on the device — the first Open
  Question); no primary source for the Google Fonts CSS2 subset-download
  technique (the owner authorized the download; sizes are measured after it);
  no signal reached on task-app undo / confirm / offline patterns within the
  search cap — the guidelines' own verified sources already cover them;
  `color-scheme`'s effect on splash continuity is not covered by those pages
  (the guidelines cite developer.chrome.com's Auto Dark Theme note).

**Technical Context**

- `src/app/App.tsx:528-566` — the inline `styles` object every screen uses;
  `src/app/App.tsx:260-305` — the `○ ⋯ ×` / `● !` glyph buttons to replace
  with `CompleteControl`, the pencil and the sheet.
- `src/app/main.tsx:34-38` — `window.confirm` inside `setupPwa`'s
  `onNeedRefresh`; `src/app/pwa.ts:5,19-20` — the
  `(update: () => Promise<void>) => void` contract the toast keeps.
- `src/app/tokens.css:7-9` — "not imported anywhere" until A5;
  `src/app/styles.css` maps every token into Tailwind; no file imports it or
  the components (`Button`, `Chip`, `CompleteControl`, `Sheet` have zero
  consumers).
- `src/app/components/ui/Sheet.tsx:1-7` — built on Base UI `Dialog`, with its
  own note that A5 swaps the primitive for native `<dialog>` while keeping the
  API.
- `public/manifest.webmanifest:9-10`, `index.html:12`,
  `scripts/generate-icons.js:23`, `public/favicon.svg:10` — `#0b0b0c`
  everywhere; the manifest text is English; there is no `color-scheme` meta.
- `test/token-store.test.ts:450` — the only test pinning English wording
  (`/could not store the API token/i`); `test/request-failure.test.ts` asserts
  structure (`toContain("401")`, distinct messages, `kind`) — both are updated
  to the Portuguese intent under AC-4.
- `vite.config.ts:31-34` — `woff2` already in `globPatterns`; `includeAssets`
  lists no fonts; no `.woff2` exists in the repository; `package.json` carries
  no toast library (none will be added).
- `src/shared/dates.ts` — `todayIn(now, timeZone)` and `PRAESTO_TIMEZONE`
  exist for the formatter; `src/shared/task-edit.ts` — `buildTaskPatch` /
  `dateModeOf` keep owning the edit semantics; `--color-live` /
  `--color-overdue` are unused until the meta line.

---

*Generated: 2026-08-21*
*Approved: 2026-08-21*
*Status: APPROVED*
