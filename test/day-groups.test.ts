/**
 * Unit 4 `google-calendar-read`, phase 1 — the range function.
 *
 * Covers PRD **AC-10** directly and by name: "Given the function that produces
 * the day's items, when it is called with ZERO sources, with ONE source, and
 * with TWO sources, then all three return correct results through the same
 * code path with no source-count branch." The roadmap calls this the unit's
 * non-negotiable design condition — it is what lets unit 14 add local Events
 * as a third source instead of rewriting the screen.
 *
 * Two properties carry most of the weight here:
 *
 *   1. **One source is the identity.** The API already ordered the Task list
 *      (`src/worker/routes/tasks.ts:53-118`), and the frozen read contract
 *      puts that ordering out of the client's hands. A partition may chunk it;
 *      nothing here may re-derive it. This is also what makes PRD AC-14 fall
 *      out by construction rather than by care.
 *   2. **The merge is stable.** With two sources, each source's own relative
 *      order survives, and ties on `dueDate` resolve by the source's index in
 *      the `sources` array — a deterministic rule, not an accident of
 *      iteration.
 *
 * Phase 1 constructs no Google items (the plan's NOT Building list). A
 * "source" here is a named list, not a provider, so two sources of projected
 * Tasks exercise every merge path without inventing an Event entity ahead of
 * unit 14.
 */

import { describe, expect, it } from "vitest";
import type { TaskDto, TaskStatus } from "../src/shared/api";
import type { DayItem } from "../src/shared/day-item";
import { dayItemFromTask } from "../src/shared/day-item";
import { collectDayItems, type DayItemSource } from "../src/shared/day-groups";

const TODAY = "2026-08-25";

const BUCKETS = ["overdue", "today", "upcoming", "undated", "closed"] as const;

function task(
  id: string,
  overrides: { status?: TaskStatus; deadline?: string | null } = {},
): TaskDto {
  return {
    id,
    title: id,
    description: null,
    status: overrides.status ?? "open",
    deadline: overrides.deadline ?? null,
    scheduledDate: null,
    priority: null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    completedAt: null,
    createdAt: 1_700_000_000,
  };
}

/** A named list of already-projected items — what `collectDayItems` consumes. */
function source(id: string, items: readonly DayItem[]): DayItemSource {
  return { id, items };
}

function ids(items: readonly DayItem[]): string[] {
  return items.map((item) => item.id);
}

describe("collectDayItems — zero sources", () => {
  it("returns all five buckets, every one of them empty", () => {
    const groups = collectDayItems([], TODAY);

    for (const bucket of BUCKETS) {
      expect(groups[bucket]).toEqual([]);
    }
  });

  it("does not throw", () => {
    expect(() => collectDayItems([], TODAY)).not.toThrow();
  });

  it("treats a source carrying no items the same as no source at all", () => {
    // The distinction matters once a provider is connected but has nothing in
    // the window — an empty source must not be a special case.
    const empty = collectDayItems([source("s1", [])], TODAY);

    expect(empty).toEqual(collectDayItems([], TODAY));
  });
});

describe("collectDayItems — one source", () => {
  const items = [
    dayItemFromTask(task("overdue-1", { deadline: "2026-08-01" })),
    dayItemFromTask(task("overdue-2", { deadline: "2026-08-24" })),
    dayItemFromTask(task("today-1", { deadline: TODAY })),
    dayItemFromTask(task("upcoming-1", { deadline: "2026-08-26" })),
    dayItemFromTask(task("upcoming-2", { deadline: "2026-12-31" })),
    dayItemFromTask(task("undated-1")),
    dayItemFromTask(task("closed-1", { status: "done", deadline: "2026-08-01" })),
  ];

  it("buckets each item by its due day against `today`", () => {
    const groups = collectDayItems([source("tasks", items)], TODAY);

    expect(ids(groups.overdue)).toEqual(["overdue-1", "overdue-2"]);
    expect(ids(groups.today)).toEqual(["today-1"]);
    expect(ids(groups.upcoming)).toEqual(["upcoming-1", "upcoming-2"]);
    expect(ids(groups.undated)).toEqual(["undated-1"]);
    expect(ids(groups.closed)).toEqual(["closed-1"]);
  });

  it("reads closed BEFORE the dates, so a closed item never lands in a dated bucket", () => {
    const groups = collectDayItems([source("tasks", items)], TODAY);

    expect(ids(groups.overdue)).not.toContain("closed-1");
  });

  it("is the identity on the source's own order — it partitions, never sorts", () => {
    // The property the frozen read contract turns on: concatenating the open
    // buckets reproduces the source's order exactly, because chunking is all
    // that happened. Mirrors `test/task-groups.test.ts:192-209`, deliberately
    // asserted against an input that is already in bucket order.
    const groups = collectDayItems([source("tasks", items)], TODAY);

    const concatenated = [
      ...groups.overdue,
      ...groups.today,
      ...groups.upcoming,
      ...groups.undated,
    ];

    expect(ids(concatenated)).toEqual(ids(items.filter((item) => !item.closed)));
  });

  it("loses no item and invents none", () => {
    const groups = collectDayItems([source("tasks", items)], TODAY);

    const total = BUCKETS.reduce((sum, bucket) => sum + groups[bucket].length, 0);

    expect(total).toBe(items.length);
  });

  it("preserves a scrambled source's relative order inside each bucket", () => {
    // Even when the input is NOT in API order, the function must not repair it
    // — repairing would be re-deriving the ordering the server owns.
    const scrambled = [
      dayItemFromTask(task("b", { deadline: "2026-08-26" })),
      dayItemFromTask(task("a", { deadline: "2026-08-26" })),
      dayItemFromTask(task("c", { deadline: "2026-08-27" })),
    ];

    const groups = collectDayItems([source("tasks", scrambled)], TODAY);

    expect(ids(groups.upcoming)).toEqual(["b", "a", "c"]);
  });
});

