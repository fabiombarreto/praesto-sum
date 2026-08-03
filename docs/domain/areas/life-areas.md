# Life Areas

**Primary responsibility:** the top-level unit of scope — domains of personal life the assistant organizes. The growth axis of the whole product.

**Entities:** Life Area (see `docs/domain/glossary.md`); groups Tasks and Events.

## Business rules (owner-validated 2026-08-03)

- Now: Calendar and Tasks. Leading later candidate: **Notes / personal information** (signaled by the owner's own pain of losing scattered notes). "Never": none declared — the owner considers every Life Area potentially in scope someday.
- Growth is **data, not remodeling**: adding a new Life Area is creating a record — it must never require changing the Task, Event or Reminder entities (domain-model evolution rule).
- Area-specific concepts arriving later (e.g. a health or finance area) attach as NEW entities alongside Task/Event — never by widening the core entities with area-specific attributes.
- A concept that genuinely does not fit this shape triggers a glossary + domain-model change with its own ADR — never a silent workaround.
- New areas enter scope ONLY via the roadmap triage rules (`documentation/50-planning/roadmap.md`) — an idea becomes an FR only when accepted.

## Resolved 2026-08-03

- A Task or Event MAY exist without a Life Area; area-less items surface in an implicit "Unsorted" grouping in the UI (no stored default area) — capture must never force a taxonomy choice (vision principle 5).
- No Life Areas are pre-created at scaffold time; the owner creates areas as needed (vision principle 4).
