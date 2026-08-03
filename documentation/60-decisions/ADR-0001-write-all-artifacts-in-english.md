---
status: accepted
last_updated: 2026-08-02
review_trigger: "a new decision touches the same topic"
---

# ADR-0001: Write all artifacts in English

> **Purpose:** Record the decision about the working language of all project artifacts, its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-02
- **Related:** none yet

## Context

The owner is Brazilian and project conversations happen in Portuguese, but the project needs a single language for all artifacts: documentation, code, comments, commit messages and identifiers will reference each other constantly, and a split vocabulary would force permanent translation between them. The decision was made by the owner on 2026-08-02, at the start of Phase 0, before any artifact was written.

## Decision

We will write all project artifacts — documentation, code, comments, commit messages and identifiers — in English.

## Alternatives considered

- **Everything in Portuguese** — rejected because it cuts the project off from ecosystem conventions, library idioms and most tooling and examples.
- **Mixed: pt-BR documentation + English code** — rejected by the owner because it creates permanent translation overhead between docs and code, the glossary would need a translation column, and prompts and commit messages would mix languages.

## Consequences

- Positive: a single vocabulary from documentation to code; better fit with AI tooling and the wider ecosystem.
- Negative / accepted trade-offs: writing overhead for a non-native author. Conversations with the owner remain in Portuguese by preference — conversation is not an artifact.
