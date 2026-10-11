# Dogfood report — manual-QA runner case vocabulary on relay 0.44.0 (praesto-sum)

- **Relay PRD:** `C:\repos\PRPs-agentic-eng\PRPs\prds\qa-runner-case-vocabulary.prd.md`, Phase 8 (praesto-sum half). super-ensino runs as a separate session.
- **Relay version:** 0.44.0 (`~/.claude/plugins/cache/relay-marketplace/relay/0.44.0`, `plugin.json` version `0.44.0`; `/relay-qa-seed` loaded; cached `scripts/visual/node_modules` provisioned, playwright-core 1.63.0).
- **Date:** 2026-10-06 (UTC).
- **Counted run:** `PRPs/reports/missed-sweep/qa-run/20261006T215313435Z`.
- **Diagnostic run (not counted):** `PRPs/reports/missed-sweep/qa-run/20261006T215230646Z` (AC-9 refusal, see below).
- **Baseline run:** `PRPs/reports/missed-sweep/qa-run/20261005T030413214Z` (relay 0.42.0), described in `dogfood-report-0.42.0.md`.
- **Report:** `PRPs/reports/missed-sweep/qa-report.md`, SHA-256 `c1808dd54c67df1704c1c4224edff8bbe5e7cb6663ca9a24c2e99120a1a92b6e`. It was byte-identical before and after both runs, and `results.json` carries the same value in `report_sha256_before` and `report_sha256_after`.
- **Target:** production preview (`npm run build`, then `vite preview --host 127.0.0.1 --port 5173 --strictPort`, cwd `C:\repos\assistente-pessoal`). Same origin as the kit's `baseUrl` (`http://127.0.0.1:5173`). `main` @ `61cf39e`. wrangler 4.118.0.
- **Denominator here:** cases 20 and 23. Cases 21 (device plus production) and 22 (fault injection) are excluded by operator decision, as the PRD's Success Metrics also do.

## What was done

1. **Version check.** The 0.44.0 cache was present, `/relay-qa-seed` was listed and loaded, and the visual `node_modules` were already provisioned.
2. **`/relay-qa-seed C:/repos/assistente-pessoal/PRPs/reports/missed-sweep/qa-report.md`.**
   - `states` returned 14 distinct required-state texts.
   - No package script, Makefile target or seed script in the project produces any of them. `scripts/restore-drill.mjs:72` inserts rows, but only to restore an export into a throwaway SQLite file.
   - All 14 were proposed as `command: null` gaps.
   - `merge` reported `added: 14, kept: 0, gaps: 14`, all `proposed`.
   - The report was unchanged.
3. **Project work, agreed with the operator first: `scripts/qa/seed-missed-occurrence.mjs`.**
   - It writes into local D1 through `wrangler d1 execute praesto-db --local --json`. `--local` is hard-coded, with no flag to remove it.
   - It creates one daily series with yesterday's occurrence `missed` and today's successor `open`: the shape the cron sweep leaves.
   - It prints one JSON object: `task_id`, `series_id`, `successor_id`, `occurrence_date`, `done_count`, `missed_count`, `task_count`.
   - Prettier and ESLint are clean.
   - One manual smoke run created a series (`737c189d…`).
4. **Declarations staged by the agent, confirmed by the operator.**
   - The agent wrote `command`, `store` and `captures` into the two entries for cases 20 and 23, leaving `status: "proposed"`. Both entries use the command `["node", "scripts/qa/seed-missed-occurrence.mjs"]`, the store `localhost`, and the captures `task_id`, `series_id`, `done_count`, `missed_count` and `task_count`.
   - The agent also added `query_sources.d1-local`: kind `wrangler-d1`, command `node node_modules/wrangler/bin/wrangler.js d1 execute praesto-db --local --json --command`, with `redact_columns` set to `title` and `description`.
   - **The operator flipped both entries to `confirmed` by hand** (lines 58 and 94). The agent verified that exactly two `confirmed` values exist and never wrote one.
5. **AC-9 observed live (diagnostic run `20261006T215230646Z`).** With the case-23 entry still `proposed`, the runner returned `blocked / STATE_UNCONFIRMED`, naming the state and the file. A D1 count of QA series afterwards was still 1, the smoke series, so no seed ran.
6. **Target.**
   - `vite dev` injects the token (PS1), so the production preview was used on the same origin.
   - Before the run, an authenticated diagnostic proved that the preview's worker reads the **same** local D1 that `wrangler d1 --local` writes. The smoke-seeded `missed` row appeared in `GET /api/tasks` with status `missed`.
   - `/api/health` answered 200 with the token and 401 without it. The script printed booleans and statuses only.
