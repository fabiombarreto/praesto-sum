# Chore C6 on the latest real snapshot, before migration `0007` — PASS (unit 14, PRD AC-32, first half)

Run 2026-11-11 by the agent at the owner's request, as Step 3 of `phase-5/release-runbook.md`, **before** the remote migration.

- **Snapshot:** `praesto-2026-11-11.json`, pulled that day from production by `node scripts/pull-export-snapshot.mjs` (a read-only `GET /api/export`, the weekly job's token file, the token never printed). The snapshot is the owner's real data and stays off-repo in `~/praesto-snapshots`.
- **SHA-256:** `dbdd939f084740b43a1dafe0565ebe215efe1f2e818d9b44ba0a3d68e72f0a76`
- **Command:** `node scripts/restore-drill.mjs ~/praesto-snapshots/praesto-2026-11-11.json`, on Node 24, from `main` at `736b2a2`. Production is never contacted by the drill.
- **Result:** `restore-drill: applied 8 migrations` (`0000` to `0007`), then per-table counts, snapshot against restored:

| Table | Snapshot | Restored | |
|---|---|---|---|
| `life_areas` | 1 | 1 | OK |
| `recurrence_series` | 4 | 4 | OK |
| `tasks` | 94 | 94 | OK |
| `reminders` | 9 | 9 | OK |
| `google_calendar_selections` | 0 | 0 | OK |

The excluded tables (`google_connections`, `push_subscriptions`, `oauth_states`, `cron_runs`, `push_dispatch_attempts`) have their schema present and no rows, `OK`. The field-level comparison read `every field identical` for the four tables that have rows; `google_calendar_selections` has no rows in this snapshot, so its restore path was **not exercised** by this run (the drill says so itself). Last line: `restore-drill: PASS — the snapshot rebuilds into an empty schema intact.`, exit status 0.

What this does not cover: the new tables `events` and `event_sync_links` are empty in this snapshot (the owner has created no commitment in production yet), so the drill proved that they exist and are empty after a restore, not that a real event round-trips. That is the second half of AC-32, owed after the device proof (`phase-5/release-runbook.md`, Step 8).

## Remote migration `0007` applied (Step 4 of the runbook) — 2026-11-11

Run by the agent at the owner's request, right after the PASS above, against production (`praesto-db`, id `57c2e21c-dcf6-4152-a3d1-6746c5972ee6`), wrangler 4.118.0:

1. `migrations/0007_brown_mac_gargan.sql` read end to end: only `CREATE TABLE` (`event_sync_links`, `events`) and `CREATE INDEX` statements, no `PRAGMA`, no statement that touches an existing table (the one `DELETE` in the file is the `ON DELETE set null` of a foreign key).
2. **D1 Time Travel bookmark taken before the change:** `000047bf-00000000-00005120-e4df40f39a9ff9ff36951408b8da994f` (`wrangler d1 time-travel info praesto-db`). A restore overwrites the database in place, so it is a last resort, not a plan; Cloudflare's free plan keeps 7 days.
3. Off-repo copy of the data: the snapshot above, in `~/praesto-snapshots`.
4. `wrangler d1 migrations list praesto-db --remote`: exactly one pending, `0007_brown_mac_gargan.sql`.
5. `npm run db:migrate:remote`: `Executed 7 commands`, `0007_brown_mac_gargan.sql` ✅.
6. After: `migrations list --remote` read `No migrations to apply!`; `sqlite_master` lists `events` and `event_sync_links` beside the existing tables; counts read `events` 0, `event_sync_links` 0, and `tasks` 94 and `reminders` 9, **unchanged** from the snapshot.

Production schema is now ahead of the deployed code (`v0.13.0`), as the runbook intends: the old app never reads the new tables, and the code that does is deployed next.
