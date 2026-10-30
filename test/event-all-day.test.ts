// PRPs/prds/events-and-day-view.prd.md AC-2 All-day days
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A2; Task 3 — the local-day arithmetic and the all-day exclusive end; Task 4 —
// `resolveEventTimes` for the stored-span rule).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `src/shared/events.ts`
// does not exist yet, so this file is expected to be RED for the right reason — the
// module import cannot be resolved — until plan Tasks 3 and 4 land.
//
// What is being protected: Google stores an all-day event's END as the day AFTER its
// last day (an exclusive end). The owner thinks in the inclusive last day. Two helpers
// convert between the two, and a conversion that is off by one shows a commitment on
// the wrong day, so every boundary — month, year, leap day — is exercised on both
// directions, plus the round trip between them.

import { describe, expect, it } from "vitest";
import {
  allDaySpanFromInclusive,
  displayEndDay,
  isValidLocalDay,
  resolveEventTimes,
  shiftLocalDay,
} from "../src/shared/events";

describe("AC-2 — the owner's inclusive last day becomes the exclusive stored end", () => {
  it("turns Monday 2026-10-26 through Tuesday 2026-10-27 into end 2026-10-28", () => {
    expect(allDaySpanFromInclusive("2026-10-26", "2026-10-27")).toEqual({
      ok: true,
      value: { startDate: "2026-10-26", endDate: "2026-10-28" },
    });
  });

  it.each<[string, string | null | undefined]>([
    ["no last day at all", undefined],
    ["a null last day", null],
    ["a last day equal to the start", "2026-10-20"],
  ])("stores a single day 2026-10-20 with end 2026-10-21 given %s", (_label, lastDay) => {
    expect(allDaySpanFromInclusive("2026-10-20", lastDay)).toEqual({
      ok: true,
      value: { startDate: "2026-10-20", endDate: "2026-10-21" },
    });
  });

  it.each([
    ["a month boundary", "2026-10-31", "2026-11-01"],
    ["a year boundary", "2026-12-31", "2027-01-01"],
    ["the end of a non-leap February", "2026-02-28", "2026-03-01"],
    ["a leap day", "2028-02-29", "2028-03-01"],
  ])("rolls a single day over %s", (_label, day, expectedEnd) => {
    expect(allDaySpanFromInclusive(day)).toEqual({
      ok: true,
      value: { startDate: day, endDate: expectedEnd },
    });
  });

  it("rolls a multi-day span's exclusive end over a year boundary", () => {
    expect(allDaySpanFromInclusive("2026-12-30", "2026-12-31")).toEqual({
      ok: true,
      value: { startDate: "2026-12-30", endDate: "2027-01-01" },
    });
  });

  it("refuses a last day before the start, naming endDate", () => {
    expect(allDaySpanFromInclusive("2026-10-26", "2026-10-25")).toEqual({
      ok: false,
      error: { field: "endDate", code: "end_not_after_start" },
    });
  });

  it("refuses a start that is not a real calendar day, naming startDate", () => {
    expect(allDaySpanFromInclusive("2026-02-30")).toEqual({
      ok: false,
      error: { field: "startDate", code: "invalid_date" },
    });
  });
});

describe("AC-2 — the display helper returns the inclusive last day", () => {
  it.each([
    ["an ordinary day", "2026-10-28", "2026-10-27"],
    ["the first day of a month", "2026-11-01", "2026-10-31"],
    ["the first day of a year", "2027-01-01", "2026-12-31"],
    ["the day after a leap day", "2028-03-01", "2028-02-29"],
  ])("shows the stored end of %s as the day before it", (_label, storedEnd, expectedLastDay) => {
    expect(displayEndDay(storedEnd)).toBe(expectedLastDay);
  });

  it("undoes the conversion the form makes, for a single day and for a span", () => {
    const cases: Array<[string, string]> = [
      ["2026-10-20", "2026-10-20"],
      ["2026-10-26", "2026-10-27"],
      ["2026-12-30", "2027-01-02"],
      ["2028-02-27", "2028-03-01"],
    ];
    for (const [startDate, lastDay] of cases) {
      const span = allDaySpanFromInclusive(startDate, lastDay);
      if (!span.ok) throw new Error(`expected a valid span for ${startDate}..${lastDay}`);
      expect(displayEndDay(span.value.endDate)).toBe(lastDay);
    }
  });
});

describe("AC-2 — resolving an all-day span rejects an end that is not after its start", () => {
  it("accepts an end exactly one day after the start", () => {
    expect(
      resolveEventTimes({ allDay: true, startDate: "2026-10-20", endDate: "2026-10-21" }),
    ).toEqual({
      ok: true,
      value: {
        allDay: true,
        startAt: null,
        endAt: null,
        startDate: "2026-10-20",
        endDate: "2026-10-21",
      },
    });
  });

  it("accepts a multi-day span and keeps its exclusive end as given", () => {
    expect(
      resolveEventTimes({ allDay: true, startDate: "2026-10-26", endDate: "2026-10-28" }),
    ).toEqual({
      ok: true,
      value: {
        allDay: true,
        startAt: null,
        endAt: null,
        startDate: "2026-10-26",
        endDate: "2026-10-28",
      },
    });
  });

  it.each([
    ["equal to the start", "2026-10-20"],
    ["before the start", "2026-10-19"],
  ])("rejects an end %s with end_not_after_start on endDate", (_label, endDate) => {
    expect(resolveEventTimes({ allDay: true, startDate: "2026-10-20", endDate })).toEqual({
      ok: false,
      error: { field: "endDate", code: "end_not_after_start" },
    });
  });
});

describe("AC-2 — the local-day helpers behind the span", () => {
  it.each<[string, string, boolean]>([
    ["an ordinary day", "2026-10-20", true],
    ["a leap day in a leap year", "2028-02-29", true],
    ["the last day of a year", "2026-12-31", true],
    ["February 30th", "2026-02-30", false],
    ["a leap day in a non-leap year", "2026-02-29", false],
    ["month 13", "2026-13-01", false],
    ["day 0", "2026-10-00", false],
    ["a day without zero padding", "2026-1-5", false],
    ["a date with a time attached", "2026-10-20T00:00", false],
    ["text that is not a date", "abc", false],
    ["an empty string", "", false],
  ])("judges %s (%s) as valid=%s", (_label, day, expected) => {
    expect(isValidLocalDay(day)).toBe(expected);
  });

  it.each<[string, string, number, string]>([
    ["forward within a month", "2026-10-20", 1, "2026-10-21"],
    ["forward over a month boundary", "2026-10-31", 1, "2026-11-01"],
    ["forward over a year boundary", "2026-12-31", 1, "2027-01-01"],
    ["forward over a leap day", "2028-02-28", 2, "2028-03-01"],
    ["backward over a month boundary", "2026-11-01", -1, "2026-10-31"],
    ["by zero days", "2026-10-20", 0, "2026-10-20"],
  ])("shifts %s", (_label, day, delta, expected) => {
    expect(shiftLocalDay(day, delta)).toBe(expected);
  });
});