7. **Kit refresh.**
   - Grounding first stopped with `SESSION_UNAVAILABLE (FAILED_KIT_SCRIPT_STALE)`: the 0.42.0-generated `login-owner.mjs` had no `KIT_TEMPLATE_ID` stamp.
   - With operator approval, `/relay-auth-scripts --role owner --refresh` passed P2, P3 and P4 and regenerated the script (stamp `auth-login/1`). It added only `authenticatesAnonymous: null` to the config, because `browserProbe` was already present.
   - The saved session had expired after 24 h (`maxAgeMinutes: 1440`, PS3), so the script then halted `FAILED_CREDENTIALS_UNAVAILABLE`.
   - The operator re-ran the login script at their own PowerShell terminal, and it created the session. The token never entered the conversation.
8. **Grounding.** `ground --route / --role owner` printed `GROUNDED: grounding/owner--root.snapshot.json entries=54 withheld=0`. `/search` was not grounded: its results appear only after typing, which grounding cannot see.
9. **`/relay-qa-run missed-sweep`**, with the plan holding exactly two entries: case 20 as a partial plan and case 23 in full.

## Phase-8 success signal (praesto-sum half)

| Item | Target | Result | Met? | Evidence |
|------|--------|--------|------|----------|
| Driver-executed outcomes among the reachable cases (20, 23) | contributes to ≥ 9 of 14 across both projects | **1 of 2** (case 23 `pass`) | Contributes 1; the 14-case total needs super-ensino | `results.json`: counts `pass` 20 = `record_resolved` 19 + 1 driver pass |
| praesto-sum case 23 | driver-executed | **`pass`** through HTTP and three `query` steps | **Yes** | `evidence/case-23.http.json`, `case-23.query-{2,3,4}.json` |
| Partially executed | reported | **1** (case 20, `PARTIAL_REMAINDER`) | — | `results.json` `partially_executed: 1` |
| False `pass` | 0 | 0 | Yes | Each pass read below |
| Remaining cases with a vocabulary reason (`NO_PLAN_ENTRY` for an inexpressible state, value or driver; `STATE_UNDECLARED`) | 0 among the reachable cases | 0 | Yes | Case 20 is `PARTIAL_REMAINDER`, a named gap. Cases 21 and 22 keep `NO_PLAN_ENTRY` but are outside the denominator (device/production, fault injection) |
| Token value in tracked files or reports | 0 | 0 | Yes | Secrecy scan below |
| Report byte-identical | yes | yes | Yes | `report_sha256_before` = `report_sha256_after` = `c1808dd5…a92b6e` |
| Cases resolved from the Test Runner's record | reported | 19 (19 pass, 0 fail) | — | `record_resolved: 19`, unchanged from 0.42.0 |
| Runner wall time | recorded | 25 117 ms | — | `duration_ms` (two seeds, one browser, three `wrangler` queries) |

## Outcomes against the 0.42.0 run

| | 0.42.0 run `20261005T030413214Z` | 0.44.0 run `20261006T215313435Z` |
|---|---|---|
| Report SHA-256 | `c1808dd5…` | `c1808dd5…` (same) |
| Target | `vite dev` :5173 (token injected) | production preview :5173 (no injection) |
| `qa-seed.json` | none (moved out of the repo) | 14 entries from `/relay-qa-seed`: 2 confirmed by the operator, 12 `proposed` gaps |
| Query sources | none | `d1-local` (`wrangler-d1`, `--local --json`) |
| pass / fail / blocked / needs-human | 19 / 0 / 0 / 4 | 20 / 0 / 0 / 3 |
| `record_resolved` | 19 | 19 |
| `partially_executed` | — (field absent) | 1 |
| Driver-executed | 0 | **1** |
| Residue among cases 20–23 | 4 × `NO_PLAN_ENTRY` | 1 × `PARTIAL_REMAINDER`, 2 × `NO_PLAN_ENTRY` (excluded cases) |

Per-case table for cases 20–23 (cases 1–19 unchanged: `pass / AUTOMATED_EVIDENCE`, same testcase counts as 0.42.0):

