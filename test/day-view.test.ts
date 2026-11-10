// PRPs/prds/events-and-day-view.prd.md AC-24 The day route (the decidable half of a manual AC)
// PRPs/prds/events-and-day-view.prd.md AC-25 Future days and degraded Google (the request shapes)
//
// Source plan: PRPs/plans/events-and-day-view-phase-3-the-range-function-and-the-day.plan.md
// (Task 6 — src/shared/day-view.ts and the `ALL_DAY_LABEL` export in src/shared/format.ts;
// plan AC-A5).
//
// `DayScreen` is verified by eye in the browser pane and on the device
// (`docs/context/methodology.md`: UI stays manual), so the screen's DECISIONS are extracted into
// this pure module and tested here: the heading, the neighbouring days, whether the *Hoje* control
// shows, what each row's time column reads, how the rows split into sections, the empty text, and
// the two request paths. Everything here can be wrong silently — a heading a day off, a label that
// drifts from the Google row's, a request that quietly changes the unit-4 URL.
//
// Beyond the PRD text, pinned because the plan fixes it (each one named so the reviewer can
// overrule it): the exact time-label vocabulary (`HH:mm`, `HH:mm–HH:mm` with U+2013 and no spaces,
// `até HH:mm` for the continuation of an earlier day — new copy the plan flags for the owner,
// decision D3-10), the year appearing in the heading only when it differs from today's, the
// section split by placement kind, and the literal request paths. A Google item that starts on
// the day must read EXACTLY as `formatEventTime` reads it today, so the two cannot drift.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): src/shared/day-view.ts
// does not exist and `ALL_DAY_LABEL` is not exported yet, so this file is RED for the right
// reason (module-not-found on the import below) until plan Task 6 lands.

import { describe, expect, it } from "vitest";
import { dayItemFromEvent, dayItemFromLocalEvent, dayItemFromTask } from "../src/shared/day-item";
import { itemsInRange } from "../src/shared/day-range";
import {
  DAY_VIEW_EMPTY,
  adjacentDays,
  eventsRangePath,
  formatDayHeading,
  formatDayItemTime,
  googleEventsPath,
  showTodayControl,
  splitDayItems,
} from "../src/shared/day-view";
import { ALL_DAY_LABEL, formatEventTime } from "../src/shared/format";
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

const [D19, D20, D21, D22] = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"] as const;

/** U+2013, the range separator: no spaces around it. */
const EN_DASH = "–";

type Moment = readonly [day: string, time: string];

function localItem(id: string, start: Moment, end: Moment) {
  return dayItemFromLocalEvent(localTimed(id, spSeconds(...start), spSeconds(...end)));
}

function googleItem(id: string, start: Moment, end: Moment) {
  return dayItemFromEvent(googleTimed(id, spMillis(...start), spMillis(...end)));
}

describe("the day view's copy", () => {
  it("says an empty day reads 'Nada neste dia.'", () => {
    expect(DAY_VIEW_EMPTY).toBe("Nada neste dia.");
  });

  it("exports the all-day label the Google row already uses, so the two cannot drift", () => {
    expect(ALL_DAY_LABEL).toBe("dia todo");
    expect(formatEventTime({ date: D20 })).toBe(ALL_DAY_LABEL);
  });
});

