# Release runbook — `v0.14.0` (unit 14 `events-and-day-view`, phase 5)

Written 2026-10-21 by the Implementer of phase 5, to be executed top to bottom by the owner. **Every step below is the
owner's.** The relay pipeline never commits, pushes, opens a pull request, merges, tags, deploys, applies a remote migration
or reads a production token, so none of it has been done and nothing here is recorded as done. This file is a hand-off, not a
log: the owner's results go into the records named in each step.

**Status, 2026-11-11 (added after the text above was written):** Steps 1 and 2 are done — the owner merged PR #13 on
2026-11-10 (merge commit `2b693b9`, `main` is at or past it). Steps 3 to 9 are still open, and nothing has been deployed.

**Why the order is what it is.** Migration `0007` is additive and CREATE-only (`events`, `event_sync_links` and their
indexes — no table is rewritten), so it ships BEFORE the code that uses it: the running `v0.13.0` app never sees a schema it
does not know, the new code never runs against a schema that lacks its tables, and the old code can still be rolled back.
The drill on the latest real snapshot comes before the migration because "a backup that has never been restored is a
hypothesis, not a safeguard" (ADR-0003; chore C6), and the owner's data lives only in D1 until a restore is proved.
`npm run deploy` builds, then refuses to deploy unless the tag `v<version>` points at `HEAD` (`scripts/check-version-tag.mjs`,
which never creates the tag), so the version bump and the tag come before the deploy. The drill on a snapshot that holds a
real event can only come after the device proof, because the events only exist once the owner has created them.

## Steps

### Step 1: Commit and pull request

Through the relay commands the owner already uses to close a unit, on the unit's branch `feature/events-and-day-view`
(the work of phases 1 to 5 is in the working tree of its worktree, uncommitted: the pipeline never commits). The diff
contains: migration `0007` and its drizzle-kit snapshot; the Event schema, repository, routes and export; the pure
`src/shared` modules; the day route, the Compromisso sheet and the search group; the test suites; the documentation sync;
the pipeline records under `PRPs/`; and `scripts/check-mirror-inventory.mjs` with its two suites. It contains no
production token and no snapshot of the owner's data (the snapshots stay off-repo). `package.json` still says `0.13.0`: the
version bump belongs to Step 5.

### Step 2: Merge

Merge the pull request into `main` after review. On `main`, confirm `npm run check` and `npm test` are green before moving
on (the merge is the last point at which the unit can still be abandoned without touching production).

### Step 3: Chore C6 on the latest real snapshot, before the migration

This is the first half of PRD AC-32.

1. Take the latest snapshot of the weekly job, or a fresh one: `node scripts/pull-export-snapshot.mjs`. It reads the
   production bearer token from the token file the weekly job already uses (`PRAESTO_TOKEN_FILE`, default
   `~/.praesto/export-token.txt`; the setup is in `documentation/40-engineering/snapshot-task-runbook.md`), pulls
   `GET /api/export` and `GET /api/export.ics` from `PRAESTO_EXPORT_BASE_URL` (default production) and writes dated files
   into `PRAESTO_SNAPSHOT_DIR` (default `~/praesto-snapshots`), never overwriting a file written the same day. The token is
   never pasted into a command, a record or a chat.
2. From the repository root, on Node 24: `node scripts/restore-drill.mjs <path-to-the-snapshot.json>`. It rebuilds a
   throwaway SQLite file from every `migrations/*.sql` (`0007` included, so the new tables exist and are empty), loads every
   dumped row, and compares counts and every field of every row. Production is never contacted by the drill.
3. Expected: every table `OK` in the count table, the field-level comparison `every field identical` for each table that
   has rows, and the last line `restore-drill: PASS` with exit status 0. Any `MISMATCH`, `LEAKED` or a non-zero exit means
   **stop: do not apply the migration** and bring the output back.
4. Record the result under `PRPs/reports/events-and-day-view/` (the snapshot's date, its SHA-256, the per-table counts and
   the `PASS` line — not the snapshot itself, which is personal data and stays off-repo).

### Step 4: Remote migration 0007

1. Read `migrations/0007_*.sql` end to end first (`documentation/40-engineering/dev-environment.md`, recurring deploy
   table, row 6): confirm it only creates tables and indexes, and has no `PRAGMA foreign_keys=OFF/ON`.
2. Record a D1 Time Travel bookmark before touching production: `npx wrangler d1 time-travel info praesto-db` (it lists the
   current bookmark; `--timestamp` accepts a Unix or RFC3339 time and `--json` makes it machine-readable; verify the
   subcommand with `--help` on the wrangler you have installed). Cloudflare's documentation gives the free plan 7 days of
   retention. A Time Travel restore overwrites the database in place, so the bookmark is a last resort, not a plan.
