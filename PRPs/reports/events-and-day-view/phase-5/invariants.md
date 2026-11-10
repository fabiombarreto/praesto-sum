# Invariants record — PRD AC-33 (unit 14 `events-and-day-view`, phase 5)

Written 2026-10-21 by the Implementer of phase 5, from commands it ran in this worktree
(`C:/repos/assistente-pessoal/.worktrees/events-and-day-view`, branch `feature/events-and-day-view`). The base of every
comparison is `git merge-base main HEAD`, which is `4231ee81adcdcbb13765b1f70d69029ce170c533` (`main` and `HEAD` are the same
commit; the whole unit is uncommitted in the working tree and index, as the pipeline never commits). No figure below is
estimated. The shell was Git Bash on Windows; the dev server was never started and no production token or data was used.

## 1. The commands and their results

| Command | Exit | Result |
|---|---|---|
| `npm run check` | 0 | `wrangler types --check` (types up to date), `tsc -b`, `eslint .` and `prettier --check .` all clean ("All matched files use Prettier code style!") |
| `npm test` (first full run of this phase, before this record and the `CLAUDE.md` figures existed) | 1 | 118 files, 2878 tests, 2872 passed, 6 failed: the four `hand-off: invariants record` cases (this file did not exist yet) and the two `derived context: CLAUDE.md` cases (the figures were not yet written). Every other case, including both new suites' other 117 cases and all 2755 older tests, was green |
| `npm test` (final run, after every record and document was written) | 0 | 118 files, 2878 tests, 2878 passed, 0 failed (JSON reporter: `success: true`), against the floor of 2755 |
| `npx vitest run --project docs` (the Node-side project) | 0 | 7 files, 252 tests, 252 passed, 0 failed, against the floors of 129 tests and 7 files |
| `node scripts/check-mirror-inventory.mjs` (repository root) | 0 | `PASS: mirror inventory closed (attendees/reminders/recurrence unreachable)` |
| `npm run build` | 0 | `tsc -b && vite build && node scripts/check-dev-token-absent.mjs`: 72 modules, precache 25 entries (524.04 KiB), `check-dev-token-absent: PASS — 17 text files scanned under dist/` |

The floors: 2755 tests overall (the phase-4 gate: 116 files) and 129 in the `docs` project (five files). The two new suites
add 123 cases: `test/mirror-inventory.test.ts` (42) and `test/close-out-docs.test.ts` (81), so 2755 + 123 = 2878 tests and
116 + 2 = 118 files.

## 2. Diff checks against the base

| Check | Command (against the base above) | Result |
|---|---|---|
| `src/shared/recurrence.ts` and `src/shared/adherence.ts` byte-identical | `git diff --quiet "$base" -- src/shared/recurrence.ts src/shared/adherence.ts` | PASS (exit 0) |
| No `.sql` migration or pre-`0007` drizzle snapshot modified or deleted | `git diff --name-only --diff-filter=MD "$base" -- 'migrations/*.sql' 'migrations/meta/000[0-6]_snapshot.json'` | PASS (empty). `migrations/meta/_journal.json` changes by 7 inserted lines, the `0007` entry, as drizzle-kit writes it |
| The only `.sql` absent from the base is `0007` | the list of `migrations/*.sql` for which `git cat-file -e "$base:$f"` fails, then an exact count and an anchored match `^migrations/0007_[^/]+\.sql$` | PASS: exactly one file, `migrations/0007_brown_mac_gargan.sql` |
| No test file deleted | `git diff --diff-filter=D --name-only "$base" -- test` | PASS (empty) |
| No skip, only or todo marker added | `git diff "$base" -- test` filtered for `.skip(`, `.only(`, `.todo(`, `xit(`, `xdescribe(`, plus the same filter over `git ls-files --others --exclude-standard -- test` | PASS (none in the diff, and no untracked test file exists) |
| No accepted ADR edited | `git diff --quiet "$base" -- documentation/60-decisions` | PASS (exit 0) |
| Nothing under `src/`, `test/` or `vitest.config.ts`, and no dependency file, touched by this phase | `git diff --name-only -- src test vitest.config.ts` (unstaged changes: this phase's own) and `git diff --name-only "$base" -- package.json package-lock.json` | PASS (both empty) |

Two things the plan's one-line forms of these checks would have got wrong, and how this record avoids them: a `case "$new" in
migrations/0007_*.sql)` test passes a multi-line value (two new files) as long as the first one matches, so the check above
counts the lines and anchors the match; and `git diff "$base" -- test` does not see an UNTRACKED new test file, so the skip
marker scan also reads `git ls-files --others` (there are none today: the two new suites are in the index).

The no-test-or-config sentence of the plan has to be stated truthfully. THIS phase's Implementer touched no test file, no
`vitest.config.ts` and nothing under `src/`. The unit as a whole did touch tests and config: the phase-5 test pair added
`test/mirror-inventory.test.ts` and `test/close-out-docs.test.ts` and registered them in `vitest.config.ts` (additively, in
the `worker` project's `exclude` and the `docs` project's `include`), and earlier phases added and registered their own
suites. Eight older files are modified against the base by those earlier phases' approved suites (`test/app-route.test.ts`,
`test/export-completeness.test.ts`, `test/export-envelope.test.ts`, `test/export-ics-route.test.ts`,
`test/export-ics.test.ts`, `test/export.test.ts`, `test/isolation.ts` and `test/life-areas-export.test.ts`): 552 added lines
and 8 removed ones, and the 8 removed lines are three test titles that said "five" tables, three comment lines about the
five-table dump (it now has seven) and two imports; none is an assertion, a skip marker or a loosened expectation. This phase did not make or
review those edits, it only records that the diff holds them.

## 3. Mirror inventory (`scripts/check-mirror-inventory.mjs`)

**What the rule is for.** ADR-0007's closed mirror inventory keeps Google's `attendees`, `reminders` and `recurrence` out of
Praesto: attendees are other people's data and would reach the FR-042 export, and Google's reminders would double every
notification. The script is positional, not textual: those fields may be read in one file, the Google mapper
(`src/shared/google-events.ts`), and there only as a presence test; a comment cannot disarm it because comments are stripped
before the test.

**Before.** Run unchanged on this branch, it exited 1:

```
FAIL: mirror-inventory fields read outside the sanctioned presence test:
  src/app/api.ts:192: return body.reminders;
  src/shared/export.ts:83: reminders: tables.reminders,