describe("formatDayHeading — the pt-BR long date", () => {
  it("spells out the weekday, the day and the month, with no year in the current year", () => {
    expect(formatDayHeading("2026-10-20", "2026-10-19")).toBe("terça-feira, 20 de outubro");
  });

  it("reads the same for today as for any other day of the year", () => {
    expect(formatDayHeading("2026-10-20", "2026-10-20")).toBe("terça-feira, 20 de outubro");
  });

  it("adds the year when it differs from today's, in the past", () => {
    expect(formatDayHeading("2026-10-20", "2027-01-05")).toBe("terça-feira, 20 de outubro de 2026");
    expect(formatDayHeading("2025-12-31", "2026-01-01")).toBe(
      "quarta-feira, 31 de dezembro de 2025",
    );
  });

  it("adds the year when it differs from today's, in the future", () => {
    expect(formatDayHeading("2027-01-01", "2026-12-31")).toBe("sexta-feira, 1 de janeiro de 2027");
  });

  it("compares the YEAR only, so the first and last day of a year read alike", () => {
    expect(formatDayHeading("2026-01-01", "2026-12-31")).toBe("quinta-feira, 1 de janeiro");
  });

  it("does not zero-pad the day of the month", () => {
    expect(formatDayHeading("2026-10-05", "2026-10-20")).toBe("segunda-feira, 5 de outubro");
  });

  it("is the longest heading the screen has to fit, spelled out", () => {
    // `quarta-feira, 30 de setembro de 2026` is the width case the live-pass protocol measures.
    expect(formatDayHeading("2026-09-30", "2027-03-01")).toBe(
      "quarta-feira, 30 de setembro de 2026",
    );
  });

  it("reads no clock — today is an argument", () => {
    const guarded = withoutClock(() => formatDayHeading("2026-10-20", "2026-10-19"));

    expect(guarded).toBe("terça-feira, 20 de outubro");
  });
});

describe("adjacentDays — the neighbours the arrows step to", () => {
  it("gives the day before and the day after", () => {
    expect(adjacentDays("2026-10-20")).toEqual({ previous: "2026-10-19", next: "2026-10-21" });
  });

  it("crosses a month boundary in both directions", () => {
    expect(adjacentDays("2026-10-01").previous).toBe("2026-09-30");
    expect(adjacentDays("2026-10-31").next).toBe("2026-11-01");
    expect(adjacentDays("2026-03-01").previous).toBe("2026-02-28");
  });

  it("crosses a year boundary in both directions", () => {
    expect(adjacentDays("2026-01-01").previous).toBe("2025-12-31");
    expect(adjacentDays("2026-12-31").next).toBe("2027-01-01");
  });

  it("knows leap days", () => {
    expect(adjacentDays("2028-02-28").next).toBe("2028-02-29");
    expect(adjacentDays("2028-03-01").previous).toBe("2028-02-29");
    expect(adjacentDays("2027-02-28").next).toBe("2027-03-01");
  });

  it("reads no clock", () => {
    expect(withoutClock(() => adjacentDays("2026-10-20"))).toEqual(adjacentDays("2026-10-20"));
  });
});

describe("showTodayControl — the Hoje button appears only when another date is shown", () => {
  it("is hidden on today", () => {
    expect(showTodayControl("2026-10-20", "2026-10-20")).toBe(false);
  });

  it("shows on a past day, a future day and an adjacent day", () => {
    expect(showTodayControl("2026-10-19", "2026-10-20")).toBe(true);
    expect(showTodayControl("2026-10-21", "2026-10-20")).toBe(true);
    expect(showTodayControl("2020-01-01", "2026-10-20")).toBe(true);
    expect(showTodayControl("2027-10-20", "2026-10-20")).toBe(true);
  });
});

