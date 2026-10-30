// PRPs/prds/events-and-day-view.prd.md AC-22 One range function, three sources
// (also the pure slice of AC-24 / AC-25: what a day holds, and that a future day is listed)
//
// Source plan: PRPs/plans/events-and-day-view-phase-3-the-range-function-and-the-day.plan.md
// (Task 3 — src/shared/day-range.ts: `itemsInRange`, `dayItemPlacement` and the range types;
// plan AC-A1).
//
// `itemsInRange(sources, { from, to })` is THE one range function (ADR-0016 / PRD D-J): local
// Events, Google Events and open dated Tasks go in as `DayItemSource` lists; one `DayRangeEntry`
// per day comes out. Hoje's Agenda and the new `/day/AAAA-MM-DD` route both call it, and unit 16
// will call it with a week. It is the sibling of `collectDayItems` (test/day-groups.test.ts), and
// this suite deliberately mirrors that suite's zero / one / two / three sources and
// order-preserving-split cases.
//
// What carries the weight:
//
//   1. ONE CODE PATH. Zero, one, two and three sources — and the same items split across sources
//      in order — give the same answer. Nothing may branch on how many sources arrived or on a
//      source's id.
//   2. THE SEAM. `EventDto` stores epoch SECONDS, `CalendarEventDto` epoch MILLISECONDS.
//      `dayItemPlacement` is the single adapter between them; the same wall-clock moment must be
//      placed identically whichever DTO carries it.
//   3. THE OWNER'S DAY. Every day derived from an instant is a day in `America/Sao_Paulo`
//      (plan decision D3-1): 22:00 there is 01:00 UTC tomorrow, and 00:30 UTC is still last
//      evening. An all-day date is used verbatim.
//   4. SPANS. An all-day Event covers its start through the day BEFORE its exclusive end; a timed
//      one covers the day of its start through the day of its last instant (`end - 1`), so an
//      Event ending exactly at 00:00 does not spill onto the next day (plan decision D3-3).
//   5. ORDER. Within a day: all-day items first, then timed items by start, then open Tasks —
//      ties in ARRIVAL order, never id order, because test/agenda.test.ts:150-159 pins arrival
//      order for tied starts (plan decision D3-4).
//
// Beyond the PRD text, pinned because the plan fixes it (each one is named so the reviewer can
// overrule it): the exact placement shape of `dayItemPlacement`; the defensive readings (an
// all-day end that is not after its start covers one day; a timed end that is not after its start
// covers the start's day; a Google timed event with a mismatched end is read as ending at its
// start); the continuation sorting by its real start; the stable sort.
//
// What is NOT claimed, on purpose: an INTERLEAVED split of one source across two. Tied starts keep
// arrival order, so splitting a list non-contiguously can legitimately reorder a tie. Only the
// contiguous (order-preserving) split, which test/day-groups.test.ts:225-243 also uses, is pinned.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): src/shared/day-range.ts
// does not exist yet, so this file is RED for the right reason (module-not-found on the import
// below) until plan Task 3 lands.

import { describe, expect, it } from "vitest";
import type { CalendarEventDto, EventDto } from "../src/shared/api";
import type { DayItemSource } from "../src/shared/day-groups";
import {
  dayItemFromEvent,
  dayItemFromLocalEvent,
  dayItemFromTask,
  type DayItem,
} from "../src/shared/day-item";
import {
  dayItemPlacement,
  itemsInRange,
  type DayRange,
  type DayRangeEntry,
} from "../src/shared/day-range";
import {
  googleAllDay,
  googleTimed,
  idsOf,
  localAllDay,
  localTimed,
  spMillis,
  spSeconds,
  task,
  withoutClock,
} from "./day-fixtures";

const [D17, D18, D19, D20, D21, D22, D23, D24] = [
  "2026-10-17",
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
] as const;

/** The range PRD AC-22 names: 2026-10-20 to 2026-10-22, both ends inclusive. */
const RANGE: DayRange = { from: D20, to: D22 };

/** A wall-clock moment in São Paulo, as `[day, "HH:mm"]`. */
type Moment = readonly [day: string, time: string];

const local = (event: EventDto): DayItem => dayItemFromLocalEvent(event);
const google = (event: CalendarEventDto): DayItem => dayItemFromEvent(event);
const openTask = (
  id: string,
  overrides: { deadline?: string | null; scheduledDate?: string | null } = {},
): DayItem => dayItemFromTask(task(id, overrides));

/** A local timed Event between two São Paulo moments. */
function localSpan(id: string, start: Moment, end: Moment): DayItem {
  return local(localTimed(id, spSeconds(...start), spSeconds(...end)));
}

