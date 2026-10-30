// PRPs/prds/events-and-day-view.prd.md AC-27 Draft and patch builders
//
// Source plan: PRPs/plans/events-and-day-view-phase-4-the-compromisso-sheet-and-search-results.plan.md
// (Task 1 - src/shared/event-edit.ts: EVENT_DEFAULT_START_TIME, EventDraft, EventDraftError,
// newEventDraft, eventDraftFromEvent, eventDraftErrors, buildCreateEventInput, buildEventPatch,
// draftEndPreview, timeZoneChoices; plan AC-A1, AC-A2, AC-A3 and the draft half of AC-A4).
//
// AC-27, clause by clause:
//   - "a draft built from an event has the wall-clock parts in the event's own zone"
//       -> eventDraftFromEvent
//   - "the create input carries instants resolved by the shared helper with an empty end already
//      filled" -> buildCreateEventInput
//   - "the patch contains only changed fields and is empty when nothing changed; toggling all-day
//      carries the target shape's fields" -> buildEventPatch
//   - "an end before the start yields the error code the sheet shows" -> eventDraftErrors
//   - (plan AC-A1/A4) a new draft's default start, the resolved-end preview and the zone choices
//       -> newEventDraft, draftEndPreview, timeZoneChoices
//   - "the sheet state keeps one draft per event" lives in test/event-sheet.test.ts.
//
// Pure, DOM-free, clock-free: "now" is an argument, never read. The three suites of this phase run
// BEFORE the Implementer (test-first, per `tdd: true`): src/shared/event-edit.ts does not exist
// yet, so this file is expected to be RED for the right reason - the module import cannot be
// resolved - until plan Task 1 lands.
//
// Why America/New_York: America/Sao_Paulo has carried a fixed -03:00 offset since 2019 and can
// never reveal a daylight-saving bug. The gap (2026-03-08, 02:00-03:00) and the overlap
// (2026-11-01, 01:00-02:00) of New York are where this module is actually decided. Every expected
// instant is spelled with Date.UTC so the assertion stays legible and independent of the code
// under test; the RFC 5545 rule (an overlap resolves to its FIRST occurrence, a gap to the offset
// from BEFORE it) is the shared `wallClockToInstant` rule that test/event-wall-clock.test.ts pins.
//
// What is pinned beyond the PRD's literal text is fixed by the plan (decisions D4-4, D4-8, D4-10
// and the resolution rule of Task 1 item 7) and is listed in PRPs/reports/events-and-day-view/
// test-suite-phase-4.diff. Deliberately NOT pinned (the plan is silent): what `draftEndPreview`
// returns for a partly typed end that falls before the start; the day and time parts of an
// all-day DTO that lacks its days (only the day parts are pinned empty); what a start-only move
// does to an end that was stored in a repeated hour (it is re-resolved by the shared rule); the
// identity of the state objects. One reading is pinned on purpose: for an Event whose stored zone
// the runtime refuses, the draft falls back to the owner's zone AND reads its wall-clock parts
// there, because the plan defines every part of a draft as the wall clock "in `timezone`".

import { describe, expect, it } from "vitest";
import { EDITABLE_EVENT_FIELDS } from "../src/shared/api";
import type { CreateEventInput, EventDto, UpdateEventInput } from "../src/shared/api";
import {
  EVENT_DEFAULT_START_TIME,
  buildCreateEventInput,
  buildEventPatch,
  draftEndPreview,
  eventDraftErrors,
  eventDraftFromEvent,
  newEventDraft,
  timeZoneChoices,
} from "../src/shared/event-edit";
import type { EventDraft, EventDraftError } from "../src/shared/event-edit";
import { validateEventInput } from "../src/shared/events";
import { localAllDay, localTimed, spSeconds, withoutClock } from "./day-fixtures";

const SAO_PAULO = "America/Sao_Paulo";
const NEW_YORK = "America/New_York";

/** Epoch seconds of a UTC moment; the month is 1-based, as the PRD writes dates. */
function utc(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) / 1000;
}

/** A valid timed draft in São Paulo: 09:30 on 2026-10-20, no end typed. */
function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    title: "Dentista",
    description: "",
    location: "",
    allDay: false,
    startDay: "2026-10-20",
    startTime: "09:30",
    endDay: "",
    endTime: "",
    timezone: SAO_PAULO,
    ...overrides,
  };
}

