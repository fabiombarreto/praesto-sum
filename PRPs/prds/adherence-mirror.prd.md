# Adherence Mirror

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a PRD that downstream plan, test and implement stages consume); domain rules for tasks (Recurrence Series, occurrences, `missed`); reuse or creation of components (a new pure module in `src/shared`, a new route, a new line on *Hoje*); impact on shared UI (the *Hoje* screen's vertical order, the settings screen); impact on reusable services (`/api/series` gains a read endpoint)
- Decisions found: ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording — adherence history (done, missed, streaks) "derives from real rows at zero extra modeling cost", and the owner chose missed-recording over silent skipping precisely so misses stay constantly visible (vision principle 6, honest mirror; FR-011); recurring-tasks PRD D3 (deleting the open occurrence skips the cycle and counts as neither done nor missed); missed-sweep PRD D-G (*Não concluídas* is the honest home for `missed` rows "until unit 11's aggregated view") and D-H (no notification per miss — unit 12); ADR-0008 test-first; ADR-0009 visible copy pt-BR, everything else English; ADR-0010/ADR-0011 identity and owned UI components; ui-layout-standard §2.1 (never a ratio or a progress bar in the header) and §6 (units 9–12: "adherence as a settings-level route, surfaced on *Hoje* only by counts and plain text"); roadmap rule 2 and "at most one `in-progress`" — this unit opens while unit 10 is still `in-progress` (only its device-proof criterion, an observation, is owed), a recorded exception confirmed by the owner on 2026-10-04, the same shape as units 8 and 9
- Applicable anti-patterns: Hand-duplicated entity types (the adherence wire type lives once in `src/shared/api.ts`, mapped in `src/worker/dto.ts`); Glossary synonym drift ("Recurrence Series", "occurrence", "missed" — never "failed", "skipped", "habit"; visible copy follows the shipped pt-BR term *não concluída*); Portuguese in artifacts (identifiers, tests and docs English); Weakening tests to force green; Editing accepted ADRs (ADR-0006 is applied, not amended); Mirroring Tasks, Reminders or Life Areas to Google (not approached)
- Applicable architectural rules: one Worker serves everything — the endpoint is a Hono route behind the bearer gate; types flow from `src/worker/db/schema.ts` through `src/worker/dto.ts` to `src/shared/api.ts`; `src/shared/` stays DOM-free, clock-free and dependency-free — the adherence computation is a pure function taking `today` as an argument; `src/shared/recurrence.ts` must stay unchanged (unit 17's reuse condition); no new table, so the export completeness guard (`test/export-completeness.test.ts`) is untouched; a failed fetch on *Hoje* never blanks the Task list (the isolation the agenda and Reminders regions already follow); the UI/UX review checklist is a gate before the merge
- Result: PROCEED
```

## Problem Statement

Since unit 10, every occurrence of a recurring Task the owner does not do becomes a permanent `missed` row — but
each one is shown alone, as one line in a collapsed *Não concluídas* group, day after day. Nothing adds them up
per Recurrence Series, so a pattern ("I miss the gym every week") is invisible unless the owner counts by hand,
which he will not do. The cost is the exact failure ADR-0006 names: the honest mirror the owner asked for exists
in the database and not on the screen, and unit 12's repeated-miss nudge has no aggregation to stand on.

## Evidence

- `documentation/20-requirements/functional-requirements.md:44` — FR-011 (Should, accepted): missed occurrences
  are "permanently recorded and constantly visible: per-series adherence (miss counts, streaks, completion rate)
  and a view of recent misses". Traceability (`:117`) assigns the surface to this unit; unit 10 delivered the data.
- `documentation/60-decisions/ADR-0006-recurrence-model.md:21` — the owner's own words (2026-08-03): "if I keep
  failing the same tasks while using the app correctly, I must be notified and constantly see my misses; then it
  is on me to replan or change my behavior."
- The data exists and needs no migration: `recurrence_series.done_count`/`missed_count`/`status`
  (`src/worker/db/schema.ts:80-123`); `tasks.series_id`, `occurrence_date`, `status open|done|missed`, with the
  unique `(series_id, occurrence_date)` index (`src/worker/db/schema.ts:151-227`). No statistics, streak or
  adherence code exists anywhere in `src/`.
- `PRPs/prds/missed-sweep.prd.md` D-G — *Não concluídas* was chosen as the home for `missed` rows explicitly
  "until unit 11's aggregated view"; unit 10's phase 3 shipped it on 2026-10-02 (`TodayScreen.tsx:1060`).
- `documentation/40-engineering/ui-layout-standard.md` §6 already scopes this surface: a settings-level route,
  surfaced on *Hoje* only by counts and plain text; §2.1 forbids a ratio or progress bar in the header.
- **Counter-evidence, recorded rather than hidden:** as of 2026-09-30 production held **one** `recurrence_series`
  row and the owner had **no** real miss. The pain is stated by the ADR and the vision, not yet observed in use,
  and the exit signal ("name the recurring commitment he missed most last month") can only be observed after
  weeks of use with several series.

## Proposed Solution

One pure function in `src/shared/adherence.ts` turns a series' closed occurrence rows plus that series' local
`today` into its adherence: done and closed counts, the current streak, and the `missed` dates of the last 30
days; a second pure function ranks series into the "what I keep failing" list. A read-only endpoint,
`GET /api/series/adherence`, loads every series and its closed rows, computes `today` per series in the series'
time zone, and returns both. The screen surfaces it twice, as the layout standard already decided: a new
*Aderência* route reached from settings, with the per-series detail, and — on *Hoje* — one line of plain text
that appears only when an active series has at least two misses in 30 days and opens that route. Rows, not the
series counters, are the source of truth: the streak and recent misses need the rows anyway, and one source
means the screen can never show two numbers that disagree. Completion is shown as a count (*7 de 10*), never a
percentage: honest about small samples and consistent with the "never a ratio" rule. Alternatives were
rejected deliberately: a decaying habit-strength score (Loop) hides the raw record the owner asked to see; a
route-only surface contradicts "visible without going to look"; adding the count to the *Não concluídas* header
would hide it whenever that group is collapsed, which is its default.

## Key Hypothesis

We believe a passive one-line summary on *Hoje*, backed by a per-series *Aderência* route computed from the real
`done`/`missed` rows, will let the owner see which recurring commitment is slipping without looking for it.
We'll know we're right when, after at least 30 days of use with several active series, the owner names the
series he missed most in the previous month without opening search or any filter.

## What We're NOT Building

- **Any notification about misses** — unit 12 `repeated-miss-nudge` (FR-012) owns it, with its own "not daily,
  not forever" constraint.
- **Percentages, charts, progress bars, heatmaps** — ui-layout-standard §2.1/§6; counts are honest with small
  samples and a ratio shown before the effort is the pattern the standard rejects.
- **Longest streak, streak shields or freezes, decaying strength scores** — FR-011 names the current streak;
  forgiveness mechanics would soften the record the owner chose to keep honest (ADR-0006).
- **Editing, undoing or excusing a miss** — `missed` is terminal and system-written (ADR-0006); there is no
  reopen route for it today and this unit adds none.
- **A migration or a new index** — read-only over existing columns; the database is tiny and the unique
  `(series_id, occurrence_date)` index serves the per-series scan.
- **Adherence for Events** — Events have no completion (ADR-0006); recurring Events are unit 17.
- **Reconciling `done_count`/`missed_count` with the rows** — the counters stay as they are and keep serving the
  `count` end condition; this unit reads the rows (see D-A).

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Exit signal (roadmap unit 11) | The owner names the series he missed most in the previous month without searching or filtering | Asked of the owner after ≥ 30 days of use with ≥ 2 active series; recorded in roadmap Delivery history |
| Fidelity to the rows | 100 % — every count, streak and date on screen equals what the `tasks` rows say | AC-1..AC-12 green; a spot check against a production export on the day of the device proof |
| *Hoje* never blanks because of this unit | 0 occurrences of an empty or errored Task list caused by the adherence fetch | AC-17 (fetch isolation) plus manual check with the endpoint forced to fail |
| Noise on *Hoje* | The line appears only when the threshold is met; never on a day with no qualifying series | AC-15/AC-16 |

## Acceptance Criteria (test scenarios)

Pure function — `src/shared/adherence.ts` (all dates are local calendar dates `YYYY-MM-DD`; "the window" is
the 30 days ending yesterday: `occurrence_date` on or after `today − 30` and before `today`):

- **AC-1 Counts from closed rows:** Given a series whose rows are 7 `done`, 3 `missed` and 1 `open`, when its
  adherence is computed, then `done = 7`, `closed = 10`, and the `open` row is counted in neither.
- **AC-2 Current streak — trailing dones:** Given closed rows ordered by `occurrence_date` as
  `done, missed, done, done, done`, when its adherence is computed, then `currentStreak = 3`.
- **AC-3 Current streak — a miss resets it:** Given closed rows ending in `missed` (`done, done, missed`), then
  `currentStreak = 0`.
- **AC-4 Current streak orders by occurrence date, not insertion or completion time:** Given rows inserted out
  of order and a `done` row completed late (its `completed_at` after the next occurrence's date), when computed,
  then the streak follows `occurrence_date` order only.
- **AC-5 Skipped cycles do not interfere:** Given a series where a cycle was skipped (no row for that date)
  between two `done` rows, then `currentStreak = 2` and `closed` excludes the skipped cycle.
- **AC-6 Detached occurrences count:** Given a `done` row with `detached = true` and the same `series_id`, then
  it counts toward `done`, `closed` and the streak like any other occurrence.
- **AC-7 Recent misses — the 30-day window:** Given `today = 2026-10-31` and `missed` rows dated `2026-09-30`,
  `2026-10-01` and `2026-10-30`, then `recentMisses = ["2026-10-30", "2026-10-01"]` (newest first) and
  `2026-09-30` is outside the window.
- **AC-8 Empty history:** Given a series with no closed rows (only its open occurrence), then `done = 0`,
  `closed = 0`, `currentStreak = 0`, `recentMisses = []` — no division, no `NaN`.
- **AC-9 Ranking — "what I keep failing":** Given series A (3 misses in the window, last on `2026-10-20`), B
  (3 misses, last on `2026-10-28`), C (1 miss) and D (0 misses), when ranked, then the order is `B, A, C` — by
  misses in the window descending, then most recent miss descending, then title ascending, then id — and D is
  absent.
- **AC-10 Purity:** Given phase 1's diff, when the imports and signatures of `src/shared/adherence.ts` are
  inspected, then it imports nothing from the DOM, the Worker, Drizzle or the clock, `today` is always an
  argument, and `git diff` shows `src/shared/recurrence.ts` unchanged.

Endpoint — `GET /api/series/adherence`:

- **AC-11 Shape and auth:** Given no bearer token, then 401. Given the token and two series with rows, then
  200 with one entry per series carrying `seriesId`, `title`, `status`, `done`, `closed`, `currentStreak`,
  `recentMisses`, plus a `ranking` array of `seriesId`s per AC-9; the wire type is declared once in
  `src/shared/api.ts` and mapped in `src/worker/dto.ts`.
- **AC-12 `today` per series time zone:** Given `now = 2026-10-31T01:30Z`, a series in `America/Sao_Paulo`
  (local `2026-10-30`) and one in `UTC` (local `2026-10-31`), each with a `missed` row on `2026-09-30`, then the
  miss is inside the São Paulo series' window and outside the UTC series' window. `now` is injectable in tests.
- **AC-13 Route ordering:** Given a request to `GET /api/series/adherence`, then it is answered by the adherence
  handler, never by `GET /api/series/:id` as an id lookup for `"adherence"`.
- **AC-14 Read-only:** Given any call to the endpoint, then no row in `recurrence_series` or `tasks` changes
  (counts and `updated_at` before and after are identical).

Screen (UI acceptance verified manually per `documentation/40-engineering/testing-strategy.md`; the decidable
parts — threshold and copy selection — live in a pure function and are tested):

- **AC-15 The *Hoje* line — threshold:** Given an `active` series with ≥ 2 misses in the window, when *Hoje*
  loads, then one plain-text line directly below the quick-filter chip row names the top-ranked active series
  and its miss count in the window, plus how many other active series also meet the threshold when there are
  any; tapping it opens the *Aderência* route. The decision "show or not, and which text" is a pure function in
  `src/shared` with tests.
- **AC-16 The *Hoje* line — absent:** Given no active series with ≥ 2 misses in the window (including when the
  only qualifying series is `ended`), then no line, no placeholder and no reserved space are rendered.
- **AC-17 Fetch isolation:** Given the adherence endpoint fails or times out, then the Task list, agenda and
  Reminders on *Hoje* render exactly as without this unit, and the line is simply absent — no banner, no toast,
  no blanked list. On the *Aderência* route the same failure is shown inline and persistently (guidelines §8).
- **AC-18 The *Aderência* route:** Given the owner opens *Configurações → Aderência* (path
  `/settings/adherence`), then he sees, in this order, series with misses in the window (in ranking order), then
  the other active series, then ended series; each shows its title, *N de M feitas*, the current streak and the
  dates of its recent misses; no percentage, chart or progress bar.
- **AC-19 Visible copy:** Given any screen this unit adds or changes, when its visible copy is read, then it is
  pt-BR and uses the shipped term for `missed` (*não concluída*) — never "falha", "falhando" or "pulada" — and
  the UI/UX review checklist's ✔/✘ result is recorded before the merge.
- **AC-20 Device proof (owner-observed):** Given a same-day production export, when the owner opens *Hoje* and
  the *Aderência* route on his own device, then the line (or its correct absence) and every count, streak and
  date match the export's rows, and the observation is recorded in the roadmap Delivery history.

## Open Questions

- [ ] The threshold (≥ 2 misses) and the window (30 days) are starting values; revisit after real use. Unit 12
  will need its own N and may reuse the AC-9 ranking — decide there, not here.
- [ ] Whether the Could item (an adherence block inside an occurrence's series sheet) earns its place — decide
  after the owner uses the route.
- [ ] The exact pt-BR wording of the *Hoje* line is settled in phase 3 against the guidelines; working form:
  *Academia · 4 não concluídas em 30 dias · +2 séries*.

---

## Users & Context

**Primary User**
- **Who:** The owner — the single user — who keeps recurring commitments as Recurrence Series in Praesto.
- **Current behavior:** Sees each `missed` occurrence as one line in a collapsed *Não concluídas* group; to spot
  a pattern he would have to count by hand.
- **Trigger:** Opening *Hoje* in the morning.
- **Success state:** At a glance he knows which recurring commitment is slipping, and in one tap he sees its
  record.

**Job to Be Done**
When I open the app, I want to see which recurring commitment I keep not doing, so I can replan it or change my
behavior.

**Non-Users**
Nobody else — the assistant serves exactly one person (vision, non-goals). This is not gamification or
motivation; it is a mirror.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Pure `src/shared/adherence.ts` — counts, current streak, recent misses, ranking | Every date edge pinned without a database; the decision lives where it can be tested |
| Must | `GET /api/series/adherence` behind the bearer gate | One read, per-series `today`, single wire type |
| Must | *Aderência* route under settings | FR-011's per-series view; the layout standard's settings-level route |
| Must | The one-line summary on *Hoje* | "Visible without going to look" — the Key Hypothesis and the exit signal depend on it |
| Could | An adherence block inside an occurrence's series sheet | Convenient, but a second place to keep correct; wait for use |
| Won't | Notifications, percentages, charts, longest streak, shields, undoing a miss, migration, Event adherence | Unit 12; layout standard; ADR-0006; see What We're NOT Building |

### MVP Scope

The pure function, the endpoint and the *Aderência* route validate the per-series record; the *Hoje* line
validates "without going to look". All four ship in this unit.

### User Flow

Open *Hoje* → (if an active series has ≥ 2 misses in 30 days) read one line naming it → tap → *Aderência* lists
that series first with *N de M feitas*, its streak and its miss dates. Without the line: *Configurações →
Aderência*.

---

## Technical Approach

**Feasibility:** HIGH — read-only over columns that already exist, no migration, a tiny database, and patterns
(pure `src/shared` module + Hono route + isolated fetch on *Hoje*) already shipped in units 4, 7 and 10.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the
Implementer runs.

### Architecture Notes

- **Rows are the source of truth (D-A).** The endpoint selects closed rows (`status in ('done','missed')`) per
  series; `done_count`/`missed_count` are not read. They can drift from the rows because deleting a closed
  occurrence does not decrement them (`src/worker/routes/tasks.ts:528-536`), and they stay the authority only for
  the `count` end condition.
- **`today` per series.** The route computes each series' local `today` from an injectable `now` and the
  series' `timezone` (the existing `todayIn`), then calls the pure function — the same shape as the missed sweep.
- **Route registration order.** `/adherence` must be registered before `seriesRoutes.get("/:id")`
  (`src/worker/routes/series.ts:252`), or `"adherence"` is read as an id (AC-13).
- **Query cost.** One select over `recurrence_series` and one over `tasks where series_id is not null and status
  in ('done','missed')`, grouped in memory — avoids the N+1 the existing `GET /api/series` has. Fits the free
  plan's 10 ms CPU at any realistic size for one person.
- **Screen.** A new `AppRoute` `"adherence"` at `/settings/adherence` in `src/shared/app-route.ts`, an entry on
  `SettingsScreen`, and on *Hoje* an independent fetch with its own state, refreshed on mount and on
  `visibilitychange` like the agenda and Reminders regions. The line sits directly below the chip row — a dated
  amendment to ui-layout-standard §2 records the new slot (D-E).
- **No table added**, so `test/export-completeness.test.ts` and the export manifest are untouched.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Too little real data — the exit signal cannot be observed for weeks | M | Recorded as counter-evidence; AC-20 checks fidelity on whatever data exists; the exit signal is asked after ≥ 30 days |
| Off-by-one at the window edge or the local day boundary | M | The window is defined in AC-7 and tested at its edge; AC-12 pins the time-zone split with an injected `now` |
| The *Hoje* line becomes noise the owner learns to ignore | L | Threshold ≥ 2, only the top series named, active series only; threshold kept as an Open Question |

---

## Implementation Phases

| # | Phase | Description | Status | Repo | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|------|----------|---------|----------|
| 1 | Pure adherence | `src/shared/adherence.ts`: counts, current streak, 30-day recent misses, ranking — clock-free and DB-free, `recurrence.ts` untouched (AC-1..AC-10) | complete | - | - | - | PRPs/plans/adherence-mirror-phase-1-pure-adherence.plan.md |
| 2 | Adherence endpoint | `GET /api/series/adherence` behind the bearer gate, per-series `today`, wire type in `src/shared/api.ts` via `dto.ts`, read-only (AC-11..AC-14) | complete | - | - | 1 | PRPs/plans/adherence-mirror-phase-2-adherence-endpoint.plan.md |
| 3 | The screen | *Aderência* route under settings, the *Hoje* line with its pure show/text decision, fetch isolation, layout-standard amendment, UI/UX checklist, device proof, documentation (AC-15..AC-20) | complete | - | - | 2 | PRPs/plans/adherence-mirror-phase-3-the-screen.plan.md |

### Phase Details

**Phase 1: Pure adherence**
- **Goal:** Every edge of "what does this series' record say" is pinned before any route or screen exists.
- **Scope:** One new module in `src/shared` and its test file; no route, no schema, no UI.
- **Success signal:** AC-1..AC-10 green; `git diff` shows `src/shared/recurrence.ts` unchanged.

**Phase 2: Adherence endpoint**
- **Goal:** The record reaches the wire, computed per series in its own time zone, without changing a row.
- **Scope:** `src/worker/routes/series.ts` (registered before `/:id`), `src/worker/dto.ts`, `src/shared/api.ts`,
  `src/app/api.ts` client function, tests.
- **Success signal:** AC-11..AC-14 green, and the full existing suite green without weakening.

**Phase 3: The screen**
- **Goal:** The owner sees which series is slipping without going to look, and its record in one tap.
- **Scope:** `src/shared/app-route.ts`, a pure show/text function for the *Hoje* line, `SettingsScreen`, a new
  *Aderência* screen, `TodayScreen`; `documentation/` and `docs/` updates per the maintenance map (ui-layout-standard
  §2 amendment, tasks domain area, architecture, roadmap).
- **Success signal:** AC-15..AC-19 verified, the line's pure function tested; UI/UX checklist ✔/✘ recorded before
  the merge; AC-20 observed on the owner's device and recorded in Delivery history.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Opening while unit 10 is `in-progress` | Recorded exception to roadmap rule 2 and "at most one `in-progress`" (owner, 2026-10-04) | Wait for unit 10's device-proof criterion | Unit 10 owes only a device observation, which consumes none of the development hour; same shape as the unit 8 and 9 exceptions |
| D-A — Source of truth | The `tasks` rows (`done`/`missed`); series counters not read | `done_count`/`missed_count` | Streak and recent misses need the rows anyway; one source keeps the screen from showing two numbers that disagree; counters drift when a closed row is deleted |
| D-B — Current streak | Consecutive `done` from the most recent closed occurrence backwards, by `occurrence_date`; a `missed` resets it to 0; skipped cycles leave no row and do not interfere | Longest streak; shields/freezes; decaying strength (Loop) | FR-011 names the current streak; forgiveness mechanics soften the honest record (ADR-0006) |
| D-C — Completion rate | Shown as a count, *N de M feitas*, over all closed occurrences of the series | Percentage; rolling window | Honest with small samples (a % on 2 occurrences is noise); layout standard "never a ratio" |
| D-D — Recent misses and ranking | `missed` dates in the 30 days ending yesterday, local to the series; ranking by misses in the window, then most recent miss, then title, then id; series with 0 misses excluded | Wilson lower bound on the rate; all-time miss count | The exit signal speaks of "last month"; a count is explainable at a glance; Wilson is unreliable below n = 10 |
| D-E — Surface on *Hoje* | One plain-text line directly below the chip row, only when an active series has ≥ 2 misses in the window; names the top series and "+N"; taps to the route; a dated amendment to ui-layout-standard §2 | (B) count in the *Não concluídas* header; (C) route only | (B) is hidden whenever that group is collapsed, its default; (C) contradicts "visible without going to look" |
| D-F — Where the detail lives | *Aderência* route at `/settings/adherence`, reached from settings and from the *Hoje* line | Inside the series sheet | ui-layout-standard §6 decides a settings-level route; the sheet block stays a Could |
| D-G — Ended series | Listed last on the route; never on the *Hoje* line | Hide them entirely | Their record is history worth keeping; nudging about a finished commitment is noise |
| D-H — Visible vocabulary | pt-BR copy uses *não concluída* for `missed` | "Falhando", "falha" (used loosely in the authoring dialogue) | Glossary discipline — *Não concluídas* is the shipped term since unit 10 |
| Migration | None | Add an index on `tasks(series_id, status)` | Read-only; the unique `(series_id, occurrence_date)` index and a tiny database make it unnecessary |

---

## Research Summary

**Market Context**
- Loop Habit Tracker models adherence as a strength score that each repetition raises and each miss lowers, so a
  few misses after a long run do not wipe progress — "unlike many other don't-break-the-chain apps"
  (https://github.com/iSoron/uhabits). The formula was seen only in a search snippet, not verified in source.
- TickTick is described (by a third-party review, not official docs) as having no grace mechanism — a missed day
  breaks the streak; other apps add shields or freezes, and Routinery shows completion analytics instead of
  chains (https://www.routinery.app/blog/streak-based-habit-app-alternatives).
- Practitioner blogs cite the abstinence-violation ("what-the-hell") effect to argue streak breaks can trigger
  quitting, and propose consistency counts instead (https://blog.cohorty.app/the-psychology-of-streaks-why-they-work-and-when-they-backfire/);
  their percentages are unverified, and a medRxiv preprint on streak-break backfire could not be read (403).
- For ranking by a proportion with few observations, the Wilson lower bound is the standard guard, but it is
  itself unreliable below n ≈ 10 (https://github.com/zyca384/expertskills/blob/main/algo-rank-wilson/SKILL.md;
  Sauro & Lewis, https://measuringu.com/papers/sauro-lewisHFES.pdf — text not extractable).
- Gap: no source showed how any app surfaces a "most missed" list passively on a home screen; the threshold and
  ranking here are design choices, kept as Open Questions.

**Technical Context**
- Counters `done_count`/`missed_count`, `status`, `timezone` on `recurrence_series` — `src/worker/db/schema.ts:80-123`.
- Occurrence rows, `missed` status, unique `(series_id, occurrence_date)` and single-open indexes —
  `src/worker/db/schema.ts:151-227`.
- Detached edits keep `series_id` (`patch.detached = true`) — `src/worker/routes/tasks.ts:272`.
- Counter paths: complete +1, reopen −1, sweep +missed, open-occurrence delete counts as neither, closed-row
  delete leaves counters unchanged — `src/worker/routes/tasks.ts:382-394, 507-510, 520-561`; `src/worker/cron.ts:41-98`.
- `GET /api/series` and `/:id` — `src/worker/routes/series.ts:242-252`; DTO mapping — `src/worker/dto.ts:85-122`;
  wire type — `src/shared/api.ts:92-122`.
- *Hoje* structure and per-region fetch isolation; *Não concluídas* group — `src/app/components/TodayScreen.tsx:78-88, 910-1068`.
- Routes — `src/shared/app-route.ts:25-72`; pure-module + test pattern to mirror — `src/shared/missed-sweep.ts`,
  `src/shared/series-edit.ts` with `test/series-edit.test.ts`.
- Export completeness guard (untouched: no new table) — `test/export-completeness.test.ts:19-50`.
- Layout rules — `documentation/40-engineering/ui-layout-standard.md` §2.1, §2.5, §6.

---

*Generated: 2026-10-04*
*Approved: 2026-10-04*
*Status: APPROVED*
