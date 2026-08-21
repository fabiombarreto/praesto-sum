# A4 spike 2 — Mantine 9

Date: 2026-08-21 · Branch: `spike/ui-mantine` (throwaway; commit `3fb4954`) · Render for the owner: `spike-mantine.html` (single-file build, published as a private artifact) · Route on the branch: `/spike`.

## What was built (≤ 1 h of plan budget, plus ~20 min lost to setup traps — recorded below)

- **Install (exact pins):** `@mantine/core 9.5.1`, `@mantine/hooks 9.5.1`, `postcss 8.5.26`, `postcss-preset-mantine 1.18.0`, `postcss-simple-vars 7.0.1`, `lucide-react 1.33.0`. Six packages plus a `postcss.config.cjs` (Mantine's Vite guide requires the preset for its mixins/`rem()`).
- **Theme (`theme.ts`):** `createTheme` with an amber 10-shade tuple built around `#f5a524` (Mantine needs ten shades for one accent), the brown-black ladder mapped onto Mantine's `dark` scale, fonts/radius/spacing pointed at the tokens, `autoContrast`; a `cssVariablesResolver` maps `--mantine-color-body/text/dimmed/default/placeholder/anchor` onto `tokens.css`. The identity's depth and press physics do not exist in Mantine's theme model and live in a **CSS Module** (`SpikeBoard.module.css`) applied by `className`.
- **Components:** `ActionIcon`, `Button`, `Checkbox` (+ `styles` prop to reach 48 px and the ring border), `Chip`/`Chip.Group` (+ `styles` prop for 48 px), `Collapse`, `Drawer` (bottom sheet), `Textarea`, `UnstyledButton`. Same Today screen and seed data as spike 1.
- **Stylesheets:** the global `@mantine/core/styles.css` costs **35.3 KB gzip** — over the §11 CSS budget — so the spike switched to per-component imports: `baseline.css` + `default-css-variables.css` + `global.css` + ten component files → **11.3 KB gzip**.

## Measurements

| Measure | Value | Budget / target |
|---|---|---|
| First-load JS (whole app incl. spike) | **348.6 KB raw · 107.0 KB gzip** | ≤ 170 KB gzip |
| CSS | **67.0 KB raw · 11.3 KB gzip** (per-component) — 236 KB raw · 35.3 KB gzip with the global sheet | ≤ 30 KB gzip |
| `npm run check` | green after one API fix (Mantine 9 renamed `Collapse in` → `expanded`, exactly as the scouting's migration note said) | — |
| Contrast (375 px, production single-file): title/row · overdue/row · on-accent/accent · chip-on text/chip | 14.07 · 5.10 · 10.29 · 10.29 | 4.5 |
| Hit areas | icon buttons 48 (ActionIcon `size={48}`), checkbox wrappers 48 (via `styles.root`), submit 48, chips 48 only after `styles={{ label: { minHeight: 48 } }}` (Mantine `lg` chips are 36 px) | 48 px |
| Depth recipe | submit: `inset 0 1px 0 rgba(255,255,255,.3), rgb(184,117,26) 0 3px 0, rgba(0,0,0,.35) 0 6px 12px` via the CSS Module; rows and deck as tokens | ADR-0010 |
| Radii | rows 18 px (module), controls 14 px (theme `radius.control`), submit 12 px | ADR-0010 |
| Console | clean apart from the expected SW dynamic-import 404 in the single-file build | — |

## How it felt (DX) — honest notes

- **Two setup traps cost real time:** (1) per-component CSS silently breaks without `baseline.css` **and** `default-css-variables.css` — with only `global.css` + components, `--mantine-scale` is undefined, every `calc(… * var(--mantine-scale))` collapses (icon buttons rendered 22 px, chips 38 px, body background transparent) and nothing errors; (2) the global sheet is the documented default and blows the CSS budget. Both are documented on Mantine's site, neither is obvious, and a returning owner would hit them again.
- **autoContrast picked pure black** (`rgb(0,0,0)`) for text on amber, not the identity's `#1a1206`; reaching the token means overriding `--mantine-color-amber-contrast`/per-component styles — more theme surgery. The Checkbox needed a `styles` prop for the ring colour and hit area; chips needed one for height. Every identity rule that Mantine does not model became a `styles`/`className` override — the "strongly restyled Mantine" the matrix predicted.
- **What was good:** one provider, sensible defaults, `Collapse`/`Drawer` came with behaviour for free, TypeScript types were clean under strict flags, and the `cssVariablesResolver` is a legitimate bridge to `tokens.css`. The Drawer closes on Escape and overlay click (disabled for the editor); Android back-gesture closing is not modelled (portal `div`, not a close-request target) — to verify on device, same as Base UI Dialog.
- **Cost that stays forever:** two styling systems (Mantine's CSS variables + our tokens + a CSS Module per screen for what Mantine cannot say) and a PostCSS preset in the pipeline.

## Tier A checklist

1 ✔ one primary action · 2 ✔ targets after the two `styles` overrides · 3 ✔ colour not alone · 4 ✔ pt-BR, sentence case, infinitive buttons, `Intl` date · 5 ✔ focus ring (Mantine `focusRing: auto` — its own ring, not the two-tone token ring; §4.5 would need an override) · 6 ✔ `aria-label` on icon buttons, `<h1>`, native checkbox inputs · 7 ◐ tokens via resolver + module; Mantine's own scales still exist alongside (`--mantine-*`) · 8 ✔ destructive n/a · 9 ✔ no external request in the app build (artifact adds Google Fonts for the phone preview only).
