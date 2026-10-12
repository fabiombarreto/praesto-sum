---
status: accepted
last_updated: 2026-10-11
review_trigger: "the owner asks for colour, archiving or several areas per item, or a second kind of item (Events, notes) takes an area"
---

# ADR-0015: Life Areas are owner-named, single-membership groupings; deleting one unassigns its items

> **Purpose:** Record what a Life Area is for Tasks and recurring series — how many an item may carry, what an area holds, what deleting one does, and what happens to history when a series changes area.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-10-11
- **Related:** [ADR-0006](ADR-0006-recurrence-model.md) (the series template carries the area; closed rows are a permanent record); [ADR-0009](ADR-0009-ui-copy-in-brazilian-portuguese.md) (*Sem área* is pt-BR copy); [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md) (the weekly snapshot is the safety net); [ADR-0010](ADR-0010-visual-identity-direction-arcade.md) (no categorical palette, so no colour now); [ADR-0008](ADR-0008-adopt-test-first-methodology.md); `PRPs/prds/life-areas.prd.md` (unit 13, decisions D-E, D-F, D-J and D-K)

## Context

The `life_areas` table and a nullable `life_area_id` on `tasks` and on `recurrence_series` exist since migration `0000`, with `ON DELETE SET NULL`, but no behaviour was ever decided: how many areas an item may carry, what an area holds besides a name, what deleting one does, and whether re-assigning a series rewrites its history. These choices are product choices that bound the schema, and the market splits on each — Things trashes an Area's children when the Area is deleted, Todoist and PARA archive instead, OmniFocus users call a single container restrictive and reach for tags. The owner approved the PRD carrying these choices in the authoring session of 2026-10-11. The roadmap's exit signal for unit 13 carries a revert clause ("if he does not [keep using the filter], the unit is reverted and this row becomes `dropped`"), which makes a cheap revert part of the requirement.

## Decision

1. **Zero or one area per item.** A Task and a Recurrence Series each carry at most one `life_area_id`; the series template carries it and each occurrence copies it. No tags, no join table.
2. **An area is a name.** 1–40 characters, trimmed, unique ignoring case and diacritics (checked in the route; the existing bytewise unique index stays as the backstop), at most 12 areas, ordered alphabetically by pt-BR collation. `description` stays in the schema and the export, unexposed. No colour, icon, archive flag or sort order, so **no migration**.
3. **Deleting an area is a real delete and loses nothing.** Its Tasks and series become area-less through the existing foreign key; no Task or series row is deleted. The confirmation repeats the verb and says how many Tasks and series lose the area. There is no archive.
4. **A series' area applies from the open occurrence on.** Editing the series' area updates the template and the open, non-detached occurrence; `done` and `missed` rows keep the area they had. On an occurrence's sheet the area follows *Aplicar a*: *Toda a série* edits the template, *Só esta ocorrência* edits the occurrence alone and detaches it, as any individual edit does (ADR-0006, unchanged).
5. **No stored default.** *Sem área* is the filter value `lifeAreaId=none` and a count row on the *Áreas* screen — neither a record nor a grouping axis on *Hoje*.

## Consequences

- The unit reuses tables, keys, index and export that already exist; reverting it means removing routes and UI, not undoing a migration.
- Re-assigning a series from one area to another leaves its past `done` and `missed` rows under the old area, so one series can appear under two areas in a filtered history. Accepted: the permanent record is not rewritten for a classification.
- Deleting an area cannot be undone inside the app; the weekly snapshot (FR-043) is the recovery path.
- An item that fits two domains must pick one. The tag model is the known answer and is a new feature, not an amendment.
- Reopen triggers: the owner asks for colour (a migration, a categorical palette and a contrast measurement under ADR-0010); archiving or several areas per item; Events or notes taking an area (unit 14 and later).
- Rejected: tags (a join table, a migration and a different filter model); colour now (a migration and an identity change for a unit that may be reverted, and WCAG 1.4.1 requires the name beside any colour anyway); archive (a column, a migration and filtered reads everywhere); cascade delete and blocking deletion while items are assigned (the first destroys items, the second forces a cleanup before a decision); re-stamping every closed row of a series (a bulk write over the permanent record); a stored "Unsorted" area (the domain model already says no default is stored).
