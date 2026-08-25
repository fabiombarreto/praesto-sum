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
| GET | `/api/tasks?status=open\|done\|missed&from=YYYY-MM-DD&to=YYYY-MM-DD&priority=high\|normal\|low&limit=N` | `{ tasks: TaskDto[] }` in urgency order (see the frozen read contract below), max `MAX_TASK_LIMIT` (500). `from`/`to` are inclusive and compare against `coalesce(deadline, scheduledDate)`, so a Task with neither date is outside any range; an inverted range (`from` after `to`) answers `200` with an empty list. `priority=normal` also matches an unset priority. Unknown status, an invalid date, an unknown priority, or an invalid `limit` → 400 |
| POST | `/api/tasks` | Create. `title` required; `deadline` XOR `scheduledDate` (both must be valid calendar dates); `priority` is `high\|normal\|low` or absent → 201 `{ task }` |
| PATCH | `/api/tasks/:id` | Edit. Editable keys are exactly `title`, `description`, `deadline`, `scheduledDate`, `priority` (`EDITABLE_TASK_FIELDS`); any other key — `id`, `status`, `createdAt`, `completedAt`, `seriesId`, `occurrenceDate`, `detached`, `lifeAreaId`, or a typo — → 400. An empty body → 400. Setting one date clears the other in the same write; editing a Task with a `seriesId` sets `detached` (ADR-0006, never exposed on the wire). → 200 `{ task }`, or 404 when absent |
| POST | `/api/tasks/:id/complete` | Open → done, stamps `completedAt`. Not open → 404 |
| POST | `/api/tasks/:id/reopen` | Done → open, clears `completedAt`. Not done → 404 |
| DELETE | `/api/tasks/:id` | 204, or 404 when absent |

## Task read contract (frozen at unit 2)

Units 3, 5, 8, 9, 10, 11, 13, 14 and 20 all read Tasks. This is the shape they
inherit; it is frozen so they do not each invent their own.

**Order.** Order: overdue first, then today, then future by date ascending, then undated last.
The ordering key is `COALESCE(deadline, scheduledDate)` — unambiguous because
`tasks_single_date_chk` guarantees at most one of the two is ever set — and the
tiebreak within a bucket is `createdAt` descending. "Today" is the local
calendar day in `PRAESTO_TIMEZONE` (`src/shared/dates.ts`), the same zone
`recurrence_series.timezone` defaults to. The order is produced by the API and
**must not be re-derived in a client**: it is the one guarantee every consumer
has to agree on, and the client is the one place they cannot share.

**Filter vocabulary.** `status`, `from`, `to` and `priority` are all
implemented. Unit 3 added `from`, `to` and `priority` on 2026-08-23, extending
this vocabulary rather than inventing a competing one. Adding a filter is
backward-compatible; renaming one is not.

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
| 5 `push-channel-proven` | Subscription registration, a test-push route, cron diagnostics | FR-041 |
| 6 `reminders` | Reminder CRUD (standalone and attached), due-scan job | FR-044, FR-025 |
| 7 `text-search` | Text search over Tasks | FR-040 |
| 8 `recurring-tasks` | Series CRUD + occurrence materialization | FR-009 |
| 9 `missed-sweep` | Cron sweep marking `missed` and spawning the next occurrence | FR-009, FR-011 |
| 10 `adherence-mirror` | Adherence read model per series | FR-011 |
| 11 `repeated-miss-nudge` | Repeated-miss job + per-series mute | FR-012 |
| 12 `life-areas` | Life Area CRUD and area filters | FR-008 |
| 13–17 (Phase 2) | Events, day/week range queries, event exceptions, event reminders, Task↔Event links | FR-020..026, FR-010 |

Cron (not HTTP): `scheduled()` in `src/worker/index.ts` — currently an empty stub. It will run the due-Reminder scan, the recurrence sweep (materialize next occurrence, mark superseded ones `missed`) and the export snapshot job.
