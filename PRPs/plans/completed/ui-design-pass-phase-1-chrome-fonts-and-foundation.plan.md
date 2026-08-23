# Feature: Chrome, fonts and foundation (Phase 1 of ui-design-pass)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: cross-cutting artifact (a plan the Implementer consumes); the first phase that wires the token pipeline into the running app; creates reusable pure modules in src/shared (formatters, connectivity reducer) that Phase 2, Phase 3 and unit 3 consume; touches the PWA chrome every screen shares (index.html, manifest, icons, favicon, fonts); translates tested owner-facing messages (ADR-0009)
- Decisions found:
  - ADR-0009 — visible UI copy in pt-BR; code, identifiers, tests and keys stay English; tests that pin owner-facing messages pin the Portuguese wording from A5 on
  - ADR-0010 — tokens.css is machine truth; index.html critical CSS, the manifest and scripts/generate-icons.js must move to `#161012` together; Inter + Unbounded in two files ≤ 100 KB (measured 2026-08-21: 48,256 + 21,828 = 70,084 bytes)
  - ADR-0011 — Tailwind v4 reads tokens.css through `@theme inline reference` in src/app/styles.css; owned components under src/app/components/ui/; `shadcn init` never run
  - ADR-0005 — exact pins, minimal tooling, no incidental dependency: the font fetcher and the icon generator are zero-dependency Node scripts; no package is added
  - ADR-0008 + docs/context/methodology.md — tdd: true; the decidable half (PRD AC-4, AC-5, AC-6, AC-7) is authored test-first by the test pair; the Implementer never creates or edits a test file (R-X)
  - Owner, 2026-08-21 (PRD scope round) — downloading the two Google Fonts latin subsets is authorized; the new microcopy rows are approved and enter the identity doc before code
  - PRD Decisions Log — `/design` gated by `import.meta.env.DEV` + a dynamic import; fonts from the Google Fonts CSS2 API committed under public/fonts/ with their OFL licences; no toast library, no router
- Applicable anti-patterns:
  - Weakening tests to force green — test/request-failure.test.ts and test/token-store.test.ts are updated to the Portuguese intent by the test pair, never loosened; the Implementer runs them, never edits them
  - Portuguese in artifacts (carve-out) — only the string values the owner reads are pt-BR; identifiers, comments and keys stay English
  - Version ranges — no new package; fonts are static files under public/fonts/
  - Offline write queue — the connectivity reducer gates writes; it queues nothing
  - Hand-duplicated entity types — taskMetaLine takes the TaskDto from src/shared/api.ts; no parallel Task shape
- Applicable architectural rules:
  - src/shared is DOM-free and dependency-free and compiles into every target (tsconfig.test.json includes src/shared but not src/app) — format.ts and connectivity.ts must hold that line
  - tokens.css is the only style scale; index.html, public/manifest.webmanifest, scripts/generate-icons.js and the SVGs under public/ are the exempt-by-design literal carriers (guidelines §2.4, §3.5)
  - One Worker serves assets + API; the service worker stays hand-owned (injectManifest) and precaches by glob
  - UI verification stays manual (testing strategy): the browser-pane Tier A check of this phase is the main session's job after implementation, recorded under PRPs/reports/ui-design-pass/phase-1/
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/ui-design-pass.prd.md` — Implementation Phases row 1:
  "Chrome, fonts and foundation" — Goal: the app boots as one dark surface
  with its own fonts, the token pipeline is live, every decidable string and
  formatter exists and is tested, and the playground shows what the next
  phases will use — Success signal: `npm test` green with the new and updated
  suites, `npm run check` green, `vite build` within §11 with the fonts in the
  precache manifest, `/design` rendering every token and state in the pane at
  375 px, and the shell painting `#161012` before JavaScript.

## Summary

This phase lays the floor the two screen phases stand on, without redrawing a
screen. It moves the PWA chrome to the identity's background (`index.html`
critical CSS, `color-scheme`, the `resizes-content` viewport, a pre-JavaScript
shell skeleton, the manifest's colours and pt-BR text, the five regenerated
PNG icons and the favicon), self-hosts Inter and Unbounded as two latin-subset
WOFF2 files fetched once by a zero-dependency script and declared inline with
`font-display: optional`, imports `src/app/styles.css` so Tailwind and the
tokens are live, and mounts a dev-only `/design` playground that renders every
token and the existing primitives. Alongside it ships the decidable half of the
design pass as pure `src/shared` modules — the Portuguese request and token
messages, `formatRemaining` / `formatHeaderDate` / `taskMetaLine`, and the
`reduceConnectivity` state machine — authored test-first by the test pair and
consumed by Phase 2 and Phase 3. The existing screens keep their inline styles
until Phase 2 and Phase 3 rebuild them; this phase only makes the canvas dark
and the foundation real.

## User Story

```
As the owner
I want the app to open as one dark surface with its own fonts, its own
Portuguese messages and a live token pipeline
So that the screens the next phases rebuild are styled from tokens, read in my
language, and never flash a white canvas or a foreign font again
```

## Problem Statement

The identity exists only as unapplied files: `src/app/tokens.css` and
`src/app/styles.css` are imported nowhere, so Tailwind emits nothing and every
screen still renders from the inline `styles` object on a white canvas under a
`#0b0b0c` splash. `index.html`, `public/manifest.webmanifest`,
`scripts/generate-icons.js` and `public/favicon.svg` all still carry `#0b0b0c`
while `--color-bg` is `#161012`; there is no `color-scheme` declaration, no
`interactive-widget` viewport choice, no self-hosted font and no playground to
look at a token. The two owner-facing messages that tests pin
(`src/shared/request-failure.ts`, `src/shared/token-store.ts`) are English, and
the header count, the row date phrases and the offline state have no decidable
module behind them — so Phase 2 and Phase 3 would have to invent them inside
components, where this project cannot test them.

## Solution Statement

Do the foundation once, in the order the project's rules require: the
microcopy rows enter `documentation/10-product/visual-identity.md` first; the
pure modules (`src/shared/format.ts`, `src/shared/connectivity.ts`, the
Portuguese messages) are written against the contracts the PRD's AC-4–AC-7
fix, with `today` and `now` as arguments so the tests are deterministic; a
committed `scripts/fetch-fonts.mjs` (zero dependencies, like
`scripts/generate-icons.js`) downloads the two latin-subset WOFF2 files and
their OFL texts into `public/fonts/`, which the existing `woff2` precache glob
already picks up; `index.html` gains the critical CSS, the `color-scheme` meta,
the standard's viewport string, the inline `@font-face` declarations and a
static shell skeleton that `createRoot` replaces on first render; the manifest,
the icon script, the regenerated PNGs and the favicon move to `#161012`
together; `src/app/main.tsx` imports `styles.css` and branches to a
dynamically imported `DesignPlayground` only when `import.meta.env.DEV` holds
and the path is `/design`, so the production bundle never carries it. Every
VALIDATE below exercises the effect — parsed JSON, decoded icon pixels, font
magic bytes and sizes, the built bundle's gzip weight and precache manifest —
rather than the presence of an edit.

## Metadata

