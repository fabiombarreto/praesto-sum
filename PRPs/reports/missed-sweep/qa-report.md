# QA support report — Missed Sweep (unit 10)

- **Mode:** `prd` — source `PRPs/prds/missed-sweep.prd.md` (APPROVED 2026-09-30)
- **Feature slug:** `missed-sweep`
- **Generated:** 2026-10-02 (first generation — every manual status is `pending`)
- **Cases:** 23 (Critical 6, High 12, Medium 5, Low 0) — AC-1..AC-21 plus two gap cases found while grounding
- **Uncovered (`coverage: none`):** 1

## Where the cited code lives

Every automated test path below resolves on branch **`feature/missed-sweep`**
(worktree `.worktrees/missed-sweep`, commit `d8bcb10`), **not** on `main`. A
`test -f` from the main checkout will fail for all of them. Each path was
verified to exist in that worktree before being cited here.

Pipeline grounding used: `PRPs/reports/missed-sweep/phase-{1,2,3}/run.json`
(all three `outcome: GREEN`, suite 1174/1174 at phase 3) and
`phase-3/ui-checklist.md`. Note the recorded `runner_deviation` in all three:
the suite was run by hand rather than through the relay test-runner, because
`.claude/settings.json` is absent at the repo root.

`docs/context/methodology.md` declares `figma_track: false` and no
`fidelity-report.json` exists for this feature, so there is no Visual Fidelity
section.

## Reading the coverage column

`automated` = a real test file asserts this. `manual` = a human must exercise
it; no automated test does. `none` = neither; listed explicitly rather than
omitted. `unverified` in the path column means no automated test could be
confirmed for that case — it is never a guessed path.

---

## Summary table

| # | Case | Risk | Coverage | Automated test path | Manual |
|---|------|------|----------|---------------------|--------|
| AC-1 | Pure and clock-free | Medium | automated | `test/missed-sweep.test.ts` | — |
| AC-2 | Not yet superseded is a no-op | Critical | automated | `test/missed-sweep.test.ts` | — |
| AC-3 | Catch-up leaves one row per whole cycle | Critical | automated | `test/missed-sweep.test.ts` | — |
| AC-4 | Catch-up is bounded (366) | High | automated | `test/missed-sweep.test.ts`, `test/missed-sweep-cron.test.ts` | — |
| AC-5 | Completion anchor | Medium | automated | `test/missed-sweep.test.ts` | — |
| AC-6 | A `count` series ends on its last miss | High | automated | `test/missed-sweep.test.ts` | — |
| AC-7 | An `until` series stops at its limit | High | automated | `test/missed-sweep.test.ts` | — |
| AC-8 | A series the owner ended | Medium | automated | `test/missed-sweep.test.ts` | — |
| AC-9 | Repair starts fresh | High | automated | `test/missed-sweep.test.ts` | — |
| AC-10 | One batch writes the plan | Critical | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-11 | Running it twice changes nothing | Critical | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-12 | A race with a manual completion is harmless | High | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-13 | One series cannot block another | High | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-14 | The sweep runs before the Reminder sweep | High | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-15 | "Today" is the series' local day | High | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-16 | A detached occurrence is missed like any other | Medium | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-17 | The repair runs in the cron | High | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-18 | One-off Tasks are untouched | Critical | automated | `test/missed-sweep-cron.test.ts` | — |
| AC-19 | Closed Tasks split into done and missed | High | automated | `test/task-groups.test.ts`, `test/day-groups.test.ts` | — |
| AC-20 | On screen: *Não concluídas* | High | manual | — | `pending` |
| AC-21 | Exit signal on the owner's device | Critical | manual | — | `pending` |
| G-1 | A non-conflict sweep failure still ships Reminders, then records a failure | High | **none** | — | `pending` |
| G-2 | Completing an already-`missed` occurrence is refused | Medium | manual | `unverified` | `pending` |

---

## Phase 1 — the pure plan (`src/shared/missed-sweep.ts`)

