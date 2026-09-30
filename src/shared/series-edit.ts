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

import {
  isCalendarDate,
  type CreateSeriesInput,
  type SeriesDto,
  type TaskDto,
  type TaskPriority,
  type UpdateSeriesInput,
  type UpdateTaskInput,
} from "./api";
import type { ReminderDraft } from "./reminder-edit";
import { buildTaskPatch, type TaskDateMode, type TaskDraft } from "./task-edit";

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
 * The date modes the sheet's Data group offers, in display order. A repeating
 * Task needs a date — `recurrenceDraftError` refuses one without it — so "Sem
 * data" (`none`) is withdrawn once a repetition is chosen rather than offered
 * and then refused (owner-confirmed 2026-09-30). Only the choice is withdrawn:
 * a draft already on `none` keeps it, and the owner picks the mode himself.
 */
export function dateModeChoices(freq: RecurrenceFreq): readonly TaskDateMode[] {
  return freq === "none" ? ["none", "deadline", "scheduled"] : ["deadline", "scheduled"];
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

// ---------------------------------------------------------------------------
// Editing an EXISTING series (PRD D11, amended 2026-09-29).
//
// A rule edit applies from the next spawn: the open occurrence keeps its date.
// That makes `dtstart` frozen — it is the series' origin and the alignment every
// period is computed from — so the day of the cycle can no longer ride on the
// Task's own date the way it does at creation. These controls name the day
// explicitly instead (`byMonthday` / `byWeekday`), which is exactly what the
// expansion function already honours in preference to `dtstart`.
// ---------------------------------------------------------------------------

/** A repeating frequency — "Não repete" has no meaning once a series exists; ending it is its own action. */
export type SeriesFreq = Exclude<RecurrenceFreq, "none">;

/** Every control on the edit surface for an existing series' rule. */
export interface SeriesRuleDraft {
  freq: SeriesFreq;
  /** A string so the number input always has a value; only read when `freq === "monthly"`. */
  dayOfMonth: string;
  /** ISO weekdays (1 = Monday … 7 = Sunday); only read when `freq === "weekly"`. */
  weekdays: number[];
  endOption: RecurrenceEndOption;
  untilDate: string;
  maxCount: string;
}

/**
 * ISO weekday of a `YYYY-MM-DD` day. Computed here rather than imported because
 * `src/shared/recurrence.ts` keeps its own copy private and must stay byte-identical
 * for unit 17 to reuse; three lines of duplication are cheaper than that contract.
 */
function isoWeekdayOf(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  const js = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** `byWeekday` travels as JSON text (the column is text); anything unreadable decodes to "unset". */
function decodeWeekdays(byWeekday: string | null): number[] | null {
  if (byWeekday === null) return null;
  try {
    const parsed: unknown = JSON.parse(byWeekday);
    return Array.isArray(parsed) && parsed.every((d) => typeof d === "number") ? parsed : null;
  } catch {
    return null;
  }
}

/** The day the rule actually fires on, whether it was stored explicitly or derived from `dtstart`. */
function effectiveMonthday(series: SeriesDto): number {
  return series.byMonthday ?? Number(series.dtstart.slice(8, 10));
}

function effectiveWeekdays(series: SeriesDto): number[] {
  const stored = decodeWeekdays(series.byWeekday);
  return stored !== null && stored.length > 0
    ? [...stored].sort((a, b) => a - b)
    : [isoWeekdayOf(series.dtstart)];
}

/**
 * Prefills the edit controls from the stored rule. A series created by the screen
 * never carried `byMonthday`/`byWeekday` — its day lived in `dtstart` — so the
 * effective value is derived the same way the expansion function derives it.
 */
export function seriesRuleDraftFromSeries(series: SeriesDto): SeriesRuleDraft {
  return {
    freq: series.freq,
    dayOfMonth: String(effectiveMonthday(series)),
    weekdays: effectiveWeekdays(series),
    endOption: series.endKind,
    untilDate: series.untilDate ?? "",
    maxCount: series.maxCount === null ? "" : String(series.maxCount),
  };
}

/** Mirrors the route's own PATCH validation, so the owner never submits a body it would 400 on. */
export function seriesRuleDraftError(draft: SeriesRuleDraft): string | null {
  if (draft.freq === "monthly") {
    const day = Number(draft.dayOfMonth);
    if (draft.dayOfMonth.trim() === "" || !Number.isInteger(day) || day < 1 || day > 31) {
      return "Informe um dia do mês entre 1 e 31.";
    }
  }
  if (draft.freq === "weekly" && draft.weekdays.length === 0) {
    return "Escolha ao menos um dia da semana.";
  }
  if (draft.endOption === "until" && !isCalendarDate(draft.untilDate)) {
    return "Escolha uma data válida para o fim da repetição.";
  }
  if (draft.endOption === "count") {
    const count = Number(draft.maxCount);
    if (!Number.isInteger(count) || count < 1) {
      return "Informe quantas vezes a repetição deve ocorrer.";
    }
  }
  return null;
}

function sameWeekdays(a: number[], b: number[]): boolean {
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.length === y.length && x.every((d, i) => d === y[i]);
}

/**
 * The `PATCH /api/series/:id` body for a rule edit, carrying only what changed, or
 * `null` when nothing did. It never emits `dtstart`: the route refuses it by name,
 * and that refusal is what keeps a rule edit a this-and-forward change.
 *
 * Callers only invoke this once `seriesRuleDraftError` returned `null`.
 */
export function buildUpdateSeriesRule(
  series: SeriesDto,
  draft: SeriesRuleDraft,
): UpdateSeriesInput | null {
  const body: UpdateSeriesInput = {};

  if (draft.freq !== series.freq) body.freq = draft.freq;

  // The day control of the chosen frequency is authoritative, and the other
  // frequency's stored day is cleared so a stale value cannot resurface later.
  if (draft.freq === "monthly") {
    const day = Number(draft.dayOfMonth);
    if (day !== effectiveMonthday(series) || series.byWeekday !== null) body.byMonthday = day;
    if (series.byWeekday !== null) body.byWeekday = null;
  } else if (draft.freq === "weekly") {
    if (!sameWeekdays(draft.weekdays, effectiveWeekdays(series)) || draft.freq !== series.freq) {
      body.byWeekday = [...draft.weekdays].sort((a, b) => a - b);
    }
    if (series.byMonthday !== null) body.byMonthday = null;
  } else {
    // Daily and yearly take their day from `dtstart` alone; clear any explicit day.
    if (series.byMonthday !== null) body.byMonthday = null;
    if (series.byWeekday !== null) body.byWeekday = null;
  }

  const untilDate = draft.endOption === "until" ? draft.untilDate : null;
  const maxCount = draft.endOption === "count" ? Number.parseInt(draft.maxCount, 10) : null;
  if (
    draft.endOption !== series.endKind ||
    untilDate !== series.untilDate ||
    maxCount !== series.maxCount
  ) {
    body.endKind = draft.endOption;
    if (draft.endOption === "until") body.untilDate = untilDate;
    if (draft.endOption === "count") body.maxCount = maxCount;
  }

  return Object.keys(body).length === 0 ? null : body;
}

/**
 * The "toda a série" half of editing a series occurrence: the template fields that
 * differ from the series, or `null`. The date is deliberately ignored — a template
 * edit never moves the open occurrence (D11 option (a)); moving one occurrence is
 * an edit to THAT occurrence, which detaches it.
 */
export function buildUpdateSeriesTemplate(
  taskDraft: TaskDraft,
  series: SeriesDto,
): UpdateSeriesInput | null {
  const body: UpdateSeriesInput = {};

  const title = taskDraft.title.trim();
  if (title !== (series.title ?? "")) body.title = title;

  const description = taskDraft.description.trim() === "" ? null : taskDraft.description.trim();
  if (description !== series.description) body.description = description;

  const priority: TaskPriority | null = taskDraft.priority;
  if (priority !== series.priority) body.priority = priority;

  return Object.keys(body).length === 0 ? null : body;
}

/** Where "Aplicar a" sends title, description and priority on a series occurrence. */
export type ApplyTo = "series" | "occurrence";

/** The two requests one save of a series occurrence may need; either can be empty. */
export interface SeriesOccurrenceSavePlan {
  /** `PATCH /api/series/:id` body — rule and/or template — or `null` when the series is untouched. */
  seriesBody: UpdateSeriesInput | null;
  /** `PATCH /api/tasks/:id` body. Any key here detaches the occurrence from its series. */
  taskChanges: UpdateTaskInput;
}

const TEMPLATE_TASK_FIELDS = ["title", "description", "priority"] as const;

/**
 * Splits one save of a series occurrence between the series and the occurrence.
 *
 * The rule always goes to the series and never moves the open occurrence (D11
 * option (a)). A date change is always an edit to THIS occurrence — it is the one
 * field a series cannot own for a single cycle. Title, description and priority
 * follow "Aplicar a": "series" sends them to the template, from which the route
 * propagates them to the open occurrence WITHOUT detaching it; "occurrence" sends
 * them to the occurrence alone, which detaches it.
 *
 * An occurrence that is already detached no longer receives template propagation,
 * so with "series" it also takes the template fields directly — otherwise the
 * owner's edit would reach every future cycle except the one on screen.
 */
export function planSeriesOccurrenceSave(
  task: TaskDto,
  taskDraft: TaskDraft,
  series: SeriesDto,
  ruleDraft: SeriesRuleDraft | null,
  applyTo: ApplyTo,
): SeriesOccurrenceSavePlan {
  const ruleBody = ruleDraft === null ? null : buildUpdateSeriesRule(series, ruleDraft);
  const templateBody = applyTo === "series" ? buildUpdateSeriesTemplate(taskDraft, series) : null;
  const merged: UpdateSeriesInput = { ...(ruleBody ?? {}), ...(templateBody ?? {}) };

  const taskChanges: UpdateTaskInput = { ...buildTaskPatch(task, taskDraft) };
  if (applyTo === "series" && !task.detached) {
    for (const field of TEMPLATE_TASK_FIELDS) delete taskChanges[field];
  }

  return {
    seriesBody: Object.keys(merged).length === 0 ? null : merged,
    taskChanges,
  };
}
