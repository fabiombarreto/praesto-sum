/**
 * The client half of the frozen Task read contract (unit 2, 2026-08-15):
 * `groupTasks` PARTITIONS the array the API already ordered into the buckets
 * layout standard §2.5 specifies. It never sorts — the ordering is produced
 * by the API and is its guarantee to keep (`docs/api-reference.md`), so
 * re-deriving it here would put the one thing every consumer must agree on
 * in the one place they cannot share.
 *
 * Since unit 4 phase 1 the partition itself lives in `day-groups.ts`, which
 * works over any number of sources of any kind; this module is its
 * Task-shaped façade. The exported signature and the `TaskGroups` shape are
 * deliberately unchanged, so every existing consumer — and the
 * characterization suite in `test/task-groups.test.ts` — sees exactly what it
 * saw before. The bucketing rules moved to `dayItemFromTask`, verbatim: status
 * before dates, and `deadline ?? scheduledDate` as the due day.
 *
 * Like `src/shared/format.ts` and `src/shared/dates.ts`, this module is
 * compiled into BOTH the browser and the Worker projects, so it stays
 * environment-agnostic: no DOM globals, no runtime dependencies, and no
 * reads of the clock. `today` is always an ARGUMENT, never read from the
 * clock internally — that is what keeps every test deterministic regardless
 * of when or where it runs.
 */

import type { TaskDto } from "./api";
import { collectDayItems, type DayItemGroups } from "./day-groups";
import { dayItemFromTask } from "./day-item";

/** The five buckets a Task can belong to. Keys are English; the pt-BR group names live in `TaskGroup`. */
export interface TaskGroups {
  overdue: TaskDto[];
  today: TaskDto[];
  upcoming: TaskDto[];
  undated: TaskDto[];
  closed: TaskDto[];
}

/**
 * Unwraps one bucket back to the Tasks it was built from. Safe by
 * construction: this module only ever feeds `collectDayItems` a single source
 * of Task-projected items, so no other variant can appear. The filter is the
 * type-level proof of that rather than a runtime guard.
 */
function unwrap(bucket: DayItemGroups[keyof DayItemGroups]): TaskDto[] {
  return bucket.filter((item) => item.source === "task").map((item) => item.task);
}

/**
 * Partitions `tasks` into the five buckets above, pushing each Task into
 * exactly one array in the order it was encountered — never sorted, never
 * reversed, so the concatenation `[...overdue, ...today, ...upcoming,
 * ...undated]` reproduces the input's open Tasks in exactly the same relative
 * order the API returned them in. With one source, `collectDayItems`'s merge
 * is the identity, which is what preserves that property here.
 *
 * Status is read BEFORE the dates, mirroring `taskMetaLine`: any Task whose
 * `status !== "open"` lands in `closed` regardless of its dates, so a `done`
 * Task with an overdue deadline never reappears under `overdue`. An open
 * Task's bucket then follows `deadline ?? scheduledDate` (at most one is
 * set) compared against `today` as `YYYY-MM-DD` strings — zero-padded, so
 * lexicographic order is chronological order — mirroring the server's own
 * `urgencyBucket` CASE (`src/worker/routes/tasks.ts`): undated last, then
 * `< today` (overdue), `= today`, `> today` (upcoming).
 */
export function groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups {
  const groups = collectDayItems([{ id: "tasks", items: tasks.map(dayItemFromTask) }], today);

  return {
    overdue: unwrap(groups.overdue),
    today: unwrap(groups.today),
    upcoming: unwrap(groups.upcoming),
    undated: unwrap(groups.undated),
    closed: unwrap(groups.closed),
  };
}
