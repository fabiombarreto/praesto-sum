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

## Real snapshot run #1 — the 2026-10-11 snapshot (before unit 13 was deployed): PASS, `life_areas` NOT exercised

Run on 2026-10-18 on the latest snapshot the weekly job had written, `~/praesto-snapshots/praesto-2026-10-11.json`
(13,505 bytes, SHA-256 `40d64002809d0bdd848ad851ce122c69f42d305937a7d1692331c585a32079c4`, `formatVersion` 1).
It is the owner's real data, kept off the repository; this record carries counts only. The snapshot
already carries `nudgeMuted`, `nudgedAt` and `lifeAreaId`, so production was on `v0.12.0` (migration `0006`) when
it was taken.

| Table | Snapshot | Restored | Fields |
|---|---|---|---|
| life_areas | 0 | 0 | no rows — restore path NOT exercised |
| recurrence_series | 4 | 4 | every field identical |
| tasks | 29 | 29 | every field identical |
| reminders | 8 | 8 | every field identical |
| google_calendar_selections | 0 | 0 | no rows — restore path NOT exercised |

The schema was built from all seven `migrations/*.sql` and the drill exited 0 (`restore-drill: PASS`).

**What this settles:** chore C6 after migration `0006`, on real rows — the item unit 12's release record
left open. **What it does not settle:** PRD AC-18. That snapshot predates the unit-13 deploy and holds no
`life_areas` row, so the one thing AC-18 is about, areas and their assignments round-tripping, was not
exercised on real data.

## REAL SNAPSHOT RUN FOR AC-18: DONE 2026-10-18 (see Re-run) — the preparation notes follow

PRD AC-18 reads: "a production snapshot holding at least one `life_areas` row and one assigned Task".
**That was NOT met until the run recorded under Re-run below** (2026-10-18, evening). Until then this record
claimed the drill ran on a synthetic fixture and on a real snapshot that held no area, and nothing more.

**State of the preparation (2026-10-18, evening):**

- The pull script, the drill script and the owner's token file (`~/.praesto/export-token.txt`, read only by
  the script, never by an agent) are in place, and the drill ran clean on a real snapshot (above).
- **Production holds no Life Area right now.** Read-only counts through `wrangler d1 execute --remote`:
  `life_areas` 0, Tasks with an area 0, series with an area 0. Pulling a snapshot today would repeat run #1
  and still not meet AC-18. The run is ready; the data is what is missing — the owner keeps at least one
  area, with at least one Task assigned to it, in production (which is also what the unit's exit signal
  asks of him).

**When production holds an area and an assigned Task, in this order:**

1. Confirm it, counts only, read-only:
   `npx wrangler d1 execute praesto-db --remote --command "SELECT count(*) AS areas FROM life_areas"` and
   `npx wrangler d1 execute praesto-db --remote --command "SELECT count(*) AS assigned FROM tasks WHERE life_area_id IS NOT NULL"`
   — both at least 1.
2. Pull a fresh snapshot: `node scripts/pull-export-snapshot.mjs` (read-only against production; it
   writes `~/praesto-snapshots/praesto-<today>.json`). **Trap:** the script never overwrites a file from
   the same day. If the weekly job already wrote today's file *before* the area existed, the pull prints
   `already exists, skipping` and the old file is what you would drill. Move that file aside, or set
   `PRAESTO_SNAPSHOT_DIR` to an empty scratch directory for this pull.
3. From the repository root: `node scripts/restore-drill.mjs <path to that snapshot>`.
4. It meets AC-18 only if the output says `PASS`, `life_areas` shows at least 1 row and
   `every field identical`, and `tasks` shows every field identical. A `NOT exercised` line for
   `life_areas` means the run does not count.
5. Append a `## Re-run` section here with the table above filled from the counts, the snapshot's size
   and SHA-256, and a `*Status:*` line. **Record counts and the hash, never area names, Task titles or
   any row content** — the snapshot is personal data and stays off the repository.

## Re-run — the real snapshot of 2026-10-18 (unit 13 deployed): PASS — PRD AC-18 met

The owner created an area and assigned a Task to it in production (`v0.13.0`). Read-only counts through
`wrangler d1 execute --remote` immediately before the pull: `life_areas` 1, Tasks with an area 1, series with
an area 0. The snapshot was then pulled with the weekly job's own script, `node scripts/pull-export-snapshot.mjs`
(no file existed for that day, so the same-day rule did not apply), and the drill was run on it from the
repository root.

**Snapshot (the owner's real data, kept off the repository, counts and hash only):**
`~/praesto-snapshots/praesto-2026-10-18.json`, 18,454 bytes, SHA-256
`5ee6d3a6bb7e3348813c2a8ddd74f948cbbb0e61e5f77bdac8f5a67e35755ab6`, `formatVersion` 1.

| Table | Snapshot | Restored | Fields |
|---|---|---|---|
| life_areas | 1 | 1 | every field identical |
| recurrence_series | 4 | 4 | every field identical |
| tasks | 44 | 44 | every field identical (one carries a `lifeAreaId`) |
| reminders | 8 | 8 | every field identical |
| google_calendar_selections | 0 | 0 | no rows — restore path NOT exercised |
| google_connections, push_subscriptions, oauth_states, cron_runs, push_dispatch_attempts | 0 | 0 | the excluded tables: present in the schema, no row restored |

The schema was built from all seven `migrations/*.sql` (`applied 7 migrations`) and the drill exited 0
(`restore-drill: PASS`).

**What this proves.** The one real `life_areas` row (id, name, `description`, `createdAt`, `updatedAt`) and the
one real Task carrying a `lifeAreaId` rebuild into an empty schema field for field, alongside every real
series, Task and reminder the owner has: PRD AC-18 as worded ("a production snapshot holding at least one
`life_areas` row and one assigned Task") is met.

**What it does not prove.** No series carries an area in production yet, so the series-to-area assignment was
exercised only on the synthetic fixture; nothing about D1 over the network (the rebuild is local SQLite, as the
drill's own header says); nothing about deleting an area on real data.

*Status: SYNTHETIC FIXTURE PASS (2026-10-12), REAL SNAPSHOT PASS without areas (2026-10-11 snapshot) and REAL
SNAPSHOT PASS with one area and one assigned Task (2026-10-18) — PRD AC-18 is met*
