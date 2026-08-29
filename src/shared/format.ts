/**
 * Decidable header and row copy — the pure formatting rules the header and
 * every Task row read from, extracted so they can be tested without a DOM
 * (PRD AC-5, AC-6; ADR-0009 pt-BR copy).
 *
 * Like `src/shared/dates.ts`, this module is compiled into BOTH the browser
 * and the Worker projects, so it stays environment-agnostic: no DOM globals,
 * no runtime dependencies, and no reads of the clock. `now` (formatHeaderDate)
 * and `today` (taskMetaLine) are always ARGUMENTS, never read from the clock
 * internally — that is what keeps every test below deterministic regardless
 * of when or where it runs.
 *
 * Rules encoded here:
 * - `formatRemaining`: zero is special-cased explicitly to "nenhuma restante"
 *   with no figure, never through `Intl.PluralRules` — CLDR maps `0` to the
 *   `one` category for `pt-BR` (verified Node 24 / ICU 78: `select(0) ===
 *   "one"`), so a PluralRules-driven label would wrongly read "0 restante".
 * - `formatDayShort` / `formatHeaderDate`: the pt-BR short weekday from
 *   `Intl.DateTimeFormat(...).formatToParts`, assembled as `<weekday>, <dd>/<mm>`;
 *   the weekday is normalised to end in exactly one `.` because ICU builds
 *   disagree on whether the short form already carries one.
 * - `taskMetaLine`: `missed` always reads "não concluída" (overdue); `done`
 *   always reads nothing; an open Task's date phrase comes from `deadline`
 *   (verb "venceu"/"até") or `scheduledDate` (verb "era para"/"fazer") — at
 *   most one is set by the schema's CHECK — relative to `today`, with `hoje`
 *   / `amanhã` / `ontem` special-cased and every other day going through
 *   `formatDayShort`; `priority: "high"` appends " · alta", `"low"` appends
 *   " · baixa", `"normal"` and `null` append nothing. Day arithmetic (the
 *   `amanhã` / `ontem` check) is done on the `YYYY-MM-DD` strings through
 *   UTC noon (`Date.UTC` + `setUTCDate`), never through local time, so a
 *   month or year boundary never misfires the relative word; before/after
 *   `today` is a plain string comparison, which sorts correctly for
 *   zero-padded ISO dates.
 */

import type { EventMoment, TaskDto } from "./api";
import { PRAESTO_TIMEZONE, todayIn } from "./dates";

/**
 * What the §2.4 time column shows for an all-day event.
 *
 * PENDING OWNER CONFIRMATION (2026-08-29). The owner approved four visible
 * strings for this phase; this fifth one was not among them, and guidelines
 * §9 records the product voice as `TBD — pending owner input`, which its own
 * preamble says is "never a licence to improvise around it". Proposed rather
 * than decided, and named here so it is one edit to change.
 */
const ALL_DAY_LABEL = "dia todo";

/** `day` (`YYYY-MM-DD`) as a `Date` at UTC noon — never local time. */
function toUtcNoon(day: string): Date {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const dayOfMonth = Number(day.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, dayOfMonth, 12));
}

/** `date`'s UTC calendar day as `YYYY-MM-DD`. */
function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

/** A calendar day (`YYYY-MM-DD`) shifted by `delta` days, computed through UTC noon. */
function shiftDay(day: string, delta: number): string {
  const instant = toUtcNoon(day);
  instant.setUTCDate(instant.getUTCDate() + delta);
  return toIsoDate(instant);
}

/**
 * The header count: `0` reads "nenhuma restante" with no figure (never
 * through `Intl.PluralRules` — see the module header), `1` is singular, and
 * every other non-negative integer is plural with the count as a string.
 */
export function formatRemaining(count: number): { figure: string | null; label: string } {
  if (count === 0) return { figure: null, label: "nenhuma restante" };
  if (count === 1) return { figure: "1", label: "restante" };
  return { figure: String(count), label: "restantes" };
}

