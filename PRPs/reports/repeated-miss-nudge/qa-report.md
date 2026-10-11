# QA support report — Repeated-Miss Nudge (unit 12)

Source: `PRPs/prds/repeated-miss-nudge.prd.md` (APPROVED 2026-10-10), AC-1..AC-17, plus gap cases from the
code reviews, the plans' risk tables and the orchestrator's own judgment calls. Generated 2026-10-11 by
`/relay-qa-report`.

## How to read this report

- `automated` means a real test file asserts the case; `manual` means a human must exercise it; `none` means
  neither — those entries are listed on purpose, not hidden.
- **Test paths are branch-relative.** Every cited file was checked with `test -f` inside the worktree
  `.worktrees/repeated-miss-nudge/` (branch `feature/repeated-miss-nudge`, PR
  [#11](https://github.com/fabiombarreto/praesto-sum/pull/11), commit `603ab68`). They are not on `main` until
  the PR merges.
- **Grounding.** The Test Runner record for the last phase exists at
  `PRPs/reports/repeated-miss-nudge/phase-4/attempts/test-1/record.json` (outcome PASSED, 81 files / 1384
  tests, 0 failed). Per-case coverage below is inferred from the test files' `describe` names, which carry the
  PRD AC ids (`AC-n`, and the plans' `AC-A<i>` mapped to PRD ACs in their own titles). It is not a per-test
  trace from the record.
- **Nothing in this unit has been looked at in a browser or on a device.** `ui-checklist.md` and
  `device-proof.md` under `PRPs/reports/repeated-miss-nudge/phase-4/` are honest about that. Every manual
  status below is `pending`.
- The cron cannot be exercised end to end on a laptop: delivering a push needs a real subscription on the
  owner's installed PWA. Cases that need a delivered notification are marked **device**.

## Local fixture (for the manual cases that need data)

From `.worktrees/repeated-miss-nudge/`, against the **local** D1 only:

1. `npx wrangler d1 migrations apply praesto-db --local` (applies `0006`).
2. Start the dev server: `npm run dev -- --port 5177 --strictPort`.
3. Insert, with `npx wrangler d1 execute praesto-db --local --file <sql>` (bind `America/Sao_Paulo`; shift the
   dates to the day you test), three series:
   - *Academia* (daily, `active`): `missed` on D-4, D-3, D-2 and an `open` occurrence on D-1 — three
     consecutive misses, due;
   - *Ler 20 páginas* (daily, `active`): `missed` D-3, `done` D-2, `missed` D-1, `open` today — one miss, not
     due;
   - *Água ao acordar* (daily, `ended`): three `missed` rows — ended, never nudged;
   plus one one-off Task. Only `series_id`, `occurrence_date`, `status`, and the series `status`/`timezone`/
   `nudge_muted`/`nudged_at` matter.

## Summary table

| # | Case | Risk | Coverage | Automated test path | Manual |
|---|------|------|----------|---------------------|--------|
| AC-1 | Consecutive-miss count | High | automated | `test/nudge.test.ts` | — |
| AC-2 | A completion resets the count | High | automated | `test/nudge.test.ts` | — |
| AC-3 | Skipped cycles leave no row and do not interfere | Medium | automated | `test/nudge.test.ts` | — |
| AC-4 | Due decision and its non-due reasons | Critical | automated | `test/nudge.test.ts` | — |
| AC-5 | 09:00 gate in the series' own zone | High | automated | `test/nudge.test.ts` | — |
| AC-6 | Exactly one send under overlapping cron runs | Critical | automated | `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-7 | No repetition while the run continues | Critical | automated | `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-8 | Completion clears the marker; three new misses nudge again | High | automated | `test/nudge-state.test.ts`, `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-9 | Payload, tag and deep link | High | automated | `test/nudge-copy.test.ts`, `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-10 | Send outcomes: prune, release, no subscription | Critical | automated | `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-11 | Mute is per series and leaves Reminders alone | Critical | automated | `test/nudge-state.test.ts`, `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-12 | A muted run is consumed, not queued | High | automated | `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-13 | A nudge failure never blocks Reminders | Critical | automated | `test/repeated-miss-nudge-cron.test.ts` | — |
| AC-14 | Migration 0006, export and wire | High | automated + manual | `test/nudge-state.test.ts` | `pass (partial)` |
| AC-15 | The switch in the sheet and the Aderência row | High | automated + manual | `test/nudge-switch.test.ts`, `test/adherence-view.test.ts`, `test/adherence-endpoint.test.ts` | `pass` |
| AC-16 | UI/UX checklist recorded; copy stays pt-BR | Medium | automated + manual | `test/nudge-switch.test.ts`, `test/nudge-copy.test.ts` | `partial` |
| AC-17 | Device proof: one notification, tap lands, mute holds | Critical | manual | — | `pending` |
| G-1 | Every stored subscription pruned in one run leaves the claim set | Medium | automated | `test/repeated-miss-nudge-cron.test.ts` | `pending` |
| G-2 | First-day burst for series already over the threshold | Medium | none | — | `pending` |
| G-3 | Reopening a completed occurrence does not restore the marker | Low | none | — | `pending` |
| G-4 | Unresolvable series time zone in the nudge gate | Low | none | — | `pending` |
| G-5 | Muted ended series row and the switch's absence for an ended series | Medium | automated + manual | `test/nudge-switch.test.ts`, `test/adherence-endpoint.test.ts` | `pass` |
| G-6 | Toggling the switch with an unsaved rule edit in the same sheet | Medium | none | — | `pass` |
| G-7 | Window has no upper bound (a 23:50 miss can notify at 23:55) | Low | none | — | `pending` |
| G-8 | Restore drill (chore C6) against a real snapshot after `0006` | High | none | — | `pending` |

---

## Phase 1 — Pure decision (`src/shared/nudge.ts`)

### AC-1 — Consecutive-miss count

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/nudge.test.ts` — "trailingMissStreak — consecutive count (AC-1)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, make *Academia* due and check it is the only series in the notification
     decision (see AC-4, AC-17); the count itself is not practical to inspect by hand.

### AC-2 — A completion resets the count

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/nudge.test.ts` — "trailingMissStreak — a completion resets (AC-2)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand; rely on the automated tests (the end-to-end half is AC-8 and AC-17).

### AC-3 — Skipped cycles leave no row and do not interfere

- **Risk level:** Medium
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/nudge.test.ts` — "trailingMissStreak — skipped cycles leave no row (AC-3)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand; rely on the automated tests.

### AC-4 — Due decision and its non-due reasons

- **Risk level:** Critical
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/nudge.test.ts` — "decideNudge — due decision (AC-4)" and the "reason precedence:
  ended, already-nudged, below-threshold, muted, before-window" block
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand; rely on the automated tests.

### AC-5 — 09:00 gate in the series' own zone

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/nudge.test.ts` — "decideNudge — time-of-day gate in the series' own zone (AC-5)"
  (America/Sao_Paulo and UTC tables, midnight 00:00, 08:55/09:00 boundary, same-instant two-zone case)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand (needs a controlled clock); rely on the automated tests. The real-clock half is
     AC-17.

---

## Phase 3 — The cron step (`sweepRepeatedMissNudges`)

### AC-6 — Exactly one send under overlapping cron runs

- **Risk level:** Critical
- **Required state:** an active series with three consecutive misses, an open occurrence, one push subscription
- **Coverage:** automated
- **Automated test path:** `test/repeated-miss-nudge-cron.test.ts` — "AC-A1 (PRD AC-6): exactly once under overlap"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand (needs two concurrent invocations); rely on the automated tests.

### AC-7 — No repetition while the run continues

- **Risk level:** Critical
- **Required state:** a series already nudged (`nudged_at` set), then a 4th and 5th consecutive miss
- **Coverage:** automated
- **Automated test path:** `test/repeated-miss-nudge-cron.test.ts` — "AC-A2 (PRD AC-7): no repetition while the
  run continues"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Real-clock half is AC-17: after the first notification, let the series miss once or twice more and confirm
     none arrives.

### AC-8 — Completion clears the marker; three new misses nudge again

- **Risk level:** High
- **Required state:** a series with `nudged_at` set and an open occurrence
- **Coverage:** automated
- **Automated test path:** `test/nudge-state.test.ts` — "AC-8 / AC-A1 completing an occurrence clears the series'
  nudge marker"; and the re-arm half in `test/repeated-miss-nudge-cron.test.ts` — "AC-A5 (PRD AC-12) … completing
  through the route and then three new misses gives exactly one nudge"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, set `nudged_at` on *Academia* in D1, then complete its open occurrence in the app.
  2. Query D1 and expect `nudged_at` to be `NULL` for that series.

### AC-9 — Payload, tag and deep link

- **Risk level:** High
- **Required state:** an active series, three misses, an open occurrence
- **Coverage:** automated
- **Automated test path:** `test/nudge-copy.test.ts` — "buildNudgeNotification — AC-9 …" (title ≤ 30, tag per
  series, route, pt-BR copy and vocabulary); `test/repeated-miss-nudge-cron.test.ts` — "AC-A3 (PRD AC-9): payload
  and deep link" (series without an open occurrence is not nudged and takes no claim)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. The delivered text and the tap target are AC-17 (device).

### AC-10 — Send outcomes: prune, release, no subscription

- **Risk level:** Critical
- **Required state:** a due series; subscriptions answering 404/410, 429/5xx, or none
- **Coverage:** automated
- **Automated test path:** `test/repeated-miss-nudge-cron.test.ts` — "AC-A4 (PRD AC-10): send outcomes"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand; rely on the automated tests (sender is the project's `sendPush` seam).

### AC-12 — A muted run is consumed, not queued

- **Risk level:** High
- **Required state:** a muted series at three misses, then unmuted
- **Coverage:** automated
- **Automated test path:** `test/repeated-miss-nudge-cron.test.ts` — "AC-A5 (PRD AC-12): a muted run is consumed,
  not queued"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Real-world half is part of AC-17 step "silence it": after silencing, unsilence and confirm no notification
     fires for the same run.

### AC-13 — A nudge failure never blocks Reminders

- **Risk level:** Critical
- **Required state:** a due Reminder and a due nudge whose claim fails
- **Coverage:** automated
- **Automated test path:** `test/repeated-miss-nudge-cron.test.ts` — "AC-A6 (PRD AC-13): a nudge failure never
  blocks Reminders" (SQLite trigger fault, cron_runs failure row, per-series isolation)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand; rely on the automated tests.

---

## Phase 2 — Columns, mute and wire

### AC-11 — Mute is per series and leaves Reminders alone

- **Risk level:** Critical
- **Required state:** two series each with a Reminder
- **Coverage:** automated
- **Automated test path:** `test/nudge-state.test.ts` — "AC-11 / AC-A2 PATCH nudgeMuted is per series and leaves
  Reminders alone" and "AC-11 / AC-A3 PATCH nudgeMuted validation writes nothing on a bad body";
  `test/repeated-miss-nudge-cron.test.ts` — "AC-A5" (the muted series is not nudged)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the token, `PATCH /api/series/<id>` `{"nudgeMuted": true}` and expect `200` with `nudgeMuted: true`.
  2. Send `{"nudgeMuted": "true"}` and expect `400` and the series unchanged.

### AC-14 — Migration 0006, export and wire

- **Risk level:** High
- **Required state:** a database with existing series rows
- **Coverage:** automated + manual (the real-snapshot half is manual — see G-8)
- **Automated test path:** `test/nudge-state.test.ts` — "AC-14 / AC-A4 migration 0006 keeps existing rows and
  defaults the new columns", "AC-14 / AC-A5 the FR-042 export carries both columns", "AC-14 / AC-A6 the series
  wire carries nudgeMuted and never nudgedAt"
- **Manual status:** `pass` (2026-10-11, partial: export and series wire checked by hand; real-snapshot half is G-8)
- **Manual step-by-step:**
  1. `GET /api/export` and expect each `recurrence_series` row to carry `nudgeMuted` and `nudgedAt`.
  2. `GET /api/series/<id>` and expect `nudgeMuted` and no `nudgedAt` key.

---

## Phase 4 — The switch and the proof

### AC-15 — The switch in the sheet and the Aderência row

- **Risk level:** High
- **Required state:** the local fixture (*Academia* active, *Água* ended, one one-off Task)
- **Coverage:** automated + manual (pure helpers and the wire are automated; the rendered switch is manual)
- **Automated test path:** `test/nudge-switch.test.ts` — "nudgeSwitchView - visibility (AC-15)", "state and copy",
  "nudgePatch (AC-15 persisted body)"; `test/adherence-view.test.ts` — "formatNudgeMuted (repeated-miss-nudge
  AC-15)"; `test/adherence-endpoint.test.ts` — "repeated-miss-nudge AC-15 / AC-A3"
- **Manual status:** `pass` (2026-10-11, local, 375 px; device half is AC-17)
- **Manual step-by-step:**
  1. Open *Hoje*, tap *Academia*'s occurrence, scroll to the series section and find the switch
     *Avisar após 3 não concluídas seguidas*, checked, with *Avisos ativos para esta série.*
  2. Turn it off. Expect *Avisos silenciados. Seus lembretes continuam normais.* and no *Salvar* needed.
  3. Close and reopen the sheet; expect it still off. Open *Configurações → Aderência* and expect *Avisos
     silenciados* in *Academia*'s row.
  4. Open the one-off Task's sheet and *Água*'s occurrence (ended): expect **no** switch.

### AC-16 — UI/UX checklist recorded; copy stays pt-BR

- **Risk level:** Medium
- **Required state:** the local fixture
- **Coverage:** automated + manual (vocabulary half automated; the checklist is a manual record)
- **Automated test path:** `test/nudge-switch.test.ts` and `test/nudge-copy.test.ts` — vocabulary guards (no
  falha/falhando/pulada, no percentage sign)
- **Manual status:** `partial` (2026-10-11: copy read on the switch, its two statuses and the Aderência line — pt-BR, no banned words; checklist items still to be run)
- **Manual step-by-step:**
  1. Read every visible string the unit added: the switch label and its two statuses, the Aderência line, and
     the notification title and body.
  2. Expect pt-BR throughout and never "falha", "falhando" or "pulada".
  3. Open `PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md`: items 2, 5 and 11 are *pending live check*
     and 10, 12 and 14 are *owed to the device*; run them and replace each with ✔/✘ before the merge. Confirm
     the immediate-persist exception is recorded.

### AC-17 — Device proof: one notification, tap lands, mute holds

- **Risk level:** Critical
- **Required state:** production (or a staging deploy) with this unit; the PWA installed with notifications
  allowed; a real daily or weekly series the owner lets lapse for three consecutive occurrences
- **Coverage:** manual (owner-observed by definition)
- **Automated test path:** — (none)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Follow `PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md`.
  2. After the third consecutive miss is recorded, wait for the first cron tick at or after 09:00 local.
     Expect **one** notification naming the series.
  3. With the app closed, tap it. Expect the series' open occurrence's sheet.
  4. Let the series miss once more; expect **no** second notification.
  5. Turn the switch off, complete and then miss three more, and expect **no** notification; confirm a Reminder
     of the same series still rings.
  6. Record the observation in `device-proof.md` and the roadmap Delivery history.

---

## Gaps found by review and by the orchestrator's judgment calls

### G-1 — Every stored subscription pruned in one run leaves the claim set

- **Risk level:** Medium
- **Required state:** a due series whose only subscription answers 404/410
- **Coverage:** automated (pins the *current* behaviour; the product decision is open)
- **Automated test path:** `test/repeated-miss-nudge-cron.test.ts` — "AC-A4 (PRD AC-10) … when all
  subscriptions are gone the claim stays set"
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Decide whether this is acceptable: the owner is never told about that run, even after re-subscribing, until
     a completion re-arms it. It is parity with the Reminder sweep.
  2. If not, the fix is to release the claim when no subscription survives; the test must then flip.

### G-2 — First-day burst for series already over the threshold

- **Risk level:** Medium
- **Required state:** several active series already at 3 or more consecutive misses when `0006` ships
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Count the owner's series with 3 or more consecutive `missed` rows in production's latest export.
  2. Expect one notification per such series on the first cron tick after 09:00; decide whether to backfill
     `nudged_at` for old runs so only new runs notify (PRD open question).

### G-3 — Reopening a completed occurrence does not restore the marker

- **Risk level:** Low
- **Required state:** a nudged series whose just-completed occurrence is reopened
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Complete an occurrence of a nudged series (marker clears), then reopen it.
  2. Expect `nudged_at` to stay `NULL`; if the run is again at 3 consecutive misses, a second notification may
     fire. Decide whether that is acceptable (plan risk, code review advisory).

### G-4 — Unresolvable series time zone in the nudge gate

- **Risk level:** Low
- **Required state:** a series with `timezone = 'Mars/Olympus'` at three misses
- **Coverage:** none (no PRD AC; a plan risk row)
- **Automated test path:** —
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Set one series' timezone to an invalid value locally and run the cron.
  2. Expect the nudge to evaluate the 09:00 gate in `America/Sao_Paulo` and the rest of the run to be
     unaffected (compare with the adherence endpoint's fallback, which has a test).

### G-5 — Muted ended series row and the switch's absence for an ended series

- **Risk level:** Medium
- **Required state:** an ended series with `nudge_muted = 1`
- **Coverage:** automated + manual
- **Automated test path:** `test/nudge-switch.test.ts` (null for an ended series); `test/adherence-endpoint.test.ts`
  ("ended series carries the flag")
- **Manual status:** `pass` (2026-10-11); open decision: a muted ENDED series still shows "Avisos silenciados"
- **Manual step-by-step:**
  1. Mute a series, then end its repetition from the sheet.
  2. Open *Aderência*: expect the row to still read *Avisos silenciados* (the plan chose "either status"); decide
     if an ended series should show it.
  3. Open its last occurrence: expect no switch.

### G-6 — Toggling the switch with an unsaved rule edit in the same sheet

- **Risk level:** Medium
- **Required state:** an occurrence of an active series, rule field edited but not saved
- **Coverage:** none (React glue; UI stays manually verified)
- **Automated test path:** —
- **Manual status:** `pass` (2026-10-11)
- **Manual step-by-step:**
  1. Open the sheet, change the frequency chip without pressing *Salvar*.
  2. Toggle the nudge switch; expect the switch to persist and the unsaved frequency choice to stay on screen.
  3. Press *Salvar*; expect both the rule change and the switch to hold.

### G-7 — Window has no upper bound

- **Risk level:** Low
- **Required state:** a miss recorded late in the evening
- **Coverage:** none (PRD open question, accepted by default)
- **Automated test path:** —
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Note when the missed sweep can record a third miss (it runs every five minutes, after midnight for the
     previous day).
  2. Confirm that a late-evening notification is acceptable, or add an end to the window.

### G-8 — Restore drill (chore C6) against a real snapshot after `0006`

- **Risk level:** High
- **Required state:** a real production snapshot from the Scheduled Task, a scratch D1
- **Coverage:** none (`scripts/restore-drill.mjs` is generic over row keys; the new columns were not exercised
  against real data)
- **Automated test path:** — (the boolean binding is covered by `test/restore-values.test.ts`, existing)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Run the restore drill (`documentation/40-engineering/snapshot-task-runbook.md`) with a snapshot taken
     after the migration is applied.
  2. Expect `nudge_muted` and `nudged_at` to restore with the same values and the drill to PASS.

---

## Manual run — 2026-10-11 (local, 375 px, dark)

Run from `.worktrees/repeated-miss-nudge/` on port 5177 against the local D1, with the fixture above
(*Academia* 3 misses, *Ler 20 paginas* 1 miss, *Agua ao acordar* ended and muted).

- **AC-14:** `GET /api/series/<id>` carries `nudgeMuted` and no `nudgedAt`; `GET /api/export` rows carry
  `nudgedAt` (null) and `nudgeMuted`. The adherence endpoint carries `nudgeMuted` per series.
- **AC-15 (passed):** the switch *Avisar após 3 não concluídas seguidas* shows checked with *Avisos ativos para
  esta série.* for *Academia*'s occurrence; its row is 48 px high and the control uses the amber accent. Turning
  it off shows *Avisos silenciados. Seus lembretes continuam normais.* with no *Salvar*, and persisted
  (`nudge_muted = 1` in D1, `nudgeMuted:true` on the API). The *Aderência* row of the muted ended series shows
  *Avisos silenciados*; the unmuted series show nothing.
- **G-6 (passed):** with *Semanalmente* chosen and unsaved, toggling the switch persisted `nudgeMuted` and left
  the unsaved frequency selected (the server still had `daily`); *Salvar* then stored `weekly` (Tue) and the
  switch value together.
- **G-5 / AC-15 step 4 (passed):** no switch on the one-off Task's sheet nor on an occurrence of the ended
  series (that sheet has no repetition block at all).
- **Observation, not a defect of the criteria:** the control renders as a native checkbox with an amber accent
  (`role="switch"` on a checkbox), not as a sliding toggle. Decide whether that reads right on the device.
- **Not run:** AC-17 and the cron half (a delivered notification needs the installed PWA on the owner's phone),
  checklist items 5 (keyboard/focus), 10, 12 (phone half) and 14, and G-1..G-4, G-7, G-8.