| Case | 0.42.0 | 0.44.0 | Reason code | What changed |
|---|---|---|---|---|
| 20 AC-20 | needs-human `NO_PLAN_ENTRY` | **needs-human `PARTIAL_REMAINDER`** | `PARTIAL_REMAINDER` | Seeded through a confirmed, capturing declaration. Four objective steps ran under the role session: `goto /`, then `expect_visible` on `heading "Concluídas"`, `region "Não concluídas"` and `heading "Não concluídas"`, all `passed`, all grounded with `matches: 1`. The remainder is human (see "What stayed human") |
| 21 AC-21 | needs-human `NO_PLAN_ENTRY` | needs-human `NO_PLAN_ENTRY` | `NO_PLAN_ENTRY` | Excluded: production deploy plus a physical device |
| 22 G-1 | needs-human `NO_PLAN_ENTRY` | needs-human `NO_PLAN_ENTRY` | `NO_PLAN_ENTRY` | Excluded: fault injection, and the report states no manual procedure |
| 23 G-2 | needs-human `NO_PLAN_ENTRY` | **pass** | — | The seed captured the id, and the id was used in the request path. Three read-only `SELECT`s verified that the row stayed `missed`, the series counts were unchanged and no successor was spawned. This closes PS5 for this case |

### What stayed human in case 20, and why

The `human_remainder` reason in the plan names each gap:

- **Step 3, "lists only completed Tasks":** an absence check. The vocabulary has no `expect_not_visible` or row-membership assertion.
- **Step 4, "collapsed by default" and "shows its count in the header":** there is no attribute assertion (`aria-expanded`). The header's accessible name embeds the live count (`"Não concluídas 1"` at plan time). The seed changes that count before the steps run, and the count would be an expectation taken from the snapshot, which the rules forbid (PS15).
- **Step 5, the expanded rows:** they exist only after a click, and grounding cannot see post-interaction elements.
- **Step 6, the search screen:** `/search` takes no query parameter, so results appear only after typing.
- **Steps 7–8:** subjective (pt-BR reading, UI/UX checklist).

So the objective half named by the brief (steps 3–6) ran only as far as the vocabulary reaches: the presence of both groups on *Hoje*. PS16 lists what would carry it further. No objective step failed, so `fail` did not apply.

## Every `pass` read against its evidence (zero false pass)

**Case 23 (driver `pass`):**

- **Step 1 (`request`).** `case-23.http.json` shows `POST /api/tasks/81804e43-…/complete` → **404**, body `{"error":"No open Task with that id"}`. The body's substring `open Task` is the report's own wording ("the body names no open Task").
  - A 404 with that body is produced only after the bearer middleware: without a token the server answers 401. So the request was authenticated.
  - The evidence carries no `Authorization` header.
- **Steps 2–4 (`query`).** `case-23.query-2.json`, `-3.json` and `-4.json` show the statements after substitution, each `row_count: 1`:
  - series `98ecc9d6-…` has `done_count = 0 AND missed_count = 1`, equal to the captured seed values;
  - the series holds `count(*) = 2` rows, equal to the captured `task_count`, so no successor was spawned;
  - task `81804e43-…` is still `missed` with `completed_at IS NULL`, so it was not resurrected.
  - Each file records `read_only_control: "none (lexical guard and --local only)"`.
- **The request hit a real row.** The id in the request path is the same id that query 4 found `missed` in D1, and the diagnostic in step 6 of "What was done" proved that the preview reads that same database. The 404 is therefore not an artefact of a different or empty database.
- **Independent cross-check after the run.** The agent ran its own query over every `QA missed-sweep%` series: all three (`737c189d` smoke, `5f55351f` case 20, `98ecc9d6` case 23) show `done 0 / missed 1 / 2 rows (missed,open)`.

**Cases 1–19 (`pass / AUTOMATED_EVIDENCE`).** These are unchanged from 0.42.0 and were already read against `evidence/case-<n>.record.json` there. They are not driver-executed and are not counted in the rate.

**Case 20** is not a pass. Its four objective steps passed, and its evidence is read here for honesty:

