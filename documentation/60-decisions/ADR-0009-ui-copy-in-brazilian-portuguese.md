---
status: accepted
last_updated: 2026-08-18
review_trigger: "a new decision touches the same topic"
---

# ADR-0009: Write the visible UI copy in Brazilian Portuguese; every other artifact stays English

> **Purpose:** Record the resolution of pending decision 7 — the language of the text the owner reads on screen — its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-18
- **Related:** [ADR-0001](ADR-0001-write-all-artifacts-in-english.md); [UI/UX plan](../50-planning/ui-ux-plan.md) (Q7, activities A1 and A5); FR-045; principle 5 in the [vision](../10-product/vision.md)

## Context

[ADR-0001](ADR-0001-write-all-artifacts-in-english.md) fixed English for every *artifact* — documentation, code, comments, commits, identifiers — while conversation with the owner stays Portuguese. It never said which language the **product itself** speaks to its single user, and the codebase drifted into a contradiction: `index.html` and the web app manifest declare `lang="pt-BR"`, while every visible string shipped so far is English ("What needs doing?", "Saved", "Edit Task", "Paste the API token for this device."). The [UI/UX plan](../50-planning/ui-ux-plan.md) surfaced this on 2026-08-18 as pending decision 7 because its guidelines cannot carry a voice-and-tone section, and its design pass cannot restyle a screen, until the language is settled.

Forces: the owner is Brazilian and reads this text every day, several times a day — quick capture (FR-045) and the "effortless in, effortless out" principle live in microcopy; Portuguese runs roughly 15 % longer than English, which affects the type scale and control widths the identity work is about to fix; and the repository's single-language rule for artifacts must not be weakened by accident.

## Decision

We will write **all visible UI copy in Brazilian Portuguese** — labels, buttons, placeholders, empty/loading/error/offline states, notifications, the install/update prompts, the manifest's `name`/`short_name`/`description`/`shortcuts` text and the `lang` attributes — and keep **everything else English** exactly as ADR-0001 requires: source code, identifiers, comments, tests, commits, documentation, `docs/`, and the string *keys* or component/prop names that carry the Portuguese values.

Concretely: the language declared in `index.html` and the manifest (`pt-BR`) becomes true; a voice-and-tone page in Portuguese is part of the identity work (UI/UX plan step 2.8); English strings still in the app are translated in the design pass (activity A5), never left as a mixed screen. Test assertions that pin owner-facing messages (e.g. `src/shared/token-store.ts`, `src/shared/request-failure.ts`) pin the Portuguese wording from then on — the test files themselves stay English.

## Alternatives considered

- **English UI copy, matching the repository** — rejected: the product exists to remove friction for one Brazilian user; a foreign-language interface is friction paid daily for a consistency that benefits nobody, and it would keep the `lang` declaration a lie.
- **Bilingual UI / i18n framework** — rejected: exactly one user with exactly one language; an i18n layer is machinery with no consumer (QA-004, principle 3), and ADR-0005's dependency discipline argues against adding it for a hypothetical.
- **Editing ADR-0001 to carve out the UI** — rejected: accepted ADRs are append-only; this ADR *scopes* ADR-0001 rather than rewriting it.

## Consequences

- Positive: the owner's daily surface speaks his language; the manifest and `lang` attributes become honest; the identity's voice and tone can be written once, in the language it will be read in; ADR-0001 stays intact.
- Negative / accepted trade-offs:
  - The repository carries two languages side by side, separated by a clear rule (values in Portuguese, everything else English). Reviews must catch Portuguese leaking into identifiers or comments — the existing anti-pattern "Portuguese in artifacts" still applies to everything except UI values.
  - Longer strings: the layout standard and the type scale (UI/UX plan A2/A3) must be designed against Portuguese lengths, not English mock-ups.
  - Tests that pin owner-facing messages change wording once, in A5, and are updated to the new intent rather than weakened.
