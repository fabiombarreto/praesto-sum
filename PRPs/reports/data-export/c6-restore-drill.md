# Chore C6 — prove the restore

**Date:** 2026-09-07 · **Trigger:** "right after C5" — C5 was absorbed into unit 5 phase 4, and the first snapshot now exists
**Snapshot used:** `~/praesto-snapshots/praesto-2026-09-07.json` (3,778 bytes), produced by a real
unattended-shaped run of `scripts/pull-export-snapshot.mjs` against production version `9e173429`
**Tool:** `scripts/restore-drill.mjs` (new, committed — C6 fires again before every migration over
real data, so it is written to be re-run rather than performed once by hand)

## Result: PASS

| Check | Result |
|---|---|
| Schema built from the same four `migrations/*.sql` production ran | applied cleanly |
| `tasks` — 12 rows in the snapshot | 12 restored |
| `life_areas`, `recurrence_series`, `reminders`, `google_calendar_selections` — 0 rows | 0 restored |
| `google_connections`, `push_subscriptions`, `oauth_states` — the excluded tables | present in the schema, **0 rows**; the export leaked none of what it promised to exclude |
| Field-level comparison, **all 12 Tasks, every field** | every field identical to the snapshot |

The field comparison matters more than the counts. Counts alone would pass on a restore that
turned every row into nulls; comparing each field of each row is what shows the data survived,
including the accented pt-BR titles and the null-vs-value distinction on `deadline` and
`scheduledDate`.

## What this does NOT prove — read before trusting it further than it goes

**Four of the five data-bearing tables were empty in this snapshot**, and the drill now says so in
its own output rather than in a footnote: `restore path NOT exercised`. Only `tasks` genuinely
round-tripped. A table carrying rows could still reveal a type-mapping fault this run cannot see —
an epoch-seconds column arriving as a string, a nullable column collapsing to `''`, the
camelCase→snake_case mapping missing a compound name. `reminders` and `recurrence_series` are the
ones to watch, since they carry the epoch instants and the denormalised `next_fire_at` ADR-0006
depends on.

This closes on its own: C6's trigger fires again before every migration over real data — units 13,
14, 15, 17, 18, 19 and 20 — and by then those tables will hold rows. The gap is recorded rather
than engineered around, because a synthetic fixture would prove the fixture, not the owner's data.

**The rebuild is local SQLite, not D1 over the network.** That is deliberate: D1 *is* SQLite,
`migrations/*.sql` is plain SQL, and rebuilding locally proves the schema and the snapshot agree
without creating a billable Cloudflare resource or pointing a destructive command at a real
database by mistake. What it therefore does not exercise is D1-specific behaviour at the network
boundary — batch limits, statement size ceilings, `wrangler d1 execute --file` chunking. A restore
of a much larger snapshot could meet those and this drill would not have warned about it.

**Nothing was restored INTO anything real.** The database is a temp file, deleted in a `finally`
block. Production was never contacted; the snapshot file was read, never written.

## Why this chore exists at all

The roadmap's own framing: a backup that has never been restored is a hypothesis, not a safeguard.
ADR-0003 accepted Cloudflare holding the only canonical copy *conditionally*, and this drill is the
condition being checked rather than assumed. Until today the export had been tested — thoroughly,
666 tests — but never once read back into a schema.

*Status: PASS, with the empty-table limitation recorded and self-closing at the next trigger*
