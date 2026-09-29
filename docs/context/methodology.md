---
tdd: true
tdd_evidence: "user-declared"
test_frameworks: ["vitest"]
docs_sync: true
formatter_cmd: "npx prettier --write"
figma_track: false
visual_first_approval: auto
hybrid_code_review: true
hybrid_code_review_level: "high"
---

# Methodology

## TDD (Test-Driven Development)

Current state: **declared active** by the owner on 2026-08-04
(`documentation/60-decisions/ADR-0008-adopt-test-first-methodology.md`).

The pipeline order is therefore test-first: `/relay-plan` →
`/relay-plan-review` → `/relay-write-test` → `/relay-test-write-review` →
implement → code review → `/relay-test`. The test pair derives the suite
from the PRD's Acceptance Criteria **before** the Implementer runs, and the
suite must be RED for the right reason before any production code exists.

### Scope of the practice (read this before writing tests)

TDD here applies to what `documentation/40-engineering/testing-strategy.md`
already lists as automated: API routes and their validation, the auth gate,
data-layer invariants (notably the ADR-0006 ones), pure domain logic in
`src/shared` (recurrence expansion, dates, timezone/DST), the `scheduled()`
jobs, export completeness, and the Google Calendar sync rules of ADR-0007.

It does **not** mean writing React component tests first: the same document
deliberately keeps UI verification manual, and that split is unchanged. A
PRD whose acceptance criteria are purely visual produces no test file — that
is the `EXISTING_COVERAGE_SUFFICIENT` / no-test-required path, not a
violation.

### Browser-API work: split the logic out, then the glue is exempt

Recorded 2026-08-11, when Phase 2 of `install-and-quick-capture` stalled: the
only test tier is Vitest inside workerd, which has no IndexedDB, no
`navigator.storage.*`, no Notification API and no service-worker registration.
Work that touches those APIs has no honest test-first path as written — the
test pair would author nothing or abort as AMBIGUOUS.

The resolution is **not** a blanket exception. It is a design obligation:

1. **Extract the decidable part into `src/shared`** behind a port — the state
   machine, the fallbacks, the migration, the error mapping — and write those
   tests first against an in-memory fake. This is the pattern the project
   already used for `src/shared/request-failure.ts`.
2. **Only the thin adapter is exempt**: the lines that actually call the
   browser API. It is verified on the device and the verification is recorded
   in the phase's delivery-history entry.
3. If a phase cannot be split that way, it does not silently proceed — it
   raises the question to the owner, as Phase 2 did.

The exemption is for glue, never for logic. "It touches the browser" is not by
itself a reason to skip a test; it is a reason to move the logic somewhere
testable first. A real browser tier (Vitest browser mode or Playwright) is
recorded in the roadmap backlog with its trigger: the push work of unit 6,
where failure is silent and manual verification genuinely stops being enough.

### Cost, recorded honestly

Test-first adds two agent round-trips per delivery unit and lengthens each
one. The roadmap's estimates were made before this decision and already
exclude the PRD → plan → review cycle; treat them as a floor that TDD
raises further, not as a promise.

### How to deactivate

Heuristics MUST NOT flip this value — only a human edit or an explicit owner
declaration can. Reverting means setting `tdd: false`, clearing
`tdd_evidence`, and recording a superseding ADR; the guardrail in
`docs/context/testing.md` stays in force either way.

## Formatter

Current state: **declared** — `formatter_cmd: "npx prettier --write"` in the
frontmatter above. `/relay-write-test` (prevention) and `/relay-implement`
(preflight) read this key and invoke the command scoped to the touched test
files, before the code reviewer's R-X inspection window opens. That is what
keeps an approved suite Level-1 clean without the Implementer ever editing a
test file — R-X and D17 keep zero carve-outs.

The value is declared explicitly rather than left to relay's `package.json`
fallback on purpose. That fallback builds `npm run format -- <files>`, and
this project's `scripts.format` is `prettier --write .` — the trailing `.`
survives the pass-through, so the fallback would format the whole repository
instead of the touched files, which `/relay-write-test` forbids outright
("never `.`"). Declaring the key takes precedence over the fallback and keeps
the invocation scoped.

Keep the command **without a path target**: relay appends the file paths as
trailing arguments itself.

### How to override

Heuristics MUST NOT flip this value — only a human edit can. `context-builder`
always emits the deterministic default `formatter_cmd: null` and never infers a
value from `package.json`, devDependencies or config files; on `*update` it
preserves an existing value untouched. Setting it back to `null` disables the
formatting step, which restores the R-X × Level 1 deadlock this key exists to
prevent.

## Hybrid Code Review

Current state: **declared active** — `hybrid_code_review: true` with
`hybrid_code_review_level: "high"` in the frontmatter above. This project is
the dogfood target for relay's hybrid code review (relay 0.39.0; the operating
conditions are frozen in relay's own `docs/decisions.md` entry 103).

With the key on, `code-reviewer` runs Claude Code's built-in `/code-review`
once per review over the attempt's diff and treats its findings as evidence for
its own R-SEM row. Findings arrive as `class: advisory` and leave the verdict
alone; one is promoted to `class: blocking` only when it is high-severity AND
the reviewer confirms, with `git diff` against the diff under review, that the
cited line sits in an added or modified hunk. At most 10 findings are
adjudicated. R-X, the arbitration outcomes and the dispute channel are
untouched: a promoted finding about a test file still routes through
`TEST_CONTRACT_DISPUTE` and never authorizes a direct test edit.

`level` is `high` rather than the shipped default `medium` on purpose. The
pinned sample set relay measures drift against was benchmarked at `high`, so a
`medium` run here would produce recall numbers that are not comparable to that
baseline. Expect roughly 20 to 130 seconds of added wall time per review; the
pass carries its own three-minute timeout, never consumes an implement retry,
and skips itself when the loop's remaining wall clock is short.

### How to override

Heuristics MUST NOT flip this value — only a human edit can. Setting it to
`false`, or removing it, returns `code-reviewer` to the rubric it had before
0.39.0, with no `/code-review` invocation and no `hyb*` fields on the verdict.
Levels above `high` are refused by name by the agent itself, so raising this
value to `xhigh`, `max` or `ultra` disables the pass rather than deepening it.