| Key | Value |
|---|---|
| Type | PWA chrome + static assets + pure shared modules (test-first) |
| Complexity | Medium — many small files, one real integration (fonts + precache + build budget), no API change |
| Systems Affected | `index.html`, `public/` (manifest, favicon, icons, fonts), `scripts/`, `vite.config.ts`, `src/app/main.tsx`, `src/app/components/DesignPlayground.tsx`, `src/shared/` (three modules), `documentation/10-product/visual-identity.md` |
| Dependencies | None (row 1 of the PRD); the tokens, the Tailwind pipeline and the owned primitives are already on `main` (ADR-0011) |
| Estimated Tasks | 10 |
| Source PRD line ref | `PRPs/prds/ui-design-pass.prd.md:413` (Implementation Phases row 1); Phase Details at `:452-455`; the automated contracts at `:177-180` (AC-4 to AC-7) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/ui-design-pass.prd.md` | 165-196, 225-271, 316-395, 452-455 | The AC text verbatim (AC-4 to AC-7 are the contracts the test pair authors against), the MoSCoW table and the new microcopy rows, the Architecture Notes on fonts, chrome, icons and `/design`, and this phase's own scope |
| P0 | `src/app/tokens.css` | 1-24 | The machine truth: `--color-bg: #161012` and the header that names the exempt literal carriers this phase must move together |
| P0 | `index.html` | 1-18 | The 18-line shell this phase extends — no critical CSS, no `color-scheme`, `theme-color #0b0b0c`, the old viewport string |
| P0 | `public/manifest.webmanifest` | 1-33 | Colours still `#0b0b0c`; `name`/`short_name`/`lang` already right; the English `shortcuts` entry to translate |
| P0 | `scripts/generate-icons.js` | 1-27, 141-200, 202-220 | The zero-dependency rasterizer: the `BACKGROUND` constant to change, the PNG encoder (filter byte 0, RGBA8, no interlace — what the pixel probe decodes), the five-icon `ICONS` list |
| P0 | `src/shared/request-failure.ts` | 1-54 | The dual-target module header convention and the two English messages this phase translates |
| P0 | `src/shared/token-store.ts` | 51-61 | The `TOKEN_NOT_STORED` constant pinned by a test regex — the third message to translate |
| P0 | `src/shared/dates.ts` | 16-37 | `PRAESTO_TIMEZONE` and `todayIn` — the helpers `format.ts` builds on, and the "no imports, dual-compiled" idiom it must keep |
| P1 | `src/app/main.tsx` | 1-48 | Where the `styles.css` import goes, the pathname-detection block the `/design` gate mirrors, and the `setupPwa` block that stays untouched until Phase 2 |
| P1 | `src/app/styles.css` | 1-68 | The `@theme inline reference` names (`bg-surface-2`, `rounded-card`, `shadow-control`, `font-display`, `text-t1`…`text-t5`) the playground enumerates, and the `@layer base` html/body/focus rules that go live on import |
| P1 | `vite.config.ts` | 19-35 | `includeAssets` (no fonts yet) and the `globPatterns` that already list `woff2` |
| P1 | `src/app/components/ui/Button.tsx` | 1-30 | The `cva` variants (`primary`, `secondary`, `ghost`, `icon`) the playground renders at rest, pressed and disabled |
| P1 | `src/app/components/ui/CompleteControl.tsx` | 1-32 | The checkbox control the playground shows unchecked and checked |
| P1 | `src/app/components/ui/Chip.tsx` | 1-46 | `ChipGroup` / `Chip` the playground renders |
| P1 | `src/app/components/ui/Sheet.tsx` | 1-47 | Still on Base UI Dialog in this phase (Phase 3 swaps it); the playground opens it as is |
| P1 | `documentation/10-product/visual-identity.md` | 68-101 | The approved microcopy table the new rows join, and the History table that records the addition |
| P2 | `documentation/40-engineering/ui-ux-guidelines.md` | 34-36, 60 | §2.4 (theme before CSS, manifest colours = background token), §2.5 (`overscroll-behavior`), §2.6 (`dvh`, `resizes-content`), §5.3 (two WOFF2 ≤ 100 KB, inline `@font-face`, `font-display: optional`, precache) |
| P2 | `test/request-failure.test.ts` | 1-60 | What the existing suite asserts about the messages (structure, not wording) — read so the new wording keeps the status code inside the sentence; the test pair, not the Implementer, updates this file |
| P2 | `test/token-store.test.ts` | 443-452 | The regex the test pair will re-pin to the Portuguese wording; the Implementer only makes the new wording exist |

## Patterns to Mirror

```ts
# SOURCE: src/shared/dates.ts:22-37
export const PRAESTO_TIMEZONE = "America/Sao_Paulo";

/**
 * The local calendar day at `now` in `timeZone`, as `YYYY-MM-DD`.
 *
 * `en-CA` is the locale whose short date format is already ISO-ordered, so the
 * formatter returns the wanted shape directly and no string surgery is needed.
 */
export function todayIn(now: Date, timeZone: string = PRAESTO_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
```

The house shape for a pure, dual-compiled `src/shared` module: no imports
beyond siblings, a named constant for the one timezone, `Intl` doing the work,
`now` passed in rather than read from `Date.now()`. `format.ts` imports
`PRAESTO_TIMEZONE` and `todayIn` from here and follows the same discipline.
Copied by Task 2.

```ts
# SOURCE: src/shared/request-failure.ts:35-54
export function classifyRequestFailure(cause: unknown): RequestFailure {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    typeof (cause as { status: unknown }).status === "number"
  ) {
    const status = (cause as { status: number }).status;
    return {
      kind: "http-error",
      message: `The server rejected the request (status ${status}).`,
    };
  }

  return {
    kind: "server-unreachable",
    message:
      "Praesto could not reach the server. Nothing was lost — try saving again once you're back online.",
  };
}
```

The classifier whose two messages become Portuguese; the `kind` values, the
duck-typed `status` check and the status number inside the sentence all stay
exactly as they are — only the two string values change. Edited by Task 4;
its `kind` union is what `connectivity.ts` consumes in Task 3.

```ts
# SOURCE: src/shared/token-store.ts:51-61
/**
 * Thrown by `save()` when the token reached NEITHER store. This is the one
 * failure the owner has to be told about: a Save that persisted nothing and
 * said nothing is the silent absorption FR-045 and vision principle 6 (honest
 * mirror) exist to rule out. The message lives here, in the tested module,
 * rather than in the untested UI, so its wording is pinned by a test.
 */
const TOKEN_NOT_STORED =
  "Praesto could not store the API token on this device. Both IndexedDB and " +
  "local storage refused — check whether this browser is blocking site data " +
  "for this site.";
```

The owner-facing message kept in the tested module so a test can pin it; the
Portuguese replacement keeps the constant name and the comment, and is written
as one literal on one line so a byte-exact grep can find it. Edited by Task 4.

```js
# SOURCE: scripts/generate-icons.js:21-27
// --- Palette --------------------------------------------------------------
// Background matches theme_color/background_color in public/manifest.webmanifest.
const BACKGROUND = [0x0b, 0x0b, 0x0c];
const CORD = [0x9a, 0xa1, 0xab];
const BOB_TOP = [0xf2, 0xd0, 0x8a];
const BOB_TIP = [0xb5, 0x7f, 0x23];
const WHITE = [0xff, 0xff, 0xff];
```

The single constant that drives the background of all five PNGs — the only
line of the rasterizer this phase changes (the brass gradient `BOB_TOP` →
`BOB_TIP` and the white badge stay). The script's zero-dependency, `node
scripts/<name>.js` shape is also the model for `scripts/fetch-fonts.mjs`.
Edited by Task 8; mirrored by Task 5.

```html
# SOURCE: index.html:3-13
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Praesto Sum</title>
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <!-- iOS picks the home-screen icon from this link, NOT from the manifest.
         Without it "Add to Home Screen" falls back to a screenshot of the page. -->
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
    <meta name="theme-color" content="#0b0b0c" />
  </head>
```

The head this phase extends in place: the viewport string grows the
`interactive-widget` parameter, `theme-color` moves to `#161012`, and the
`color-scheme` meta, the font preloads, the inline `@font-face` and the
critical CSS are added beside the existing tags. Edited by Task 6.

```ts
# SOURCE: src/app/main.tsx:16-26
let initialShare: ShareTarget | null = null;
if (window.location.pathname === "/share-target") {
  initialShare = parseShareTarget(window.location.search);
  window.history.replaceState(null, "", "/");
} else if (window.location.pathname === "/new-task") {
  // Launcher shortcut (public/manifest.webmanifest's `shortcuts` entry)
  // carries no payload, only intent, so there is nothing to parse —
  // `initialShare` stays `null`, which is what seeds TaskBoard's `title`
  // to "". Strip the path the same way `/share-target` does above.
  window.history.replaceState(null, "", "/");
}
```

The entry point already branches on `window.location.pathname` before the
first render; the `/design` gate is one more branch of the same shape, taken
only under `import.meta.env.DEV`, that mounts the playground instead of `App`
and returns before the service worker and the token read. Mirrored by Task 9.

```css
# SOURCE: src/app/styles.css:49-68
@layer base {
  html {
    color-scheme: dark;
    overscroll-behavior-y: contain;
  }
  body {
    margin: 0;
    background: var(--color-bg);
    color: var(--color-ink);
    font-family: var(--font-text);
    font-size: var(--text-3);
    line-height: var(--leading);
    overscroll-behavior-y: contain;
  }
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--color-bg);
  }
}
```

