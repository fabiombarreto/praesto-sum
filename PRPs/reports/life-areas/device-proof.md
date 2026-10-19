# Device proof — AC-24 (life-areas, phase 4)

Status: OBSERVED (AC-24, the owner's report of 2026-10-18); AC-18 MET (real snapshot, 2026-10-18)

This is the owner's proof, on his phone, against production. Unit 13 was deployed on 2026-10-18 as
`v0.13.0` and the owner reported the same day that his phone test went all OK (see Observation).
The roadmap row stays `in-progress` until the rest of the procedure is recorded and he decides.

## Procedure

1. In *Configurações → Áreas*, create an area he chose himself (not one this unit's fixtures used).
2. Open an existing Task's sheet and give it that area under *Área*; save, and see the area's name
   end the row's meta line on *Hoje*.
3. Open the filter sheet (the header's filter button) and pick that area under *Área*: the header
   badge reads 1, the quick row leads with a selected chip bearing the area's name, and *Hoje*
   lists only that area's Tasks.
4. Pick *Sem área*: the Tasks that have no area are listed, and the quick row's leading chip reads
   *Sem área*.
5. With the area filter on, capture one Task from the deck: it lands in that area and stays
   visible in the filtered list. With *Sem área* on, capture another: it has no area and stays
   visible. With no area filter, capture a third: its area is unchanged from today (none).
6. Tap *Limpar filtros*, then close the app fully and reopen it with an area filter set first: it
   starts unfiltered (nothing about the area survives a cold start).
7. Record how many Tasks or series he has assigned to areas he created, and on how many different
   days he used the filter in the week after deploy (the PRD's metrics: at least one area, at least
   three assigned items, at least three days). No telemetry is added (CON-005); this is his own
   report.
8. Then take the next snapshot and run the restore drill on it (chore C6:
   `PRPs/reports/life-areas/c6-restore-drill.md`, section `REAL SNAPSHOT RUN: OWED`), so PRD AC-18
   is met on a production snapshot rather than on the synthetic fixture.
9. Record the observation here and in the roadmap Delivery history, then flip unit 13 on his
   decision (`shipped` or the revert clause of its exit signal).

## Decisions awaiting the owner

Open, not settled — each is a proposal an agent wrote, and none is validated until he says so:

- **The pt-BR copy.** *Área* (the group label, here and in the Task sheet), *Você ainda não criou
  nenhuma área.*, *Criar áreas*, *Aplicar título, descrição, prioridade e área a*, and the neutral
  *Área* this phase shows on the applied chip when the area filter's id is not in the loaded list
  (an area deleted on another device, or a failed areas request). Each is one literal in its
  component.
- **The glossary and domain-model wording** of a Life Area (PRD Open Question 1): "a named grouping
  the owner creates", with Calendar and Tasks recorded as product capabilities and not as Life Area
  records, and *Sem área* as the pt-BR copy of the implicit "Unsorted" grouping. It is written in
  `documentation/` as proposed, awaiting his confirmation.
- **A *Limpar filtros* chip in the quick row.** Layout standard §2.3 still said applied filters
  "stay visible as selected chips with a *Limpar filtros* chip", but the owner's 2026-08-24 cut left
  that row holding toggles and nothing else. This phase followed the later decision: *Limpar
  filtros* lives in the sheet and in the filtered-empty state, and tapping the applied area chip
  clears the area. Adding the chip back is one element in `FilterChips.tsx` if he wants it.
- **The 12-area limit** (weakly evidenced; one constant — strike it if it feels arbitrary).
- **The three open questions the PRD lists:** closed rows keep the old area after a series is
  re-assigned; whether *Só esta ocorrência* for an area alone surprises him; whether re-selecting
  the filter after every cold start is a nuisance in the first week.
- **The 40-character name** (`PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md`): the
  overflow was measured by the orchestrator in the browser pane at 375 px, and the record reads
  `Decision: keep Chip as is` — a 40-character name is never clipped and nothing scrolls. Two things
  stay his. The first is the limit case: at exactly 40 characters the pressed chip leaves the sheet's
  16 px gutter by 10 to 14 px, so whether that is acceptable or the limit should come down is his
  call (the cheap remedies are a shorter limit or a `Chip` change). The second is the rendering on
  his own device, which the pane's emulation does not replace; as the leading quick chip the name
  is now cut at 10 rem with an ellipsis and stays whole as the chip's text and its `title`.

## Observation (owner)

2026-10-18 — the owner tested on his phone, against production `v0.13.0` (Cloudflare version
`d555372d`), and reported *tudo ok*. That is the whole report: no area name, no count of assigned
items, no account of individual steps and no number of days of use was given, so none is recorded
here and none is inferred.

What this settles: PRD AC-24's observation (create an area, assign an existing Task, filter *Hoje*).
What it does not settle: step 7's week of use (at least three assigned items on at least three
days) and step 9 (flipping the unit on his decision), nor the decisions listed above. Step 8, the
restore drill on a real production snapshot (PRD AC-18), was run the same evening and passed: see the
Re-run in `PRPs/reports/life-areas/c6-restore-drill.md`.
