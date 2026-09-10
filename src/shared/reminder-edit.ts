/**
 * The decidable half of editing a Reminder (both shapes: standalone and
 * Task-linked). Mirrors `src/shared/task-edit.ts`'s split — the draft/patch
 * diffing decision lives here, pure and test-first, rather than inside a
 * React component (`docs/context/methodology.md`, "Browser-API work: split
 * the logic out, then the glue is exempt").
 *
 * This module deliberately narrows the same precedence
 * `src/worker/routes/reminders.ts` already enforces server-side — an offset
 * with a Task target, else a finite absolute instant — so the owner never
 * submits a request the route would 400 (PRD AC-2/AC-3 via plan AC-A4).
 *
 * No DOM globals, no runtime dependency: compiles into both targets like
 * every other `src/shared/` module.
 */

import {
  isCalendarDate,
  type CreateReminderInput,
  type ReminderDto,
  type UpdateReminderInput,
} from "./api";
import { instantToLocalParts, localPartsToInstant } from "./dates";

/** Which of the two mutually exclusive time inputs the draft currently uses. */
export type ReminderTimeMode = "absolute" | "offset";

/**
 * The current value of every control on the Reminder edit surface. Every
 * field is required: a form always has a value, even when that value is
 * empty (mirrors `TaskDraft`'s own convention).
 */
export interface ReminderDraft {
  label: string;
  timeMode: ReminderTimeMode;
  absoluteDay: string;
  absoluteTime: string;
  offsetMinutes: number;
}

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** Seeds a fresh draft for create (`reminder === null`), or restores an existing row for edit. */
export function draftFromReminder(reminder: ReminderDto | null): ReminderDraft {
  if (reminder === null) {
    return {
      label: "",
      timeMode: "absolute",
      absoluteDay: "",
      absoluteTime: "",
      offsetMinutes: 60,
    };
  }

  const { day, time } = instantToLocalParts(reminder.fireAt);

  return {
    label: reminder.label ?? "",
    timeMode: reminder.originOffsetMinutes !== null ? "offset" : "absolute",
    absoluteDay: day,
    absoluteTime: time,
    offsetMinutes: reminder.originOffsetMinutes ?? 60,
  };
}

/**
 * Builds the create request for a fresh Reminder — either shape.
 *
 * An offset with no Task target is meaningless, so `originOffsetMinutes` is
 * only ever set when `taskId !== null` AND `timeMode === "offset"`; every
 * other combination resolves to an absolute `fireAt` via
 * `localPartsToInstant`, guarded against a half-typed date/time.
 */
export function buildCreateReminderInput(
  draft: ReminderDraft,
  taskId: string | null,
): CreateReminderInput {
  const input: CreateReminderInput = {};

  const label = draft.label.trim();
  input.label = label === "" ? null : label;

  if (taskId !== null) input.taskId = taskId;

  if (draft.timeMode === "offset" && taskId !== null) {
    input.originOffsetMinutes = draft.offsetMinutes;
    return input;
  }

  if (isCalendarDate(draft.absoluteDay) && TIME_PATTERN.test(draft.absoluteTime)) {
    input.fireAt = localPartsToInstant(draft.absoluteDay, draft.absoluteTime);
  }

  return input;
}

/**
 * The minimal patch that turns `original` into `draft` — only the keys
 * whose value actually changed, the same "only the changed keys" diff
 * contract `buildTaskPatch` established.
 *
 * Moving from offset mode back to an absolute time explicitly clears
 * `originOffsetMinutes` to `null` — an absent key would leave the server's
 * existing offset in place, silently reintroducing offset behaviour the
 * owner just turned off.
 */
export function buildUpdateReminderInput(
  original: ReminderDto,
  draft: ReminderDraft,
): UpdateReminderInput {
  const patch: UpdateReminderInput = {};

  const label = draft.label.trim();
  const nextLabel = label === "" ? null : label;
  if (nextLabel !== original.label) patch.label = nextLabel;

  if (draft.timeMode === "offset") {
    if (draft.offsetMinutes !== original.originOffsetMinutes) {
      patch.originOffsetMinutes = draft.offsetMinutes;
    }
    return patch;
  }

  // Absolute mode: clear a previously-set offset, and emit fireAt only when
  // the resolved instant actually changed.
  if (original.originOffsetMinutes !== null) patch.originOffsetMinutes = null;

  if (isCalendarDate(draft.absoluteDay) && TIME_PATTERN.test(draft.absoluteTime)) {
    const fireAt = localPartsToInstant(draft.absoluteDay, draft.absoluteTime);
    if (fireAt !== original.fireAt) patch.fireAt = fireAt;
  }

  return patch;
}