- `case-20.png` shows the authenticated *Hoje* screen. It proves the kit session was placed in IndexedDB: the token gate is absent, and the seeded open successors `QA missed-sweep 5f55351f` and `737c189d` are listed under *Hoje*.
- The *Não concluídas* group itself is below the fold and is **not in the PNG** (PS17). Playwright's `visible` does not require the viewport.
- **Negative control:** the same origin opened in a fresh browser tab with no session renders the token gate ("Cole o token da API deste dispositivo."). So the browser steps are not vacuous on this target, unlike `vite dev` (PS1).

## Counters

- `counts`: `{ "pass": 20, "fail": 0, "blocked": 0, "needs-human": 3 }` (four-outcome partition, 23 cases in, 23 out).
- `record_resolved`: 19 (all `pass`).
- Driver-executed: 1 (case 23) = `pass` 20 − `record_resolved` 19.
- `partially_executed`: 1 (case 20).
- `aborted`: null; `warnings`: [].

## Open Question 1, resolved empirically

Run on local D1 (wrangler 4.118.0, `wrangler d1 execute praesto-db --local --json --command …`):

1. **`PRAGMA query_only` is refused.** Each of the following returns `{"error":{"text":"not authorized: SQLITE_AUTH"}}` with exit 1:
   - `PRAGMA query_only = 1; UPDATE tasks SET title = title WHERE 0`;
   - the bare read `PRAGMA query_only`.

   D1's authorizer blocks the pragma. There is **no engine-level read-only control through `wrangler d1`**. A `wrangler-d1` source relies on the lexical statement guard plus the `--local` requirement, which is what 0.44.0 records in every query evidence file (`read_only_control: "none (lexical guard and --local only)"`). An engine control would need the local SQLite file declared as a `sqlite3 -readonly` source.
2. **Exact `--json` output shape:**
   - **Success:** a JSON array with one element per statement, each `{ "results": [ {<column>: <value>, …} ], "success": true, "meta": { "duration": <ms> } }`. A two-statement `--command` yields a two-element array. Exit code 0.
   - **Failure:** a single JSON **object** `{ "error": { "text": "<message>: SQLITE_<CODE>" } }`, on **stdout** (0 bytes on stderr), preceded by a blank line, exit 1 (for example `no such table: nope: SQLITE_ERROR`).
   - `qa-query.mjs` `parseQueryOutput` reads `doc[0].results` for the success shape and treats anything else as unparseable. That matches the success shape. A failure reaches the runner as a non-zero exit (`QUERY_FAILED`), so the error object is never mistaken for rows.

## Open Question 2, observed (not this phase's question, but it bit here)

Accessibility snapshots **do** carry personal data, and the redaction table did not catch it: `withheld=0`. The snapshot stores the owner's local task titles as locator names, for example `"Reabrir Pagar o condomínio"` and `"Responder o e-mail do contador"`. The `case-20.png` screenshot shows the same kind of titles. Both live under `PRPs/reports/missed-sweep/qa-run/<run>/`, which is **untracked but not ignored**, so a careless `git add PRPs/reports` would commit them. The 0.42.0 run kept screenshots outside the repository for this reason. Free-text titles cannot be enumerated by a `regex:` line in `PRPs/redaction-extensions.txt` (PS14).

## Secrecy (AC-16)

- **Method.** The token value was read from the ignored kit artifact (`PRPs/auth/.sessions/owner.token.json`) and searched byte for byte by a script that prints counts and paths only. The positive control, `.dev.vars` (ignored), contains it, which proves that the scanner finds the value.
- **Tracked and unignored files** (`git ls-files -co --exclude-standard`): **0 hits** in 910 files.
- **Every file under `PRPs/reports/`, ignored ones included:** **0 hits** in 424 files, including all 27 files of the counted run (plan, results, evidence, grounding snapshot, screenshot).
- **Values marked `redact`:** none declared. No capture is secret, and the ids are random UUIDs.
- **Ignore rules.** `git check-ignore` proves `PRPs/auth/.sessions/owner.json` and `owner.token.json` ignored (`PRPs/auth/.gitignore:27`), and `.dev.vars` ignored (`.gitignore:17`).
- **Declarations only.** `qa-seed.json` holds declarations only (argv, store, capture paths). No captured value was written back to it.
- **The conversation.** The token never entered it. The operator ran the login script at their own terminal.

## AC-15

This half only touches the byte-identity of the report, which holds: the report is byte-identical, and `OUTCOMES` in results is still the four values. The relay-file identity checks (`code-reviewer*.md`, `relay-implement.md`, `capture.mjs`) belong to the relay repository's diff and are not observable from here.

