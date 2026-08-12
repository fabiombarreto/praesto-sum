# Testing — mandatory guardrail for every change

This file is a binding behavioral contract, not a reference doc. Any
agent or human who changes code in this project MUST follow the guardrail
below on EVERY change — including small, single-file, or "quick" ones,
and whether or not a relay command was used. Skipping any step silently
is a violation.

`docs/context/methodology.md` governs whether the TDD track (writing
tests first) is active — since 2026-08-04 it is (`tdd: true`, ADR-0008),
so behavioural work starts from a failing test. THIS file governs keeping
the existing suites green afterward, and the two are independent: the
guardrail below binds every change regardless of the methodology flag,
including changes made without any relay command. This guardrail is also NOT subject to
the `docs/decision-gate.md` scope exemptions — a change that is "exempt"
from the gate still requires every step here.

## The guardrail (every code change)

1. Detect. Before finishing, state explicitly whether automated tests
   exist for the code you touched (see "Detected test suites" below) and
   which suites cover it.
2. Keep tests in sync. If your change alters behavior a test asserts,
   UPDATE that test to match the intended new behavior. Never leave a
   test asserting the old behavior. Never delete, skip, comment out, or
   weaken a test just to get a green run — that is a separate
   anti-pattern (see docs/anti-patterns.md).
3. Run. Run the suites that cover the changed code. Treat all tiers
   (unit, integration, e2e) with equal weight — at minimum run the e2e
   suite; a green unit run does not excuse an unrun e2e suite.
4. Report honestly. State which suites ran, the pass/fail result, and
   what you changed in the tests and why.

## Fallback — when you CANNOT run the tests

If for ANY reason a suite cannot run (missing dependency, no browser or
display for e2e, services not up, unknown command, timeout, sandbox or
permission limit, etc.), you MUST NOT stay silent. At the END of your
response:

1. Warn the user, in plain language, that the tests were not run.
2. Name which suite(s) could not run and the specific reason (the actual
   error or the missing precondition).
3. Give exact, copy-pasteable commands to run them manually, including
   any setup required first (install browsers, start services, set env
   vars, seed the database).

A change that touched test-covered code and ends with neither a test run
nor this explicit warning is incomplete.

## Detected test suites

| Tier | Framework | Config / location | Run command | Prerequisites |
|------|-----------|-------------------|-------------|---------------|
| integration | Vitest 4 + `@cloudflare/vitest-pool-workers` | `vitest.config.ts` project `worker`, tests in `test/*.test.ts` | `npm test` (watch: `npm run test:watch`); alone: `npx vitest run --project worker` | `npm ci`; migrations are applied automatically into the ephemeral D1 by `test/apply-migrations.ts`. No dev server, no browser, no network. |
| docs consistency | Vitest 4, plain Node | `vitest.config.ts` project `docs`, single file `test/docs-consistency.test.ts` | `npm test`; alone: `npx vitest run --project docs` | `npm ci`. Reads `docs/` and `documentation/` off disk — which is why it is a separate project: workerd has no `node:fs`. |

The `worker` project runs the real Worker inside workerd with real bindings:
Hono routes, the auth gate and the Drizzle data layer are exercised against an
ephemeral D1 built from `migrations/`. The `docs` project touches no runtime at
all — it only reads Markdown. There is **no browser/e2e tier yet** — the UI is
verified manually via `npm run dev`. When the first e2e suite lands, add its
row here with the exact command and prerequisites.

Notes that bite:

- Storage isolation is per test **file**, not per test. `reset()` from
  `cloudflare:test` wipes the schema too — any test calling it must re-run
  `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` immediately.
- The API token used by tests is the miniflare binding `API_BEARER_TOKEN` in
  `vitest.config.ts`; read it in tests via `env.API_BEARER_TOKEN` rather than
  hardcoding it.
- Coverage is not configured: `@vitest/coverage-v8` does not work inside
  workerd. Only `@vitest/coverage-istanbul` would, pinned to the exact Vitest
  version.

Also mandatory before finishing any change: `npm run check`
(`wrangler types --check` + `tsc -b` + ESLint + Prettier). A green test run
with a red `check` is not done.
