# A2 step 2.8 — Identity system v1

Date: 2026-08-20 · Source of truth: [ADR-0010](../../../documentation/60-decisions/ADR-0010-visual-identity-direction-arcade.md).

## Produced

- `src/app/tokens.css` — every role of the decided system as CSS custom properties (surfaces, lines, text, accent family, depth recipes, shape/hit areas, 4 px space, type rungs + families, motion bands + signature durations, focus ring), a reduced-motion override, and an empty `[data-theme="light"]` slot (plan Q1). **Not imported yet**: guidelines §3.5 keeps App.tsx on its inline scale until A5 applies the tokens; the exempt literals (`index.html`, manifest, `generate-icons.js`) move to `#161012` in A5 together.
- `public/brand/mark-brass.svg` (icon, gradient kept on the mark only), `mark-flat.svg` (amber — the only variant allowed inside the UI), `mark-mono.svg` (single colour, transparent — notification badge, themed icons). Same geometry as `favicon.svg` / `generate-icons.js`; those two are regenerated in A5.
- Voice & tone draft + microcopy table in `documentation/10-product/visual-identity.md` (pending owner approval).

## Font budget — measured (ADR-0010 escape clause)

| File (Google Fonts latin subset, WOFF2) | Bytes |
|---|---|
| Inter variable, wght 400–700 | 48 256 |
| Unbounded 800 (static) | 21 828 |
| **Total** | **70 084 ≤ 100 000** |

Also measured for the record: Unbounded 600–800 variable 50 904 (not needed); Space Grotesk 700 12 840 (not used). Consequence: guidelines §5.3 amended to "at most two self-hosted WOFF2 files, ≤ 100 KB together"; Unbounded ships and renders the wordmark and ≥ 20 px display moments as live text — no outlined wordmark SVG is needed. A5 self-hosts the equivalent subsets (OFL 1.1 for both) and re-measures.

## Guidelines checklist (Tier A) for this step

No screen changed: `tokens.css` is not imported, the brand SVGs are assets. Tier A items 1–9 are n/a for a token file; the relevant gates ran — `npm run check` (Prettier formats the CSS) and `npm test`. Tokens-only rule (§3.5): the file *is* the scale; no new literal was added to App.tsx.

## Open

- Owner approval of the voice & tone (four pairs + table) → then step 2.9 flips the identity doc to `active`.
- Light pair values (plan Q1) stay empty by decision.