/** A valid all-day draft in São Paulo: 2026-10-26 through 2026-10-27 inclusive. */
function allDayDraft(overrides: Partial<EventDraft> = {}): EventDraft {
  return draft({
    allDay: true,
    startDay: "2026-10-26",
    startTime: "09:00",
    endDay: "2026-10-27",
    endTime: "",
    ...overrides,
  });
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

const END_BEFORE_START: EventDraftError = { field: "end", code: "end_before_start" };

describe("EVENT_DEFAULT_START_TIME", () => {
  it("is 09:00, the start of a new commitment on a day other than today", () => {
    expect(EVENT_DEFAULT_START_TIME).toBe("09:00");
  });
});

describe("AC-27 newEventDraft - a commitment that does not exist yet", () => {
  const NOW = spSeconds("2026-10-20", "14:00");

  it("is prefilled with the day, 09:00, an empty end and the owner's zone", () => {
    expect(newEventDraft("2026-10-25", NOW)).toStrictEqual({
      title: "",
      description: "",
      location: "",
      allDay: false,
      startDay: "2026-10-25",
      startTime: "09:00",
      endDay: "",
      endTime: "",
      timezone: SAO_PAULO,
    });
  });

  it("keeps 09:00 for any day that is not today in the owner's zone", () => {
    for (const day of ["2026-10-19", "2026-10-21", "2026-12-31", "2027-01-01"]) {
      const created = newEventDraft(day, spSeconds("2026-10-20", "23:10"));
      expect(created.startDay).toBe(day);
      expect(created.startTime).toBe("09:00");
    }
  });

  it.each([
    ["14:00", "15:00"],
    ["14:01", "15:00"],
    ["14:30", "15:00"],
    ["13:59", "14:00"],
    ["06:30", "07:00"],
    ["00:00", "01:00"],
    ["00:30", "01:00"],
    ["09:00", "10:00"],
    ["22:59", "23:00"],
    ["23:00", "23:00"],
    ["23:10", "23:00"],
    ["23:59", "23:00"],
  ])("starts at the next full hour when the day is today: at %s it reads %s", (now, expected) => {
    expect(newEventDraft("2026-10-20", spSeconds("2026-10-20", now)).startTime).toBe(expected);
  });

  it("ignores the seconds inside the current minute", () => {
    expect(newEventDraft("2026-10-20", spSeconds("2026-10-20", "14:00") + 59).startTime).toBe(
      "15:00",
    );
    expect(newEventDraft("2026-10-20", spSeconds("2026-10-20", "13:59") + 59).startTime).toBe(
      "14:00",
    );
    expect(newEventDraft("2026-10-20", spSeconds("2026-10-20", "23:59") + 59).startTime).toBe(
      "23:00",
    );
  });

  it("changes nothing but the start time when the day is today", () => {
    expect(newEventDraft("2026-10-20", NOW)).toStrictEqual({
      title: "",
      description: "",
      location: "",
      allDay: false,
      startDay: "2026-10-20",
      startTime: "15:00",
      endDay: "",
      endTime: "",
      timezone: SAO_PAULO,
    });
  });

  it("reads today in the owner's zone, not in UTC", () => {
    // 22:30 in São Paulo on the 20th is already 01:30 UTC on the 21st.
    const lateEvening = spSeconds("2026-10-20", "22:30");
    expect(lateEvening).toBe(utc(2026, 10, 21, 1, 30));
    expect(newEventDraft("2026-10-20", lateEvening).startTime).toBe("23:00");
    expect(newEventDraft("2026-10-21", lateEvening).startTime).toBe("09:00");
  });

  it("returns a fresh draft on every call", () => {
    const first = newEventDraft("2026-10-25", NOW);
    const second = newEventDraft("2026-10-25", NOW);
    expect(first).not.toBe(second);
    first.title = "changed";
    expect(second.title).toBe("");
  });
});

describe("AC-27 eventDraftFromEvent - the wall clock is the Event's own", () => {
  it("seeds a timed Event with the wall-clock parts in its zone", () => {
    const event = localTimed("e1", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 13, 30), {
      title: "Dentista",
      location: "Clínica Sorriso",
    });
    expect(eventDraftFromEvent(event)).toStrictEqual({
      title: "Dentista",
      description: "",
      location: "Clínica Sorriso",
      allDay: false,
      startDay: "2026-10-20",
      startTime: "09:30",
      endDay: "2026-10-20",
      endTime: "10:30",
      timezone: SAO_PAULO,
    });
  });

  it("keeps the description and location the Event has", () => {
    const event = localTimed("e1", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 13, 30), {
      description: "Levar exames",
      location: "Clínica Sorriso",
    });
    const seeded = eventDraftFromEvent(event);
    expect(seeded.description).toBe("Levar exames");
    expect(seeded.location).toBe("Clínica Sorriso");
  });

  it("reads an Event authored in another zone on that zone's clock, not the owner's", () => {
    // 14:00 UTC is 10:00 in New York (EDT, -04:00) and 11:00 in São Paulo.
    const event = localTimed("e2", utc(2026, 10, 20, 14, 0), utc(2026, 10, 20, 15, 30), {
      timezone: NEW_YORK,
    });
    const seeded = eventDraftFromEvent(event);
    expect(seeded.timezone).toBe(NEW_YORK);
    expect(seeded.startDay).toBe("2026-10-20");
    expect(seeded.startTime).toBe("10:00");
    expect(seeded.endDay).toBe("2026-10-20");
    expect(seeded.endTime).toBe("11:30");
  });

  it("puts the start and the end on their own local days when the Event crosses midnight", () => {
    const event = localTimed(
      "e3",
      spSeconds("2026-10-20", "23:30"),
      spSeconds("2026-10-21", "00:30"),
    );
    const seeded = eventDraftFromEvent(event);
    expect([seeded.startDay, seeded.startTime]).toEqual(["2026-10-20", "23:30"]);
    expect([seeded.endDay, seeded.endTime]).toEqual(["2026-10-21", "00:30"]);
  });

  it("reads the day from the zone even when UTC is already on the next day", () => {
    // 02:30 UTC on the 21st is 23:30 on the 20th in São Paulo.
    const event = localTimed("e4", utc(2026, 10, 21, 2, 30), utc(2026, 10, 21, 3, 30));
    expect(eventDraftFromEvent(event).startDay).toBe("2026-10-20");
    expect(eventDraftFromEvent(event).startTime).toBe("23:30");
  });

  it("reads an instant in the repeated hour of New York as the wall clock it shows", () => {
    // 06:30 UTC on 2026-11-01 is 01:30 EST, the SECOND time 01:30 happens that morning.
    const event = localTimed("e5", utc(2026, 11, 1, 6, 30), utc(2026, 11, 1, 7, 30), {
      timezone: NEW_YORK,
    });
    const seeded = eventDraftFromEvent(event);
    expect([seeded.startDay, seeded.startTime]).toEqual(["2026-11-01", "01:30"]);
    expect([seeded.endDay, seeded.endTime]).toEqual(["2026-11-01", "02:30"]);
  });

  it("seeds an all-day Event with the INCLUSIVE last day and keeps 09:00 ready for the switch", () => {
    const event = localAllDay("a1", "2026-10-26", "2026-10-28", { title: "Feriado" });
    expect(eventDraftFromEvent(event)).toStrictEqual({
      title: "Feriado",
      description: "",
      location: "",
      allDay: true,
      startDay: "2026-10-26",
      startTime: "09:00",
      endDay: "2026-10-27",
      endTime: "",
      timezone: SAO_PAULO,
    });
  });

  it("seeds a single all-day Event with the same first and last day", () => {
    const seeded = eventDraftFromEvent(localAllDay("a2", "2026-10-20", "2026-10-21"));
    expect(seeded.startDay).toBe("2026-10-20");
    expect(seeded.endDay).toBe("2026-10-20");
  });

  it("walks the inclusive last day back across a year boundary", () => {
    const seeded = eventDraftFromEvent(localAllDay("a3", "2026-12-31", "2027-01-01"));
    expect(seeded.endDay).toBe("2026-12-31");
  });

  it("copies an all-day Event's days verbatim and keeps its zone", () => {
    const seeded = eventDraftFromEvent(
      localAllDay("a4", "2026-10-26", "2026-10-28", { timezone: NEW_YORK }),
    );
    expect(seeded.timezone).toBe(NEW_YORK);
    expect(seeded.startDay).toBe("2026-10-26");
    expect(seeded.endDay).toBe("2026-10-27");
  });

  it("falls back to the owner's zone for a zone the runtime refuses, without throwing", () => {
    expect(
      eventDraftFromEvent(localAllDay("a5", "2026-10-26", "2026-10-27", { timezone: "Mars/Base" }))
        .timezone,
    ).toBe(SAO_PAULO);

    const timed = localTimed("t5", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 13, 30), {
      timezone: "Mars/Base",
    });
    expect(() => eventDraftFromEvent(timed)).not.toThrow();
    const seeded = eventDraftFromEvent(timed);
    expect(seeded.timezone).toBe(SAO_PAULO);
    // The parts are the wall clock IN the draft's zone, which is now the fallback one.
    expect([seeded.startDay, seeded.startTime]).toEqual(["2026-10-20", "09:30"]);
  });

  it("seeds empty day and time parts, rather than throwing, for a timed DTO with no start", () => {
    const broken = localTimed("x1", 0, 0, { startAt: null, endAt: null });
    expect(() => eventDraftFromEvent(broken)).not.toThrow();
    expect(eventDraftFromEvent(broken)).toMatchObject({
      allDay: false,
      startDay: "",
      startTime: "",
      endDay: "",
      endTime: "",
    });
  });

  it("seeds empty day parts, rather than throwing, for an all-day DTO with no days", () => {
    const broken = localAllDay("x2", "", "", { startDate: null, endDate: null });
    expect(() => eventDraftFromEvent(broken)).not.toThrow();
    expect(eventDraftFromEvent(broken)).toMatchObject({ allDay: true, startDay: "", endDay: "" });
  });

  it("returns a fresh draft and never mutates the Event", () => {
    const event = localTimed("e1", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 13, 30));
    const before = structuredClone(event);
    const first = eventDraftFromEvent(event);
    const second = eventDraftFromEvent(event);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(event).toEqual(before);
  });
});

describe("AC-27 eventDraftErrors - a valid draft", () => {
  // The other valid shapes (a timed draft with no end or with a whole end, an all-day draft, with
  // or without time fields, the first and the last minute of the day) are asserted once each in the
  // describes below; only the garbage-time-fields shape is unique to this block.
  it("has no error: an all-day draft whose time fields are garbage", () => {
    expect(eventDraftErrors(allDayDraft({ startTime: "zz", endTime: "99:99" }))).toEqual([]);
  });
});

describe("AC-27 eventDraftErrors - the title", () => {
  it.each(["", "   ", "\t\n"])("refuses a blank title (%j)", (title) => {
    expect(eventDraftErrors(draft({ title }))).toEqual([{ field: "title", code: "blank" }]);
  });

  it("accepts a 200-character title and refuses a 201-character one", () => {
    expect(eventDraftErrors(draft({ title: "a".repeat(200) }))).toEqual([]);
    expect(eventDraftErrors(draft({ title: "a".repeat(201) }))).toEqual([
      { field: "title", code: "too_long" },
    ]);
  });

  it("counts the length after trimming", () => {
    expect(eventDraftErrors(draft({ title: `  ${"a".repeat(200)}  ` }))).toEqual([]);
    expect(eventDraftErrors(draft({ title: `  ${"a".repeat(201)}  ` }))).toEqual([
      { field: "title", code: "too_long" },
    ]);
  });
});

describe("AC-27 eventDraftErrors - description and location", () => {
  it("accepts a 5000-character description and refuses a 5001-character one", () => {
    expect(eventDraftErrors(draft({ description: "d".repeat(5000) }))).toEqual([]);
    expect(eventDraftErrors(draft({ description: "d".repeat(5001) }))).toEqual([
      { field: "description", code: "too_long" },
    ]);
  });

  it("accepts a 200-character location and refuses a 201-character one", () => {
    expect(eventDraftErrors(draft({ location: "l".repeat(200) }))).toEqual([]);
    expect(eventDraftErrors(draft({ location: "l".repeat(201) }))).toEqual([
      { field: "location", code: "too_long" },
    ]);
  });

  it("counts both after trimming", () => {
    expect(eventDraftErrors(draft({ description: ` ${"d".repeat(5000)} ` }))).toEqual([]);
    expect(eventDraftErrors(draft({ location: ` ${"l".repeat(200)} ` }))).toEqual([]);
  });

  it("does not require either", () => {
    expect(eventDraftErrors(draft({ description: "   ", location: "   " }))).toEqual([]);
  });
});

