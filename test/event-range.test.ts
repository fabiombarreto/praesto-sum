// PRPs/prds/events-and-day-view.prd.md AC-11 Range read (the range-validation half)
// PRPs/prds/events-and-day-view.prd.md AC-18 Google window and frozen contracts (the window
// validation half: a span over 31 days, or `to` before `from`, is refused)
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A3 and AC-A10; Task 2 — the pure module src/shared/event-range.ts that the events route
// and the Google route share, so the two cannot disagree about what a span is).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `src/shared/event-range.ts`
// does not exist yet, so this file is expected to be RED for the right reason — the module
// import cannot be resolved — until plan Task 2 lands.
//
// "Span" is the INCLUSIVE count of calendar days (orchestrator clarification 3, plan Notes):
// `from = to` is 1 day, 2026-10-20 to 2026-12-20 is 62 days and is accepted, 2026-12-21 is
// 63 and is refused; for the Google window 31 is accepted and 32 refused. The boundaries
// below are driven from those numbers, so an off-by-one in either direction fails here.
//
// Pure on purpose: the module reads no clock, so every case names its dates.

import { describe, expect, it } from "vitest";
import {
  dayRangeInstants,
  EVENT_RANGE_MAX_DAYS,
  GOOGLE_RANGE_MAX_DAYS,
  validateDayRange,
} from "../src/shared/event-range";

/** Epoch seconds of a UTC moment. */
function utc(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) / 1000;
}

describe("the two span limits (PRD AC-11, AC-18)", () => {
  it("allows 62 days for the events route and 31 for the Google window", () => {
    expect(EVENT_RANGE_MAX_DAYS).toBe(62);
    expect(GOOGLE_RANGE_MAX_DAYS).toBe(31);
  });
});

describe("validateDayRange — a span is an inclusive count of calendar days (AC-11, AC-18)", () => {
  it("counts a single day as a span of 1", () => {
    expect(validateDayRange("2026-10-20", "2026-10-20", EVENT_RANGE_MAX_DAYS)).toEqual({
      ok: true,
      from: "2026-10-20",
      to: "2026-10-20",
      days: 1,
    });
  });

  it("counts both ends: 2026-10-20 to 2026-10-21 is 2 days", () => {
    expect(validateDayRange("2026-10-20", "2026-10-21", EVENT_RANGE_MAX_DAYS)).toEqual({
      ok: true,
      from: "2026-10-20",
      to: "2026-10-21",
      days: 2,
    });
  });

  it("accepts exactly 62 days for events: 2026-10-20 to 2026-12-20", () => {
    expect(validateDayRange("2026-10-20", "2026-12-20", EVENT_RANGE_MAX_DAYS)).toEqual({
      ok: true,
      from: "2026-10-20",
      to: "2026-12-20",
      days: 62,
    });
  });

  it("refuses 63 days for events: 2026-10-20 to 2026-12-21, naming `to`", () => {
    expect(validateDayRange("2026-10-20", "2026-12-21", EVENT_RANGE_MAX_DAYS)).toEqual({
      ok: false,
      error: { param: "to", code: "too_long" },
    });
  });

  it("accepts exactly 31 days for the Google window: 2026-10-01 to 2026-10-31", () => {
    expect(validateDayRange("2026-10-01", "2026-10-31", GOOGLE_RANGE_MAX_DAYS)).toEqual({
      ok: true,
      from: "2026-10-01",
      to: "2026-10-31",
      days: 31,
    });
  });

  it("refuses 32 days for the Google window: 2026-10-01 to 2026-11-01, naming `to`", () => {
    expect(validateDayRange("2026-10-01", "2026-11-01", GOOGLE_RANGE_MAX_DAYS)).toEqual({
      ok: false,
      error: { param: "to", code: "too_long" },
    });
  });

  it("applies the limit it is given: the same 40 days pass at 62 and fail at 31", () => {
    const fortyDays = ["2026-10-01", "2026-11-09"] as const;

    expect(validateDayRange(fortyDays[0], fortyDays[1], EVENT_RANGE_MAX_DAYS)).toMatchObject({
      ok: true,
      days: 40,
    });
    expect(validateDayRange(fortyDays[0], fortyDays[1], GOOGLE_RANGE_MAX_DAYS)).toEqual({
      ok: false,
      error: { param: "to", code: "too_long" },
    });
  });

  it("counts calendar days across a leap day: 2028-02-01 to 2028-03-31 is 60", () => {
    expect(validateDayRange("2028-02-01", "2028-03-31", EVENT_RANGE_MAX_DAYS)).toMatchObject({
      ok: true,
      days: 60,
    });
  });

  it("counts calendar days across a year end: 2026-12-25 to 2027-01-05 is 12", () => {
    expect(validateDayRange("2026-12-25", "2027-01-05", EVENT_RANGE_MAX_DAYS)).toMatchObject({
      ok: true,
      days: 12,
    });
  });
});

