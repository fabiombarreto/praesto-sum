# Chip overflow measurement — a 40-character area name in a wrapping group (unit 13, phase 4, Task 6)

Static estimate written 2026-10-12 by the Implementer with no page available; **measured the same day by the
orchestrator in the browser pane** (details and method in `live-browser-pass.md`; the numbers below are copied from
it). This closes plan Task 6.

Decision: keep Chip as is

## Numbers (375 px viewport, dark; fixture of 12 areas, one of 40 characters)

| Measure | Task sheet group | Filter sheet group |
|---|---|---|
| Viewport (width x height) | 375 x 812 | 375 x 812 |
| Group `scrollWidth` | 343 | 343 (357 while the 40-character chip is pressed) |
| Group `clientWidth` | 343 | 343 |
| Widest chip `getBoundingClientRect().width` | 320 (unpressed) | 320 unpressed, 341 pressed |
| `<dialog>` scroll region `scrollWidth` | 375 | 390 |
| `<dialog>` scroll region `clientWidth` | 375 | 375 |
| Horizontal overflow of the region (`scrollWidth > clientWidth`) | no | yes, **but caused by the *Período* "Até" date input (right edge 390), not by a chip** — the widest chip's right edge is 369 |

Quick row, at 375 px:

| Measure | Value |
|---|---|
| Right edge of the third quick chip with no area applied | about 324 |
| Right edge of the third quick chip with the 40-character area applied | 673 (the row scrolls, `scrollWidth` 689) |
| Does the leading area chip push a quick chip past the viewport? | **yes** — the three standard chips start at 365, 452 and 548 (viewport 375): reachable only by scrolling the row |

## Reading the numbers

- The static estimate was a little pessimistic: 320 px unpressed against the estimated 306 to 346, 341 px pressed
  against 326 to 366. The estimate's conclusion — a 40-character name does not fit the 311 px of content — holds, but
  its consequence does not: the `wrap` group is `overflow: visible`, so the chip is **never clipped and nothing
  scrolls**. At its worst the pressed chip pokes about 10 to 14 px into the sheet's right padding and still ends
  6 px short of the viewport edge (369 of 375). No chip of any group is shorter than 48 px.
- The filter sheet's sideways overflow (390 > 375) is the pre-existing *Período* row, not a chip, so it is not this
  unit's to fix here; it is recorded in `live-browser-pass.md` for whoever next touches that sheet.
- The 40-character name is the limit case. The owner's ordinary names are 4 to 18 characters (60 to 180 px).

## Decision

**`Decision: keep Chip as is`** — the premise for changing it ("a sheet overflows because of a chip") is not met:
the only overflow of a sheet's region is the date input's, and the 40-character chip stays fully visible in both
sheets. Changing a shared primitive for a gutter violation of 10 to 14 px at the 40-character limit would re-measure
every chip group in the app for no reader-visible gain. `Chip.tsx` is byte-identical to the base tree.

Recorded as a conscious exception for the owner (it is *his* limit, 40 characters, that creates the case): at exactly
that length the pressed chip leaves the 16 px gutter by up to 14 px. If he finds it ugly, the cheap remedies are a
shorter limit or the `change Chip` edit this record describes (`whitespace-nowrap` → `whitespace-normal` plus
`max-w-full break-words text-center`, with every other chip group re-measured at 48 px).

## The second finding, and why it is not about `Chip`

The quick row is where a long name really hurts: the applied area chip leads the row (by design, so it can never be
off-screen), and at the 40-character limit it is 341 px wide, which pushes *Abertas*, *Para hoje* and *Alta
prioridade* to the edge. That is fixed at the call site (cap the applied chip's label, keep the full name as its
accessible name), not in `Chip`: see `live-browser-pass.md`, finding 2. The quick-row table above is
the pre-fix measurement; the cap (10 rem, ellipsis) was applied in attempt 2 and re-measured in the
pane's second look (`live-browser-pass.md`, "Second look"): the applied chip is 206 px wide and 48 px
high, *Abertas* is fully on screen and *Para hoje* straddles the 375 px edge. Still not seen by
anyone on the owner's phone.