describe("AC-27 eventDraftErrors - the start", () => {
  it.each(["", "2026-02-30", "2026-13-01", "2026-10-32", "20/10/2026", "tomorrow", "2026-1-5"])(
    "asks for the start day when it is %j",
    (startDay) => {
      expect(eventDraftErrors(draft({ startDay }))).toEqual([
        { field: "start", code: "day_required" },
      ]);
    },
  );

  it.each(["", "24:00", "12:60", "25:30", "abc", "0930"])(
    "asks for the start time of a timed draft when it is %j",
    (startTime) => {
      expect(eventDraftErrors(draft({ startTime }))).toEqual([
        { field: "start", code: "time_required" },
      ]);
    },
  );

  it("accepts the first and the last minute of the day", () => {
    expect(eventDraftErrors(draft({ startTime: "00:00" }))).toEqual([]);
    expect(eventDraftErrors(draft({ startTime: "23:59" }))).toEqual([]);
  });

  it("reports one start error at most: the day wins over the time", () => {
    expect(eventDraftErrors(draft({ startDay: "", startTime: "" }))).toEqual([
      { field: "start", code: "day_required" },
    ]);
  });

  it("does not ask an all-day draft for a start time", () => {
    expect(eventDraftErrors(allDayDraft({ startTime: "" }))).toEqual([]);
  });

  it("still asks an all-day draft for its start day", () => {
    expect(eventDraftErrors(allDayDraft({ startDay: "" }))).toEqual([
      { field: "start", code: "day_required" },
    ]);
  });
});

describe("AC-27 eventDraftErrors - an end before the start", () => {
  it("names the error the sheet shows: field end, code end_before_start", () => {
    expect(eventDraftErrors(draft({ endDay: "2026-10-20", endTime: "09:29" }))).toEqual([
      { field: "end", code: "end_before_start" },
    ]);
  });

  it.each<[string, Partial<EventDraft>, boolean]>([
    ["no end at all", {}, false],
    ["an end an hour later", { endDay: "2026-10-20", endTime: "10:30" }, false],
    ["an end equal to the start", { endDay: "2026-10-20", endTime: "09:30" }, false],
    ["an end one minute before the start", { endDay: "2026-10-20", endTime: "09:29" }, true],
    ["an end on an earlier day", { endDay: "2026-10-19", endTime: "11:00" }, true],
    [
      "an end on a later day with an earlier clock time",
      { endDay: "2026-10-21", endTime: "08:00" },
      false,
    ],
    ["only an end day before the start day", { endDay: "2026-10-19" }, true],
    ["only the start's own end day", { endDay: "2026-10-20" }, false],
    ["only a later end day", { endDay: "2026-10-21" }, false],
    ["only an end time before the start time", { endTime: "08:00" }, true],
    ["only an end time after the start time", { endTime: "10:00" }, false],
    ["only an end time equal to the start time", { endTime: "09:30" }, false],
    ["a malformed end day and nothing else", { endDay: "garbage" }, false],
    ["an impossible end day and nothing else", { endDay: "2026-02-30" }, false],
    ["a malformed end time and nothing else", { endTime: "99:99" }, false],
    [
      "a real earlier end day beside a malformed end time",
      { endDay: "2026-10-19", endTime: "xx" },
      true,
    ],
    [
      "a malformed end day beside an earlier real end time",
      { endDay: "2026-02-30", endTime: "08:00" },
      true,
    ],
    [
      "a malformed end day beside a later real end time",
      { endDay: "2026-02-30", endTime: "10:00" },
      false,
    ],
  ])("timed, start 2026-10-20 09:30: %s", (_label, overrides, refused) => {
    expect(eventDraftErrors(draft(overrides))).toEqual(refused ? [END_BEFORE_START] : []);
  });

  it("compares across a year boundary", () => {
    const start = { startDay: "2026-12-31", startTime: "23:30" };
    expect(eventDraftErrors(draft({ ...start, endDay: "2027-01-01", endTime: "00:30" }))).toEqual(
      [],
    );
    expect(eventDraftErrors(draft({ ...start, endDay: "2026-12-31", endTime: "00:30" }))).toEqual([
      END_BEFORE_START,
    ]);
  });

  it.each<[string, Partial<EventDraft>, boolean]>([
    ["no last day (a single day)", { endDay: "" }, false],
    ["a last day equal to the first (a single day)", { endDay: "2026-10-26" }, false],
    ["a later last day", { endDay: "2026-10-27" }, false],
    ["a last day before the first day", { endDay: "2026-10-25" }, true],
    ["a malformed last day (counts as not given)", { endDay: "garbage" }, false],
    ["an impossible last day (counts as not given)", { endDay: "2026-02-30" }, false],
    [
      "a last day before the first day, whatever the ignored times say",
      { endDay: "2026-10-25", startTime: "", endTime: "23:00" },
      true,
    ],
    [
      "a last day equal to the first, whatever the ignored times say",
      { endDay: "2026-10-26", startTime: "23:00", endTime: "01:00" },
      false,
    ],
  ])("all-day, first day 2026-10-26: %s", (_label, overrides, refused) => {
    expect(eventDraftErrors(allDayDraft(overrides))).toEqual(refused ? [END_BEFORE_START] : []);
  });

  it("judges the end in the draft's own zone: the same wall clock is fine in São Paulo and refused in New York across the gap", () => {
    // 02:30 on 2026-03-08 does not exist in New York; it is read with the offset BEFORE the gap
    // (07:30 UTC), so a 03:00 end (EDT, 07:00 UTC) falls before it. São Paulo has no gap.
    const wallClock = {
      startDay: "2026-03-08",
      startTime: "02:30",
      endDay: "2026-03-08",
      endTime: "03:00",
    };
    expect(eventDraftErrors(draft({ ...wallClock, timezone: SAO_PAULO }))).toEqual([]);
    expect(eventDraftErrors(draft({ ...wallClock, timezone: NEW_YORK }))).toEqual([
      END_BEFORE_START,
    ]);
  });

  it("accepts a New York end whose gap-resolved instant equals the start", () => {
    // 02:30 (gap) and 03:30 (EDT) are both 07:30 UTC: an end equal to the start is accepted.
    const gap = {
      timezone: NEW_YORK,
      startDay: "2026-03-08",
      startTime: "02:30",
      endDay: "2026-03-08",
    };
    expect(eventDraftErrors(draft({ ...gap, endTime: "03:30" }))).toEqual([]);
    expect(eventDraftErrors(draft({ ...gap, endTime: "04:00" }))).toEqual([]);
  });

  it("resolves a repeated hour to its first occurrence on both sides of the comparison", () => {
    const overlap = {
      timezone: NEW_YORK,
      startDay: "2026-11-01",
      startTime: "01:30",
      endDay: "2026-11-01",
    };
    expect(eventDraftErrors(draft({ ...overlap, endTime: "01:15" }))).toEqual([END_BEFORE_START]);
    expect(eventDraftErrors(draft({ ...overlap, endTime: "01:30" }))).toEqual([]);
    expect(eventDraftErrors(draft({ ...overlap, endTime: "01:45" }))).toEqual([]);
    expect(eventDraftErrors(draft({ ...overlap, endTime: "02:15" }))).toEqual([]);
  });

  it("does not judge the end while the start has an error", () => {
    expect(eventDraftErrors(draft({ startDay: "", endDay: "2026-10-19" }))).toEqual([
      { field: "start", code: "day_required" },
    ]);
    expect(eventDraftErrors(draft({ startTime: "", endTime: "08:00" }))).toEqual([
      { field: "start", code: "time_required" },
    ]);
    // A real start day with an end day before it, but no start time to resolve: the end is not judged.
    expect(eventDraftErrors(draft({ startTime: "", endDay: "2026-10-19" }))).toEqual([
      { field: "start", code: "time_required" },
    ]);
    expect(
      eventDraftErrors(draft({ startTime: "xx", endDay: "2026-10-19", endTime: "08:00" })),
    ).toEqual([{ field: "start", code: "time_required" }]);
    expect(eventDraftErrors(allDayDraft({ startDay: "", endDay: "2026-10-19" }))).toEqual([
      { field: "start", code: "day_required" },
    ]);
  });

  it("does not let a blank title hide an end before the start", () => {
    expect(eventDraftErrors(draft({ title: "", endDay: "2026-10-19" }))).toEqual([
      { field: "title", code: "blank" },
      END_BEFORE_START,
    ]);
  });
});

describe("AC-27 eventDraftErrors - every problem, one per field, in form order", () => {
  const long = {
    title: "   ",
    description: "d".repeat(5001),
    location: "l".repeat(201),
  };

  it("lists title, description, location, then the start", () => {
    expect(eventDraftErrors(draft({ ...long, startDay: "" }))).toEqual([
      { field: "title", code: "blank" },
      { field: "description", code: "too_long" },
      { field: "location", code: "too_long" },
      { field: "start", code: "day_required" },
    ]);
  });

  it("lists title, description, location, then the end when the start is fine", () => {
    expect(eventDraftErrors(draft({ ...long, endDay: "2026-10-19" }))).toEqual([
      { field: "title", code: "blank" },
      { field: "description", code: "too_long" },
      { field: "location", code: "too_long" },
      END_BEFORE_START,
    ]);
  });

  it("reports no field twice", () => {
    const errors = eventDraftErrors(draft({ ...long, startDay: "", startTime: "" }));
    const fields = errors.map((error: EventDraftError) => error.field);
    expect(new Set(fields).size).toBe(fields.length);
  });
});