interface Refusal {
  label: string;
  from: string | undefined;
  to: string | undefined;
  param: "from" | "to";
  code: string;
}

const REFUSALS: Refusal[] = [
  { label: "a missing from", from: undefined, to: "2026-10-21", param: "from", code: "required" },
  { label: "a missing to", from: "2026-10-20", to: undefined, param: "to", code: "required" },
  {
    label: "neither bound given (from is reported first)",
    from: undefined,
    to: undefined,
    param: "from",
    code: "required",
  },
  {
    label: "a from that is not a date",
    from: "tomorrow",
    to: "2026-10-21",
    param: "from",
    code: "invalid_date",
  },
  {
    label: "a from that is a real-looking but impossible day",
    from: "2026-02-30",
    to: "2026-10-21",
    param: "from",
    code: "invalid_date",
  },
  {
    label: "a from without zero padding",
    from: "2026-1-5",
    to: "2026-10-21",
    param: "from",
    code: "invalid_date",
  },
  {
    label: "a to that is not a date",
    from: "2026-10-20",
    to: "abc",
    param: "to",
    code: "invalid_date",
  },
  {
    label: "a to in month 13",
    from: "2026-10-20",
    to: "2026-13-01",
    param: "to",
    code: "invalid_date",
  },
  {
    label: "a bad from together with a missing to (from is reported first)",
    from: "abc",
    to: undefined,
    param: "from",
    code: "invalid_date",
  },
  {
    label: "a good from together with a bad to",
    from: "2026-10-20",
    to: "2026-02-30",
    param: "to",
    code: "invalid_date",
  },
  {
    label: "a to one day before from",
    from: "2026-10-21",
    to: "2026-10-20",
    param: "to",
    code: "to_before_from",
  },
  {
    label: "a to a year before from (reported as inverted, not as too long)",
    from: "2026-10-20",
    to: "2025-10-20",
    param: "to",
    code: "to_before_from",
  },
];

describe("validateDayRange — it names the first parameter it refuses and why (AC-11, AC-18)", () => {
  it.each(REFUSALS)("refuses $label", ({ from, to, param, code }) => {
    expect(validateDayRange(from, to, EVENT_RANGE_MAX_DAYS)).toEqual({
      ok: false,
      error: { param, code },
    });
  });

  it("refuses an empty from, naming `from`", () => {
    const result = validateDayRange("", "2026-10-21", EVENT_RANGE_MAX_DAYS);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { param: "from" } });
  });
});

describe("dayRangeInstants — the half-open interval of epoch seconds a day range covers", () => {
  it("covers 2026-10-20 to 2026-10-21 in America/Sao_Paulo as [20th 00:00, 22nd 00:00) local", () => {
    // São Paulo is UTC-3 all year since 2019, so local midnight is 03:00Z.
    expect(dayRangeInstants("2026-10-20", "2026-10-21")).toEqual({
      startAt: utc(2026, 10, 20, 3, 0),
      endAt: utc(2026, 10, 22, 3, 0),
    });
  });

  it("covers a single day as exactly 24 hours in a zone without a transition", () => {
    const { startAt, endAt } = dayRangeInstants("2026-10-20", "2026-10-20");

    expect(startAt).toBe(utc(2026, 10, 20, 3, 0));
    expect(endAt - startAt).toBe(86_400);
  });

  it("reads the days in the zone it is given: New York is UTC-4 in October", () => {
    expect(dayRangeInstants("2026-10-20", "2026-10-20", "America/New_York")).toEqual({
      startAt: utc(2026, 10, 20, 4, 0),
      endAt: utc(2026, 10, 21, 4, 0),
    });
  });

  it("makes the day the clocks go forward 23 hours long (New York, 2026-03-08)", () => {
    // 00:00 is still EST (UTC-5); the next midnight is EDT (UTC-4).
    expect(dayRangeInstants("2026-03-08", "2026-03-08", "America/New_York")).toEqual({
      startAt: utc(2026, 3, 8, 5, 0),
      endAt: utc(2026, 3, 9, 4, 0),
    });
  });

  it("makes the day the clocks go back 25 hours long (New York, 2026-11-01)", () => {
    // 00:00 is still EDT (UTC-4); the next midnight is EST (UTC-5).
    expect(dayRangeInstants("2026-11-01", "2026-11-01", "America/New_York")).toEqual({
      startAt: utc(2026, 11, 1, 4, 0),
      endAt: utc(2026, 11, 2, 5, 0),
    });
  });

  it("ends at the start of the day AFTER `to`, so two adjacent ranges tile without a gap or overlap", () => {
    const first = dayRangeInstants("2026-10-20", "2026-10-21");
    const second = dayRangeInstants("2026-10-22", "2026-10-23");

    expect(first.endAt).toBe(second.startAt);
  });
});
