# Device proof — AC-31 (events-and-day-view, phase 5)

Status: OWED

This is the owner's proof, on his phone, against production, to be done after the release runbook's Step 6
(`PRPs/reports/events-and-day-view/phase-5/release-runbook.md`): unit 14 has to be deployed as `v0.14.0` before there is
anything to observe. It is a template. Nothing has been observed, no drill has been run on production data and no date of use
exists, so this file claims none of them. The roadmap row of unit 14 stays `in-progress` until he decides.

## Procedure

1. From `/day`, with *Novo compromisso*, create a real timed commitment (a start, an end and a *Fuso horário* he accepts) and a
   real all-day one.
2. Edit one of them: move it an hour (or, for the all-day one, change its last day), save, and see the list change.
3. Create a throwaway commitment and delete it through *Excluir*, which asks once (*Excluir este compromisso?*).
4. Open *Hoje* and `/day`: the commitments appear beside his Google commitments and his dated Tasks, and he can tell the three
   sources apart.
5. Create a commitment for next Tuesday and open `/day` for that Tuesday: it is listed there and absent from *Hoje*'s Agenda
   today.
6. Find one of the commitments in search by typing two words of its title or description: a *Compromissos* group lists it
   with its date and time, and tapping the row opens the same sheet.
7. Try the sheet with the connection off (airplane mode): writes are disabled with the offline hint, and *Cancelar* and
   reading still work.
8. Say, in his own words, whether he missed any field Google has (the exit signal's second clause), and which ones.
9. Run the runbook's Step 8 drill: a fresh snapshot that now holds an event, through `scripts/restore-drill.mjs`, recorded
   under `PRPs/reports/events-and-day-view/`. Leave at least one real commitment in place for it.

## Decisions awaiting the owner

Open, not settled — each is a proposal an agent wrote, and none is validated until he says so:

- **The phase-4 strings — approved by the owner on 2026-10-27** (PRD D-W) and added to the microcopy table of
  `documentation/10-product/visual-identity.md`; nothing to decide here. Still open: the search field's placeholder
  (*Pesquisar tarefas…*) and its empty sentence (*Nenhuma tarefa encontrada para “…”.*) still say *tarefas*; the owner noted
  it on 2026-10-27 as an attention point and possible debt (roadmap Backlog), and neither replacement the phase-4 plan
  proposed is approved.
- **D4-8 — the end does not follow the start when the start is edited.** Reopen trigger: he reports at this device proof that
  moving a start and having to move the end too is a nuisance.
- **D4-3 — the zone select lists the runtime's whole IANA set** (418 options in the live pass), the owner's zone first.
  Reopen trigger: the device finds the select unwieldy (the PRD names a short list with a search as the fallback).
- **D4-4 — changing only the zone moves a timed commitment's instants** (a patch decides its time keys from the wall clock).
  Reopen trigger, proposed here and not stated in the phase record: he finds that a zone change alone should keep the instants.
- **Findings F1 and F2 of the phase-4 live pass** (`PRPs/reports/events-and-day-view/phase-4/live-browser-pass.md`, Findings):
  F1, *decided 2026-10-27 and built* (a timed end that has only the start's own day is the start plus one hour; PRD D-W); F2, a
  sheet reopened within about 120 ms of closing was swallowed, *recorded 2026-10-27 as an attention point and then fixed the same
  day at the owner's request* (a guard in the shared `Sheet.tsx`; the roadmap Backlog has the trace) — re-tap a sheet quickly on the
  phone once, to see it open every time.
  **The autumn-DST edge** of the phase-4 hand-off (`phase-4/ui-checklist.md`, "Hand-off to phase 5"): an Event stored across
  the autumn clock change whose end wall-clock text is earlier than its start text cannot be saved until the end is edited.
  Unreachable from the sheet itself.
- **The toast question.** Phase 3's item 8 (no toast slot, so no *Desfazer*, when a Task is completed on `/day`) and phase 4's
  recorded exception (no success toast for a saved or deleted commitment) are both his call: keep them, or give `/day` a slot.
- **The PRD's Open Questions** (`PRPs/prds/events-and-day-view.prd.md`): open Tasks only on `/day` (closed ones stay *Hoje*'s
  business — does a past day without what he completed bother him?); a commitment crossing midnight appears on both days;
  the length constants (title 200, description 5000, location 200 — arbitrary, each one constant); the zone select on Android;
  the default start of a new commitment (09:00, or the next full hour today); whether the date in *Hoje*'s header is
  discoverable enough as the door to `/day`; and which extra scalars he will miss (busy/free, visibility, colour, a video
  link).
- **The device-only items** of `PRPs/reports/events-and-day-view/phase-5/ui-checklist.md`: the native date and time inputs and
  the zone select on Android Chrome, keyboard overlap and the visual viewport with the sheet open, the Android back gesture,
  contrast, safe areas, `overscroll-behavior`, the visible focus ring, Lighthouse, the pane's own Offline toggle and device
  photos.

## Observation (owner)

Empty until the owner records it. Nothing has been observed and nothing is claimed.