The base rules that go live the moment `styles.css` is imported — the dark
canvas, the font stack naming `Inter`, the focus ring. The `index.html`
critical CSS repeats only `background: #161012` and `color-scheme: dark` on
`html`, as a literal, so the canvas is painted before this stylesheet arrives
(guidelines §2.4). Imported by Task 9; echoed by Task 6.

```ts
# SOURCE: vite.config.ts:30-35
      manifest: false,
      includeAssets: ["favicon.svg", "manifest.webmanifest", "icons/*.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3145728,
      },
```

The precache configuration: `woff2` is already in the glob, so the two fonts
under `public/fonts/` land in the manifest once they exist in `dist/`;
`includeAssets` gains `fonts/*.woff2` so the intent is explicit beside the
icons. Edited by Task 9.

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

The owned-component idiom (ADR-0011): `cva` variants over Tailwind utilities
that resolve to tokens (`rounded-control`, `shadow-control`, `text-t2`). The
playground is written in the same vocabulary — token classes, `cn()` — and
renders these four variants. Mirrored by Task 9.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `documentation/10-product/visual-identity.md` | UPDATE | The new microcopy rows approved in the PRD scope round enter the approved table before they enter code; History row; `last_updated` |
| `src/shared/format.ts` | CREATE | `formatRemaining`, `formatHeaderDate`, `formatDayShort`, `taskMetaLine` — the decidable header and row copy (PRD AC-5, AC-6), deterministic because `now` / `today` are arguments |
| `src/shared/connectivity.ts` | CREATE | `reduceConnectivity` + `canWrite` — the pure online / offline / unreachable state machine (PRD AC-7) the Phase 2 hook feeds |
| `src/shared/request-failure.ts` | UPDATE | The two owner-facing messages become Portuguese (PRD AC-4); kinds and structure untouched |
| `src/shared/token-store.ts` | UPDATE | `TOKEN_NOT_STORED` becomes Portuguese (PRD AC-4); behaviour untouched |
| `scripts/fetch-fonts.mjs` | CREATE | Zero-dependency, reproducible download of the two latin-subset WOFF2 files and their OFL texts from the Google Fonts CSS2 API (owner-authorized 2026-08-21) |
| `public/fonts/inter-latin-var.woff2` | CREATE | Inter variable 400–700, latin subset, 48,256 bytes — the body face (ADR-0010) |
| `public/fonts/unbounded-latin-800.woff2` | CREATE | Unbounded 800, latin subset, 21,828 bytes — the wordmark and display face (ADR-0010) |
| `public/fonts/OFL-Inter.txt` | CREATE | SIL Open Font License 1.1 text for Inter, shipped beside the file (PRD Architecture Notes) |
| `public/fonts/OFL-Unbounded.txt` | CREATE | SIL Open Font License 1.1 text for Unbounded, shipped beside the file |
| `index.html` | UPDATE | `color-scheme` meta, the standard's viewport string, `theme-color #161012`, critical CSS, inline `@font-face` + preloads, the pre-JavaScript shell skeleton |
| `public/manifest.webmanifest` | UPDATE | `theme_color` / `background_color` → `#161012`; the `shortcuts` entry in pt-BR |
| `public/favicon.svg` | UPDATE | Background rect → `#161012` (same geometry as `public/brand/mark-brass.svg`) |
| `scripts/generate-icons.js` | UPDATE | `BACKGROUND` → `#161012` and its comment |
| `public/icons/icon-192.png` | UPDATE | Regenerated on the new background |
| `public/icons/icon-512.png` | UPDATE | Regenerated on the new background |
| `public/icons/maskable-512.png` | UPDATE | Regenerated on the new background, 80 % safe zone kept |
| `public/icons/apple-touch-icon-180.png` | UPDATE | Regenerated on the new background |
| `public/icons/badge-72.png` | UPDATE | Regenerated (unchanged white silhouette on transparency — re-emitted so the set is one run) |
| `vite.config.ts` | UPDATE | `includeAssets` gains `fonts/*.woff2` |
| `src/app/main.tsx` | UPDATE | Imports `./styles.css`; dev-only `/design` branch with a dynamic import |
| `src/app/components/DesignPlayground.tsx` | CREATE | The dev-only page rendering every token and the existing primitives' states |
| `PRPs/reports/ui-design-pass/phase-1/build-report.md` | CREATE | The phase record: the `vite build` size table, the §11 budget probe output, and (added by the main session) the browser-pane Tier A result for `/design` |

## NOT Building (Scope Limits)

- **No screen is rebuilt here.** The token gate, the *Hoje* screen and the
  detail keep their inline `styles` object until Phase 2 and Phase 3; this
  phase only imports `styles.css` (so the canvas is dark and Tailwind's base
  rules apply) and leaves `App.tsx` untouched. The transitional look of the
  old screens on the new canvas is accepted and is not verified against the
  checklist — the playground is what this phase's Tier A check looks at.
- **No toast, banner, skeleton component, sheet swap or `window.confirm`
  replacement** — Phase 2 and Phase 3. The static skeleton in `index.html` is
  markup `createRoot` replaces, not a component.
- **No `visibilitychange` / `online` hook, no `useConnectivity`** — Phase 2
  wires the reducer; this phase ships only the pure module.
- **No groups, chip row, filters, header icons, two-pane desktop, light
  theme, gamification, haptics, toast library, router, i18n layer** — the
  PRD's "What We're NOT Building".
- **No static "no colour literal" test in the `docs` Vitest project** — the
  PRD's fourth Open Question is answered here as *not now*: it would need a
  row in `documentation/40-engineering/testing-strategy.md` first, and the
  AC-2 grep lives in this plan's Level 3 block and in Phase 2 / Phase 3
  instead.
- **No authoring or editing of test files.** Under `tdd: true` the suite for
  the three `src/shared` modules and the two updated message assertions is
  produced by the `test-writer` / `test-reviewer` pair before the Implementer
  runs; R-X forbids the Implementer from touching `test/`. Task 10 only *runs*
  the suites.
- **No deploy, no device run.** Phase 4 deploys and verifies on the phone;
  this phase's manual check is the browser pane at 375 px.

## Step-by-Step Tasks

### Task 1: UPDATE `documentation/10-product/visual-identity.md`

- **ACTION**: In the approved microcopy table under "Voice and tone" (the
  table whose header is `| State | Copy |`), add one row per entry of the
  PRD's "Microcopy added by this pass" table, in the same `| State | Copy |`
  shape, keeping every existing row untouched: token gate (`Cole o token da
  API deste dispositivo.` · label *Token da API* · button *Salvar*); token
  store failure (`Não foi possível guardar o token neste dispositivo. O
  navegador recusou IndexedDB e o armazenamento local — verifique se ele está
  bloqueando dados do site.`); header (*Hoje* · `sex., 21/08` · *N restantes*
  / *1 restante* / *nenhuma restante*); capture deck (eyebrow *Nova tarefa* ·
  placeholder *O que precisa ser feito?* · submit *Adicionar* · offline hint
  `Captura indisponível sem conexão.`); row meta line (*até hoje* · *até
  amanhã* · *até sáb., 22/08* · *fazer hoje* · *fazer sáb., 22/08* ·
  *atrasada · venceu ontem* · *atrasada · venceu ter., 18/08* · *atrasada ·
  era para ter., 18/08* · *alta* / *baixa* · *não concluída*); row actions
  (*Concluir {título}* / *Reabrir {título}* · *Editar título*); section
  (*Concluídas* · count); toasts (*Tarefa reaberta* · *Tarefa excluída*);
  request errors (`Sem conexão com o servidor. Nada se perdeu — tente de novo
  quando a conexão voltar.` · `O servidor recusou a operação (código N). Tente
  de novo.`); detail sheet (labels *Título · Descrição · Data · Prioridade*,
  chips *Sem data · Concluir até · Fazer em* and *Alta · Normal · Baixa*,
  *Cancelar* / *Salvar* / *Excluir*, close button *Fechar*); `<title>` (*Hoje
  · Praesto Sum* · *Praesto Sum*); manifest (`name` *Praesto Sum* ·
  `short_name` *Praesto* · shortcut *Nova tarefa* — *Abrir o Praesto com o
  campo de captura vazio*). Add a History row dated 2026-08-21 stating that
  the A5 microcopy rows approved in the PRD scope round were added ahead of
  Phase 1's code, and set the frontmatter `last_updated` to `2026-08-21`.
  Keep the document's sentence "New states get their copy added here first,
  then in code." as it is — this task is that rule being followed.
