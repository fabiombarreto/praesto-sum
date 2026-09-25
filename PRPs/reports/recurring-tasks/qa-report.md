# QA report — unit 9 `recurring-tasks`

**Source:** `PRPs/prds/recurring-tasks.prd.md` (APPROVED, with two dated amendments — AC-5 and AC-9)
**Generated:** 2026-09-25 · **Mode:** PRD · **Cases:** 31

**State at generation.** Merged as `8f21896` (PR #6). **Not deployed.** Last production deployment is
`542d4fb4` (2026-09-17, v0.8.1). Migration `0005` is **not applied to the remote D1** —
`wrangler d1 migrations list praesto-db --remote` still lists it as pending.

**Grounding.** No `PRPs/reports/recurring-tasks/record.json` exists, so automated coverage below was inferred
by reading the repository's test files directly. Every cited path was checked to resolve to a real file before
being written here; nothing is cited from memory. Suite at merge: 1087 tests across 69 files.

**Read case 29 before anything else.** It is an ordering constraint, not a test, and getting it wrong is the
only way this unit can quietly corrupt data.

---

## Summary

| Risk | Cases |
|---|---|
| Critical | 5 |
| High | 11 |
| Medium | 11 |
| Low | 4 |

| Coverage | Cases |
|---|---|
| automated | 25 |
| manual | 5 |
| **none** | **1** |

The single `none` is case 16b — PRD AC-16's "(or null)" read branch. It is disclosed here rather than folded
into case 16, per the honesty rule.

---

## A. The pure expansion function (AC-1..AC-10)

All ten are automated in `test/recurrence.test.ts` and need no database state — the module reads no clock and
touches no DB, which is the unit's own design condition. They are listed individually because each pins a
distinct arithmetic edge, and a regression in any one is invisible from the screen.

| # | Title | Risk | Required state | Coverage | Automated test path | Manual status |
|---|---|---|---|---|---|---|
| 1 | Clock-freedom — identical results with the system clock faked a year apart | Critical | none | automated | `test/recurrence.test.ts:59` — "AC-1 Clock-free" | n/a |
| 2 | Monthly by month day — the 5th spawns the next 5th | High | none | automated | `test/recurrence.test.ts:80` — "AC-2 Monthly by month day" | n/a |
| 3 | Month-day overflow clamps BACKWARD and re-derives the track | Critical | none | automated | `test/recurrence.test.ts:92` — "AC-3 Month-day overflow clamps backward (D1)" | n/a |
| 4 | Weekly with weekdays and interval | Medium | none | automated | `test/recurrence.test.ts:106` — "AC-4 Weekly with weekdays and interval" | n/a |
| 5 | Daily and yearly, including the amended Feb-29 sequence | High | none | automated | `test/recurrence.test.ts:119` — "AC-5 Daily and yearly" | n/a |
| 6 | Calendar anchor keeps the original track even when the next date is already past | High | none | automated | `test/recurrence.test.ts:148` — "AC-6 Calendar anchor keeps the track" | n/a |
| 7 | Completion anchor counts from the completion day; throws without it | High | none | automated | `test/recurrence.test.ts:161` — "AC-7 Completion anchor counts from the completion day (D5)" | n/a |
| 8 | End conditions — `until` and `count` return null at the boundary | High | none | automated | `test/recurrence.test.ts:179` — "AC-8 End conditions (D6)" | n/a |
| 9 | Bounded window; completion-anchored rules refused explicitly | Medium | none | automated | `test/recurrence.test.ts:204` — "AC-9 Bounded window expansion for unit 17" | n/a |
| 10 | Reminder instants compose `offsetToInstant`, DST included | High | none | automated | `test/recurrence.test.ts:225` — "AC-10 Reminder instants for an occurrence" | n/a |

**Note on case 3.** The track is re-derived from the rule each period, never from the previously clamped date.
That is why a series on the 31st reads `31 → 28 → 31 → 30` and not `31 → 28 → 28 → 28`. A regression here
drifts a rent reminder earlier every month and would take months to notice by eye.

**Note on case 5.** PRD AC-5 originally listed `2028-02-29, 2029-02-28, 2030-02-28, 2032-02-29`, skipping
2031. Amended 2026-09-23 with the owner's confirmation. The test asserts the corrected five-date chain.

---

## B. The series API (AC-11..AC-18)

Automated in `test/series.test.ts`, running inside workerd against an ephemeral D1.

| # | Title | Risk | Required state | Coverage | Automated test path | Manual status |
|---|---|---|---|---|---|---|
| 11 | `POST /api/series` materializes the first occurrence with its reminders | Critical | none (the route creates everything) | automated | `test/series.test.ts:97` | n/a |
| 12 | Reminder offsets resolve against the occurrence's own date field (D9) | High | none | automated | `test/series.test.ts:121` | n/a |
| 13 | Validation writes nothing — nine bad bodies, each a 400 naming the field | High | none | automated | `test/series.test.ts:140` | n/a |
| 14 | `priority` is enforced twice — TS union and SQL CHECK (migration 0005) | High | migration `0005` applied | automated | `test/series.test.ts:176` | n/a |
| 15 | Token gate — no bearer token, 401, nothing written | Medium | none | automated | `test/series.test.ts:198` | n/a |
| 16 | Read a series with its current open occurrence id | Medium | one active series with an open occurrence | automated | `test/series.test.ts:232` | n/a |
| 17 | Template edits reach the open non-detached occurrence only (D7) | High | a series with two closed occurrences and one open | automated | `test/series.test.ts:277` | n/a |
| 18 | Ending a series — the open occurrence stays, no successor later | Medium | an active series with an open occurrence | automated | `test/series.test.ts:346` | n/a |

### 16b — AC-16's "(or null)" branch — **UNCOVERED**

- **Risk:** Low
- **Required state:** a series whose end condition has been reached, so no successor exists
- **Coverage:** **none**
- **Automated test path:** — (no test asserts `openOccurrenceId === null`)
- **Manual status:** pending
- **Why it is here:** `test/tasks.test.ts:381` ("AC-21 … End conditions stop the series") already *executes*
  this exact path — it ends a series and calls `getSeries()` — but asserts only `.status` and `.doneCount`,
  never `.openOccurrenceId`. So the behavior runs and is almost certainly correct; the assertion is missing.
  Closing it is one line on two already-green cases. Deferred twice with reasons during phases 3 and 4, and
  agreed deferrable by the post-green reviewer, but it does not close on its own now that the unit is built.
- **Manual step-by-step:**
  1. Create a series with *Depois de 2 vezes*.
  2. Complete both occurrences.
  3. `GET /api/series/:id` with the bearer token.
  4. Expect `openOccurrenceId` to be `null` and `status` to be `ended`.

---

## C. Materialization on close (AC-19..AC-25)

Automated in `test/tasks.test.ts`. **This is the section that touches the owner's existing data** — the three
write paths it changes were shipped and in use long before this unit.

| # | Title | Risk | Required state | Coverage | Automated test path | Manual status |
|---|---|---|---|---|---|---|
| 19 | Completing spawns exactly one successor, with reminders, in one batch | Critical | an active series with an open occurrence | automated | `test/tasks.test.ts:306` | n/a |
| 20 | No duplicate successor — sequential and concurrent double-complete | Critical | same | automated | `test/tasks.test.ts:343` | n/a |
| 21 | End conditions stop the series; no successor, status `ended` | High | a series with `count: 2` and one closed occurrence | automated | `test/tasks.test.ts:381` | n/a |
| 22 | A `detached` occurrence's edit never leaks into the successor (D2) | High | an open occurrence edited via `PATCH` so `detached` is true | automated | `test/tasks.test.ts:419` | n/a |
| 23 | Deleting the open occurrence skips the cycle (D3) | High | an active series with an open occurrence | automated | `test/tasks.test.ts:438` | n/a |
| 24 | Reopen undoes the spawn, or refuses with 409 leaving every row intact (D10) | Critical | a completed occurrence plus its successor, in both touched and untouched states | automated | `test/tasks.test.ts:494` | n/a |
| 25 | One-off Tasks unaffected — no `successor` key, response byte-identical | High | one Task with `series_id = null` | automated | `test/tasks.test.ts:604` | n/a |

**Note on case 20.** The guard is structural, not defensive coding: the partial unique indexes
`tasks_series_single_open_unq` and `tasks_series_occurrence_unq` have been in the database since migration
`0000`. The losing write collides at the index and is mapped to a handled `409`, never a 500.

**Note on case 25.** This is the regression guard for every Task the owner already has. If it fails, the unit
broke completion for non-recurring Tasks — the most-used action in the app.

---

## D. The screen and the device proof (AC-26..AC-28)

The pure module underneath the sheet is automated in `test/series-edit.test.ts` (34 cases). The screen itself
is verified manually by recorded decision — `documentation/40-engineering/testing-strategy.md` and
`docs/context/methodology.md` keep UI verification manual, so these produce no test file by design, not by
omission.

### 26 — Create a series from the Task sheet and see it on the row

- **Risk:** High · **Coverage:** manual (the draft-to-wire mapping underneath is automated at
  `test/series-edit.test.ts:199`, `:223`, `:276`) · **Manual status:** pending
- **Required state:** a deployed build with migration `0005` applied remotely; the app installed and the
  bearer token stored
- **Steps:**
  1. Open *Hoje*, create a Task "Pagar aluguel".
  2. Set *Prazo* to the 5th of next month.
  3. Open *Repetir* → *Todo mês*. Leave the end condition on *Nunca*.
  4. Save.
  5. Expect the Task to appear under its date group carrying the **series glyph** in its row metadata (the
     `Repeat` icon plus the word *Repete*).
  6. Expect no duplicate Task left behind — the conversion is create-then-delete, so a visible duplicate here
     means the delete half failed and should be reported, not cleaned up silently.

### 27 — A reminder set to an absolute time is not dropped silently

- **Risk:** High · **Coverage:** manual (the flag is automated at `test/series-edit.test.ts:314` and `:341`) ·
  **Manual status:** pending
- **Required state:** as case 26
- **Steps:**
  1. On a new Task, add a Reminder using an **absolute** date and time (not "X antes").
  2. Now set *Repetir* on the same Task.
  3. Expect an explicit pt-BR notice on screen saying the reminder will not carry into the series.
  4. Expect it NOT to silently vanish. A silent drop is the failure this case exists to catch.

### 28 — UI/UX review checklist

- **Risk:** Medium · **Coverage:** manual · **Manual status:** pending
- **Required state:** none
- **What already happened:** the checklist ran **before the merge**, which is the rule the v0.8.1 incident
  produced, and its result is recorded in `PRPs/plans/completed/recurring-tasks-phase-4-the-screen.plan.md`
  under "UI/UX Checklist Result". It was a **static inspection, not a live browser pass** — that limitation is
  written into the record.
- **Steps (what remains):**
  1. On a real device, check item 6: the two new inputs (`sheet-recurrence-until`, `sheet-recurrence-count`)
     carry `aria-label` with no `<label>` element, mirroring the already-shipped `sheet-date` input.
  2. Check item 2 (touch targets) and item 5 (visible focus) by touch rather than by class inspection.
  3. Item 6's pattern is pre-existing, so a finding here is a project-wide observation, not a defect this unit
     introduced.

### 29 — **Deploy order: migration `0005` before the Worker** ⚠

- **Risk:** Critical · **Coverage:** none (this is an ordering constraint, not a behavior) · **Manual status:** pending
- **Required state:** production; `wrangler` authenticated
- **Why it is Critical:** the deploy runbook applies migrations to the remote D1 *before* deploying. Reversed,
  the new Worker writes `priority` into a column that is still `integer` with no CHECK — the code works, the
  database silently accepts a value the domain forbids, and the "enum enforced twice" rule is defeated exactly
  where it matters. Production currently holds **zero** `recurrence_series` rows (verified read-only), so
  applying the migration is safe; the risk is entirely in the ordering.
- **Steps:**
  1. `npm run db:migrate:remote` — confirm `0005_quiet_rogue.sql` applies.
  2. `npx wrangler d1 migrations list praesto-db --remote` — confirm nothing is left pending.
  3. `npm run deploy`.
  4. Smoke: `GET /api/tasks` without the token → 401; with it → 200.
  5. Note: `GET /api/series` returning 401 proves **nothing** about whether the route deployed — the
     `/api/*` token middleware answers before route dispatch. Use an authenticated request to tell them apart.

### 30 — The exit signal: complete a real occurrence (AC-28)

- **Risk:** Critical · **Coverage:** manual · **Manual status:** pending
- **Required state:** deployed build; one **real** series the owner actually cares about, not a `Teste` row
- **Why it is the one that matters:** this is the unit's exit signal. No agent can supply it, and neither a
  green suite nor a merge grants it. Until this passes, unit 9 stays `in-progress`.
- **Steps:**
  1. Create a real recurring commitment (rent, a bill, a medication).
  2. Let its reminder fire, or complete the occurrence directly.
  3. Complete it.
  4. Expect the next occurrence to appear **on the correct date**, with its reminder armed, **with nothing
     else done**.
  5. Check the successor's date against the rule by hand once — that is the whole claim.

### 31 — After a month: exactly one open occurrence, no duplicates

- **Risk:** Medium · **Coverage:** manual · **Manual status:** pending
- **Required state:** one real series, a month of use
- **Steps:**
  1. After several cycles, export the data (`/api/export`) or query production.
  2. Group `tasks` by `series_id`: expect exactly one row with `status = 'open'`.
  3. Group by `(series_id, occurrence_date)`: expect no duplicates.
  4. Expect one closed row per completed cycle — that history is what units 10–12 will read.

---

## What this report deliberately does not claim

- **No automated test exercises the deployed production build.** Every `automated` entry above ran inside
  workerd against an ephemeral D1 in CI-less local runs. They prove the logic, not the deployment.
- **Case 16b is a real, open coverage gap**, not a rounding error, and it is listed rather than absorbed.
- **Cases 26–28 were verified by static inspection only** at the time of writing. The device column is empty
  for a reason: nobody has opened this on a phone yet.

---

## Execution record — local environment, 2026-09-25

Run against `npm run dev` (workerd + local D1, migrations `0004`/`0005` applied) with the local `.dev.vars`
token. **Production was not exercised**: its bearer token is a different secret, and the write-path cases would
leave a `recurrence_series` row the API cannot delete (hard-delete is a PRD Won't).

### Verified

| Case | Result |
|---|---|
| 11 create | series + first occurrence + reminder at `2026-10-05T02:59Z` — 23:59 local minus 1440 min, correct |
| 12 scheduled dateMode | occurrence carried `scheduledDate`, not `deadline` |
| 13 validation | five bad bodies, each `400` naming the field, nothing written |
| 15 token gate | `401` without, **`200` with** — the 200 is what proves the route is mounted |
| 16 read | `openOccurrenceId` tracked the successor after a completion |
| **16b (was uncovered)** | **`openOccurrenceId` is `null` on an ended series — the behavior is correct; only the assertion was missing** |
| 19 complete | successor `2026-11-05`, `doneCount` 1, its reminder armed at `2026-11-05T02:59Z` |
| 20 double complete | `404 {"error":"No open Task with that id"}` — handled, not a 500; no second successor |
| 21 end conditions | `status: ended`, `doneCount: 2`, `successor: null` |
| 22 detached | `PATCH` set `detached = 1`; the successor kept the template's title |
| 23 delete = skip | `204`, successor spawned a week on (`2026-10-13`), neither counter moved |
| 24 reopen (undo) | successor deleted, its unsent reminder deleted, `doneCount` back to 0 |
| 24 reopen (refuse) | **`409` — "A próxima ocorrência já existe e não pode mais ser desfeita"**, every row unchanged |
| 26 screen | *Repetir* group in pt-BR; series created from the sheet; **exactly one Task left** — create-then-delete left no duplicate |
| 26 glyph | row reads `⇄ Repete até seg., 05/10`, confirmed visually |
| 30 (UI equivalent) | completing the occurrence **from the row** spawned the successor and the screen showed `05/11` **without a reload** |

### Findings

1. **~~Validation error copy is English where unit 7's precedent is pt-BR.~~ FIXED 2026-09-25.** `POST /api/series` returns
   `"title is required"`, `"Unknown freq: hourly"`, `"interval must be an integer >= 1"`. The same route's 404
   and 409 *are* pt-BR (`"Série não encontrada"`, `"A próxima ocorrência já existe…"`), and unit 7's
   `reminders.ts` uses pt-BR for the equivalent validation (`"Informe um label ou uma tarefa"`). `runSheet`
   surfaces API errors into `sheetError`, which is on screen, so these can reach the owner. In practice the
   client validates first in pt-BR (`"Escolha uma data para a Tarefa antes de repetir."`), which is why this
   is Low and not High. No test catches it — the suite asserts the field is *named*, never the language.

   **Resolution.** All 25 owner-facing validation messages on `/api/series` are now pt-BR, each keeping the
   machine-readable field identifier in parentheses (`"O dia do mês deve ser um inteiro entre 1 e 31
   (byMonthday)"`) so AC-13's "naming the offending field" contract still holds and a client can still highlight
   the field. The two `"Body must be a JSON object"` messages stay English deliberately — that is a malformed
   request, not owner-facing validation, and unit 7's `reminders.ts` keeps its own in English for the same
   reason. A regression guard was added at `test/series.test.ts` ("answers validation errors in pt-BR, while
   still naming the field"): the AC-13 table matches on field names and never on copy, so it stayed green
   through the entire regression — which is precisely why a copy-level guard was needed.

2. **The QA report's own case 29 was exercised for real.** Migration `0005` went to the remote D1 before the
   deploy, in the runbook's order.

### Two near-misses worth recording, because they are how a QA run produces a false bug report

- I set a date with `input.value` and the pt-BR alert stayed up. That looked like a defect. It was not: the
  *Data* group has three mode chips — *Sem data · Concluir até · Fazer em* — and the date only counts once a
  dated mode is chosen. `Sem data` was still selected, so the app was right and the driver was wrong.
- Row completion appeared not to persist, and the network buffer showed no `POST …/complete` for the
  occurrence. Both signals were artifacts: my `ref`-based clicks were landing outside the 48 px control, and
  that buffer drops older entries. The discriminator that settled it was completing a **one-off** Task through
  the identical path — it persisted, so the control was fine. A screenshot then showed the clicks were missing
  the target.

### Not covered by this run

- **Case 30 proper (AC-28)** — the exit signal needs a *real* series on the owner's own device, over real
  cycles. A local dev click is not that, and this run does not advance it.
- **Case 28's device items** — touch targets, visible focus, and the `aria-label` question need a real screen.
- **Case 27** — the absolute-time reminder carry-over notice was not exercised; the pure module that decides it
  is automated (`test/series-edit.test.ts:314`, `:341`), the on-screen notice is not.
- **Production write paths** — deliberately not exercised, for the token and residue reasons above.

**Local database left clean:** every row this run created (4 series, 8 Tasks, their reminders, all titled
`QA …`) was deleted afterwards. `recurrence_series` is back to 0 rows locally.

---

*Generated: 2026-09-25*
*Status: DRAFT — manual statuses are `pending` until a human records otherwise*
