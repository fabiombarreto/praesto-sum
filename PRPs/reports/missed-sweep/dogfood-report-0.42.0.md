# Dogfood report — manual-QA runner + auth kit on relay 0.42.0 (praesto-sum)

- **Relay PRD:** `C:\repos\PRPs-agentic-eng\PRPs\prds\manual-qa-runner-auth-kit.prd.md`, Phase 5 (praesto-sum half), re-run after Phases 6 and 7.
- **Relay version:** 0.42.0 (`~/.claude/plugins/cache/relay-marketplace/relay/0.42.0`, the session's installed version).
- **Date:** 2026-10-05 (UTC); started 2026-10-04 local.
- **Counted run:** `PRPs/reports/missed-sweep/qa-run/20261005T030413214Z`, the same `qa-report.md` as the first run (SHA-256 `c1808dd5…a92b6e`, byte-identical before and after both runs).
- **Baseline run:** `PRPs/reports/missed-sweep/qa-run/20261002T200103279Z` (relay 0.40.0).
- **Target:** `http://127.0.0.1:5173` (`vite dev`, `main` @ `61cf39e`, missed-sweep merged).

## Why this report and not adherence-mirror

`PRPs/reports/adherence-mirror/qa-run/` holds two runs from 2026-10-05 02:07 UTC
(`20261005T020651923Z`, `20261005T020728818Z`). They were **not a dogfood attempt**:
they are an ordinary `/relay-qa-run` at the close of the adherence-mirror feature,
with a one-case plan (case 13). The first returned `needs-human / PLAN_ENTRY_INVALID`
because the step was written in the nested shape `{ "request": { … } }`. The second used
the flat shape `{ "action": "request", … }` and returned `blocked / STATE_UNDECLARED`
because no `qa-seed.json` existed. The base URL was a worktree port (`:5176`), and no
auth kit generated through the commands existed at that time. The counted report stays
`missed-sweep`, so the result compares directly with the first run. The invalid plan
entry is recorded below as finding PS9.

## What was done

1. **Discarded the hand-written kit.** The whole `PRPs/auth/` tree from the first dogfood
   was moved to a backup outside the repository: the DRAFT `auth-model.md`, the
   hand-written `login-owner.mjs`, `login.config.json` and `.sessions/`. Nothing was deleted.
2. **`/relay-auth-setup --base-url http://127.0.0.1:5173`.** Results in order:
   - P1 guard: `LOCAL_TARGET_OK`.
   - P3: `IGNORE_PROVEN: 3 path(s)`.
   - P4: no model on disk, so Phase A ran. The writer produced a fresh DRAFT with
     `static-token`, the IndexedDB location `praesto` / `token` / `praesto.token`, the
     env-var name `API_BEARER_TOKEN` and the probe `GET /api/health`.
   - The reviewer (main mode) passed R-AM1–R-AM7. The operator replied "sim" and the
     model was flipped to `APPROVED`, with `auth-model-review.jsonl` recording a
     `final_flip`. **AC-9 was respected this time.**
3. **`/relay-auth-scripts`.** P2, P3 and P4 passed. It generated `login-owner.mjs`
   (byte-identical to the template after the single role substitution),
   `login.config.json` (mechanism `static-token`) and `credentials.example.json`. One
   field came out as `TBD - needs validation`: `maxAgeMinutes` (PS3). After observing the
   halt, the operator approved setting `1440` by hand.
4. **An out-of-band edit, reverted.** During the run the operator added an `envFile`
   token source to the generated script and created `qa-seed.json` and `seeds/`. All
   three were moved to the backup and the script was regenerated from the template, so
   the proof below ran on the unmodified 0.42.0 template. The counted qa-run (03:04:13Z)
   predates these edits (03:05–03:08Z).
5. **`/relay-test C:/repos/assistente-pessoal --feature missed-sweep`.** The operator
   created `.claude/settings.json`, whose creation by the agent was blocked (PS7). The run
   was GREEN in one attempt: 1174/1174 tests in 72 files, run id
   `95bd79d6-7965-4731-8970-3a3530ecfc7f`. The schema-v1 record is at
   `attempts/1/record.json`, with the JUnit at `attempts/1/junit.xml` (absolute path).
   The hand-written, tracked `run.json` was replaced by the run-level shape; its prior
   content is kept outside the repository, and `git checkout` restores it.
6. **`/relay-qa-run missed-sweep`.** The plan was written from the 23 parsed cases.
   Cases 20–23 were all omitted under the honesty rules, as detailed under Residue.

## Phase-5 success signal (praesto-sum)

| Item | Target | Result | Met? | Evidence |
|------|--------|--------|------|----------|
| Driver-executed outcomes among cases that need execution | ≥ 60% | **0 of 4 (0%)** | **No** | `results.json`: cases 20–23 `needs-human / NO_PLAN_ENTRY`; `counts.pass` 19 = `record_resolved` 19 |
| Cases with no outcome | 0 | 0 (23 in, 23 out) | Yes | `results.json` `cases.length` = 23 |
| Credential values in tracked files or reports | 0 | 0 | Yes | The token value from the ignored artifact was scanned byte-for-byte: 0 hits in 858 tracked and unignored files, 0 hits in 374 files under `PRPs/reports/` (ignored ones included). `git check-ignore` proves both `.sessions/owner*.json` ignored |
| No case blocked for lack of a login | 0 | 0 blocked | Yes, vacuously | No planned case needed a session. The session is proven independently below |
| Residue among cases that need execution (`needs-human` + `blocked`) | ≤ 40% | 4 of 4 (100%) | No | Complement of the first row |
| Cases resolved from the Test Runner's record (AC-17) | reported | **19** (19 pass, 0 fail) | — | `results.json` `record_resolved: 19` |
| Runner wall time | recorded | 490 ms | — | `duration_ms` |

**Verdict:** praesto-sum does **not** meet the phase-5 success signal. With 0.42.0 it
fails differently: before, 23 cases ended with no plan entry and nothing ran; now the
whole automated-coverage block resolves from real evidence, and the residue is four
cases that no current driver can reach.

## Outcomes against the first run

| | 0.40.0 run `20261002T200103279Z` | 0.42.0 run `20261005T030413214Z` |
|---|---|---|
| Report SHA-256 | `c1808dd5…` | `c1808dd5…` (same) |
| Test Runner record | none at a discovered path (hand-written records outside schema v1, under `phase-N/`) | schema-v1 `attempts/1/record.json`, JUnit artifact |
| Auth kit | hand-written, model DRAFT, AC-9 bypassed | generated by the commands, model APPROVED |
| pass / fail / blocked / needs-human | 0 / 0 / 0 / 23 | 19 / 0 / 0 / 4 |
| `AUTOMATED_EVIDENCE` (`record_resolved`) | 0 (field absent) | 19 |
| Driver-executed | 0 | 0 |
| Residue | 23 × `NO_PLAN_ENTRY` | 4 × `NO_PLAN_ENTRY` |
| Duration | 2 ms | 490 ms |

Per-case outcomes in the counted run:

| Cases | Outcome | Reason code | Detail |
|---|---|---|---|
| 1–3, 5–9 | pass | `AUTOMATED_EVIDENCE` | 18 testcases in `test/missed-sweep.test.ts`, none failed |
| 4 | pass | `AUTOMATED_EVIDENCE` | 31 testcases in 2 files |
| 10–18 | pass | `AUTOMATED_EVIDENCE` | 13 testcases in `test/missed-sweep-cron.test.ts` |
| 19 | pass | `AUTOMATED_EVIDENCE` | 44 testcases in 2 files |
| 20 | needs-human | `NO_PLAN_ENTRY` | Steps 7–8 are subjective (pt-BR check, UI checklist). "Collapsed by default" and "disabled control" name no selector. The state is a `missed` row in D1 |
| 21 | needs-human | `NO_PLAN_ENTRY` | Production deploy plus physical device |
| 22 | needs-human | `NO_PLAN_ENTRY` | The report says no manual procedure exists (fault injection) |
| 23 | needs-human | `NO_PLAN_ENTRY` | Needs `wrangler d1` (CLI) to create the state, a DB query to verify, and a row id the steps do not state |

### Residue: why each case is out of reach

- **No driver can take them:** case 21 needs a device and production, and case 22 needs
  fault injection. Neither is an auth problem.
- **The state vocabulary is too thin:** case 23 needs a `missed` row whose id is then
  used in the request path. `qa-seed.json` maps one required-state text to one argv and
  captures nothing, and the plan vocabulary has no variables, so the id could only be
  invented. The honesty rules forbid that (PS5).
- **Subjective judgment mixed in:** case 20 bundles objective checks (steps 3–6) with
  subjective ones (7–8). The runner plans whole cases only, so it cannot run the
  objective half (PS5).

## Did AC-17, AC-18 and AC-19 behave as specified on a real project?

### AC-17 — mostly yes, with one coarse edge

- **Held:**
  - Discovery found the feature-level `attempts/1/record.json`.
  - The schema-v1 check passed.
  - Each case was decided from the JUnit testcases of its cited files: 19 pass, no
    driver ran.
  - Evidence names the record, run id, attempt, `generated_at` and the artifact with its
    mtime (`evidence/case-<n>.record.json`).
  - `counts` keeps the four-outcome partition, with `record_resolved` reported beside it.
- **Not exercised here:** the refusal of a hand-written record. This repo's hand-written
  records sit under `phase-N/`, outside the discovery rule, so the first run never
  reached them — they were not *refused*, just not found.
- **Coarse:** resolution is per cited **file**, not per cited `describe` (PS4).

### AC-18 — yes

- No login request was made. The script proved the token against `GET /api/health`:
  2xx with it, 401 without it, and the server answered 401 to no token and to a wrong
  token.
- It then wrote the token artifact (`header`, `value_prefix`, no value printed) and a
  storage-state carrying the token at the declared IndexedDB location.
- `SESSION_CREATED` came from the operator's terminal. `SESSION_REUSED` then ran with
  no token in the environment, exit 0, and left the session file hash unchanged.
- `FAILED_TOKEN_UNPROVEN` did not fire for the real token. Its positive firing was not
  exercised, because the endpoint never answers 2xx without a token.
- Negative paths observed live:
  - `FAILED_LOGIN_CONFIG_INCOMPLETE: roles.owner.maxAgeMinutes`
  - `FAILED_CREDENTIALS_UNAVAILABLE` (no token, no terminal)
  - `FAILED_LOGIN_REJECTED` (wrong token)
- None of them wrote a session.

### AC-19 — yes, but only provable off the dev server

- **Structure:** `owner.json` has 0 cookies and one origin `http://127.0.0.1:5173`
  carrying IndexedDB `praesto` v1, store `token`, 1 record keyed `praesto.token`.
- **Behavior on `vite dev`:** the check is vacuous. The app seeds the token from
  `.dev.vars` in development (`src/app/main.tsx:31`), so a fresh context *without* a
  session also renders *Hoje* (`today_marker_visible=true` both ways). The writer
  flagged this statically, and the model records it under Open Questions (PS1).
- **Behavior on a production build** (`npm run build` + `vite preview` on the same
  origin `127.0.0.1:5173`, diagnostic, not counted):
  - Without the session the token gate rendered, and the *Hoje* marker was absent.
  - With the kit storage-state, *Hoje* rendered and the gate was absent.
  - The unchanged `capture.mjs` (0.42.0 cache copy), fed a two-row manifest
    (`auth_mode: none` and `storage-state:PRPs/auth/.sessions/owner.json`), rendered the
    token gate and the authenticated *Hoje* screen respectively.
  - The screenshots are kept outside the repository because they show the owner's tasks.

## Secrecy

- Nothing in `PRPs/auth/` is committed. The tree is untracked (`?? PRPs/auth/`), and
  `.sessions/` is ignored (`!! PRPs/auth/.sessions/`).
- The kit says the tracked side is `auth-model.md`, `auth-model-review.jsonl`,
  `login-*.mjs`, `login.config.json`, `credentials.example.json` and `.gitignore`.
  Committing them is the owner's decision.
- Token-value scan: 0 hits (see the table).

## New kit findings (for `C:\repos\PRPs-agentic-eng`)

Numbered PS*, so they do not collide with super-ensino's NF1–NF9.

| # | Severity | Finding | Evidence | Suggestion |
|---|----------|---------|----------|------------|
| PS1 | High | **A dev server that injects the credential makes every browser proof vacuous, and the kit cannot tell.** Under `vite dev` the app seeds its token from `.dev.vars`, so a context without a session is authenticated too. A browser probe would halt `FAILED_PROBE_NOT_PROTECTED`, which is honest. But a browser *case* run by `/relay-qa-run` on that origin would `pass` whether or not the kit session worked, and AC-19 is unobservable there. Only a production build on the same origin separated the two states | `src/app/main.tsx:14–31`; diagnostic `today_marker_visible=true` with and without session on `:5173` dev; `false`/`true` on the production preview | Let the model declare a negative-control target (e.g. a build/preview command on the same origin), or have `/relay-qa-run` refuse browser cases for a static-token role whose model records dev-time credential injection |
| PS2 | Medium | **`FAILED_LOGIN_REJECTED` conflates distinct failures for `static-token`:** a non-2xx answer to the token, an exception in the request context, and a browser-placement exception all print the same line with no status. The operator spent a round finding out that the token in their shell differed from the server's | `proveStaticToken` returns `'rejected'` for both `withToken` non-2xx and `catch`; the same line comes from `placeStaticToken`'s `catch` | A distinct `FAILED_TOKEN_REJECTED (status <n>)`, never echoing the token, and a separate code for transport errors |
| PS3 | Medium | **A never-expiring static token cannot be expressed.** `maxAgeMinutes` must be > 0. The model says "no expiry", so the generator correctly wrote `TBD`, the script halted `FAILED_LOGIN_CONFIG_INCOMPLETE`, and the owner had to pick an arbitrary 1440 by hand | `incompleteField` in `auth-login.template.mjs`; config edit approved by the operator | Allow `maxAgeMinutes: null` for `static-token`, meaning "re-prove on every reuse", which reuse already does |
| PS4 | Medium | **AC-17 resolves per cited file, not per cited test.** Cases 10–18 cite nine different `describe` blocks of `test/missed-sweep-cron.test.ts`, and all resolve from the same 13 testcases. A failure in one block fails all nine cases. A cited block that was renamed or deleted still passes as long as the file exists | `evidence/case-10.record.json` … `case-18.record.json` all list 13 testcases | Match the cited `describe`/test title against JUnit `classname`/`name` when the report gives one, falling back to file level with a recorded `granularity: file` |
| PS5 | High (for the metric) | **The ≥60% target is unreachable for this report with the current vocabulary.** Every case that needs execution needs either a captured value (an id produced by a seed), a CLI or DB read, or a partial plan for a mixed objective/subjective case. `qa-seed.json` maps state text to one argv with no captured outputs, and the plan vocabulary has no variables | Cases 20 and 23; the `qa-seed.json` handling in `qa-run.mjs` (`STATE_UNDECLARED`, one argv per state) | Seed commands that emit JSON captured into named variables usable in `path`; the read-only DB driver (the PRD's "Should"); partial case plans with an explicit `needs-human` remainder |
| PS6 | Medium | **The commands cannot displace an existing hand-made kit.** `/relay-auth-setup` P4 skips the writer whenever any DRAFT exists, so a stale or hand-written DRAFT goes straight to review. `/relay-auth-scripts` never overwrites an existing role entry or script. Getting to a command-generated kit required moving `PRPs/auth/` aside by hand. This is related to NF1 and NF2 but distinct, because it applies to DRAFT and pre-existing artifacts too | `relay-auth-setup.md` P4; `relay-auth-scripts.md` "never overwritten" | A `--fresh` that archives the existing kit, or a P4 branch that offers to re-run the writer on a DRAFT |
| PS7 | Low | **`/relay-test` needs `.claude/settings.json`, which the agent may be unable to create.** The auto-mode classifier blocked the write as self-modification even with the owner's "yes". The owner wrote it by hand. No relay command provisions it outside `context-builder` | `/relay-test` precondition 2; classifier denial in this session | Document a hand-created minimal file, or let `/relay-test` run with a degraded-permissions warning when interactive |
| PS8 | Low | **Session artifacts are not owner-only on Windows.** The template writes mode `0o600`, but NTFS reports `-rw-r--r--`. The files are ignored and local, so the exposure is limited | `ls -la PRPs/auth/.sessions` | Note it in the redaction policy, or apply an ACL on win32 |
| PS9 | Low | **The plan vocabulary in `/relay-qa-run`'s doc reads as nested and misled a real plan.** `request {method, path, …}` was written as `{ "request": { … } }` and rejected (`PLAN_ENTRY_INVALID: unknown http action`). The runner needs `{ "action": "request", … }` | adherence-mirror run `20261005T020651923Z` vs `20261005T020728818Z` | Show one literal step object in the command doc |

**Still standing:**
- NF2 (scripts never refreshed). In this run the generated script was overwritten by
  hand, and the kit had no way to notice. A content hash recorded at generation time
  would catch it.
- F10 did **not** reproduce: Playwright 1.63.0 resolved under the cached
  `scripts/visual/` without an install.

## Phase-5 standing

The PRD's Phase 5 stays `pending` for praesto-sum. AC-9, AC-17, AC-18 and AC-19 now hold
on this project, with the AC-19 caveat in PS1. The ≥60% driver-executed criterion is not
met (0 of 4), and PS5 explains why no session or auth fix can change that for this report.
