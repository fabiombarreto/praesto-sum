# A3 — Q4 sketches and measurements

Date: 2026-08-20 · File: `sketches.html` (published as a private artifact). Both navigation models on the same Today screen in the Arcade tokens (ADR-0010), plus the detail sheet, the offline, empty, completed-with-undo and keyboard-open states, and the ≥ 840 px list-detail desktop frame. Research: `01-research-evidence.md`; standard: `documentation/40-engineering/ui-layout-standard.md` (draft until Q4 is answered).

## Live measurements (browser pane, 375 × 812, local static server; both models)

| Pair | Ratio | Target |
|---|---|---|
| overdue date on row | 5.10 | 4.5 |
| group count on bg · header "restantes" on bg | 7.24 | 4.5 |
| group action ("Reagendar para hoje") on bg | 9.21 | 4.5 |
| agenda text / time on bg | 7.24 / 16.82 | 4.5 |
| agenda dashed border on bg | 3.22 | 3 |
| filter badge text on badge | 9.08 | 4.5 |
| offline banner text / icon on banner | 15.65 / 5.67 | 4.5 / 3 |
| offline banner border on bg | 3.89 (was 2.36 at .5 alpha → .75) | 3 |
| nav label off (model A) | 4.85 | 4.5 |

Hit areas: icon buttons, chips, checks, submit, nav items all ≥ 48 px; the group action button was 40 px → fixed to 48 px (136 × 48 measured); rows 64 px; group headers 40 px (non-interactive text + a 48 px action). Fonts loaded: Inter 400/500/600, JetBrains Mono 400/600, Unbounded 800. No screenshot (pane not displayable) — DOM-measured, per guidelines §12.6.

## Guidelines checklist, Tier A (sketch page as a UI specimen)

1 one primary action ✔ (the deck) · 2 targets ✔ after the fix · 3 colour not alone ✔ (overdue carries the word, agenda has glyph + dashed outline, filters badge is numeric) · 4 copy ✔ pt-BR, sentence case, infinitive buttons, Intl dates, `2 d` not needed here · 5 keyboard ✔ focus-visible ring, buttons are buttons · 6 labels ✔ `aria-label` on icon-only controls, `<h1>` per screen · 7 tokens ✔ (the Arcade set) · 8 destructive ✔ (*Excluir* is secondary; confirmation per §8) · 9 external requests: Google Fonts only (allowed on artifacts).

## Decision requested

Q4 — model A (bottom bar) or B (single screen + sheets). Recommendation B with the binding flip rule recorded in the standard §1.