describe("AC-27 buildCreateEventInput - a timed commitment", () => {
  it("carries the trimmed title, the kind, the zone and the instants the shared helper resolves", () => {
    const input = buildCreateEventInput(
      draft({ title: "  Dentista  ", endDay: "2026-10-20", endTime: "10:15" }),
    );
    expect(input).toStrictEqual({
      title: "Dentista",
      allDay: false,
      timezone: SAO_PAULO,
      startAt: utc(2026, 10, 20, 12, 30),
      endAt: utc(2026, 10, 20, 13, 15),
    });
  });

  it("fills an empty end with the start plus one hour", () => {
    expect(buildCreateEventInput(draft())).toStrictEqual({
      title: "Dentista",
      allDay: false,
      timezone: SAO_PAULO,
      startAt: utc(2026, 10, 20, 12, 30),
      endAt: utc(2026, 10, 20, 13, 30),
    });
  });

  it("completes an end that has only a day from the start's clock time", () => {
    const input = buildCreateEventInput(draft({ endDay: "2026-10-21" }));
    expect(input?.endAt).toBe(utc(2026, 10, 21, 12, 30));
    expect(input?.startAt).toBe(utc(2026, 10, 20, 12, 30));
  });

  // Owner decision 2026-10-27 (phase-4 finding F1): an end that has only the start's own
  // day would otherwise be completed to the start itself, a zero-length commitment.
  it("gives an end that has only the start's own day the start plus one hour, never a zero-length commitment", () => {
    const input = buildCreateEventInput(draft({ endDay: "2026-10-20" }));
    expect(input?.startAt).toBe(utc(2026, 10, 20, 12, 30));
    expect(input?.endAt).toBe(utc(2026, 10, 20, 13, 30));
  });

  it("gives that one hour in the draft's own zone, across midnight too", () => {
    const newYork = buildCreateEventInput(draft({ timezone: NEW_YORK, endDay: "2026-10-20" }));
    expect(newYork?.endAt).toBe(utc(2026, 10, 20, 14, 30));

    const late = buildCreateEventInput(draft({ startTime: "23:30", endDay: "2026-10-20" }));
    expect(late?.endAt).toBe(utc(2026, 10, 21, 3, 30));
  });

  it("keeps an end time the owner typed, even when it equals the start", () => {
    const input = buildCreateEventInput(draft({ endTime: "09:30" }));
    expect(input?.startAt).toBe(utc(2026, 10, 20, 12, 30));
    expect(input?.endAt).toBe(utc(2026, 10, 20, 12, 30));
  });

  it("completes an end that has only a time on the start's day", () => {
    const input = buildCreateEventInput(draft({ endTime: "11:00" }));
    expect(input?.endAt).toBe(utc(2026, 10, 20, 14, 0));
  });

  it("treats a malformed end part as not given", () => {
    const input = buildCreateEventInput(draft({ endDay: "garbage", endTime: "99:99" }));
    expect(input?.endAt).toBe(utc(2026, 10, 20, 13, 30));
  });

  it("accepts an end equal to the start", () => {
    const input = buildCreateEventInput(draft({ endDay: "2026-10-20", endTime: "09:30" }));
    expect(input?.startAt).toBe(utc(2026, 10, 20, 12, 30));
    expect(input?.endAt).toBe(utc(2026, 10, 20, 12, 30));
  });

  it("carries the end across midnight and across a year boundary", () => {
    const input = buildCreateEventInput(
      draft({ startDay: "2026-12-31", startTime: "23:30", endDay: "2027-01-01", endTime: "00:30" }),
    );
    expect(input?.startAt).toBe(utc(2027, 1, 1, 2, 30));
    expect(input?.endAt).toBe(utc(2027, 1, 1, 3, 30));
  });

  it("omits the description and the location when they are empty, and sends them trimmed otherwise", () => {
    const bare = buildCreateEventInput(draft({ description: "   ", location: "" }));
    expect(keysOf(bare ?? {})).toEqual(["allDay", "endAt", "startAt", "timezone", "title"]);

    const full = buildCreateEventInput(
      draft({ description: "  Levar exames  ", location: " Clínica Sorriso " }),
    );
    expect(full).toStrictEqual({
      title: "Dentista",
      description: "Levar exames",
      location: "Clínica Sorriso",
      allDay: false,
      timezone: SAO_PAULO,
      startAt: utc(2026, 10, 20, 12, 30),
      endAt: utc(2026, 10, 20, 13, 30),
    });
  });

  it("never carries the all-day keys, and always carries an end", () => {
    const input = buildCreateEventInput(draft());
    expect(input).not.toBeNull();
    expect(Object.hasOwn(input ?? {}, "startDate")).toBe(false);
    expect(Object.hasOwn(input ?? {}, "endDate")).toBe(false);
    expect(typeof input?.endAt).toBe("number");
  });

  it("resolves the wall clock in the draft's zone, not the owner's", () => {
    const input = buildCreateEventInput(draft({ timezone: NEW_YORK }));
    expect(input?.timezone).toBe(NEW_YORK);
    // 09:30 EDT is 13:30 UTC (São Paulo would be 12:30 UTC).
    expect(input?.startAt).toBe(utc(2026, 10, 20, 13, 30));
    expect(input?.endAt).toBe(utc(2026, 10, 20, 14, 30));
  });

  it("resolves a time inside a DST gap with the offset before the gap", () => {
    const input = buildCreateEventInput(
      draft({ timezone: NEW_YORK, startDay: "2026-03-08", startTime: "02:30" }),
    );
    expect(input?.startAt).toBe(utc(2026, 3, 8, 7, 30));
    expect(input?.endAt).toBe(utc(2026, 3, 8, 8, 30));
  });

  it("resolves a time in a repeated hour to its first occurrence", () => {
    const base = { timezone: NEW_YORK, startDay: "2026-11-01", startTime: "01:30" };
    const defaultEnd = buildCreateEventInput(draft(base));
    expect(defaultEnd?.startAt).toBe(utc(2026, 11, 1, 5, 30));
    expect(defaultEnd?.endAt).toBe(utc(2026, 11, 1, 6, 30));

    const typedEnd = buildCreateEventInput(
      draft({ ...base, endDay: "2026-11-01", endTime: "01:45" }),
    );
    expect(typedEnd?.endAt).toBe(utc(2026, 11, 1, 5, 45));
  });

  it("resolves an end after the clocks went back with the new offset", () => {
    const input = buildCreateEventInput(
      draft({
        timezone: NEW_YORK,
        startDay: "2026-11-01",
        startTime: "00:30",
        endDay: "2026-11-01",
        endTime: "02:30",
      }),
    );
    expect(input?.startAt).toBe(utc(2026, 11, 1, 4, 30));
    expect(input?.endAt).toBe(utc(2026, 11, 1, 7, 30));
  });
});

describe("AC-27 buildCreateEventInput - an all-day commitment", () => {
  it("carries the first day and the EXCLUSIVE end", () => {
    expect(buildCreateEventInput(allDayDraft())).toStrictEqual({
      title: "Dentista",
      allDay: true,
      timezone: SAO_PAULO,
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });
  });

  it("makes no last day a single day", () => {
    const input = buildCreateEventInput(allDayDraft({ startDay: "2026-10-20", endDay: "" }));
    expect(input?.startDate).toBe("2026-10-20");
    expect(input?.endDate).toBe("2026-10-21");
  });

  it("makes a last day equal to the first a single day", () => {
    const input = buildCreateEventInput(
      allDayDraft({ startDay: "2026-10-27", endDay: "2026-10-27" }),
    );
    expect(input?.endDate).toBe("2026-10-28");
  });

  it("rolls the exclusive end over a month and a year", () => {
    expect(
      buildCreateEventInput(allDayDraft({ startDay: "2026-10-31", endDay: "" }))?.endDate,
    ).toBe("2026-11-01");
    expect(
      buildCreateEventInput(allDayDraft({ startDay: "2026-12-31", endDay: "" }))?.endDate,
    ).toBe("2027-01-01");
    expect(
      buildCreateEventInput(allDayDraft({ startDay: "2026-12-30", endDay: "2026-12-31" }))?.endDate,
    ).toBe("2027-01-01");
  });

  it("never carries the timed keys and ignores the time fields", () => {
    const input = buildCreateEventInput(allDayDraft({ startTime: "14:00", endTime: "15:00" }));
    expect(keysOf(input ?? {})).toEqual(["allDay", "endDate", "startDate", "timezone", "title"]);
  });

  it("omits an empty description and location here too", () => {
    const input = buildCreateEventInput(allDayDraft({ description: " ", location: " " }));
    expect(Object.hasOwn(input ?? {}, "description")).toBe(false);
    expect(Object.hasOwn(input ?? {}, "location")).toBe(false);
  });

  it("keeps the draft's zone", () => {
    expect(buildCreateEventInput(allDayDraft({ timezone: NEW_YORK }))?.timezone).toBe(NEW_YORK);
  });
});

