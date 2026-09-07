# Chore C15 — the four checklist items unit 4 phase 5 could not run

**Date:** 2026-09-05 · **Open since:** 2026-08-31
**Performed by:** the assistant, in the embedded browser pane
**Server:** worktree `.worktrees/data-export/` on `http://127.0.0.1:5174` (branch `feature/data-export`)
**Screen:** `/settings`, the *Conexão com o Google* card (unit 4 phase 5)

## Why this could run today when it could not on 2026-08-31

C15 was not open because anyone forgot it. It was open because the settings screen sits behind the
`TokenGate`, entering an API token into a field is not something the assistant does, and no
automated tier reached the rendered screen. Chore **C17** (2026-09-05) removed that barrier for
local development only — `vite.config.ts` hands the client the token `.dev.vars` already holds,
under `import.meta.env.DEV`, with three guards keeping it out of any shipped bundle. The Worker
still rejects every unauthenticated `/api/*` request, in dev exactly as in production; ADR-0003
safeguard 4 is untouched.

That is the whole reason this chore was cheap today and impossible five days ago, and it is worth
recording: the blocker was a tooling gap, not a discipline gap.

---

## Item 10 — Contrast for the five §4.3 pairs

Measured from the live DOM with the WCAG relative-luminance formula, against the ADR-0010 tokens.
§4.3 is explicit that this is **measured and reported, never blocking and never silent**, against
targets of 4.5:1 for text and 3:1 for UI.

Card surface: `--color-surface-1` `#1f1816`. Page background: `--color-bg` `#161012`.

| Pair | Colour | Ratio | Target | |
|---|---|---|---|---|
| Body text on surface | `rgb(242,242,244)` | **15.65:1** | 4.5:1 | ✔ |
| Muted text on surface | `--color-muted` `#a0a0a8` | **6.74:1** | 4.5:1 | ✔ |
| Accent on surface | `--color-accent` `#f5a524` | **8.57:1** | 3:1 | ✔ |
| Focus ring on surface | inner tone = accent `#f5a524` | **8.57:1** | 3:1 | ✔ |
| Icon on surface | `rgb(242,242,244)` (the *Voltar* chevron) | **15.65:1** | 3:1 | ✔ |

Also measured: label on the accent button, `rgb(26,18,6)` on `#f5a524` — **9.08:1**.

**One nuance worth recording rather than rounding away.** `--focus-ring` is
`0 0 0 2px var(--color-accent), 0 0 0 6px var(--color-bg)` — a two-tone ring, which §4.3 requires
so it "survives any surface". On this card the **outer tone measures 1.07:1 against the surface**:
`#161012` on `#1f1816` is very nearly invisible. That is not a defect — the two-tone design means
each tone carries the ring on the surfaces where the other cannot, and here the amber inner does
all the work at 8.57:1. It is recorded because a future surface token closer to amber would leave
the ring resting on an outer tone that contributes almost nothing, and nobody would notice from
the ring's own definition.

**Both card paragraphs use `--color-muted`, not a body-text token.** The "body text" row above was
measured on the region heading instead. Worth knowing: the card has no body-weight prose, so the
15.65:1 figure describes the heading, not the sentences the owner actually reads. Those are the
6.74:1 muted rows — comfortably above target, but it is the muted value that governs this card's
readability, not the body one.

---

## Item 11 — §8 states the screen can reach

| State | Result | What was observed |
|---|---|---|
| **Offline / server unreachable** | ✔ | With `navigator.onLine` false and an `offline` event dispatched: banner reads *"Sem conexão. Dá para ler, mas não para salvar por enquanto."* — text, not colour alone (§4.4) — and **`Conectar` becomes disabled**, correctly, because starting an OAuth flow is a network action §8 says to disable |
| **Request error** | ✔ | With `fetch` stubbed to reject: a `role="alert"` reading *"Não foi possível iniciar a conexão com o Google. Tente novamente."* — the two-sentence "[what happened]. [what to do]." shape §8 mandates, **no bare status code**, the control **stays enabled for retry**, and the message is **still present 7 s later** (a toast auto-dismisses at 4 s, so the 7-second re-check is what tells the two apart) |
| **Pending request** | **NOT OBSERVABLE** | The connect button's success path returns a Google consent URL and immediately navigates away, so any busy state it shows is destroyed by the navigation before it can be read. Stubbing a slow success only delays the navigation. The failure path was exercised instead. Reaching the busy state honestly would need either the disconnect flow (which requires a live connection) or a component-level test — the browser tier cannot see it |
| **Empty calendar list** | **NOT REACHABLE** | Requires a live Google connection with zero calendars selected. No connection exists in this local database, and establishing one needs the owner's real Google account. Still owed |

---

## Item 12 (viewport half) — 375 px and 1280 px

| | 375 × 812 | 1280 × 900 |
|---|---|---|
| Card width | 343 px | 608 px (inside a `main` capped at 640 px) |
| Button | 311 × 48 px, ≥ 48 ✔ | 576 × 48 px, ≥ 48 ✔ |
| Horizontal overflow | none | none |
| Truncated text | none | none |

Header top padding resolves to 24 px, which is where the safe-area inset lands on a desktop
viewport (no inset to add).

**The phone half of item 12 is NOT done.** Real safe areas, keyboard overlap and the back gesture
need the physical Android device; no local bypass reaches it. Item 12 therefore stays partially
open, and this is the same half that remains outstanding for unit 5 phase 3's Task 9.

---

## Item 14 — Screenshots

**None filed, and this paragraph is the written reason §12.6 permits in their place.**

The embedded browser pane composites no frames while it is not displayed: `getBoundingClientRect`,
`getComputedStyle`, the accessibility tree and real key presses all work, but no image exists to
capture. Every number above was read from the live DOM or from instrumented runtime values, never
from an image, and §12.6 is explicit that a written reason may stand in for a screenshot but must
never be *claimed* as one.

If a visual artefact is wanted, the owner's own device photos remain the route §12.6 names — and
they would come from the same Android pass item 12 still owes.

---

## Status

**Three of four items closed; one partially.**

- Item 10 — **done**, five pairs measured and recorded with one nuance about the ring's outer tone.
- Item 11 — **done for the states this tier can reach**; the pending state is documented as
  unobservable-by-construction and the empty-calendar-list state as still owed.
- Item 12 — **viewport half done**; the phone half still owed.
- Item 14 — **discharged by written reason**, per §12.6.

C15 should stay open for the two device-dependent remnants (item 11's empty calendar list, item
12's phone half), which are the same items unit 5 phase 3's Task 9 owes. Closing it entirely today
would claim device verification that did not happen.

*Status: PARTIAL — measurable items closed, device-dependent items still owed*