describe("collectDayItems — two sources", () => {
  it("merges both sources into the same buckets", () => {
    const first = source("a", [dayItemFromTask(task("a-today", { deadline: TODAY }))]);
    const second = source("b", [dayItemFromTask(task("b-today", { deadline: TODAY }))]);

    const groups = collectDayItems([first, second], TODAY);

    expect(ids(groups.today)).toHaveLength(2);
  });

  it("preserves each source's own relative order within a bucket", () => {
    const first = source("a", [
      dayItemFromTask(task("a-1", { deadline: "2026-08-26" })),
      dayItemFromTask(task("a-2", { deadline: "2026-08-28" })),
    ]);
    const second = source("b", [
      dayItemFromTask(task("b-1", { deadline: "2026-08-27" })),
      dayItemFromTask(task("b-2", { deadline: "2026-08-29" })),
    ]);

    const groups = collectDayItems([first, second], TODAY);

    expect(ids(groups.upcoming)).toEqual(["a-1", "b-1", "a-2", "b-2"]);
  });

  it("breaks a tie on `dueDate` by the source's index in the sources array", () => {
    const first = source("a", [dayItemFromTask(task("a-1", { deadline: "2026-08-26" }))]);
    const second = source("b", [dayItemFromTask(task("b-1", { deadline: "2026-08-26" }))]);

    expect(ids(collectDayItems([first, second], TODAY).upcoming)).toEqual(["a-1", "b-1"]);
    expect(ids(collectDayItems([second, first], TODAY).upcoming)).toEqual(["b-1", "a-1"]);
  });

  it("merges undated items by source order, since they have no key to compare", () => {
    const first = source("a", [dayItemFromTask(task("a-1"))]);
    const second = source("b", [dayItemFromTask(task("b-1"))]);

    expect(ids(collectDayItems([first, second], TODAY).undated)).toEqual(["a-1", "b-1"]);
  });

  it("handles one empty source beside one populated source", () => {
    const populated = source("a", [dayItemFromTask(task("a-1", { deadline: TODAY }))]);

    expect(ids(collectDayItems([populated, source("b", [])], TODAY).today)).toEqual(["a-1"]);
    expect(ids(collectDayItems([source("b", []), populated], TODAY).today)).toEqual(["a-1"]);
  });
});

describe("collectDayItems — no source-count branch", () => {
  it("extends to three sources with no new behaviour", () => {
    // AC-10 names zero, one and two. Three is the guard against a function
    // that satisfies those three cases with three special cases: if the merge
    // is genuinely N-ary, this passes for free.
    const sources = ["a", "b", "c"].map((id) =>
      source(id, [dayItemFromTask(task(`${id}-1`, { deadline: "2026-08-26" }))]),
    );

    expect(ids(collectDayItems(sources, TODAY).upcoming)).toEqual(["a-1", "b-1", "c-1"]);
  });

  it("gives the same answer for one source as for that source split in two", () => {
    // A source is a delivery boundary, not a semantic one. Splitting a list
    // across two sources must not change where its items land, only how ties
    // between them resolve — and here the split preserves date order, so the
    // result is identical.
    const one = source("all", [
      dayItemFromTask(task("x", { deadline: "2026-08-26" })),
      dayItemFromTask(task("y", { deadline: "2026-08-27" })),
    ]);
    const split = [
      source("a", [dayItemFromTask(task("x", { deadline: "2026-08-26" }))]),
      source("b", [dayItemFromTask(task("y", { deadline: "2026-08-27" }))]),
    ];

    expect(ids(collectDayItems([one], TODAY).upcoming)).toEqual(
      ids(collectDayItems(split, TODAY).upcoming),
    );
  });
});

describe("collectDayItems — purity", () => {
  it("does not mutate the sources it is given", () => {
    const items = [dayItemFromTask(task("a-1", { deadline: TODAY }))];
    const sources = [source("a", items)];

    collectDayItems(sources, TODAY);

    expect(sources).toHaveLength(1);
    expect(ids(sources[0]!.items)).toEqual(["a-1"]);
  });

  it("reads `today` only from its argument, never from the clock", () => {
    // The same input bucketed against two different `today` values must move,
    // which is only possible if `today` is the sole source of "now".
    const items = [dayItemFromTask(task("a-1", { deadline: "2026-08-26" }))];

    expect(ids(collectDayItems([source("a", items)], "2026-08-25").upcoming)).toEqual(["a-1"]);
    expect(ids(collectDayItems([source("a", items)], "2026-08-26").today)).toEqual(["a-1"]);
    expect(ids(collectDayItems([source("a", items)], "2026-08-27").overdue)).toEqual(["a-1"]);
  });
});
