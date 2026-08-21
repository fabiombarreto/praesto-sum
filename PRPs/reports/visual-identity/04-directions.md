# A2 step 2.6 — Three rendered directions

Date: 2026-08-20 · File: `directions.html` (one page, the same capture + list screen re-skinned live by `html[data-dir]`; published as a private artifact for the owner's on-device choice). Plan amendment: the three directions share one file with a switcher instead of `direction-a/b/c.html` — same content in all three makes the comparison honest and the switch costs one tap on the phone.

## The three treatments (after the adversarial critique — see below)

| | A · Arcade (extruded) | B · Oficina (ruled) | C · Grafite (layered) |
|---|---|---|---|
| Base | warm brown-black `#161012 / #1f1816 / #2a211e / #352a25` | neutral graphite `#101014 / #18181c / #202024 / #28282c` (Epic-verified) | same as B |
| Accent | âmbar `#f5a524`, deep face `#b8751a`; **laranja-quente `#ff5c1f`** for live state *and* overdue (one temperature) | dourado-prumo `#d9a642` and nothing else; overdue is the only exception (text) | âmbar `#f5a524` in three places only |
| Display / heading / body / data | Unbounded 800 (≥ 20 px only) / Inter 600 / Inter / JetBrains Mono | Space Grotesk 700 / Space Grotesk / Inter / JetBrains Mono | same as B |
| Structure | rows as lifted surfaces (s2 + top highlight + tight shadow); the capture deck is the one elevated plane | **no boxes**: hairline-ruled rows on the bg; a 3 px gold "plumb rule" on the done row; right-aligned tabular mono data column | flat surface ladder + hairline (control) |
| Depth (owner's 3D trait) | button with a real 3 px lower face that sinks 3 px on press; inset field | top highlight on buttons and deck only | none |
| Radius card / control | 18 / 14 | 12 / 10 | 10 / 8 |
| Completion signature | check sinks 2 px + one amber ring burst | a gold line "drops plumb" down the row edge | row tints to s2, count flips |

Shared system (visible in the stylescape): 4 px spacing scale (`--sp1…--sp8`), five type rungs 12 / 14 / 16 / 20 / 28 px, tabular numerals on all data, 64 px rows, 56 px capture field with an icon-only 48 px submit, toast-style live Reminder docked above the deck (pulse runs 3 × 1.2 s then rests on a static glow; off under reduced motion), two-tone focus ring, `<nav>` with `aria-current` + a 2 px indicator (not colour alone), filter chips as `aria-pressed` buttons with a check icon, pt-BR copy per guidelines §9 (NBSP before units, curved quotes, "Configurações").

## Adversarial critique (two lenses) and what changed

Compliance lens (contrast computed exactly; every rule the page could break): 1 blocking — the live pulse looped forever (2.2.2 / principle 3) → now 3 iterations; should-fix — no viewport/lang/color-scheme in the raw file, three font families per direction vs §5.3's one self-hosted WOFF2 (now declared *provisional* on the page; the ADR decides one variable family + system mono or amends §5.3), `--faint` nav labels at 3.6:1 → `#86868f` (4.9:1), nav/chip on-state by colour alone → indicator + weight + `aria-current`/`aria-pressed`, chips 34 px → 48 px, no focus ring → two-tone ring + specimen, no type/spacing scale → tokens, A's row shadow larger than the button's, hard-coded amber halos leaking into B → `--accent-rgb` tokens, invisible field boundary → `--line-strong` (3.2:1); nits: NBSP, SVG check instead of a text glyph, `aria-hidden` on decorative SVGs, reduced-motion shortens rather than removes, date/labels, 12 px floor, disabled opacity, badge border.

Design lens: **B and C were one direction with a swatch swap** → B rebuilt as the ruled instrument (no boxes, hairlines, plumb rule, data column, gold only); "engenheirado 78" was invisible → spacing grid + type rungs shown; the completion moment was generic → a signature per direction; A's card relief was black-on-black gloom → elevation as lighter surface, one big shadow for the deck only; A's press physics wrong (3 px extrusion, 1 px sink) → 3 px lower face, 3 px sink; A's "warm graphite" imperceptible (2 RGB units) → real brown-black; A's second colour indistinguishable → `#ff5c1f`; Unbounded at 15 px → ≥ 20 px only; live chip misplaced → toast above the deck; capture deck least designed → eyebrow label, dominant field, inset in A; swap tests were straw men → rewritten naming the real nearest neighbour and what breaks it (A: Web3 landing × Duolingo buttons; B: gold "premium" discipline apps; C: the Tailwind zinc + amber starter).

## Live measurements after revision (Tier B, 2026-08-20, browser pane at 375 × 812, local static server)

| Pair | A | B | C | Target |
|---|---|---|---|---|
| ink on row | 14.07 | 16.98 | 15.83 | 4.5 |
| muted on row | 6.06 | 7.31 | 6.82 | 4.5 |
| empty-check ring on row | 4.36 | 5.26 | 4.91 | 3 |
| accent on bg · focus ring on bg | 9.21 | 8.57 | 9.30 | 3 |
| on-accent text on accent | 9.08 | 8.56 | 9.15 | 4.5 |
| overdue text on row | 5.10 | 6.84 | 6.38 | 4.5 |
| overdue badge border on row | 3.44 | 4.27 | 4.08 | 3 |
| nav label off / on | 4.85 / 8.57 | 4.91 / 7.99 | 4.91 / 8.67 | 4.5 |
| placeholder on field · field border on deck | 6.74 · 3.18 | 6.82 · 3.19 | 6.82 · 3.23 | 4.5 · 3 |
| toast text on toast | 14.07 | 14.52 | 14.52 | 4.5 |

Hit areas: zero elements under 48 × 48 px among checks, buttons, chips, nav items, the icon submit and the switcher, in all three directions; rows 64–66 px; field 56 px. Fonts loaded: Inter 400/500/600, JetBrains Mono 400/600, Space Grotesk 700, Unbounded 800. `lang="pt-BR"`, viewport and `color-scheme: dark` present. No screenshot (pane not displayable) — DOM-measured, stated per §12.6.

## Status

Published for the owner's on-device choice (step 2.7): daylight, night, PC; answer = the winner plus what to carry from the others; the ADR for decision 5 follows.
