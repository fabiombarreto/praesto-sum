/**
 * Unit 4 `google-calendar-read`, phase 1 — the projection at the boundary.
 *
 * Covers PRD AC-10 (one range function over a list of sources) at its first
 * link: before anything can be partitioned source-agnostically, each source
 * type has to be projected into ONE narrow shape. These tests pin that
 * projection for the only source that exists today, the Task.
 *
 * The rules asserted here are not new — they are the rules `groupTasks`
 * already encodes inline (`src/shared/task-groups.ts:45-66`), lifted out so
 * the partition no longer has to know what a Task is:
 *
 *   - status is read BEFORE the dates, so a `done` Task with an overdue
 *     deadline is closed, never overdue;
 *   - `deadline ?? scheduledDate` is the due day, and at most one is set.
 *
 * Phase 1 deliberately constructs no Google items (the plan's NOT Building
 * list), so nothing here touches the union's second variant beyond proving
 * the discriminant exists and is exhaustively checkable.
 */

import { describe, expect, it } from "vitest";
import type { TaskDto, TaskPriority, TaskStatus } from "../src/shared/api";
import { assertNeverDaySource, dayItemFromTask } from "../src/shared/day-item";

/**
 * Mirrors the local factory in `test/task-groups.test.ts:26-49`. Deliberately
 * duplicated rather than shared: that file is this phase's characterization
 * suite and must stay byte-unchanged, so importing from it would couple the
 * two and give a later edit a reason to touch it.
 */
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

describe("dayItemFromTask — the discriminant", () => {
  it("tags every projected Task with the `task` source", () => {
    expect(dayItemFromTask(task("a")).source).toBe("task");
  });

  it("carries the Task's own id, so identity survives the projection", () => {
    expect(dayItemFromTask(task("a")).id).toBe("id-a");
  });

  it("keeps the whole Task reachable as the payload rather than copying its fields", () => {
    const original = task("a", { priority: "high" });
    const item = dayItemFromTask(original);

    // Identity, not equality: the projection must not clone. A copy would be a
    // second truth about the same Task — the hand-duplicated-entity-type
    // anti-pattern arriving through the back door.
    expect(item.source === "task" && item.task).toBe(original);
  });
});

describe("dayItemFromTask — the due day", () => {
  it("uses `deadline` when it is the one that is set", () => {
    expect(dayItemFromTask(task("a", { deadline: "2026-08-25" })).dueDate).toBe("2026-08-25");
  });

  it("uses `scheduledDate` when it is the one that is set", () => {
    expect(dayItemFromTask(task("a", { scheduledDate: "2026-08-25" })).dueDate).toBe("2026-08-25");
  });

  it("is null when the Task carries neither date", () => {
    expect(dayItemFromTask(task("a")).dueDate).toBeNull();
  });

  it("prefers `deadline` over `scheduledDate`, matching `deadline ?? scheduledDate`", () => {
    // The two are mutually exclusive by the wire contract, so this pins the
    // tie-break rather than describing a state the API can produce.
    const both = task("a", { deadline: "2026-08-20", scheduledDate: "2026-08-30" });

    expect(dayItemFromTask(both).dueDate).toBe("2026-08-20");
  });
});

describe("dayItemFromTask — closed", () => {
  it("is false for an open Task", () => {
    expect(dayItemFromTask(task("a", { status: "open" })).closed).toBe(false);
  });

  it("is true for a done Task", () => {
    expect(dayItemFromTask(task("a", { status: "done" })).closed).toBe(true);
  });

  it("is true for a missed Task", () => {
    expect(dayItemFromTask(task("a", { status: "missed" })).closed).toBe(true);
  });

  it("is true even when the closed Task's deadline is in the past", () => {
    // Status before dates: the rule `groupTasks` encodes at
    // `src/shared/task-groups.ts:50-53`, and the reason a completed Task with
    // an overdue deadline never reappears under *Atrasadas*.
    const done = task("a", { status: "done", deadline: "2020-01-01" });

    expect(dayItemFromTask(done).closed).toBe(true);
  });
});

describe("dayItemFromTask — purity", () => {
  it("does not mutate the Task it projects", () => {
    const original = task("a", { deadline: "2026-08-25" });
    const snapshot = { ...original };

    dayItemFromTask(original);

    expect(original).toEqual(snapshot);
  });

  it("is deterministic — the same Task projects to the same values every time", () => {
    // The module reads no clock: `today` is never its concern, so nothing here
    // can decay as the calendar moves.
    const input = task("a", { scheduledDate: "2026-08-25" });
    const first = dayItemFromTask(input);
    const second = dayItemFromTask(input);

    expect({ ...first, task: null }).toEqual({ ...second, task: null });
  });
});

describe("assertNeverDaySource", () => {
  it("throws when reached, so an unhandled source cannot fail silently at runtime", () => {
    // Its real job is at compile time: adding a third source in unit 14 must
    // become a type error at every switch. This asserts the runtime half —
    // that the branch is loud rather than a silent fallthrough returning
    // undefined.
    expect(() => assertNeverDaySource("google-drive" as never)).toThrow();
  });
});
