// PRPs/prds/today-view-and-filters.prd.md AC-7 group-partition
//
// `groupTasks` is the client half of unit 3: it chunks the list the API already
// ordered into the four sections layout standard §2.5 specifies, plus the
// closed one the screen already had.
//
// The load-bearing property is NOT membership — it is that the function
// PARTITIONS and never sorts. The frozen read contract makes the ordering the
// API's guarantee and forbids re-deriving it in a client
// (`docs/api-reference.md`), so the concatenation test below is written to fail
// against any implementation that sorts inside a bucket, even one whose
// membership is perfectly correct. That is why the fixtures deliberately arrive
// in an order a sort would change.
//
// `today` is an argument, never read from the clock — the same discipline
// `src/shared/format.ts` and `src/shared/dates.ts` already follow, and what
// makes every case here deterministic regardless of when it runs.

import { describe, expect, it } from "vitest";
import type { TaskDto, TaskPriority, TaskStatus } from "../src/shared/api";
import { groupTasks } from "../src/shared/task-groups";

const TODAY = "2026-08-23";

/** A TaskDto with only the fields the partition reads varied; the rest are fixed noise. */
function task(
  title: string,
  overrides: {
    status?: TaskStatus;
    deadline?: string | null;
    scheduledDate?: string | null;
    priority?: TaskPriority | null;
  } = {},
): TaskDto {
  return {
    id: `id-${title}`,
    title,
    description: null,
    status: overrides.status ?? "open",
    deadline: overrides.deadline ?? null,
    scheduledDate: overrides.scheduledDate ?? null,
    priority: overrides.priority ?? null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    completedAt: null,
    createdAt: 1_700_000_000,
  };
}

function titles(rows: TaskDto[]): string[] {
  return rows.map((row) => row.title);
}

describe("groupTasks — bucket membership", () => {
  it("puts an open Task with a past due day in overdue", () => {
    const groups = groupTasks([task("late", { deadline: "2026-08-22" })], TODAY);

    expect(titles(groups.overdue)).toEqual(["late"]);
    expect(titles(groups.today)).toEqual([]);
    expect(titles(groups.upcoming)).toEqual([]);
    expect(titles(groups.undated)).toEqual([]);
    expect(titles(groups.closed)).toEqual([]);
  });

  it("puts an open Task due exactly today in today", () => {
    const groups = groupTasks([task("now", { deadline: TODAY })], TODAY);

    expect(titles(groups.today)).toEqual(["now"]);
    expect(titles(groups.overdue)).toEqual([]);
  });

  it("puts an open Task due after today in upcoming", () => {
    const groups = groupTasks([task("soon", { deadline: "2026-08-24" })], TODAY);

    expect(titles(groups.upcoming)).toEqual(["soon"]);
    expect(titles(groups.today)).toEqual([]);
  });

  it("puts an open Task with neither date in undated", () => {
    const groups = groupTasks([task("someday")], TODAY);

    expect(titles(groups.undated)).toEqual(["someday"]);
  });

  it("reads the scheduled date when there is no deadline", () => {
    const groups = groupTasks(
      [
        task("do it late", { scheduledDate: "2026-08-21" }),
        task("do it today", { scheduledDate: TODAY }),
        task("do it later", { scheduledDate: "2026-08-30" }),
      ],
      TODAY,
    );

    expect(titles(groups.overdue)).toEqual(["do it late"]);
    expect(titles(groups.today)).toEqual(["do it today"]);
    expect(titles(groups.upcoming)).toEqual(["do it later"]);
  });

  it("crosses a month boundary on the string comparison alone", () => {
    // Zero-padded ISO days compare lexicographically as they compare
    // chronologically — the reason no date arithmetic belongs here.
    const groups = groupTasks(
      [
        task("last month", { deadline: "2026-07-31" }),
        task("next month", { deadline: "2026-09-01" }),
      ],
      TODAY,
    );

    expect(titles(groups.overdue)).toEqual(["last month"]);
    expect(titles(groups.upcoming)).toEqual(["next month"]);
  });
});

describe("groupTasks — status is read before the dates", () => {
  it("puts a done Task in closed even when its deadline is long past", () => {
    const groups = groupTasks(
      [task("finished", { status: "done", deadline: "2026-01-01" })],
      TODAY,
    );

    // The trap this pins: a completed Task with an overdue date must never
    // reappear under *Atrasadas*.
    expect(titles(groups.closed)).toEqual(["finished"]);
    expect(titles(groups.overdue)).toEqual([]);
  });

  it("puts a missed Task in closed even when its deadline is today", () => {
    const groups = groupTasks([task("missed one", { status: "missed", deadline: TODAY })], TODAY);

    expect(titles(groups.closed)).toEqual(["missed one"]);
    expect(titles(groups.today)).toEqual([]);
  });

  it("puts a done Task with no date in closed, not undated", () => {
    const groups = groupTasks([task("done, undated", { status: "done" })], TODAY);

    expect(titles(groups.closed)).toEqual(["done, undated"]);
    expect(titles(groups.undated)).toEqual([]);
  });
});

