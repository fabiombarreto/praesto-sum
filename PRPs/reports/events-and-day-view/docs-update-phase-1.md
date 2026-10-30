# Docs Update — events-and-day-view

**PR:** n/a — implement-time sync of phase 1 (diff read from `PRPs/reports/events-and-day-view/phase-1/attempts/1/diff.patch`); nothing is merged yet
**Merged at:** n/a (not merged; sync dated 2026-10-19)
**Source PRD:** PRPs/prds/events-and-day-view.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

**Scope of this sync:** phase 1 of 5 (pure core and migration). The patch adds `src/shared/events.ts`, `src/shared/event-hash.ts`, the `events` and `event_sync_links` tables in `src/worker/db/schema.ts`, the CREATE-only migration `0007_brown_mac_gargan.sql` (with its snapshot and journal entry), the classification of both tables in `src/worker/db/export-manifest.ts`, and the table reset in `test/isolation.ts`. There is no route, DTO, screen, dump or `.ics` change yet, so none is documented. The PRD schedules the rest of the documentation sync for phase 5 (AC-34).

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive (two hunks)
**Rationale:** (1) The `src/shared/` row of the repository-layout table named neither new module; it now describes `events.ts` (limits, first-failure validator, time resolution, exclusive all-day end, `eventCapabilities`, `wallClockToInstant` and why it is deliberately not `localPartsToInstant`) and `event-hash.ts` (`computeEventContentHash`, seven fields, `v1` prefix, dirty is `content_hash <> synced_content_hash`), each traceable to the module headers and exports in the patch. (2) The "Current implementation state" paragraph ended with "Events and their exceptions are Phase 2 and absent from the schema by design", which the schema and migration `0007` in the patch make false for `events`; the sentence now states what exists (both tables, the named CHECKs, the unique indexes, `ON DELETE SET NULL`, the export classification, the reset helper), that nothing uses the tables yet, and what stays absent by design (`event_exceptions`, `task_events`, `reminders.event_id`). `documentation/30-architecture/domain-model.md`, `ADR-0016` and `docs/domain/areas/events.md` already agree with the text (verified, see below); no `documentation/` conflict.

---

### `docs/context/testing.md`

**Change type:** additive (two narrow amendments)
**Rationale:** `vitest.config.ts` (staged with the test suite, outside the implementer's patch; the PRD's TDD routing states "AC-8 is an inspection test in the Node-side `docs` project") adds `test/event-migration-additive.test.ts` to the Node-side `docs` project, which the testing contract described as a "single file". The row now lists the project's four files (two of them predate this phase and were already missing from the row; listing only the new one would have left the row false) and the sentence "it only reads Markdown" now says it reads files off disk (Markdown, sources and `migrations/`). `npx vitest run --project docs` ran green afterwards: 4 files, 102 tests.

---

### `CLAUDE.md`

**Change type:** additive (one narrow amendment)
**Rationale:** The unit 14 sentence said "five phases all `pending`, nothing built". With phase 1 implemented in the worktree that is false the moment the branch merges. It now says phase 1 (the pure core and migration `0007`) is implemented on the unit's feature branch, not yet merged or deployed, and phases 2–5 are `pending`, following the wording the same paragraph already uses for unit 12. Status words are deliberately "implemented", not "complete" or "shipped": the PRD phase table and the roadmap are owned elsewhere (see Deferred Questions).

---

## Candidate Decisions (for operator review)

The following were observed in the patch or the PRD but are inferred or not stated as a decision, so they were NOT written to `docs/decisions.md`, `docs/anti-patterns.md` or `docs/context/conventions.md` per the PRESERVE-ENTIRELY rule. Review and add manually if stable:

