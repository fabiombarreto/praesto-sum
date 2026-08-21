# UI/UX guidelines (pointer)

> Derived from `documentation/40-engineering/ui-ux-guidelines.md` (authoritative — written 2026-08-19 by the UI/UX plan, activity A1). On any conflict, `documentation/` wins. This file only routes agents there; it does not restate the rules.

## When it applies

Any change under `src/app/`, `index.html`, `public/manifest.webmanifest` or `src/sw.ts` — including one-line ones. It is NOT waived by the Decision Gate scope exemptions; a single-component CSS tweak still runs the checklist.

## What to do

1. Read `documentation/40-engineering/ui-ux-guidelines.md` before planning or coding the change (Always/Never are non-negotiable; Prefer/Avoid ask for judgement; a TBD is a gap owned by a named UI/UX-plan activity — never improvise around it).
2. Apply the owner decisions it encodes: visible copy in **pt-BR** (ADR-0009; code, identifiers and tests stay English), **dark-only** theme with tokens as light/dark pairs, **WCAG 2.2 Level A** as the formal bar with **≥ 48 px touch targets** and **prefers-reduced-motion** as rules, no gamification mechanics, gamer-app ambience but never their density, no external fonts/icons/scripts.
3. Run the document's **Review checklist** (10 binary items, 60–90 s) and paste the ✔/✘ result — one line per ✘ — in the PR body or the plan/phase record. One ✘ without a recorded conscious exception means the change is not done.
4. Verify visually in the browser pane at 375 px wide in dark mode (and on the Android phone for shipped changes); file screenshots under `PRPs/reports/`. If the pane cannot display, say so and measure the DOM — never claim a screenshot you did not take.

## Related

- The visual identity (ADR-0010, tokens, voice & tone, approved microcopy): `documentation/10-product/visual-identity.md` · machine truth `src/app/tokens.css`

- The plan that produced it and tracks its open TBDs (design principles, tokens, layout standard, UI library): `documentation/50-planning/ui-ux-plan.md`
- Copy language decision: `documentation/60-decisions/ADR-0009-ui-copy-in-brazilian-portuguese.md`
- UI verification stays manual: `documentation/40-engineering/testing-strategy.md`
- First checklist run with real findings (A1 exit signal): `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md`