describe("AC-27 buildCreateEventInput - a draft with an error", () => {
  it.each<[string, Partial<EventDraft>]>([
    ["a blank title", { title: " " }],
    ["a title over 200 characters", { title: "a".repeat(201) }],
    ["a description over 5000 characters", { description: "d".repeat(5001) }],
    ["a location over 200 characters", { location: "l".repeat(201) }],
    ["no start day", { startDay: "" }],
    ["no start time", { startTime: "" }],
    ["an end before the start", { endDay: "2026-10-19" }],
    ["an all-day last day before the first day", { allDay: true, endDay: "2026-10-19" }],
  ])("yields null for %s", (_label, overrides) => {
    expect(buildCreateEventInput(draft(overrides))).toBeNull();
  });

  it("yields null exactly when the draft has an error", () => {
    const drafts: EventDraft[] = [
      draft(),
      draft({ title: "" }),
      draft({ endDay: "2026-10-19" }),
      draft({ endDay: "2026-10-21", endTime: "08:00" }),
      draft({ startTime: "" }),
      allDayDraft(),
      allDayDraft({ endDay: "2026-10-25" }),
      allDayDraft({ startTime: "" }),
      draft({
        timezone: NEW_YORK,
        startDay: "2026-03-08",
        startTime: "02:30",
        endTime: "03:00",
        endDay: "2026-03-08",
      }),
    ];
    for (const candidate of drafts) {
      expect(buildCreateEventInput(candidate) === null).toBe(
        eventDraftErrors(candidate).length > 0,
      );
    }
  });
});

describe("AC-27 buildCreateEventInput - the sheet and the route agree", () => {
  it("builds only inputs the shared validator accepts, with the end kept as built", () => {
    const drafts: EventDraft[] = [
      draft(),
      draft({ endDay: "2026-10-21", endTime: "10:00", description: "x", location: "y" }),
      draft({ timezone: NEW_YORK, startDay: "2026-03-08", startTime: "02:30" }),
      draft({ timezone: NEW_YORK, startDay: "2026-11-01", startTime: "01:30" }),
      allDayDraft(),
      allDayDraft({ startDay: "2026-12-31", endDay: "" }),
    ];
    for (const candidate of drafts) {
      const input: CreateEventInput | null = buildCreateEventInput(candidate);
      expect(input).not.toBeNull();
      if (input === null) continue;
      const checked = validateEventInput({ ...input, allDay: input.allDay === true });
      expect(checked.ok).toBe(true);
      if (!checked.ok) continue;
      expect(checked.value.endAt).toBe(input.endAt ?? null);
      expect(checked.value.endDate).toBe(input.endDate ?? null);
      expect(checked.value.timezone).toBe(candidate.timezone);
    }
  });

  it("does not mutate the draft", () => {
    const original = draft({ title: "  Dentista  " });
    const before = structuredClone(original);
    buildCreateEventInput(original);
    expect(original).toEqual(before);
  });
});

// The Event the patch tests start from: 09:30 to 11:30 in São Paulo on 2026-10-20.
const timedEvent = localTimed("e1", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 14, 30), {
  title: "Dentista",
  description: "Levar exames",
  location: "Clínica Sorriso",
});
const seedTimed = eventDraftFromEvent(timedEvent);

// 10:00 to 12:00 in New York (EDT).
const newYorkEvent = localTimed("e2", utc(2026, 10, 20, 14, 0), utc(2026, 10, 20, 16, 0), {
  title: "Chamada",
  timezone: NEW_YORK,
});
const seedNewYork = eventDraftFromEvent(newYorkEvent);

// 2026-10-26 and 2026-10-27, all day.
const allDayEvent = localAllDay("a1", "2026-10-26", "2026-10-28", { title: "Feriado" });
const seedAllDay = eventDraftFromEvent(allDayEvent);

describe("AC-27 buildEventPatch - only what changed", () => {
  it("is empty when nothing changed", () => {
    expect(buildEventPatch(timedEvent, seedTimed)).toStrictEqual({});
    expect(buildEventPatch(newYorkEvent, seedNewYork)).toStrictEqual({});
    expect(buildEventPatch(allDayEvent, seedAllDay)).toStrictEqual({});
  });

  it("sends a changed title alone, trimmed", () => {
    expect(
      buildEventPatch(timedEvent, { ...seedTimed, title: "Dentista (retorno)" }),
    ).toStrictEqual({
      title: "Dentista (retorno)",
    });
    expect(
      buildEventPatch(timedEvent, { ...seedTimed, title: "  Dentista (retorno) " }),
    ).toStrictEqual({ title: "Dentista (retorno)" });
  });

  it("sends nothing for a title that differs only by surrounding whitespace", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, title: "  Dentista  " })).toStrictEqual({});
  });

  it("sends a changed description, and null when it was cleared", () => {
    expect(
      buildEventPatch(timedEvent, { ...seedTimed, description: "Levar exames e RG" }),
    ).toStrictEqual({
      description: "Levar exames e RG",
    });
    expect(buildEventPatch(timedEvent, { ...seedTimed, description: "" })).toStrictEqual({
      description: null,
    });
    expect(buildEventPatch(timedEvent, { ...seedTimed, description: "   " })).toStrictEqual({
      description: null,
    });
  });

  it("sends a changed location, and null when it was cleared", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, location: "Consultório 2" })).toStrictEqual({
      location: "Consultório 2",
    });
    expect(buildEventPatch(timedEvent, { ...seedTimed, location: "" })).toStrictEqual({
      location: null,
    });
  });

  it("sends nothing for an empty description or location the Event does not have", () => {
    const bare = localTimed("b1", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 13, 30), {
      description: null,
      location: null,
    });
    const seeded = eventDraftFromEvent(bare);
    expect(buildEventPatch(bare, seeded)).toStrictEqual({});
    expect(buildEventPatch(bare, { ...seeded, description: "  ", location: "  " })).toStrictEqual(
      {},
    );
  });

  it("sends a description set on an Event that had none", () => {
    const bare = localTimed("b2", utc(2026, 10, 20, 12, 30), utc(2026, 10, 20, 13, 30));
    expect(
      buildEventPatch(bare, { ...eventDraftFromEvent(bare), description: "Nova" }),
    ).toStrictEqual({
      description: "Nova",
    });
  });

  it("combines the text fields in one patch", () => {
    expect(
      buildEventPatch(timedEvent, {
        ...seedTimed,
        title: "Dentista (retorno)",
        description: "",
        location: "Consultório 2",
      }),
    ).toStrictEqual({ title: "Dentista (retorno)", description: null, location: "Consultório 2" });
  });

  it("does not mutate the Event or the draft", () => {
    const eventBefore = structuredClone(timedEvent);
    const draftBefore = structuredClone(seedTimed);
    buildEventPatch(timedEvent, seedTimed);
    expect(timedEvent).toEqual(eventBefore);
    expect(seedTimed).toEqual(draftBefore);
  });
});