/**
 * A `YYYY-MM-DD` calendar day as the pt-BR short weekday, a comma, and
 * `dd/mm` — e.g. `sex., 21/08`. The instant is anchored at UTC noon so the
 * result never shifts with the runtime's local timezone, and the weekday is
 * normalised to end in exactly one `.` regardless of what the ICU build
 * emits.
 */
export function formatDayShort(day: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).formatToParts(new Date(`${day}T12:00:00Z`));

  const weekdayRaw = parts.find((part) => part.type === "weekday")?.value ?? "";
  const dd = parts.find((part) => part.type === "day")?.value ?? "";
  const mm = parts.find((part) => part.type === "month")?.value ?? "";
  const weekday = `${weekdayRaw.replace(/\.$/, "")}.`;

  return `${weekday}, ${dd}/${mm}`;
}

/**
 * The header date: `today`'s calendar day at `now` in `timeZone` (default
 * `PRAESTO_TIMEZONE`), short-formatted — e.g.
 * `formatHeaderDate(new Date("2026-08-21T15:00:00Z"))` is `sex., 21/08`.
 */
export function formatHeaderDate(now: Date, timeZone: string = PRAESTO_TIMEZONE): string {
  return formatDayShort(todayIn(now, timeZone));
}

/** `date`'s relative day word against `today`: `hoje`, `amanhã`, `ontem`, or the short weekday. */
function dayWord(date: string, today: string): string {
  if (date === today) return "hoje";
  if (date === shiftDay(today, 1)) return "amanhã";
  if (date === shiftDay(today, -1)) return "ontem";
  return formatDayShort(date);
}

/**
 * The row meta line: `null` for a `done` Task or an open, undated Task with
 * no priority word to show; `{ text: "não concluída", overdue: true }` for a
 * `missed` Task (nothing else appended); otherwise a date phrase built from
 * `deadline` or `scheduledDate` (at most one is set) relative to `today`,
 * with the priority word appended when the Task carries one. See the module
 * header for the full rule set and the day-arithmetic discipline.
 */
export function taskMetaLine(
  task: TaskDto,
  today: string,
): { text: string; overdue: boolean } | null {
  if (task.status === "missed") {
    return { text: "não concluída", overdue: true };
  }
  if (task.status === "done") {
    return null;
  }

  let phrase: { text: string; overdue: boolean } | null = null;
  if (task.deadline !== null) {
    const day = dayWord(task.deadline, today);
    phrase =
      task.deadline < today
        ? { text: `atrasada · venceu ${day}`, overdue: true }
        : { text: `até ${day}`, overdue: false };
  } else if (task.scheduledDate !== null) {
    const day = dayWord(task.scheduledDate, today);
    phrase =
      task.scheduledDate < today
        ? { text: `atrasada · era para ${day}`, overdue: true }
        : { text: `fazer ${day}`, overdue: false };
  }

  const priorityWord = task.priority === "high" ? "alta" : task.priority === "low" ? "baixa" : null;

  if (phrase === null) {
    return priorityWord === null ? null : { text: priorityWord, overdue: false };
  }
  return priorityWord === null
    ? phrase
    : { text: `${phrase.text} · ${priorityWord}`, overdue: phrase.overdue };
}

/**
 * The leading time column of layout standard §2.4.
 *
 * The first formatter in this app that deals with a time of day: a Task
 * carries calendar DAYS (`deadline`/`scheduledDate`, enforced by
 * `tasks_single_date_chk`), never an instant. An event is the first thing here
 * that happens at a time.
 *
 * An all-day event gets a LABEL rather than a blank cell — §2.4 specifies a
 * time column, and an empty cell in a mono, tabular column reads as a
 * rendering bug rather than as "no time".
 */
export function formatEventTime(moment: EventMoment): string {
  if ("date" in moment) return ALL_DAY_LABEL;

  // The owner's fixed zone, never the instant's own offset: the same moment
  // must read the same on the phone and the PC (ADR-0009's single-owner,
  // single-calendar assumption, and `PRAESTO_TIMEZONE`'s whole reason).
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: PRAESTO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(moment.dateTime));
}
