---
status: active
last_updated: 2026-08-21
review_trigger: "a rule proves useless or wrong in practice (UI/UX plan A6 retro), a UI/UX-plan decision changes what a rule depends on, or a platform behaviour a rule cites changes"
---

# UI/UX Guidelines

> **Purpose:** The rules every interface change in Praesto follows — researched and verified (2026-08-18/19) for a daily-use installed PWA on an Android phone and a Windows PC — and the two-tier checklist a review runs against them.
> **Update when:** A rule proves useless or wrong in practice, a [UI/UX plan](../50-planning/ui-ux-plan.md) decision changes what a rule depends on (identity tokens, layout standard, UI library), or a platform behaviour a rule cites changes. Record the change in the plan's History while the plan is open, and in this document's [History](#history) after it closes.

## How to use this document

- **Always / Never** are non-negotiable; **Prefer / Avoid** ask for judgement; **an untagged rule is Always.** A `TBD` is an explicit gap owned by a named activity or decision — never a licence to improvise around it.
- Read it before touching anything under `src/app/`, `index.html`, `public/manifest.webmanifest` or `src/sw.ts`. Run **Tier A** of the [checklist](#review-checklist) on every interface change (including one-line ones) and **Tier B** once per shipped screen; paste the ✔/✘ result in the implementation plan (`PRPs/plans/…plan.md`) or the PR description. One ✘ without a recorded, conscious exception means the change is not done.
- It sits above the identity and the layout standard: tokens, the mark and voice live in [`10-product/visual-identity.md`](../10-product/visual-identity.md) and `src/app/tokens.css`; the screen anatomy, navigation model and keyboard decision live in [`40-engineering/ui-layout-standard.md`](ui-layout-standard.md). This document says *what must be true*; those say *what it looks like*.
- Owner decisions it encodes (2026-08-18): visible copy in pt-BR ([ADR-0009](../60-decisions/ADR-0009-ui-copy-in-brazilian-portuguese.md)); dark-only now, tokens born as light/dark pairs; **WCAG 2.2 Level A** as the formal bar, with ≥ 48 px targets and `prefers-reduced-motion` as rules; no gamification mechanics; gamer-app *ambience*, never their density. Two house rules go beyond the Level A answer and were **confirmed by the owner on 2026-08-20** (plan Q14): visible keyboard focus (§4.5) and no all-caps UI text (§9.2).

## 1. Design principles

Approved by the owner on 2026-08-20 (UI/UX plan step 2.4; derived from the attribute session in `PRPs/reports/visual-identity/02-attributes.md`). They are the tie-breaker in every design review; each one's opposite is a position a reasonable team could hold — that is what makes them decisions, not slogans.

1. **Precise over decorated.** Grid, alignment and exact spacing come before any ornament — if a pixel is off plumb, fix the plumb. So we won't ship decoration that does not serve reading.
2. **Lively dark over sober dark.** Near-black base, one saturated accent, warm feedback — if a screen feels like a bank vault, we got it wrong. So we won't do gloomy grey-on-grey.
3. **Energy in moments over constant energy.** At rest the interface is quiet; completing, capturing and celebrating are where it wakes up. So we will have one signature completion animation — and nothing blinking idly.
4. **Fewer elements over more visible features.** Every new element pays rent; what does not serve today's screen moves to a sheet or the detail. So every screen keeps exactly one primary action.
5. **Nerd inside, light outside.** Technical precision in the data (dates, counts, tabular numerals) with copy that winks — never bureaucratic. So humour may appear in empty and success states, never in errors (§9).

## 2. Platform — an installed PWA on Android and Windows

1. Keep `display: "standalone"`; style installed-only behaviour under `@media (display-mode: standalone)`; **never** show an install hint when that query matches (the owner has the app on both devices).
2. Android back is a *close* request: sheets and dialogs use native `<dialog>` / popover or `CloseWatcher` (Chrome ≥ 126) so the system back gesture closes them; at the history root back leaves the app — expected, never trapped. **Never** make a top-left arrow the only way out of a screen.
3. Keep `viewport-fit=cover`. Only the **bottom bar / capture bar** gets edge-to-edge padding, with Chrome's sanctioned pattern — static `padding-bottom: env(safe-area-max-inset-bottom, 36px)` plus `bottom: calc(env(safe-area-inset-bottom, 0px) - <that value>)` — **never** `padding-bottom: env(safe-area-inset-bottom)` on a fixed element (layout thrash). Sheets and toasts do not carry it. Insets are 0 on Windows. (Chrome 135; installed WebAPKs were still not edge-to-edge in Jul 2026 — code it now, expect it later.)
4. Declare the theme before CSS loads: `<meta name="color-scheme" content="dark">` in `<head>` and `color-scheme: dark` on `:root` (opts out of Chrome Android's Auto Dark re-darkening; darkens scrollbars, form controls, date/time pickers); `theme_color` (status bar / Windows title bar) and `background_color` (splash, canvas before CSS) **equal to the background token**, and that background declared inline in `index.html` — splash → first paint → app is one continuous surface. Manifest colours are plain (no images or gradients; avoid transparency). When a light theme ships, add `<meta name="theme-color" media="(prefers-color-scheme: …)">` pairs.
5. `overscroll-behavior-y: contain` on `html` and `body` (no accidental pull-to-refresh; refresh comes from §12.4) and `overscroll-behavior: contain` on scrollable sheets; `user-select: none` only on controls, **never** on Task text.
6. **Keyboard on Android:** since Chrome 108 the keyboard resizes only the visual viewport, so a fixed bottom capture bar hides under it. **Decided in the [layout standard §4](ui-layout-standard.md#4-keyboard-android--decided):** `interactive-widget=resizes-content` in the viewport meta, a `100dvh` grid shell with the list as its own scroll container, and the safe-area inset dropped while a field has focus. Use `dvh`, never `100vh`. **Never** disable zoom (`maximum-scale`, `user-scalable=no`).
7. **Desktop (Windows): never** stretch the phone layout — the column cap and the list + detail breakpoint are defined in the layout standard (A3); gate hover-only affordances behind `@media (hover: hover)`; keyboard accelerators (planned: `n` new Task, `/` search, `Esc` close, `Enter` save) appear in tooltips and a help sheet and **never** override OS shortcuts. **Prefer** keeping a focused element clear of sticky bars. `window-controls-overlay` is optional polish, not a requirement.
8. **Service-worker update:** the SW **never** calls `skipWaiting()` unconditionally; the app shows a toast on `waiting` ("Nova versão disponível" · *Atualizar* / *Depois*), sends `SKIP_WAITING` on accept, reloads on `controlling`. `window.confirm` is not UI.

## 3. Layout and hierarchy

1. **Few elements per screen is a rule.** One primary action per screen; everything else is secondary or one tap away. A screen that needs a legend has too much on it. Steam-style density is the named anti-pattern.
2. **Capture is the hero** — it sits where one thumb reaches it and primary buttons sit in the thumb zone. **Never** push rare or destructive actions to the top corners as a "safety" trick (grips shift, fingers hide content); give them distance, confirmation or undo instead (§8).
3. **Touch targets:** ≥ 48 × 48 CSS px hit area with ≥ 8 px between targets, even when the glyph is 24 px (owner's rule; WCAG 2.2 AA's 2.5.8 floor is 24 px). List rows are tappable along their full height.
4. **Navigation:** a bottom bar only for 3–5 destinations of equal weight on compact widths, a rail from medium width; with fewer than 3 use a single screen with sheets. Praesto's model and its flip rule live in the [layout standard §1](ui-layout-standard.md#1-navigation-model) — **never** add a navigation region ad hoc in a unit.
5. **Tokens, and the transition:** colours, spacing, radii, type sizes and durations come from `src/app/tokens.css`, whose values are decided by [ADR-0010](../60-decisions/ADR-0010-visual-identity-direction-arcade.md) (written in plan step 2.8, applied in A5). **Until then, the inline `styles` object in `App.tsx` is the token set: extend it, never add a second scale or a new literal.** Exempt by design, before and after: `index.html` critical CSS, `public/manifest.webmanifest` and `scripts/generate-icons.js`, which must carry the same literal as the background token (§2.4).

## 4. Colour and theme

1. **Dark-only ships now**; every colour is a semantic token with a light pair ready (plan Q1). Components reference tokens only (§3.5).
2. **Warm brown-black, never pure black** (ADR-0010 ladder `#161012 → #352a25`), off-white text, one hot accent family — âmbar for actions, `#ff5c1f` only for *live* state (a Reminder firing, an action in flight) and overdue. **Depth is tactile and has physics (ADR-0010, replaces the former "avoid shadows"):** elevation = a lighter surface + a 1 px top highlight, **never** a black shadow on black; **one elevated plane per screen** — the capture deck; primary controls carry a 3 px lower face and sink 3 px on press; relief only on controls, the deck and the field — **never** on text or static panels; gradients only on the mark. Re-measure contrast (§4.3) after any relief change.
3. **Contrast:** the formal bar is Level A, which has **no numeric contrast criterion**, so contrast is **measured and reported**, never blocking and never silent (Q11): with the DevTools colour picker (or axe DevTools), for five pairs — body text, muted text, accent on surface, focus ring on surface, icon on surface — recorded as `pair: x.x:1 ✔/✘` against the targets 4.5:1 text / 3:1 UI, on every token change and once per shipped screen (Tier B).
4. **Never** convey meaning by colour alone (Level A 1.4.1): overdue, priority, done, missed, offline also carry text or an icon.
5. **Focus** is visible with `:focus-visible` — **never** `outline: none` without a replacement; a two-tone ring (light inner + dark outer) or ring + offset so it survives any surface. *House rule above Level A (2.4.7 is AA) — owner-confirmed 2026-08-20 (plan Q14).*

## 5. Typography

1. Size in `rem`; the base size and scale come from tokens (§3.5); **never** `px`-only type. Fluid type, if used, keeps max ≤ 2.5 × min. **Prefer** layouts that survive 200 % zoom.
2. Line length 50–75 characters for prose; headings are hierarchy, not decoration. **Design for Portuguese lengths** (~15 % longer than English): labels, chips and buttons must not truncate "Concluir" or "Configurações".
3. **At most two self-hosted WOFF2 files, ≤ 100 KB together** (ADR-0010, measured 2026-08-20 on the Google Fonts latin subsets: Inter variable 400–700 = 48.3 KB, Unbounded 800 = 21.8 KB — 70 KB; the self-hosted files in A5 must stay within that) — latin subset, `@font-face` inline in `<head>`, precached by the SW, `font-display: optional`; data in a system monospace stack with `tabular-nums`. Unbounded is used only for the wordmark and ≥ 20 px display moments. **Never** request fonts, icons or scripts from another origin (offline, CON-005, same-origin) — this is the only place that rule is stated; §6 and the checklist refer here.

## 6. Iconography

1. **One icon set**, shipped as inline SVG / sprite bundled with the app (tree-shaken per icon); **never** icon fonts — a project rule (one set, same-origin per §5.3, text alternatives per §10), not a platform fact.
2. Every icon-only control has `aria-label` whose text contains any visible tooltip (Level A 1.1.1, 2.5.3); decorative SVG is `aria-hidden="true"`.
3. **Prefer** icon + text on states and destructive actions; an icon alone carries meaning only when its label is one tap away.

## 7. Motion

1. Three duration bands — short (state changes), medium (sheets, list add/remove), long (full-screen) — and three easings (standard, entering, exiting). Seed values until `tokens.css` exists: 50–200 / 250–400 / 450–600 ms; `cubic-bezier(0.2, 0, 0, 1)`, `(0.05, 0.7, 0.1, 1)`, `(0.3, 0, 0.8, 0.15)`. Once `tokens.css` lands it is the only source of the numbers and this line names the bands.
2. **Default to stillness:** motion explains a state change, preserves continuity or confirms an action — plus **one** signature completion moment (plan step 2.8). **Never** parallax or looping ornament.
3. Honour `prefers-reduced-motion: reduce` (owner's rule): transforms become fades or shorter durations — *reduce*, don't remove feedback — and JS mirrors it with `matchMedia` + `change`. Haptics (`navigator.vibrate`, 10–20 ms tick) only after a user tap, behind a setting, never for push/timer feedback.

## 8. States — designed once, reused everywhere

| State | Rule |
|---|---|
| Pending request | The control that fired a request shows a busy state and ignores repeat taps. Indicators appear only after a 300–500 ms delay (no flash on fast responses). **Prefer** optimistic complete / reopen with rollback + inline error; create, edit and delete wait for the server. No determinate progress bars — nothing here reports progress. |
| Loading a screen | A skeleton mirroring the final layout for whole-screen loads; a spinner only inside a card or sheet; after ~10 s the skeleton adds one line ("Ainda carregando…"). The "Loading…" first paint becomes an inline shell skeleton painted by critical CSS. |
| Empty | Title says what will be here or what to do (positive), one line of body, one CTA that focuses capture; filtered-empty offers "Limpar filtros". **Never** a blank region. |
| Field error | Inline, next to the field, after the field is left (not while typing); "[o que aconteceu]. [o que fazer]."; no blame, no "Ops!", no humour; never colour alone. |
| Request error | Inline next to the action that failed (under the capture field, under *Salvar*); the input keeps its text (the FR-045 invariant) and the action stays enabled for retry; same two-sentence shape; a rejected token routes to the token gate with the reason; **never** a bare status code. |
| Offline / server unreachable | Mandatory on every screen (ADR-0004): a text + icon banner, reads still shown from cache, network actions disabled — **never** the browser's offline page, **never** a promise to "send later" (ADR-0003: no offline writes). |
| Toast | Bottom, above the capture/bottom bar, one at a time, dark surface token, text + icon; 4 s without an action; with an action (*Desfazer*, *Atualizar*) it persists until used, dismissed or the next navigation (Level A 2.2.1). |
| Update available | A toast per §2.8. |
| Notification permission | Two-step: an in-app explainer at a moment of obvious value (the first Reminder), the real prompt from a tap, a settings toggle to disable, a clear "bloqueadas" state with the way back; observe `permissions.query({name:'notifications'})` `change` — Chrome 155 prompts are non-blocking and time out (Jul 2026); Chrome auto-revokes low-engagement sites (installed apps exempt, Oct 2025). |
| Notification content | Title = the Task/Reminder title (≤ 30 characters shown), body = when and what is due; icon = the mark, monochrome 72 px badge; ≤ 2 actions in the infinitive; `tag` per Task so a re-send replaces instead of stacking; tapping opens that Task; one notification per Reminder firing. |
| Destructive — reversible (complete, reopen, remove from a set) | No confirmation: act immediately and show a toast with *Desfazer*. |
| Destructive — irreversible (permanent delete, clear all) | One confirmation that repeats the verb — "Excluir esta tarefa?" · *Cancelar* / *Excluir* — destructive button second, default focus on *Cancelar*; **never** *Sim/Não*. |
| Dirty editor closed (back, Esc, tap outside) | **Prefer** keeping the draft in memory for the session and restoring it on reopen, with no "discard?" prompt; nothing is saved without *Salvar*. Decided for good in the layout standard (A3). |

## 9. Copy and voice (pt-BR — ADR-0009)

The *voice* (who Praesto sounds like) is TBD — pending owner input (the one-page voice & tone of plan step 2.8, written for his approval under ADR-0010's "nerd inside, light outside"). The *mechanics* below apply now:

1. **Buttons in the infinitive** ("Salvar", "Excluir", "Concluir"), verb first, ≤ 2 words, no articles; instructions in the imperative ("Tente novamente"). Canonical verbs: Salvar · Excluir · Remover (from a set) · Limpar · Concluir · Reabrir · Cancelar · Desfazer · Editar · Adicionar / Criar · Pesquisar · Mostrar / Ocultar · Continuar / Voltar · Próximo / Anterior. **Avoid** anglicisms where a Portuguese word exists; established loans ("e-mail", "site", "login", "download", "offline") stay.
2. **Sentence case everywhere** — titles, buttons, labels, messages (chosen 2026-08-19; gov.br prescribes Title Case on buttons — the owner may flip this line). **No all-caps UI text**, including CSS `text-transform`; acronyms keep their caps and diacritics ("sáb.", "Configurações"). *House rule — owner-confirmed 2026-08-20 (plan Q14).*
3. **Address the owner as "você"** or with an implied subject; never "tu", never "o usuário"; present indicative, active voice; short fragments are fine ("Pronto", "Tarefa salva").
4. **Numbers, dates, times** come from `Intl` with `pt-BR`: `19/08/2026`, `qua., 19 de ago.`, `14:05` (24 h), `1.234,50`, NBSP between number and unit. Prose may say "ontem / hoje / amanhã" (`RelativeTimeFormat`, `numeric: 'auto'`). CLDR puts **zero in the singular** (`PluralRules('pt-BR').select(0) === 'one'`) — **always** special-case zero ("Nenhuma tarefa").
5. **Success** is a past participle without "!" ("Tarefa concluída"); "!" only for genuine milestones. Quotes are curved “ ”; UI element names inside sentences are written as they appear on screen; never "clique aqui".
6. **Honest mirror in words:** a miss is named plainly ("Você não concluiu *Pagar aluguel* em 2 de 5 semanas"), never softened, never blamed.
7. **Term table** (glossary names → UI words; lowercase in running text, sentence case at the start of a label): Task → tarefa · Reminder → lembrete · Event → evento · Life Area → área da vida · deadline → prazo ("Concluir até") · scheduled date → data marcada ("Fazer em") · priority → prioridade (alta / normal / baixa) · open → aberta · done → concluída · missed → não concluída · overdue → atrasada · today → hoje · offline → sem conexão. New concepts enter the [glossary](../10-product/glossary.md) first, this table second.

## 10. Accessibility — WCAG 2.2 Level A as the formal bar

Conformance is per screen and all 31 Level A criteria must hold (N/A ones vacuously). **Tier A covers what changes per edit; the full Level A pass runs once per screen in A5 and whenever a screen is added, recorded under `PRPs/reports/`.** The criteria that bite here, as rules:

- **1.1.1** text alternative on every icon-only control and image (§6.2).
- **1.3.1** real semantics — `<button>`, `<label for>`, headings, lists, `fieldset/legend` for radio groups; state in `aria-*`, not styling. **2.4.1** landmarks (`<header>`, `<main>`, `<nav>`) and one real `<h1>` per screen.
- **1.3.2** DOM order = reading order. **1.3.3** never instruct by shape, position or colour alone. **1.4.1** colour never the only cue (§4.4).
- **2.1.1 / 2.1.2** everything works with Tab / Enter / Space / Esc — no hover-only or drag-only actions; focus always leaves a dialog and returns to the opener. **2.1.4** single-key shortcuts have an off switch or require focus in a field.
- **2.2.1 / 2.2.2** no time limits; toasts with actions persist (§8); nothing moves for > 5 s without a pause.
- **2.4.2** a meaningful `<title>` per screen. **2.4.3** focus order follows the layout. **2.4.4** link text says where it goes.
- **2.5.1 / 2.5.2** multipoint or path gestures (swipe) only as shortcuts to visible controls; activation on pointer-up, cancellable. **2.5.3** the visible label is in the accessible name.
- **3.1.1** `lang="pt-BR"`. **3.2.1 / 3.2.2** focusing or changing a field never navigates or submits — explicit *Salvar*. **3.2.6** help, if it appears on ≥ 2 screens, sits in the same place.
- **3.3.1 / 3.3.2** errors identified in text next to the field; every input has a visible label (a placeholder is not a label). **3.3.7** never re-ask for data already entered in the same flow.
- **4.1.2** custom controls expose name, role, value and state — **prefer** native elements.
- N/A by design — confirm on each new feature: media criteria (1.2.x, 1.4.2), 2.3.1 (no flashing), 2.5.4 (no motion actuation).

**Recommended, not rules** (AA/AAA; the owner chose A): contrast 4.5:1 / 3:1 (1.4.3, 1.4.11 — measured per §4.3), resize text 200 % (1.4.4 — §5.1 Prefer), reflow at 320 px (1.4.10), focus not obscured (2.4.11 — §2.7 Prefer), dragging alternatives (2.5.7 — covered by §10 2.1.1), target size 24 px (2.5.8 — exceeded by §3.3), status messages (4.1.3). Kept as **house rules above the bar**: focus visible (§4.5), no all-caps (§9.2) — both owner-confirmed 2026-08-20 (plan Q14).

## 11. Performance budget

Self-imposed, at or under the web's 10th percentile; React 19.2 + ReactDOM alone is ~60 KB gzip, the floor every number absorbs. A UI library is chosen (plan A4) *inside* these numbers; the measured marginal costs of the candidates live in the [plan's scouting](../50-planning/ui-ux-plan.md#preliminary-scouting-2026-08-18).

| Measure | Budget | How it is checked |
|---|---|---|
| First-load JavaScript | ≤ 170 KB gzip | `vite build` size report (Rolldown prints gzip; the 500 KB/chunk warning stays on) — read at every A5 / unit UI phase; `size-limit` (exact-pinned) may be added in A5 if a gate is wanted |
| First-load CSS | ≤ 30 KB gzip | same |
| Fonts | one WOFF2, ≤ 100 KB | build output + precache manifest |
| Precache total (what the phone downloads per SW version) | ≤ 1 MB | `dist/` precache manifest |
| LCP · INP · CLS on the owner's phone | ≤ 2.5 s · ≤ 200 ms · ≤ 0.1 | Lighthouse against the real device (`chrome://inspect`, or `lighthouse --port=9222 --throttling-method=provided`), recorded under `PRPs/reports/` |
| Lighthouse performance on the built shell | ≥ 90 | same; Lighthouse 12+ has no `budget.json` — LHCI assertions or `size-limit` if ever automated |

## 12. Components and code

1. **Use the owned component library first** — shadcn-style components over Base UI + Tailwind v4 ([ADR-0011](../60-decisions/ADR-0011-ui-library-shadcn-style-base-ui-tailwind.md)) under `src/app/components/ui/`, one per file, `PascalCase`, `cva` variants, `cn()` composition; a new primitive is copied from the shadcn registry or written in its style and adapted to the tokens before commit; a bespoke component needs a one-line reason in the PR.
2. **Tokens only** per §3.5; inline `style` objects are retired in A5 and **never** reintroduced.
3. **Strings:** pt-BR literals written in the component — **no i18n library, no key indirection**; only strings that business logic produces or tests assert on (request-failure messages, date phrases, plural forms) live in `src/shared/*` and are tested in Portuguese (ADR-0009).
4. **Lists of Tasks:** rows ≥ 48 px, the whole row opens the detail, the complete control is a real checkbox/button with its own 48 px target; titles wrap to 2 lines then ellipsis; swipe actions only as shortcuts to visible controls; a completed row animates out within the §7 scale and can be undone (§8); `content-visibility: auto` + `contain-intrinsic-size` first, windowing only for the "all Tasks" view; lists refetch on `visibilitychange` → visible and on reconnect (the roadmap's "refresh on foreground" idea) — there is no manual refresh gesture; SPA navigation restores scroll itself (`history.scrollRestoration = 'manual'`).
5. **Native inputs:** use `<input type="date">` / `time` for date entry (system picker, dark via `color-scheme`) — no custom calendar until a unit asks for one; the capture field is `<input type="text">` with `enterkeyhint="done"`; **`autofocus` on exactly one element — the capture input on the home screen, only when the app opens there** — never on detail, settings or the token gate after first use.
6. **Verification stays manual** ([testing strategy](testing-strategy.md)): the browser pane at 375 px wide, dark mode, on every change (Tier A); the Android phone once per deployed screen change (Tier B), screenshots filed under `PRPs/reports/<activity>/`. When the pane cannot display, say so and measure the DOM — **never** claim a screenshot you did not take.

## Review checklist

Single-assertion items; ✔/✘ with one line per ✘. One ✘ without a recorded, conscious exception = not done.

**Tier A — every interface change, browser pane only, 60–90 s**

1. One primary action on the screen; nothing added "just in case".
2. Every tappable control ≥ 48 × 48 CSS px and ≥ 8 px from its neighbours (DevTools box model).
3. No meaning carried by colour alone.
4. Copy is pt-BR, sentence case, infinitive buttons, "você", `Intl` dates/numbers, zero special-cased.
5. Tab / Enter / Esc work, focus is visible, focus returns to the opener on close.
6. Icon-only controls have `aria-label`; inputs have visible labels; `lang` and `<title>` are right.
7. Tokens only (or the pre-token inline scale, §3.5); durations from the bands; reduced motion honoured.
8. Destructive actions follow §8 (reversible → *Desfazer* toast; irreversible → one confirmation that repeats the verb).
9. No request to another origin (DevTools Network).

**Tier B — once per shipped screen (and on every token change), before it is declared deployed**

10. Contrast measured for the five pairs of §4.3 and recorded.
11. The states of §8 that the screen can reach were simulated (DevTools Network → Offline, throttled, empty fixture, failed request) and read right.
12. Checked at 375 px and at 1280 px / the column cap; safe areas, keyboard overlap and `overscroll-behavior` checked on the phone; back gesture closes sheets.
13. `vite build` size report read against §11; Lighthouse on the phone recorded when the screen is new.
14. Screenshots filed under `PRPs/reports/<activity>/` — or the reason none exists written down.

## Sources

Verified 2026-08-18/19; the full fact-checked record (claims, verdicts, corrections, URLs) is filed at [`PRPs/reports/ui-ux-guidelines/research-evidence-2026-08-19.md`](../../PRPs/reports/ui-ux-guidelines/research-evidence-2026-08-19.md); the first checklist run with real findings at [`PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md`](../../PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md). Primary sources: web.dev (app design, manifest, color-scheme, offline, push permission UX, fonts, content-visibility, maskable icons, View Transitions), developer.chrome.com (edge-to-edge, viewport resize Chrome 108, overscroll, Auto Dark Theme, Chrome 126/155 notes, Lighthouse 12/13), MDN (`env()`, CloseWatcher, `enterkeyhint`, `autofocus`, `:focus-visible`, `vibrate`, `scrollRestoration`), Android developer docs (navigation bar, window size classes, notifications, Android 13 permission), W3C WCAG 2.2 (TR 2024-12-12, quickref, Understanding; pt-BR authorized translation 2025-03-27), NN/g (skeletons, empty states, form errors, accelerators, heuristics), Smashing (display modes 2025, fluid type 2023), Baymard, material-web motion tokens, Microsoft Portuguese (Brazil) Style Guide (©2024), gov.br Design System (Princípios de UX Writing, Microcopy, Empty States), ABNT NBR 5892:2019, CLDR 48 / ICU 78, HTTP Archive Web Almanac 2025, Alex Russell "Performance Inequality Gap 2026", Vite 8 / Rolldown docs, Lighthouse CI, size-limit, web-vitals 6.1, GOV.UK Design System, Vercel Web Interface Guidelines, EightShapes guideline conventions, Gawande's checklist principles.

## History

Kept in the [UI/UX plan](../50-planning/ui-ux-plan.md) while the plan is open; rows land here after it closes.

| Date | What changed |
|---|---|
| 2026-08-19 | Written (plan A1); reviewed adversarially (facts + usability) and revised; first checklist run recorded |