describe("formatDayItemTime — what the time column reads", () => {
  describe("an all-day item", () => {
    it("reads the all-day label in both modes, on every day it covers", () => {
      const trip = dayItemFromLocalEvent(localAllDay("trip", D20, "2026-10-23"));

      for (const day of [D20, D21, D22]) {
        expect(formatDayItemTime(trip, day, "start")).toBe(ALL_DAY_LABEL);
        expect(formatDayItemTime(trip, day, "range")).toBe(ALL_DAY_LABEL);
      }
    });

    it("reads the same label for a Google all-day item as the Google row reads today", () => {
      const holiday = dayItemFromEvent(googleAllDay("holiday", D20));

      expect(formatDayItemTime(holiday, D20, "start")).toBe(ALL_DAY_LABEL);
      expect(formatDayItemTime(holiday, D20, "range")).toBe(ALL_DAY_LABEL);
      expect(formatDayItemTime(holiday, D20, "start")).toBe(formatEventTime({ date: D20 }));
    });
  });

  describe("a timed item that begins on the day", () => {
    it("reads HH:mm in start mode, in the owner's zone", () => {
      expect(formatDayItemTime(localItem("a", [D20, "09:30"], [D20, "10:30"]), D20, "start")).toBe(
        "09:30",
      );
      expect(formatDayItemTime(googleItem("b", [D20, "09:30"], [D20, "10:30"]), D20, "start")).toBe(
        "09:30",
      );
    });

    it("reads HH:mm–HH:mm in range mode, with an en dash and no spaces", () => {
      const expected = `09:30${EN_DASH}10:30`;

      expect(formatDayItemTime(localItem("a", [D20, "09:30"], [D20, "10:30"]), D20, "range")).toBe(
        expected,
      );
      expect(formatDayItemTime(googleItem("b", [D20, "09:30"], [D20, "10:30"]), D20, "range")).toBe(
        expected,
      );
    });

    it("reads the clock in São Paulo, not in UTC and not in the Event's own zone", () => {
      // 22:00 in São Paulo is 01:00 UTC; an Event authored in New York is still shown here.
      const night = localItem("night", [D20, "22:00"], [D20, "23:00"]);
      const newYork = dayItemFromLocalEvent(
        localTimed("ny", spSeconds(D20, "09:30"), spSeconds(D20, "10:30"), {
          timezone: "America/New_York",
        }),
      );

      expect(formatDayItemTime(night, D20, "start")).toBe("22:00");
      expect(formatDayItemTime(newYork, D20, "start")).toBe("09:30");
    });

    it("reads a bare HH:mm in range mode when the end is not after the start", () => {
      const zero = localItem("zero", [D20, "09:30"], [D20, "09:30"]);
      const zeroGoogle = googleItem("zero-g", [D20, "09:30"], [D20, "09:30"]);

      expect(formatDayItemTime(zero, D20, "range")).toBe("09:30");
      expect(formatDayItemTime(zeroGoogle, D20, "range")).toBe("09:30");
    });

    it("reads a Google item exactly as formatEventTime reads its start, so the two cannot drift", () => {
      for (const time of ["00:00", "07:05", "09:30", "12:00", "18:45", "22:00", "23:59"]) {
        const event = googleTimed("g", spMillis(D20, time), spMillis(D20, time) + 60_000);

        expect(formatDayItemTime(dayItemFromEvent(event), D20, "start"), time).toBe(
          formatEventTime(event.start),
        );
      }
    });

    it("reads an end at midnight as 00:00", () => {
      const evening = localItem("evening", [D20, "22:00"], [D21, "00:00"]);

      expect(formatDayItemTime(evening, D20, "range")).toBe(`22:00${EN_DASH}00:00`);
    });
  });

  describe("a timed item that crosses midnight", () => {
    it("reads its full range on the first day and 'até HH:mm' of its end on the second", () => {
      const late = localItem("late", [D20, "23:00"], [D21, "01:00"]);

      expect(formatDayItemTime(late, D20, "start")).toBe("23:00");
      expect(formatDayItemTime(late, D20, "range")).toBe(`23:00${EN_DASH}01:00`);
      expect(formatDayItemTime(late, D21, "start")).toBe("até 01:00");
      expect(formatDayItemTime(late, D21, "range")).toBe("até 01:00");
    });

    it("reads the same for a Google item", () => {
      const late = googleItem("late", [D20, "23:00"], [D21, "01:00"]);

      expect(formatDayItemTime(late, D20, "start")).toBe("23:00");
      expect(formatDayItemTime(late, D20, "range")).toBe(`23:00${EN_DASH}01:00`);
      expect(formatDayItemTime(late, D21, "start")).toBe("até 01:00");
      expect(formatDayItemTime(late, D21, "range")).toBe("até 01:00");
    });
  });

  it("reads no clock", () => {
    const late = localItem("late", [D20, "23:00"], [D21, "01:00"]);

    const guarded = withoutClock(() => formatDayItemTime(late, D21, "range"));

    expect(guarded).toBe("até 01:00");
  });
});

