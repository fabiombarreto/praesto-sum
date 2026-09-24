/**
 * The decidable half of converting a one-off Task into a Recurrence Series
 * (PRD AC-26, plan AC-A1). Mirrors `src/shared/task-edit.ts`'s split — the
 * draft-to-wire-body decision lives here, pure and test-first, rather than
 * inside a React component (`docs/context/methodology.md`, "Browser-API
 * work: split the logic out, then the glue is exempt").
 *
 * This module deliberately narrows the same validation order
 * `src/worker/routes/series.ts` already enforces server-side (dtstart
 * before the end condition), so the owner never submits a body the route
 * would 400 on.
 *
 * No DOM globals and no runtime dependencies: this module compiles into
 * both the browser bundle and the Worker.
 */

import { isCalendarDate, type CreateSeriesInput } from "./api";
import type { ReminderDraft } from "./reminder-edit";
import type { TaskDraft } from "./task-edit";

/** The frequency choices the "Repetir" chip group offers, plus "none" for "does not repeat". */
export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly" | "yearly";

/** The end-condition choices the "Até quando?" chip group offers. */
export type RecurrenceEndOption = "never" | "until" | "count";

/**
 * The current value of every control on the Repetir editing surface. Every
 * field is required and string-typed for the two end-condition inputs —
 * a form always has a value, even when that value is empty — mirroring
 * `TaskDraft`'s own convention.
 */
export interface RecurrenceDraft {
  freq: RecurrenceFreq;
  endOption: RecurrenceEndOption;
  /** `YYYY-MM-DD`, or `""` when not yet chosen. Only read when `endOption === "until"`. */
  untilDate: string;
  /** A string so the native number input always has a value; only read when `endOption === "count"`. */
  maxCount: string;
}

/** The seed before the owner picks anything: "Não repete", no end condition. */
export const EMPTY_RECURRENCE_DRAFT: RecurrenceDraft = {
  freq: "none",
  endOption: "never",
  untilDate: "",
  maxCount: "",
};

/**
 * Validates the recurrence choice against the Task draft it will be built
 * from, mirroring `src/worker/routes/series.ts:93-132`'s own order: the
 * Task's date first, then the chosen end condition. Returns `null` when
 * everything required is present and well-formed, or a pt-BR message
 * otherwise (never an exact wording pinned by a test — the plan pins WHEN
 * this fires, not its literal copy).
 *
 * `freq: "none"` ("Não repete") needs no validation at all: nothing will be
 * submitted, so a half-filled end condition left over from a prior choice
 * must never block saving the plain Task edit.
 */
export function recurrenceDraftError(
  taskDraft: TaskDraft,
  recurrence: RecurrenceDraft,
): string | null {
  if (recurrence.freq === "none") return null;

  if (taskDraft.dateMode === "none" || !isCalendarDate(taskDraft.date)) {
    return "Escolha uma data para a Tarefa antes de repetir.";
  }

  if (recurrence.endOption === "until") {
    if (!isCalendarDate(recurrence.untilDate)) {
      return "Escolha uma data válida para o fim da repetição.";
    }
  } else if (recurrence.endOption === "count") {
    const count = Number(recurrence.maxCount);
    if (!Number.isInteger(count) || count < 1) {
      return "Informe quantas vezes a repetição deve ocorrer.";
    }
  }

  return null;
}

/**
 * Whether the sheet's existing Reminder (if any) will be carried into the
 * series template by `buildCreateSeriesInput` below. `false` covers both
 * "no existing Reminder" and "an absolute-time Reminder" — the latter has
 * one fixed instant with no offset to repeat, so it is never silently
 * carried over. The UI uses this to decide whether to show the drop notice.
 */
export function reminderWillCarryOver(reminderDraft: ReminderDraft | null): boolean {
  return reminderDraft !== null && reminderDraft.timeMode === "offset";
}

/** `taskDraft.dateMode`, narrowed to the two values `CreateSeriesInput.dateMode` accepts. */
function resolvedDateMode(taskDraft: TaskDraft): "deadline" | "scheduled" {
  return taskDraft.dateMode === "scheduled" ? "scheduled" : "deadline";
}

/**
 * Assembles `POST /api/series`'s body from the sheet's existing Task draft,
 * the chosen recurrence rule and whatever ad-hoc Reminder the Task already
 * carries.
 *
 * Callers only invoke this once `recurrenceDraftError` has returned `null`
 * for the same two drafts, so `recurrence.freq` is never `"none"` here in
 * practice.
 *
 * `byMonthday`/`byWeekday` are omitted entirely — never set to `null`, not
 * even implicitly — because the server derives them from `dtstart`
 * (`src/shared/recurrence.ts:164-168,196-223`), and this screen never asks
 * for a separate day-of-month or weekday picker.
 */
export function buildCreateSeriesInput(
  taskDraft: TaskDraft,
  recurrence: RecurrenceDraft,
  reminderDraft: ReminderDraft | null,
  timezone: string,
): CreateSeriesInput {
  const input: CreateSeriesInput = {
    title: taskDraft.title.trim(),
    freq: recurrence.freq === "none" ? "daily" : recurrence.freq,
    dtstart: taskDraft.date,
    dateMode: resolvedDateMode(taskDraft),
    priority: taskDraft.priority,
    timezone,
    endKind: recurrence.endOption,
    reminderOffsets: reminderWillCarryOver(reminderDraft)
      ? [(reminderDraft as ReminderDraft).offsetMinutes]
      : null,
  };

  if (recurrence.endOption === "until") {
    input.untilDate = recurrence.untilDate;
  } else if (recurrence.endOption === "count") {
    input.maxCount = Number.parseInt(recurrence.maxCount, 10);
  }

  return input;
}
