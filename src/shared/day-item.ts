/**
 * The projection at the boundary (unit 4 `google-calendar-read`, phase 1).
 *
 * The *Hoje* screen was built for exactly one item type. Rather than teach the
 * partition to understand every future source — or teach every future source
 * to impersonate a Task — each source is mapped ONCE into the narrow shape
 * below, and the partition then runs over that shape as a plain function.
 * Source-specific knowledge lives here and only here.
 *
 * The two bucketing rules a `DayItem` carries are not new: they are lifted
 * verbatim out of what `groupTasks` used to compute inline —
 *
 *   - `closed` is read BEFORE any date, so a `done` Task with an overdue
 *     deadline is closed, never overdue;
 *   - `dueDate` is `deadline ?? scheduledDate` (at most one is ever set).
 *
 * Like `task-groups.ts`, `format.ts` and `dates.ts`, this module compiles into
 * BOTH the browser and the Worker projects, so it stays environment-agnostic:
 * no DOM globals, no runtime dependencies, and no reads of the clock. It never
 * receives `today` at all — comparing against a day is the partition's job.
 */

import type { CalendarEventDto, TaskDto } from "./api";
import { PRAESTO_TIMEZONE, todayIn } from "./dates";

/**
 * Where a day item came from. Adding a member here is deliberately expensive:
 * every `switch` over it that lacks the new case stops compiling, which is the
 * point — unit 14's local Events must not be able to arrive silently.
 */
export type DaySource = "task" | "google";

/** The fields the partition reads. Every variant carries exactly these three. */
interface DayItemBase {
  /** The underlying record's own id — identity survives the projection. */
  id: string;
  /** The local day this item belongs to, `YYYY-MM-DD`, or `null` when undated. */
  dueDate: string | null;
  /** Read before the dates: a closed item never lands in a dated bucket. */
  closed: boolean;
}

/** A Task, projected. The whole `TaskDto` stays reachable rather than copied. */
export interface TaskDayItem extends DayItemBase {
  source: "task";
  task: TaskDto;
}

/**
 * An external calendar event, projected.
 *
 * `payload` was `unknown` through phases 1 and 2 — a placeholder for a type
 * that did not exist yet. Phase 3 defines `CalendarEventDto`, so the
 * placeholder is spent. It is still NOT an Event entity: nothing is persisted
 * and no table exists (ADR-0007 puts the entity in unit 14); this is a
 * view-model shape for something Google owns.
 */
export interface ExternalDayItem extends DayItemBase {
  source: "google";
  payload: CalendarEventDto;
}

export type DayItem = TaskDayItem | ExternalDayItem;

/**
 * Projects a Task into the shape the partition reads, deriving every field
 * from `TaskDto` rather than restating it — the whole record rides along as
 * `task`, so there is never a second truth about the same Task.
 */
export function dayItemFromTask(task: TaskDto): TaskDayItem {
  return {
    source: "task",
    id: task.id,
    dueDate: task.deadline ?? task.scheduledDate,
    closed: task.status !== "open",
    task,
  };
}

/**
 * The TypeScript handbook's `never`-assertion idiom. Its real work happens at
 * compile time: a `switch` whose default reaches this stops compiling the
 * moment `DaySource` gains a member the switch does not handle. The throw is
 * the runtime half — a branch that should be unreachable must be loud rather
 * than silently return `undefined`.
 */
export function assertNeverDaySource(value: never): never {
  throw new Error(`Unhandled day item source: ${String(value)}`);
}

/**
 * Projects a calendar event into the shape the partition reads.
 *
 * Two rules carry the weight:
 *
 *  - `closed` is always `false`. An Event has NO completion state — it occurs
 *    or is cancelled, never "done" (`docs/domain/areas/events.md`). A `true`
 *    here would file the owner's commitments under *Concluídas*.
 *  - `dueDate` is the event's LOCAL day. For an all-day event that is the date
 *    Google gave, used verbatim: it carries no zone, and passing it through a
 *    conversion is exactly how such events land a day off. For a timed event
 *    it is the instant's day in the owner's fixed zone — 22:00 in São Paulo is
 *    01:00 UTC tomorrow, so deriving it from the UTC date would push every
 *    late commitment to the following day.
 */
export function dayItemFromEvent(event: CalendarEventDto): ExternalDayItem {
  const dueDate =
    "date" in event.start
      ? event.start.date
      : todayIn(new Date(event.start.dateTime), PRAESTO_TIMEZONE);

  return {
    source: "google",
    id: event.id,
    dueDate,
    closed: false,
    payload: event,
  };
}
