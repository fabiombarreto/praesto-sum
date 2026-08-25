/**
 * The client half of the frozen Task read contract (unit 2, 2026-08-15):
 * `groupTasks` PARTITIONS the array the API already ordered into the buckets
 * layout standard §2.5 specifies. It never sorts — the ordering is produced
 * by the API and is its guarantee to keep (`docs/api-reference.md`), so
 * re-deriving it here would put the one thing every consumer must agree on
 * in the one place they cannot share.
 *
 * Like `src/shared/format.ts` and `src/shared/dates.ts`, this module is
 * compiled into BOTH the browser and the Worker projects, so it stays
 * environment-agnostic: no DOM globals, no runtime dependencies, and no
 * reads of the clock. `today` is always an ARGUMENT, never read from the
 * clock internally — that is what keeps every test deterministic regardless
 * of when or where it runs.
 */

import type { TaskDto } from "./api";

/** The five buckets a Task can belong to. Keys are English; the pt-BR group names live in `TaskGroup`. */
export interface TaskGroups {
  overdue: TaskDto[];
  today: TaskDto[];
  upcoming: TaskDto[];
  undated: TaskDto[];
  closed: TaskDto[];
}

/**
 * Partitions `tasks` into the five buckets above in a single pass, pushing
 * each Task into exactly one array in the order it was encountered — never
 * sorted, never reversed, so the concatenation `[...overdue, ...today,
 * ...upcoming, ...undated]` reproduces the input's open Tasks in exactly the
 * same relative order the API returned them in.
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
  const groups: TaskGroups = { overdue: [], today: [], upcoming: [], undated: [], closed: [] };

  for (const task of tasks) {
    if (task.status !== "open") {
      groups.closed.push(task);
      continue;
    }

    const due = task.deadline ?? task.scheduledDate;
    if (due === null) {
      groups.undated.push(task);
    } else if (due < today) {
      groups.overdue.push(task);
    } else if (due === today) {
      groups.today.push(task);
    } else {
      groups.upcoming.push(task);
    }
  }

  return groups;
}
