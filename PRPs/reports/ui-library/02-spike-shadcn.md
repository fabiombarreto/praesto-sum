# A4 spike 1 — shadcn-style components on Base UI + Tailwind v4

Date: 2026-08-21 · Branch: `spike/ui-shadcn` (throwaway; commit `10b4c7b`) · Render for the owner: `spike-shadcn.html` (single-file build, published as a private artifact) · Route on the branch: `/spike`.

## What was built (≤ 1 h of plan budget)

- **Install (exact pins):** `tailwindcss 4.3.3`, `@tailwindcss/vite 4.3.3`, `@base-ui/react 1.7.0`, `class-variance-authority 0.7.1`, `clsx 2.1.1`, `tailwind-merge 3.6.0`, `lucide-react 1.33.0`. Seven packages; no PostCSS config, no ESLint/Prettier plugin needed.
- **Pipeline:** one line in `vite.config.ts` (`tailwindcss()`); `src/app/styles.css` = `@import "tailwindcss"` + `@import "./tokens.css"` + an `@theme inline reference` block that maps every token into Tailwind namespaces (`bg-surface-2`, `rounded-card`, `shadow-control`, `font-display`, `text-t3`…). **Tailwind reads the tokens and emits no variables of its own** — `tokens.css` stays the single source (guidelines §3.5). `npm run check` (tsc -b strict + ESLint + Prettier) passed with no configuration change — TS 6 needed no `baseUrl`/`paths` because the shadcn CLI was not used; components were written by hand in the shadcn style.
- **Components (owned, in `src/app/spike/ui.tsx`):** `Button` (cva variants: primary with the 3 px lower face and 3 px press, secondary, ghost, icon) on Base UI `Button`; `CompleteControl` on Base UI `Checkbox` (48 px hit area, 26 px ring → accent disc + halo); `Chip`/`ChipGroup` on `Toggle`/`ToggleGroup` (`multiple`, `data-pressed` styling, leading check via `in-data-pressed:`); `Sheet` on Base UI `Dialog` (bottom sheet on compact with handle and `data-starting-style` transitions, centred 560 px dialog from `sm:`).
- **Screen (`SpikeBoard.tsx`):** the layout standard's Today — header with *4 restantes* in Unbounded, chip row, agenda stack, Atrasadas/Hoje/Próximas/Sem data with collapse, 64 px rows, toast, capture deck with the icon-only submit, detail sheet. Seed data; pt-BR copy; `Intl` date.

## Measurements

| Measure | Value | Budget / target |
|---|---|---|
| First-load JS (whole app incl. spike) | **320.9 KB raw · 102.7 KB gzip** | ≤ 170 KB gzip |
| CSS | **22.8 KB raw · 5.5 KB gzip** | ≤ 30 KB gzip |
| `npm run check` | green, no config changes | — |
| `npm test` | 214 green | — |
| Contrast (375 px, pane): title/row · meta/row · overdue/row · ring/row · on-accent/accent · placeholder/field | 14.07 · 14.07 · 5.10 · 4.36 · 9.08 · 15.65 | 4.5 / 3 |
| Hit areas | all controls ≥ 48 px after giving the capture `<input>` `min-h-12` (it was 24 px inside a 56 px field) | 48 px |
| Depth recipe | submit: `inset 0 1px 0 rgba(255,255,255,.3), rgb(184,117,26) 0 3px 0, rgba(0,0,0,.35) 0 6px 12px`; rows and deck resolve as tokens | ADR-0010 |
| Radii | rows 18 px, controls 14 px | ADR-0010 |
| Console | clean in the dev server; in the single-file artifact only the expected SW dynamic-import 404 (no backend) | — |

The JS figure is the **whole** app (React 19 ≈ 60 KB gzip, the existing App, the spike, Base UI Button/Checkbox/Toggle/Dialog, seven lucide icons, cva/clsx/tailwind-merge). Base UI's contribution is modest because only four primitives are imported; Dialog is the heaviest.

## How it felt (DX) — honest notes

- Expressing ADR-0010 was **direct**: every identity rule became a class list on our own component; nothing had to be undone. The press physics, the one elevated plane, the chip on-state and the sheet styles are plain Tailwind over our tokens.
- **Base UI's data-attribute API** (`data-checked`, `data-pressed`, `data-starting-style`/`data-ending-style`) pairs naturally with Tailwind variants; types were clean under `exactOptionalPropertyTypes`.
- **Costs observed:** long class strings (readable only with discipline — cva helps); Tailwind becomes a build-time dependency of every component; `@theme inline reference` is a pattern the owner must remember (documented in `styles.css`). No shadcn CLI was used — adding the registry later is optional, and the Base UI default flip (Jul 2026) means most shadcn blog posts are stale.
- **To verify on the device (not possible in the pane):** whether Base UI `Dialog` closes on the Android back gesture (close-request semantics) — if not, the layout standard's native `<dialog>` sheet replaces it without touching the rest.

## Tier A checklist

1 ✔ one primary action · 2 ✔ targets (after the input fix) · 3 ✔ colour not alone · 4 ✔ pt-BR, sentence case, infinitive buttons, `Intl` date · 5 ✔ focus ring (global `:focus-visible`), Esc closes the sheet · 6 ✔ `aria-label` on icon buttons, `<h1>`, checkbox roles · 7 ✔ tokens only (Tailwind reads them) · 8 ✔ destructive n/a in the spike · 9 ✔ no external request in the app build (the artifact adds Google Fonts for the phone preview only).
