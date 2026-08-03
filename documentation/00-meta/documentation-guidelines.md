---
status: active
last_updated: 2026-08-02
review_trigger: "a convention proves useful or useless in practice"
---

# Documentation Guidelines

> **Purpose:** The rules that keep every other document consistent and alive — format, lifecycle, naming, stable IDs and templates.
> **Update when:** A new convention emerges in practice, or an existing one proves useless.

## Language

All project artifacts — documentation, code, comments, commit messages, identifiers — are written in English ([ADR-0001](../60-decisions/ADR-0001-write-all-artifacts-in-english.md)).

## Frontmatter

Every document starts with this YAML frontmatter:

```yaml
---
status: draft
last_updated: 2026-08-02
review_trigger: "concrete event that should trigger a review of this doc"
---
```

- `status` — lifecycle state (see below). ADR files use ADR states instead: `proposed | accepted | superseded`.
- `last_updated` — ISO date (`YYYY-MM-DD`), set on every edit.
- `review_trigger` — a concrete event ("when the stack is chosen", "when a phase closes"), never a date. Fixed dates create false deadlines in a project with an irregular rhythm.

Immediately after the title, every document carries two fixed lines:

> **Purpose:** what this document is for, in one sentence.
> **Update when:** the concrete trigger(s) that require updating it.

## Document lifecycle

`draft → active → deprecated`

- **draft** — structure and content still under discussion; may contain unvalidated assumptions.
- **active** — source of truth; safe to rely on.
- **deprecated** — kept with a banner at the top linking to its replacement; removed from the README reading flow; deleted only at the following audit. Never silently deleted — an AI assistant must never follow a dead document unaware.

## Naming and format

- Markdown only. File and folder names in kebab-case.
- Folders numbered in steps of 10 (`00-meta`, `10-product`, …) so future folders can be inserted without renumbering.
- Diagrams in Mermaid embedded in Markdown — versionable and diffable. Never binary images.
- Dates always ISO `YYYY-MM-DD`.
- Target size: ≤300 lines per document. Exceeding it is the objective trigger to split the document and update the README map.
- Explicit gaps: a section without an answer is never omitted. It carries one of the two canonical markers: `TBD — see the pending decisions queue in 60-decisions/index.md` (as a relative link) when blocked on a technical decision, or `TBD — pending owner input` when blocked on the owner. A visible gap is an invitation to decide; an omitted one is a trap.

## Stable IDs

| Prefix | Meaning | Lives in |
|---|---|---|
| `FR-nnn` | Functional requirement | [20-requirements/functional-requirements.md](../20-requirements/functional-requirements.md) |
| `QA-nnn` | Quality attribute scenario | [20-requirements/quality-attributes.md](../20-requirements/quality-attributes.md) |
| `CON-nnn` | Constraint | [20-requirements/constraints.md](../20-requirements/constraints.md) |
| `ADR-nnnn` | Decision record | [60-decisions/](../60-decisions/index.md) |

IDs are never reused. A removed item is marked **withdrawn** and keeps its ID. IDs are referenced in commits, code comments and prompts.

## Prioritization (MoSCoW)

Every functional requirement carries exactly one:

- **Must** — the MVP does not ship without it.
- **Should** — important, but the MVP survives without it.
- **Could** — desirable if cheap.
- **Won't (this phase)** — explicitly out for now, with the reason recorded.

## Decision records (ADRs)

- One file per decision: `60-decisions/ADR-nnnn-short-kebab-title.md`, copied from [templates/adr-template.md](templates/adr-template.md).
- Append-only: an accepted ADR is never edited. Changing course means a new ADR that marks the old one `superseded`.
- Negative decisions are decisions too: rejected ideas and non-goals record the reason, so no topic is re-litigated from scratch.
- Every new ADR is added to the [decisions index](../60-decisions/index.md).

## Golden rules

1. One source of truth per topic — link, never duplicate.
2. Documents are updated in the same session as the change that affects them. Never "I'll document it later".
3. Gaps are explicit, never omitted.
4. A document without a maintenance trigger (a row in the README maintenance map) should not exist.
5. Touched it, reviewed it: when opening any document for any reason, fix whatever is outdated before closing it.

## Templates

- [templates/document-template.md](templates/document-template.md) — for any new standard document.
- [templates/adr-template.md](templates/adr-template.md) — for any new decision record.

Template files are meta artifacts: they are excluded from the README status panel and from audits.