All Phase 1 cases are exercised by the pure planning function with no database
and no clock, so their **required state** is the function's arguments, not DB
rows. They need no login and no seeded data.

### AC-1 — Pure and clock-free

- **Risk:** Medium
- **Required state:** none (pure function arguments only)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-1 Pure and clock-free")` › "returns identical plans across two calls a year apart on the system clock"
- **Manual status:** — (automated; no manual test needed)
- **Manual step-by-step:**
  1. From the worktree, run `npx vitest run test/missed-sweep.test.ts`.
  2. Confirm the AC-1 block passes.
  3. Confirm `src/shared/missed-sweep.ts` imports nothing from `src/worker/` or `src/app/` (grep its import lines).

### AC-2 — Not yet superseded is a no-op

- **Risk:** Critical — a false early miss writes `missed` on a cycle still running, and that row is terminal and system-written. Units 11 and 12 read exactly these rows.
- **Required state:** none (daily series with open occurrence `2026-10-01`; monthly-on-the-5th series with open occurrence `2026-10-05`, as function arguments)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-2 Not yet superseded is a no-op")`, three cases (own day; day before the next one; the day it arrives)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "AC-2"`.
  2. Confirm all three cases pass, in particular that today `2026-11-04` changes nothing for a `2026-10-05` monthly occurrence and `2026-11-05` marks it missed.

### AC-3 — Catch-up leaves one row per whole cycle

- **Risk:** Critical — this is the history record itself; a duplicate or a gap is unrecoverable by the honest mirror.
- **Required state:** none (daily series, open occurrence `2026-10-01`, today `2026-10-04`)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-3 Catch-up leaves one row per whole cycle")` plus `describe("D-A / AC-3 Catch-up never marks the still-running cycle as missed")` (3 further cases: monthly gap, multi-week gap, last allowed occurrence)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "Catch-up"`.
  2. Confirm `2026-10-01` becomes missed, `2026-10-02` and `2026-10-03` are new missed rows, the successor is `2026-10-04`, and the missed count grows by exactly 3.
  3. Confirm the D-A block passes — the cycle still running is never marked missed.

### AC-4 — Catch-up is bounded

- **Risk:** High — an unbounded loop or a 400-cycle write blows the free plan's CPU budget and the cron stops being reliable.
- **Required state:** none for the pure half. For the cron half: a daily series whose open occurrence is 400 days before `now`.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-4 Catch-up is bounded")` (2 cases); cron half in `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A10 (PRD AC-4 / D-B, cron half): a still-past successor gets no Reminders")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "bounded"` and `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A10"`.
  2. Confirm at most 366 missed cycles per run, that the still-past successor is planned **without** Reminders, and that the next run reaches today with Reminders armed.

### AC-5 — Completion anchor

- **Risk:** Medium
- **Required state:** none (`{ freq: "daily", interval: 3, anchorMode: "completion" }`, open occurrence `2026-10-01`)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-5 Completion anchor")` (2 cases)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "AC-5"`.
  2. Confirm today `2026-10-03` changes nothing and today `2026-10-04` marks `2026-10-01` missed with the successor on `2026-10-04`.

### AC-6 — A `count` series ends on its last miss

- **Risk:** High — D6 says a `count` end condition counts done + missed; getting this wrong leaves a series alive past its own limit or kills it early.
- **Required state:** none (monthly series, `endKind: "count"`, `maxCount: 3`, `doneCount: 1`, `missedCount: 1`, open occurrence `2026-10-05`, today `2026-11-05`)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-6 A count series ends on its last miss")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "AC-6"`.
  2. Confirm `2026-10-05` becomes missed, no successor is planned, and the series ends.

### AC-7 — An `until` series stops at its limit

- **Risk:** High
- **Required state:** none (daily series, `untilDate: "2026-10-03"`, open occurrence `2026-10-01`, today `2026-10-10`)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-7 An until series stops at its limit")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "AC-7"`.
  2. Confirm missed rows exist for `2026-10-01`..`2026-10-03`, nothing after `2026-10-03` is planned, no successor exists, and the series ends.

### AC-8 — A series the owner ended

