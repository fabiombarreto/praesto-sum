---
status: draft
last_updated: 2026-08-20
review_trigger: "a step of UI/UX-plan activity A2 lands, an identity element (mark, tokens, voice) changes, or decision 5 is accepted"
---

# Visual Identity

> **Purpose:** Who Praesto is visually — name, attributes, brief, mark, tokens and voice — the single identity reference the guidelines, the layout standard and every screen implement.
> **Update when:** An A2 step of the [UI/UX plan](../50-planning/ui-ux-plan.md) lands its deliverable here, or an identity element changes after the plan closes (with an ADR when the change is non-obvious). Machine truth for token values: `src/app/tokens.css` (once A2 step 2.8 creates it) — this document explains, that file defines.

## Name and meaning

**Praesto Sum** — Latin, "I am at hand / at your service" ([ADR-0002](../60-decisions/ADR-0002-name-the-project-praesto-sum.md)); *praestō*: classical [ˈprae̯s.toː], ecclesiastical [ˈprɛs.to]. Short form **praesto** (repository, future CLI). Casing of the wordmark and the responsive ladder (full lockup → wordmark → mark → favicon): TBD — decided in step 2.8.

## Brief (step 2.3)

- **Purpose.** One assistant, built and owned by its single user, that organizes the whole of his personal life — starting from Tasks and Calendar — with capture and retrieval at near-zero friction ([vision](vision.md)).
- **Who / what / why it matters (Neumeier).** *Who:* Praesto, the owner's own assistant — "estou às ordens". *What:* keeps, organizes and mirrors his commitments honestly. *Why it matters:* the owner forgets things and loses notes; existing tools store but do not serve.
- **User and context.** Exactly one user — the owner-developer; Android phone (installed PWA, one thumb, sunlight and night) and Windows PC; daily, several times a day; pt-BR on screen (ADR-0009).
- **Personality.** The attribute sheet below; in one line: **a precise instrument with a gamer soul** — dark, but alive; playful, but exact; nerd, but light.
- **Product-principle consequences.** Few elements per screen is a rule; capture is the hero; "fun" never hides a miss (honest mirror); one token set one library one pipeline; the owner's references are the brief ([plan](../50-planning/ui-ux-plan.md#what-the-product-principles-demand-of-the-design)).
- **References — what to borrow / reject.** Nine references received 2026-08-20 (full table: `PRPs/reports/visual-identity/01-audit-and-landscape.md`). Digest: **borrow** — one vivid warm accent doing all the work on a graphite base (his orange/yellow/gold/copper concepts), chunky rounded targets, soft tactile depth used sparingly, glow reserved for what is live, playful feedback moments, systematic token discipline, Epic's editorial restraint, Discord's colour-as-meaning; **reject** — Steam's density (kept only its sense of *owning one's library*), grind-drama seriousness, low-contrast embossing, metallic gradients, accent inflation, emoji as UI. Strongest single signal: the references lean **warm accents on dark** — and the existing plumb-bob is already brass-gold on near-black; the mark had the answer first.

## Attributes (step 2.2 — owner, 2026-08-20)

| | |
|---|---|
| **É** | moderno · ágil · nerd |
| **Quer ser** | minimalista · gamer · enérgico |
| **Não é** (the veto list) | sombrio · sério · corporativo |
| Strong slider positions | lúdico 17 · esparso 35 · engenheirado 78 · gamer 8 |
| Deliberately neutral axes | calmo–enérgico · frio–quente · discreto–expressivo · atemporal–tendência |

Two recorded tensions every later choice respects: **(1) dark, never somber** — dark-only theme (plan Q1) with a *lively* dark: near-black base, one saturated accent, warm feedback, never gloomy; **(2) energy in moments** — feedback is where the interface wakes up; at rest it is quiet. And one fit: **engineered 78 meets the mark** — the plumb-bob is a precision instrument; alignment and exact spacing are identity. Full session record: `PRPs/reports/visual-identity/02-attributes.md`.

## Design principles (step 2.4)

