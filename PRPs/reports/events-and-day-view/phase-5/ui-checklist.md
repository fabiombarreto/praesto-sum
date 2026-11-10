# UI/UX review checklist — unit-level roll-up for `events-and-day-view` (unit 14, phase 5)

Written 2026-10-21 by the Implementer of phase 5. This is a roll-up, not a review:

- **This phase touched no `src/app/` file.** It adds no screen and no new ✔/✘; every state below is copied from the phase
  records, with the record and line cited, and nothing is invented or re-judged. The guidelines' review checklist
  (`documentation/40-engineering/ui-ux-guidelines.md`) was run on the screens in phases 3 and 4, where they changed.
- **What this record rests on.** Reading `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md`,
  `PRPs/reports/events-and-day-view/phase-4/ui-checklist.md` and the live pass of phase 4
  (`PRPs/reports/events-and-day-view/phase-4/live-browser-pass.md`). Nothing was re-run and nothing was seen rendered by the
  Implementer of this phase.
- **Line citations** are written `p3:<line>` for `phase-3/ui-checklist.md` and `p4:<line>` for `phase-4/ui-checklist.md`.
  "Tier A" is the checklist's items 1 to 9 (every interface change), "Tier B" its items 10 to 14 (a changed screen).

## One row per screen or surface the unit touched

