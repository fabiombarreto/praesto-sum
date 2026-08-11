# Docs Update — install-and-quick-capture (Phase 2)

**PR:** N/A — no PR exists yet. This is a pre-merge, per-phase docs sync
dispatched inline by `/relay-implement`'s Phase A.3.5 for Phase 2 (Durable
token) of the `install-and-quick-capture` PRD, running against attempt 1's
already-captured diff (`diff_source: patch`) rather than `gh pr diff`.
**Merged at:** N/A — not merged. Diff read directly (via `Read`, no `Bash`)
from `PRPs/reports/install-and-quick-capture/phase-2/attempts/1/diff.patch`
(base commit `85a58039fbfa16fdcade04820fd59e180bcbaaaa`; attempt verdict
`IMPLEMENTATION_COMPLETE`, Level 1–3 validation `PASS` per the attempt's own
`record.json`).
**Source PRD:** `PRPs/prds/install-and-quick-capture.prd.md` (Implementation
Phases row 2 — "Durable token"; Phase 2 Phase Details; Open Question 4,
RESOLVED 2026-08-11)
**Effective configuration:** diff_source=patch, non_interactive=true,
docs_sync=true (parsed from `docs/context/methodology.md` frontmatter)

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The "Repository layout" table's `src/app/` row stated
`api.ts (typed client + token storage)`, which this diff makes false:
`src/app/api.ts`'s three `window.localStorage` accessors are deleted, and
`getToken`/`setToken` are renamed (deliberately, so a missed `await` is a
compile error) to async `readToken`/`saveToken`/`clearToken`, which now
delegate to `createTokenStore` imported from the new
`src/shared/token-store.ts` (diff hunk `src/app/api.ts`). The diff also adds
a second new file this row omitted entirely, `src/app/token-storage.ts`
(diff hunk `src/app/token-storage.ts`) — the thin, deliberately-untested
adapter (IndexedDB + `localStorage` + `navigator.storage.persist()`) that
`docs/context/methodology.md`'s existing "Browser-API work: split the logic
out, then the glue is exempt" rule names. Corrected the `api.ts`
parenthetical and added `token-storage.ts` to the row's file list, citing
both the new responsibility split and the methodology rule governing it.
Every other row and cell in the table is byte-unchanged.

---

## Candidate Decisions (for operator review)

- **Durable client-side token storage (IndexedDB over `localStorage`, a
  one-time migration of the existing token, `save()` degrading back to
  `localStorage` when IndexedDB is unavailable, and a best-effort
  `navigator.storage.persist()` at startup) reads like ADR material** under
  `CLAUDE.md`'s own rule ("Any non-obvious product or technical choice
  becomes an ADR in `documentation/60-decisions/` immediately"). The
  rationale is already recorded twice — in
  `PRPs/prds/install-and-quick-capture.prd.md`'s `## Decisions Log` ("Token
  durability" row, with rejected alternatives `localStorage`-as-is and a
  URL-carried magic link) and in the approved phase plan's `## Notes` /
  `## Risks and Mitigations` sections — but this diff contains no new file
  under `documentation/60-decisions/`. `docs/decisions.md` mirrors only
  ADR-sourced entries (every existing entry cites a real
  `documentation/60-decisions/ADR-XXXX`, per the file's own header and this
  feature's established precedent in
  `PRPs/reports/install-and-quick-capture/docs-update.md` and
  `docs-update-phase-3.md`), so no entry was written here — this is the
  PRESERVE-ENTIRELY path, not an oversight. This dispatch's brief states the
  main session is handling `documentation/` (including ADRs) in this same
  session; if that work adds an ADR for this choice, mirror it into
  `docs/decisions.md` at that point. If not, the operator should judge
  whether one is warranted.

## Deferred Questions

None. `non_interactive: true` was honored throughout this run — no question
was asked of the operator under any circumstance, per the Interactivity
Clause's gate. Separately, no docs decision encountered while reading this
diff was genuinely ambiguous enough to have warranted a question even under
`non_interactive: false`: the one open item worth the operator's attention
is recorded above under Candidate Decisions instead, because it is a
"does this rise to needing an ADR" judgment rather than a "which of two or
more materially different readings" ambiguity.

## Files Scanned — No Edit Required

- `docs/context/methodology.md` — Read in full, including frontmatter
  (`tdd: true`, `docs_sync: true`, `figma_track: false`,
  `visual_first_approval: auto`). Its "Browser-API work: split the logic
  out, then the glue is exempt" section (recorded 2026-08-11) already states,
  in full, the exact split this diff implements (pure logic in
  `src/shared/token-store.ts`, tested first against an in-memory fake; only
  `src/app/token-storage.ts` exempt and device-verified) — this diff does
  not touch the file, and it already accurately describes what the diff
  does, so no correction was needed. `figma_track: false` confirmed, so Step
  3.5's component-map `verified:auto` upgrade is gated off for this run and
  was not attempted — nothing further recorded for it, per that step's own
  skip-silently instruction.
- `docs/decisions.md` — PRESERVE-ENTIRELY. Read in full. No hunk in this
  diff states a new project decision with an explicit ADR source (see
  Candidate Decisions above for the one item considered and deliberately
  not written in).