- **Non-blank CHECK idiom for text columns.** `events_title_not_empty` uses `length(trim(title, char(32, 9, 10, 13))) > 0`; the schema comment says plain `trim()` strips only spaces, so a tab-only or newline-only title would pass it. The shipped `tasks_title_not_empty` and `life_areas_name_not_empty` use plain `trim()` (visible in the 0007 snapshot). Candidate convention: new non-blank CHECKs use the four-character form. Candidate observation: the older two constraints are weaker, and tightening them would be a table rewrite, so it should be an owner decision, not a drive-by.
- **Two wall-clock-to-instant functions with different DST-gap semantics.** `wallClockToInstant` (`src/shared/events.ts`, RFC 5545: overlap to the first occurrence, gap uses the offset before it) coexists with `localPartsToInstant` (`src/shared/dates.ts`, lands on the offset after a gap, used by Reminders through `reminder-edit.ts`). The PRD anticipated this ("adds a new function in `src/shared/events.ts` rather than altering an export that Reminders already use"). Candidate decision: they must not be unified without re-examining Reminders. ADR-0016 covers the RFC 5545 rule itself (D-P) but not this coexistence.
- **Schema type names for Event.** The patch names the inferred types `EventRow`/`NewEventRow` (and `EventSyncLink`/`NewEventSyncLink`) because `Event` would shadow the DOM global. Candidate convention for `docs/context/conventions.md`; its authoritative source is `documentation/40-engineering/engineering-conventions.md`, which this agent does not write, so the two would need to be updated together by the operator.
- **A Web API global inside `src/shared/`.** `event-hash.ts` uses `crypto.subtle` and `TextEncoder`; its header justifies this ("exist in the browser, in workerd and in Node alike"). `docs/context/architecture.md` says `src/shared/` "carries no DOM/Worker globals and no runtime dependencies". The module is import-free, so the dependency half holds; whether the globals half needs a clarifying clause ("web-standard globals present in every target are allowed") is the operator's call.
- **Length constants and default duration** (title 200, description 5000, location 200, default duration 3600 s) are arbitrary and already listed as a PRD Open Question; recorded in `architecture.md` as facts, not promoted to decisions.

## Deferred Questions

- `PRPs/prds/events-and-day-view.prd.md` (phase table, `in-progress`) and `documentation/50-planning/roadmap.md` (Now line and unit 14 row: "five phases all `pending`") were not touched, per the orchestrator's instruction, yet `CLAUDE.md` and `docs/context/architecture.md` now say phase 1 is implemented. Should the roadmap be aligned now? — suggested default: no; update the roadmap's Now line and Delivery history together with the PRD phase status when phase 1 is merged, as earlier units did.
- `docs/context/architecture.md` still carries a pre-existing sentence, "Not built yet: export (FR-042)", although the export shipped with unit 5 `data-export` (and `src/worker/db/export-manifest.ts` is part of this very patch's context). It sits two sentences before the text edited here and was left untouched because no hunk of this patch requires changing it. Should it be corrected? — suggested default: yes, in a separate docs-only commit, after confirming against `documentation/50-planning/roadmap.md`.
- `docs/KNOWLEDGE_BASE.md` describes `docs/decisions.md` as covering "ADR-0001..0012"; the file now indexes through ADR-0016 (the ADR-0016 entry was added on 2026-10-19). No new `docs/` file was added by this phase, so the index-update rule did not trigger. Should the range be refreshed now? — suggested default: refresh it in the phase 5 documentation sync (AC-34), together with any new `docs/` entries.

## Files Scanned — No Edit Required

- `docs/decisions.md` — the ADR-0016 entry (2026-10-19) is present, cites an existing source path, and matches the patch: instants plus a never-null zone, exclusive all-day end, hash on the row, `event_id` nullable with `ON DELETE SET NULL`, unique (`calendar_id`, `external_event_id`), `source` of `local` or `google`. No edit and no new entry; the candidates above are not stated decisions.
- `docs/anti-patterns.md` — no forbidden pattern is stated by the patch. The existing entries it touches (dirty flag from `updated_at`, tombstone tables, field-level merge) are consistent with the schema: there is no tombstone table, and `updated_at` is documented in the schema comment as never the dirty flag.
- `docs/domain/areas/events.md` — its "Storage model (ADR-0016, 2026-10-19)" section already agrees with the migration and the pure core (verified field by field); no edit.
- `docs/domain/glossary.md` — still lists Event only; the pt-BR term *Compromisso* is scheduled for phase 5 (AC-34) and phase 1 introduces no owner-facing vocabulary.
- `docs/api-reference.md` — phase 1 adds no route; `/api/events` is documented in phase 2.
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file; see the last Deferred Question.
- `docs/architecture.md`, `docs/context/conventions.md`, `docs/context/constraints.md`, `docs/context/methodology.md` — read; nothing in the patch contradicts or extends them beyond the candidates above.
- `documentation/` — read-only for this agent. `domain-model.md` (Event section) and `ADR-0016` are already in place and consistent with the patch; `architecture-overview.md` carries no schema-state statement about Events; the layout-standard, glossary-adjacent and roadmap amendments belong to later phases.
- `migrations/` (`0007_brown_mac_gargan.sql`, `meta/0007_snapshot.json`, `meta/_journal.json`), `test/*` and `PRPs/` artifacts — generated or test files; not documentation targets.

---
*Generated: 2026-10-19*
*Approved: 2026-10-19*
*Status: APPROVED*
