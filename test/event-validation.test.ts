// PRPs/prds/events-and-day-view.prd.md AC-3 Defaults and validation
// PRPs/prds/events-and-day-view.prd.md AC-2 All-day days (the stored-span rule, validator half)
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A3 and the stored-span half of AC-A2; Task 4 — `resolveEventTimes`,
// `validateEventInput`, `isValidTimeZone` and the limits in src/shared/events.ts).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `src/shared/events.ts`
// does not exist yet, so this file is expected to be RED for the right reason — the
// module import cannot be resolved — until plan Task 4 lands.
//
// The validator is the single rule both the route (phase 2) and the sheet (phase 4)
// will share, so a result is judged whole: `{ ok: true, value }` or
// `{ ok: false, error: { field, code } }`. The error codes and field names are the
// vocabulary the plan fixes (Task 1 and Task 4); the prose shown to the owner is a
// later phase and is not asserted here.
//
// Only the numbers the PRD names are pinned as literals (title 200 / 201 characters,
// default duration 3600 s). The description and location limits are, by the PRD's own
// Open Questions, arbitrary constants that may change after use, so their boundaries are
// driven from the exported constants: "exactly the limit is accepted, one more is not".

import { describe, expect, it } from "vitest";
import { PRAESTO_TIMEZONE } from "../src/shared/dates";
import {
  EVENT_DEFAULT_DURATION_SECONDS,
  EVENT_DEFAULT_TIMEZONE,
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  isValidTimeZone,
  resolveEventTimes,
  validateEventInput,
} from "../src/shared/events";
import type { EventInput, ResolvedEvent } from "../src/shared/events";

/** 2026-10-20 09:30 America/Sao_Paulo, as epoch seconds. */
const START = Date.UTC(2026, 9, 20, 12, 30) / 1000;

function timed(overrides: Partial<EventInput> = {}): EventInput {
  return { title: "Dentista", allDay: false, startAt: START, ...overrides };
}

function allDay(overrides: Partial<EventInput> = {}): EventInput {
  return { title: "Feriado", allDay: true, startDate: "2026-10-26", ...overrides };
}