- **Risk:** Medium
- **Required state:** none (series `status: "ended"`, monthly on the 5th, open occurrence `2026-10-05`, today `2026-11-05`)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-8 A series the owner ended")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "AC-8"`.
  2. Confirm only the open occurrence is closed — no intermediate rows, no successor.

### AC-9 — Repair starts fresh

- **Risk:** High — ADR-0006 names the idempotent repair as a non-optional mitigation for dead series. Without it a series silently stops existing for the owner.
- **Required state:** none (active daily series, no open occurrence, last closed `2026-09-01`, today `2026-10-04`)
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep.test.ts` — `describe("AC-9 Repair starts fresh")` (3 cases: fresh open occurrence; past `until`; count already reached)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep.test.ts -t "AC-9"`.
  2. Confirm exactly one open occurrence on `2026-10-04` and **no** missed rows, and that an exhausted rule plans no occurrence and ends the series.

---

## Phase 2 — the sweep in the cron (`src/worker/cron.ts`)

These cases run `runScheduledJob` against local D1 inside workerd. Required
state is seeded directly into D1 by the test; a human reproducing them needs
`npm run dev` and the bearer token from `.dev.vars`.

### AC-10 — One batch writes the plan

- **Risk:** Critical — the actual write. Everything above is a plan; this is the row that lands in the owner's data.
- **Required state:** the AC-3 series in D1 (daily, open occurrence `2026-10-01`) with one reminder offset `[1440]`; `now` inside local day `2026-10-04`.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A1 (PRD AC-10): one batch writes the plan")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A1"`.
  2. Confirm: `2026-10-01` is `missed`; two new `missed` rows for `2026-10-02`/`2026-10-03` carry the template's title, priority and date field and **no** Reminders; exactly one open occurrence on `2026-10-04` with one unsent Reminder at `offsetToInstant("2026-10-04", 1440)`; `missed_count` grew by 3.

### AC-11 — Running it twice changes nothing

- **Risk:** Critical — the cron fires every five minutes. A non-idempotent sweep multiplies the owner's rows 288 times a day.
- **Required state:** the state AC-10 produced; second run with the same `now`.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A2 (PRD AC-11): running it twice changes nothing")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A2"`.
  2. Confirm every row of `tasks`, `reminders` and `recurrence_series` is byte-identical to the state before the second run.

### AC-12 — A race with a manual completion is harmless

- **Risk:** High — the owner completing an occurrence while the cron sweeps it is a real, unavoidable concurrency window.
- **Required state:** an open occurrence the sweep is about to mark missed, with `POST /api/tasks/:id/complete` landing first.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A3 (PRD AC-12): a race with a manual completion is harmless")` (2 cases: ended-series stale plan; stale plan with catch-up rows and a successor rejected whole)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A3"`.
  2. Confirm the sweep writes nothing for that series, no duplicate row exists, the run completes without throwing, and `cron_runs` records a success.

### AC-13 — One series cannot block another

- **Risk:** High — one poisoned series must not stop the owner's other series from advancing.
- **Required state:** two series due for a sweep, the first one's write rejected by a unique-index conflict.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A4 (PRD AC-13): one series cannot block another")` (2 cases, including that `cron_runs` records a success when the only trouble was a conflict)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A4"`.
  2. Confirm the second series is still swept, and that the run is recorded as a success.

### AC-14 — The sweep runs before the Reminder sweep

- **Risk:** High — otherwise the owner's phone rings for an occurrence that was just marked missed. Ordering is the whole mitigation.
- **Required state:** an open occurrence superseded today, still carrying an unsent Reminder whose `fire_at` has passed.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A5 (PRD AC-14): the sweep runs before the Reminder sweep")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A5"`.
  2. Confirm the occurrence is `missed` and **no** push is dispatched for that Reminder.
  3. Read `src/worker/cron.ts` around `runScheduledJob` and confirm `sweepMissedOccurrences` is awaited before the due-Reminder select.

### AC-15 — "Today" is the series' local day

- **Risk:** High — a UTC comparison marks a miss a day early or late, every day, for every series. DST makes it worse.
- **Required state:** a monthly series whose next date is `2026-10-05` in `America/Sao_Paulo`; runs at `2026-10-05T02:30:00Z` and `2026-10-05T03:30:00Z`.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A6 (PRD AC-15): today is the series' local day")` (2 cases, one per instant)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A6"`.
  2. Confirm nothing changes at `02:30Z` (still `2026-10-04` locally) and the occurrence is swept at `03:30Z`.

