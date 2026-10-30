// PRPs/prds/events-and-day-view.prd.md AC-22 One range function, three sources
// (the clause: "a non-Task item can never land in `overdue`, `done` or `missed`")
//
// Source plan: PRPs/plans/events-and-day-view-phase-3-the-range-function-and-the-day.plan.md
// (Task 2 — src/shared/day-groups.ts: `bucketOf` becomes an exhaustive `switch` over the day-item
// source; plan AC-A2).
//
// WHY THIS IS A NEW FILE: test/day-groups.test.ts characterises `collectDayItems` for Task-only
// input and must stay byte-unchanged (the plan's Level 3 diffs it against the merge base). It is
// the proof that the Task branch of the rewritten switch behaves as it did; this file adds only
// what that suite cannot say: how an item that is NOT a Task is bucketed.
//
// Two layers, kept apart so the reviewer can see which is the PRD and which is the plan:
//
//   1. PRD AC-22, the property: for every non-Task source, every `closed` flag and every due day
//      (past, today, future, none), the item never lands in `overdue`, `done` or `missed`.
//   2. Plan decision D3-8, beyond the PRD text: where such an item DOES land — `undated` with no
//      day, `upcoming` after today, `today` on or before it. A past-dated Event landing in
//      `today` is the plan's stated "accepted cost"; no screen feeds `collectDayItems` an Event
//      (they reach the screens through `itemsInRange`), so the rule exists to keep the function
//      total and the failure mild.
//
// Items are forged here as literals of the plan-fixed interfaces (`LocalDayItem` extends the base
// with `source: "local"` and `event`), so this file's RED reason is the bucketing rule and not
// the projection function, which test/day-item-local.test.ts owns.
//
// This suite runs BEFORE the Implementer: today's `bucketOf` files a closed non-Task item under
// `done` and a past-dated one under `overdue`, so the property cases are RED for the right reason.

import { describe, expect, it } from "vitest";
import { collectDayItems, type DayItemGroups } from "../src/shared/day-groups";
import {
  dayItemFromEvent,
  dayItemFromTask,
  type DayItem,
  type ExternalDayItem,
  type LocalDayItem,
} from "../src/shared/day-item";
import { googleTimed, idsOf, localTimed, spMillis, spSeconds, task } from "./day-fixtures";

const TODAY = "2026-10-20";

const BUCKETS = ["overdue", "today", "upcoming", "undated", "done", "missed"] as const;

type BucketName = (typeof BUCKETS)[number];

/** A local item with the given bucketing fields; the Event inside is irrelevant to bucketing. */
function localItem(id: string, dueDate: string | null, closed = false): LocalDayItem {
  return {
    source: "local",
    id,
    dueDate,
    closed,
    event: localTimed(id, spSeconds(TODAY, "09:00"), spSeconds(TODAY, "10:00")),
  };
}

/** A Google item with the given bucketing fields. */
function googleItem(id: string, dueDate: string | null, closed = false): ExternalDayItem {
  return {
    source: "google",
    id,
    dueDate,
    closed,
    payload: googleTimed(id, spMillis(TODAY, "09:00"), spMillis(TODAY, "10:00")),
  };
}

const MAKERS = {
  local: localItem,
  google: googleItem,
} as const;

/** The names of the buckets an item landed in (exactly one, if the function loses nothing). */
function bucketsHolding(groups: DayItemGroups, id: string): BucketName[] {
  return BUCKETS.filter((bucket) => idsOf(groups[bucket]).includes(id));
}

function bucketOfOnly(item: DayItem): BucketName[] {
  return bucketsHolding(collectDayItems([{ id: "only", items: [item] }], TODAY), item.id);
}

const DUE_DAYS = [
  { label: "a past day", dueDate: "2026-10-01" },
  { label: "yesterday", dueDate: "2026-10-19" },
  { label: "today", dueDate: TODAY },
  { label: "tomorrow", dueDate: "2026-10-21" },
  { label: "a far future day", dueDate: "2027-03-01" },
  { label: "no day at all", dueDate: null },
] as const;

describe("collectDayItems — a non-Task item can never land in overdue, done or missed (PRD AC-22)", () => {
  for (const [sourceName, make] of Object.entries(MAKERS)) {
    for (const closed of [false, true]) {
      for (const { label, dueDate } of DUE_DAYS) {
        it(`a ${sourceName} item dated ${label}, closed=${closed}, lands in exactly one of today, upcoming, undated`, () => {
          const landed = bucketOfOnly(make("x", dueDate, closed));

          expect(landed).toHaveLength(1);
          expect(landed).not.toContain("overdue");
          expect(landed).not.toContain("done");
          expect(landed).not.toContain("missed");
        });
      }
    }
  }

  it("does not file a past-dated Event as overdue, however long ago it was", () => {
    const groups = collectDayItems(
      [
        {
          id: "events",
          items: [localItem("old", "2020-01-01"), googleItem("older", "2019-06-30")],
        },
      ],
      TODAY,
    );

    expect(groups.overdue).toEqual([]);
  });

  it("does not file a closed-flagged Event as done, even with an overdue day", () => {
    // `closed` is read FIRST for a Task (a done Task with an overdue deadline is done, never
    // overdue). For an Event the flag must not matter at all: an Event has no completion state.
    const groups = collectDayItems(
      [
        {
          id: "events",
          items: [localItem("l", "2020-01-01", true), googleItem("g", "2020-01-01", true)],
        },
      ],
      TODAY,
    );

    expect(groups.done).toEqual([]);
    expect(groups.missed).toEqual([]);
  });
});