describe("groupTasks — the partition never re-orders", () => {
  /**
   * Deliberately NOT in date order inside any bucket. A partition keeps this
   * arrival order; a sort would rewrite it. Every assertion below is chosen so
   * that a sorting implementation with perfect membership still fails.
   */
  const scrambled: TaskDto[] = [
    task("O-mid", { deadline: "2026-08-20" }),
    task("O-oldest", { deadline: "2026-08-01" }),
    task("T-second", { deadline: TODAY }),
    task("U-far", { deadline: "2026-12-31" }),
    task("O-newest", { deadline: "2026-08-22" }),
    task("T-first", { scheduledDate: TODAY }),
    task("N-b", {}),
    task("U-near", { deadline: "2026-08-24" }),
    task("N-a", {}),
    task("C-done", { status: "done", deadline: "2026-08-02" }),
  ];

  it("keeps the arrival order inside every bucket", () => {
    const groups = groupTasks(scrambled, TODAY);

    expect(titles(groups.overdue)).toEqual(["O-mid", "O-oldest", "O-newest"]);
    expect(titles(groups.today)).toEqual(["T-second", "T-first"]);
    expect(titles(groups.upcoming)).toEqual(["U-far", "U-near"]);
    expect(titles(groups.undated)).toEqual(["N-b", "N-a"]);
    expect(titles(groups.closed)).toEqual(["C-done"]);
  });

  /**
   * What the route actually returns: overdue first, then today, then future
   * ascending, then undated last (`src/worker/routes/tasks.ts`, `urgencyBucket`).
   * The concatenation identity is a property of THIS shape of input, not of an
   * arbitrary one — grouping an already-bucket-ordered list and gluing the
   * buckets back together must be the identity function.
   */
  const inApiOrder: TaskDto[] = [
    task("api-O-1", { deadline: "2026-08-01" }),
    task("api-O-2", { deadline: "2026-08-22" }),
    task("api-T-1", { deadline: TODAY }),
    task("api-T-2", { scheduledDate: TODAY }),
    task("api-U-1", { deadline: "2026-08-24" }),
    task("api-U-2", { deadline: "2026-12-31" }),
    task("api-N-1", {}),
    task("api-N-2", {}),
  ];

  it("is the identity function on a list already in the API's urgency order", () => {
    const groups = groupTasks(inApiOrder, TODAY);

    const concatenated = [
      ...groups.overdue,
      ...groups.today,
      ...groups.upcoming,
      ...groups.undated,
    ];

    // The frozen contract's ordering guarantee, expressed as a property: the
    // order the API produced survives the grouping untouched, because grouping
    // only chunks it. Note this is deliberately asserted against a
    // bucket-ordered fixture — against `scrambled` above it would be false for
    // every correct implementation, since concatenating buckets cannot
    // reproduce a top-level interleaving of them.
    expect(concatenated.map((row) => row.id)).toEqual(inApiOrder.map((row) => row.id));
  });

  it("loses no Task and invents none", () => {
    const groups = groupTasks(scrambled, TODAY);

    const total =
      groups.overdue.length +
      groups.today.length +
      groups.upcoming.length +
      groups.undated.length +
      groups.closed.length;

    expect(total).toBe(scrambled.length);
  });

  it("returns the same Task objects, not copies", () => {
    const groups = groupTasks(scrambled, TODAY);

    // Identity matters: the screen keys rows by `task.id` and passes the object
    // straight to TaskRow, so a copy would break referential comparisons.
    expect(groups.overdue[0]).toBe(scrambled[0]);
  });
});

describe("groupTasks — purity", () => {
  it("reads no clock: the same input yields different buckets for a different today", () => {
    const rows = [task("pivot", { deadline: "2026-08-23" })];

    expect(titles(groupTasks(rows, "2026-08-23").today)).toEqual(["pivot"]);
    expect(titles(groupTasks(rows, "2026-08-24").overdue)).toEqual(["pivot"]);
    expect(titles(groupTasks(rows, "2026-08-22").upcoming)).toEqual(["pivot"]);
  });

  it("does not mutate the array it is given", () => {
    const rows = [task("b", { deadline: "2026-08-30" }), task("a", { deadline: "2026-08-01" })];
    const before = titles(rows);

    groupTasks(rows, TODAY);

    expect(titles(rows)).toEqual(before);
  });

  it("returns five empty buckets for an empty list", () => {
    const groups = groupTasks([], TODAY);

    expect(groups).toEqual({ overdue: [], today: [], upcoming: [], undated: [], closed: [] });
  });
});
