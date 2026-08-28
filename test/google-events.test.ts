/**
 * Unit 4 `google-calendar-read`, phase 3 — the pure mapper.
 *
 * Covers PRD **AC-7** (both date shapes), **AC-8** (an event with no title) and
 * **AC-9** (the closed mirror inventory), plus the window arithmetic AC-6
 * depends on.
 *
 * The fixtures are not invented. They are the payload shapes chore C12 pulled
 * out of the owner's real calendar on 2026-08-25: an all-day event (`momo`), a
 * timed one with an offset (`Daily - Super Ensino`), and one with no `summary`
 * at all. Testing against shapes that actually occurred is the difference
 * between covering the API and covering this owner's calendar.
 *
 * `eventWindow` takes `today` as an argument like every other time-dependent
 * function in `src/shared`, so nothing here decays as the calendar moves.
 */

import { describe, expect, it } from "vitest";
import { eventWindow, toCalendarEventDto } from "../src/shared/google-events";

const CAL = "primary";

/** An all-day event, as Google actually returns one. */
const ALL_DAY = {
  id: "evt-allday",
  summary: "momo",
  start: { date: "2026-08-25" },
  end: { date: "2026-08-26" },
};

/** A timed event with an offset, as Google actually returns one. */
const TIMED = {
  id: "evt-timed",
  summary: "Daily - Super Ensino",
  start: { dateTime: "2026-08-26T15:00:00-03:00", timeZone: "America/Sao_Paulo" },
  end: { dateTime: "2026-08-26T15:15:00-03:00", timeZone: "America/Sao_Paulo" },
};

