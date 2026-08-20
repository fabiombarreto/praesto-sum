# A2 step 2.1 — Audit + reference landscape

Date opened: 2026-08-20 · Status: **complete** — app-side audit + the owner's nine references (same day).

## 1. What exists today (the audit)

**The mark.** A *plumb-bob* ("fio de prumo") — a hanging pointed weight on a taut line — drawn as a vector in `favicon.svg` and rasterized by the zero-dependency `scripts/generate-icons.js` (supersampled RGBA PNGs: 192, 512, maskable-512, apple-touch-180, badge-72). Meaning: alignment, uprightness, readiness — a tool that is *always ready to serve*, which is the name ("praesto sum"). Background `#0b0b0c` everywhere the mark appears.

**Colour today.** One literal, `#0b0b0c`, repeated in `index.html` (`theme-color`), `public/manifest.webmanifest` (`theme_color`, `background_color`), `favicon.svg` and `generate-icons.js`. The app canvas itself is **unstyled white** — the splash is dark, the app is light, and the A1 checklist run flagged the mismatch (no `color-scheme`, no body background). Everything else is browser-default black-on-white with `opacity: 0.6` for muted text and `#b00020` for errors.

**Type today.** `system-ui, sans-serif`; sizes 1.5 rem (h1), 1 rem body/inputs, 0.9 rem subtitle (uppercased via CSS — now a §9.2 violation), 0.85 rem labels.

**Screens and states** (full inventory with file:line in `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md`): token gate (+ error), capture + list with "Saved"/error/loading, open rows with ○ ⋯ × glyph buttons, inline title edit, closed list (● / !), empty text, detail (title, description, 3-way date radios, priority select), `window.confirm` update prompt. All copy English; no icon set; no components folder; one inline `styles` object.

**What the identity inherits as constraints:** guidelines §2.4 (splash → first paint continuity: `background_color` = background token), §3.5 (tokens as the only scale), §5.3 (one self-hosted WOFF2 or system-ui), §6.1 (one SVG icon set), Q10 (keep the plumb-bob concept, evolve execution: recolour, maskable safe zone, wordmark ladder, monochrome variant).

## 2. Reference landscape (owner, 2026-08-20 — nine screenshots)

Received in-chat (the images live in the session; described here rather than copied — no image files were provided on disk). R4, R5 are the owner's *own* environments; R3 is a real product he uses; the rest are concept UI he admires.

| # | Reference | Borrow | Avoid | Density | Tone |
|---|---|---|---|---|---|
| R1 | Neumorphic file manager concept (lavender/navy split, extruded tiles, colourful glyph icons) | soft tactile controls; rounded tiles; small colour pops on icons | low-contrast embossing; skeuomorph overload; light theme | mid | playful |
| R2 | Dark smart-garden concept (glowing glass widget on deep blue-charcoal) | glow reserved for the one live thing; one hero element per screen | illegible micro-text; decorative 3D that informs nothing | sparse | mid |
| R3 | **Epic Games Store, real, pt-BR** | editorial restraint; type hierarchy; breathing room; dark as neutral canvas | its sobriety alone would fail "não é sério" — fun must be injected | sparse | serious |
| R4 | **Steam library — the owner's own**, with his categories (COOP, ROGUELIKE, RPG, SANDBOX…) | the pride of *owning one's library* — self-made categories (a Life Areas echo); status colour per state | the density itself (named anti-pattern); tiny targets; heavy chrome | dense | mid |
| R5 | **Discord — the owner's own server** | colour as meaning (role colours); flat readable dark surfaces; community warmth | three-column density; notification noise | dense | mid-playful |
| R6 | Ride/delivery concept (vivid orange blocks on black, chunky photo tiles) | ONE hot accent doing all the work; chunky rounded targets | accent used as background everywhere (accent inflation); photo-heavy tiles | mid | playful |
| R7 | Taxi app dark kit (charcoal + vivid yellow, systematic screens, emoji feedback) | kit-level consistency; accent-on-dark discipline; playful feedback *moments* | emoji as UI (guidelines §6); yellow ubiquity | mid | playful |
| R8 | "NOVA" discipline app (AMOLED black + gold glow, levels, warrior art, grind quotes) | premium glow; progress as instrument; focus dashboards | gamification mechanics (Q3: out); grind-drama (fails lúdico 17); art-heavy screens | mid | serious-dramatic |
| R9 | Surrealist dark UI kit styleguide (copper on graphite, tokens laid out as a page) | the styleguide page itself (= our `/design` playground); soft depth done systematically; visible radius scale | surreal decoration; metallic gradients (§4.2) | mid | playful-odd |

**Two-axis map vs the target** (target from step 2.2: esparso 35, lúdico 17): nearest neighbours are R2's sparseness, R6/R7's playfulness and R3's restraint — the identity lives in that triangle. R4 (dense) and R8 (dramatic) sit farthest and are borrowed only in spirit (ownership; instrument).

**The strongest signal the scouting did not predict: warm accents.** Six of nine references carry a warm saturated accent (orange, yellow, gold, copper) on a dark base; only R5 is cool (blurple). All three scouted token directions were cool (blurple / Steam blue / Epic cyan) — the directions for step 2.6 are re-weighted: at least two of the three must explore a **warm accent on graphite**, and the cool one earns its place only as contrast. Supporting fact: the existing plumb-bob mark is already **brass-gold on near-black** (`public/favicon.svg`, gradient `#f2d08a → #b57f23`) — the mark had the answer before the exercise.

## 3. Attribute session (step 2.2)

Run as a guided in-chat session on 2026-08-20 (card sort of 40 adjectives → IS / WOULD LIKE TO BE / IS NOT, ≤ 3 each; 8 semantic-differential sliders for the *target* — "today" is not marked because today's app is deliberately unstyled and would sit at neutral on every axis). Results and reading in `02-attributes.md` (submitted the same day).
