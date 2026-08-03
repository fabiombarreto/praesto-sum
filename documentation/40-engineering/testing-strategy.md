---
status: draft
last_updated: 2026-08-02
review_trigger: "the tech stack is chosen, the MVP scope is fixed, or the first automated test is written"
---

# Testing Strategy

> **Purpose:** What gets tested, what deliberately does not, and what "done" means for any change.
> **Update when:** The tech stack is chosen, the MVP scope is fixed, or practice shows the strategy is too heavy or too light.

## Philosophy

> Draft pending owner validation — proposed by the documentation effort, not yet confirmed by the owner.

Pragmatic testing for a solo personal project: automated tests where regressions hurt, manual verification where they don't. The single user is also the developer, so the cost of a bug is low and the cost of over-testing is paid directly in evenings — but silent regressions in the areas the owner relies on daily (the data that represents their life) are exactly the kind that erode trust in the tool.

The dividing line between "automate" and "verify by hand" is decided upfront, in this document, not case-by-case under deadline pressure. When a case is unclear, it gets a row in the section below before any test is written or skipped.

## What gets tested / what deliberately does not

TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md). This split needs two inputs that do not exist yet: the tech stack (which determines the test tooling and what is cheap to automate) and the MVP scope in the [functional requirements](../20-requirements/functional-requirements.md) (which determines where regressions hurt). Once both exist, this section becomes a two-column inventory: covered by automated tests vs deliberately manual, each entry with a one-line reason.

## Definition of Done

> Draft pending owner validation — proposed by the documentation effort, not yet confirmed by the owner. Unlike the sections above, this one is not blocked on any pending decision and applies from the first code change.

A change is done only when all three hold:

1. **It works** — the change behaves as intended, verified by running it.
2. **Affected tests pass** — every automated test touching the changed area passes; new automated coverage is added when the change falls on the "automated" side of the split above.
3. **Affected docs are updated in the same session** — per the maintenance map in [../README.md](../README.md) and golden rule 2 of the [documentation guidelines](../00-meta/documentation-guidelines.md). "I'll document it later" fails the definition.
