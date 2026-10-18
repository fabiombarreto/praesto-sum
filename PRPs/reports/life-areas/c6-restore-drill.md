# Chore C6 — unit 13 close-out run (`life_areas` exercised on a synthetic fixture)

**Date:** 2026-10-12 · **Trigger:** unit 13 `life-areas` phase 4 (the close-out); `life_areas` has been
empty in every snapshot the drill has seen (`PRPs/reports/data-export/c6-restore-drill.md`), and
unit 13 is on the roadmap's C6 trigger list.
**Tool:** `scripts/restore-drill.mjs`, unchanged. Its own output, unedited, is
`PRPs/reports/life-areas/c6-drill-output.txt`.

## SYNTHETIC FIXTURE RUN

**This is not the owner's data and it is not PRD AC-18.** Every row below was produced through the
real routes of a LOCAL worker (`vite dev`: real workerd, local D1, the dev bearer token from
`.dev.vars`), by a throwaway script kept outside the repository. There is no production token in
this session, production holds no Life Area (unit 13 is not deployed), and nothing here contacted
production or used `--remote`.

How the fixture was made, through the real routes only:

- `POST /api/life-areas` twice: `Casa` and `Saúde`.
- `POST /api/tasks` three times: `Lavar a louça` assigned to `Casa`, `Marcar consulta` assigned to
  `Saúde`, `Comprar pilhas` with no area.
- `POST /api/series`: a daily series `Regar as plantas` (`dtstart` today, `dateMode: "scheduled"`)
  assigned to `Casa`, then `POST /api/tasks/<occurrence>/complete`, so a `done` row keeps the area
  and a successor is spawned carrying it.
- `UPDATE life_areas SET description = 'Onde a gente mora' WHERE name = 'Casa'` through
  `npx wrangler d1 execute praesto-db --local` (the API never writes `description`), so a non-null
  and a null `description` (`Saúde`) both round-trip.
- Migrations `0000` to `0006` applied to the LOCAL D1 first with `npm run db:migrate`.
- The snapshot was pulled with the unattended job's own script, pointed away from everything real:
  `PRAESTO_EXPORT_BASE_URL=http://127.0.0.1:5178`, a token file in a scratch directory (never
  printed, never in this record), and `PRAESTO_SNAPSHOT_DIR` set to a scratch directory. It was
  **not** written to `~/praesto-snapshots`, so the weekly job's same-day rule cannot skip a real
  snapshot because of it.

**Snapshot (not committed — it is local dev data; the record carries enough to check a re-run):**
`praesto-2026-10-12.json`, 3,567 bytes, SHA-256
`12177c8ab174a3adfe920bc690856067da944b19eb8ca736ae1981ea4bcd65a2`, `formatVersion` 1.

## Result: PASS (on the fixture)

| Table | Snapshot | Restored | Fields |
|---|---|---|---|
| life_areas | 2 | 2 | every field identical (`description` non-null on one row, null on the other) |
| recurrence_series | 1 | 1 | every field identical (`lifeAreaId` set; the `0006` columns `nudgeMuted` and `nudgedAt` present) |
| tasks | 5 | 5 | every field identical (4 carry a `lifeAreaId`, 1 is area-less; one `done`, one successor) |
| reminders, google_calendar_selections | 0 | 0 | not exercised |
| google_connections, push_subscriptions, oauth_states, cron_runs, push_dispatch_attempts | 0 | 0 | the excluded tables: present in the schema, no row restored |

The schema was built from all seven `migrations/*.sql` (`applied 7 migrations`) and the drill's
exit status was 0 (`restore-drill: PASS`, captured with `pipefail`).

**What this proves.** The camelCase to snake_case mapping and the foreign-key columns round-trip
for `life_areas` rows (including `lifeAreaId` on `tasks` and `recurrence_series`, which the
`ON DELETE SET NULL` foreign keys the migrations declare constrain), for a Task that is `done`, for a
series that carries an area, and for the `0006` series columns, field for field.

**What it does not prove.**

- Nothing about the owner's real rows. A synthetic fixture proves the fixture: the interesting
  corruption is the unusual real value, and no real area, name or assignment was in this snapshot.
- Nothing about D1 over the network (the rebuild is local SQLite, as the drill's own header says).
- Nothing about a snapshot taken in production after the unit is deployed.
- `reminders` and `google_calendar_selections` were empty in this snapshot, so the drill says
  `restore path NOT exercised` for both, as it should.

## REAL SNAPSHOT RUN: OWED

PRD AC-18 reads: "a production snapshot holding at least one `life_areas` row and one assigned
Task". **That is NOT met.** This record claims the drill ran on a synthetic fixture and nothing
more; AC-18 stays open until the run below is recorded here.

The owner's procedure, once unit 13 is deployed:

1. In production, create at least one area and assign at least one Task to it.
2. Take the next Sunday snapshot, or pull one by hand with `node scripts/pull-export-snapshot.mjs`
   (it is read-only against production and writes `~/praesto-snapshots/praesto-<date>.json`).
3. From the repository root, run
   `node scripts/restore-drill.mjs ~/praesto-snapshots/praesto-<date>.json`.
4. Append a `## Re-run` section to this file with the table above filled from that snapshot and
   its `*Status:*` line.

That same snapshot also closes the "chore C6 after unit 12's migration `0006`" item the PRD lists
as open: this synthetic run rebuilt the schema with `0006`, but only a real snapshot says anything
about real rows under it.

*Status: SYNTHETIC FIXTURE PASS (2026-10-12) — life_areas exercised on rows produced through the real
routes; the real production snapshot run is OWED and AC-18 is not claimed*