| Surface | Touched in | Tier A (items 1–9) | Tier B (items 10–14) |
|---|---|---|---|
| `DayScreen` (the `/day/AAAA-MM-DD` route) | phase 3 (new); phase 4 (*Novo compromisso*, the sheet, the `Esc` gating) | ✔ 1 to 7 and 9 (p3:30-76, p4:50-107); ✘ 8, the recorded exception of no toast slot on `/day` (p3:66-71; unchanged, p4:141-143); item 5 ✔ for what was observed, the visible ring and a real `Tab` walk owed to the owner's device (p3:49-53, p4:75-85) | 10 owed to the owner's device (p3:80, p4:111); 11 ✔ for the states observed (p3:83, p4:114); 12 ✔ in the pane, the phone half owed to the owner's device (p3:88, p4:123); 13 ✔ (p4:131); 14 owed to the owner's device (p3:99, p4:137) |
| `LocalEventRow` (the owner's commitment as a row) | phase 3 (new, inert); phase 4 (the whole row is one `<button>` that opens the sheet) | ✔ 1 to 9 (phase 3 recorded it with no control, p3:30-33; phase 4 supersedes that, p4:50-55 and the AC-28 walk, p4:167-172); item 2 ✔ the whole 64 px row is the hit area (p4:56-62); item 6 ✔ its accessible name is its visible time and title (p4:86-90) | 10 owed to the owner's device (p4:111); 11 ✔ (p4:114); 12 ✔ in the pane, the phone half owed to the owner's device (p3:88, p4:123); 14 owed to the owner's device (p4:137) |
| *Hoje*'s Agenda (`TodayScreen`'s Agenda region and the header date button of `TodayHeader`) | phase 3 (local rows beside Google's, the date turned into a button); phase 4 (a local row opens the sheet, the never-stack gating, the newest-wins `refreshLocalEvents`, `/` ignoring a focused `<select>`) | ✔ 1 to 7 and 9 (p3:30-76, p4:50-107); ✘ 8 carried from phase 3 (p3:66-71, p4:141-143); item 5 ✔ for what was observed, `Tab` order and the ring on the date button owed to the owner's device (p3:49-53) | 10 owed to the owner's device (p3:80); 11 ✔ for the states observed, a failed Task write, offline and the loading state on their own owed to the owner's device (p3:83); 12 ✔ in the pane, `até HH:mm` and `dia todo` in the narrow 56 px column not observed (p3:88); 14 owed to the owner's device (p3:99) |
| `CompromissoSheet` (with `useEventSheet`) | phase 4 (new) | ✔ 1 to 9 (p4:50-107); item 2 ✔ measured in the live pass at 375 px and 1280 px, every control at least 48 × 48 (p4:56-62); item 5 ✔ for what was observed, the visible ring after a key press and a real `Tab` walk owed to the owner's device (p4:75-85); item 8 ✔ with the recorded exception of no success toast (p4:97-103) | 10 owed to the owner's device (p4:111); 11 ✔ (p4:114-122); 12 ✔ in the pane, the phone half owed to the owner's device (p4:123-130); 13 ✔ (p4:131-136); 14 owed to the owner's device (p4:137-139) |
| `ConfirmView` (one optional prop, `confirmDisabled`) | phase 4 (changed) | ✔ 1 to 9; item 8 is its checklist item: the irreversible *Excluir este compromisso?* repeats the verb, *Cancelar* is focused and the destructive button second and neutral (p4:97-103); every other caller renders as before (p4:17-23) | 11 ✔ (p4:114); 12 ✔ in the pane (p4:123); 14 owed to the owner's device (p4:137) |
| `SearchScreen`'s *Compromissos* group | phase 4 (changed: a second independent request, the body decision, the sheet, the `Esc` gating) | ✔ 1 to 9 (p4:50-107); AC-29 clauses ✔ (p4:183-201); item 4 ✔ for the pinned pure copy, the search field's placeholder and empty sentence still say *tarefas*, a copy question left to the owner (p4:36-38) | 10 owed to the owner's device (p4:111); 11 ✔ for a failed commitments search over a Task match and an empty search (p4:114-122); 12 ✔ in the pane, the widest label on one line (p4:123-130); 14 owed to the owner's device (p4:137) |

## The ✘ that stays

1. **Phase 3's item 8 — no toast slot on `/day`.** Completing a Task on `/day` has no *Desfazer* toast (guidelines §8); a
   conscious exception recorded in p3:66-71, repeated in the phase-4 result (p4:141-143) and in the open questions of the
   phase-3 documentation manifest. It is the owner's call whether `/day` gains the slot (a layout change), asked at the device
   proof.
2. **Phase 4's recorded exception — no success toast and no *Desfazer* for a saved or deleted commitment** (plan decision D4-6).
   The phase-4 record marks item 8 ✔ with this exception written into it (p4:97-103) and the live pass lists it as finding F3
   (`phase-4/live-browser-pass.md`, Findings): the sheet closing and the list changing are the confirmation, and a failure is
   an inline, persistent line. Whether *Hoje* should toast is flagged for the owner.

## Items owed to the owner's device

The Browser pane could not show them; they are the device proof's checks (`PRPs/reports/events-and-day-view/device-proof.md`):

- the native date and time inputs inside a `<dialog>`, and the 418-option *Fuso horário* select, on Android Chrome (p4:123-130);
- keyboard overlap and the visual viewport with the sheet open, safe areas and `overscroll-behavior` (p4:123-130, p3:88-92);
- the Android back gesture closing the sheet and returning through the visited days (p4:176-178, p3:140-143);
- contrast on a real panel, item 10 of both records (p3:80-82, p4:111-113);
- the visible focus ring after a key press and a real `Tab` walk (p4:75-85, p3:49-53);
- Lighthouse on the phone, item 13 (p3:93-98, p4:131-136);
- the pane's own Offline toggle: only the `offline` event was dispatched (p4:207-210, live pass "Not observed");
- device photos, item 14 (p3:99-101, p4:137-139), which are the artefact to ask for (guidelines §12.6);
- what phase 3 did not observe: a failed Task write on `/day`, offline and the loading state on their own, and `até HH:mm` and
  `dia todo` in the narrow 56 px column on *Hoje* (p3:83, p3:88).

## Findings the owner decides at the device proof

- **F1** — *decided 2026-10-27 and built*: a timed end that has only the start's own day is the start plus one hour, so
  switching *Dia inteiro* off no longer saves a zero-length commitment (PRD D-W; `phase-4/live-browser-pass.md`, "Owner decisions").
- **F2** — *recorded 2026-10-27 as an attention point, then fixed the same day at the owner's request*: a sheet reopened within
  about 120 ms of closing was swallowed because a stale native `close` event reached `Sheet.tsx` after the reopen; the guard
  `shouldMirrorDialogClose` is built and seen live on the Compromisso and Task sheets (`phase-4/live-browser-pass.md`,
  "Owner decisions"; `sheet-close-guard.md`).
  A finger cannot re-tap that fast; the device proof can watch for it.
- **The autumn-DST edge** — an Event stored across the autumn clock change whose end wall-clock text is earlier than its start
  text (01:50 EDT to 01:10 EST) re-resolves its end to the first 01:10, so the untouched draft reads *O fim não pode ser antes
  do início.* until the end is edited; unreachable from the sheet itself (p4:268-270).

Result: no new ✘ from this phase — it touched no `src/app/` file and added no screen. Across the unit the six surfaces above
carry one ✘ with a recorded exception (phase 3's item 8, the missing toast slot on `/day`, still the owner's call) and one
recorded exception of no success toast; every ✔ is the phase record's own. Items 10, 12 (phone half), 5 (focus ring), 13
(Lighthouse) and 14 stay owed to the owner's device, and the autumn-DST edge is his to decide at the device proof; F1 and F2 are decided and built.