/** A Google timed event between two São Paulo moments. */
function googleSpan(id: string, start: Moment, end: Moment): DayItem {
  return google(googleTimed(id, spMillis(...start), spMillis(...end)));
}

function source(id: string, items: readonly DayItem[]): DayItemSource {
  return { id, items };
}

/** `{ day: [item ids in order] }` — the part of an answer the cases below talk about. */
function layout(entries: readonly DayRangeEntry[]): Record<string, string[]> {
  return Object.fromEntries(entries.map((entry) => [entry.day, idsOf(entry.items)]));
}

/** The days of an answer, in the order they came back. */
function daysOf(entries: readonly DayRangeEntry[]): string[] {
  return entries.map((entry) => entry.day);
}

/** The layout of the PRD's range with every day empty, overridden by `filled`. */
function days(filled: Record<string, string[]> = {}): Record<string, string[]> {
  return { [D20]: [], [D21]: [], [D22]: [], ...filled };
}

/** The layout of ONE mixed source over the PRD's range (or `range`). */
function placed(items: readonly DayItem[], range: DayRange = RANGE): Record<string, string[]> {
  return layout(itemsInRange([source("everything", items)], range));
}

describe("fixtures — the wall-clock helpers agree with a known instant", () => {
  it("names 09:30 in São Paulo as 12:30 UTC, in seconds and in milliseconds", () => {
    // The PRD's AC-1 instant (1_792_499_400 is 2026-10-20T12:30Z, the value phase 2 pins).
    expect(spSeconds(D20, "09:30")).toBe(1_792_499_400);
    expect(spMillis(D20, "09:30")).toBe(1_792_499_400_000);
  });
});