## Files this session changed in praesto-sum (none committed)

- `scripts/qa/seed-missed-occurrence.mjs`: new project seed script, agreed with the operator. Untracked.
- `PRPs/auth/qa-seed.json`: new. 14 proposed entries, 2 of them confirmed by the operator, plus `query_sources`.
- `PRPs/auth/login-owner.mjs`: regenerated by `--refresh`. The 0.42.0 copy is kept outside the repository.
- `PRPs/auth/login.config.json`: `authenticatesAnonymous: null` added.
- `PRPs/auth/.sessions/owner*.json`: new session, created by the operator. Ignored.
- `PRPs/reports/missed-sweep/qa-seed-proposals.json`, the two `qa-run/` directories and this report.
- **Local D1:** three QA series (`QA missed-sweep <id>`), each with one `missed` and one `open` row. The owner's own rows are untouched.

## New relay findings (for `C:\repos\PRPs-agentic-eng`)

Numbered from PS10 to continue the 0.42.0 series.

| # | Severity | Finding | Evidence | Suggestion |
|---|----------|---------|----------|------------|
| PS10 | Medium | **`target_root` = cwd does not survive a worktree session.** Claude Code ran this session in `.claude/worktrees/<name>`, but the kit (`PRPs/auth/`, untracked), the baseline runs and the migrated local D1 exist only in the main checkout. The commands say "record `target_root` as the current working directory" and "use the `Write` tool". The harness refuses `Write` outside the worktree. Every write had to go through the scratchpad and `cp`, after an explicit operator authorization | `Write` refusal on `C:\repos\assistente-pessoal\PRPs\reports\missed-sweep\qa-seed-proposals.json`; worktree has no `PRPs/auth/` | Accept `--root <path>` on `/relay-qa-seed`, `/relay-qa-run` and `/relay-auth-scripts`, and derive `target_root` from a path argument's repository. Or detect a worktree whose main checkout holds `PRPs/auth/` and halt with a named code |
| PS11 | Medium | **The documented `ground --route "/"` line fails on Windows Git Bash.** MSYS path conversion rewrites `/` to `C:/Program Files/Git/`, and the script prints only its usage text (exit 2), naming nothing | `ground … --route "/"` → `Usage:` exit 2; the same line with `MSYS_NO_PATHCONV=1` → `GROUNDED` | Name the offending argument (`ROUTE_INVALID: got "C:/Program Files/Git/"`), detect that prefix, or document `MSYS_NO_PATHCONV=1` beside the literal line |
| PS12 | Medium | **Captured values substitute as strings only.** `substituteVariables` replaces `{{name}}` inside strings, so `expect_json: { equals: "{{missed_count}}" }` compares the string `"1"` with the row's number `1` and can never pass. `expect_rows` must be an integer at validation, so it cannot take a capture at all. "Unchanged since the seed" had to be pushed into the SQL (`… AND missed_count = {{missed_count}}` with `expect_rows: 1`) | `qa-run.mjs:1307–1319`; the case-23 plan | Let a step value that is exactly `"{{name}}"` take the captured scalar's own type. Or allow `expect_rows: "{{name}}"` when the capture is an integer |
| PS13 | Medium | **`store` cannot name a file-backed local store, so it is a self-attestation.** Local D1 (`.wrangler/state/v3/d1`) and SQLite files have no host. `normalizeStore` accepts a URL or `host[:port]`, so `store: "localhost"` passes the guard while saying nothing about where the seed writes. Here, locality was actually guaranteed by the seed script hard-coding `--local`, an argv the runner never sees | `qa-run.mjs:1326–1331`; the seed's inner `wrangler` call | Add a `store` form for local files (for example `file:.wrangler/state` resolved inside `target_root`), or let a declaration name an inner argv the guard checks (`--local` present, no `--remote`) |
| PS14 | High (privacy) | **Grounding snapshots and screenshots persist personal data in an unignored path.** OQ2 answered for this project: `withheld=0`, while the snapshot stores 54 locator names including the owner's task titles, and `case-20.png` shows them. `PRPs/reports/<feature>/qa-run/` is untracked but **not** ignored. Free-text titles cannot be listed as `regex:` lines | `grounding/owner--root.snapshot.json`; `git check-ignore` → not ignored | Have `init` write a `.gitignore` for `grounding/` and `evidence/*.png` inside each run directory (or prove them ignored the way `auth-kit-secrecy` does). Optionally store only the locator names used by the plan |
| PS15 | Medium | **Accessible names that embed live data cannot be grounded stably.** The group header is `button "Não concluídas 1"`. The seed adds a row between plan and run, so the exact-match locator matches 0 elements at run time, and the count would be a snapshot-derived expectation. The plan fell back to `heading`/`region` names without the count | `owner--root.snapshot.json` entries `"Não concluídas 1"`, `"Concluídas 9"`, `"Agenda 2"` | Allow a `name_prefix` (or a name with a declared variable part) that still requires exactly one match, keeping the count out of the expectation |
| PS16 | Medium | **The browser vocabulary cannot express half of a typical "group" check.** There is no absence assertion ("lists **only** completed Tasks"), no attribute or state assertion ("collapsed by default", `aria-expanded`, "disabled complete control"), and no grounding after an interaction (expanded rows, search results). These four gaps alone kept case 20's steps 3–6 from running beyond "both groups exist" | Case 20 `human_remainder` reason | `expect_not_visible`, `expect_state` (`expanded`, `disabled`, `checked`) on grounded locators, and a `ground` mode that replays a grounded prefix of steps (for example one `click`) before snapshotting |
| PS17 | Low | **Screenshot evidence is viewport-only.** The step's evidence PNG does not contain the element the step asserted (*Não concluídas* is below the fold), so a reader cannot see what passed | `evidence/case-20.png`, step 4 evidence | Scroll the last asserted locator into view before capture, or take `fullPage` |
| PS18 | Low | **`/relay-qa-seed` proposes entries for states the runner never needs.** 10 of the 14 proposed states belong to automated-coverage cases resolved from the Test Runner record (cases 1–19), and 2 belong to excluded cases. They land as `proposed` gaps the operator must read past | `qa-seed.json`: 14 entries, 2 used | Skip, or tag as `record-resolved`, the state of a case whose coverage is `automated` with a cited test path |
| PS19 | Low | **Seeds accumulate.** Each case with a declared state re-runs its seed, and nothing declares a teardown. Two runs plus a smoke test left three QA series in the owner's local D1 | the QA-series query in "Every pass read against its evidence" | An optional `teardown` argv per declaration, run after the case under the same guard, or document that seeds must be idempotent or self-labelled |
| PS20 | Low | **`--refresh` cannot repair PS3, so a static token re-login is due every 24 h.** The model says the token does not expire, and 0.44.0's generator would now write `maxAgeMinutes: null`. But `--refresh` never changes an existing key, so the 1440 typed by hand in 0.42.0 stays, and the saved session expired between dogfoods (`FAILED_CREDENTIALS_UNAVAILABLE`) | `/relay-auth-scripts` Phase A "no key that already exists … is ever changed"; `login.config.json` `maxAgeMinutes: 1440` | Let `--refresh` report keys whose current value differs from what the approved model now yields, without changing them |