### AC-16 — A detached occurrence is missed like any other

- **Risk:** Medium
- **Required state:** an open occurrence whose title was edited, so the row is `detached`.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A7 (PRD AC-16): a detached occurrence is missed like any other")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A7"`.
  2. Confirm the missed row keeps the edited title and the successor carries the series template's title.

### AC-17 — The repair runs in the cron

- **Risk:** High
- **Required state:** an active series with no open occurrence.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A8 (PRD AC-17): the repair runs in the cron")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A8"`.
  2. Confirm exactly one open occurrence exists afterwards with its Reminders armed, and that **no** `missed` row was added.

### AC-18 — One-off Tasks are untouched

- **Risk:** Critical — the blast radius is every non-recurring Task the owner has, which today is almost all of them. A sweep that touches `series_id = null` rows corrupts the bulk of the owner's data.
- **Required state:** a Task with `series_id = null` whose deadline is 30 days past.
- **Coverage:** automated
- **Automated test path:** `test/missed-sweep-cron.test.ts` — `describe("missed sweep in the cron — AC-A9 (PRD AC-18): one-off Tasks are untouched")`
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/missed-sweep-cron.test.ts -t "AC-A9"`.
  2. Confirm the series-less Task is still `open` and byte-unchanged.

---

## Phase 3 — the screen

### AC-19 — Closed Tasks split into done and missed

- **Risk:** High — if a missed occurrence lands under *Concluídas* the screen tells the owner he did something he did not do. That is the dishonesty this unit exists to remove.
- **Required state:** a list holding open, `done` and `missed` Tasks (pure function input; no DB).
- **Coverage:** automated
- **Automated test path:** `test/task-groups.test.ts` — `describe("groupTasks — status is read before the dates")` (7 cases, incl. "splits a mixed closed list: done to done, missed to missed, each in arrival order", "leaves the open buckets unchanged when done and missed Tasks sit among them", "returns the same Task objects in done and missed, not copies"); `test/day-groups.test.ts` — `describe("collectDayItems — closed items split into done and missed")` (4 cases)
- **Manual status:** —
- **Manual step-by-step:**
  1. Run `npx vitest run test/task-groups.test.ts test/day-groups.test.ts`.
  2. Confirm the concatenation of all buckets still reproduces the input (no row lost, none duplicated).

### AC-20 — On screen: *Não concluídas* (manual)

- **Risk:** High
- **Required state:** the owner's own account with **at least one `missed` occurrence** in D1. Seed it by creating a recurring Task, letting its occurrence be superseded (or setting `tasks.status = 'missed'` directly on the occurrence row via `wrangler d1`), then loading *Hoje*. Requires the bearer token (ADR-0003) present in IndexedDB — the screens are behind the token gate.
- **Coverage:** manual — the project keeps UI verification manual by methodology (`docs/context/methodology.md`, "UI stays manually verified"); there is no browser test tier, and that tier was rejected at its own trigger.
- **Automated test path:** — (none; the `groupTasks`/`collectDayItems` logic is covered by AC-19, the rendering is not)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Start `npm run dev` and open the app with a valid bearer token in IndexedDB.
  2. Ensure at least one `missed` occurrence exists (see required state).
  3. Open *Hoje*. Confirm *Concluídas* lists **only** completed Tasks.
  4. Confirm a separate *Não concluídas* group exists, is **collapsed by default**, and shows its count in the header.
  5. Expand it and confirm the missed occurrence is listed there with its *não concluída* meta line and a disabled complete control.
  6. Repeat steps 3–5 on the search screen.
  7. Confirm every visible string is pt-BR (ADR-0009).
  8. Run the UI/UX review checklist in `documentation/40-engineering/ui-ux-guidelines.md` and paste the ✔/✘ result before the merge.
- **Known gap in the existing checklist run:** `PRPs/reports/missed-sweep/phase-3/ui-checklist.md` was produced **by code reading only** — no browser pane and no device were used. It explicitly marks as `OWED to the owner`: a measured 48×48 touch-target pass in a rendered DOM, a visible focus-ring check, and a real keyboard pass on the group header. AC-20 is not discharged until those three are done on a rendered screen.

### AC-21 — Exit signal on the owner's device (manual)

- **Risk:** Critical — this is the unit's exit signal and the only evidence the sweep works where it matters: a real cron, a real device, no app open.
- **Required state:** a real **daily** series **in production** whose occurrence the owner deliberately does not do. Requires the branch to be merged and deployed (`npm run deploy`) — as of this report the code is on `feature/missed-sweep` and **not deployed**, so AC-21 is blocked on the merge.
- **Coverage:** manual
- **Automated test path:** — (none; a production cron and a physical device cannot be asserted from Vitest)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Merge and deploy the unit (`npm run deploy`).
  2. In production, create a daily recurring Task and let today's occurrence stand undone.
  3. Do **not** open the app for the rest of the day.
  4. After local midnight, open the app. Confirm yesterday's occurrence shows as *não concluída*.
  5. Confirm today's occurrence is open with its Reminder armed.
  6. Open the diagnostics screen and confirm a later cron run has happened.
  7. Confirm that later run changed neither row.
  8. Record the observation in the roadmap's Delivery history as the unit's device proof.

---

## Gap cases found while grounding

These are not PRD Acceptance Criteria. They are behaviours present in the
implementation whose coverage could not be confirmed, listed here rather than
omitted.

### G-1 — A non-conflict sweep failure still ships Reminders, then records a failure

- **Risk:** High — if the rethrow at `src/worker/cron.ts:258` were ever dropped, a crashing sweep would record `outcome: "success"` in `cron_runs` and the diagnostics screen would lie to the owner. Telling the truth in `cron_runs` is exactly what unit 6 was closed on.
- **Required state:** a sweep that throws an error which is **not** a unique-index conflict, with due Reminders pending in the same run.
- **Coverage:** **none**
- **Automated test path:** — (no test references `sweepError`; `src/worker/cron.ts:189,193,258` implement remember-then-rethrow and no test exercises that path. AC-12/AC-13 cover only the *conflict* branch, which is swallowed deliberately.)
- **Manual status:** `pending`
- **Manual step-by-step:** not reproducible by hand without injecting a fault into the sweep, so no manual procedure is proposed. **Recommendation:** add one automated test before the merge — force `sweepMissedOccurrences` to throw a non-conflict error, then assert (a) the due Reminders still went out, and (b) `cron_runs` records `outcome: "failure"` with the error message.

### G-2 — Completing an already-`missed` occurrence is refused

- **Risk:** Medium — ADR-0006 allows late completion only *until* the next occurrence arrives. After the sweep the row is terminal, and `POST /api/tasks/:id/complete` must not resurrect it or double-count it.
- **Required state:** a Task row with `status = 'missed'` and a known id.
- **Coverage:** manual
- **Automated test path:** `unverified` — the guard exists (`src/worker/routes/tasks.ts:357`, `existing.status !== "open"` → 404), and `test/tasks.test.ts` does set `status: "missed"` at lines 163 and 188, but those assert the partial unique indexes, not the complete-route refusal. No test was found that pins "complete a `missed` occurrence → 404".
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. With `npm run dev` running, set a series occurrence to `missed` via `wrangler d1` and note its id.
  2. Send `POST /api/tasks/<id>/complete` with the `Authorization: Bearer <token>` header.
  3. Confirm the response is `404` and the body names no open Task.
  4. Confirm `recurrence_series.done_count` and `missed_count` are unchanged, and that no successor row was spawned.
