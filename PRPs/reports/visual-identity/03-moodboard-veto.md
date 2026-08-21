# A2 step 2.5 — Moodboard veto pass (owner, 2026-08-20)

Moodboard: `moodboard.html` (published as a private artifact; 16 candidates M1–M16 + filter V1–V4). Silence = "stays in play", as agreed.

## Owner's answers (verbatim, pt-BR)

> Gostei de M2 e M4 como primário. M3 pode virar secundário se encaixar. M5 pode cortar.
> M6 vou colocar na ordem que mais gostei: Space Grotesk, Unbounded, Inter, Geist.
> M9, gostei. Gosto da ideia de elementos 3D (ou simulando elementos 3D) no design.

## Decisions carried into step 2.6

| Item | Verdict | Consequence for the directions |
|---|---|---|
| M2 âmbar `#f5a524` | **primary candidate** | one direction is built on it |
| M4 dourado-prumo `#d9a642` | **primary candidate** | one direction is built on it (ties the accent to the brass mark) |
| M3 laranja `#ff7a1a` | secondary, "if it fits" | tried only as a *secondary* role (live glow / urgency), never as the primary |
| M5 blurple `#5865F2` | **cut** | no cool accent anywhere; Discord stays a reference for colour-as-meaning only |
| M6 wordmark | ranked: **Space Grotesk › Unbounded › Inter › Geist** | Space Grotesk and Unbounded carry display roles; Inter serves body; Geist drops out |
| M9 tactile / "3D" | **liked — and generalised:** the owner likes 3D or simulated-3D elements | depth becomes an identity trait, dosed per direction (hot: dimensional controls; medium: tactile-lite; mild: flat ladder, for contrast). Conditions: depth must serve hierarchy or affordance (principle 1) and never lower contrast below the measured targets (guidelines §4.3) |
| M1, M7, M8, M10–M16 | in play (silence) | shared vocabulary of all three directions |
| V1–V4 | not contested | the filter stands |

## Recorded tension

The owner's 3D wish meets guidelines §4.2 ("**avoid** drop shadows and gradients" — a judgement rule, not a Never) and principle 1. Resolution path: render the tactile treatment properly in the directions (extrusion via inner highlight + soft shadow, no gradients on UI surfaces, the brass gradient stays on the mark only), measure contrast on the rendered pages, and let the chosen direction's ADR amend §4.2 into a precise rule for depth. Performance note: CSS relief costs nothing; rendered 3D *imagery* would cost bytes and is out of the budget (§11) unless the ADR says otherwise.