describe("collectDayItems — where a non-Task item lands (plan decision D3-8)", () => {
  for (const [sourceName, make] of Object.entries(MAKERS)) {
    describe(`a ${sourceName} item`, () => {
      it("with no day goes to undated", () => {
        expect(bucketOfOnly(make("x", null))).toEqual(["undated"]);
      });

      it("dated after today goes to upcoming", () => {
        expect(bucketOfOnly(make("x", "2026-10-21"))).toEqual(["upcoming"]);
        expect(bucketOfOnly(make("x", "2027-03-01"))).toEqual(["upcoming"]);
      });

      it("dated today goes to today", () => {
        expect(bucketOfOnly(make("x", TODAY))).toEqual(["today"]);
      });

      it("dated before today goes to today, the accepted cost of never being overdue", () => {
        expect(bucketOfOnly(make("x", "2026-10-19"))).toEqual(["today"]);
        expect(bucketOfOnly(make("x", "2020-01-01"))).toEqual(["today"]);
      });

      it("is placed by its day alone — the closed flag changes nothing", () => {
        for (const { dueDate } of DUE_DAYS) {
          expect(bucketOfOnly(make("x", dueDate, true))).toEqual(
            bucketOfOnly(make("x", dueDate, false)),
          );
        }
      });
    });
  }
});

describe("collectDayItems — Tasks keep their rules beside non-Task items", () => {
  const tasks = [
    dayItemFromTask(task("t-overdue", { deadline: "2026-10-10" })),
    dayItemFromTask(task("t-today", { deadline: TODAY })),
    dayItemFromTask(task("t-upcoming", { scheduledDate: "2026-10-30" })),
    dayItemFromTask(task("t-undated")),
    dayItemFromTask(task("t-done", { status: "done", deadline: "2026-10-10" })),
    dayItemFromTask(task("t-missed", { status: "missed", deadline: "2026-10-10" })),
  ];

  const events = [
    localItem("e-local-past", "2026-10-10"),
    localItem("e-local-closed", "2026-10-10", true),
    googleItem("e-google-past", "2026-10-10"),
    dayItemFromEvent(
      googleTimed(
        "e-google-real",
        spMillis("2026-10-10", "09:00"),
        spMillis("2026-10-10", "10:00"),
      ),
    ),
  ];

  it("still files each Task exactly where Task-only input files it", () => {
    const mixed = collectDayItems(
      [
        { id: "tasks", items: tasks },
        { id: "events", items: events },
      ],
      TODAY,
    );

    expect(idsOf(mixed.overdue)).toEqual(["t-overdue"]);
    expect(idsOf(mixed.done)).toEqual(["t-done"]);
    expect(idsOf(mixed.missed)).toEqual(["t-missed"]);
    expect(idsOf(mixed.upcoming)).toEqual(["t-upcoming"]);
    expect(idsOf(mixed.undated)).toEqual(["t-undated"]);
  });

  it("leaves the Task-only result untouched when events are added beside it", () => {
    const taskOnly = collectDayItems([{ id: "tasks", items: tasks }], TODAY);
    const mixed = collectDayItems(
      [
        { id: "tasks", items: tasks },
        { id: "events", items: events },
      ],
      TODAY,
    );

    expect(mixed.overdue).toEqual(taskOnly.overdue);
    expect(mixed.upcoming).toEqual(taskOnly.upcoming);
    expect(mixed.undated).toEqual(taskOnly.undated);
    expect(mixed.done).toEqual(taskOnly.done);
    expect(mixed.missed).toEqual(taskOnly.missed);
  });

  it("puts every event in a bucket and loses nothing", () => {
    const mixed = collectDayItems(
      [
        { id: "tasks", items: tasks },
        { id: "events", items: events },
      ],
      TODAY,
    );

    const all = BUCKETS.flatMap((bucket) => idsOf(mixed[bucket]));

    expect([...all].sort()).toEqual([...idsOf(tasks), ...idsOf(events)].sort());
  });
});

describe("collectDayItems — the switch over the source is exhaustive", () => {
  it("throws on a source it does not know, instead of guessing a bucket", () => {
    // The compile-time half is `assertNeverDaySource` in the switch's default (a future source
    // stops compiling). This is the runtime half: a branch that should be unreachable is loud.
    // Today's if-ladder files the stranger under `today` without a sound.
    const stranger = {
      source: "outlook",
      id: "x",
      dueDate: TODAY,
      closed: false,
    } as unknown as DayItem;

    expect(() => collectDayItems([{ id: "s", items: [stranger] }], TODAY)).toThrow();
  });

  it("still throws when the unknown source is flagged closed or undated", () => {
    const closedStranger = {
      source: "outlook",
      id: "x",
      dueDate: null,
      closed: true,
    } as unknown as DayItem;

    expect(() => collectDayItems([{ id: "s", items: [closedStranger] }], TODAY)).toThrow();
  });
});