/** The resolved value of an input that must be valid; fails loudly with the error otherwise. */
function resolved(input: EventInput): ResolvedEvent {
  const result = validateEventInput(input);
  if (!result.ok) {
    throw new Error(`expected a valid event, got ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

describe("AC-3 — the documented limits", () => {
  it("caps a title at 200 characters", () => {
    expect(EVENT_TITLE_MAX).toBe(200);
  });

  it("defaults a missing end to one hour after the start", () => {
    expect(EVENT_DEFAULT_DURATION_SECONDS).toBe(3600);
  });

  it("resolves a missing zone in the same zone the recurrence series use", () => {
    expect(EVENT_DEFAULT_TIMEZONE).toBe(PRAESTO_TIMEZONE);
    expect(EVENT_DEFAULT_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("AC-3 — defaults", () => {
  it("gives a timed start with no end an end of start plus 3600 seconds", () => {
    expect(validateEventInput(timed())).toEqual({
      ok: true,
      value: {
        title: "Dentista",
        description: null,
        location: null,
        allDay: false,
        startAt: START,
        endAt: START + 3600,
        startDate: null,
        endDate: null,
        timezone: "America/Sao_Paulo",
      },
    });
  });

  it("treats a null end exactly like a missing one", () => {
    expect(resolved(timed({ endAt: null })).endAt).toBe(START + 3600);
  });

  it("keeps an end the owner gave, whatever its length", () => {
    expect(resolved(timed({ endAt: START + 5400 })).endAt).toBe(START + 5400);
  });

  it("gives an all-day start with no end the next day", () => {
    expect(validateEventInput(allDay({ startDate: "2026-10-26" }))).toEqual({
      ok: true,
      value: {
        title: "Feriado",
        description: null,
        location: null,
        allDay: true,
        startAt: null,
        endAt: null,
        startDate: "2026-10-26",
        endDate: "2026-10-27",
        timezone: "America/Sao_Paulo",
      },
    });
  });

  it.each([
    ["a month boundary", "2026-10-31", "2026-11-01"],
    ["a year boundary", "2026-12-31", "2027-01-01"],
  ])("rolls an all-day default end over %s", (_label, startDate, expectedEnd) => {
    expect(resolved(allDay({ startDate })).endDate).toBe(expectedEnd);
  });

  it("keeps the exclusive end an all-day caller gave", () => {
    expect(resolved(allDay({ endDate: "2026-10-28" })).endDate).toBe("2026-10-28");
  });

  it.each([
    ["omitted", {}],
    ["null", { timezone: null }],
  ] as const)("resolves a zone that is %s to America/Sao_Paulo", (_label, extra) => {
    expect(resolved(timed(extra)).timezone).toBe("America/Sao_Paulo");
  });

  it("keeps a zone the owner picked", () => {
    expect(resolved(timed({ timezone: "America/New_York" })).timezone).toBe("America/New_York");
  });
});

describe("AC-3 — what is accepted", () => {
  it("accepts a 200-character title", () => {
    expect(resolved(timed({ title: "a".repeat(200) })).title).toBe("a".repeat(200));
  });

  it("judges the length of the title after trimming, and stores it trimmed", () => {
    const padded = ` \t${"a".repeat(200)}\n `;
    expect(resolved(timed({ title: padded })).title).toBe("a".repeat(200));
    expect(resolved(timed({ title: "  Dentista " })).title).toBe("Dentista");
  });

  it("accepts America/Sao_Paulo as a zone", () => {
    expect(validateEventInput(timed({ timezone: "America/Sao_Paulo" })).ok).toBe(true);
  });

  it("accepts a timed end equal to its start (a zero-duration commitment)", () => {
    const value = resolved(timed({ endAt: START }));
    expect(value.startAt).toBe(START);
    expect(value.endAt).toBe(START);
  });

  it("accepts a description and a location of exactly their limits", () => {
    const description = "d".repeat(EVENT_DESCRIPTION_MAX);
    const location = "l".repeat(EVENT_LOCATION_MAX);
    const value = resolved(timed({ description, location }));
    expect(value.description).toBe(description);
    expect(value.location).toBe(location);
  });

  it("trims a description and a location and stores an empty one as null", () => {
    expect(
      resolved(timed({ description: "  levar exames ", location: " Clínica " })),
    ).toMatchObject({ description: "levar exames", location: "Clínica" });
    expect(resolved(timed({ description: "   ", location: "" }))).toMatchObject({
      description: null,
      location: null,
    });
    expect(resolved(timed({ description: null, location: null }))).toMatchObject({
      description: null,
      location: null,
    });
  });
});

describe("AC-3 — what is refused, and the field it names", () => {
  it.each([
    ["an empty string", ""],
    ["spaces only", "   "],
    ["tabs and newlines only", "\t\n "],
  ])("refuses a title that is %s as blank", (_label, title) => {
    expect(validateEventInput(timed({ title }))).toEqual({
      ok: false,
      error: { field: "title", code: "blank" },
    });
  });

  it("refuses a 201-character title as too long", () => {
    expect(validateEventInput(timed({ title: "a".repeat(201) }))).toEqual({
      ok: false,
      error: { field: "title", code: "too_long" },
    });
  });

  it("refuses a description one character over its limit", () => {
    expect(
      validateEventInput(timed({ description: "d".repeat(EVENT_DESCRIPTION_MAX + 1) })),
    ).toEqual({ ok: false, error: { field: "description", code: "too_long" } });
  });

  it("refuses a location one character over its limit", () => {
    expect(validateEventInput(timed({ location: "l".repeat(EVENT_LOCATION_MAX + 1) }))).toEqual({
      ok: false,
      error: { field: "location", code: "too_long" },
    });
  });

  it("refuses an unknown zone, Mars/Base", () => {
    expect(validateEventInput(timed({ timezone: "Mars/Base" }))).toEqual({
      ok: false,
      error: { field: "timezone", code: "unknown_zone" },
    });
  });

  it("refuses a timed end before the start, naming endAt", () => {
    expect(validateEventInput(timed({ endAt: START - 1 }))).toEqual({
      ok: false,
      error: { field: "endAt", code: "end_before_start" },
    });
  });

  it.each([
    ["equal to the start", "2026-10-26"],
    ["before the start", "2026-10-25"],
  ])("refuses an all-day end %s, naming endDate", (_label, endDate) => {
    expect(validateEventInput(allDay({ endDate }))).toEqual({
      ok: false,
      error: { field: "endDate", code: "end_not_after_start" },
    });
  });
});

describe("AC-3 — the time fields must match the kind of commitment", () => {
  it.each([
    ["missing", {}],
    ["null", { startAt: null }],
    ["not an integer", { startAt: 1.5 }],
  ] as const)("requires a timed start that is %s", (_label, extra) => {
    const required = { ok: false, error: { field: "startAt", code: "required" } };
    expect(resolveEventTimes({ allDay: false, ...extra })).toEqual(required);
    expect(validateEventInput({ title: "Dentista", allDay: false, ...extra })).toEqual(required);
  });

  it.each([
    ["startDate", { startDate: "2026-10-20" }],
    ["endDate", { endDate: "2026-10-21" }],
  ] as const)("does not allow %s on a timed commitment", (field, extra) => {
    expect(resolveEventTimes({ allDay: false, startAt: START, ...extra })).toEqual({
      ok: false,
      error: { field, code: "not_allowed" },
    });
  });

  it.each([
    ["startAt", { startAt: START }],
    ["endAt", { endAt: START + 3600 }],
  ] as const)("does not allow %s on an all-day commitment", (field, extra) => {
    expect(resolveEventTimes({ allDay: true, startDate: "2026-10-26", ...extra })).toEqual({
      ok: false,
      error: { field, code: "not_allowed" },
    });
  });

  it.each([
    ["missing", {}, "required"],
    ["null", { startDate: null }, "required"],
    ["not a real calendar day", { startDate: "2026-02-30" }, "invalid_date"],
  ] as const)("requires an all-day start that is %s", (_label, extra, code) => {
    expect(resolveEventTimes({ allDay: true, ...extra })).toEqual({
      ok: false,
      error: { field: "startDate", code },
    });
  });

  it("refuses an all-day end that is not a real calendar day, naming endDate", () => {
    expect(
      resolveEventTimes({ allDay: true, startDate: "2026-10-20", endDate: "2026-02-30" }),
    ).toEqual({
      ok: false,
      error: { field: "endDate", code: "invalid_date" },
    });
  });

  it("fills a timed commitment's end and leaves its date fields null", () => {
    expect(resolveEventTimes({ allDay: false, startAt: START })).toEqual({
      ok: true,
      value: {
        allDay: false,
        startAt: START,
        endAt: START + 3600,
        startDate: null,
        endDate: null,
      },
    });
  });
});

describe("AC-3 — the first failure wins, in a fixed order", () => {
  it("reports the title before the zone", () => {
    expect(validateEventInput(timed({ title: " ", timezone: "Mars/Base" }))).toEqual({
      ok: false,
      error: { field: "title", code: "blank" },
    });
  });

  it("reports the description before the zone", () => {
    expect(
      validateEventInput(
        timed({ description: "d".repeat(EVENT_DESCRIPTION_MAX + 1), timezone: "Mars/Base" }),
      ),
    ).toEqual({ ok: false, error: { field: "description", code: "too_long" } });
  });

  it("reports the zone before the times", () => {
    expect(validateEventInput(timed({ timezone: "Mars/Base", endAt: START - 1 }))).toEqual({
      ok: false,
      error: { field: "timezone", code: "unknown_zone" },
    });
  });
});

describe("AC-3 — isValidTimeZone", () => {
  it.each(["America/Sao_Paulo", "America/New_York", "Australia/Sydney", "UTC"])(
    "accepts the real zone %s",
    (zone) => {
      expect(isValidTimeZone(zone)).toBe(true);
    },
  );

  it.each([
    ["an invented region", "Mars/Base"],
    ["an empty string", ""],
  ])("refuses %s", (_label, zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});
