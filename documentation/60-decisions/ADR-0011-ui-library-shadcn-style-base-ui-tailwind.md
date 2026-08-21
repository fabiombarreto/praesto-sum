---
status: accepted
last_updated: 2026-08-21
review_trigger: "a new decision touches the same topic"
---

# ADR-0011: UI library — shadcn-style owned components over Base UI primitives and Tailwind CSS v4

> **Purpose:** Record the resolution of pending decision 6 — the one UI library that becomes Praesto's standard, and the styling pipeline it brings — its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-21
- **Related:** [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md) (exact pins, minimal tooling), [ADR-0010](ADR-0010-visual-identity-direction-arcade.md) (what the library must express), [UI/UX plan](../50-planning/ui-ux-plan.md) activity A4 (Q6), [guidelines](../40-engineering/ui-ux-guidelines.md) §3.5, §11, §12, [layout standard](../40-engineering/ui-layout-standard.md); CON-002/006, QA-002/004

## Context

The owner asked for one consolidated, actively maintained, large-community UI library to be the standard (plan brief, 2026-08-18) and accepted Tailwind entering the stack (Q6). The identity was decided first (ADR-0010: tokens in `src/app/tokens.css`, tactile depth with press physics, one elevated plane, radius 18/14/pill, Inter + Unbounded) so that the library would be chosen *for* it. A4 ran a weighted matrix over the verified scouting of 2026-08-18 (`PRPs/reports/ui-library/01-evaluation-matrix.md`: shadcn/ui on Base UI + Tailwind v4 65/70; Mantine 9 and Chakra UI 3 50; HeroUI 3 41) and two spikes on throwaway branches, each rendering the layout standard's Today screen in the Arcade tokens, measured in production builds and judged by the owner on the phone. shadcn-style: JS 102.7 KB gzip, CSS 5.5 KB, seven small pinned packages, every identity rule expressed directly, `tokens.css` left as the single source. Mantine 9: JS 107.0 KB, CSS 11.3 KB only after per-component imports (35.3 KB with the global sheet, over the §11 budget), six packages plus a PostCSS preset, two silent setup traps, and `styles` overrides wherever the identity diverged from the house look. The owner chose on 2026-08-21: *"Vamos de shadcn."*

## Decision

We will build Praesto's interface from **components we own, written in the shadcn/ui style, over Base UI primitives, styled with Tailwind CSS v4**:

- **Dependencies, exact-pinned (ADR-0005):** runtime `@base-ui/react 1.7.0` (the `@base-ui/react` package — never the frozen `@base-ui-components/react`), `class-variance-authority 0.7.1`, `clsx 2.1.1`, `tailwind-merge 3.6.0`, `lucide-react 1.33.0` (the one icon set, guidelines §6); dev `tailwindcss 4.3.3`, `@tailwindcss/vite 4.3.3`. No PostCSS config, no ESLint or Prettier plugin.
- **Pipeline:** `tailwindcss()` in `vite.config.ts`; `src/app/styles.css` = `@import "tailwindcss"` + `@import "./tokens.css"` + one `@theme inline reference` block that maps every token into Tailwind's namespaces. **Tailwind reads the tokens and emits no variables of its own** — `tokens.css` remains the single source of values (guidelines §3.5). `npm run check` covers it unchanged (Prettier formats the CSS; `tsc -b` and ESLint see the TSX).
- **Components:** live under `src/app/components/ui/`, one file per component, `PascalCase` exports, `cva` for variants, `cn()` (`clsx` + `tailwind-merge`) for class composition, Base UI data attributes (`data-checked`, `data-pressed`, `data-starting-style`…) as the styling hooks. They are **ours**: copied or hand-written, never auto-updated. The shadcn registry and CLI are a *reference and an optional generator*, never the theme: **`shadcn init` is not run** (its generated theme would compete with `tokens.css`); a component pulled with `shadcn add` is adapted to the tokens before it is committed.
- **Native first where the platform already delivers the behaviour:** the layout standard's sheets stay native `<dialog>` (Android back = close request) unless Base UI `Dialog` is verified on the device to honour close requests; form inputs are native elements styled with the tokens.
- **Upgrades:** yearly and deliberate (ADR-0005) — bump the seven pins with the changelogs open, then re-diff any component against the registry only if a behaviour fix is wanted. Tailwind majors are absorbed the same way.

## Alternatives considered

- **Mantine 9** — rejected by the owner after the spike; the honest runner-up: one provider and batteries included, but the house DNA taxed every identity rule (overrides for 48 px chips and checkbox ring, autoContrast picking pure black instead of the token, depth only via a parallel CSS Module), the global stylesheet broke the CSS budget, and per-component imports hid two silent setup traps.
- **HeroUI 3** — dropped at the matrix: the closest default vibe, but a young major with a heavy `react-aria` peer graph pinned in lockstep — the riskiest under yearly deliberate upgrades.
- **Chakra UI 3** — dropped at the matrix: sound token/recipe model, but an Emotion runtime and a zero-runtime v4 rewrite with no date.
- **MUI, Ant Design** — opposite of the brief (Material / enterprise DNA); **Radix Themes** near-stagnant; **daisyUI** CSS-only (no behaviour/a11y); **Ark UI alone** headless (we would author the whole system without the shadcn ecosystem).
- **No library — hand-written CSS over the tokens** — rejected: accessible primitives (focus management, keyboard, roving focus, dialogs) are exactly the part one maintainer should not rewrite; Base UI supplies them as behaviour only.

## Consequences

- Positive: the library *is* the identity's component layer — nothing to bend; the smallest measured footprint of the candidates (JS 102.7 KB, CSS 5.5 KB gzip, both inside §11); the largest community and documentation of the field (121.6k★, CLI 6.9M/wk, Base UI 8.6M/wk — verified 2026-08-18); pin discipline is natural because components never auto-update; Base UI's a11y (ex-Radix/Floating UI team) underneath.
- Negative / accepted trade-offs:
  - Tailwind v4 becomes a build-time dependency of every component and a second vocabulary to read (long class lists — `cva` and review discipline keep them legible).
  - Bugs in copied components are ours to fix; upgrades are manual re-diffs.
  - The surface moves fast (CLI v4 in Mar 2026, Base UI default flip in Jul 2026): most blog posts are stale — the registry source and Base UI docs are the references.
  - TypeScript 6 rejects the `baseUrl` the shadcn Vite guide still adds — we use relative imports (no alias), so the guide is not followed literally.
  - `@theme inline reference` is a pattern the owner must remember; it is documented in `styles.css` and guidelines §3.5.
