---
status: draft
last_updated: 2026-08-02
review_trigger: "the tech stack is chosen, or a convention proves useful or useless in practice"
---

# Engineering Conventions

> **Purpose:** The code, git, repository and naming conventions that keep the codebase consistent once it exists.
> **Update when:** The tech stack is chosen (code conventions get filled in), or a convention proves useful or useless in practice.

## Code conventions

TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md). Formatting, linting, style and idiom conventions follow the language and tooling, so this section is filled in only after the programming language & tech stack decision is made.

## Git conventions

> Draft pending owner validation — proposed by the documentation effort, not yet confirmed by the owner. Note: the repository is not yet a git repository (see [dev-environment.md](dev-environment.md)); these conventions apply from the first commit.

- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) in English, e.g. `feat:`, `fix:`, `docs:`, `chore:`. Subject line in the imperative mood ("add reminder snooze", not "added" or "adds").
- **Branching:** a single `main` branch plus short-lived feature branches merged back promptly. No long-lived development branches — this is a solo project.
- **Traceability:** commits reference stable document IDs when applicable, e.g. `feat: add task recurrence (FR-012)` or `chore: pin runtime version per ADR-0003`. ID schemes are defined in the [documentation guidelines](../00-meta/documentation-guidelines.md).

## Repository structure

Current reality — the repository contains documentation only:

```
assistente-pessoal/
└── documentation/    # all project docs (see ../README.md)
```

The code layout (source, tests, configuration, scripts) is TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md); it follows the conventions of the chosen stack.

## Naming

- All identifiers — variables, functions, types, files, database fields — are written in English, per [ADR-0001](../60-decisions/ADR-0001-write-all-artifacts-in-english.md).
- Domain concepts in code must use exactly the canonical names from the [glossary](../10-product/glossary.md): **Task**, **Event**, **Reminder**, **Life Area**. No synonyms, abbreviations or translations — if code needs a concept the glossary lacks, the glossary is updated first.
- Casing conventions (camelCase vs snake_case, etc.) are TBD — see the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md); they follow the chosen language's idiom.
