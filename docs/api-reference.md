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

| Area | Requirement | Phase |
|---|---|---|
| Reminders (attached + standalone) | FR-041, FR-044 | 1 |
| Recurrence series | FR-009, FR-011, FR-012 | 1 |
| Search | FR-040 | 1 |
| Export (JSON + iCalendar) | FR-042 | 1 |
| Life Areas | FR-008 | 1–2 |
| Events, day/week views, Task↔Event links | FR-020..026, FR-010 | 2 |

Cron (not HTTP): `scheduled()` in `src/worker/index.ts` — currently an empty stub. It will run the due-Reminder scan, the recurrence sweep (materialize next occurrence, mark superseded ones `missed`) and the export snapshot job.
