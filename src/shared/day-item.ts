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

import type { TaskDto } from "./api";

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
 * Phase 1 constructs none of these — the variant exists so the union has a
 * second member and every `switch` is forced to be exhaustive from the day the
 * seam opens rather than the day it is used. `payload` is deliberately
 * `unknown`: this phase persists nothing and defines no Event entity (ADR-0007
 * puts that in unit 14), so giving it a shape now would be inventing the
 * entity early under a different name.
 */
export interface ExternalDayItem extends DayItemBase {
  source: "google";
  payload: unknown;
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