describe("itemsInRange — one entry per day of the range", () => {
  it("returns an empty entry for each day when there are no sources", () => {
    expect(itemsInRange([], RANGE)).toEqual([
      { day: D20, items: [] },
      { day: D21, items: [] },
      { day: D22, items: [] },
    ]);
  });

  it("treats sources that carry no items exactly like no sources at all", () => {
    // The distinction matters once a provider is connected but has nothing in the window.
    const empty = itemsInRange(
      [source("local", []), source("google", []), source("tasks", [])],
      RANGE,
    );

    expect(empty).toEqual(itemsInRange([], RANGE));
  });

  it("lists the days ascending, with both ends of the range included", () => {
    expect(daysOf(itemsInRange([], RANGE))).toEqual([D20, D21, D22]);
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(daysOf(itemsInRange([], { from: "2026-10-30", to: "2026-11-02" }))).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(daysOf(itemsInRange([], { from: "2026-12-30", to: "2027-01-02" }))).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(daysOf(itemsInRange([], { from: "2028-02-28", to: "2028-03-01" }))).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("returns exactly one entry for a one-day range", () => {
    const one = itemsInRange([source("all", [localSpan("x", [D21, "09:00"], [D21, "10:00"])])], {
      from: D21,
      to: D21,
    });

    expect(layout(one)).toEqual({ [D21]: ["x"] });
  });

  it("returns no entries for an inverted range, even when items would fall inside it", () => {
    const items = [local(localAllDay("x", D20, D23)), openTask("t", { deadline: D21 })];

    expect(itemsInRange([source("all", items)], { from: D22, to: D20 })).toEqual([]);
  });
});

describe("itemsInRange — zero, one, two and three sources (PRD AC-22)", () => {
  function sample() {
    const localItems = [
      localSpan("l-timed", [D20, "09:30"], [D20, "10:30"]),
      local(localAllDay("l-allday", D21, D22)),
    ];
    const googleItems = [
      googleSpan("g-timed", [D20, "14:00"], [D20, "15:00"]),
      google(googleAllDay("g-allday", D22)),
    ];
    const taskItems = [
      openTask("t-deadline", { deadline: D21 }),
      openTask("t-sched", { scheduledDate: D22 }),
    ];
    return { localItems, googleItems, taskItems };
  }

  it("places local Events when given a local source only", () => {
    const { localItems } = sample();

    expect(layout(itemsInRange([source("local", localItems)], RANGE))).toEqual(
      days({ [D20]: ["l-timed"], [D21]: ["l-allday"] }),
    );
  });

  it("places Google events when given a Google source only", () => {
    const { googleItems } = sample();

    expect(layout(itemsInRange([source("google", googleItems)], RANGE))).toEqual(
      days({ [D20]: ["g-timed"], [D22]: ["g-allday"] }),
    );
  });

  it("places open dated Tasks when given a Task source only", () => {
    const { taskItems } = sample();

    expect(layout(itemsInRange([source("tasks", taskItems)], RANGE))).toEqual(
      days({ [D21]: ["t-deadline"], [D22]: ["t-sched"] }),
    );
  });

  it("places local Events, Google events and open dated Tasks together", () => {
    const { localItems, googleItems, taskItems } = sample();

    const answer = itemsInRange(
      [source("local", localItems), source("google", googleItems), source("tasks", taskItems)],
      RANGE,
    );

    expect(layout(answer)).toEqual(
      days({
        [D20]: ["l-timed", "g-timed"],
        [D21]: ["l-allday", "t-deadline"],
        [D22]: ["g-allday", "t-sched"],
      }),
    );
    expect(daysOf(answer)).toEqual([D20, D21, D22]);
  });

  it("gives the same answer however the same items are split in order across sources", () => {
    // A source is a delivery boundary, not a semantic one. Mirrors test/day-groups.test.ts:225-243:
    // a CONTIGUOUS split preserves arrival order, so the result is identical. (An interleaved
    // split is deliberately not claimed — tied starts keep arrival order.)
    const { localItems, googleItems, taskItems } = sample();
    const flat = [...localItems, ...googleItems, ...taskItems];
    const together = itemsInRange([source("everything", flat)], RANGE);

    // Not vacuous: the answer being compared is the populated one.
    expect(layout(together)).toEqual(
      days({
        [D20]: ["l-timed", "g-timed"],
        [D21]: ["l-allday", "t-deadline"],
        [D22]: ["g-allday", "t-sched"],
      }),
    );

    const splits: DayItemSource[][] = [
      [source("local", localItems), source("google", googleItems), source("tasks", taskItems)],
      [source("first", flat.slice(0, 3)), source("second", flat.slice(3))],
      flat.map((item, index) => source(`one-each-${index}`, [item])),
      [
        source("empty-first", []),
        source("a", flat.slice(0, 1)),
        source("empty-middle", []),
        source("b", flat.slice(1)),
        source("empty-last", []),
      ],
    ];

    for (const split of splits) {
      expect(itemsInRange(split, RANGE)).toEqual(together);
    }
  });

  it("does not care what a source is called", () => {
    const { localItems, googleItems, taskItems } = sample();

    const named = itemsInRange(
      [source("local", localItems), source("google", googleItems), source("tasks", taskItems)],
      RANGE,
    );
    const renamed = itemsInRange(
      [source("tasks", localItems), source("local", googleItems), source("google", taskItems)],
      RANGE,
    );

    expect(renamed).toEqual(named);
  });

  it("extends to more sources with no new behaviour", () => {
    // Zero, one, two and three are named by the PRD; five is the guard against a function that
    // passes those four with four special cases.
    const items = ["a", "b", "c", "d", "e"].map((id) =>
      localSpan(`l-${id}`, [D21, "09:00"], [D21, "10:00"]),
    );

    const answer = itemsInRange(
      items.map((item, index) => source(`s${index}`, [item])),
      RANGE,
    );

    expect(layout(answer)).toEqual(days({ [D21]: ["l-a", "l-b", "l-c", "l-d", "l-e"] }));
  });
});

describe("itemsInRange — all-day Events cover every day they span", () => {
  it("lists a multi-day local all-day Event on each day up to the day BEFORE its exclusive end", () => {
    // Stored as (D20, D22): the owner's Monday-through-Tuesday shape (PRD AC-2).
    expect(placed([local(localAllDay("trip", D20, D22))])).toEqual(
      days({ [D20]: ["trip"], [D21]: ["trip"] }),
    );
  });

  it("lists a local all-day Event that began before the range and ends after it on every day of the range", () => {
    expect(placed([local(localAllDay("long", D17, "2026-10-27"))])).toEqual(
      days({ [D20]: ["long"], [D21]: ["long"], [D22]: ["long"] }),
    );
  });

  it("lists a single-day local all-day Event (end = start + 1) on that one day", () => {
    expect(placed([local(localAllDay("holiday", D21, D22))])).toEqual(days({ [D21]: ["holiday"] }));
  });

  it("clips a local all-day Event whose span ends inside the range to the days that are inside", () => {
    // Covers D19 and D20; only D20 is in the range.
    expect(placed([local(localAllDay("tail", D19, D21))])).toEqual(days({ [D20]: ["tail"] }));
  });

  it("does not leak an exclusive end into the first day of the range", () => {
    // Covers D18 and D19. The end D20 is EXCLUSIVE, so D20 is not covered.
    expect(placed([local(localAllDay("before", D18, D20))])).toEqual(days());
  });

  it("omits a local all-day Event that starts after the range", () => {
    expect(placed([local(localAllDay("after", D23, D24))])).toEqual(days());
  });

  it("reads a local all-day end that is not after its start as one day", () => {
    // The schema refuses these rows, but the type allows them and the plan fixes the reading
    // (Task 3): cover the start day only, never throw.
    expect(placed([local(localAllDay("equal", D21, D21))])).toEqual(days({ [D21]: ["equal"] }));
    expect(placed([local(localAllDay("inverted", D21, D19))])).toEqual(
      days({ [D21]: ["inverted"] }),
    );
  });

  it("lists a multi-day Google all-day event on each day up to the day BEFORE its exclusive end", () => {
    expect(placed([google(googleAllDay("trip", D20, D23))])).toEqual(
      days({ [D20]: ["trip"], [D21]: ["trip"], [D22]: ["trip"] }),
    );
  });

  it("reads a Google all-day event whose end equals its start as one day", () => {
    // The shipped fixtures (test/agenda.test.ts) carry end == start, and Google is reported to
    // accept equal dates, so the placement normalises defensively.
    expect(placed([google(googleAllDay("single", D21))])).toEqual(days({ [D21]: ["single"] }));
  });

  it("reads a Google all-day event whose end is before its start as one day", () => {
    expect(placed([google(googleAllDay("odd", D21, D19))])).toEqual(days({ [D21]: ["odd"] }));
  });

  it("does not leak a Google exclusive end into the first day of the range", () => {
    expect(placed([google(googleAllDay("before", D18, D20))])).toEqual(days());
  });
});

describe("itemsInRange — timed Events cover the days of their instants, in the owner's zone", () => {
  it("lists a timed local Event on its one day", () => {
    expect(placed([localSpan("x", [D21, "09:30"], [D21, "10:30"])])).toEqual(
      days({ [D21]: ["x"] }),
    );
  });

  it("lists a timed Event that crosses midnight on both days", () => {
    expect(placed([localSpan("late", [D20, "23:00"], [D21, "01:00"])])).toEqual(
      days({ [D20]: ["late"], [D21]: ["late"] }),
    );
  });

  it("does not list an Event that ends exactly at 00:00 on the next day", () => {
    expect(placed([localSpan("edge", [D20, "22:00"], [D21, "00:00"])])).toEqual(
      days({ [D20]: ["edge"] }),
    );
  });

  it("lists an Event that ends one second after midnight on the next day too", () => {
    const end = spSeconds(D21, "00:00") + 1;
    const item = local(localTimed("spill", spSeconds(D20, "22:00"), end));

    expect(placed([item])).toEqual(days({ [D20]: ["spill"], [D21]: ["spill"] }));
  });

  it("keeps an Event that ends one second before midnight on its own day", () => {
    const end = spSeconds(D21, "00:00") - 1;
    const item = local(localTimed("tight", spSeconds(D20, "22:00"), end));

    expect(placed([item])).toEqual(days({ [D20]: ["tight"] }));
  });

  it("lists a zero-duration Event on its start day only", () => {
    expect(placed([localSpan("blip", [D21, "08:00"], [D21, "08:00"])])).toEqual(
      days({ [D21]: ["blip"] }),
    );
  });

  it("reads an end before the start as the start's own day, without throwing", () => {
    expect(placed([localSpan("odd", [D21, "08:00"], [D20, "08:00"])])).toEqual(
      days({ [D21]: ["odd"] }),
    );
  });

  it("lists a timed Event on every day from its start day to the day of its last instant", () => {
    expect(placed([localSpan("conference", [D20, "10:00"], [D22, "09:00"])])).toEqual(
      days({ [D20]: ["conference"], [D21]: ["conference"], [D22]: ["conference"] }),
    );
  });

  it("lists, inside the range, the part of an Event that began before it", () => {
    expect(placed([localSpan("overnight", [D19, "22:00"], [D20, "02:00"])])).toEqual(
      days({ [D20]: ["overnight"] }),
    );
  });

  it("omits an Event that ends exactly at the first instant of the range", () => {
    expect(placed([localSpan("before", [D19, "22:00"], [D20, "00:00"])])).toEqual(days());
  });

  it("omits an Event that starts exactly at the first instant after the range", () => {
    expect(placed([localSpan("after", [D23, "00:00"], [D23, "01:00"])])).toEqual(days());
  });

  it("puts an Event that starts at local midnight on that day, not on the day before", () => {
    expect(placed([localSpan("midnight", [D21, "00:00"], [D21, "01:00"])])).toEqual(
      days({ [D21]: ["midnight"] }),
    );
  });

  it("puts a late-evening local Event on its LOCAL day, not on the UTC one", () => {
    // 22:00 in São Paulo is 01:00 UTC on the 21st.
    expect(placed([localSpan("night", [D20, "22:00"], [D20, "23:00"])])).toEqual(
      days({ [D20]: ["night"] }),
    );
  });

  it("puts a Google event at 00:30 UTC on the previous LOCAL day", () => {
    // 2026-10-21T00:30Z is 21:30 on the 20th in São Paulo (the mirror of the case above).
    const item = google(
      googleTimed("utc-early", Date.UTC(2026, 9, 21, 0, 30), Date.UTC(2026, 9, 21, 1, 30)),
    );

    expect(placed([item])).toEqual(days({ [D20]: ["utc-early"] }));
  });

  it("lists a Google event that crosses midnight on both days", () => {
    expect(placed([googleSpan("late", [D20, "23:00"], [D21, "01:00"])])).toEqual(
      days({ [D20]: ["late"], [D21]: ["late"] }),
    );
  });

  it("does not list a Google event that ends exactly at 00:00 on the next day", () => {
    expect(placed([googleSpan("edge", [D20, "22:00"], [D21, "00:00"])])).toEqual(
      days({ [D20]: ["edge"] }),
    );
  });

  it("reads a Google timed event with a mismatched end as ending at its start, without throwing", () => {
    // A timed start whose end is a date: nothing to span with, so the start's day only.
    const odd = google(
      googleTimed("mismatch", spMillis(D21, "09:00"), spMillis(D21, "10:00"), {
        end: { date: D22 },
      }),
    );

    expect(placed([odd])).toEqual(days({ [D21]: ["mismatch"] }));
  });

  it("reads a Google timed event whose end is before its start as its start's day only", () => {
    expect(placed([googleSpan("odd", [D21, "08:00"], [D20, "08:00"])])).toEqual(
      days({ [D21]: ["odd"] }),
    );
  });
});

describe("itemsInRange — the order within a day (plan decision D3-4)", () => {
  it("puts all-day items first, then timed items by start, then open Tasks", () => {
    const answer = itemsInRange(
      [
        source("local", [
          localSpan("lt-0800", [D20, "08:00"], [D20, "09:00"]),
          local(localAllDay("la-1", D20, D21)),
        ]),
        source("google", [
          googleSpan("gt-0900", [D20, "09:00"], [D20, "10:00"]),
          google(googleAllDay("ga-1", D20)),
          googleSpan("gt-0730", [D20, "07:30"], [D20, "08:00"]),
        ]),
        source("tasks", [
          openTask("t-1", { deadline: D20 }),
          openTask("t-2", { scheduledDate: D20 }),
        ]),
      ],
      RANGE,
    );

    expect(layout(answer)[D20]).toEqual([
      "la-1",
      "ga-1",
      "gt-0730",
      "lt-0800",
      "gt-0900",
      "t-1",
      "t-2",
    ]);
  });

  it("sorts timed items by start whatever order they arrived in", () => {
    const items = [
      localSpan("afternoon", [D21, "15:00"], [D21, "16:00"]),
      localSpan("morning", [D21, "09:00"], [D21, "10:00"]),
      localSpan("noon", [D21, "12:00"], [D21, "13:00"]),
    ];

    expect(placed(items)[D21]).toEqual(["morning", "noon", "afternoon"]);
  });

  it("keeps tied starts in arrival order, not id order", () => {
    // test/agenda.test.ts:150-159 pins this for the shipped Agenda; the range function must agree.
    const items = [
      localSpan("zzz-first", [D21, "10:00"], [D21, "11:00"]),
      localSpan("aaa-second", [D21, "10:00"], [D21, "11:00"]),
    ];

    expect(placed(items)[D21]).toEqual(["zzz-first", "aaa-second"]);
  });

  it("breaks a tie between a local and a Google item by the source's position", () => {
    const l = localSpan("l-tie", [D21, "10:00"], [D21, "11:00"]);
    const g = googleSpan("g-tie", [D21, "10:00"], [D21, "11:00"]);

    expect(layout(itemsInRange([source("local", [l]), source("google", [g])], RANGE))[D21]).toEqual(
      ["l-tie", "g-tie"],
    );
    expect(layout(itemsInRange([source("google", [g]), source("local", [l])], RANGE))[D21]).toEqual(
      ["g-tie", "l-tie"],
    );
  });

  it("keeps all-day items in arrival order, local and Google alike", () => {
    const items = [
      google(googleAllDay("z-google", D21)),
      local(localAllDay("a-local", D21, D22)),
      google(googleAllDay("m-google", D21)),
    ];

    expect(placed(items)[D21]).toEqual(["z-google", "a-local", "m-google"]);
  });

  it("keeps Tasks in arrival order, not title or id order", () => {
    const items = [
      openTask("t-b", { deadline: D21 }),
      openTask("t-a", { deadline: D21 }),
      openTask("t-c", { scheduledDate: D21 }),
    ];

    expect(placed(items)[D21]).toEqual(["t-b", "t-a", "t-c"]);
  });

  it("puts Tasks last however they arrived among the other items", () => {
    const items = [
      openTask("t-first", { deadline: D21 }),
      localSpan("early", [D21, "00:05"], [D21, "00:10"]),
      local(localAllDay("holiday", D21, D22)),
    ];

    expect(placed(items)[D21]).toEqual(["holiday", "early", "t-first"]);
  });

  it("sorts the continuation of an earlier day by its real start, ahead of everything that starts on the day", () => {
    // `overnight` began at 23:00 on the 20th; on the 21st it must sort before an item that starts
    // at 00:15, which in turn sorts before one at 08:00.
    const items = [
      localSpan("eight", [D21, "08:00"], [D21, "09:00"]),
      googleSpan("quarter-past-midnight", [D21, "00:15"], [D21, "00:45"]),
      localSpan("overnight", [D20, "23:00"], [D21, "01:00"]),
    ];

    const answer = layout(itemsInRange([source("all", items)], RANGE));

    expect(answer[D20]).toEqual(["overnight"]);
    expect(answer[D21]).toEqual(["overnight", "quarter-past-midnight", "eight"]);
  });

  it("keeps a multi-day all-day Event ahead of the timed items on its later days", () => {
    const items = [
      localSpan("meeting", [D21, "09:00"], [D21, "10:00"]),
      local(localAllDay("retreat", D20, D23)),
    ];

    expect(placed(items)).toEqual(
      days({ [D20]: ["retreat"], [D21]: ["retreat", "meeting"], [D22]: ["retreat"] }),
    );
  });
});

describe("itemsInRange — open Tasks are day-level items (PRD AC-22)", () => {
  it("places a Task on its deadline, or else on its scheduled date", () => {
    const items = [
      openTask("by-deadline", { deadline: D21 }),
      openTask("by-schedule", { scheduledDate: D22 }),
    ];

    expect(placed(items)).toEqual(days({ [D21]: ["by-deadline"], [D22]: ["by-schedule"] }));
  });

  it("uses the deadline when a Task somehow carries both dates", () => {
    expect(placed([openTask("both", { deadline: D21, scheduledDate: D22 })])).toEqual(
      days({ [D21]: ["both"] }),
    );
  });

  it("places a Task on one day only, never spread over a span", () => {
    expect(placed([openTask("one-day", { deadline: D21 })])).toEqual(days({ [D21]: ["one-day"] }));
  });

  it("omits closed Tasks, done and missed alike, even when dated inside the range", () => {
    const items = [
      dayItemFromTask(task("done", { status: "done", deadline: D21 })),
      dayItemFromTask(task("missed", { status: "missed", deadline: D21 })),
      openTask("open", { deadline: D21 }),
    ];

    expect(placed(items)).toEqual(days({ [D21]: ["open"] }));
  });

  it("omits an undated Task", () => {
    expect(placed([openTask("whenever")])).toEqual(days());
  });

  it("omits open Tasks dated outside the range, including an overdue one", () => {
    const items = [
      openTask("overdue", { deadline: D19 }),
      openTask("later", { scheduledDate: D23 }),
    ];

    expect(placed(items)).toEqual(days());
  });
});

describe("itemsInRange — items outside the range are absent", () => {
  it("omits everything that lies wholly before or after the range", () => {
    const outside = [
      local(localAllDay("all-day-before", D17, D20)),
      localSpan("ends-at-range-start", [D19, "20:00"], [D20, "00:00"]),
      googleSpan("google-before", [D19, "10:00"], [D19, "11:00"]),
      google(googleAllDay("google-all-day-before", D19)),
      local(localAllDay("all-day-after", D23, D24)),
      localSpan("starts-after-range", [D23, "00:00"], [D23, "01:00"]),
      googleSpan("google-after", [D23, "09:00"], [D23, "10:00"]),
      openTask("overdue", { deadline: D19 }),
      openTask("later", { deadline: D23 }),
    ];

    expect(placed(outside)).toEqual(days());
  });

  it("includes an item on the very first and the very last day of the range", () => {
    const edges = [
      localSpan("first-instant", [D20, "00:00"], [D20, "00:30"]),
      localSpan("last-minute", [D22, "23:30"], [D22, "23:59"]),
    ];

    expect(placed(edges)).toEqual(days({ [D20]: ["first-instant"], [D22]: ["last-minute"] }));
  });

  it("returns entries for the days of the range and for no other day", () => {
    const answer = itemsInRange([source("all", [local(localAllDay("long", D17, D24))])], RANGE);

    expect(daysOf(answer)).toEqual([D20, D21, D22]);
  });
});

describe("itemsInRange — a future day (the pure slice of PRD AC-25)", () => {
  const NEXT_TUESDAY = "2026-10-27";

  it("lists a commitment created for next Tuesday on that Tuesday's range and not on today's", () => {
    const dentist = localSpan("dentist", [NEXT_TUESDAY, "10:00"], [NEXT_TUESDAY, "11:00"]);
    const sources = [source("local", [dentist])];

    expect(layout(itemsInRange(sources, { from: NEXT_TUESDAY, to: NEXT_TUESDAY }))).toEqual({
      [NEXT_TUESDAY]: ["dentist"],
    });
    expect(layout(itemsInRange(sources, { from: D20, to: D20 }))).toEqual({ [D20]: [] });
  });
});

describe("itemsInRange — output and purity", () => {
  it("returns the very DayItem objects it was given, never copies", () => {
    const retreat = local(localAllDay("retreat", D20, D22));
    const meeting = googleSpan("meeting", [D21, "09:00"], [D21, "10:00"]);
    const chore = openTask("chore", { deadline: D21 });

    const answer = itemsInRange([source("all", [retreat, meeting, chore])], RANGE);

    const [first, second] = answer;
    expect(first?.items[0]).toBe(retreat);
    // The same multi-day item is the same object on every day it covers.
    expect(second?.items[0]).toBe(retreat);
    expect(second?.items[1]).toBe(meeting);
    expect(second?.items[2]).toBe(chore);
  });

  it("does not mutate the sources or their item lists", () => {
    const items = Object.freeze([
      localSpan("b", [D21, "15:00"], [D21, "16:00"]),
      localSpan("a", [D21, "09:00"], [D21, "10:00"]),
      openTask("t", { deadline: D21 }),
    ]);
    const sources = Object.freeze([Object.freeze(source("all", items))]);

    // A frozen list makes an in-place `sort()` throw, so passing it is the assertion.
    expect(() => itemsInRange(sources, RANGE)).not.toThrow();
    expect(idsOf(items)).toEqual(["b", "a", "t"]);
  });

  it("is deterministic — the same input gives the same answer every time", () => {
    const items = [
      localSpan("x", [D21, "09:00"], [D21, "10:00"]),
      google(googleAllDay("y", D20, D22)),
    ];

    expect(itemsInRange([source("all", items)], RANGE)).toEqual(
      itemsInRange([source("all", items)], RANGE),
    );
  });

  it("reads no clock", () => {
    const items = [
      localSpan("night", [D20, "23:00"], [D21, "01:00"]),
      google(googleAllDay("trip", D20, D23)),
      openTask("chore", { deadline: D21 }),
    ];

    // Inside the guard, `Date.now()` and `new Date()` throw; only an explicit instant works.
    const guarded = withoutClock(() => itemsInRange([source("all", items)], RANGE));

    expect(guarded).toEqual(itemsInRange([source("all", items)], RANGE));
    expect(layout(guarded)).toEqual(
      days({ [D20]: ["trip", "night"], [D21]: ["trip", "night", "chore"], [D22]: ["trip"] }),
    );
  });

  it("is checked by a guard that really blocks the clock (so the case above is not vacuous)", () => {
    const probe = withoutClock(() => {
      const blocked = (read: () => unknown): boolean => {
        try {
          read();
          return false;
        } catch {
          return true;
        }
      };
      return {
        now: blocked(() => Date.now()),
        bare: blocked(() => new Date()),
        explicit: new Date(86_400_000).getTime(),
        utc: Date.UTC(1970, 0, 2),
      };
    });

    expect(probe).toEqual({ now: true, bare: true, explicit: 86_400_000, utc: 86_400_000 });
    // And the real clock is back afterwards.
    expect(Number.isFinite(Date.now())).toBe(true);
  });
});

describe("dayItemPlacement — the one seconds/milliseconds seam", () => {
  it("places the same moment identically whether it arrives in seconds or in milliseconds", () => {
    const cases: [string, Moment, Moment][] = [
      ["an ordinary morning", [D21, "09:30"], [D21, "10:30"]],
      ["a late evening (01:00 UTC the next day)", [D20, "22:00"], [D20, "23:00"]],
      ["crossing midnight", [D20, "23:00"], [D21, "01:00"]],
      ["ending exactly at midnight", [D20, "22:00"], [D21, "00:00"]],
      ["spanning three days", [D20, "10:00"], [D22, "09:00"]],
      ["zero duration", [D21, "08:00"], [D21, "08:00"]],
    ];

    for (const [label, start, end] of cases) {
      const fromSeconds = dayItemPlacement(localSpan("x", start, end));
      const fromMillis = dayItemPlacement(googleSpan("x", start, end));

      expect(fromSeconds, label).not.toBeNull();
      expect(fromSeconds, label).toEqual(fromMillis);
    }
  });

  it("describes a timed item by its start and end in milliseconds and its first and last day", () => {
    const placement = dayItemPlacement(localSpan("x", [D20, "09:30"], [D20, "10:30"]));

    expect(placement).toEqual({
      kind: "timed",
      startMs: spMillis(D20, "09:30"),
      endMs: spMillis(D20, "10:30"),
      firstDay: D20,
      lastDay: D20,
    });
  });

  it("names the last day of a timed item by its last instant, not its end instant", () => {
    const crossing = dayItemPlacement(localSpan("a", [D20, "23:00"], [D21, "01:00"]));
    const ending = dayItemPlacement(localSpan("b", [D20, "22:00"], [D21, "00:00"]));

    expect(crossing).toMatchObject({ kind: "timed", firstDay: D20, lastDay: D21 });
    expect(ending).toMatchObject({ kind: "timed", firstDay: D20, lastDay: D20 });
  });

  it("keeps a zero-duration or backwards timed item on its start day", () => {
    expect(dayItemPlacement(localSpan("a", [D21, "08:00"], [D21, "08:00"]))).toMatchObject({
      kind: "timed",
      firstDay: D21,
      lastDay: D21,
    });
    expect(dayItemPlacement(localSpan("b", [D21, "08:00"], [D20, "08:00"]))).toMatchObject({
      kind: "timed",
      firstDay: D21,
      lastDay: D21,
    });
  });

  it("describes an all-day item by its first day and its INCLUSIVE last day", () => {
    expect(dayItemPlacement(local(localAllDay("a", D20, D23)))).toEqual({
      kind: "allDay",
      firstDay: D20,
      lastDay: D22,
    });
    expect(dayItemPlacement(local(localAllDay("b", D20, D21)))).toEqual({
      kind: "allDay",
      firstDay: D20,
      lastDay: D20,
    });
  });

  it("places an all-day item the same whether it is local or Google", () => {
    const spans: [string, string][] = [
      [D20, D23],
      [D20, D21],
      [D20, D20],
      [D21, D19],
      ["2026-10-31", "2026-11-02"],
    ];

    for (const [start, end] of spans) {
      const fromLocal = dayItemPlacement(local(localAllDay("x", start, end)));
      const fromGoogle = dayItemPlacement(google(googleAllDay("x", start, end)));

      expect(fromLocal, `${start} to ${end}`).not.toBeNull();
      expect(fromLocal, `${start} to ${end}`).toEqual(fromGoogle);
    }
  });

  it("reads an all-day end that is not after its start as the start day alone", () => {
    expect(dayItemPlacement(local(localAllDay("a", D21, D21)))).toEqual({
      kind: "allDay",
      firstDay: D21,
      lastDay: D21,
    });
    expect(dayItemPlacement(google(googleAllDay("b", D21, D19)))).toEqual({
      kind: "allDay",
      firstDay: D21,
      lastDay: D21,
    });
  });

  it("places an open dated Task on its due day", () => {
    expect(dayItemPlacement(openTask("t", { deadline: D21 }))).toEqual({ kind: "task", day: D21 });
    expect(dayItemPlacement(openTask("s", { scheduledDate: D22 }))).toEqual({
      kind: "task",
      day: D22,
    });
  });

  it("places no closed Task and no undated Task", () => {
    expect(
      dayItemPlacement(dayItemFromTask(task("d", { status: "done", deadline: D21 }))),
    ).toBeNull();
    expect(
      dayItemPlacement(dayItemFromTask(task("m", { status: "missed", deadline: D21 }))),
    ).toBeNull();
    expect(dayItemPlacement(openTask("u"))).toBeNull();
  });
});