describe("AC-27 buildEventPatch - a timed Event", () => {
  it("sends BOTH instants when the start time moves, because the route does not shift the end", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, startTime: "10:00" })).toStrictEqual({
      startAt: utc(2026, 10, 20, 13, 0),
      endAt: utc(2026, 10, 20, 14, 30),
    });
  });

  it("sends BOTH instants when the start day moves", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, startDay: "2026-10-19" })).toStrictEqual({
      startAt: utc(2026, 10, 19, 12, 30),
      endAt: utc(2026, 10, 20, 14, 30),
    });
  });

  it("sends both instants as the draft has them when the start and the end both move", () => {
    expect(
      buildEventPatch(timedEvent, { ...seedTimed, startTime: "13:00", endTime: "14:00" }),
    ).toStrictEqual({ startAt: utc(2026, 10, 20, 16, 0), endAt: utc(2026, 10, 20, 17, 0) });
  });

  it("sends the end alone when only the end time moves", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, endTime: "12:00" })).toStrictEqual({
      endAt: utc(2026, 10, 20, 15, 0),
    });
  });

  it("sends the end alone when only the end day moves", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, endDay: "2026-10-21" })).toStrictEqual({
      endAt: utc(2026, 10, 21, 14, 30),
    });
  });

  it("fills the end with the start plus one hour when the owner cleared it", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, endDay: "", endTime: "" })).toStrictEqual({
      endAt: utc(2026, 10, 20, 13, 30),
    });
  });

  it("fills a cleared end from the NEW start when the start moved too", () => {
    expect(
      buildEventPatch(timedEvent, { ...seedTimed, startTime: "10:00", endDay: "", endTime: "" }),
    ).toStrictEqual({ startAt: utc(2026, 10, 20, 13, 0), endAt: utc(2026, 10, 20, 14, 0) });
  });

  it("changing only the zone moves the instants: the wall clock is the draft's truth", () => {
    // 09:30 to 11:30 stays 09:30 to 11:30 on the wall, now read in New York (EDT, -04:00).
    expect(buildEventPatch(timedEvent, { ...seedTimed, timezone: NEW_YORK })).toStrictEqual({
      timezone: NEW_YORK,
      startAt: utc(2026, 10, 20, 13, 30),
      endAt: utc(2026, 10, 20, 15, 30),
    });
  });

  it("sends the instants a zone change and a text change produce together", () => {
    expect(
      buildEventPatch(timedEvent, { ...seedTimed, timezone: NEW_YORK, title: "Dentista em NY" }),
    ).toStrictEqual({
      title: "Dentista em NY",
      timezone: NEW_YORK,
      startAt: utc(2026, 10, 20, 13, 30),
      endAt: utc(2026, 10, 20, 15, 30),
    });
  });

  it("resolves the new wall clock in the Event's own zone", () => {
    // 10:00 to 12:00 in New York; moving the start to 11:00 is 15:00 UTC.
    expect(buildEventPatch(newYorkEvent, { ...seedNewYork, startTime: "11:00" })).toStrictEqual({
      startAt: utc(2026, 10, 20, 15, 0),
      endAt: utc(2026, 10, 20, 16, 0),
    });
  });

  it("is empty when the new start falls past the end that stays", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, startTime: "12:00" })).toStrictEqual({});
  });

  it("is empty when the end falls before the start", () => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, endTime: "09:00" })).toStrictEqual({});
  });
});

describe("AC-27 buildEventPatch - a draft with an error yields an empty patch", () => {
  it.each<[string, Partial<EventDraft>]>([
    ["a blank title (even beside a changed description)", { title: "  ", description: "outra" }],
    ["a title over 200 characters", { title: "a".repeat(201) }],
    ["a description over 5000 characters", { description: "d".repeat(5001) }],
    ["a location over 200 characters", { location: "l".repeat(201), title: "Outro" }],
    ["no start day", { startDay: "", title: "Outro" }],
    ["no start time", { startTime: "", title: "Outro" }],
    ["an end before the start", { endDay: "2026-10-19", title: "Outro" }],
  ])("is {} for %s", (_label, overrides) => {
    expect(buildEventPatch(timedEvent, { ...seedTimed, ...overrides })).toStrictEqual({});
  });

  it("is {} for an all-day draft whose last day is before its first day", () => {
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, endDay: "2026-10-25" })).toStrictEqual({});
  });
});

describe("AC-27 buildEventPatch - an Event stored where the wall clock does not round-trip", () => {
  // 2026-11-01 in New York: the clocks go back at 02:00 EDT (06:00 UTC), so 01:00-02:00 happens
  // twice. 06:30 UTC is 01:30 EST, the SECOND 01:30; resolving "01:30" again would pick the first
  // (05:30 UTC) and silently move the Event an hour. A title-only edit must not do that.
  const startsInRepeatedHour = localTimed("o1", utc(2026, 11, 1, 6, 30), utc(2026, 11, 1, 7, 30), {
    title: "Voo",
    timezone: NEW_YORK,
  });
  const endsInRepeatedHour = localTimed("o2", utc(2026, 11, 1, 4, 30), utc(2026, 11, 1, 6, 30), {
    title: "Jantar",
    timezone: NEW_YORK,
  });
  // 07:30 UTC on 2026-03-08 is 03:30 EDT, half an hour after the spring-forward gap closed.
  const afterGap = localTimed("o3", utc(2026, 3, 8, 7, 30), utc(2026, 3, 8, 8, 30), {
    title: "Reunião",
    timezone: NEW_YORK,
  });

  it.each([
    ["an Event that starts in the repeated hour", startsInRepeatedHour],
    ["an Event that ends in the repeated hour", endsInRepeatedHour],
    ["an Event right after the spring-forward gap", afterGap],
  ])("sends only the title, no time key, for %s", (_label, event) => {
    const seeded = eventDraftFromEvent(event);
    expect(buildEventPatch(event, { ...seeded, title: "Novo título" })).toStrictEqual({
      title: "Novo título",
    });
  });

  it.each([
    ["starts in the repeated hour", startsInRepeatedHour],
    ["ends in the repeated hour", endsInRepeatedHour],
  ])("is empty when nothing changed on an Event that %s", (_label, event) => {
    expect(buildEventPatch(event, eventDraftFromEvent(event))).toStrictEqual({});
  });

  it("sends only the description when only the description changed on such an Event", () => {
    const seeded = eventDraftFromEvent(startsInRepeatedHour);
    expect(
      buildEventPatch(startsInRepeatedHour, { ...seeded, description: "Portão 12" }),
    ).toStrictEqual({ description: "Portão 12" });
  });

  it("moves only the end, leaving the start alone, when just the end is edited", () => {
    const seeded = eventDraftFromEvent(startsInRepeatedHour);
    // 03:30 EST is 08:30 UTC.
    expect(buildEventPatch(startsInRepeatedHour, { ...seeded, endTime: "03:30" })).toStrictEqual({
      endAt: utc(2026, 11, 1, 8, 30),
    });
  });
});

describe("AC-27 buildEventPatch - toggling Dia inteiro carries the target shape's keys only", () => {
  it("timed to all-day sends allDay, the first day and the exclusive end - no instants", () => {
    const patch = buildEventPatch(timedEvent, { ...seedTimed, allDay: true });
    expect(patch).toStrictEqual({ allDay: true, startDate: "2026-10-20", endDate: "2026-10-21" });
    expect(keysOf(patch)).toEqual(["allDay", "endDate", "startDate"]);
  });

  it("timed to all-day reads the last day from the draft's end day", () => {
    const overnight = localTimed(
      "n1",
      spSeconds("2026-10-20", "23:00"),
      spSeconds("2026-10-21", "01:00"),
    );
    const seeded = eventDraftFromEvent(overnight);
    expect(buildEventPatch(overnight, { ...seeded, allDay: true })).toStrictEqual({
      allDay: true,
      startDate: "2026-10-20",
      endDate: "2026-10-22",
    });
  });

  it("timed to all-day does not send a zone or a title that did not change", () => {
    expect(keysOf(buildEventPatch(timedEvent, { ...seedTimed, allDay: true }))).not.toContain(
      "timezone",
    );
    expect(keysOf(buildEventPatch(timedEvent, { ...seedTimed, allDay: true }))).not.toContain(
      "title",
    );
  });

  it("timed to all-day still sends a title or a zone that did change, beside the shape", () => {
    expect(
      buildEventPatch(timedEvent, {
        ...seedTimed,
        allDay: true,
        title: "Folga",
        timezone: NEW_YORK,
      }),
    ).toStrictEqual({
      title: "Folga",
      timezone: NEW_YORK,
      allDay: true,
      startDate: "2026-10-20",
      endDate: "2026-10-21",
    });
  });

  it("all-day to timed sends allDay and both instants from the kept times - no dates", () => {
    const patch = buildEventPatch(allDayEvent, {
      ...seedAllDay,
      allDay: false,
      startTime: "14:00",
      endTime: "15:30",
    });
    expect(patch).toStrictEqual({
      allDay: false,
      startAt: utc(2026, 10, 26, 17, 0),
      endAt: utc(2026, 10, 27, 18, 30),
    });
    expect(keysOf(patch)).toEqual(["allDay", "endAt", "startAt"]);
  });

  it("all-day to timed starts at the 09:00 the draft kept ready, with no re-typing", () => {
    const patch = buildEventPatch(allDayEvent, { ...seedAllDay, allDay: false });
    expect(patch).toStrictEqual({
      allDay: false,
      startAt: utc(2026, 10, 26, 12, 0),
      endAt: utc(2026, 10, 27, 12, 0),
    });
  });

  // Owner decision 2026-10-27 (phase-4 finding F1).
  it("all-day to timed on a single day ends one hour after the start, not at it", () => {
    const single = localAllDay("a2", "2026-10-20", "2026-10-21");
    expect(
      buildEventPatch(single, { ...eventDraftFromEvent(single), allDay: false }),
    ).toStrictEqual({
      allDay: false,
      startAt: utc(2026, 10, 20, 12, 0),
      endAt: utc(2026, 10, 20, 13, 0),
    });
  });

  it("all-day to timed resolves the instants in the draft's zone", () => {
    const patch = buildEventPatch(allDayEvent, {
      ...seedAllDay,
      allDay: false,
      timezone: NEW_YORK,
    });
    expect(patch).toStrictEqual({
      timezone: NEW_YORK,
      allDay: false,
      startAt: utc(2026, 10, 26, 13, 0),
      endAt: utc(2026, 10, 27, 13, 0),
    });
  });

  it("all-day to timed is empty when the kept times put the end before the start", () => {
    const single = localAllDay("a2", "2026-10-20", "2026-10-21");
    expect(
      buildEventPatch(single, {
        ...eventDraftFromEvent(single),
        allDay: false,
        startTime: "15:00",
        endTime: "14:00",
      }),
    ).toStrictEqual({});
  });

  it("all-day to timed accepts typed times on a single day", () => {
    const single = localAllDay("a2", "2026-10-20", "2026-10-21");
    expect(
      buildEventPatch(single, {
        ...eventDraftFromEvent(single),
        allDay: false,
        startTime: "14:00",
        endTime: "15:00",
      }),
    ).toStrictEqual({
      allDay: false,
      startAt: utc(2026, 10, 20, 17, 0),
      endAt: utc(2026, 10, 20, 18, 0),
    });
  });
});