- **MIRROR**: `# SOURCE: src/shared/token-store.ts:51-61` — the constant
  whose Portuguese replacement (Task 4) must match this document's new row
  byte for byte: the document row is written first, the module copies it,
  so the sentence is never retyped twice.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'Captura indisponível sem conexão.' documentation/10-product/visual-identity.md
  grep -qF 'Não foi possível guardar o token neste dispositivo.' documentation/10-product/visual-identity.md
  grep -qF 'Sem conexão com o servidor. Nada se perdeu' documentation/10-product/visual-identity.md
  grep -qF 'last_updated: 2026-08-21' documentation/10-product/visual-identity.md
  npx vitest run --project docs
  ```
- Delivers AC-A10.

### Task 2: CREATE `src/shared/format.ts`

- **ACTION**: Create a pure module with the same header discipline as
  `src/shared/dates.ts` (no DOM globals, no runtime dependency, compiled into
  both targets) that imports only `PRAESTO_TIMEZONE` and `todayIn` from
  `./dates` and the `TaskDto` type from `./api`. Export exactly these
  functions, declared with these signatures:
  `export function formatRemaining(count: number): { figure: string | null; label: string }`
  — `0` → `{ figure: null, label: "nenhuma restante" }`, `1` →
  `{ figure: "1", label: "restante" }`, any other non-negative integer `n` →
  `{ figure: String(n), label: "restantes" }`; zero is special-cased with an
  explicit comparison, never through `Intl.PluralRules` (CLDR maps `0` to
  `one` for `pt-BR`, verified in Node 24 / ICU 78: `select(0) === "one"`).
  `export function formatDayShort(day: string): string` — takes a
  `YYYY-MM-DD` calendar day, formats `new Date(\`${day}T12:00:00Z\`)` with
  `new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).formatToParts(...)`
  and assembles `` `${weekday}, ${dd}/${mm}` `` from the `weekday`, `day` and
  `month` parts, normalising the weekday to end in exactly one `.` (strip a
  trailing period if present, then append one) so the result is `sex., 21/08`
  regardless of ICU punctuation. `export function formatHeaderDate(now: Date, timeZone: string = PRAESTO_TIMEZONE): string`
  — `formatDayShort(todayIn(now, timeZone))`, so
  `formatHeaderDate(new Date("2026-08-21T15:00:00Z"))` is `sex., 21/08`.
  `export function taskMetaLine(task: TaskDto, today: string): { text: string; overdue: boolean } | null`
  — `today` is a `YYYY-MM-DD` day; a `missed` Task yields
  `{ text: "não concluída", overdue: true }`; a `done` Task yields `null`; an
  open Task builds a date phrase from `deadline` or `scheduledDate` (at most
  one is non-null by the schema's CHECK): with `<day>` being `hoje` when the
  date equals `today`, `amanhã` when it equals `today + 1`, `ontem` when it
  equals `today - 1`, and `formatDayShort(date)` otherwise — a deadline
  before `today` → `atrasada · venceu <day>` with `overdue: true`; a deadline
  on or after `today` → `até <day>` with `overdue: false`; a scheduled date
  before `today` → `atrasada · era para <day>` with `overdue: true`; a
  scheduled date on or after `today` → `fazer <day>` with `overdue: false`.
  Day arithmetic is done on the `YYYY-MM-DD` strings through UTC noon
  (`Date.UTC` + `setUTCDate`), never through local time. Then, when
  `task.priority` is `"high"` append ` · alta`, when `"low"` append
  ` · baixa` (`"normal"` and `null` append nothing; when there is no date
  phrase the priority word stands alone, e.g. `alta`). An open, undated Task
  with priority `null` or `"normal"` yields `null`. Examples the tests pin
  (for `today = "2026-08-21"`): deadline `2026-08-18` →
  `atrasada · venceu ter., 18/08`; deadline `2026-08-20` →
  `atrasada · venceu ontem`; deadline `2026-08-21` → `até hoje`; deadline
  `2026-08-22` → `até amanhã`; deadline `2026-08-23` → `até dom., 23/08`;
  scheduled `2026-08-18` → `atrasada · era para ter., 18/08`; scheduled
  `2026-08-22` → `fazer amanhã`; scheduled `2026-08-29` with priority `high` →
  `fazer sáb., 29/08 · alta`. Document every rule in a module header comment
  and state that `now` / `today` are arguments so the tests are deterministic.
- **MIRROR**: `# SOURCE: src/shared/dates.ts:22-37` (the dual-compiled
  `Intl` idiom with the instant passed in; `PRAESTO_TIMEZONE` reused).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function formatRemaining' src/shared/format.ts
  grep -q 'export function formatDayShort' src/shared/format.ts
  grep -q 'export function formatHeaderDate' src/shared/format.ts
  grep -q 'export function taskMetaLine' src/shared/format.ts
  if grep -nE 'window|document|navigator|localStorage|Date\.now\(' src/shared/format.ts; then
    echo "FAIL: src/shared/format.ts must stay DOM-free and must not read the clock"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A2, AC-A3.

### Task 3: CREATE `src/shared/connectivity.ts`

- **ACTION**: Create a pure module (same header discipline as Task 2,
  importing only the `RequestFailure` type from `./request-failure`) that
  exports exactly:
  `export type ConnectivityState = "online" | "offline" | "unreachable";`
  `export type ConnectivityEvent = { type: "browser-online" } | { type: "browser-offline" } | { type: "request-failed"; kind: RequestFailure["kind"] } | { type: "request-succeeded" };`
  `export function reduceConnectivity(state: ConnectivityState, event: ConnectivityEvent): ConnectivityState`
  and `export function canWrite(state: ConnectivityState): boolean`. The
  reducer is total and side-effect free: `browser-offline` → `offline` from
  any state; `browser-online` → `online` from any state; `request-failed`
  with `kind: "server-unreachable"` → `unreachable`, except when the state is
  `offline`, which wins and is returned unchanged; `request-failed` with
  `kind: "http-error"` → the state unchanged (the server answered);
  `request-succeeded` → `online` from any state. `canWrite` returns `true`
  only for `online`. Explain in the header why both signals are needed
  (`navigator.onLine` misses an unreachable server; a failed request alone
  misses airplane mode) and that the Phase 2 hook is the only caller that
  touches browser events.
- **MIRROR**: `# SOURCE: src/shared/request-failure.ts:35-54` (the `kind`
  union this reducer consumes, and the discriminated-return idiom).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -q 'export function reduceConnectivity' src/shared/connectivity.ts
  grep -q 'export function canWrite' src/shared/connectivity.ts
  grep -q 'export type ConnectivityState = "online" | "offline" | "unreachable";' src/shared/connectivity.ts
  if grep -nE 'window|document|navigator|localStorage' src/shared/connectivity.ts; then
    echo "FAIL: src/shared/connectivity.ts must stay DOM-free"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A4.

### Task 4: UPDATE `src/shared/request-failure.ts` and `src/shared/token-store.ts`

- **ACTION**: In `src/shared/request-failure.ts`, keep the function, the
  `kind` values and the duck-typed `status` check byte-identical and change
  only the two message values: the `http-error` message becomes the template
  literal `` `O servidor recusou a operação (código ${status}). Tente de novo.` ``
  and the `server-unreachable` message becomes the single-line string literal
  `"Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar."`.
  In `src/shared/token-store.ts`, keep the constant name `TOKEN_NOT_STORED`
  and its comment, and replace the three-line concatenation with ONE string
  literal on ONE line (Prettier never splits a string, so the long line is
  accepted by `prettier --check`):
  `"Não foi possível guardar o token neste dispositivo. O navegador recusou IndexedDB e o armazenamento local — verifique se ele está bloqueando dados do site."`.
  Update the two module header comments only where they quote the old English
  wording, and add one sentence to each noting that the wording is Portuguese
  per ADR-0009 and pinned by its test. Do not touch `test/` — the test pair
  re-pins the assertions.
- **MIRROR**: `# SOURCE: src/shared/request-failure.ts:35-54` and
  `# SOURCE: src/shared/token-store.ts:51-61` (the exact lines being edited;
  everything around the string values stays).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'O servidor recusou a operação (código ${status}). Tente de novo.' src/shared/request-failure.ts
  grep -qF 'Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.' src/shared/request-failure.ts
  grep -qF 'Não foi possível guardar o token neste dispositivo. O navegador recusou IndexedDB e o armazenamento local — verifique se ele está bloqueando dados do site.' src/shared/token-store.ts
  if grep -nF 'Praesto could not' src/shared/request-failure.ts src/shared/token-store.ts; then
    echo "FAIL: an English owner-facing message survived the translation"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A1.

### Task 5: CREATE `scripts/fetch-fonts.mjs` and run it

- **ACTION**: Write a zero-dependency Node script (global `fetch`,
  `node:fs`, `node:path`; no package added — ADR-0005) run as
  `node scripts/fetch-fonts.mjs`. It requests
  `https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Unbounded:wght@800&display=optional`
  with a desktop Chrome `User-Agent` header (the API returns TTF blocks with no
  `unicode-range` to a generic client; with a Chrome UA it returns one
  `@font-face` block per subset, `woff2`, with `unicode-range` — verified
  2026-08-21), parses the two blocks preceded by the comment `/* latin */`,
  downloads their `src: url(...)` files into `public/fonts/inter-latin-var.woff2`
  and `public/fonts/unbounded-latin-800.woff2`, downloads
  `https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt` to
  `public/fonts/OFL-Inter.txt` and
  `https://raw.githubusercontent.com/google/fonts/main/ofl/unbounded/OFL.txt`
  to `public/fonts/OFL-Unbounded.txt`, prints each file's byte size and the
  two-font total, and exits non-zero if a response is not `200`, if a file
  does not start with the WOFF2 magic bytes `wOF2`, or if the two fonts
  together exceed `102400` bytes (guidelines §5.3). Print the latin
  `unicode-range` it found, because Task 6 copies it into `index.html`. The
  verbatim latin block the API returned on 2026-08-21 (Chrome UA) is:
  ```
  /* latin */
  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 400 700;
    font-display: optional;
    src: url(https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  ```
  (Unbounded's block has the same shape with `font-weight: 800` and
  `https://fonts.gstatic.com/s/unbounded/v12/Yq6F-LOTXCb04q32xlpat-6uR42XTqtG65j244rNgQ.woff2`;
  `Content-Length` measured by HEAD: 48256 and 21828 bytes.) Parse the
  response by the `/* latin */` comment and the `url(...)` inside the
  following block — do not hard-code the `gstatic` URLs, which change with
  font versions. Run the script once and commit its outputs; add a header
  comment saying it is re-run only when the fonts are deliberately upgraded.
- **MIRROR**: `# SOURCE: scripts/generate-icons.js:21-27` (the
  zero-dependency `scripts/` idiom: plain `node`, no build step, outputs under
  `public/`).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  node scripts/fetch-fonts.mjs
  node --input-type=module -e '
  import { readFileSync, statSync } from "node:fs";
  const files = ["public/fonts/inter-latin-var.woff2", "public/fonts/unbounded-latin-800.woff2"];
  let total = 0;
  for (const f of files) {
    const head = readFileSync(f).subarray(0, 4).toString("ascii");
    if (head !== "wOF2") { console.error(`FAIL: ${f} is not a WOFF2 file (magic ${JSON.stringify(head)})`); process.exit(1); }
    total += statSync(f).size;
  }
  if (total > 102400) { console.error(`FAIL: fonts total ${total} bytes > 102400`); process.exit(1); }
  for (const f of ["public/fonts/OFL-Inter.txt", "public/fonts/OFL-Unbounded.txt"]) {
    if (!readFileSync(f, "utf8").includes("SIL OPEN FONT LICENSE")) { console.error(`FAIL: ${f} is not the OFL text`); process.exit(1); }
  }
  console.log(`PASS: two WOFF2 files, ${total} bytes together, OFL texts present`);
  '
  ```
- Delivers AC-A6.

### Task 6: UPDATE `index.html`

- **ACTION**: Keep every existing tag and edit the head in place: change the
  viewport meta's `content` to exactly
  `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`
  (layout standard §4); change the `theme-color` meta to
  `<meta name="theme-color" content="#161012" />`; add
  `<meta name="color-scheme" content="dark" />` right after the charset meta;
  add two preloads before the stylesheet-bearing script —
  `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/inter-latin-var.woff2" />`
  and the same for `/fonts/unbounded-latin-800.woff2`; add one `<style>`
  block (written in the formatted shape Prettier emits, since
  `prettier --check .` covers this file — run `npx prettier --write index.html`
  after editing) containing: two `@font-face` rules —
  `font-family: "Inter"; font-style: normal; font-weight: 400 700; font-display: optional; src: url("/fonts/inter-latin-var.woff2") format("woff2");`
  plus the latin `unicode-range` Task 5 printed, and
  `font-family: "Unbounded"; font-style: normal; font-weight: 800; font-display: optional; src: url("/fonts/unbounded-latin-800.woff2") format("woff2");`
  with the same range — then the critical CSS
  `html { background: #161012; color-scheme: dark; }` and the rules for the
  skeleton below (a `.shell-skeleton` grid filling `100dvh` with a header bar,
  three row blocks and a bottom deck block in `#1f1816` / `#2a211e`, all
  `aria-hidden`). Inside `<div id="root">` add the static skeleton markup:
  `<div class="shell-skeleton" aria-hidden="true">` with those blocks — React's
  `createRoot(container).render(...)` replaces it on first render, so nothing
  in `main.tsx` has to remove it. `#161012` stays the only colour literal
  besides the two skeleton surfaces; no other token value is copied here
  (guidelines §3.5 exempts this file for the background only).
- **MIRROR**: `# SOURCE: index.html:3-13` (the head being extended) and
  `# SOURCE: src/app/styles.css:49-68` (the `color-scheme: dark` /
  `background: var(--color-bg)` rules the critical CSS echoes as a literal).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"' index.html
  grep -qF '<meta name="theme-color" content="#161012" />' index.html
  grep -qF '<meta name="color-scheme" content="dark" />' index.html
  grep -qF 'font-display: optional' index.html
  grep -qF '/fonts/inter-latin-var.woff2' index.html
  grep -qF '/fonts/unbounded-latin-800.woff2' index.html
  grep -qF 'unicode-range' index.html
  grep -qF 'shell-skeleton' index.html
  grep -qF 'background: #161012' index.html
  if grep -qF '#0b0b0c' index.html; then echo "FAIL: the old background literal survived in index.html"; exit 1; fi
  npx prettier --check index.html
  ```
- Delivers AC-A5, AC-A6.

### Task 7: UPDATE `public/manifest.webmanifest` and `public/favicon.svg`

- **ACTION**: In `public/manifest.webmanifest` set `"background_color": "#161012"`
  and `"theme_color": "#161012"`, keep `id`, `name` (`Praesto Sum`),
  `short_name` (`Praesto`), `lang`, `start_url`, `scope`, `display`, `icons`
  and `share_target` exactly as they are, and rewrite the single `shortcuts`
  entry to `"name": "Nova tarefa"`, `"short_name": "Nova tarefa"`,
  `"description": "Abrir o Praesto com o campo de captura vazio"` with its
  `url` and `icons` unchanged. In `public/favicon.svg` change the background
  rect's `fill="#0b0b0c"` to `fill="#161012"` and nothing else (the geometry
  comment still holds: same mark as `scripts/generate-icons.js`).
- **MIRROR**: `# SOURCE: scripts/generate-icons.js:21-27` (the comment that
  ties the manifest colours to the icon background — the three now agree on
  `#161012`).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  const s = m.shortcuts?.[0] ?? {};
  const checks = {
    theme_color: m.theme_color === "#161012",
    background_color: m.background_color === "#161012",
    name: m.name === "Praesto Sum",
    short_name: m.short_name === "Praesto",
    lang: m.lang === "pt-BR",
    shortcut_name: s.name === "Nova tarefa",
    shortcut_description: s.description === "Abrir o Praesto com o campo de captura vazio",
    shortcut_url: s.url === "/new-task",
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) { console.error("FAIL: manifest fields wrong: " + failed.join(", ")); process.exit(1); }
  console.log("PASS: manifest colours and pt-BR text");
  '
  grep -qF 'fill="#161012"' public/favicon.svg
  if grep -qF '#0b0b0c' public/favicon.svg public/manifest.webmanifest; then echo "FAIL: the old background literal survived"; exit 1; fi
  ```
- Delivers AC-A5, AC-A7.

### Task 8: UPDATE `scripts/generate-icons.js` and regenerate `public/icons/*.png`

- **ACTION**: Change the palette line to `const BACKGROUND = [0x16, 0x10, 0x12];`
  and its comment to say the background matches `--color-bg` in
  `src/app/tokens.css` as well as the manifest; change nothing else in the
  rasterizer (gradient, cord, white badge, geometry, the five `ICONS`
  entries and their `contentScale` values stay). Run
  `node scripts/generate-icons.js` once so `public/icons/icon-192.png`,
  `public/icons/icon-512.png`, `public/icons/maskable-512.png`,
  `public/icons/apple-touch-icon-180.png` and `public/icons/badge-72.png` are
  regenerated from the one run, and commit the five files.
- **MIRROR**: `# SOURCE: scripts/generate-icons.js:21-27` (the constant being
  changed).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'const BACKGROUND = [0x16, 0x10, 0x12];' scripts/generate-icons.js
  node scripts/generate-icons.js
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { inflateSync } from "node:zlib";
  // Decodes the PNGs our own encoder writes: RGBA8, no interlace, one filter
  // byte (0 = None) per scanline (scripts/generate-icons.js "Minimal PNG encoder").
  function pixel(file, x, y) {
    const png = readFileSync(file);
    let pos = 8, width = 0;
    const idat = [];
    while (pos < png.length) {
      const len = png.readUInt32BE(pos);
      const type = png.toString("ascii", pos + 4, pos + 8);
      const data = png.subarray(pos + 8, pos + 8 + len);
      if (type === "IHDR") width = data.readUInt32BE(0);
      if (type === "IDAT") idat.push(data);
      pos += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const o = y * (width * 4 + 1) + 1 + x * 4;
    return [raw[o], raw[o + 1], raw[o + 2], raw[o + 3]];
  }
  const bg = [0x16, 0x10, 0x12, 255];
  const checks = [
    ["public/icons/icon-512.png", 256, 10, bg],
    ["public/icons/icon-192.png", 96, 4, bg],
    ["public/icons/maskable-512.png", 10, 10, bg],
    ["public/icons/apple-touch-icon-180.png", 5, 5, bg],
    ["public/icons/badge-72.png", 36, 36, [255, 255, 255, 255]],
  ];
  for (const [file, x, y, want] of checks) {
    const got = pixel(file, x, y);
    if (got.join(",") !== want.join(",")) { console.error(`FAIL: ${file} pixel(${x},${y}) = ${got} want ${want}`); process.exit(1); }
  }
  console.log("PASS: icon backgrounds are #161012 and the badge stays a white silhouette");
  '
  ```
- Delivers AC-A7.

### Task 9: UPDATE `vite.config.ts` and `src/app/main.tsx`; CREATE `src/app/components/DesignPlayground.tsx`

- **ACTION**: In `vite.config.ts` change `includeAssets` to
  `["favicon.svg", "manifest.webmanifest", "icons/*.png", "fonts/*.woff2"]`.
  In `src/app/main.tsx` add `import "./styles.css";` as the first import, and
  before the share-target detection add a branch
  `if (import.meta.env.DEV && window.location.pathname === "/design")` that
  dynamically imports `./components/DesignPlayground`, renders its
  `DesignPlayground` export into the root with `createRoot` inside
  `StrictMode`, sets `document.title` to `Design · Praesto Sum`, and returns
  before `App` is rendered, before `setupPwa` and before
  `requestPersistentStorage` (wrap the existing render + `setupPwa` +
  persist sequence in a `mountApp()` function called from the `else` path so
  the three calls keep their order and their comments; the `setupPwa` block
  itself, `window.confirm` included, is not changed in this phase). Create
  `src/app/components/DesignPlayground.tsx` exporting
  `export function DesignPlayground()`: a scrollable page in the Tailwind
  token vocabulary (`bg-bg`, `text-ink`, `font-text`, `rounded-card`,
  `shadow-deck`…) with an `<h1>` reading `Design — tokens e estados` and
  these sections, each with a pt-BR `<h2>`: **Cores** — one swatch per
  colour token (`--color-bg`, `--color-surface-1`, `--color-surface-2`,
  `--color-surface-3`, `--color-line`, `--color-line-strong`, `--color-ink`,
  `--color-muted`, `--color-faint`, `--color-accent`, `--color-accent-deep`,
  `--color-on-accent`, `--color-live`) rendered from a `const TOKENS` list
  with the token name and its value read at runtime via
  `getComputedStyle(document.documentElement).getPropertyValue(name)`,
  binding the swatch background with `style={{ background: \`var(${name})\` }}`
  (the one inline-style use the PRD's AC-2 exempts for this file); **Tipo** —
  the five rungs `text-t1`…`text-t5` in Inter 400 and 600, the wordmark
  `praesto` and a count `4` in `font-display` (Unbounded 800), a mono data
  sample in `font-data`; **Espaço** — bars of `--space-1`…`--space-8`;
  **Raios** — boxes with `rounded-card`, `rounded-control`, `rounded-pill`;
  **Elevação** — boxes with `shadow-row`, `shadow-deck`, `shadow-control`,
  `shadow-control-pressed`, `shadow-field`, `shadow-glow-live`,
  `shadow-halo-done`; **Movimento** — three boxes whose `transition-duration`
  reads `var(--duration-short)`, `var(--duration-medium)`,
  `var(--duration-long)` and translate on hover/focus, plus the easing names;
  **Componentes** — `Button` in `primary`, `secondary`, `ghost` and `icon`
  variants at rest and `disabled`, `CompleteControl` unchecked and checked
  (interactive, local state), a `ChipGroup` with three `Chip`s, the flat mark
  `<img src="/brand/mark-flat.svg" alt="" />` beside the wordmark, and a
  button that opens the existing `Sheet` with a short body; **Foco** — a
  paragraph telling the reader to press Tab to see the two-tone ring. Every
  interactive element keeps a ≥ 48 px hit area and an accessible name. Later
  phases add their components to this page as they are built (row states,
  toast, banner, empty, skeleton, confirmation) — this phase renders every
  token and the primitives that exist today.
- **MIRROR**: `# SOURCE: src/app/main.tsx:16-26` (the pathname branch shape
  the `/design` gate copies) and `# SOURCE: src/app/components/ui/Button.tsx:9-23`
  (the token-class vocabulary the playground is written in).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'import "./styles.css";' src/app/main.tsx
  grep -qF 'import.meta.env.DEV' src/app/main.tsx
  grep -qF '"/design"' src/app/main.tsx
  grep -qF '"fonts/*.woff2"' vite.config.ts
  grep -qF 'export function DesignPlayground' src/app/components/DesignPlayground.tsx
  grep -qF 'Design — tokens e estados' src/app/components/DesignPlayground.tsx
  npx tsc -b
  npm run build
  if grep -rlF 'tokens e estados' dist/client >/dev/null; then
    echo "FAIL: the /design playground leaked into the production bundle"; exit 1
  fi
  test -f dist/client/sw.js
  grep -qF '"url":"fonts/inter-latin-var.woff2"' dist/client/sw.js
  grep -qF '"url":"fonts/unbounded-latin-800.woff2"' dist/client/sw.js
  ```
  (`dist/client/sw.js` is where vite-plugin-pwa writes the compiled worker —
  its build log ends with the verbatim line `files generated  dist/client/sw.js`
  — and the injected precache manifest lists each file as
  `"url":"icons/icon-192.png"`-shaped entries, verified on a build of `main`
  on 2026-08-21.)
- Delivers AC-A6, AC-A8.

### Task 10: RUN the gates and the budget probe

- **ACTION**: Run `npm run check`, `npm test` and `npm run build` and confirm
  all three are green — the suites now include the test pair's new files for
  `format.ts` and `connectivity.ts` and the re-pinned message assertions; a
  failure is fixed in the production code, never in a test
  (`docs/anti-patterns.md`, "Weakening tests to force green"). Then measure
  the built bundle against guidelines §11 with the probe below (gzip of every
  JS and CSS asset under `dist/client/assets`, the precache total from the
  files the service worker lists) and paste its output into
  `PRPs/reports/ui-design-pass/phase-1/build-report.md` together with the
  `vite build` size table. The browser-pane Tier A check of `/design` at
  375 px (guidelines checklist items 1–9, DOM measurements of hit areas and
  the five contrast pairs) is performed by the main session after this task,
  not by the Implementer, and recorded in the same report directory.
- **MIRROR**: `# SOURCE: vite.config.ts:30-35` — the precache configuration
  whose output the probe reads.
- **VALIDATE**:
  ```bash
  set -euo pipefail
  npm run check
  npm test
  npm run build
  node --input-type=module -e '
  import { readdirSync, readFileSync, statSync } from "node:fs";
  import { join } from "node:path";
  import { gzipSync } from "node:zlib";
  const dir = "dist/client/assets";
  let js = 0, css = 0;
  for (const f of readdirSync(dir)) {
    const size = gzipSync(readFileSync(join(dir, f))).length;
    if (f.endsWith(".js")) js += size;
    if (f.endsWith(".css")) css += size;
  }
  const fonts = ["public/fonts/inter-latin-var.woff2", "public/fonts/unbounded-latin-800.woff2"].reduce((n, f) => n + statSync(f).size, 0);
  console.log(`JS ${js} B gzip (budget 174080) · CSS ${css} B gzip (budget 30720) · fonts ${fonts} B (budget 102400)`);
  if (js > 174080 || css > 30720 || fonts > 102400) { console.error("FAIL: guidelines §11 budget exceeded"); process.exit(1); }
  console.log("PASS: inside the §11 budget");
  '
  ```
- Delivers AC-A9 (and re-verifies AC-A1 through AC-A8 through the suites and
  the build). This task changes no source file; its only write is the phase
  record `PRPs/reports/ui-design-pass/phase-1/build-report.md` — it is the
  infrastructure / gate step of the phase.

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

`npm run check` is `wrangler types --check && tsc -b && eslint . && prettier --check .`
(`package.json`); each stage exits non-zero on failure and `&&` propagates.
`prettier --check .` covers `index.html`, `vite.config.ts`, the new scripts
and the playground.

**Level 2 — UNIT TESTS**

```bash
set -euo pipefail
npx vitest run --project worker
npx vitest run --project docs
```

`vitest run` exits non-zero when any test fails — no output parsing. The
`worker` project carries the test pair's suites for `format.ts`,
`connectivity.ts` and the re-pinned message assertions; the `docs` project
guards the derived docs after Task 1's edit.

**Level 3 — BUILD + STRUCTURAL GATE**

```bash
set -euo pipefail
npm run build
node --input-type=module -e '
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
const fonts = ["public/fonts/inter-latin-var.woff2", "public/fonts/unbounded-latin-800.woff2"];
let total = 0;
for (const f of fonts) {
  if (readFileSync(f).subarray(0, 4).toString("ascii") !== "wOF2") { console.error(`FAIL: ${f} is not WOFF2`); process.exit(1); }
  total += statSync(f).size;
}
if (total > 102400) { console.error(`FAIL: fonts ${total} B > 102400`); process.exit(1); }
let js = 0, css = 0;
for (const f of readdirSync("dist/client/assets")) {
  const size = gzipSync(readFileSync(join("dist/client/assets", f))).length;
  if (f.endsWith(".js")) js += size;
  if (f.endsWith(".css")) css += size;
}
if (js > 174080 || css > 30720) { console.error(`FAIL: JS ${js} / CSS ${css} gzip over budget`); process.exit(1); }
const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
if (m.theme_color !== "#161012" || m.background_color !== "#161012" || m.shortcuts?.[0]?.name !== "Nova tarefa") { console.error("FAIL: manifest colours or pt-BR shortcut"); process.exit(1); }
console.log(`PASS: fonts ${total} B, JS ${js} B gzip, CSS ${css} B gzip, manifest on #161012`);
'
test -f dist/client/sw.js
grep -qF '"url":"fonts/inter-latin-var.woff2"' dist/client/sw.js
grep -qF '"url":"fonts/unbounded-latin-800.woff2"' dist/client/sw.js
if grep -rlF 'tokens e estados' dist/client >/dev/null; then
  echo "FAIL: the /design playground leaked into the production bundle"; exit 1
fi
if grep -nF '#0b0b0c' index.html public/manifest.webmanifest public/favicon.svg scripts/generate-icons.js; then
  echo "FAIL: the old background literal survived in a chrome file"; exit 1
fi
grep -qF 'import "./styles.css";' src/app/main.tsx
```

`npm run build` (`tsc -b && vite build`) is this phase's real Level 3: it
type-checks the playground and the entry point, bundles Tailwind over the
tokens, and emits the service worker whose precache manifest the greps read
(`dist/client/sw.js`, entries shaped `"url":"icons/icon-192.png"` — verified
on a build of `main` on 2026-08-21, whose baseline is JS 66,442 B gzip and
CSS 0 B because nothing imports `styles.css` yet).
The probe measures the §11 budget from the real artifacts instead of trusting
a declaration; the literal greps pin the chrome files to `#161012`. **The
browser-pane check of `/design` is NOT covered by any command here and is
performed by the main session** — see `## Notes` for the script.

## Acceptance Criteria

- **AC-A1 (PRD AC-4):** `classifyRequestFailure({ status: 500 })` returns
  `kind: "http-error"` with the message
  `O servidor recusou a operação (código 500). Tente de novo.`;
  `classifyRequestFailure(new TypeError("Failed to fetch"))` returns
  `kind: "server-unreachable"` with the message
  `Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.`;
  and `createTokenStore(...).save()` rejects, when both ports refuse, with
  `Não foi possível guardar o token neste dispositivo. O navegador recusou IndexedDB e o armazenamento local — verifique se ele está bloqueando dados do site.`
  — every other assertion of the two existing suites (status number inside
  the sentence, distinct messages, `kind` discrimination, the seven token-store
  rules) holds unchanged.
- **AC-A2 (PRD AC-5):** `formatRemaining(0)` is
  `{ figure: null, label: "nenhuma restante" }`, `formatRemaining(1)` is
  `{ figure: "1", label: "restante" }`, `formatRemaining(4)` is
  `{ figure: "4", label: "restantes" }`; `formatHeaderDate(new Date("2026-08-21T15:00:00Z"))`
  is `sex., 21/08`, and `formatDayShort("2026-08-18")` is `ter., 18/08`.
- **AC-A3 (PRD AC-6):** with `today = "2026-08-21"`, `taskMetaLine` yields
  `atrasada · venceu ter., 18/08` (`overdue: true`) for a deadline of
  `2026-08-18`, `atrasada · venceu ontem` for `2026-08-20`, `até hoje` for
  `2026-08-21`, `até amanhã` for `2026-08-22`, `até dom., 23/08` for
  `2026-08-23`, `atrasada · era para ter., 18/08` for a scheduled `2026-08-18`,
  `fazer amanhã` for a scheduled `2026-08-22`, `fazer sáb., 29/08 · alta` for a
  scheduled `2026-08-29` with priority `high`, ` · baixa` appended for
  priority `low` and nothing for `normal` / `null`; `null` for an open,
  undated, unprioritised Task and for any `done` Task;
  `{ text: "não concluída", overdue: true }` for a `missed` Task.
- **AC-A4 (PRD AC-7):** `reduceConnectivity` maps `browser-offline` →
  `offline`, `browser-online` → `online`, `request-failed` /
  `server-unreachable` → `unreachable` unless the state is `offline` (kept),
  `request-failed` / `http-error` → the same state, `request-succeeded` →
  `online`; `canWrite` is `true` only for `online`.
- **AC-A5 (PRD AC-1):** `index.html` carries `theme-color #161012`, the
  `color-scheme` meta, the `resizes-content` viewport string, the critical
  CSS `background: #161012` and the skeleton markup; the manifest's
  `theme_color` and `background_color` are `#161012` — the three declarations
  that make splash, first paint and app one surface agree (the device check
  itself is Phase 4's).
- **AC-A6 (PRD AC-18):** `public/fonts/` holds exactly the two latin-subset
  WOFF2 files (magic bytes `wOF2`, together ≤ 102,400 bytes) with their OFL
  texts, `index.html` declares both with `font-display: optional` and the
  latin `unicode-range`, the built service worker's precache manifest lists
  both, and the build's gzip weight stays ≤ 170 KB JS / ≤ 30 KB CSS.
- **AC-A7 (PRD AC-19):** the manifest's shortcut reads *Nova tarefa* /
  *Abrir o Praesto com o campo de captura vazio*; `favicon.svg` and the five
  PNGs regenerated by `scripts/generate-icons.js` are on `#161012` (decoded
  pixel probe), the badge stays a white silhouette on transparency, and no
  chrome file carries `#0b0b0c`.
- **AC-A8 (PRD AC-20):** with `npm run dev`, `/design` renders the playground
  (every colour, type, space, radius, elevation and motion token plus the
  `Button`, `CompleteControl`, `Chip` and `Sheet` states that exist today),
  and the production bundle under `dist/client` contains no trace of it.
- **AC-A9 (PRD AC-22):** `npm run check`, `npm test` and `npm run build` are
  green with no test weakened, the build report is filed under
  `PRPs/reports/ui-design-pass/phase-1/`, and the browser-pane Tier A result
  for `/design` is recorded there by the main session.
- **AC-A10 (PRD AC-3):** the approved microcopy table in
  `documentation/10-product/visual-identity.md` carries every new row of the
  PRD's "Microcopy added by this pass" before the strings appear in code.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The Google Fonts CSS2 API is unreachable when the Implementer runs Task 5, or answers a different shape | Low | Medium — no fonts, no `@font-face` to write | The script fails loudly (non-200, missing `/* latin */` block, bad magic bytes); the verbatim block and the two HEAD-measured sizes are pasted in Task 5 so the owner can download the files by hand with the same URLs; the Chrome `User-Agent` is the documented key (a generic client gets TTF with no `unicode-range`) |
| The two fonts together exceed 100 KB after a font version bump | Low (70,084 bytes measured 2026-08-21) | Medium | Task 5 and Level 3 fail over 102,400 bytes; ADR-0010's escape is recorded — drop Unbounded and let Inter 800 render the count |
| ICU in workerd formats the short weekday without the trailing period, so the test pair's `sex., 21/08` pins fail | Low (Node 24 / ICU 78 emits `sex.`) | Low | `formatDayShort` normalises the weekday to exactly one trailing `.` after `formatToParts`, so the output is stable across ICU builds |
| Importing `styles.css` applies Tailwind's preflight to the old inline-styled screens, which then look half-styled | High (expected) | Low | Accepted transitional state named in `## NOT Building`; Phase 2 and Phase 3 rebuild those screens; this phase's Tier A check targets `/design`, not the old screens |
| Prettier reformats the inline `<style>` in `index.html`, so a byte-exact grep misses | Medium | Low | Task 6 writes the formatted form and runs `npx prettier --write index.html`; its greps target Prettier's output (`background: #161012`, `font-display: optional`) and Level 1 runs `prettier --check` |
| `createRoot` leaves the static skeleton behind, or the skeleton flashes after React mounts | Low | Low | `createRoot(container).render()` replaces the container's children on first commit (the existing `#root` is emptied the same way today); the skeleton's surfaces are the same tokens the Phase 2 `Skeleton` component uses, so the handover is invisible |
| The `/design` branch survives in production through a non-static check | Low | Medium — a dev page in the shipped bundle | `import.meta.env.DEV` is statically replaced at build time (Vite docs) and the page is only reachable through a dynamic import inside that branch; Task 9 and Level 3 grep `dist/client` for the page's own heading literal |
| The test pair reads AC-A5–AC-A9 (chrome, build, pane) as ambiguous and aborts | Medium | Medium | The PRD tags them [manual] / [static]; only AC-A1–AC-A4 are automated contracts, and each names its inputs and outputs literally above |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **Test-file routing:** this phase's test-file creation and updates are
  routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger
  (`/relay-write-test` → `/relay-test-write-review`), not authored by the
  Implementer — R-X is a blanket straight-fail on any test glob in the
  Implementer's diff. No task above and no `## Files to Change` row targets a
  test file, so this plan's per-task `**VALIDATE**` commands exercise each
  change directly (compiled modules, parsed JSON, decoded pixels, font bytes,
  the built bundle); the declared framework is invoked only to *run* the
  existing and pair-authored suites (Task 1's `docs` project, Task 10 and
  Level 2), never to author or edit a test. The pair is expected to CREATE
  `test/format.test.ts` and `test/connectivity.test.ts` from AC-A2–AC-A4 and
  to UPDATE the wording assertions in `test/request-failure.test.ts` and
  `test/token-store.test.ts` from AC-A1 (lifecycle ledger:
  `EXISTING_TEST_UPDATED`), so the suite is RED for the right reason —
  modules missing, English wording still in place — until Tasks 2–4 land.
- **What is automated and what is verified by hand.** The pure modules carry
  every rule worth asserting (messages, the zero-in-singular special case, the
  date phrases, the connectivity transitions). What remains is chrome and
  assets, verified by the Level 3 probes against the real artifacts, and one
  manual check — the playground in the browser pane — which has no honest
  automated path in this project's only test tier (Vitest inside workerd, no
  DOM). That is the split `docs/context/methodology.md` prescribes.