3. Keep a copy of the data off-repo, as step 1 of "Remote migration over existing data" in the same document orders (the PRD's
   Open Questions say those steps apply even though this migration only creates tables): the snapshot of Step 3 is that copy
   for every table, and a fresh `npx wrangler d1 execute praesto-db --remote --json --command "SELECT * FROM tasks"` kept
   off-repo is the two-minute version. It is personal data: never inside the repository.
4. `npx wrangler d1 migrations list praesto-db --remote` — exactly one migration is pending, `0007_*`.
5. `npm run db:migrate:remote` (row 7 of the recurring deploy table; it targets **production** and confirms by itself).
   `0007` is CREATE-only, so no table is rewritten and the bare command is the right path, but only after the file has been
   read end to end (item 1).
6. `npx wrangler d1 migrations list praesto-db --remote` — nothing pending, and the count matches item 4. Then check that the
   new tables exist:
   `npx wrangler d1 execute praesto-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` must list
   `events` and `event_sync_links` besides the existing tables. (The smoke-test row of
   `documentation/40-engineering/dev-environment.md` that lists the expected tables is out of date and does not name them.)
   `SELECT COUNT(*) FROM events` should read 0.

### Step 5: Version bump and tag v0.14.0

The steps of "Cutting a release" in `documentation/40-engineering/dev-environment.md`, in order:

1. `npm run check` and `npm test` green.
2. Bump `version` to `0.14.0` in `package.json` AND `package-lock.json` (both carry the number; `npm version 0.14.0
   --no-git-tag-version` updates both).
3. Commit it: the tag must point at the commit that carries the number.
4. `git tag v0.14.0`, then push the commit and `git push origin v0.14.0`.

`npm run deploy` runs `scripts/check-version-tag.mjs` after the build and fails the deploy when no `v0.14.0` tag points at
`HEAD`; it never creates the tag. `PRAESTO_SKIP_VERSION_TAG=1` skips the guard and is for a hotfix that is deliberately not a
release, not for this one.

### Step 6: Deploy

`npm run deploy` (build, then the tag guard, then `wrangler deploy`; it ends with the URL and `schedule: */5 * * * *`).
Then the smoke test of `documentation/40-engineering/dev-environment.md` (gate closed, gate open, SPA served), and look for
*versão 0.14.0 · <commit>* in the corner of *Configurações*. Record the Cloudflare version id beside the tag in the
roadmap's Delivery history (`documentation/50-planning/roadmap.md`), so the two identifiers stay connected. The unit stays
`in-progress`: deploying it does not ship it.

### Step 7: Device proof (AC-31)

On the phone, against production, follow the Procedure of `PRPs/reports/events-and-day-view/device-proof.md`: create a real
timed commitment and an all-day one, edit one, delete a throwaway one, see them beside the Google commitments and the dated
Tasks, find one in search, try it offline, and say in his own words whether he missed any field Google has. Write what he
saw in that file's `## Observation (owner)` section and decide the open items of `## Decisions awaiting the owner`. **Leave
at least one real commitment in place** — Step 8 needs it.

### Step 8: Chore C6 on a real snapshot holding an event (AC-32)

The second half of PRD AC-32, after Step 7 created real commitments. Take a fresh snapshot with
`node scripts/pull-export-snapshot.mjs` (if the weekly job already wrote today's file the script skips it by design: wait for
the next day's file, or point `PRAESTO_SNAPSHOT_DIR` at a new empty directory), confirm `tables.events` holds at least one
row, and run `node scripts/restore-drill.mjs <path-to-the-snapshot.json>` as in Step 3. Expected: counts equal in every
table, `events` and `event_sync_links` both listed, and every field identical for the `events` rows — `content_hash` and
`all_day` among them (`all_day` is bound as the 0 or 1 SQLite stores). `event_sync_links` will read `no rows in this
snapshot — restore path NOT exercised`: that is expected, no route writes it until unit 15. The last line must be
`restore-drill: PASS`. Record it under `PRPs/reports/events-and-day-view/`, next to the Step 3 record.

### Step 9: Record and decide

Fill in the observation of Step 7, record both drill results (Steps 3 and 8), update the roadmap row of unit 14 and the
Delivery history, and update `CLAUDE.md`'s unit-14 paragraph to what is now true. Then decide: `shipped`, or keep the unit
`in-progress` while the findings are worked, or revert (see Rollback). A week of use is the exit signal: the day view shows
all three sources through the same range function, and the owner has created a local commitment without missing any field
Google has. The unit becomes `shipped` only on his decision.

## Rollback

`wrangler rollback` reverts the deployed code to the previous version and leaves D1 untouched (Cloudflare's documentation),
which is safe here because `0007` is additive: `v0.13.0` simply ignores the two new tables. A D1 Time Travel restore
overwrites the database in place and is a last resort — restoring to the Step 4 bookmark discards every Task, Reminder and
commitment written since. If a step fails before Step 4, nothing in production has changed; if Step 4 fails, `wrangler d1
migrations apply` rolls back the failing migration, and the bookmark of Step 4 is the way back to the moment before it.
