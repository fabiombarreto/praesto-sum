# Tasks

**Primary responsibility:** everything the owner intends to do — capture, organize, complete. The MVP (Phase 1) scope.

**Entities:** Task (see `docs/domain/glossary.md`); relates to Life Area, Event (N:N), Reminder.

## Business rules (owner-validated 2026-08-03)

- A Task has a completion lifecycle `open → done`, and completion is undoable (FR-003).
- A Task may carry a **deadline** (complete *by* a date) OR a **scheduled date** (do *on* a date) — distinct semantics, never conflated (FR-005).
- Tasks never convert into Events; a Task may be linked to any number of Events and vice versa, navigable from both sides (FR-010, Phase 2).
- Tasks can recur (FR-009, Phase 1) per ADR-0006: a **Recurrence Series** holds the shared rule + template; each occurrence is a real Task row; **at most one open occurrence per active series** (unique index); completing spawns the next (calendar- or completion-anchored per series).
- An occurrence superseded without completion becomes **`missed`** (terminal, system-written) — every skipped cycle leaves a permanent record. Done + missed rows are the realization history powering adherence visibility (FR-011) and repeated-miss notifications (FR-012) — the honest-mirror principle (vision principle 6).
- A Task can be edited after capture (FR-002, shipped in unit 2): `PATCH /api/tasks/:id` covers title, description, the two dates and priority. An omitted key leaves the field unchanged; an explicit `null` clears it. Setting one date clears the other, and editing a recurrence occurrence sets `detached` (ADR-0006).
- Tasks are listable and filterable by completion status, dates and priority (FR-007). Priority is optional (FR-006, unit 2 `task-detail-and-dates`): exactly three values, `high | normal | low`, enforced by a TypeScript union AND the `tasks_priority_chk` CHECK. `NULL` means "not set" and sorts as `normal`. As of unit 3 `today-view-and-filters` phase 1 (2026-08-23), the FR-007 filters are enforced in SQL by the list route's `WHERE` clause beside the frozen urgency ordering (`src/worker/routes/tasks.ts`): `from`/`to` compare against `coalesce(deadline, scheduledDate)`, so a Task with neither date falls outside every range, and `priority=normal` also matches the `NULL` case above.
- A Task may belong to a Life Area (FR-008, unscheduled).
- Capture must be near-zero friction on any device (FR-045 — vision principle 5).

## Phase 1 FR set

FR-001..005, FR-007, FR-009, FR-011, FR-012 + cross-cutting FR-040/041/042/044/045. Exit criterion: the owner manages daily Tasks in the assistant instead of scattered notes.

## Relationships

- **Reminders** may point to a Task (deadline nudges).
- **Events** relate via N:N links (Phase 2).
- **Life Areas** group Tasks.

## Resolved 2026-08-03

- Lifecycle is `open → done` only in the MVP; deletion covers abandonment.
- A dated Task (deadline or scheduled) DOES appear on calendar views, visually distinct from Events.
- Life Area is optional; area-less Tasks surface in an implicit "Unsorted" grouping (no stored default).

## Open Questions

- None — the recurrence model was resolved by `documentation/60-decisions/ADR-0006-recurrence-model.md` (2026-08-03).