- `docs/anti-patterns.md` — PRESERVE-ENTIRELY. Read in full. The phase
  plan's "NOT Building (Scope Limits)" list restates several already-covered
  or PRD-scoped items (offline write queue — already an existing entry;
  token-in-URL, encryption-at-rest, token rotation/expiry — PRD-wide "Won't"
  items with no ADR source, previously considered and left unrecorded by
  this feature's Phase 1 docs-update manifest for the same reason) and
  introduces nothing new project-wide. The plan's warning against a trivial
  `persist()`-was-called assertion is a test-authorship rubric concern
  (`R-TRIVIAL-ASSERT`), not a `docs/anti-patterns.md`-class forbidden
  implementation pattern. No edit.
- `docs/context/conventions.md` — Read in full. No new naming, casing,
  dependency, or git convention. The existing line "Domain logic
  (recurrence, dates, invariants) lives in pure functions in `src/shared/`,
  unit-tested" already covers the shape `src/shared/token-store.ts` takes
  generically, matching the precedent already set for
  `src/shared/share-target.ts` and `src/shared/request-failure.ts` in this
  feature's earlier docs-update manifests. No edit.
- `docs/context/constraints.md` — Read in full. CON-007 (Android device
  verification) is exercised, not changed, by this phase's manual
  device-verification protocol (migration, restart survival, `persist()`
  outcome, storage-pressure attempt, 401 recovery, fresh install); no
  CON/QA row's text changed. No edit.
- `docs/context/integrations.md` — Read in full. The "API auth (own
  surface)" section describes the bearer token's *auth type* and its
  *server-side* storage (a Worker secret) — both unchanged by this diff,
  which is entirely client-side. It says nothing about where the client
  stores the token, so nothing in it is contradicted. No edit.
- `docs/context/architecture.md` (remaining unedited claims) — The
  `src/shared/` row ("Environment-agnostic: `api.ts` wire contract + pure
  domain logic") does not enumerate files by name, so it required no update
  to stay accurate for the new `src/shared/token-store.ts` — consistent with
  how the same row was judged unaffected by `share-target.ts`'s and
  `request-failure.ts`'s earlier additions in this feature's prior
  docs-update manifests. The "Current implementation state (Phase 1)"
  section is a roadmap-Phase-1-grained summary (schema, token-gated API,
  Task CRUD, walking-skeleton PWA) that never described token-storage
  mechanics and is, per this feature's established precedent (Phase 1 and
  Phase 3 docs-update manifests), too coarse-grained a section to update for
  one delivery-unit phase of four. No edit to either.
- `docs/KNOWLEDGE_BASE.md` — Read in full. No new `docs/` file was added by
  this diff (only files under `src/shared/`, `src/app/` and `test/`), so no
  index entry is needed. Separately noted, not fixed: the "Methodology"
  index line still reads `` `tdd: false` (declared test-after philosophy)``,
  which is stale against `docs/context/methodology.md`'s actual frontmatter
  (`tdd: true`, since ADR-0008 on 2026-08-04). This predates this diff (the
  diff touches neither file) and is not traceable to any hunk here, so per
  the "each edit must be traceable to a specific hunk in the merged diff"
  rule it was left uncorrected in this run. Flagging for a dedicated pass or
  operator attention.
- `CLAUDE.md` — Essential commands and Key patterns unchanged. Grepped for
  `token`/`localStorage`/`IndexedDB`; the only hit is the pre-existing,
  still-accurate "Hono 4 API (bearer token on every route)" line, which
  describes the server-side gate and is unaffected by a client-side storage
  change. No edit.
- `docs/domain/areas/tasks.md` — Read in full. Already states "Capture must
  be near-zero friction on any device (FR-045 — vision principle 5)"; this
  phase advances that existing rule (the token screen no longer interrupting
  capture) without changing the rule's text. No edit.
- `docs/domain/flows.md` — Read in full. Flow 1 ("Quick capture") is
  deliberately non-technical and does not describe auth/storage mechanics;
  remains accurate. No edit.
- `docs/domain/glossary.md` — Read in full. The bearer token is an auth
  artifact, not a domain concept alongside the four canonical terms (Task,
  Event, Reminder, Life Area); nothing in this diff touches domain
  vocabulary. No edit.
- `docs/design/component-map.md` — Step 3.5 gate: `docs/context/methodology.md`
  declares `figma_track: false`. Skipped entirely per the gate; nothing
  further recorded for this step.
- `docs/architecture.md`, `docs/api-reference.md`, `docs/development.md`,
  `docs/troubleshooting.md`, `docs/decision-gate.md` — Outside this agent's
  Explicit Write Scope (read-only). Read or grepped for
  `token`/`localStorage`/`IndexedDB`: `docs/architecture.md`'s
  "Non-negotiables while coding" and `docs/api-reference.md`'s auth
  conventions describe the *server-side* bearer-token gate, unaffected;
  `docs/development.md` and `docs/troubleshooting.md` mention the token only
  in server-secret-setup and unreachable-server-diagnosis contexts, also
  unaffected. No edit possible or needed even if a staleness had been found,
  per the write-scope boundary.
- `documentation/**` — Not read and not edited. Explicitly out of this
  agent's scope per the dispatch brief: `documentation/` is the project's
  authoritative source and the main session owns updating it (plus the
  roadmap and PRD closing entries) in this same session. Recorded here only
  so the boundary is visible in this manifest, not because any
  `documentation/` file was inspected.

---
*Generated: 2026-08-11*
*Approved: 2026-08-11*
*Status: APPROVED*
