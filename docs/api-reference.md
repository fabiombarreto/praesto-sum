# API Reference

> No endpoints exist yet — the scaffold is pending. This file records the PLANNED surface (ADR-0003/0005) and must be filled with the real contract as routes land.

## Conventions

- Base path `/api/*`, JSON in/out, bearer token required on every route (single user).
- Entity names follow the canonical glossary: tasks, events, reminders, life-areas.

## Planned surface (fill in as implemented)

| Area | Routes (planned) | Phase |
|---|---|---|
| Tasks | CRUD + complete/uncomplete + list/filter | 1 |
| Reminders | CRUD (attached or standalone) | 1 |
| Search | text search across Tasks/Events | 1 |
| Export | full JSON + iCalendar dump (FR-042) | 1 |
| Events | CRUD + day/week queries | 2 |
| Life Areas | CRUD | 1–2 |

Cron (not HTTP): `scheduled()` — due-Reminder scan + push dispatch + snapshot job.
