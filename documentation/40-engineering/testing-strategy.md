---
status: active
last_updated: 2026-08-12
review_trigger: "practice shows the split is too heavy or too light, a new test tier is added, or the methodology flag changes"
---

# Testing Strategy

> **Purpose:** What gets tested, what deliberately does not, and what "done" means for any change.
> **Update when:** Practice shows the split is too heavy or too light, a new test tier is added, or the methodology flag in [docs/context/methodology.md](../../docs/context/methodology.md) changes.

## Philosophy

**Test-first since 2026-08-04** ([ADR-0008](../60-decisions/ADR-0008-adopt-test-first-methodology.md)): for everything on the automated side of the split below, the suite is derived from the PRD's Acceptance Criteria and is RED before the implementation exists. The relay pipeline enforces the ordering (`/relay-write-test` → `/relay-test-write-review` run between plan review and implementation), and `docs/context/methodology.md` carries the flag the agents read.

That does not change *what* is automated — only *when* it is written. The philosophy below still governs the split, and the manual side stays manual.

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
| Browser-storage / browser-API logic (IndexedDB, `navigator.storage`, Notification, service worker) | **Yes, via extraction** | The runtime has none of these APIs, so the decidable part moves to `src/shared` behind a port and is tested against an in-memory fake; only the thin adapter that calls the API is verified manually. Rule and rationale in [docs/context/methodology.md](../../docs/context/methodology.md) (recorded 2026-08-11) |
| Consistency between `docs/` and `documentation/` | **Yes, narrowly** | `docs/` is derived from `documentation/` by convention, and convention lost three times before 2026-08-11 and a fourth time on 2026-08-12 — each drift entering the same way, a change landing on the authoritative side while nothing forced the derived side to follow. `test/docs-consistency.test.ts` pins the mechanically decidable subset (every accepted ADR reaches `docs/decisions.md`; no derived doc calls a resolved decision open; the knowledge-base index does not contradict the frontmatter it summarizes; every cited path resolves). It deliberately does **not** claim the two trees agree in meaning — prose cannot be compared mechanically, and a test implying otherwise would put a green tick under the drift it missed. Hand review of the derived docs is still required |
| End-to-end browser flows | **Not yet — trigger set** | No e2e tier exists. Decided 2026-08-11 not to buy one for token storage, and to buy it when unit 6 `push-channel-proven` needs it: push failure is silent by nature, which is where manual verification genuinely stops being enough. Tracked as a backlog idea in the [roadmap](../50-planning/roadmap.md#backlog) |

When a case is unclear, it gets a row here before any test is written or skipped.

## Definition of Done

A change is done only when all five hold:

1. **It works** — the change behaves as intended, verified by running it.
2. **Tests came first where they apply** — for anything on the automated side of the split above, a failing test derived from the acceptance criteria existed before the implementation ([ADR-0008](../60-decisions/ADR-0008-adopt-test-first-methodology.md)). A purely visual change legitimately produces no test file; a behavioural one produces a test that was RED first.
3. **The gate is green** — `npm test` and `npm run check` (types + `tsc -b` + ESLint + Prettier) both pass. Tests touching changed behavior are updated to the new intent, never weakened or skipped.
4. **Schema changes reviewed for remote safety** — if a migration was generated, its SQL was read, and any `PRAGMA foreign_keys=OFF/ON` was rewritten as `PRAGMA defer_foreign_keys` (it passes locally and fails on remote D1).
5. **Affected docs are updated in the same session** — per the maintenance map in [../README.md](../README.md) and golden rule 2 of the [documentation guidelines](../00-meta/documentation-guidelines.md). "I'll document it later" fails the definition.
