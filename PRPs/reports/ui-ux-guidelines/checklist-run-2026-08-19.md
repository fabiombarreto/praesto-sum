# UI/UX guidelines — first checklist run (A1 exit signal)

Date: 2026-08-19 · Document: `documentation/40-engineering/ui-ux-guidelines.md` (review checklist) · Reviewer: agent, with the owner's decisions of 2026-08-18 applied.

## What was reviewed and how

- **Token gate** (`src/app/App.tsx` `TokenGate`), measured **live** on `npm run dev` in the browser pane at 375×812 with `prefers-color-scheme: dark` emulated, via DOM/computed styles (`getBoundingClientRect`, `getComputedStyle`). The pane was not displayed, so no screenshot exists — measurements only, as rule 12.6 requires us to say.
- **Capture + list ("board")** (`TaskBoard`, `InlineTitle`) and the **detail** screen (`TaskDetail`), reviewed from code: they share the same `styles` object (`styles.input`, `styles.button`, `styles.link`), so the live numbers transfer; the token was deliberately not entered by the agent.

## Measurements (token gate, live)

| What | Value | Rule |
|---|---|---|
| `<html lang>` | `pt-BR` | §10 3.1.1 ✔ — but every visible string is English (ADR-0009) |
| viewport meta | `width=device-width, initial-scale=1, viewport-fit=cover` | §2.3 ✔ (no `interactive-widget` choice yet — layout standard pending) |
| `theme-color` meta / manifest | `#0b0b0c` | — |
| `color-scheme` meta / `:root` | **absent** / `normal` | §2.4 ✘ |
| body background / colour | `transparent` (white canvas) / black, with dark preferred | §2.4 ✘ — splash `#0b0b0c` → white page: flash and mismatched status bar |
| `overscroll-behavior-y` on html/body | `auto` / `auto` | §2.5 ✘ |
| input height / button height | 41 px / 41 px (72 px wide) | §3.3 ✘ (< 48 px) |
| gap input ↔ button | 8 px | §3.3 ✔ |
| `enterkeyhint` / `inputmode` on the token field | none | §12.5 (n/a for a password field) |
| muted paragraph | `opacity: 0.6` on black-on-white ≈ 5.7:1 | §4.3 reported ✔ (light canvas, not the intended dark one) |
| buttons without accessible name | 0 | §6.2 ✔ |
| focus ring on programmatic focus | `outline: none` reported; keyboard `:focus-visible` not observable without a real key press | §4.5 — inconclusive, re-check on device |
| main column | `max-width: 34rem`, padding `24px 16px 64px` | §2.7 ✔ |

Board/list from code: the row actions ○ ⋯ × use `styles.link` — `padding: 0`, `font-size: 1.1rem`, `line-height: 1` → a **~18 × 18 px** hit area (§3.3 ✘, the worst offender); the capture field has unconditional `autoFocus` (§12.5 ✔ — this *is* the deliberate capture surface) but no `enterkeyhint`; the empty state "Nothing here yet. Add the first one above." has no CTA (§8 Empty ✘); errors render as a paragraph under the form, not next to a field (§8 Error partial); "Saved" is a 2-second text, fine; no offline / server-unreachable banner exists — only the error paragraph after a failed request (§8 Offline ✘, ADR-0004); the SW update prompt is `window.confirm` (§2.8 ✘); detail screen uses a native `<input type="date">` and radios in a `fieldset/legend` (§10 1.3.1 ✔); "← Back" is the only way out of the detail screen and there is no history entry, so the Android back gesture leaves the app (§2.2 ✘).

## Checklist (two tiers, as revised after the adversarial review)

**Tier A — per change (browser pane)**

| # | Item | Token gate | Board + detail |
|---|---|---|---|
| 1 | One primary action | ✔ | ✔ (capture is the hero) |
| 2 | ≥ 48 px targets, ≥ 8 px apart | ✘ 41 px | ✘ 41 px inputs/buttons, ~18 px row actions |
| 3 | No meaning by colour alone | ✔ | ✘ `!` glyph for `missed` has no text label |
| 4 | Copy pt-BR, sentence case, infinitive buttons, "você", `Intl`, zero | ✘ English | ✘ English ("Closed" is uppercased by CSS — now also a §9.2 ✘) |
| 5 | Tab/Enter/Esc, focus visible, focus returns | Enter ✔; focus ring inconclusive (pane hidden) | Enter/Escape on inline edit ✔; detail has no history entry so back leaves the app ✘; focus ring inconclusive |
| 6 | `aria-label`, visible labels, `lang`, `<title>` | `aria-label` ✔; placeholder-only field (3.3.2 ✘); `<title>` ✔ | icon buttons ✔; capture field placeholder-only (3.3.2 ✘); detail labels ✔ |
| 7 | Tokens only (pre-token inline scale allowed); durations; reduced motion | ✔ (inline scale, no new literal) | ✔ |
| 8 | Destructive actions follow §8 | n/a | ✘ delete (irreversible) has no confirmation; complete has no *Desfazer* toast |
| 9 | No request to another origin | ✔ | ✔ |

**Tier B — per shipped screen**

| # | Item | Result |
|---|---|---|
| 10 | Contrast measured (five pairs) | muted text ≈ 5.7:1 reported on the light canvas; the intended dark canvas is not rendered (no `color-scheme`, no background) — re-measure after A5 |
| 11 | Reachable §8 states simulated | loading ✔ · empty ✘ (no CTA) · field error n/a · request error partial (paragraph under the form, input kept ✔) · offline ✘ (no banner) · toast/update ✘ (`window.confirm`) |
| 12 | 375 px + 1280 px; safe areas, keyboard, overscroll on the phone; back closes sheets | 375 px ✔ column centred; `overscroll-behavior` ✘; phone not run in this session; back/history ✘ (see 5) |
| 13 | Build size vs §11 | not re-measured in this run (no UI change shipped) |
| 14 | Screenshots filed | none — the browser pane was not displayed; DOM measurements recorded instead |

## Result

**Real findings: 13 distinct ✘** — all expected for a walking skeleton that predates the guidelines, and all already in scope of the UI/UX plan's A5 design pass (targets, colour-scheme/background continuity, overscroll, pt-BR copy and no all-caps, empty-state CTA, offline banner, update toast, visible labels, `missed` label, delete confirmation / complete undo, back/history for detail) or of A3 (`interactive-widget` choice). Nothing here is a new scope item; this run exists to prove the checklist produces findings on a real screen (A1 exit signal), and it does.
