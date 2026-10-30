# Chore C6 — unit 14 phase 2 run (`events` exercised on a synthetic fixture)

**Date:** 2026-10-19 · **Trigger:** unit 14 `events-and-day-view` phase 2, where `GET /api/export` starts
to emit `events` and `event_sync_links`; unit 14 is on the roadmap's C6 trigger list, and both tables
have been empty in every snapshot the drill has seen (they did not exist until migration `0007`).
**Tool:** `scripts/restore-drill.mjs`, unchanged. Its own output, unedited, is
`PRPs/reports/events-and-day-view/c6-drill-output.txt`.

## SYNTHETIC FIXTURE RUN

**This is not the owner's data and it is not PRD AC-32.** Every row below was produced through the
real routes of a LOCAL worker (`vite dev` on port 5179: real workerd, local D1, the dev bearer token
from `.dev.vars`). There is no production token in this session, production holds no Event (unit 14 is
not deployed and migration `0007` has not been applied remotely), and nothing here contacted
production or used `--remote`.

How the fixture was made, through the real routes only:

- Migrations `0000` to `0007` on the LOCAL D1 first, with `npm run db:migrate` (the local database
  already carried them: `No migrations to apply!`).
- `POST /api/events` twice: one **timed** Event (a start and an end an hour apart in
  `America/Sao_Paulo`, with a description and a location) and one **all-day** Event covering two days
  (`startDate` 2026-10-26, stored `endDate` 2026-10-28, exclusive). The local database held no other
  row, and no route writes `event_sync_links`, so that table stayed empty.
- The snapshot was pulled with the unattended job's own script, pointed away from everything real:
  `PRAESTO_EXPORT_BASE_URL=http://127.0.0.1:5179`, a token file in a git-ignored scratch directory
  (never printed, never in this record), and `PRAESTO_SNAPSHOT_DIR` set to a scratch directory. It was
  **not** written to `~/praesto-snapshots`, so the weekly job's same-day rule cannot skip a real
  snapshot because of it.
- Before the drill, the snapshot was checked to hold `formatVersion` 1, exactly one timed Event
  (`allDay` false) and one all-day Event (`allDay` true), and `event_sync_links` as an empty array; the
  `.ics` pulled alongside it was checked to carry `DTSTART:20261020T123000Z` (the timed Event as UTC)
  and `DTEND;VALUE=DATE:20261028` (the all-day Event's exclusive end).
- Afterwards both fixture Events were removed through the real route (`DELETE /api/events/:id`, `204`
  each), the dev server was stopped (nothing was left listening on port 5179) and the scratch
  directory, with its token, snapshot, `.ics` and server log, was deleted.

**Snapshot (not committed — it is local dev data; the record carries enough to check a re-run):**
`praesto-2026-10-19.json`, 1,949 bytes, SHA-256
`dcb45615e8ec914045b39a4cf1a9dc4bdc54075a82cce92f81f830cf3304d3a0`, `formatVersion` 1.

## Result: PASS (on the fixture)

| Table | Snapshot | Restored | Fields |
|---|---|---|---|
| events | 2 | 2 | every field identical, `content_hash` and the 0/1 `all_day` included (one row with `all_day` 0, one with `all_day` 1) |
| event_sync_links | 0 | 0 | no rows — restore path NOT exercised |
| life_areas, recurrence_series, tasks, reminders, google_calendar_selections | 0 | 0 | the local database held none: restore path NOT exercised |
| google_connections, push_subscriptions, oauth_states, cron_runs, push_dispatch_attempts | 0 | 0 | the excluded tables: present in the schema, no row restored |

The schema was built from all eight `migrations/*.sql` (`applied 8 migrations`) and the drill's exit
status was 0 (`restore-drill: PASS`, captured with `pipefail`).

**What this proves.** The Event dump has the shape the drill rebuilds from: every dumped key is a real
column of `events` under the drill's camelCase to snake_case step, a timed row (instants set, days
null) and an all-day row (days set, instants null) both satisfy `events_shape_chk` on the way back in,
the JSON boolean `allDay` is bound as the 0 or 1 SQLite stores, and `content_hash` (a 64-character
digest) survives the round trip byte for byte. `events` is listed before `event_sync_links` in the
document, which is the order the drill inserts them in.

**What it does not prove.**

- Nothing about the owner's real rows. A synthetic fixture proves the fixture: the interesting
  corruption is the unusual real value, and no real Event, title or zone was in this snapshot.
- Nothing about a populated link table. `event_sync_links` was empty, so the drill says `restore path
  NOT exercised` for it, as it should; the orphan link (`event_id` null) and the foreign key it
  declares are exercised by the schema suites, not by this run.
- Nothing about D1 over the network (the rebuild is local SQLite, as the drill's own header says).
- Nothing about a snapshot taken in production after the unit is deployed: PRD AC-32 is a phase 5 run
  on a real snapshot and is not met by this record.

*Status: SYNTHETIC FIXTURE PASS (2026-10-19) — PRD AC-21 met; PRD AC-32 (a real production snapshot) not yet run*