```

It listed exactly these two lines and no third. Both read Praesto's OWN Reminder entity (unit 7), not Google's field:
`src/app/api.ts` unwraps the `{ reminders: ReminderDto[] }` response of `/api/reminders`, and `src/shared/export.ts` names the
`reminders` key of the export envelope. `CalendarEventDto` has no `reminders` field, so neither line can be Google data. The
script was written on 2026-08-28 for unit 4, before unit 7 introduced the entity, and it was wired into no npm script, test or
deploy step, so nobody ran it against that entity and it has failed on `main` since.

**After.** The script gained a two-entry constant, `OWN_REMINDERS`, and one `return` line after the mapper's, tested against
the comment-stripped line. It exits 0 and prints `PASS: mirror inventory closed (attendees/reminders/recurrence unreachable)`.
Each exemption is pinned to a FILE (`rel === own.file`, so a path that merely ends the same way is refused) and to the WHOLE
trimmed line (so a second read before or after the pinned text on the same line is refused). `attendees` and `recurrence` have
no exemption of any kind, and `FORBIDDEN`, `MAPPER`, `PRESENCE_TEST`, `walk`, the comment stripping, the messages and the exit
codes are unchanged.

**Alternatives rejected.**

- Rewriting the two shipped lines into a destructuring form (`const { reminders } = ...`) would change production code in two
  files for the sake of a regex, and would normalise exactly the shape this script cannot see in Google code.
- Widening the script to a directory or to the name `reminders` would blind it: any `.reminders` read in `src/app/` or in the
  export module would pass, including a Google one.
- Pinning by line alone, or by file alone, was rejected for the same reason: the same line in another file, or another
  `.reminders` read in a pinned file, must still fail.

**Residual risk, stated honestly.** A Google read spelled exactly `return body.reminders;` inside `src/app/api.ts` (or
`reminders: tables.reminders,` inside `src/shared/export.ts`) would pass. It is not reachable today because
`CalendarEventDto` has no such field. The destructuring shape `const { reminders } = x` is invisible to the regex in every
file, as it was before this change. If either pinned line is rewritten later, the exemption must be removed with it: a case in
`test/mirror-inventory.test.ts` fails when the pinned line no longer exists.

**The permanent guard.** `test/mirror-inventory.test.ts` runs the real script against planted trees (the refusals it has
always made, the two pinned lines, eight places the same lines are refused, eleven other reads inside the pinned files, a
pinned line beside an unpinned read) and against the real repository, so `npm test` now runs the tripwire on every run. That
removes the cause of the rot without touching `package.json`: wiring the script into `npm run check`, `build` or `deploy`
stays with the owner. No ADR is written; this is a tooling-level fix and the reasoning lives here and in the script header.

## 4. Unit 15's needs, without a column change

Read from `migrations/0007_brown_mac_gargan.sql`, and confirmed by applying every migration to a throwaway `node:sqlite`
database and reading `PRAGMA table_info` (the same engine `scripts/restore-drill.mjs` uses): `PASS: unit-15 columns present`.
Unit 15 (writing Events to Google) needs no new column on either table.

| Unit 15 needs | Column in the migrated schema | Table |
|---|---|---|
| Identity of the Google object | `calendar_id` (NOT NULL), `external_event_id` (NOT NULL), unique together (`event_sync_links_external_unq`) | `event_sync_links` |
| Which Event a link belongs to | `event_id`, nullable, unique (`event_sync_links_event_id_unq`), `ON DELETE SET NULL` — an orphan link is the pending deletion in Google | `event_sync_links` |
| Provenance | `events.source` (`local` or `google`, `DEFAULT 'local' NOT NULL`, `events_source_chk`) | `events` |
| The Event's content hash | `events.content_hash` (`text NOT NULL`), written by the one repository function | `events` |
| The sync baseline | `synced_content_hash`, `etag`, `synced_at` (all nullable until a first sync) | `event_sync_links` |
| Shape of the time and the zone | `all_day`, `timezone` (NOT NULL), `start_at`, `end_at`, `start_date`, `end_date` under `events_shape_chk` | `events` |

The dirty test unit 15 will use is `content_hash <> synced_content_hash`, never `updated_at`; this phase only verifies that the
columns exist (the earlier suite `test/event-schema.test.ts` already stores a row field for field in both tables).

## 5. The files this phase changed

Nothing under `src/`, `migrations/`, `test/`, `vitest.config.ts`, `package.json` or `package-lock.json` was touched by this
phase (the dependency files are the owner's at the version bump, so they are not diffed against `main` here beyond the
empty-diff check above: the version is still `0.13.0`). The Implementer's files:

- `scripts/check-mirror-inventory.mjs` (the `OWN_REMINDERS` constant and one line).
- `documentation/`: `10-product/glossary.md`, `10-product/visual-identity.md`, `20-requirements/functional-requirements.md`,
  `30-architecture/domain-model.md`, `30-architecture/architecture-overview.md`, `40-engineering/ui-layout-standard.md`,
  `50-planning/roadmap.md`.
- `docs/`: `domain/glossary.md`, `domain/areas/events.md`, `context/architecture.md`, `context/integrations.md`,
  `api-reference.md`, `KNOWLEDGE_BASE.md`. In `context/integrations.md` line 26 changed in this phase (the Google Calendar `Status`
  bullet, where "no integration code exists yet" became "the read shipped in unit 4"); line 15 changed afterwards, in the
  follow-up adjustment recorded below.
- `CLAUDE.md`.
- Under `PRPs/reports/events-and-day-view/`: `phase-5/invariants.md` (this file), `phase-5/ui-checklist.md`,
  `phase-5/release-runbook.md` and `device-proof.md`.

**Noticed outside the plan, then fixed in a follow-up adjustment (2026-10-21, at the owner's request after the pipeline closed).**
`docs/context/integrations.md` line 15 (the Web Push `Library` bullet) still named `web-push` under `nodejs_compat` although
ADR-0013 replaced it with `@block65/webcrypto-web-push@2.0.0` after `web-push` hung inside workerd. The plan's NOT-Building list
and Notes left that line alone and its Task 5 authorized only the line 26 edit, so the phase left it as found; the follow-up
rewrote that one line to name the ADR-0013 library. The same adjustment, made by hand outside the pipeline, also touched two
`documentation/` files: `50-planning/roadmap.md` (the Next bullet's chore C6 sentence, which still said C6 had not run on
production data since migration `0006`, and unit 12's table row, which said only "delivered in code") and
`30-architecture/domain-model.md` (the Life Area definition and rules 3 and 8, which said Events would belong to an area
once they shipped, while ADR-0015 and the Event section record that unit 14 ships Events without one). The `docs` project
(7 files, 252 tests) passed after it.

## 6. Final run

After every file above was written, `npm test` (118 files, 2878 tests, all passed), the `docs` project (7 files, 252 tests, all
passed) and `node scripts/check-mirror-inventory.mjs` (exit 0) were run again on 2026-10-21; `npm run build` and the
unit-15 schema probe of section 4 were run in the same state. Those are the figures `CLAUDE.md` states ("2878 tests / 118
files"). `npm run check` was run once more in the same final state and exited 0 (Markdown is outside Prettier's reach, per
`.prettierignore`: `documentation/`, `docs/`, `CLAUDE.md` and `PRPs/`). What this record does not claim: AC-31 (the device proof) and
AC-32 (the two restore drills on real snapshots) are the owner's and have not been run, and the unit is not shipped.
