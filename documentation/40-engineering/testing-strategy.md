---
status: active
last_updated: 2026-08-03
review_trigger: "practice shows the split is too heavy or too light, or a new test tier is added"
---

# Testing Strategy

> **Purpose:** What gets tested, what deliberately does not, and what "done" means for any change.
> **Update when:** The tech stack is chosen, the MVP scope is fixed, or practice shows the strategy is too heavy or too light.

## Philosophy

Pragmatic testing for a solo personal project: automated tests where regressions hurt, manual verification where they don't. The single user is also the developer, so the cost of a bug is low and the cost of over-testing is paid directly in evenings — but silent regressions in the areas the owner relies on daily (the data that represents their life) are exactly the kind that erode trust in the tool.

The dividing line between "automate" and "verify by hand" is decided upfront, in this document, not case-by-case under deadline pressure. When a case is unclear, it gets a row in the section below before any test is written or skipped.

## What gets tested / what deliberately does not

Tooling landed with the 2026-08-03 scaffold: **Vitest + `@cloudflare/vitest-pool-workers`**, running the real Worker inside workerd against an ephemeral D1 built from `migrations/`. One command: `npm test`. The operational protocol (how to run, what to do when you cannot) is the binding guardrail in [docs/context/testing.md](../../docs/context/testing.md); this section is the *what*.

| Area | Automated? | Why |
|---|---|---|
| API routes (status codes, validation, auth gate) | **Yes** | Cheap in the pool, and the contract the PWA depends on |
| Data-layer invariants (ADR-0006: one open occurrence per series, `missed` semantics, deadline XOR scheduled date) | **Yes** | These are the rules that protect the owner's data; a silent break here corrupts history |
| Domain logic in `src/shared/` (recurrence expansion, dates, timezone/DST) | **Yes** | Pure functions, highest bug density per line, trivial to test |
| Reminder scheduling and the `scheduled()` sweep | **Yes** | Push failure is silent by nature — an untested scheduler fails invisibly (FR-041) |
| Export completeness (FR-042) | **Yes** | Ownership is theoretical if the export silently drops a table |
| React components and layout | **No** — manual | One user, one browser pair; visual checks are faster than maintaining component tests |
| Third-party behavior (Cloudflare, browser push delivery) | **No** | Not ours to test; verified by using the app |
| End-to-end browser flows | **Not yet** | No e2e tier exists. If manual verification starts missing regressions, add one and record it in [docs/context/testing.md](../../docs/context/testing.md) |

When a case is unclear, it gets a row here before any test is written or skipped.

## Definition of Done

A change is done only when all four hold:

1. **It works** — the change behaves as intended, verified by running it.
2. **The gate is green** — `npm test` and `npm run check` (types + `tsc -b` + ESLint + Prettier) both pass. Tests touching changed behavior are updated to the new intent, never weakened or skipped.
3. **Schema changes reviewed for remote safety** — if a migration was generated, its SQL was read, and any `PRAGMA foreign_keys=OFF/ON` was rewritten as `PRAGMA defer_foreign_keys` (it passes locally and fails on remote D1).
4. **Affected docs are updated in the same session** — per the maintenance map in [../README.md](../README.md) and golden rule 2 of the [documentation guidelines](../00-meta/documentation-guidelines.md). "I'll document it later" fails the definition.
