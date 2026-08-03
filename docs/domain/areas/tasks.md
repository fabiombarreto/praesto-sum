# Tasks

**Primary responsibility:** everything the owner intends to do — capture, organize, complete. The MVP (Phase 1) scope.

**Entities:** Task (see `docs/domain/glossary.md`); relates to Life Area, Event (N:N), Reminder.

## Business rules (owner-validated 2026-08-03)

- A Task has a completion lifecycle `open → done`, and completion is undoable (FR-003).
- A Task may carry a **deadline** (complete *by* a date) OR a **scheduled date** (do *on* a date) — distinct semantics, never conflated (FR-005).
- Tasks never convert into Events; a Task may be linked to any number of Events and vice versa, navigable from both sides (FR-010, Phase 2).
- Tasks can recur (FR-009, Phase 1); the recurrence model (rules, exceptions, end conditions) is shared with Events and designed during Phase 1.
- Tasks are listable and filterable by completion status, dates and priority (FR-007); priority is optional (FR-006, unscheduled).
- A Task may belong to a Life Area (FR-008, unscheduled).
- Capture must be near-zero friction on any device (FR-045 — vision principle 5).

## Phase 1 FR set

FR-001..005, FR-007, FR-009 + cross-cutting FR-040/041/042/044/045. Exit criterion: the owner manages daily Tasks in the assistant instead of scattered notes.

## Relationships

- **Reminders** may point to a Task (deadline nudges).
- **Events** relate via N:N links (Phase 2).
- **Life Areas** group Tasks.

## Resolved 2026-08-03

- Lifecycle is `open → done` only in the MVP; deletion covers abandonment.
- A dated Task (deadline or scheduled) DOES appear on calendar views, visually distinct from Events.
- Life Area is optional; area-less Tasks surface in an implicit "Unsorted" grouping (no stored default).

## Open Questions

- Recurrence model — under research (owner proposed single-record template + occurrence-log entity); resolution lands as ADR-0006.
