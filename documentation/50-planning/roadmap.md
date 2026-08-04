---
status: active
last_updated: 2026-08-03
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
| **1 — MVP Tasks** | Units 1–12 | The owner manages daily Tasks in the assistant instead of the current scattered notes |
| **2 — Calendar** | Units 13–17 | The owner replaces Google Calendar for day-to-day use |
| **Later — future Life Areas** | Life Areas beyond Tasks and Calendar | TBD — pending owner input |

Two internal milestones inside Phase 1, as reading aids (not gates):

- **M1 — usable and portable** (end of unit 4): the owner captures, edits, dates and sees the day, and can take 100% of the data away. This is when the "first usable version" of [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) exists *with* its export safeguard already in place — the honest moment to start migrating the scattered notes in.
- **M2 — the assistant acts on its own** (end of unit 6): `scheduled()` stops being a stub and the phone rings with the app closed. FR-041 is fulfilled in practice from here.

Phase 1's exit criterion becomes verifiable — not merely declarable — once unit 11 is `shipped` and the app holds two weeks of real data with at least one recurring series producing genuine `missed` rows.

Phases are sequential; a phase opens only when the previous one meets its exit criteria. Pending decision 4 (external calendar posture) must be resolved as an ADR before unit 13 is planned.

## Delivery units

> This table is a **living guide, not a schedule**. There are no promised dates — only order and dependencies. The order is a hypothesis about what serves the owner best *now*; it should change when real use says otherwise. A recorded reordering is not a planning failure — it is the document working.

Each unit is one PRD (`PRPs/prds/<unit>.prd.md`), sized to the owner's ~1 h/day budget (CON-003). Estimates are in days of ~1 h and are a **floor**, excluding the PRD → plan → review cycle itself.

| # | Unit | Outcome | FRs | Depends on | Est. | State | Exit signal |
|---|---|---|---|---|---|---|---|
| 1 | `install-and-quick-capture` | Praesto sits on the phone's home screen; capture takes seconds and needs no hand-typed token; a dead network says so instead of breaking | FR-045, FR-001 | — | 4 | **next** | The icon is on the owner's home screen and a *real* Task was added without opening a browser or typing a token |
| 2 | `task-detail-and-dates` | Anything captured in a hurry can be fixed: title, description, deadline or scheduled date, priority, complete, reopen, delete | FR-002, FR-005, FR-006, FR-003, FR-004 | 1 | 5 | planned | A Task created in a hurry was later corrected (title and date) instead of deleted and recreated |
| 3 | `today-view-and-filters` | Opening the app answers "what is today?" — today, overdue, upcoming, undated — with filters by status, date and priority | FR-007 | 2 | 4 | planned | The owner answers "what's today?" without scrolling the whole list and without touching a filter |
| 4 | `data-export` | One click (or a curl with the token) downloads 100% of the data as documented JSON, plus an `.ics` of dated items | FR-042, FR-043 (mechanism) | 3 | 3 | planned | A dated `.json` with 100% of the data sits on the owner's PC, readable outside the app; the completeness test fails if a new table is added to the schema without being dumped |
| 5 | `push-channel-proven` | The phone rings with the app closed; tapping the notification opens the app; a diagnostics screen shows the last cron run | FR-041 (channel) | 1 | 4 | planned | The owner's iPhone rang with the app closed, and diagnostics show the cron ran less than 10 minutes ago |
| 6 | `reminders` | "Drink water at 3pm" and "warn me 1 h before this deadline" — created, edited, and delivered on time with the app closed | FR-044, FR-025 (Task side), FR-041 | 5, 2 | 4 | planned | For a full week every reminder arrived on time — none duplicated, none silent |
| 7 | `text-search` | Two words find any Task — open, done or missed — without choosing a filter first | FR-040 (Tasks) | 3 | 3 | planned | The owner found a Task completed weeks earlier by typing two words, with no filter selected first |
| 8 | `recurring-tasks` | "Pay rent on the 5th" registered once; completing August's occurrence spawns September's, dated and with its reminders set | FR-009 (materialization) | 6, 2 | 6 | planned | Completing a real occurrence made the next appear on the right date with nothing else done — and the expansion function lives in `src/shared`, touching no database and reading no clock |
| 9 | `missed-sweep` | Yesterday's undone occurrence is permanently marked `missed` and today's is open — without the owner touching anything | FR-009 (sweep), FR-011 (data) | 8, 5 | 4 | planned | An occurrence the owner did not do showed up as `missed` the next day without him opening the app; running the sweep twice changes not one row |
| 10 | `adherence-mirror` | Per series: completion rate, current streak and recent misses; a "what I keep failing" list is visible without going to look for it | FR-011 | 9 | 3 | planned | Without searching anywhere, the owner can name the recurring commitment he missed most last month |
| 11 | `repeated-miss-nudge` | After failing the same series N times, one notification points straight at it — not daily, not forever — and that series can be silenced alone | FR-012 | 10, 5 | 3 | planned | After N misses the owner got exactly ONE notification about it that week, and silenced that series without losing the other reminders |
| 12 | `life-areas` | The owner creates the areas that make sense to him, assigns Tasks and series to them, and filters by area; area-less items group under "Unsorted" | FR-008 | 3, 7 | 3 | planned | The owner filtered by an area *he* created and kept using that filter for a week — if he does not, the unit is reverted and this row becomes `dropped` |
| 13 | `events-and-day-view` | Create, edit and delete timed commitments; see the day in chronological order with dated Tasks alongside, visually distinct; search and export cover Events | FR-020..023, FR-040 (ext.), FR-042 (VEVENT) | 3, 2, 4 | 6 | planned | The owner spent a full day consulting only Praesto for his commitments, never opening Google Calendar — and "items in range" is one parameterized function, not a query embedded in a screen |
| 14 | `week-view` | The whole week on one screen, navigable back and forward | FR-024 | 13 | 3 | planned | The owner planned the following week inside Praesto, and the week screen calls the SAME range function as unit 13 |
| 15 | `recurring-events` | A repeating commitment shows up across weeks; move or cancel just one occurrence without touching the rest | FR-026 | 13, 14, 8 | 5 | planned | A real weekly commitment appears in following weeks and one occurrence was moved without affecting the others — and unit 8's expansion function was reused without a single line changed |
| 16 | `event-reminders` | "Warn me 30 minutes before" on a commitment, including recurring ones — still correct after its time changes | FR-025 (Event side), FR-041 | 15, 6 | 4 | planned | The owner moved a commitment's time and the alert arrived at the NEW time; tests cover all three `next_fire_at` recomputation points, not just the happy path |
| 17 | `task-event-links` | From a commitment, see what to do for it; from a Task, see which commitment it belongs to — one tap each way | FR-010 | 13, 2 | 3 | planned | The owner went from a real commitment to its preparation Task and back, one tap each way; the new N:N table appears in the export dump |