- **Manual verification script (main session, after Task 10, in the browser
  pane at 375 px, dark):** start `npm run dev`, open `/design`, and record
  under `PRPs/reports/ui-design-pass/phase-1/` — (1) the canvas is `#161012`
  before and after JavaScript (`getComputedStyle(document.documentElement).backgroundColor`
  reads `rgb(22, 16, 18)`); (2) `document.fonts.check('16px Inter')` and
  `document.fonts.check('800 20px Unbounded')` are `true` after load, and the
  Network panel shows both WOFF2 files from the same origin and nothing from
  another origin (Tier A item 9); (3) every swatch, type rung, radius,
  elevation and motion sample renders and matches the token table of
  `documentation/10-product/visual-identity.md`; (4) every interactive
  element measures ≥ 48 × 48 px with ≥ 8 px gaps (`getBoundingClientRect`,
  Tier A item 2); (5) the five contrast pairs of guidelines §4.3 measured on
  the playground surfaces and recorded as `pair: x.x:1`; (6) Tab shows the
  two-tone focus ring, Esc closes the `Sheet` and focus returns to its opener
  (Tier A item 5); (7) the `<title>` reads `Design · Praesto Sum` and the
  `<h1>` is the only one (Tier A item 6); (8) a screenshot, or the written
  reason none exists, filed with the DOM measurements (Tier B item 14).
