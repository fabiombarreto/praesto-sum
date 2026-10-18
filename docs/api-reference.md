# API Reference

> Keep this in sync as routes land — it is the contract the PWA codes against.

## Conventions

- Base path `/api/*`, JSON in/out. **Every** route requires `Authorization: Bearer <token>` (ADR-0003); a missing or wrong token is `401`. The only unauthenticated surface is the PWA shell.
- Wire types live in `src/shared/api.ts`; rows are mapped by `src/worker/dto.ts`.
- Calendar days are `YYYY-MM-DD` strings (local days). Instants are epoch **seconds**.
- PATCH /api/tasks/:id — an omitted key leaves the field unchanged; an explicit null clears it. This is why `UpdateTaskInput` exists separately from `CreateTaskInput`, whose optional fields already mean "absent".

## Implemented

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/tasks?status=open\|done\|missed&from=YYYY-MM-DD&to=YYYY-MM-DD&priority=high\|normal\|low&limit=N&q=<text>&lifeAreaId=<id>\|none` | `{ tasks: TaskDto[] }` in urgency order (see the frozen read contract below), max `MAX_TASK_LIMIT` (500). `from`/`to` are inclusive and compare against `coalesce(deadline, scheduledDate)`, so a Task with neither date is outside any range; an inverted range (`from` after `to`) answers `200` with an empty list. `priority=normal` also matches an unset priority. `q` (optional): every whitespace-separated word must occur, in any order and anywhere, in the title or description, case- and diacritic-insensitive, across every status; blank/whitespace-only or over 100 characters → 400 naming `q`. `lifeAreaId` (optional, life-areas unit 13): `<id>` returns only that area's Tasks of every status, `none` (reserved) only Tasks with no area; it is ANDed with every other filter, an id matching no area is `200` with an empty list, an empty value → 400 naming `lifeAreaId`, and without the parameter the response is byte-identical to before. Unknown status, an invalid date, an unknown priority, or an invalid `limit` → 400 |
| POST | `/api/tasks` | Create. `title` required; `deadline` XOR `scheduledDate` (both must be valid calendar dates); `priority` is `high\|normal\|low` or absent; `lifeAreaId` is optional (absent or `null` stays `null`) and an id matching no area → 400 naming `lifeAreaId`, creating nothing → 201 `{ task }` |
| PATCH | `/api/tasks/:id` | Edit. Editable keys are exactly `title`, `description`, `deadline`, `scheduledDate`, `priority`, `lifeAreaId` (`EDITABLE_TASK_FIELDS`); any other key — `id`, `status`, `createdAt`, `completedAt`, `seriesId`, `occurrenceDate`, `detached`, or a typo — → 400. An empty body → 400. `lifeAreaId` sets the area (an id matching no area → 400 naming `lifeAreaId`, nothing written) or clears it with `null`. Setting one date clears the other in the same write; editing a Task with a `seriesId` — its area included — sets `detached` (ADR-0006, never exposed on the wire) and leaves the series' own area untouched (move a whole series through `PATCH /api/series/:id`). → 200 `{ task }`, or 404 when absent |
| POST | `/api/tasks/:id/complete` | Open → done, stamps `completedAt`. Not open → 404. When the Task is a series occurrence, the same batch also sets the series' `nudged_at` to `null` (repeated-miss-nudge phase 2: completion re-arms the nudge; a `missed` close never clears it) |
| POST | `/api/tasks/:id/reopen` | Done → open, clears `completedAt`. Not done → 404 |
| DELETE | `/api/tasks/:id` | 204, or 404 when absent |
| POST | `/api/push/subscriptions` | Upsert by `endpoint` (FR-041). `endpoint`, `keys.p256dh`, `keys.auth` required; `deviceLabel` optional. 201 `{ subscription }` on insert, 200 `{ subscription }` on update (existing row's keys/`lastSeenAt` refreshed, row count unchanged) — the DTO never carries `p256dh`/`auth`. Invalid body → 400 |
| DELETE | `/api/push/subscriptions` | Remove by `endpoint`. 204, or 404 when absent |
| POST | `/api/push/test` | Dispatch to every stored subscription, pruning any that come back `gone` (404/410). `{ ok: true, results: [{ endpoint, outcome }] }`, where `outcome` is `PushOutcome` (`delivered`/`gone`/`retryable`) verbatim; zero stored subscriptions → `{ ok: false, error: "no stored subscriptions", results: [] }`. Also persists its outcome as the `push_dispatch_attempts` singleton row (upsert), which `GET /api/diagnostics` reads as the last dispatch attempt — not persisted when there were zero stored subscriptions |
| GET | `/api/diagnostics` | `{ lastRun: CronRunDto \| null, freshness: "fresh"\|"stale"\|"unknown", subscriptionCount: number, lastDispatch: { instant, results } \| null }`. `lastRun` is the most recent `cron_runs` row (`null` if the cron has never run); `freshness` classifies its instant against now (`fresh` under 10 minutes, `stale` at 10 minutes or more, `unknown` when `lastRun` is `null`); `lastDispatch` is the last `POST /api/push/test` outcome (`null` if never attempted) |
| GET | `/api/push/vapid-key` | `{ publicKey: string }` — the VAPID public key the browser hands `pushManager.subscribe()`; bearer-gated like every other route |
| GET | `/api/series/adherence` | Read-only (adherence-mirror phase 2, FR-011). `AdherenceResponse`: `{ series: SeriesAdherenceDto[], ranking: string[] }`, one entry per `task`-kind series (active and ended) with `seriesId`, `title` (`""` when none), `status`, `done`, `closed`, `currentStreak` and `recentMisses` (local `YYYY-MM-DD`, newest first), and `nudgeMuted` (boolean, the series' repeated-miss-nudge mute; repeated-miss-nudge phase 4, mapped in `toSeriesAdherenceDto`) — all derived from the series' real `done`/`missed` occurrence rows via `src/shared/adherence.ts`, never from the stored counters (ADR-0006), with `today` taken in each series' own time zone (a zone that cannot be resolved falls back to `America/Sao_Paulo` rather than failing the whole response, QA G-1). `ranking` lists series ids with recent misses, "what I keep not doing" first. Declared BEFORE `GET /api/series/:id` so `adherence` is never read as an id |
| GET | `/api/life-areas` | Life areas phase 1 (unit 13, ADR-0015). `LifeAreasResponse`: `{ lifeAreas: LifeAreaSummaryDto[], noArea: { openTaskCount } }`. Each area is the `LifeAreaDto` (`id`, `name`, `description` — never written by the API, so `null` for every area it creates, `createdAt`, `updatedAt`) plus `openTaskCount` (open Tasks only), `taskCount` (Tasks of every status) and `seriesCount` (its Recurrence Series, any status). Ordered alphabetically in pt-BR, never bytewise (`Casa`, `Ética`, `Trabalho`). `noArea.openTaskCount` is the number of open Tasks with no area — a count, never a stored area |
| POST | `/api/life-areas` | Create. `name` is trimmed and must be 1–40 characters (missing, non-string, blank or longer → 400 naming `name`); unique ignoring case and diacritics (→ 409 naming `name`); at most 12 areas (→ 409). Other body keys are ignored → 201 `{ lifeArea }` with `description` `null` |
| PATCH | `/api/life-areas/:id` | Rename. `name` is the only editable key (`EDITABLE_LIFE_AREA_FIELDS`); any other key — `id`, `description`, or a typo — → 400 naming it, an empty body → 400, a bad name → 400 naming `name`. Uniqueness is checked against the OTHER areas only, so `Casa` → `casa` is accepted; another area's name → 409. The id never changes, so every Task and series keeps its area. → 200 `{ lifeArea }`, or 404 when absent |
| DELETE | `/api/life-areas/:id` | 204, or 404 when absent. A real delete that unassigns, never deletes an item: its Tasks (every status) and its series get `lifeAreaId` `null` in the same `db.batch`, and no title, status or date changes |
| POST, PATCH | `/api/series`, `/api/series/:id` | `lifeAreaId` must match an existing area (an id matching no area, an empty string or a non-string → 400 naming `lifeAreaId`, nothing written); on `POST`, absent or `null` means no area. On `POST` the series, its first occurrence and every spawned successor carry it. On `PATCH` the series and its open non-detached occurrence move to the new area (`null` clears it); a detached open occurrence keeps its own, and `done`/`missed` rows keep the area they had (ADR-0006) |

## Task read contract (frozen at unit 2)

Units 3, 5, 8, 9, 10, 11, 13, 14 and 20 all read Tasks. This is the shape they
inherit; it is frozen so they do not each invent their own.

**Order.** Order: overdue first, then today, then future by date ascending, then undated last.
**Not yet due:** an `open` occurrence of a *dateless* series (`dateMode: "none"`, ADR-0014) whose `occurrenceDate` is after today is left out of every `GET /api/tasks` result — it exists as soon as its predecessor closes, but has no date to sort or hide it by, so it first appears on its own day.

The ordering key is `COALESCE(deadline, scheduledDate)` — unambiguous because
`tasks_single_date_chk` guarantees at most one of the two is ever set — and the
tiebreak within a bucket is `createdAt` descending. "Today" is the local
calendar day in `PRAESTO_TIMEZONE` (`src/shared/dates.ts`), the same zone
`recurrence_series.timezone` defaults to. The order is produced by the API and
**must not be re-derived in a client**: it is the one guarantee every consumer
has to agree on, and the client is the one place they cannot share.

**Filter vocabulary.** `status`, `from`, `to` and `priority` are all
implemented. Unit 3 added `from`, `to` and `priority` on 2026-08-23, extending
this vocabulary rather than inventing a competing one. `lifeAreaId` (unit 13,
2026-10-11) extends it the same way, additively: `lifeAreaId=<id>` or
`lifeAreaId=none`, where `none` is reserved for "no area" (area ids are random
UUIDs, so it cannot collide) and a request without the parameter is
byte-identical to what it was. Adding a filter is backward-compatible; renaming
one is not.

**Paging.** No cursor. `limit` is accepted and honoured, capped at
`MAX_TASK_LIMIT` (500), which is also the implicit cap when `limit` is absent.
An invalid `limit` — `0`, negative, non-numeric, or above the cap — is rejected
with 400 rather than clamped, so a caller never mistakes a partial page for a
full one. Accepting `limit` now is what makes adding a cursor later additive.
**Revisit trigger:** the first list response carrying over ~500 Tasks or over
100 KB, whichever comes first — measurable against the real table at any time.

**Deliberately not on the wire.** `updatedAt` (nothing consumes it) and
`detached` (unit 9 owns its meaning and its surface). Note that `detached`
governs whether a *series edit propagates* to an occurrence — never whether the
owner can see it. A detached occurrence stays in the list.

The asymmetry is the point: **adding** a field later is backward-compatible;
renaming, removing or retyping one is not. That is what "frozen" protects.

## Not built yet

Ordered by the delivery units in `documentation/50-planning/roadmap.md` — that table carries the dependencies and exit signals. Every unit is API-first: routes and tests land before its UI.

| Delivery unit | Surface to add | Requirement |
|---|---|---|
| 2 `task-detail-and-dates` | Remaining: urgency ordering + `?limit=N` on the list query (phase 3), then the detail screen (phase 4). `PATCH /api/tasks/:id` and the `priority` enum have shipped — see Implemented above | FR-005, FR-006 |
| 3 `today-view-and-filters` | `from`, `to` and `priority` filters on the list query. **Grouping is NOT an API concern** — the today/overdue/upcoming/undated groups are a client-side stable partition over the order this contract already produces (`PRPs/prds/today-view-and-filters.prd.md`, 2026-08-23) | FR-007 |
| 4 `data-export` | `GET /api/export` — full JSON dump + `.ics` | FR-042, FR-043 |
| 5 `push-channel-proven` | Client subscription UI (server-side subscription registration, test-push route and cron diagnostics have shipped — see Implemented above) | FR-041 |
| 6 `reminders` | Reminder CRUD (standalone and attached), due-scan job | FR-044, FR-025 |
| 8 `text-search` | The search route (UI) — the server-side `q` parameter shipped in phase 1. | FR-040 |
| 9 `recurring-tasks` | Series CRUD + occurrence materialization | FR-009 |
| 10 `missed-sweep` | Cron sweep marking `missed` and spawning the next occurrence | FR-009, FR-011 |
| 11 `adherence-mirror` | Nothing left on the API: the read model `GET /api/series/adherence` has shipped (see Implemented above) and the screen (phase 3, route `/settings/adherence`, the *Hoje* line) consumes it client-side. The unit stays `in-progress` until AC-20 is observed on the owner's device | FR-011 |
| 12 `repeated-miss-nudge` | Repeated-miss job + per-series mute. Phase 2 has shipped the mute and the state columns: `PATCH /api/series/:id` accepts `nudgeMuted` (boolean; any other type → 400 naming `nudgeMuted`, nothing written — it is an owner preference, so it is on `EDITABLE_SERIES_FIELDS` and never touches the occurrence or its Reminders), and `SeriesDto` carries `nudgeMuted`. `nudgedAt` is system state and is NOT on the series wire (a PATCH carrying it → 400); it appears only in the FR-042 export row (`RecurrenceSeriesDto`: `nudgedAt` epoch seconds or `null`, `nudgeMuted`). The job has shipped in phase 3 (no HTTP surface): `sweepRepeatedMissNudges` in `src/worker/cron.ts` runs inside `scheduled()` after the missed sweep and the Reminder loop, and sends one Web Push per qualifying series (title ≤ 30 chars, tag `nudge-<seriesId>`, deep link `/tasks/<open occurrence id>`) to every stored subscription — see `docs/domain/areas/tasks.md`. Its failure is recorded in `cron_runs` and never blocks Reminders. The UI half has shipped in phase 4: a switch in the series section of the Task sheet (active series occurrences only) persists immediately through `PATCH /api/series/:id { nudgeMuted }`, and `GET /api/series/adherence` carries `nudgeMuted` so the Aderência row can show *Avisos silenciados*; no new endpoint. Device proof (AC-17) is still owed | FR-012 |
| 13 `life-areas` | The API has shipped in phase 1 — `/api/life-areas`, `lifeAreaId` on the Task and series write paths and the `lifeAreaId` list filter; see Implemented above. The *Áreas* screen (`/settings/life-areas`, phase 2) consumes it client-side and adds no endpoint; so do the Task sheet's *Área* group, the area name on the row and the capture decision (phase 3): the Task sheet sends `lifeAreaId` through the existing `PATCH /api/tasks/:id`, `PATCH /api/series/:id` and `POST /api/series` bodies, while the row name sends nothing. Phase 4 adds no endpoint either: the filter sheet's *Área* group sends `GET /api/tasks?lifeAreaId=<id>\|none` through the existing list route, and a capture made under an applied area filter sends that area's id as `lifeAreaId` in the existing `POST /api/tasks` body (an explicit `null` under *Sem área*, and no `lifeAreaId` key at all with no area filter). Nothing is left on the API; the unit stays `in-progress` until AC-18 on a real production snapshot is observed and the owner decides on the exit signal (AC-24 was observed on his device on 2026-10-18) | FR-008 |
| 14–18 (Phase 2) | Events, day/week range queries, event exceptions, event reminders, Task↔Event links | FR-020..026, FR-010 |

Note on the gap at 7: units 4 `data-export`, 5 `push-channel-proven` and 6
`reminders` keep the legacy numbers 4/5/6 above rather than their current
roadmap numbers 5/6/7 — deliberately. All three have shipped, so "Not built
yet" is the wrong category for them, not merely the wrong number; renumbering
them here without also moving them out of this table would still leave the
table wrong. This phase (text-search unit 8) renumbers only the genuinely
not-built block it collides with (`recurring-tasks` through the Phase 2
aggregate row); the three legacy rows are a separate, deeper fix left for a
future pass (see `PRPs/plans/text-search-phase-2-the-search-route.plan.md`,
Task 10 and its Risks entry).

Cron (not HTTP): `scheduled()` in `src/worker/index.ts` now calls `runCronHeartbeat` (`src/worker/cron.ts`), which records every run — success or failure — as a `cron_runs` row, readable via `GET /api/diagnostics`. *(Updated 2026-10-02:)* the same entry point (`runScheduledJob`) now also runs the due-Reminder sweep (unit 7) and, before it, the missed sweep (unit 10 phases 1-2, `sweepMissedOccurrences`): it marks superseded occurrences `missed` and spawns the successor, one `db.batch` per series, and no HTTP route is added. The export snapshot job remains out of scope.