**What 0.44.0 got right here:**
- AC-3, the capture → path → query chain: the id came only from the seed.
- AC-4, a partial plan that never passes.
- AC-6, per-step results.
- AC-7 to AC-9, literal keys, no invented command and a live `STATE_UNCONFIRMED`.
- AC-11, `--local` required and the read-only control stated honestly.
- AC-13, grounded role-and-name locators that matched at run time.
- `FAILED_KIT_SCRIPT_STALE`, which caught the 0.42.0 script exactly as documented.

**Still standing:**
- PS1 (avoided by choosing the preview target; the model still records no browser probe or alternative target).
- PS2.
- PS3 (see PS20).
- PS6.
- PS8 (`.sessions/` files are `-rw-r--r--` again).
- NF2: refresh now detects a stale script, but a hand-edited script with the right stamp would still pass.

## Phase-8 standing (praesto-sum half)

Case 23 is driver-executed and its `pass` holds against its evidence. Case 20 is `partially_executed` with a named remainder. Both reachable cases now carry a concrete reason instead of `NO_PLAN_ENTRY`, the report is byte-identical, and the token scan is 0. praesto-sum contributes **1 driver-executed case of its 2**. Whether the PRD's ≥ 9 of 14 is met depends on super-ensino's 12 cases (it needs ≥ 8 of them). PS14 should be fixed before any run directory is committed.
