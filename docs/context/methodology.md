---
tdd: false
tdd_evidence: null
test_frameworks: ["vitest"]
docs_sync: true
figma_track: false
visual_first_approval: auto
---

# Methodology

## TDD (Test-Driven Development)

Current state: **not declared** (default).

The TDD track (agents B7 and B8) activates only when `tdd: true` in the
frontmatter above. Heuristics MUST NOT flip this value — only a human edit
or an explicit user declaration can.

### Observed signals

- None suggesting TDD. On the contrary: `documentation/40-engineering/testing-strategy.md`
  explicitly declares a pragmatic test-after philosophy for a solo personal
  project (automated tests where regressions hurt, manual verification where
  they don't).
- Test tooling landed with the Phase 1 scaffold (2026-08-03): Vitest 4 +
  `@cloudflare/vitest-pool-workers`, running in real workerd against an
  ephemeral D1 (`npm test`). Recorded in `test_frameworks` above — this is
  informative only and does NOT activate the TDD track.

### How to activate

1. Confirm with the owner that TDD is the declared methodology.
2. Change `tdd: false` to `tdd: true` above.
3. Set `tdd_evidence` to `"user-declared"` or the path that records the
   decision.
4. Ensure `test_frameworks` lists frameworks the plugin should drive.
