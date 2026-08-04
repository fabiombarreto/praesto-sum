---
tdd: true
tdd_evidence: "user-declared"
test_frameworks: ["vitest"]
docs_sync: true
figma_track: false
visual_first_approval: auto
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
