# Feature: The unattended copy (Phase 4 of data-export)

```
**Decision Gate**
- Active context: none
- Activated criteria: new script under `scripts/` making outbound authenticated HTTP calls to the deployed Worker; local credential storage on the owner's own Windows PC; machine configuration (a Windows Scheduled Task) — past relay's Pillar 2 execution boundary, so registration is reserved for the owner; an automated recurring job outside relay's own retry loop
- Decisions found:
  - ADR-0003 — binding safeguard "automated local snapshots; Cloudflare never holds the only copy (FR-043)". This phase is that clause, arriving last and deliberately (phase 4 of 4).
  - ADR-0005 — exact version pins; `engines.node >= 24.0.0` is already the pinned floor this phase's script relies on for built-in TypeScript type-stripping and global `fetch`.
  - ADR-0008 — test-first for decidable parts. This phase's Architecture Notes call the script "neither" decidable-shared-module nor pure UI glue and say it is "verified by running it and by AC-10/AC-11 against a real failure" — but per this plan's own dispatch brief, because the script is Node (not PowerShell), its decidable parts (filename derivation, the write/skip/fail decision) ARE extracted to `src/shared/` and go through the normal test-first pipeline like everything else in this unit; only the fs/network glue stays manually/Level-3-verified.
  - `docs/decisions.md` 2026-08-12 correction — FR-043 is scheduled in this unit, not left unscheduled; this phase discharges it.
  - Chore C10 (2026-08-12, API token exposed via a screenshot) — the standing evidence this phase's token-storage decision (`## Notes`) is weighed against.
- Applicable anti-patterns:
  - **Syncing the live database file** (`docs/anti-patterns.md:19-25`) — this script IS the sanctioned alternative: a scheduled job pulling from the authenticated export route, never a raw D1/file copy. Explicitly named in the anti-pattern's own "what to do instead".
  - **Offline write queue** (`docs/anti-patterns.md:12-17`) — not applicable; this script only pulls, it writes nothing back to Praesto.
  - **Portuguese in artifacts** (`docs/anti-patterns.md:105-112`) — the script, its module and the runbook stay English; there is no owner-facing UI copy in this phase for ADR-0009's carve-out to apply to.
