---
status: accepted
last_updated: 2026-08-03
review_trigger: "a new decision touches the same topic"
---

# ADR-0002: Name the project Praesto Sum

> **Purpose:** Record the decision about the project's name, its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-03
- **Related:** [ADR-0001](ADR-0001-write-all-artifacts-in-english.md)

## Context

The project started under the provisional name "Personal Assistant". The owner's naming criteria: easy to remember, short or naturally abbreviable, not a person's name (says nothing about the project), not generic ("Assistant", "Agenda"…), not a long phrase, and carrying real meaning connected to the project. A naming panel generated 32 candidates across four lenses (Latin/Greek roots, Portuguese words, universal metaphors, coined words) and judged them against these criteria with web collision checks; the owner then raised and analyzed *Praesto Sum* on the Latin track.

## Decision

We will name the project **Praesto Sum** — Latin for "I am ready / I stand at your service" (*praesto esse*: to be at hand, ready to serve). The short form **praesto** (lowercase) is the canonical name for the future repository, CLI command and day-to-day references.

## Alternatives considered

- **Prumo** (plumb line; "estar no prumo" = to be aligned, in order) — the panel's highest-scored candidate: shorter, cleaner pronunciation in both languages, freer namespace. Passed over by the owner because Praesto Sum's meaning — the literal voice of an assistant reporting for duty — fits the project more strongly.
- **Leme** (helm/rudder — taking the helm of one's own life) — passed over for the same reason; also reads poorly for English speakers ("leem").
- **Lembora** ("lembra" + "bora") — cleanest namespace of the panel, but the wordplay is invisible outside pt-BR and the informal tone could age badly.
- **Adsum** ("present! / here I am" — one-word variant of the same readiness idea) — passed over in favor of the full classical phrase chosen by the owner.

## Consequences

- Positive: the name states the product's promise literally — the assistant that stands ready to serve; the first-person voice gives the project an identity; it echoes Portuguese *prestar/prestativo*, so Brazilians intuit the meaning without knowing Latin.
- Negative / accepted trade-offs: the full name is two words, so the documented short form `praesto` carries repo and CLI usage; the "ae" spelling needs occasional clarification; the "Praesto" namespace is shared with unrelated B2B brands (Praesto AE, praesto.app, Praesto Consulting), so search visibility is not exclusive; "Sum" reads as the math term to English speakers.
