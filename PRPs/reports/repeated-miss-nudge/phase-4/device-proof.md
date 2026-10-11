# Device proof — AC-17 (repeated-miss-nudge, phase 4)

Status: OWED

## Procedure

1. In production with this unit deployed, choose a real daily or weekly series and let three
   consecutive occurrences lapse (or note a series already at three: each is nudged once on
   the first run, D-H).
2. After the third is recorded by the cron and the local 09:00 window arrives, expect exactly
   ONE notification on the phone with the app closed: title the series' title (at most 30
   characters), body `<N> não concluídas seguidas. Toque para replanejar ou encerrar.`
3. Tap it and expect the series' open occurrence's sheet, showing the *Repetição* block and
   the *Avisar após 3 não concluídas seguidas* switch.
4. Confirm no second notification arrives while the run continues (4th, 5th miss), and note
   whether a same-`tag` notification replaced rather than stacked on the installed PWA (the
   iOS/PWA open question).
5. Flip the switch off and confirm *Avisos silenciados. Seus lembretes continuam normais.*,
   that the *Aderência* row now reads *Avisos silenciados*, and that a Reminder of that
   series' Task (and of another Task) still rings.
6. Record the observation here and in the roadmap Delivery history, with the Open Questions
   it answers (unmute behaviour D-I, the upper bound of the window, the first-day burst, the
   tag replacement).

## Observation (owner)

Empty until the owner records it. Nothing has been observed and nothing is claimed.