**Notes on three positions**, so they are not re-litigated:

- **Unit 2 is the contract-freeze point.** The Task wire contract has one consumer today and seven by the end of this table. Its PRD designs the final shape (fields, filters, paging), not just what that screen needs.
- **Unit 4 (export) sits deliberately at 4, not at 1.** In units 1–3 the database holds reproducible test rows; the safeguard would protect nothing while delaying a usable app by three weeks. Position 4 is the last place where export is still cheap and the first where it already protects something irreplaceable: right after the owner moves his life in, right before the first autonomous writer (unit 5). It has no technical dependency — it can move up at any time at zero cost.
- **Unit 15 before unit 16 is a conscious MoSCoW inversion** (FR-026 *Should* before FR-025 *Must*). ADR-0006 requires a denormalized `next_fire_at` with three recomputation points; building Event reminders first makes them born with a naive `fire_at` and forces the cron sweep to be rewritten. The owner accepted the inversion knowing the price of refusing it: one rewrite of the sweep.

### How units are built

Two rules, confirmed by the owner on 2026-08-03, recorded as delivery discipline in [engineering-conventions](../40-engineering/engineering-conventions.md#delivery-discipline): every unit is **API-first internally** (routes and tests green before any UI), and unit 2 freezes the Task wire contract.

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

- **Now:** nothing in `in-progress`. No PRD is open.
- **Next:** unit 1 `install-and-quick-capture`, preceded by chores C1–C3 (their trigger is already due).
- **Later:** positions 2 onward in the units table.

## Chores

Work that must happen but does not merit a PRD: no product decision space, no acceptance criteria — just commands and files. Chores have no position, only a trigger.

| Chore | Trigger | Done on |
|---|---|---|
| C1 — Create the real D1, replace the `database_id` placeholder, store the API token as a secret | Before unit 1 — unblocks everything | |
| C2 — Produce the PWA icons (192, 512, maskable 512, apple-touch, badge-72) | Before unit 1; also required to verify unit 5 | |
| C3 — First real deploy: build, deploy, remote migrations, smoke test, runbook in [dev-environment](../40-engineering/dev-environment.md) | After C1 and C2, before unit 1 | |
| C4 — Generate the VAPID key pair; store the three keys as secrets | Immediately before unit 5 | |
| C5 — Off-provider snapshot: local script + Windows Scheduled Task pulling `/api/export` to the owner's PC | Same week as unit 4, never later | |
| C6 — Prove the restore: rebuild a throwaway D1 from a snapshot and compare row counts per table | Right after C5, and again before every migration over real data (units 12, 13, 15, 16, 17) | |
| C7 — Re-validate the export completeness test | On every new migration | |
| C8 — Resolve pending decision 4 (external calendar posture) as an ADR | Before planning unit 13, not during | |
| C9 — Check free-plan usage (requests/day, cron runs, D1 storage) and read push error logs | One week after unit 5 is in production, then monthly | |
| C10 — Rotate the access token; decide whether to enable Cloudflare Access | Once the app holds real life data — in practice after units 4 and 6 | |

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

### Rejected

| Idea | Added | Rejected | Reason |
|---|---|---|---|

*No rejected ideas yet.*

## Delivery history

Newest first. One row per meaningful delivery, reordering or state change, added in the same session it happens.

| Date | Delivered |
|---|---|
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