describe("AC-27 buildEventPatch - an all-day Event", () => {
  it("sends BOTH days when the first day moves", () => {
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, startDay: "2026-10-27" })).toStrictEqual({
      startDate: "2026-10-27",
      endDate: "2026-10-28",
    });
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, startDay: "2026-10-24" })).toStrictEqual({
      startDate: "2026-10-24",
      endDate: "2026-10-28",
    });
  });

  it("sends the exclusive end alone when only the last day moves", () => {
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, endDay: "2026-10-29" })).toStrictEqual({
      endDate: "2026-10-30",
    });
  });

  it("makes a cleared last day, or one equal to the first, a single day", () => {
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, endDay: "" })).toStrictEqual({
      endDate: "2026-10-27",
    });
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, endDay: "2026-10-26" })).toStrictEqual({
      endDate: "2026-10-27",
    });
  });

  it("rolls the exclusive end over a year boundary", () => {
    expect(
      buildEventPatch(allDayEvent, { ...seedAllDay, startDay: "2026-12-31", endDay: "2026-12-31" }),
    ).toStrictEqual({ startDate: "2026-12-31", endDate: "2027-01-01" });
  });

  it("sends only the zone for a zone-only change, which has no effect on days", () => {
    expect(buildEventPatch(allDayEvent, { ...seedAllDay, timezone: NEW_YORK })).toStrictEqual({
      timezone: NEW_YORK,
    });
  });

  it("ignores the time fields it keeps for the switch", () => {
    expect(
      buildEventPatch(allDayEvent, { ...seedAllDay, startTime: "15:00", endTime: "16:00" }),
    ).toStrictEqual({});
  });

  it("sends a changed title alone", () => {
    expect(
      buildEventPatch(allDayEvent, { ...seedAllDay, title: "Feriado prolongado" }),
    ).toStrictEqual({
      title: "Feriado prolongado",
    });
  });
});

describe("AC-27 buildEventPatch - what the route would do with the patch", () => {
  /**
   * A model of the documented PATCH merge of `UpdateEventInput` (src/worker/routes/events.ts):
   * an absent key keeps the stored value, an explicit null clears it, toggling `allDay` carries
   * only the target shape's keys, and the merged Event goes through the shared validator. A 400
   * would throw here.
   */
  function mergePatch(event: EventDto, patch: UpdateEventInput): EventDto {
    const given = (key: keyof UpdateEventInput): boolean => Object.hasOwn(patch, key);
    const kindChanged = patch.allDay !== undefined && patch.allDay !== event.allDay;
    const carried = <T>(
      key: keyof UpdateEventInput,
      sent: T | null | undefined,
      stored: T | null,
    ): T | null => (given(key) ? (sent ?? null) : kindChanged ? null : stored);
    const result = validateEventInput({
      title: patch.title ?? event.title,
      description: given("description") ? (patch.description ?? null) : event.description,
      location: given("location") ? (patch.location ?? null) : event.location,
      allDay: patch.allDay ?? event.allDay,
      startAt: carried("startAt", patch.startAt, event.startAt),
      endAt: carried("endAt", patch.endAt, event.endAt),
      startDate: carried("startDate", patch.startDate, event.startDate),
      endDate: carried("endDate", patch.endDate, event.endDate),
      timezone: patch.timezone ?? event.timezone,
    });
    if (!result.ok) throw new Error(`the route would answer 400: ${result.error.field}`);
    return { ...event, ...result.value };
  }

  /** The parts of a draft that the Event it describes must reproduce. */
  function comparable(source: EventDraft): object {
    return {
      title: source.title.trim(),
      description: source.description.trim(),
      location: source.location.trim(),
      allDay: source.allDay,
      timezone: source.timezone,
      startDay: source.startDay,
      endDay: source.endDay,
      ...(source.allDay ? {} : { startTime: source.startTime, endTime: source.endTime }),
    };
  }

  const startsInRepeatedHour = localTimed("o1", utc(2026, 11, 1, 6, 30), utc(2026, 11, 1, 7, 30), {
    timezone: NEW_YORK,
  });

  const scenarios: Array<{ label: string; event: EventDto; draft: EventDraft }> = [
    {
      label: "a title edit",
      event: timedEvent,
      draft: { ...seedTimed, title: "Dentista (retorno)" },
    },
    {
      label: "the description cleared",
      event: timedEvent,
      draft: { ...seedTimed, description: "" },
    },
    { label: "a start move", event: timedEvent, draft: { ...seedTimed, startTime: "10:00" } },
    {
      label: "a start day move",
      event: timedEvent,
      draft: { ...seedTimed, startDay: "2026-10-19" },
    },
    { label: "an end move", event: timedEvent, draft: { ...seedTimed, endTime: "12:00" } },
    { label: "a zone change", event: timedEvent, draft: { ...seedTimed, timezone: NEW_YORK } },
    {
      label: "everything at once",
      event: timedEvent,
      draft: {
        ...seedTimed,
        title: "Outro",
        location: "",
        timezone: NEW_YORK,
        startTime: "13:00",
        endTime: "14:00",
      },
    },
    {
      label: "a New York start move",
      event: newYorkEvent,
      draft: { ...seedNewYork, startTime: "11:00" },
    },
    { label: "timed to all-day", event: timedEvent, draft: { ...seedTimed, allDay: true } },
    {
      label: "all-day to timed",
      event: allDayEvent,
      draft: { ...seedAllDay, allDay: false, startTime: "14:00", endTime: "15:30" },
    },
    {
      label: "an all-day start move",
      event: allDayEvent,
      draft: { ...seedAllDay, startDay: "2026-10-24" },
    },
    {
      label: "an all-day end move",
      event: allDayEvent,
      draft: { ...seedAllDay, endDay: "2026-10-29" },
    },
    {
      label: "an end move on an Event that starts in the repeated hour",
      event: startsInRepeatedHour,
      draft: { ...eventDraftFromEvent(startsInRepeatedHour), endTime: "03:30" },
    },
  ];

  it.each(scenarios)(
    "the Event the route stores for $label reads back as the draft",
    (scenario) => {
      const patch = buildEventPatch(scenario.event, scenario.draft);
      expect(Object.keys(patch).length).toBeGreaterThan(0);
      const stored = mergePatch(scenario.event, patch);
      expect(comparable(eventDraftFromEvent(stored))).toEqual(comparable(scenario.draft));
    },
  );

  it("sends only keys the route accepts, and never a server-owned one", () => {
    for (const scenario of scenarios) {
      const patch = buildEventPatch(scenario.event, scenario.draft);
      for (const key of Object.keys(patch)) {
        expect(EDITABLE_EVENT_FIELDS).toContain(key);
      }
      for (const forbidden of ["id", "source", "contentHash", "createdAt", "updatedAt"]) {
        expect(Object.hasOwn(patch, forbidden)).toBe(false);
      }
    }
  });
});