- Applicable architectural rules:
  - `app.use("/api/*", requireToken)` (`src/worker/index.ts:16-38`, `src/worker/auth.ts:11-26`) — the script is only ever an authenticated HTTP client of the two existing routes; it adds no server-side code and touches D1 through no path but those routes.
  - `src/shared/` carries no DOM/Worker globals and reads no clock (`docs/context/architecture.md`) — the new pure decision module follows the same discipline, composing with `src/shared/content-disposition.ts` rather than duplicating it (`docs/anti-patterns.md:91-97`, hand-duplicated logic).
  - Free plan cost ceiling — irrelevant to a client-side script, but the script adds no more than two `GET` requests per scheduled run, well inside anything phase 1 measured.
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/data-export.prd.md` — Implementation Phases row 4: "The unattended copy" — Goal: The safeguard stops depending on the owner remembering it. — Success signal: AC-10 and AC-11 pass, and two consecutive weekly snapshots exist on the owner's PC that nobody triggered by hand.

## Summary

This phase adds `scripts/pull-export-snapshot.mjs`, a headless Node script that pulls both `GET /api/export` and `GET /api/export.ics` from the deployed Worker with a bearer token read from a restricted-ACL file outside the git repo, and writes dated snapshot files to a directory on the owner's PC — writing nothing and exiting non-zero on any failure (AC-10), and never overwriting a file already present from the same day (AC-11). The script's decidable parts — deriving each file's dated name from the response's `Content-Disposition` header (reusing, not duplicating, `src/shared/content-disposition.ts`) and deciding write-vs-skip-vs-fail — are extracted into a new pure module, `src/shared/snapshot-outcome.ts`, authored test-first. A documented, copy-pasteable runbook records the token-storage decision (a plain file under an ACL-restricted directory, chosen over Windows Credential Manager and Task Scheduler's own environment-variable mechanism, both weighed and rejected with reasons) and the exact `schtasks` registration command — which the OWNER runs on his own PC, never the autonomous Implementer. This phase discharges FR-043 and absorbs chore C5.

## User Story

```
As the owner
I want a script that pulls a complete snapshot of my data to my own PC every week, without me remembering to run it, and that fails loudly rather than silently if it ever breaks
So that Cloudflare stops being the single place my data can be lost, and a broken backup never masquerades as a working one
```

## Problem Statement

Phases 1-3 made the export reachable by hand — a tap on `/settings` or a `curl` with a bearer token. Nothing pulls it automatically. ADR-0003's second binding safeguard, "automated local snapshots", is unmet until a script exists that a Windows Scheduled Task can run unattended, and until that script is trustworthy enough that its silence can be read as "it worked" rather than "it might have quietly stopped working three weeks ago." The token the script needs is the production Cloudflare Worker secret — the same class of credential that already leaked once, through an ordinary screenshot (chore C10, 2026-08-12) — so where it lives on the owner's PC is not a detail to leave to whoever writes the script first.

## Solution Statement

`scripts/pull-export-snapshot.mjs` reads a bearer token from a file outside the git repo (`%USERPROFILE%\.praesto\export-token.txt` by default, restricted via `icacls` to the owner's Windows account only), fetches both export routes with `Authorization: Bearer <token>`, and hands the two raw responses to a new pure function, `deriveSnapshotDecision`, in `src/shared/snapshot-outcome.ts`. That function — and its sibling `shouldWriteFile` — never touch the network or the filesystem; they take already-fetched outcomes and already-listed directory contents as plain data and return a decision, so both are testable with fabricated inputs and go through the test-first pipeline like the rest of this unit's decidable code. The script itself only performs I/O: read the token, fetch, ask the pure functions what to do, then write or skip or fail accordingly, exiting non-zero and writing nothing when either fetch is not `ok`. A second fixture script, `scripts/mock-export-server.mjs`, stands in for the deployed Worker during Level 3 validation, so the real script can be exercised end-to-end — including its bad-token failure path — without ever making a live call to production. A new runbook, `documentation/40-engineering/snapshot-task-runbook.md`, records the token-storage decision with its reasoning and the exact `schtasks` command; running that command is reserved for the owner, exactly as machine configuration always has been in this project.

## Metadata

| Key | Value |
|-----|-------|
| Type | Feature |
| Complexity | Medium |
| Systems Affected | `scripts/` (new script + local-only fixture), `src/shared/` (new pure decision module, composing with the existing `content-disposition.ts`), `documentation/40-engineering/` (new runbook) — no Worker route change, no schema change, no `vitest.config.ts` change |
| Dependencies | Phase 2 (`.ics` route) per row 4's `Depends` cell — phase 3 (the button) is not a dependency; the script is headless and the PRD's own Phase Details note this explicitly |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/data-export.prd.md` lines 173, 196-199 |
| phase_type | feature |

`phase_type: feature`, not `scaffold`: this phase writes real application logic (a decision module with behavior AC-10/AC-11 depend on), not config-only setup, and its VALIDATE commands run the test framework and the script itself, not filesystem probes alone.