Approved by the owner on 2026-08-20 and recorded at the top of the [UI/UX guidelines](../40-engineering/ui-ux-guidelines.md#1-design-principles): **precise over decorated · lively dark over sober dark · energy in moments over constant energy · fewer elements over more visible features · nerd inside, light outside.**

## Mark (step 2.8)

Decision Q10 (owner, 2026-08-18) and [ADR-0010](../60-decisions/ADR-0010-visual-identity-direction-arcade.md): **the plumb-bob stays** — brass gradient kept on the icon, a flat amber variant for monochrome/badge uses, maskable safe zone respected; wordmark `praesto` in Unbounded 800 lowercase, shipped as SVG; responsive ladder full lockup → wordmark → mark → favicon. Files: TBD — produced in step 2.8.

## Palette, typography, depth, shape, motion — the decided system (ADR-0010, 2026-08-20)

**Direction A — Arcade**, chosen by the owner from three rendered directions (`PRPs/reports/visual-identity/04-directions.md`). Machine truth lands in `src/app/tokens.css` (step 2.8); this is the human summary:

| Role | Value |
|---|---|
| Surfaces | `bg #161012` · `s1 #1f1816` · `s2 #2a211e` · `s3 #352a25` — warm brown-black, never pure black |
| Lines | hairline `rgba(255,255,255,.09)` · strong (input boundary) `rgba(255,255,255,.35)` |
| Text | `ink #f2f2f4` · `muted #a0a0a8` · `faint #86868f` |
| Accent | `âmbar #f5a524` · lower face `#b8751a` · on-accent `#1a1206` |
| Live / overdue | `#ff5c1f` — only for a Reminder firing and for overdue; no cool accent exists |
| Depth | elevation = lighter surface + 1 px top highlight; one elevated plane per screen (the capture deck); primary controls: 3 px lower face, sink 3 px on press; relief never on text or static panels; gradients only on the mark |
| Shape | radius 18 (cards) · 14 (controls) · pill (chips); 48 px hit areas; 64 px rows; 56 px capture field |
| Type | Inter variable (body, headings 600, tabular numerals); Unbounded 800 for the wordmark and ≥ 20 px display moments; data in a system mono stack |
| Scale | spacing 4 · 8 · 12 · 16 · 24 · 32 px; type 12 · 14 · 16 · 20 · 28 px |
| Motion | guidelines bands; signature completion: check sinks 2 px + one amber ring (~400 ms); a firing Reminder pulses 3× then rests on a static glow; reduced motion shortens, never removes |

Light-theme values: TBD — pending owner input (plan Q1: tokens are declared as pairs; the light side is filled when real use asks for it).

## Voice and tone (step 2.8)

TBD — one page in "X, mas não Y" form plus the state-microcopy table, written in pt-BR (ADR-0009); the copy *mechanics* already bind via [guidelines §9](../40-engineering/ui-ux-guidelines.md#9-copy-and-voice-pt-br--adr-0009).

## Validation (step 2.10)

TBD — after A5 ships: a week of cold opens on the phone against the three É words; deviations logged and fixed at token level; first revisit scheduled in the roadmap.

## History

| Date | What changed |
|---|---|
| 2026-08-20 | **Direction A "Arcade" chosen by the owner → [ADR-0010](../60-decisions/ADR-0010-visual-identity-direction-arcade.md) accepted, decision 5 closed**; the decided system recorded above; mark decision settled |
| 2026-08-20 | Three rendered directions (A Arcade extruded · B Oficina ruled · C Grafite layered) critiqued, revised, measured and published for the owner's choice (`PRPs/reports/visual-identity/04-directions.md`) |
| 2026-08-20 | Moodboard veto recorded: warm primaries (âmbar / dourado-prumo), laranja secondary at most, blurple cut; type ranked Space Grotesk › Unbounded › Inter › Geist; tactile/3D depth adopted as a trait |
| 2026-08-20 | References received and digested (warm-accent signal named); design principles approved and recorded in the guidelines; moodboard (step 2.5) published for the owner's veto pass |
| 2026-08-20 | Document opened (draft) with name, brief (minus references) and the owner's attribute sheet; everything else explicitly TBD, owned by A2 steps |