describe("AC-27 draftEndPreview - the end the owner has not fully typed", () => {
  it("previews the start plus one hour when no end is typed", () => {
    expect(draftEndPreview(draft())).toStrictEqual({ day: "2026-10-20", time: "10:30" });
  });

  it("carries the preview over midnight and over a year boundary", () => {
    expect(draftEndPreview(draft({ startTime: "23:30" }))).toStrictEqual({
      day: "2026-10-21",
      time: "00:30",
    });
    expect(draftEndPreview(draft({ startDay: "2026-12-31", startTime: "23:30" }))).toStrictEqual({
      day: "2027-01-01",
      time: "00:30",
    });
  });

  it("completes an end that has only a day with the start's clock time", () => {
    expect(draftEndPreview(draft({ endDay: "2026-10-22" }))).toStrictEqual({
      day: "2026-10-22",
      time: "09:30",
    });
  });

  it("previews the start plus one hour for an end that has only the start's own day", () => {
    expect(draftEndPreview(draft({ endDay: "2026-10-20" }))).toStrictEqual({
      day: "2026-10-20",
      time: "10:30",
    });
  });

  it("completes an end that has only a time with the start's day", () => {
    expect(draftEndPreview(draft({ endTime: "11:00" }))).toStrictEqual({
      day: "2026-10-20",
      time: "11:00",
    });
  });

  it("treats malformed end parts as not given", () => {
    expect(draftEndPreview(draft({ endDay: "garbage", endTime: "99:99" }))).toStrictEqual({
      day: "2026-10-20",
      time: "10:30",
    });
  });

  it("is null when the end is fully given", () => {
    expect(draftEndPreview(draft({ endDay: "2026-10-20", endTime: "10:30" }))).toBeNull();
    expect(draftEndPreview(draft({ endDay: "2026-10-20", endTime: "08:00" }))).toBeNull();
  });

  it("is null while the start cannot be resolved", () => {
    expect(draftEndPreview(draft({ startDay: "" }))).toBeNull();
    expect(draftEndPreview(draft({ startTime: "" }))).toBeNull();
    expect(draftEndPreview(draft({ startDay: "2026-02-30", endTime: "11:00" }))).toBeNull();
    expect(draftEndPreview(allDayDraft({ startDay: "", endDay: "" }))).toBeNull();
  });

  it("still previews when only the title is wrong", () => {
    expect(draftEndPreview(draft({ title: "" }))).toStrictEqual({
      day: "2026-10-20",
      time: "10:30",
    });
  });

  it("previews an all-day single day as its first day with no time", () => {
    expect(draftEndPreview(allDayDraft({ endDay: "" }))).toStrictEqual({
      day: "2026-10-26",
      time: null,
    });
    expect(draftEndPreview(allDayDraft({ endDay: "garbage" }))).toStrictEqual({
      day: "2026-10-26",
      time: null,
    });
  });

  it("is null for an all-day draft whose last day is given", () => {
    expect(draftEndPreview(allDayDraft({ endDay: "2026-10-27" }))).toBeNull();
  });

  it("ignores the time fields of an all-day draft", () => {
    expect(
      draftEndPreview(allDayDraft({ endDay: "", startTime: "", endTime: "99:99" })),
    ).toStrictEqual({
      day: "2026-10-26",
      time: null,
    });
  });

  it("reads the preview on the draft's own clock", () => {
    expect(draftEndPreview(draft({ timezone: NEW_YORK }))).toStrictEqual({
      day: "2026-10-20",
      time: "10:30",
    });
  });

  it("previews an hour that jumps the spring-forward gap as the wall clock it really lands on", () => {
    // 01:30 EST plus one hour is 03:30 EDT: the wall clock moves two hours, not one.
    expect(
      draftEndPreview(draft({ timezone: NEW_YORK, startDay: "2026-03-08", startTime: "01:30" })),
    ).toStrictEqual({ day: "2026-03-08", time: "03:30" });
  });

  it("previews a typed end that lands in the gap as the wall clock it resolves to", () => {
    // 02:30 does not exist; it resolves to 07:30 UTC, which is 03:30 EDT.
    expect(
      draftEndPreview(
        draft({ timezone: NEW_YORK, startDay: "2026-03-08", startTime: "01:30", endTime: "02:30" }),
      ),
    ).toStrictEqual({ day: "2026-03-08", time: "03:30" });
  });

  it("previews an hour that crosses the fall-back overlap by elapsed time, not by wall-clock text", () => {
    // 00:30 EDT plus one hour is 01:30 EDT (05:30 UTC); the repeated hour has not started yet.
    expect(
      draftEndPreview(draft({ timezone: NEW_YORK, startDay: "2026-11-01", startTime: "00:30" })),
    ).toStrictEqual({ day: "2026-11-01", time: "01:30" });
    // 01:30 resolves to its first occurrence (05:30 UTC); one hour later is 06:30 UTC, which is
    // 01:30 EST - the same text on the clock, the second time round.
    expect(
      draftEndPreview(draft({ timezone: NEW_YORK, startDay: "2026-11-01", startTime: "01:30" })),
    ).toStrictEqual({ day: "2026-11-01", time: "01:30" });
  });
});

describe("AC-27 timeZoneChoices - the options of Fuso horário", () => {
  const supported = ["Africa/Cairo", "America/New_York", "America/Sao_Paulo", "Asia/Tokyo"];

  it("starts with the owner's zone, then the Event's own zone, then the rest in order", () => {
    expect(timeZoneChoices(supported, NEW_YORK)).toEqual([
      "America/Sao_Paulo",
      "America/New_York",
      "Africa/Cairo",
      "Asia/Tokyo",
    ]);
  });

  it("does not repeat the owner's zone when it is also the Event's", () => {
    expect(timeZoneChoices(supported, SAO_PAULO)).toEqual([
      "America/Sao_Paulo",
      "Africa/Cairo",
      "America/New_York",
      "Asia/Tokyo",
    ]);
  });

  it("still offers an Event's valid zone that the runtime list leaves out", () => {
    expect(timeZoneChoices(supported, "UTC")).toEqual([
      "America/Sao_Paulo",
      "UTC",
      "Africa/Cairo",
      "America/New_York",
      "Asia/Tokyo",
    ]);
  });

  it("leaves out a current zone the runtime refuses", () => {
    expect(timeZoneChoices(supported, "Mars/Base")).toEqual([
      "America/Sao_Paulo",
      "Africa/Cairo",
      "America/New_York",
      "Asia/Tokyo",
    ]);
    expect(timeZoneChoices(supported, "")).toEqual([
      "America/Sao_Paulo",
      "Africa/Cairo",
      "America/New_York",
      "Asia/Tokyo",
    ]);
  });

  it("is the owner's zone and the Event's own when the runtime lists none", () => {
    expect(timeZoneChoices([], NEW_YORK)).toEqual([SAO_PAULO, NEW_YORK]);
    expect(timeZoneChoices([], SAO_PAULO)).toEqual([SAO_PAULO]);
  });

  it("offers the owner's zone first even when the runtime list omits it", () => {
    expect(timeZoneChoices(["Africa/Cairo"], SAO_PAULO)).toEqual([SAO_PAULO, "Africa/Cairo"]);
  });

  it("has no duplicates, even when the runtime list repeats a zone", () => {
    const choices = timeZoneChoices(["Asia/Tokyo", "Asia/Tokyo", NEW_YORK, SAO_PAULO], NEW_YORK);
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices).toEqual([SAO_PAULO, NEW_YORK, "Asia/Tokyo"]);
  });

  it("returns a fresh array and never mutates the list it was given", () => {
    const input = Object.freeze([...supported]);
    const choices = timeZoneChoices(input, NEW_YORK);
    expect(choices).not.toBe(input);
    expect(input).toEqual(supported);
    choices.push("Pacific/Fiji");
    expect(input).toEqual(supported);
  });

  it("returns a fresh array even when the list it was given is already the answer", () => {
    const alreadyFinal = Object.freeze([SAO_PAULO, "Africa/Cairo"]);
    const choices = timeZoneChoices(alreadyFinal, SAO_PAULO);
    expect(choices).toEqual(alreadyFinal);
    expect(choices).not.toBe(alreadyFinal);
  });

  it("keeps every zone of a long list exactly once", () => {
    const long = Array.from({ length: 400 }, (_value, index) => `Zone/Z${index}`);
    const choices = timeZoneChoices(long, "Zone/Z7");
    // "Zone/Z7" is not a real zone, so only the owner's zone leads; then the whole list.
    expect(choices).toEqual([SAO_PAULO, ...long]);
  });
});

describe("the module reads no clock", () => {
  it("proves the guard works: reading the clock inside it throws", () => {
    expect(() => withoutClock(() => Date.now())).toThrow();
    expect(() => withoutClock(() => new Date())).toThrow();
  });

  it("runs every builder without reading the clock", () => {
    expect(() =>
      withoutClock(() => {
        const created = newEventDraft("2026-10-20", spSeconds("2026-10-20", "14:00"));
        const seeded = eventDraftFromEvent(timedEvent);
        eventDraftErrors(seeded);
        buildCreateEventInput({ ...created, title: "Dentista" });
        buildEventPatch(timedEvent, { ...seeded, startTime: "10:00" });
        buildEventPatch(allDayEvent, { ...seedAllDay, allDay: false });
        draftEndPreview(draft());
        timeZoneChoices(["Africa/Cairo"], NEW_YORK);
      }),
    ).not.toThrow();
  });
});