`design_source` and `phase_scope` are both omitted: `docs/context/methodology.md` declares `figma_track: false`, and the source PRD carries no `## Visual-First Mode` section — neither conditional key applies.

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `src/shared/content-disposition.ts` | 43-90 | `parseFilenameFromContentDisposition` and `exportFilename` — the exact functions Task 1's `deriveSnapshotDecision` must import and reuse, never re-implement |
| P0 | `src/worker/auth.ts` | 11-26 | The exact 401 (`{"error":"Unauthorized"}`) vs 500 (`{"error":"Server misconfigured..."}`) responses the script's fetch outcomes must be able to distinguish in its failure message |
| P0 | `scripts/check-dev-token-absent.mjs` | 1-90 | The one existing precedent for a `scripts/*.mjs` file's conventions: shebang, `node:fs`/`node:path` imports, `try`/`catch` guard around a missing input, `process.exit(1)` + `console.error` on failure, a PASS/FAIL `console.log` summary on success |
| P1 | `src/worker/routes/export.ts` | 1-64 | The exact dated-filename `Content-Disposition` shape (`praesto-<date>.json`) the script's JSON fetch will receive |
| P1 | `src/worker/routes/export-ics.ts` | 1-34 | Same, for the `.ics` fetch (`praesto-<date>.ics`) |
| P1 | `docs/anti-patterns.md` | 19-25 | "Syncing the live database file" — confirms this script's shape (authenticated route pull, never a raw D1/file copy) is the sanctioned alternative, not a new exception |
| P2 | `vitest.config.ts` | 60-71 | The `worker` project's wildcard `test/**/*.test.ts` include already picks up a new `test/snapshot-outcome.test.ts` with zero config change — confirmed so no task below touches this file |
| P2 | `package.json` | 5-7, 20-21 | `engines.node >= 24.0.0` (the floor this phase's script relies on for built-in TS type-stripping and global `fetch`) and the `"test": "vitest run"` script |

## Patterns to Mirror

```
# SOURCE: scripts/check-dev-token-absent.mjs:82-90,120-129
try {
  statSync(DIST);
} catch {
  console.error(`check-dev-token-absent: no ${DIST}/ to scan. ...`);
  process.exit(1);
}
...
if (offenders.length > 0) {
  console.error("check-dev-token-absent: FAIL — the dev token reached the build output.");
  ...
  process.exit(1);
}
...
console.log(`check-dev-token-absent: PASS — ...`);
```
Copied by Task 2's `pull-export-snapshot.mjs`: guard the missing/empty token with `try`/`catch` + `process.exit(1)` + a `FAIL —` prefixed `console.error`, and print a single `PASS —` prefixed `console.log` summary line only on full success — the same shape this repo's one existing network-free `scripts/*.mjs` guard already uses.

```
# SOURCE: src/shared/content-disposition.ts:43,87-90
export function parseFilenameFromContentDisposition(header: string | null): string | null { ... }

export function exportFilename(header: string | null, kind: "json" | "ics"): string {
  const parsed = parseFilenameFromContentDisposition(header);
  return parsed ?? `praesto-export.${kind}`;
}
```
Imported (not duplicated) by Task 1's `deriveSnapshotDecision`, which calls `exportFilename` on each response's `Content-Disposition` header to derive the two filenames it hands back in its `"write"` decision.

```
# SOURCE: src/worker/auth.ts:11-26
if (!expected) {
  return c.json({ error: "Server misconfigured: API_BEARER_TOKEN is not set" }, 500);
}
...
if (!presented || !timingSafeEqual(presented, expected)) {
  return c.json({ error: "Unauthorized" }, 401);
}
```
Referenced by Task 1's `deriveSnapshotDecision` and Task 2's error message: a `401` (bad/missing token) and a `500` (server misconfigured) are both failures the script must exit non-zero and write nothing for, but the script's `FAIL` message should name the actual status so the owner's log tells the two apart, since only one of them is caused by his own token file.

```
# SOURCE: src/worker/routes/export.ts:57-63
const filename = `praesto-${todayIn(now)}.json`;
return new Response(JSON.stringify(envelope), {
  headers: {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```
Copied by Task 3's `mock-export-server.mjs`, which fabricates the same `Content-Disposition: attachment; filename="praesto-<date>.<ext>"` shape (JSON and, per `export-ics.ts:27-31`, `.ics`) so Level 3 validation exercises the script against a realistic response shape without ever calling the real Worker.

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `src/shared/snapshot-outcome.ts` | CREATE | The decidable write/skip/fail decision — pure, DB-free, network-free — authored test-first, composing `content-disposition.ts`'s `exportFilename` rather than re-implementing it |
| `scripts/pull-export-snapshot.mjs` | CREATE | The headless script: reads the token file, fetches both export routes, calls the pure decision module, writes or skips or fails accordingly |
| `scripts/mock-export-server.mjs` | CREATE | Local-only fixture standing in for the deployed Worker during Level 3 validation — never deployed, never imported by production code |
| `tsconfig.base.json` | UPDATE | **Added 2026-09-07, after implementation.** `allowImportingTsExtensions: true`, so the script can import `src/shared/snapshot-outcome.ts` directly instead of duplicating it. Legal only because `noEmit: true` is already set here. Recorded in [tech-stack.md](../../documentation/40-engineering/tech-stack.md) as a stack quirk, per CLAUDE.md's rule that a non-obvious technical choice is documented in the same session |
| `documentation/40-engineering/snapshot-task-runbook.md` | CREATE | The token-storage decision with its reasoning, the token-file setup steps, and the exact `schtasks` registration command the owner runs himself |

## NOT Building (Scope Limits)

- **Registering the Windows Scheduled Task** — Task 5's `**ACTION**` is explicitly the owner's, not the autonomous Implementer's; no VALIDATE in this plan requires the task to have actually been registered on a real machine.
- **Any live network call to production** during validation — Level 3 uses `scripts/mock-export-server.mjs` instead.
- **Chore C6** (rebuild a throwaway D1 from a snapshot, compare row counts) — a separate chore that runs after the first real snapshot exists, per the PRD's own Scope note; not pulled into this plan.
- **Windows Credential Manager or DPAPI integration** — considered and rejected for this phase; the reasoning is recorded in `## Notes` and in the runbook itself, not silently skipped.

**Precedent this decision follows rather than sets (added 2026-09-07, after the plan review noted the omission).** `~/.praesto/` is already where this project keeps a live credential: chore C12 in [roadmap.md](../../documentation/50-planning/roadmap.md) records that the Google **refresh token** "lives in `~/.praesto/google-oauth.json`, outside the repo, and is also the Worker secret `GOOGLE_REFRESH_TOKEN`" — minted 2026-08-11 and still in use. So `export-token.txt` beside it is the project's established practice, not a new posture invented here, and the two credentials share one directory whose permissions can be reasoned about once. The plan reached this answer independently and the plan-reviewer flagged the missing citation as non-blocking; it is recorded now because a decision that looks novel invites re-litigation, while one visibly consistent with prior art does not.
- **Any change to `/api/export` or `/api/export.ics` themselves, or their headers** — phases 1-2 already shipped that; this phase only consumes it.
- **`npm run deploy` or any `wrangler deploy` without `--dry-run`** — no task below runs one.
- **Encryption of the snapshot files, import/restore, a second export format, filtering/paging** — already out of scope PRD-wide.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/snapshot-outcome.ts

- **ACTION**: Create a pure, environment-agnostic module (no `node:fs`, no `fetch`, no DOM/Worker globals — like every other module in `src/shared/`) exporting: (1) a type `FetchOutcome = { readonly ok: true; readonly status: number; readonly contentDispositionHeader: string | null; readonly body: string } | { readonly ok: false; readonly status: number }`; (2) `deriveSnapshotDecision(json: FetchOutcome, ics: FetchOutcome): SnapshotDecision`, where `SnapshotDecision = { readonly action: "write"; readonly json: { readonly filename: string; readonly body: string }; readonly ics: { readonly filename: string; readonly body: string } } | { readonly action: "fail"; readonly reason: string }` — returns `"fail"` with a reason naming each outcome's status (e.g. `"snapshot pull failed: json failed (status 401), ics ok"`) when either outcome's `ok` is `false`; otherwise returns `"write"`, deriving each filename by calling `exportFilename(outcome.contentDispositionHeader, "json" | "ics")` from `./content-disposition`; (3) `shouldWriteFile(existingFilenames: readonly string[], filename: string): boolean` — returns `false` when `filename` is already present in `existingFilenames` (the same-day non-overwrite rule: an existing dated file is left untouched, never overwritten), `true` otherwise. Import `exportFilename` from `./content-disposition` — do not re-implement any part of RFC 6266 parsing here.
- **MIRROR**: `# SOURCE: src/shared/content-disposition.ts:43,87-90` (import and reuse `exportFilename`, never duplicate) and `# SOURCE: src/worker/auth.ts:11-26` (the 401-vs-500 distinction the failure reason string names)
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/snapshot-outcome.test.ts
  ```

Serves **AC-A1 (PRD AC-10)** — `deriveSnapshotDecision`'s `"fail"` branch is the decision that a bad/missing token produces no write instruction at all — and **AC-A2 (PRD AC-11)** — `shouldWriteFile` is the exact non-overwrite rule AC-11 depends on, and `deriveSnapshotDecision`'s per-response filename derivation is what makes two different days' filenames differ.

### Task 2: CREATE scripts/pull-export-snapshot.mjs

- **ACTION**: Create a Node script (shebang `#!/usr/bin/env node`) that: reads three configuration values from environment variables, each with a default — `PRAESTO_EXPORT_BASE_URL` (default `"https://praesto.fabiobarreto.workers.dev"`), `PRAESTO_TOKEN_FILE` (default `path.join(os.homedir(), ".praesto", "export-token.txt")`), `PRAESTO_SNAPSHOT_DIR` (default `path.join(os.homedir(), "praesto-snapshots")`); reads the token file with `fs.readFileSync(...).trim()` inside a `try`/`catch` — on `ENOENT`, or on an empty trimmed result, prints `"pull-export-snapshot: FAIL — no usable token at <path>. Writing no file."` to `console.error` and calls `process.exit(1)` immediately, before any fetch; otherwise fetches `GET <baseUrl>/api/export` and `GET <baseUrl>/api/export.ics` in parallel with `Authorization: Bearer <token>`, each wrapped in its own `try`/`catch` so a network error becomes `{ ok: false, status: 0 }` rather than an uncaught rejection, and each success reads `response.headers.get("content-disposition")` plus `await response.text()` into a `FetchOutcome`; imports `deriveSnapshotDecision` and `shouldWriteFile` from `../src/shared/snapshot-outcome.ts` (a direct `.ts` import, relying on Node 24's built-in type-stripping for erasable-syntax TypeScript — both `snapshot-outcome.ts` and `content-disposition.ts` use only type annotations, no enums/namespaces/parameter properties) and `import { exportFilename } from "../src/shared/content-disposition.ts"` only if needed directly (the script itself never calls it — `deriveSnapshotDecision` does); calls `deriveSnapshotDecision(jsonOutcome, icsOutcome)`; on `"fail"`, prints `"pull-export-snapshot: FAIL — <reason>. Writing no file."` to `console.error` and calls `process.exit(1)` — no directory is created and no file is written on this path; on `"write"`, creates `PRAESTO_SNAPSHOT_DIR` with `fs.mkdirSync(dir, { recursive: true })` only now (never before a decision is known), lists its current contents with `fs.readdirSync`, and for each of the two `{ filename, body }` pairs calls `shouldWriteFile(existing, filename)` — if `true`, writes the file with `fs.writeFileSync(path, body, "utf8")` and logs `"pull-export-snapshot: wrote <filename>"`; if `false`, logs `"pull-export-snapshot: <filename> already exists, skipping (same-day rerun)"` and writes nothing for that one file; finally logs `"pull-export-snapshot: PASS"` and exits with the implicit `0`.
- **MIRROR**: `# SOURCE: scripts/check-dev-token-absent.mjs:82-90,120-129` (try/catch guard, `process.exit(1)` + `FAIL —` console.error, `PASS —` console.log summary) and `# SOURCE: src/worker/routes/export.ts:57-63` (the `Content-Disposition` shape the fetch responses carry)
- **VALIDATE**:
  ```
  set -euo pipefail
  node --check scripts/pull-export-snapshot.mjs
  npx eslint scripts/pull-export-snapshot.mjs
  ```

Serves **AC-A1 (PRD AC-10)** — the fail-branch's `process.exit(1)` before any directory is created or file written — and **AC-A2 (PRD AC-11)** — the write-vs-skip branch driven by `shouldWriteFile`, and the dated filenames each run derives independently from that run's own `Content-Disposition` response.

### Task 3: CREATE scripts/mock-export-server.mjs

- **ACTION**: Create a local-only Node HTTP server fixture (shebang `#!/usr/bin/env node`, a module doc comment stating it is never deployed and exists only for this plan's Level 3 validation) using `node:http`'s `createServer`. Reads `PRAESTO_MOCK_TOKEN` (default `"correct-token"`) and `PRAESTO_MOCK_PORT` (default `4173`) from the environment. On each request: if the `authorization` header does not equal `` `Bearer ${TOKEN}` ``, respond `401` with `Content-Type: application/json` and body `{"error":"Unauthorized"}` — matching `src/worker/auth.ts`'s exact 401 shape; otherwise respond `200`, with `Content-Type` `application/json` for a URL ending `/api/export` or `text/calendar; charset=utf-8` for one ending `/api/export.ics`, a `Content-Disposition: attachment; filename="praesto-<date>.<ext>"` header where `<date>` comes from `PRAESTO_MOCK_DATE` (default: real today's date, `YYYY-MM-DD`) — so a validation run can simulate two different days by setting this variable across two invocations — and a body of `"{}"` for JSON or `"BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"` for `.ics`. Logs `` `mock-export-server: listening on ${PORT}` `` once bound.
- **MIRROR**: `# SOURCE: src/worker/auth.ts:11-26` (the 401 JSON shape) and `# SOURCE: src/worker/routes/export.ts:57-63` plus `src/worker/routes/export-ics.ts:27-31` (the dated `Content-Disposition` shape for both extensions)
- **VALIDATE**:
  ```
  set -euo pipefail
  node --check scripts/mock-export-server.mjs
  npx eslint scripts/mock-export-server.mjs
  ```

Infrastructure task — no PRD AC of its own; it exists solely to make Level 3's end-to-end VALIDATE command below possible without a live call to production.

### Task 4: CREATE documentation/40-engineering/snapshot-task-runbook.md

- **ACTION**: Create a runbook (frontmatter matching the project's doc convention: `status: active`, `last_updated: <today>`, `review_trigger: "the token-storage decision changes, the schtasks command fails on the owner's machine, or the script's env-var contract changes"`) containing, in order: (1) **The token-storage decision**, stated and justified: a plain-text file at `%USERPROFILE%\.praesto\export-token.txt` (PowerShell: `$env:USERPROFILE\.praesto\export-token.txt`), outside the git repo and never `.dev.vars`, restricted via `icacls` to the owner's own Windows account — chosen over Windows Credential Manager (no reliable pure-JS/Node read path exists without a native module or an external interpreter, and the available community wrappers' maintenance status is unverified) and over a Task Scheduler-level environment variable (Task Scheduler has no native per-task environment-variable feature; any wrapper still embeds the value in the Action's argument string, which sits in a human-readable XML file under `%SystemRoot%\System32\Tasks` with no better protection than an ACL'd file, while adding a wrapper script to maintain). State explicitly that this choice does NOT defend against a local Administrator account or a screenshot — the exact channel chore C10 already leaked through once — only against other Windows accounts/processes on the same machine reading the file; (2) **Setup steps**, in PowerShell syntax: create the directory (`New-Item -ItemType Directory -Force "$env:USERPROFILE\.praesto"`), write the PRODUCTION Cloudflare Worker secret — not the local `.dev.vars` value — into the file (`Set-Content -Path "$env:USERPROFILE\.praesto\export-token.txt" -Value "<paste the production API_BEARER_TOKEN here>" -NoNewline`), then restrict it (`icacls "$env:USERPROFILE\.praesto\export-token.txt" /inheritance:r /grant:r "$($env:USERNAME):R"`); (3) **A manual test run** (`node scripts\pull-export-snapshot.mjs`), stating it should print a `PASS` line and create two dated files under `$env:USERPROFILE\praesto-snapshots\`; (4) **The Scheduled Task registration command**, exact and copy-pasteable: `schtasks /create /tn "Praesto Weekly Export Snapshot" /tr "node C:\repos\assistente-pessoal\scripts\pull-export-snapshot.mjs" /sc weekly /d SUN /st 09:00 /rl LIMITED`, with a note that this command is run by the OWNER, on his own PC, never by an autonomous agent — registering persistent Windows machine configuration is past relay's Pillar 2 execution boundary, exactly like the API token itself.
- **MIRROR**: `# SOURCE` — this repo's own doc-frontmatter convention, `documentation/40-engineering/dev-environment.md:1-12` (status/last_updated/review_trigger shape, PowerShell-first command style already used there for `npx wrangler`/`.dev.vars` setup steps)
- **VALIDATE**:
  ```
  set -euo pipefail
  grep -q "icacls" documentation/40-engineering/snapshot-task-runbook.md
  grep -q "schtasks /create" documentation/40-engineering/snapshot-task-runbook.md
  grep -q "export-token.txt" documentation/40-engineering/snapshot-task-runbook.md
  grep -qi "owner" documentation/40-engineering/snapshot-task-runbook.md
  ```

Infrastructure/documentation task — no PRD AC of its own; it is what turns the phase's "documented, copy-pasteable registration command" requirement (this plan's dispatch brief, constraint 2) into a real artifact, and what Task 5 points at.

### Task 5: RESERVE (owner action) — register the Windows Scheduled Task

- **ACTION**: This task is performed by the OWNER, not the autonomous Implementer, on his own Windows PC, at a time of his choosing after this phase's code has shipped and been deployed. He: (1) follows `documentation/40-engineering/snapshot-task-runbook.md`'s setup steps to create and restrict the token file with his real production `API_BEARER_TOKEN`; (2) runs a manual test invocation of `scripts/pull-export-snapshot.mjs` to confirm it prints `PASS` and produces two dated files; (3) runs the runbook's `schtasks /create` command to register the weekly task. No agent — including this plan's own Implementer — executes any of these three steps, makes a live network call to production, or registers persistent machine configuration. This task exists so the reservation is recorded explicitly in the plan, exactly as phase 3's device-verification task (`PRPs/plans/completed/data-export-phase-3-the-button.plan.md`, Task 9) reserved a human-only step rather than silently omitting it.
- **MIRROR**: `# SOURCE: PRPs/plans/completed/data-export-phase-3-the-button.plan.md` — Task 9's precedent for a plan task whose `**ACTION**` is explicitly human-performed
- **VALIDATE**:
  ```
  set -euo pipefail
  test -f documentation/40-engineering/snapshot-task-runbook.md
  grep -q "schtasks /create" documentation/40-engineering/snapshot-task-runbook.md
  grep -qi "owner" documentation/40-engineering/snapshot-task-runbook.md
  ```
  *(This VALIDATE checks only that the runbook the owner needs exists and documents the exact command — it cannot prove, and does not attempt to prove, that the owner has actually registered the task on his machine; that is the point of reserving this step for him rather than gating this plan's own completion on it.)*

Infrastructure task — no PRD AC of its own; the PRD's own Phase 4 Success signal ("two consecutive weekly snapshots exist... that nobody triggered by hand") is explicitly a time-based exit signal earned by waiting and verified by the owner later, not something any task here can produce (see `## Notes`).

## Validation Commands

**Level 1 STATIC_ANALYSIS**
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` — exits non-zero on any type, lint or format violation, including the two new `.mjs` files and the new TypeScript module.)

**Level 2 UNIT_TESTS**
```
npx vitest run test/snapshot-outcome.test.ts
```
(Exercises `deriveSnapshotDecision` and `shouldWriteFile` from Task 1 with fabricated `FetchOutcome`/existing-filename inputs — no real network or disk I/O — via Vitest's own exit code, which is non-zero on any failing assertion.)

**Level 3 DRY-RUN END-TO-END**
```
set -euo pipefail
TOKEN_FILE="$(mktemp)"
SNAPSHOT_DIR="$(mktemp -d)"
printf 'correct-token' > "$TOKEN_FILE"

node scripts/mock-export-server.mjs &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

export PRAESTO_EXPORT_BASE_URL="http://127.0.0.1:4173"
export PRAESTO_TOKEN_FILE="$TOKEN_FILE"
export PRAESTO_SNAPSHOT_DIR="$SNAPSHOT_DIR"

node scripts/pull-export-snapshot.mjs
COUNT=$(ls "$SNAPSHOT_DIR" | wc -l)
if [ "$COUNT" -ne 2 ]; then
  echo "FAIL: good-token run wrote $COUNT file(s), expected 2"; exit 1
fi

printf 'wrong-token' > "$TOKEN_FILE"
rm -f "$SNAPSHOT_DIR"/*
if node scripts/pull-export-snapshot.mjs; then
  echo "FAIL: script exited 0 on a bad token"; exit 1
fi
COUNT2=$(ls "$SNAPSHOT_DIR" | wc -l)
if [ "$COUNT2" -ne 0 ]; then
  echo "FAIL: bad-token run wrote $COUNT2 file(s), expected 0"; exit 1
fi
echo "PASS: good token wrote 2 files; bad token exited non-zero and wrote nothing"
```
(Runs entirely against the local `scripts/mock-export-server.mjs` fixture on `127.0.0.1:4173` — no live call to production, no deploy. Preconditions: run from the repo root, in a shell with `mktemp`/`trap` (git-bash/WSL, matching this plan's other `set -euo pipefail` blocks); port 4173 free. Every failure branch `exit 1`s explicitly; the final `echo` is reached only on full success, and the block's own exit code is Bash's default — 0 — at that point.)

## Acceptance Criteria

- **AC-A1 (PRD AC-10):** Given the snapshot script runs with a wrong or missing API token, when it completes, then it exits non-zero and writes no file — so a silently broken backup cannot masquerade as a working one by leaving yesterday's file in place.
- **AC-A2 (PRD AC-11):** Given the snapshot script runs on two different days, when the second run completes, then both files exist, each named by its own date; given it runs twice on the SAME day, the second run leaves the first run's files untouched rather than overwriting them.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `scripts/pull-export-snapshot.mjs` imports `.ts` modules directly (`../src/shared/snapshot-outcome.ts`), relying on Node 24's built-in type-stripping for erasable-syntax TypeScript, with no existing script in this repo doing so today | M | M | Both imported modules use only erasable syntax (function signatures, type aliases — no enums, namespaces or parameter properties), and Level 3's VALIDATE actually runs the script end-to-end; an import failure surfaces immediately and loudly (a non-zero exit on `node scripts/pull-export-snapshot.mjs`) rather than silently. Documented fallback if it ever proves unreliable: duplicate the minimal filename-derivation logic directly into the `.mjs` file, with a comment explaining the duplication is deliberate and why |
| The chosen token-storage decision (ACL'd plain file) does not defend against a local Administrator account or a screenshot — the exact channel chore C10 already leaked through once | L | M | Stated honestly in the runbook and in this plan rather than oversold; the threat model is other Windows accounts/processes on a single-user PC, not a determined local attacker or the owner's own screen. No stronger option (Credential Manager, DPAPI) had a reliable, dependency-free Node read path researched for this phase |
| The owner never runs Task 5, or runs it once and the Scheduled Task later stops firing silently (e.g. after a Windows update) | M | H | Outside this plan's reach by design — AC-10 makes a broken RUN loud, but nothing here can make a MISSING run loud; the PRD's own success signal is time-based and owner-verified (see `## Notes`), not a task this plan can produce |
| `schtasks /create`'s exact flags (`/rl LIMITED`, `/d SUN`) turn out to need adjustment on the owner's real machine | L | L | The runbook is a single file the owner (or a future plan) can amend in place; nothing else in this phase depends on the flags being exactly right on the first try |

## Notes

**Deviation from this plan's own Risk-table mitigation, recorded rather than absorbed (2026-09-07).** The Risks table anticipated that a live `.ts` import might fail under Node's ESM resolver and pre-authorised duplicating the minimal logic into the `.mjs` with an explanatory comment. It did fail, and attempt 1 applied exactly that fallback, correctly and with a clear comment. The outcome was then rejected — not the reasoning — because the duplication grew to six functions and left `test/snapshot-outcome.test.ts` (13 cases) and `test/content-disposition.test.ts` (27) exercising originals the weekly snapshot job never runs: forty tests guarding code that does not execute, with any future divergence silent. The root cause was fixed instead (`allowImportingTsExtensions` plus an explicit `.ts` extension on one import), the six copies deleted, and the script now imports the real modules. The first code review then failed R-SEM because `tsconfig.base.json` had no row above and `documentation/` had not been updated — both corrected here. Recorded because a reader comparing this plan's Risk table to the shipped script will otherwise see a mitigation that was authorised and then apparently ignored.

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands invoke the test framework's own runner (`npx vitest run test/snapshot-outcome.test.ts`) directly against the suite the test pair will have already written, rather than the Implementer authoring or editing any spec.

**Why this phase departs from the PRD's own Architecture Notes on TDD scope:** `PRPs/prds/data-export.prd.md`'s Architecture Notes says phase 4's script is "neither" decidable-nor-glue and is "verified by running it and by AC-10/AC-11 against a real failure" — written when the script's language was still open. This plan's dispatch brief settles that open question: the script is Node, not PowerShell, so its decidable parts (filename derivation, the write/skip/fail decision) ARE extracted and authored test-first like the rest of this unit; only the fs/network glue (`pull-export-snapshot.mjs` itself) stays outside the automated unit-test tier, verified instead by Level 3's mock-server dry run and, ultimately, by the owner's own manual test run in Task 5.

**No `vitest.config.ts` change:** `test/content-disposition.test.ts` and every other pure-`src/shared/`-module test already run under the `worker` project's wildcard `test/**/*.test.ts` include with no explicit per-file listing — confirmed at `vitest.config.ts:60-71`. `test/snapshot-outcome.test.ts` (the test pair's suite for Task 1) is picked up the same way; nothing in this plan touches `vitest.config.ts`.

**No config-file token, no live production call anywhere in this plan:** every VALIDATE command in this plan — per-task and Level 1-3 — runs against either static analysis, the pure unit-test suite, or the local `scripts/mock-export-server.mjs` fixture. Nothing here reads a real token file, calls the real deployed Worker, or performs a `wrangler deploy`.

**The phase's real success signal is time-based and out of this plan's reach, by design:** the PRD's Phase 4 Success signal is "two consecutive weekly snapshots exist on the owner's PC that nobody triggered by hand." No task in `## Step-by-Step Tasks` can produce that — it is recorded here as what it is, an exit signal earned by waiting after Task 5, verified by the owner directly (e.g. checking `$env:USERPROFILE\praesto-snapshots\` a month from now), not simulated by any VALIDATE command.

*Generated: 2026-09-06*
*Approved: 2026-09-07*
*Status: IMPLEMENTED*
