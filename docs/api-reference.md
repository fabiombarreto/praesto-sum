# API Reference

> Keep this in sync as routes land — it is the contract the PWA codes against.

## Conventions

- Base path `/api/*`, JSON in/out. **Every** route requires `Authorization: Bearer <token>` (ADR-0003); a missing or wrong token is `401`. The only unauthenticated surface is the PWA shell.
- Wire types live in `src/shared/api.ts`; rows are mapped by `src/worker/dto.ts`.
- Calendar days are `YYYY-MM-DD` strings (local days). Instants are epoch **seconds**.

## Implemented

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/tasks?status=open\|done\|missed` | `{ tasks: TaskDto[] }`, newest first, max 500. Unknown status → 400 |
| POST | `/api/tasks` | Create. `title` required; `deadline` XOR `scheduledDate` (both must be valid calendar dates) → 201 `{ task }` |
| POST | `/api/tasks/:id/complete` | Open → done, stamps `completedAt`. Not open → 404 |
| POST | `/api/tasks/:id/reopen` | Done → open, clears `completedAt`. Not done → 404 |
| DELETE | `/api/tasks/:id` | 204, or 404 when absent |

## Not built yet

Ordered by the delivery units in `documentation/50-planning/roadmap.md` — that table carries the dependencies and exit signals. Every unit is API-first: routes and tests land before its UI.

| Delivery unit | Surface to add | Requirement |
|---|---|---|
| 2 `task-detail-and-dates` | `PATCH /api/tasks/:id` (title, description, dates, priority) — also the contract-freeze point | FR-002, FR-005, FR-006 |
| 3 `today-view-and-filters` | Date/priority filters and day grouping on the list query | FR-007 |
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
