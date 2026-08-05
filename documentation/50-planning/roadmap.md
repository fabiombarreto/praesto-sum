---
status: active
last_updated: 2026-08-05
review_trigger: "a unit changes state, a unit is reordered/deferred/dropped, a chore is executed, a phase opens or closes, or a backlog idea is triaged"
---

# Roadmap

> **Purpose:** The single place that states where the project is now, what comes next, and what has been delivered — deliberately isolated so its volatility does not contaminate the stable documents.
> **Update when:** A unit changes state or position, a chore runs, a phase opens or closes, a backlog idea is triaged, or anything ships.

## Current phase

> **Phase 1 — MVP Tasks** · started 2026-08-03 · **in progress**

Phase 0 (documentation & foundational decisions) closed on 2026-08-03: the full document set was validated by the owner and decisions 1–3 were resolved as ADRs ([decisions index](../60-decisions/index.md)). The [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) stack is scaffolded and verified end to end. Work now flows through the **delivery units** below, one at a time.

## Phases and milestones

> Phase cut lines and exit criteria for Phases 1–2 confirmed by the owner on 2026-08-03. The FR → phase mapping lives in the [functional-requirements traceability](../20-requirements/functional-requirements.md#traceability).

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Documentation & decisions** | Write the full document set; resolve foundational technical decisions | All docs approved by the owner **and** pending decisions 1–3 resolved as ADRs |
| **1 — MVP Tasks** | Units 1–13 | The owner manages daily Tasks in the assistant instead of the current scattered notes |
| **2 — Calendar** | Units 14–20 | The owner manages his commitments **from** Praesto, with Google Calendar remaining as a mirror and interoperability surface |
| **Later — future Life Areas** | Life Areas beyond Tasks and Calendar | TBD — pending owner input |

Two internal milestones inside Phase 1, as reading aids (not gates):

- **M1 — usable and portable** (end of unit 5): the owner captures, edits, dates and sees the day — his real Google commitments included — and can take 100% of the data away. This is when the "first usable version" of [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) exists *with* its export safeguard already in place — the honest moment to start migrating the scattered notes in.
- **M2 — the assistant acts on its own** (end of unit 7): `scheduled()` stops being a stub and the phone rings with the app closed. FR-041 is fulfilled in practice from here.

Phase 1's exit criterion becomes verifiable — not merely declarable — once unit 12 is `shipped` and the app holds two weeks of real data with at least one recurring series producing genuine `missed` rows.

**Declared phase exception:** unit 4 `google-calendar-read` is calendar-adjacent but sits in Phase 1 on purpose — it is read-only, creates no new entity, and directly serves Phase 1's exit criterion by making Praesto the app the owner opens every morning. Recorded here so the "a phase opens only when the previous closes" rule is not violated silently.

Phases are sequential; a phase opens only when the previous one meets its exit criteria.

> **Pending decision 4 was resolved on 2026-08-04** by [ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md): bidirectional Google Calendar sync for **Events only**, `calendar.events` scope, conservative phasing (read in Phase 1, write in Phase 2). Chores **C11/C12** remain a hard gate in front of it: while the OAuth app sits in "Testing" publishing status Google issues refresh tokens that **expire every 7 days**, which would violate QA-002 outright, and no primary source settles whether publishing a sensitive scope needs verification first. C11 runs now so its 8-day clock elapses while units 1–3 are built. Unit 4 may not be planned before C8 (the ADR is written) and C11 return; unit 15 may not be planned before C12 confirms the token survives.

## Delivery units

> This table is a **living guide, not a schedule**. There are no promised dates — only order and dependencies. The order is a hypothesis about what serves the owner best *now*; it should change when real use says otherwise. A recorded reordering is not a planning failure — it is the document working.

Each unit is one PRD (`PRPs/prds/<unit>.prd.md`), sized to the owner's ~1 h/day budget (CON-003). Estimates are in days of ~1 h and are a **floor**, excluding the PRD → plan → review cycle itself — and, since [ADR-0008](../60-decisions/ADR-0008-adopt-test-first-methodology.md), excluding the test-first pass that now precedes every implementation. They were not rewritten: a floor that rises is still a floor, and the ~10-day ceiling rule (split, never inflate) still applies.

| # | Unit | Outcome | FRs | Depends on | Est. | State | Exit signal |
|---|---|---|---|---|---|---|---|
| 1 | `install-and-quick-capture` | Praesto sits on the phone's home screen; capture takes seconds and needs no hand-typed token; a dead network says so instead of breaking | FR-045, FR-001 | — | 4 | **in-progress** | The icon is on the owner's home screen and a *real* Task was added without opening a browser or typing a token |
| 2 | `task-detail-and-dates` | Anything captured in a hurry can be fixed: title, description, deadline or scheduled date, priority, complete, reopen, delete | FR-002, FR-005, FR-006, FR-003, FR-004 | 1 | 5 | planned | A Task created in a hurry was later corrected (title and date) instead of deleted and recreated |
| 3 | `today-view-and-filters` | Opening the app answers "what is today?" — today, overdue, upcoming, undated — with filters by status, date and priority | FR-007 | 2 | 4 | planned | The owner answers "what's today?" without scrolling the whole list and without touching a filter |
| 4 | `google-calendar-read` | After a one-time authorization (with disconnect shipped the same day), the owner's real Google commitments appear **inside** the today screen next to his dated Tasks, visually distinct and read-only; he picks which calendars come in; Google being down shows an explicit state, never an empty screen pretending the day is free | FR-027, FR-030 | 3, C8, C11 | 5 | planned | For a week the owner opened Praesto in the morning and saw his real Google commitments beside his Tasks, without opening Google Calendar to check the day — and the range query is ONE function taking a list of sources, proved by a test calling it with zero, one and two sources |
| 5 | `data-export` | One click (or a curl with the token) downloads 100% of the data as documented JSON, plus an `.ics` of dated items | FR-042, FR-043 (mechanism) | 3 | 3 | planned | A dated `.json` with 100% of the data sits on the owner's PC, readable outside the app; the completeness test fails if a new table is added to the schema without being dumped |
| 6 | `push-channel-proven` | The phone rings with the app closed; tapping the notification opens the app; a diagnostics screen shows the last cron run | FR-041 (channel) | 1 | 4 | planned | The owner's Android phone rang with the app closed, and diagnostics show the cron ran less than 10 minutes ago |
| 7 | `reminders` | "Drink water at 3pm" and "warn me 1 h before this deadline" — created, edited, and delivered on time with the app closed | FR-044, FR-025 (Task side), FR-041 | 6, 2 | 4 | planned | For a full week every reminder arrived on time — none duplicated, none silent |
| 8 | `text-search` | Two words find any Task — open, done or missed — without choosing a filter first | FR-040 (Tasks) | 3 | 3 | planned | The owner found a Task completed weeks earlier by typing two words, with no filter selected first |
| 9 | `recurring-tasks` | "Pay rent on the 5th" registered once; completing August's occurrence spawns September's, dated and with its reminders set | FR-009 (materialization) | 7, 2 | 6 | planned | Completing a real occurrence made the next appear on the right date with nothing else done — and the expansion function lives in `src/shared`, touching no database and reading no clock |
| 10 | `missed-sweep` | Yesterday's undone occurrence is permanently marked `missed` and today's is open — without the owner touching anything | FR-009 (sweep), FR-011 (data) | 9, 6 | 4 | planned | An occurrence the owner did not do showed up as `missed` the next day without him opening the app; running the sweep twice changes not one row |
| 11 | `adherence-mirror` | Per series: completion rate, current streak and recent misses; a "what I keep failing" list is visible without going to look for it | FR-011 | 10 | 3 | planned | Without searching anywhere, the owner can name the recurring commitment he missed most last month |
| 12 | `repeated-miss-nudge` | After failing the same series N times, one notification points straight at it — not daily, not forever — and that series can be silenced alone | FR-012 | 11, 6 | 3 | planned | After N misses the owner got exactly ONE notification about it that week, and silenced that series without losing the other reminders |
| 13 | `life-areas` | The owner creates the areas that make sense to him, assigns Tasks and series to them, and filters by area; area-less items group under "Unsorted" | FR-008 | 3, 8 | 3 | planned | The owner filtered by an area *he* created and kept using that filter for a week — if he does not, the unit is reverted and this row becomes `dropped` |
| 14 | `events-and-day-view` | Create, edit and delete timed commitments; the day shows all three sources through one range function; born sync-aware per [ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md) | FR-020..023, FR-040 (ext.), FR-042 (VEVENT) | 3, 2, 5 | 7 | planned | The day view shows all THREE sources (local Events, dated Tasks, Google Events) through the SAME range function, and the owner created a local commitment without missing any field Google has |
| 15 | `google-calendar-write` | An Event created, edited or deleted in Praesto appears (and disappears) in Google within one cron cycle, and vice versa; a real conflict becomes a visible warning with both versions readable and restorable, never a silent overwrite | FR-028 | 14, 4, C12, C6 | 6 | planned | The owner created an Event in Praesto and it appeared in Google Calendar on his phone; he edited one in Google and Praesto showed it within 5 minutes; running the pull twice changed not one row; and a deliberate simultaneous edit produced a visible conflict with both versions readable |
| 16 | `week-view` | The whole week on one screen, navigable back and forward — including Google Events, with no new source code | FR-024 | 14 | 3 | planned | The owner planned the following week inside Praesto, Google Events included, and the week screen calls the SAME range function as unit 14 |
| 17 | `recurring-events` | A repeating commitment shows up across weeks; move or cancel just one occurrence without touching the rest; rules Praesto cannot express are kept verbatim and marked read-only | FR-026 | 14, 16, 9 | 6 | planned | A real weekly commitment appears in following weeks and one occurrence was moved without affecting the others — and unit 9's expansion function was reused without a single line changed |
| 18 | `event-reminders` | "Warn me 30 minutes before" on a commitment, including recurring ones — still correct after its time changes | FR-025 (Event side), FR-041 | 17, 7 | 4 | planned | The owner moved a commitment's time and the alert arrived at the NEW time; tests cover all three `next_fire_at` recomputation points, not just the happy path |
| 19 | `google-recurring-events-sync` | A Praesto series becomes a real recurring event in Google and vice versa; moving or cancelling ONE occurrence on either side arrives as an exception, never as a change to the whole series | FR-029 | 17, 15 | 7 | planned | A real weekly commitment created in Praesto appeared as a recurring event in the Google app (verified in the app, not the JSON); an occurrence moved in Google moved ONLY that occurrence in Praesto; and a Google rule Praesto cannot express showed up marked read-only, with the reason |
| 20 | `task-event-links` | From a commitment, see what to do for it; from a Task, see which commitment it belongs to — one tap each way | FR-010 | 14, 2 | 3 | planned | The owner went from a real commitment to its preparation Task and back, one tap each way; the new N:N table appears in the export dump |

**Notes on five positions**, so they are not re-litigated:

- **Unit 2 is the contract-freeze point.** The Task wire contract has one consumer today and many by the end of this table. Its PRD designs the final shape (fields, filters, paging), not just what that screen needs.
- **Unit 4 (`google-calendar-read`) is read-only on purpose, and persists nothing but the credential and the calendar selection.** While no Event entity exists, Google is the only source of truth — no second copy, therefore no conflict, therefore not one line of reconciliation code. It calls Google with `singleEvents=true`, so this slice contains zero recurrence code. Its non-negotiable design condition is the range function taking a list of *sources*; that is what makes unit 14 add a third source behind the same contract instead of rewriting the screen.
- **Unit 5 (export) sits deliberately here, not at 1.** In units 1–4 the database holds reproducible test rows; the safeguard would protect nothing while delaying a usable app by three weeks. This is the last place where export is still cheap and the first where it already protects something irreplaceable: right after the owner moves his life in, right before the first autonomous writer. It has no technical dependency — it can move up at any time at zero cost.
- **Unit 14 must be born sync-aware** ([ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md)): its migration already ships the separate `event_sync_links` table (empty and unused), `all_day` and IANA timezone become mandatory rather than nice-to-have, `source` (`local` | `google`) is a domain fact that changes what the UI allows, and `computeEventContentHash()` is born pure in `src/shared`. Costs ~1 day now; retrofitting it in unit 15 would be a migration over the owner's real life.
- **Unit 17 before unit 18 is a conscious MoSCoW inversion** (FR-026 *Should* before FR-025 *Must*). ADR-0006 requires a denormalized `next_fire_at` with three recomputation points; building Event reminders first makes them born with a naive `fire_at` and forces the cron sweep to be rewritten. The owner accepted the inversion knowing the price of refusing it: one rewrite of the sweep. Unit 19 deliberately sits *after* 18 so a second inversion does not slip in unnoticed.

### How units are built

Three rules. Two confirmed by the owner on 2026-08-03 and recorded as delivery discipline in [engineering-conventions](../40-engineering/engineering-conventions.md#delivery-discipline): every unit is **API-first internally** (routes and tests green before any UI), and unit 2 freezes the Task wire contract. The third, added 2026-08-04 by [ADR-0008](../60-decisions/ADR-0008-adopt-test-first-methodology.md): every unit is **test-first** for everything on the automated side of the [testing strategy](../40-engineering/testing-strategy.md) — the suite comes from the PRD's acceptance criteria and is RED before implementation. UI stays manually verified; that split did not change.

### How this roadmap changes

1. The `#` column is free; the slug is permanent. Reordering means rewriting numbers — never renaming or deleting rows (same discipline as `FR-nnn` IDs).
2. The only hard constraint: a unit may rise above another only when every unit in its `Depends on` is `shipped`. Everything not listed as a dependency is negotiable — deliberately so.
3. Cutting a unit is `dropped` + date + reason. The row stays.
4. Deferring is `deferred` + date + reason. Returning it to `planned` requires an explicit decision recorded in Delivery history.
5. Every change of order, state or estimate becomes one line in Delivery history in the same session — the Definition of Done applied to this file.
6. Mandatory review at two triggers: (a) when a unit closes, ask "is the next one still the right one?" and move it if not; (b) every **three** units shipped, review the whole remaining order. The second trigger exists because the first alone becomes a rubber stamp.
7. Ceiling of ~10 days of 1 h per unit. If an estimate grows during its PRD, the unit is **split** into two rows (`<slug>-a` / `<slug>-b`), both stay, and Delivery history records the split. An estimate is never raised above the ceiling.
8. New ideas never enter this table directly: they pass through the Backlog, become an FR when accepted at triage, and only then earn a row here.
9. An `Exit signal` that cannot be verified by looking at the app, the data, or the owner's phone is not valid — rewrite it before opening the PRD.

**States:** `planned` (queued) · `next` (the next PRD to open — at most one) · `in-progress` (PRD open — at most one, because 1 h/day does not sustain two fronts) · `shipped` · `deferred` · `dropped`.

## Now / Next / Later

Derived from the table above — never a second, independently ageing list.

- **Now:** unit 1 `install-and-quick-capture` — PRD APPROVED, phase 1 of 4 (share target) shipped to production 2026-08-05.
- **Next:** unit 2 `task-detail-and-dates`, once unit 1's remaining phases close.
- **Later:** positions 2 onward in the units table.

## Chores

Work that must happen but does not merit a PRD: no product decision space, no acceptance criteria — just commands and files. Chores have no position, only a trigger.

| Chore | Trigger | Done on |
|---|---|---|
| C1 — Create the real D1, replace the `database_id` placeholder, store the API token as a secret | Before unit 1 — unblocks everything | 2026-08-04 |
| C2 — Produce the PWA icons (192, 512, maskable 512, apple-touch, badge-72) | Before unit 1; also required to verify unit 5 | 2026-08-04 |
| C3 — First real deploy: build, deploy, remote migrations, smoke test, runbook in [dev-environment](../40-engineering/dev-environment.md) | After C1 and C2, before unit 1 | 2026-08-04 |
| C4 — Generate the VAPID key pair; store the three keys as secrets | Immediately before unit 6 | |
| C5 — Off-provider snapshot: local script + Windows Scheduled Task pulling `/api/export` to the owner's PC | Same week as unit 5, never later | |
| C6 — Prove the restore: rebuild a throwaway D1 from a snapshot and compare row counts per table | Right after C5, and again before every migration over real data (units 13, 14, 15, 17, 18, 19, 20) | |
| C7 — Re-validate the export completeness test | On every new migration | |
| C8 — Resolve pending decision 4 (external calendar posture) as ADR-0007, including the CON-005 consent record and the sync anti-pattern carve-out | Right after C11 returns a provisional result — **brought forward** from "before unit 13" on 2026-08-04, when the owner requested bidirectional Google Calendar sync | |
| C11 — **Google access spike** (gates everything below it): create the Google Cloud project, enable the Calendar API, configure the consent screen with Calendar scopes only, **click "Publish app" to leave Testing**, create the OAuth client against the deployed `*.workers.dev` origin, authorize with the owner's account, store the refresh token as a Worker secret, and list the next 7 days with a throwaway script. Also measures the free-plan cron limits (10 ms CPU, 50 subrequests) against the owner's real calendar history | **Now** — right after C3, which is done. The clock below runs for free while units 1–3 are built | |
| C12 — **Token durability confirmation**: 8+ calendar days after C11, run the same script with the SAME refresh token and confirm it still works. Also store a `.ics` snapshot of the Google calendar next to the local snapshots | 8+ days after C11. ~15 min of effort, but it is a **wall-clock gate**, not an effort gate | |
| C9 — Check free-plan usage (requests/day, cron runs, D1 storage, Google API calls) and read push error logs | One week after unit 6 is in production, then monthly | |
| C10 — Rotate the access token; decide whether to enable Cloudflare Access | Once the app holds real life data — in practice after units 5 and 7 | |
| C13 — Register the owner's own domain and stand up a home page, privacy policy and terms of service on it | Only if C11/C12 prove Google requires verification for the sensitive Calendar scope. Authorized by the owner on 2026-08-04 (~R$50/year); the owner already planned to own a domain | |

## Backlog

Ideas land here first. They are raw, unprioritized, and carry no commitment.

### Triage rules

1. An idea becomes a requirement (`FR-nnn` in [functional-requirements](../20-requirements/functional-requirements.md)) **only when accepted** at triage. Until then it has no ID and no priority.
2. An idea parked for more than one audit cycle is **rejected**, with the reason recorded — parking is not a permanent state.
3. Rejected ideas keep their row and move to the *Rejected* subsection below, so no topic is re-litigated from scratch.

### Open ideas

| Idea | Added | Status | Notes |
|---|---|---|---|
| Flexible views and correlation of information with commitments | 2026-08-03 | open | From the owner's stated vision; partially served by unit 17, but the broader "see my data differently" idea is unmodelled |
| Proactive daily summary ("good morning, your day has X") | 2026-08-03 | open | Would reuse the cron and push channel of units 5–6 |
| Notes / personal information as the next Life Area | 2026-08-03 | open | Leading candidate in the [vision](../10-product/vision.md); would open a "Later" phase |
| Refresh the view when a window returns to the foreground | 2026-08-04 | open | Observed by the owner on 2026-08-04, right after the first deploy: a Task created on the phone does not appear in an already-open desktop window until it is reloaded. **Not a data divergence** — D1 holds the single canonical copy (ADR-0003) — and **not blocked by any decision**: revalidating a read is one `GET`, not the sync engine ADR-0003 forbids. Today `src/app/App.tsx` calls `refresh()` only on mount and after a mutation made in that same tab; there is no polling, no `visibilitychange` listener, no socket. Cheapest fix is a `visibilitychange` listener reusing the `refresh` that already exists; polling and push-driven invalidation (reusing unit 6's channel) cost more and buy little. Worth triaging early: phone + desktop is the owner's actual pattern and is what motivated ADR-0003, so this is felt daily |
| Sync Tasks and Reminders to Google (beyond Events) | 2026-08-04 | open | The owner wants it "in the future" — deliberately outside the closed mirror inventory of [ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md), so it needs its own ADR. Note two real costs to weigh then: Google Tasks is a separate API and separate integration, and mirroring Reminders as Google events would double every notification the owner receives |

### Rejected

| Idea | Added | Rejected | Reason |
|---|---|---|---|

*No rejected ideas yet.*

## Delivery history

Newest first. One row per meaningful delivery, reordering or state change, added in the same session it happens.

| Date | Delivered |
|---|---|
| 2026-08-05 | **Unit 1 phase 3 shipped — launcher shortcut to a focused capture field** (FR-045). Long-pressing the home-screen icon now offers "New Task", opening straight into an empty focused field; verified on the owner's Android. The whole pipeline passed first try. The test pair returned `EXISTING_COVERAGE_SUFFICIENT` with zero test files, independently re-derived by the test-reviewer and again by the code-reviewer: the scope is a static JSON member, a one-line pathname branch and a comment, with no discriminative unit to isolate — the no-test-required path `docs/context/methodology.md` carves out, not a lapse in `tdd: true`. Phase 2 (durable token) was set `blocked` by the owner's decision, recorded as PRD Open Question 4; phase 4 remains |
| 2026-08-05 | **Unit 1 phase 1 shipped — Praesto is an Android share target** (FR-045, FR-001). Sharing text from any app now creates a Task with it as the title; an all-empty share creates nothing. Built test-first through the relay pipeline: the 8-case suite was authored and approved while RED, the implementer never touched `test/`, and code review plus docs-sync both passed. Unit 1 moves `next` → `in-progress`; three phases remain (durable token, launcher shortcut, network honesty). Both acceptance criteria were then verified by hand on the owner's Android, which is the only tier that can reach them: sharing text created the Task (AC-1), and sharing empty text created nothing (AC-5) — the pure parser and the real DOM path agree. One caveat recorded rather than glossed: the formal `/relay-test` stage aborted on a missing project-level `.claude/settings.json`, so the suite was verified by running it directly instead (20/20 green) |
| 2026-08-04 | **Methodology switched to test-first** ([ADR-0008](../60-decisions/ADR-0008-adopt-test-first-methodology.md)) at the owner's declaration: `tdd: true` in `docs/context/methodology.md` activates relay's test pair between plan review and implementation. Scope unchanged (UI stays manually verified); estimates unchanged and explicitly still a floor |
| 2026-08-04 | **Decision 4 resolved** — bidirectional Google Calendar sync accepted for Events ([ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md)) with the CON-005 consent record and a bounded carve-out of the sync anti-pattern. Three new units (`google-calendar-read` #4, `google-calendar-write` #15, `google-recurring-events-sync` #19); old units 4–17 renumbered to 5–20; `events-and-day-view` and `recurring-events` rescoped to be born sync-aware (+1 day each); chores C11/C12/C13 added and C8 brought forward. Total 67 → 87 unit-days. Owner's choices: scope `calendar.events`, conservative phasing, own domain authorized if verification is required, Workers Paid **not** authorized |
| 2026-08-04 | Owner requested bidirectional Google Calendar sync (read/create/edit/delete), arbitrating pending decision 4. Research surfaced the OAuth "Testing" 7-day refresh-token expiry as a hard gate; chores C11/C12 created to settle it empirically, C8 (ADR-0007) brought forward from "before unit 13" |
| 2026-08-04 | **First production deploy** (chores C1–C3) — real D1 provisioned and migrated, production token stored as a secret, PWA icons generated from a versioned vector source, and the Worker published at `https://praesto.fabiobarreto.workers.dev`. Smoke test green: token gate closed and open, SPA served, and a Task written to and read back from the remote D1. Runbook in [dev-environment](../40-engineering/dev-environment.md#deploy-runbook). Manually confirmed by the owner the same day: PWA installed on **Android and Windows**, icon on the home screen, and a full Task round-trip (create, complete, create, delete, reload) against production. Unit 1 is unblocked |
| 2026-08-03 | Roadmap restructured into 17 ordered delivery units + 10 chores, with explicit reordering rules; unit 1 set to `next`; delivery discipline (API-first per unit, unit 2 freezes the Task contract) confirmed by the owner |
| 2026-08-03 | **Phase 1 scaffold shipped** — stack installed and verified end to end (PWA → Worker → D1): Phase 1 schema + first migration, token-gated API, Task create/list/complete/delete, 12 tests green, `npm run check` green, build and deploy dry-run clean |
| 2026-08-03 | Recurrence model decided after market research ([ADR-0006](../60-decisions/ADR-0006-recurrence-model.md)); vision gains principle 6 (honest mirror) and FR-011/FR-012 |
| 2026-08-03 | **Phase 0 closed** — quality attributes and constraints confirmed; full document set validated by the owner |
| 2026-08-03 | Vision, glossary and requirements validated by the owner; MVP scope frozen (Phase 1 = Tasks; FR-009/010/026/044/045 added; FR-040 promoted to Must) |
| 2026-08-03 | Decision 3 resolved: React 19 SPA + Vite + Hono + Drizzle stack ([ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md)) — all foundational technical decisions closed |
| 2026-08-03 | Decision 2 resolved: single installable PWA as the sole MVP interface ([ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md)) |
| 2026-08-03 | Decision 1 resolved: canonical data on Cloudflare D1 + Workers, PWA-first ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)) |
| 2026-08-03 | Project named **Praesto Sum**, short form `praesto` ([ADR-0002](../60-decisions/ADR-0002-name-the-project-praesto-sum.md)) |
| 2026-08-02 | Documentation structure created (Phase 0 kickoff) |