describe("toCalendarEventDto — the two date shapes (AC-7)", () => {
  it("maps an all-day event to allDay: true carrying the local day", () => {
    const dto = toCalendarEventDto(ALL_DAY, CAL)!;

    expect(dto.allDay).toBe(true);
    expect(dto.start).toEqual({ date: "2026-08-25" });
  });

  it("gives an all-day event no time of day at all", () => {
    // An all-day event has no instant. Inventing midnight would make it sort
    // against timed events as though it happened at 00:00, which is a lie the
    // screen would then show.
    const dto = toCalendarEventDto(ALL_DAY, CAL)!;

    expect("dateTime" in dto.start).toBe(false);
  });

  it("maps a timed event to allDay: false carrying an instant", () => {
    const dto = toCalendarEventDto(TIMED, CAL)!;

    expect(dto.allDay).toBe(false);
    expect(dto.start).toEqual({
      dateTime: Date.parse("2026-08-26T15:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });
  });

  it("keeps a timed event's zone as null when Google omits it", () => {
    const noZone = { ...TIMED, start: { dateTime: "2026-08-26T15:00:00-03:00" } };
    const dto = toCalendarEventDto(noZone, CAL)!;

    expect(dto.allDay).toBe(false);
    expect(dto.start).toMatchObject({ timeZone: null });
  });

  it("carries the calendar it came from, so a multi-calendar day can attribute rows", () => {
    expect(toCalendarEventDto(ALL_DAY, "work@example.com")!.calendarId).toBe("work@example.com");
  });
});

describe("toCalendarEventDto — an event with no title (AC-8)", () => {
  it("maps an absent summary to null, not an empty string", () => {
    // One exists in the owner's real calendar at 2026-08-27T17:45. `null` says
    // "there is no title"; `""` says "the title is empty", and only the first
    // lets phase 4 choose what to render.
    const untitled = { ...TIMED, summary: undefined };

    expect(toCalendarEventDto(untitled, CAL)!.title).toBeNull();
  });

  it("maps a whitespace-only summary to null too", () => {
    expect(toCalendarEventDto({ ...TIMED, summary: "   " }, CAL)!.title).toBeNull();
  });

  it("invents no fallback copy — that decision belongs to the screen", () => {
    // ADR-0009 keeps `src/shared` English; a pt-BR placeholder here would put
    // visible copy in a module that must not carry any.
    const dto = toCalendarEventDto({ ...TIMED, summary: undefined }, CAL)!;

    expect(dto.title).not.toMatch(/sem t[ií]tulo/i);
    expect(dto.title).not.toBe("(no title)");
  });

  it("keeps a real title verbatim", () => {
    expect(toCalendarEventDto(TIMED, CAL)!.title).toBe("Daily - Super Ensino");
  });
});

describe("toCalendarEventDto — the closed mirror inventory (AC-9)", () => {
  const crowded = {
    ...TIMED,
    attendees: [
      { email: "someone@example.com", displayName: "Someone Else", responseStatus: "accepted" },
      { email: "other@example.com", displayName: "Other Person" },
    ],
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
    recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
    organizer: { email: "boss@example.com" },
  };

  it("carries no attendee data in any form", () => {
    const dto = toCalendarEventDto(crowded, CAL)!;
    const serialized = JSON.stringify(dto);

    // Serialize and search: this catches a leak into ANY field, including one
    // added later, which a field-by-field assertion would miss.
    expect(serialized).not.toContain("someone@example.com");
    expect(serialized).not.toContain("Someone Else");
    expect(serialized).not.toContain("other@example.com");
  });

  it("carries no reminder data", () => {
    // Google's own reminders would double every notification — the exact
    // "duplicated entries between tools" pain in the problem statement.
    expect(JSON.stringify(toCalendarEventDto(crowded, CAL))).not.toContain("popup");
  });

  it("carries no recurrence rule", () => {
    // ADR-0007 forbids re-serializing a rule Praesto cannot express, and
    // `singleEvents=true` means one should never arrive at all.
    expect(JSON.stringify(toCalendarEventDto(crowded, CAL))).not.toContain("RRULE");
  });

  it("carries no organizer", () => {
    expect(JSON.stringify(toCalendarEventDto(crowded, CAL))).not.toContain("boss@example.com");
  });

  it("reduces attendees to a boolean and nothing more", () => {
    expect(toCalendarEventDto(crowded, CAL)!.hasGuests).toBe(true);
    expect(toCalendarEventDto(TIMED, CAL)!.hasGuests).toBe(false);
  });

  it("treats an empty attendees array as no guests", () => {
    expect(toCalendarEventDto({ ...TIMED, attendees: [] }, CAL)!.hasGuests).toBe(false);
  });
});

describe("toCalendarEventDto — malformed payloads", () => {
  it("returns null rather than throwing when there is no start at all", () => {
    // One unmappable row must cost that row, never the whole day.
    expect(toCalendarEventDto({ id: "x", summary: "no start" }, CAL)).toBeNull();
  });

  it("returns null when the start is neither a date nor a dateTime", () => {
    expect(toCalendarEventDto({ id: "x", start: {} }, CAL)).toBeNull();
  });

  it("returns null when the id is missing", () => {
    expect(toCalendarEventDto({ start: { date: "2026-08-25" } }, CAL)).toBeNull();
  });
});

describe("eventWindow (AC-6, AC-A2)", () => {
  it("starts at the given day's midnight in the owner's zone", () => {
    const { timeMin } = eventWindow("2026-08-28", 7);

    expect(timeMin).toBe("2026-08-28T00:00:00-03:00");
  });

  it("ends at day 8's midnight — an EXCLUSIVE upper bound", () => {
    // Google documents timeMax as exclusive on start time. Naming the end of
    // day 7 would silently drop every event on that day, which surfaces weeks
    // later as "my Friday meeting is missing".
    const { timeMax } = eventWindow("2026-08-28", 7);

    expect(timeMax).toBe("2026-09-05T00:00:00-03:00");
  });

  it("carries an explicit offset on both bounds — Google rejects a bare timestamp", () => {
    const { timeMin, timeMax } = eventWindow("2026-08-28", 7);

    expect(timeMin).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(timeMax).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it("reads no clock — the same argument always yields the same window", () => {
    expect(eventWindow("2026-01-01", 7)).toEqual(eventWindow("2026-01-01", 7));
  });

  it("spans month and year boundaries without special-casing them", () => {
    expect(eventWindow("2026-12-29", 7).timeMax).toBe("2027-01-06T00:00:00-03:00");
  });
});
