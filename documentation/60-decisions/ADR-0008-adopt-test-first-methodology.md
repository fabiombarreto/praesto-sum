---
status: accepted
last_updated: 2026-08-04
review_trigger: "a new decision touches the same topic"
---

# ADR-0008: Adopt test-first (TDD) as the declared methodology

> **Purpose:** Record the switch from test-after to test-first, its scope, and what it costs.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-04
- **Related:** [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md), [ADR-0006](ADR-0006-recurrence-model.md), [ADR-0007](ADR-0007-google-calendar-bidirectional-sync.md); QA-004, CON-002, CON-003

## Context

Phase 0 recorded a pragmatic **test-after** philosophy in `documentation/40-engineering/testing-strategy.md`: automate where regressions hurt, verify manually where they don't. `docs/context/methodology.md` carried `tdd: false` accordingly, which kept relay's test pair (test-writer / test-reviewer) out of the pipeline — tests were authored after the Implementer, or by hand.

On 2026-08-04 the owner declared the opposite intent: *"I want to work with TDD on this project using the relay plugin."* The relay plugin reads `docs/context/methodology.md` at startup and routes on it; with `tdd: true` and a declared framework, `/relay-execute` runs `/relay-write-test` and `/relay-test-write-review` **between plan review and implementation**, deriving the suite from the PRD's Acceptance Criteria before any production code exists.

The timing is favourable rather than incidental: only one delivery unit's worth of code exists (the scaffold), and the work immediately ahead is exactly the kind TDD serves best — recurrence expansion with timezone and DST edges, the `missed` sweep writing a terminal state autonomously, and Google Calendar sync, where a wrong write reaches data Praesto cannot restore.

## Decision

We will practise **test-first** development, declared as `tdd: true` with `tdd_evidence: "user-declared"` in `docs/context/methodology.md`, and driven by relay's test pair.

Pipeline order becomes: `/relay-plan` → `/relay-plan-review` → `/relay-write-test` → `/relay-test-write-review` → implement → code review → `/relay-test`. The suite must be RED for the right reason before implementation starts, and the test reviewer's rubric (implementation leakage, trivial assertions, mock abuse, AC coverage, duplication, legitimate RED) gates it.

**Scope is unchanged from the existing automated/manual split.** Test-first applies to API routes and validation, the auth gate, data-layer invariants, pure domain logic in `src/shared`, the `scheduled()` jobs, export completeness, and the ADR-0007 sync rules. It does **not** extend to React components: UI stays manually verified, per the testing strategy the owner already validated. A PRD whose acceptance criteria are purely visual legitimately produces no test file.

The guardrail in `docs/context/testing.md` is untouched and remains in force independently: it governs keeping existing suites green on every change, including changes made without any relay command.

## Alternatives considered

- **Keep test-after (`tdd: false`)** — rejected by the owner's explicit declaration. Its genuine merit stands recorded: on a 1 h/day budget, writing tests after lets a slice be explored before its contract is frozen.
- **Test-first including the UI** — rejected: it contradicts the validated automated/manual split, and React component tests for a single-user app are maintenance the owner would pay for daily without a regression class to justify it.
- **Adopt TDD informally, without flipping the flag** — rejected: the flag is the contract the relay agents read. Practising TDD while the file says `tdd: false` would make every agent route the wrong way, which is worse than either honest state.

## Consequences

- Positive: acceptance criteria become executable before code exists, which is the strongest available defence for the three riskiest units ahead (recurrence, the autonomous `missed` sweep, and calendar write-back); the test reviewer blocks the classic failure of a suite written to match whatever the implementation happened to do; PRD acceptance criteria get sharper, because vague ones cannot be turned into a RED test.
- Negative / accepted trade-offs:
  - **Every delivery unit gets longer.** Two extra agent round-trips per unit, plus a bounded retry budget. The roadmap's 87 unit-days already excluded the PRD → plan → review cycle; TDD raises that floor further. Estimates were not rewritten — they are explicitly a floor, and the ceiling rule (~10 days, split otherwise) still applies.
  - The first units may feel slower than hand-writing tests afterwards, especially units 1–3, whose acceptance criteria are largely UI-shaped and will produce few or no test files.
  - `documentation/40-engineering/testing-strategy.md` had to be amended: its Philosophy and Definition of Done described test-after, and leaving them would have made two owner-validated documents contradict each other.