- **Playground completion is staged by design.** PRD AC-20 lists row, toast,
  banner, empty, skeleton, sheet and confirmation states; this phase renders
  every token and the four primitives that exist on `main`. Phase 2 and
  Phase 3 register their components on the same page as they are built, and
  AC-20 is signed off in full at Phase 4 — recorded here so the reviewer does
  not read AC-A8 as a claim to the whole of AC-20.
- **Research grounding.** `research-codebase` returned 8 findings (scope cap
  reached; every `# SOURCE:` anchor above was re-opened at the cited lines in
  the main session) and `research-web` returned 8 findings (scope cap
  reached): Vite statically replaces `import.meta.env.DEV` so the branch is
  tree-shaken (https://vite.dev/guide/env-and-mode); CLDR's generic `pt`
  plural rule is `i = 0..1`, so `pt-BR` selects `one` for zero
  (https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/plurals.json);
  `font-display: optional` has a tiny block period and no swap period
  (https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display),
  and is the one value that guarantees no layout shift when the font is
  already cached (https://simonhearne.com/2021/layout-shifts-webfonts/); the
  Vite PWA default `globPatterns` is `**/*.{js,css,html}` and fonts are added
  through `includeAssets` or an extended glob
  (https://vite-pwa-org.netlify.app/guide/static-assets) — this project's
  glob already lists `woff2`; the CSS2 API varies its answer by client
  (https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Unbounded:wght@800&display=optional).
  Three gaps the web agent left were closed by direct verification in the
  main session on 2026-08-21: the latin `unicode-range` and the `gstatic`
  URLs (the verbatim block in Task 5, fetched with a Chrome `User-Agent`),
  the file sizes (HEAD: 48,256 and 21,828 bytes) and the OFL texts
  (`raw.githubusercontent.com/google/fonts/main/ofl/{inter,unbounded}/OFL.txt`,
  both `200`), and the `Intl` punctuation (`formatToParts` → `sex.` in Node
  24 / ICU 78.2 / CLDR 48). One gap stays open for the test run: whether
  workerd's ICU agrees — `formatDayShort`'s normalisation makes the answer
  irrelevant to the tests.
- **Not changed in this phase, on purpose:** `src/app/App.tsx`,
  `src/app/pwa.ts`, `src/sw.ts`, `src/app/tokens.css`, `src/app/styles.css`
  (the `@font-face` rules live inline in `index.html` per guidelines §5.3, so
  the stylesheet needs no font import), and every route and test file.

*Generated: 2026-08-21*
*Approved: 2026-08-21*
*Implemented: 2026-08-21*
*Status: IMPLEMENTED*
