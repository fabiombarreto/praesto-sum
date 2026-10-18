/**
 * The decidable half of editing a Task.
 *
 * `PATCH /api/tasks/:id` distinguishes an omitted key ("leave this alone") from
 * an explicit `null` ("clear this"). A form, by contrast, always holds a value
 * for every control — so something has to diff the draft against the original
 * and decide which keys the request should carry. That decision is the subtlest
 * rule in this unit, so it lives here, pure and tested, rather than inside a
 * React component where this project has no way to test it
 * (`docs/context/methodology.md`, "Browser-API work: split the logic out, then
 * the glue is exempt").
 *
 * No DOM globals and no runtime dependencies: this module compiles into both
 * the browser bundle and the Worker.
 */

import { isCalendarDate, type TaskDto, type TaskPriority, type UpdateTaskInput } from "./api";

/** Which of the two mutually exclusive dates a Task carries, if either. */
export type TaskDateMode = "none" | "deadline" | "scheduled";

/**
 * The current value of every control on the edit surface. The five members
 * below are required: a form always has a value, even when that value is empty.
 * The sixth, `lifeAreaId`, is the one optional member and is documented there.
 */
export interface TaskDraft {
  title: string;
  description: string;
  dateMode: TaskDateMode;
  date: string;
  priority: TaskPriority | null;
  /**
   * The Life Area the owner has CHOSEN in this edit session. Absent means he has
   * not touched the control, so nothing is sent and nothing is overwritten;
   * `null` is an explicit *Sem área*; a string is an area id.
   *
   * Deliberately not seeded by `draftFromTask`: a kept draft must never re-send an
   * area id that changed or vanished on the server since the sheet first opened,
   * and an unchosen area must never detach an occurrence (ADR-0006). Read the
   * effective value through `effectiveLifeAreaId`.
   */
  lifeAreaId?: string | null;
}

export function dateModeOf(task: TaskDto): TaskDateMode {
  if (task.deadline !== null) return "deadline";
  if (task.scheduledDate !== null) return "scheduled";
  return "none";
}

/**
 * The minimal patch that turns `original` into `draft` — only the keys whose
 * value actually changed.
 *
 * An empty result means "nothing to save": the caller must skip the request
 * entirely, because the route rejects an empty body with 400 by design.
 *
 * The result never carries both dates. Setting one clears the other server-side
 * in the same statement, and sending both is a 400.
 */
export function buildTaskPatch(original: TaskDto, draft: TaskDraft): UpdateTaskInput {
  const patch: UpdateTaskInput = {};

  const title = draft.title.trim();
  // An empty title is a 400 and so is an empty body; the owner should meet
  // neither. Emitting nothing lets the caller abandon the edit silently.
  if (title !== "" && title !== original.title) patch.title = title;

  const description = draft.description.trim();
  const nextDescription = description === "" ? null : description;
  if (nextDescription !== original.description) patch.description = nextDescription;

  if (draft.priority !== original.priority) patch.priority = draft.priority;

  // Emitted only when the owner chose a value that differs from the Task's own
  // (set, change, or clear with `null`): an unchanged area is never sent, because
  // any key on this PATCH detaches an occurrence from its series (ADR-0006).
  if (draft.lifeAreaId !== undefined && draft.lifeAreaId !== original.lifeAreaId) {
    patch.lifeAreaId = draft.lifeAreaId;
  }

  applyDate(patch, original, draft);

  return patch;
}

/**
 * The area the sheet shows as selected and a conversion to a series must carry:
 * the Task's own when the draft holds no choice, the draft's otherwise (`null`
 * being an explicit *Sem área*).
 */
export function effectiveLifeAreaId(
  draft: Pick<TaskDraft, "lifeAreaId">,
  task: Pick<TaskDto, "lifeAreaId">,
): string | null {
  return draft.lifeAreaId === undefined ? task.lifeAreaId : draft.lifeAreaId;
}

/**
 * Resolves the date half of the patch, emitting at most ONE of the two keys.
 *
 * Split out because it is the only branch here with more than two outcomes, and
 * because keeping it separate makes the "never both" invariant visible: there is
 * exactly one assignment per mode, and no path assigns twice.
 */
function applyDate(patch: UpdateTaskInput, original: TaskDto, draft: TaskDraft): void {
  if (draft.dateMode === "none") {
    // Clear whichever date the Task actually carried — and nothing when it
    // carried neither, so an undated Task staying undated sends no key.
    if (original.deadline !== null) patch.deadline = null;
    else if (original.scheduledDate !== null) patch.scheduledDate = null;
    return;
  }

  // A half-typed or impossible date is not an instruction to clear: it is an
  // edit in progress. Reject it locally rather than waiting for the route's 400.
  if (!isCalendarDate(draft.date)) return;

  if (draft.dateMode === "deadline") {
    if (draft.date !== original.deadline) patch.deadline = draft.date;
    return;
  }

  if (draft.date !== original.scheduledDate) patch.scheduledDate = draft.date;
}
