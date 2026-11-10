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
 * Unit 14 `events-and-day-view` (phase 3) adds the third source, the local Event
 * (`LocalDayItem`), by exactly that route: one more variant and one more
 * projection, with the partition and the range function unchanged in shape.
 *
 * Like `task-groups.ts`, `format.ts` and `dates.ts`, this module compiles into
 * BOTH the browser and the Worker projects, so it stays environment-agnostic:
 * no DOM globals, no runtime dependencies, and no reads of the clock. It never
 * receives `today` at all — comparing against a day is the partition's job.
 */

import type { CalendarEventDto, EventDto, TaskDto } from "./api";
import { PRAESTO_TIMEZONE, todayIn } from "./dates";

/**
 * Where a day item came from. Adding a member here is deliberately expensive:
 * every `switch` over it that lacks the new case stops compiling, which is the
 * point — a new source must not be able to arrive silently. Unit 14's `local`
 * Events arrived exactly that way.
 */
export type DaySource = "task" | "google" | "local";

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

/**
 * A local Event (*Compromisso*), projected. The whole `EventDto` rides along as
 * `event` rather than being copied field by field, so there is never a second
 * truth about the same Event. Its instants are epoch SECONDS, where the Google
 * payload's are milliseconds, and two functions read them, each doing only what
 * it says: `dayItemFromLocalEvent` scales the start to milliseconds for its own
 * `dueDate` (the start day, which the partition reads), and `dayItemPlacement`
 * in `day-range.ts` is the single place that turns an item into the range
 * function's comparable milliseconds and covered days. The two agree on the
 * start's day because they apply the same owner-zone rule to the same instant.
 */
export interface LocalDayItem extends DayItemBase {
  source: "local";
  event: EventDto;
}

export type DayItem = TaskDayItem | ExternalDayItem | LocalDayItem;

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

/**
 * Projects a local Event into the shape the partition reads — the same two
 * rules as `dayItemFromEvent`, for the same reasons:
 *
 *  - `closed` is always `false`: an Event occurs or is cancelled, never "done".
 *  - `dueDate` is the Event's day in the OWNER's zone. An all-day Event's
 *    `startDate` is used verbatim (it carries no zone, and a conversion is how
 *    such an Event lands a day off). A timed Event's `startAt` is epoch
 *    SECONDS, so it is scaled to milliseconds before the zone conversion; the
 *    Event's own `timezone` never moves it to another day (plan decision D3-1).
 *
 * `null` only when the DTO lacks the start its kind needs. The schema CHECK
 * makes that unreachable from the database; the type allows it, and an
 * invented day would be worse than none.
 */
export function dayItemFromLocalEvent(event: EventDto): LocalDayItem {
  let dueDate: string | null = null;
  if (event.allDay) {
    dueDate = event.startDate;
  } else if (event.startAt !== null) {
    dueDate = todayIn(new Date(event.startAt * 1000), PRAESTO_TIMEZONE);
  }

  return {
    source: "local",
    id: event.id,
    dueDate,
    closed: false,
    event,
  };
}
