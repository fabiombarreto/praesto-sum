# A4 — UI library: evaluation matrix (decision 6)

Date: 2026-08-20 · Inputs: the verified scouting of 2026-08-18 (npm registry, GitHub API, official changelogs; `documentation/50-planning/ui-ux-plan.md` § Preliminary scouting), the owner's Q6 answer (Tailwind acceptable; the family is chosen from spikes on the phone), ADR-0010 (what the library must *express*: tactile depth with press physics, one elevated plane, radius 18/14/pill, Inter + Unbounded, tokens in `src/app/tokens.css`), the layout standard (native `<dialog>` sheets, chips, 48 px controls, list-detail on desktop) and the constraints (CON-002/006 one maintainer, CON-004 zero cost, ADR-0005 exact pins + minimal tooling, guidelines §11 budget: first-load JS ≤ 170 KB gzip, CSS ≤ 30 KB gzip).

## What Praesto actually needs from a library

Fewer components than a library sells: button, icon button, text field, checkbox-like completion control, chips (filter + segmented), dialog/bottom sheet (native `<dialog>` is the standard — the library must not fight it), toast/banner, menu (later), date input (native), list primitives (rows are ours). Everything must wear **our** tokens (colours, depth, radius, type) — a library whose look must be "bent" pays a permanent tax on every component.

## Matrix

Scores 1–5 (5 = best for Praesto). Weights reflect the plan's order of concerns: identity fit and pin/upgrade discipline first, community second, out-of-the-box look last (our look is decided).

| Criterion (weight) | shadcn/ui on Base UI + Tailwind v4 | Mantine 9 | HeroUI 3 | Chakra UI 3 |
|---|---|---|---|---|
| Expresses ADR-0010 without fighting a house look (×3) | **5** — no look to fight; TSX + tokens are ours; depth/press physics are plain CSS on our classes | 3 — rich theme object + Styles API, but variants, input chrome and `.mantine-*` classes carry Mantine's DNA; "strongly restyled Mantine" | 3 — closest default vibe (dark, glossy) but gloss and motion must be *removed* to reach "one elevated plane"; overrides on an opinionated base | 4 — semantic tokens + recipes redefine every variant cleanly; Emotion runtime |
| Fits exact pins + yearly deliberate upgrades, minimal tooling (×3) | **4** — copy-in components never auto-update; 4–5 small pinned deps (`@base-ui/react`, `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`); adds Tailwind to the stack (owner-approved); TS 6 needs `paths` not `baseUrl` | 4 — one dep pair (`@mantine/core` + `@mantine/hooks`, versions must match) + PostCSS preset; one major/year with migration guides; requires React ≥ 19.2 (ok) | 2 — heavy peer graph (`react-aria`, `react-aria-components`, three `@react-aria/*`, Tailwind) pinned in lockstep; v3 is five months old; v2→v3 was a rewrite | 3 — `@chakra-ui/react` + `@emotion/react` (+ optional typegen step); a zero-runtime v4 rewrite looms with no date |
| Community size and cadence (×2) | **5** — 121.6k★, CLI 6.9M/wk, Base UI 8.6M/wk; weekly CLI releases, dated monthly changelog | 4 — 31.6k★, 2.1M/wk; predictable minors every 3–5 weeks; effectively one maintainer | 2 — 30.4k★, 448k/wk; monthly minors claimed; single company | 4 — 40.6k★, 1.17M/wk; monthly feature drops, slight mid-2026 slowdown |
| Bundle inside §11 (×2) | 4 — measured: Dialog +25 KB gzip, seven primitives +80 KB; Tailwind ~4 KB CSS; we need ~4 primitives → est. +45–55 KB JS | 3 — measured: Provider + Button + Modal + TextInput +36.5 KB JS **+ 38 KB CSS** (global stylesheet; per-component CSS can cut it but §11 caps CSS at 30 KB) | 3 — not measured; react-aria graph is not small; Tailwind CSS small | 3 — Emotion runtime ~+15–20 KB + components; not measured |
| Accessibility foundation (×2) | 5 — Base UI (ex-Radix/Floating UI team, APG patterns) or Radix; native `<dialog>` coexists | 4 — solid, Mantine's own a11y work | 5 — React Aria, the strongest base | 4 — Ark UI underneath |
| Works with native `<dialog>` sheets and our row primitives (×1) | 5 — we pick which primitives to copy; Dialog can be skipped in favour of native | 3 — Modal/Drawer are Mantine's; mixing native `<dialog>` is possible but two dialog systems | 3 — same, via react-aria overlays | 3 — same, via Ark |
| Agent/LLM familiarity, docs quality (×1) | 5 — most documented; caveat: CLI v4 / Base UI default flip (Jul 2026) means many blog posts are stale | 4 | 3 | 4 |
| **Weighted total (max 70)** | **65** | 50 | 41 | 50 |

## Reading

- **shadcn/ui over Base UI + Tailwind v4** wins on the two heaviest criteria because it is not a look but a set of owned components — exactly what an identity already decided in tokens needs. Its costs are real and accepted: Tailwind enters the stack (Q6 yes), updates are manual re-diffs (fits the yearly-upgrade discipline), and the surface moves fast (pin `@base-ui/react` ≥ 1.7.0, never the frozen `@base-ui-components/react`).
- **Mantine 9** is the best *dependency-style* option and the honest runner-up; its CSS budget (38 KB global) and house DNA are the tax.
- **HeroUI 3** looked closest out of the box but is the riskiest under exact pins (peer lockstep, young major) and would have its gloss removed anyway.
- **Chakra 3** is sound but carries the Emotion runtime and a looming rewrite.

## Spike plan (the decision is made on the phone, not here)

Finalists: **shadcn/ui (Base UI + Tailwind v4)** and **Mantine 9**; HeroUI is dropped on pin-discipline grounds (the matrix's lowest total and the owner's CON-006 concern), Chakra on the Emotion/v4 risk. Each spike, ≤ 1 h of plan budget, on its own throwaway branch from `main`:

1. Install pinned (`npm i -E`), wire the styling pipeline into `npm run check` (Tailwind via `@tailwindcss/vite`; Mantine via PostCSS preset).
2. Render the **capture + list screen of the layout standard** in the Arcade tokens with the library's button, field, checkbox/chip and a sheet — depth and press physics per ADR-0010.
3. Measure: `vite build` gzip sizes (JS, CSS), `npm run check`, Tier A checklist, contrast + targets in the pane at 375 px.
4. Record in `02-spike-<lib>.md`; publish both renders for the owner to compare on the phone; then ADR for decision 6.