describe("splitDayItems — the three sections of the day", () => {
  const allDayLocal = dayItemFromLocalEvent(localAllDay("ad-local", D20, D21));
  const allDayGoogle = dayItemFromEvent(googleAllDay("ad-google", D20));
  const timedLate = localItem("timed-late", [D20, "15:00"], [D20, "16:00"]);
  const timedEarly = googleItem("timed-early", [D20, "09:00"], [D20, "10:00"]);
  const taskB = dayItemFromTask(task("task-b", { deadline: D20 }));
  const taskA = dayItemFromTask(task("task-a", { scheduledDate: D20 }));
  const done = dayItemFromTask(task("done", { status: "done", deadline: D20 }));
  const undated = dayItemFromTask(task("undated"));

  it("splits by kind: all-day, timed, and open Tasks", () => {
    const split = splitDayItems([allDayLocal, timedLate, taskB, allDayGoogle, timedEarly, taskA]);

    expect(idsOf(split.allDay)).toEqual(["ad-local", "ad-google"]);
    expect(idsOf(split.timed)).toEqual(["timed-late", "timed-early"]);
    expect(idsOf(split.tasks)).toEqual(["task-b", "task-a"]);
  });

  it("keeps each section's relative order — it splits, it never sorts", () => {
    // `timed-late` arrives before `timed-early`; ordering is itemsInRange's job, not this one's.
    const split = splitDayItems([timedLate, timedEarly, taskB, taskA]);

    expect(idsOf(split.timed)).toEqual(["timed-late", "timed-early"]);
    expect(idsOf(split.tasks)).toEqual(["task-b", "task-a"]);
  });

  it("returns the very objects it was given", () => {
    const split = splitDayItems([allDayLocal, timedEarly, taskA]);

    expect(split.allDay[0]).toBe(allDayLocal);
    expect(split.timed[0]).toBe(timedEarly);
    expect(split.tasks[0]).toBe(taskA);
  });

  it("drops what cannot be placed: a closed Task and an undated Task", () => {
    const split = splitDayItems([done, allDayLocal, undated, taskA]);

    expect(idsOf(split.allDay)).toEqual(["ad-local"]);
    expect(idsOf(split.tasks)).toEqual(["task-a"]);
    expect(split.timed).toEqual([]);
  });

  it("answers three empty sections for no items", () => {
    expect(splitDayItems([])).toEqual({ allDay: [], timed: [], tasks: [] });
  });

  it("does not mutate its input", () => {
    const input = Object.freeze([timedLate, allDayLocal, taskA]);

    expect(() => splitDayItems(input)).not.toThrow();
    expect(idsOf(input)).toEqual(["timed-late", "ad-local", "task-a"]);
  });

  it("turns one day of the range function into the screen's sections, all-day first and Tasks last", () => {
    const entries = itemsInRange(
      [
        {
          id: "local",
          items: [
            localItem("l-0900", [D21, "09:00"], [D21, "10:00"]),
            dayItemFromLocalEvent(localAllDay("l-allday", D21, D22)),
          ],
        },
        {
          id: "google",
          items: [
            googleItem("g-0800", [D21, "08:00"], [D21, "09:00"]),
            dayItemFromEvent(googleAllDay("g-allday", D21)),
          ],
        },
        { id: "tasks", items: [dayItemFromTask(task("t-1", { deadline: D21 }))] },
      ],
      { from: D21, to: D21 },
    );

    const split = splitDayItems(entries[0]?.items ?? []);

    expect(idsOf(split.allDay)).toEqual(["l-allday", "g-allday"]);
    expect(idsOf(split.timed)).toEqual(["g-0800", "l-0900"]);
    expect(idsOf(split.tasks)).toEqual(["t-1"]);
  });
});

describe("the request paths the day screen builds", () => {
  it("asks for the commitments of a day with from and to", () => {
    expect(eventsRangePath({ from: D20, to: D20 })).toBe(
      "/api/events?from=2026-10-20&to=2026-10-20",
    );
  });

  it("asks for a wider range with the same two parameters", () => {
    expect(eventsRangePath({ from: D19, to: D22 })).toBe(
      "/api/events?from=2026-10-19&to=2026-10-22",
    );
  });

  it("leaves the unit-4 Google request byte-identical when no range is given", () => {
    expect(googleEventsPath()).toBe("/api/google/events");
    expect(googleEventsPath(undefined)).toBe("/api/google/events");
  });

  it("narrows the Google request to the day with from and to", () => {
    expect(googleEventsPath({ from: D20, to: D20 })).toBe(
      "/api/google/events?from=2026-10-20&to=2026-10-20",
    );
  });
});
