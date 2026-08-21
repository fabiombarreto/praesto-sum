---
status: accepted
last_updated: 2026-08-20
review_trigger: "a new decision touches the same topic"
---

# ADR-0010: Visual identity — direction A "Arcade": warm brown-black graphite, amber accent, tactile depth, Inter with an Unbounded wordmark

> **Purpose:** Record the resolution of pending decision 5 — who Praesto is visually — its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-20
- **Related:** [ADR-0009](ADR-0009-ui-copy-in-brazilian-portuguese.md); [UI/UX plan](../50-planning/ui-ux-plan.md) activity A2 (Q1, Q2, Q3, Q10, Q12); [UI/UX guidelines](../40-engineering/ui-ux-guidelines.md) §1, §4, §5, §7; [visual identity](../10-product/visual-identity.md); vision principles 1, 5, 6

## Context

The app had no visual foundation (UI/UX plan, 2026-08-18). Activity A2 ran a designer's step-by-step: audit and nine owner references (six of nine carry a **warm accent on dark**; the existing plumb-bob mark was already brass-gold), an attribute session (**É** moderno · ágil · nerd; **quer ser** minimalista · gamer · enérgico; **não é** sombrio · sério · corporativo; sliders lúdico 17, esparso 35, engenheirado 78, gamer 8), five approved design principles, a moodboard whose veto fixed warm primaries (âmbar / dourado-prumo), cut the cool blurple, ranked Space Grotesk › Unbounded › Inter and adopted **tactile / simulated-3D depth** as a trait the owner explicitly likes. Three directions were rendered on the real capture + list screen, critiqued adversarially (compliance with computed contrast; design distinctness and swap test), rebuilt and measured live at 375 px (`PRPs/reports/visual-identity/01…04`). The owner chose on 2026-08-20: *"Definitivamente A — Arcade. Gostei das formas levemente mais arredondadas, do destaque para os efeitos de botões 3D e dos contrastes das cores."* Nothing was asked from B or C.

## Decision

We will adopt **direction A — Arcade** as Praesto's visual identity, v1:

- **Surfaces — a warm brown-black ladder, never pure black:** `bg #161012 · s1 #1f1816 · s2 #2a211e · s3 #352a25`; hairline `rgba(255,255,255,.09)`, strong line (input boundaries) `rgba(255,255,255,.35)`. Text `ink #f2f2f4 · muted #a0a0a8 · faint #86868f`. Dark-only ships (plan Q1); every role is declared as a token with a light value to be filled later, not a rewrite.
- **Accent — one hot family:** primary `âmbar #f5a524` with its lower face `#b8751a` and text-on-accent `#1a1206`; `laranja-quente #ff5c1f` is reserved for what is **live** (a Reminder firing) and for **overdue** — one temperature across the palette. No cool accent exists. Success is the accent; failure stays the overdue hue.
- **Depth — tactile, with physics, in service of affordance (this amends guidelines §4.2):** elevation on dark is a *lighter surface plus a 1 px top highlight*, never a black shadow on black; **one elevated plane per screen** — the capture deck (capture is the hero); primary controls carry a **3 px lower face** (`0 3px 0 accent-deep`) and **sink 3 px on press**; list rows are lifted surfaces (s2, top highlight, a tight 1–2 px shadow); relief appears only on controls, the deck and the field — **never on text, never on static panels**; gradients are allowed on the mark only. Contrast is measured after every relief change (§4.3).
- **Shape:** radius 18 px cards · 14 px controls · pill chips; 48 px hit areas, 64 px rows, 56 px capture field.
- **Type:** **Inter** (variable, self-hosted, subset) carries body, headings (600) and all numerals (tabular); **Unbounded 800** is the voice of the **wordmark** (lowercase `praesto`) and of ≥ 20 px display moments such as the day's count; data (dates, times, counts in rows) in a system monospace stack with `tabular-nums`. Budget rule: Inter is the one shipped font file under guidelines §5.3; the wordmark ships as SVG outlines. Step 2.8 **measures** an Unbounded latin subset — if Inter + Unbounded stay ≤ 100 KB together, §5.3 is amended to "≤ 2 files, ≤ 100 KB total" and Unbounded also renders the count; otherwise Inter 800 renders it.
- **Scale:** 4 px spacing (`4 · 8 · 12 · 16 · 24 · 32`); five type rungs `12 · 14 · 16 · 20 · 28 px`. These become `src/app/tokens.css` in step 2.8 (machine truth) and the only scale any component may use (§3.5).
- **Motion:** the guidelines' bands; the **signature completion moment** — the check sinks 2 px and fires a single amber ring (~400 ms), then settles; a firing Reminder pulses three times and rests on a static glow; `prefers-reduced-motion` shortens, never removes, feedback.
- **Mark:** the plumb-bob stays (plan Q10), brass gradient retained on the icon, a flat amber variant for monochrome/badge uses, maskable safe zone respected; wordmark `praesto` in Unbounded 800 lowercase; responsive ladder full lockup → wordmark → mark → favicon (step 2.8).
- **Voice:** nerd inside, light outside — per guidelines §9; the one-page voice & tone is written in step 2.8 for the owner's approval.

Swap test on record: A's nearest neighbours are a Web3 landing (Unbounded is Polkadot's brand face) crossed with Duolingo-style tactile buttons; what breaks the resemblance and must stay — the mono data column, the plumb mark, and exactly **one** extruded plane per screen.

## Alternatives considered

- **B — Oficina (ruled instrument, dourado-prumo only, hairline rows, plumb rule)** — rejected by the owner; the most literal reading of "engenheirado 78", but too quiet for "quer ser enérgico", and its gold-on-graphite neighbours the "premium discipline app" look the reference audit flagged.
- **C — Grafite (flat control: surface ladder, sparse amber)** — rejected; it proved the point it existed for: without relief the dark reads sober, and the owner's attributes veto "sério".
- **A cool accent (Discord blurple) or a cool-tinted graphite (Steam, Epic cyan)** — cut at the moodboard veto; six of nine references and the brass mark pointed warm.
- **Full neumorphism** (the soft-embossed style of references R1/R9) — rejected: it fails contrast by construction and is the most trend-bound option; only its *tactility* was kept, as controls with physics.
- **Pure flat / no depth at all** — rejected: contradicts the owner's explicit wish for 3D-like elements and principle 2 ("lively dark over sober dark").

## Consequences

- Positive: the identity is decided from rendered candidates on the real screen, with measured contrast (every pair above target, zero sub-48 px targets) and a recorded swap test; tokens, depth, shape, type and motion are specified tightly enough for step 2.8 to write `tokens.css` and for A4/A5 to implement rather than reinterpret; the warm system reconciles the owner's references with the mark that already existed.
- Negative / accepted trade-offs:
  - Relief is CSS that must be maintained with discipline: one elevated plane, physics on press, contrast re-measured on every token change — guidelines §4.2 is amended from "avoid shadows" to this precise rule.
  - Two type families are wanted (Inter + Unbounded) against a one-file budget; resolved by measurement in 2.8, with the wordmark as SVG either way.
  - A warm brown-black ladder is unusual against the Epic-neutral greys of the scouting; manifest `theme_color` / `background_color`, `index.html` critical CSS and `scripts/generate-icons.js` must all move to `#161012` together (§2.4, §3.5).
  - Unbounded's wide display voice is easy to overuse; it is restricted to ≥ 20 px, wordmark and count — a guideline, enforced in review.
