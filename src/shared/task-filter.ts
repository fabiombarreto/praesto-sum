/**
 * The single source of truth for what a Task filter IS (PRD AC-12). The
 * quick-filter chip row and the filter sheet are two VIEWS of one
 * `TaskFilter` — never two states that must be kept in sync — so every
 * question either surface can ask (is this chip pressed? what does the
 * request look like? how many dimensions are active?) is answered here and
 * nowhere else.
 *
 * Like `src/shared/task-groups.ts`, `format.ts` and `dates.ts`, this module
 * is compiled into BOTH the browser and the Worker projects, so it stays
 * environment-agnostic: no DOM globals, no runtime dependencies, and no
 * reads of the clock. `today` is always an ARGUMENT, never read from the
 * clock internally — that is what keeps every caller (and every test)
 * deterministic regardless of when or where it runs.
 */

import type { TaskPriority, TaskStatus } from "./api";

/** The whole filter state: four independent, nullable dimensions. `null` means "not set". */
export interface TaskFilter {
  status: TaskStatus | null;
  priority: TaskPriority | null;
  from: string | null;
  to: string | null;
}

/** The filter a screen starts with — every dimension unset. Never seeded from storage (layout standard §2.3). */
export const EMPTY_FILTER: TaskFilter = {
  status: null,
  priority: null,
  from: null,
  to: null,
};

/** The three quick-filter chips of layout standard §2.3, each backed by exactly one `TaskFilter` dimension. */
export type QuickChip = "open" | "today" | "high";

/**
 * The query string `listTasks` sends: `""` when every dimension is `null` —
 * the case that keeps an unfiltered load byte-identical to the request the
 * screen issued before filters existed — otherwise `?` plus the set
 * parameters in the FIXED order `status`, `from`, `to`, `priority`, built
 * with `URLSearchParams` so every value is encoded rather than concatenated
 * raw. The fixed order is what makes the output assertable and keeps two
 * callers building the same filter from ever producing two different URLs.
 */
export function toQuery(filter: TaskFilter): string {
  const params = new URLSearchParams();
  if (filter.status !== null) params.set("status", filter.status);
  if (filter.from !== null) params.set("from", filter.from);
  if (filter.to !== null) params.set("to", filter.to);
  if (filter.priority !== null) params.set("priority", filter.priority);
  return params.size === 0 ? "" : `?${params.toString()}`;
}

/**
 * How many DIMENSIONS are narrowing the list, for the header badge — never
 * how many fields are set. `status` is one dimension, `priority` is one
 * dimension, and `from`/`to` together are one *period*: a range counts once,
 * whether one end is set or both, because the badge answers "how many
 * questions are narrowing the list?", not "how many fields hold a value?".
 * Range: 0–3.
 */
export function activeCount(filter: TaskFilter): number {
  let count = 0;
  if (filter.status !== null) count += 1;
  if (filter.priority !== null) count += 1;
  if (filter.from !== null || filter.to !== null) count += 1;
  return count;
}

/**
 * Whether `chip` reads as pressed against `filter`: `open` when `status` is
 * `"open"`, `high` when `priority` is `"high"`, `today` when `to` equals
 * `today`. The sheet can set values no chip represents (e.g. `status:
 * "done"`, or a `to` that is not today) — those correctly leave the chip
 * unpressed rather than pressed-but-wrong, which is the round trip between
 * the chip row and the sheet.
 */
export function isChipActive(filter: TaskFilter, chip: QuickChip, today: string): boolean {
  if (chip === "open") return filter.status === "open";
  if (chip === "high") return filter.priority === "high";
  return filter.to === today;
}

/**
 * Toggles exactly `chip`'s own dimension and returns a NEW `TaskFilter` —
 * `filter` is never mutated. Pressing an unpressed chip sets its dimension
 * (overwriting whatever value that one dimension held); pressing a pressed
 * chip clears exactly that dimension to `null`. No other field is ever
 * touched: a chip that also cleared a neighbouring field would make the
 * chip row and the sheet disagree the moment both are used, which is the
 * defect this function exists to prevent. `today` maps to the `to` field —
 * switching the `today` chip off clears only `to`, leaving any `from` the
 * sheet set untouched.
 */
export function toggleChip(filter: TaskFilter, chip: QuickChip, today: string): TaskFilter {
  const active = isChipActive(filter, chip, today);
  if (chip === "open") return { ...filter, status: active ? null : "open" };
  if (chip === "high") return { ...filter, priority: active ? null : "high" };
  return { ...filter, to: active ? null : today };
}
