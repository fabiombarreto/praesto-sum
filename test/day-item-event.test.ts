/**
 * Unit 4 `google-calendar-read`, phase 3 — projecting an event into a day item.
 *
 * Covers plan **AC-A9 (PRD AC-10)**. This file exists because the phase-3
 * manifest first claimed `EXISTING_TEST_COVERS test/day-item.test.ts` for
 * `dayItemFromEvent`, and review found that claim false: that suite exercises
 * `dayItemFromTask` and `assertNeverDaySource` and never touches this
 * function. A coverage gap dressed as existing coverage is worse than an
 * admitted gap, so the gap is closed here rather than re-argued.
 *
 * A separate file rather than an edit to `test/day-item.test.ts`, which is an
 * approved phase-1 suite.
 */

import { describe, expect, it } from "vitest";
import type { CalendarEventDto } from "../src/shared/api";
import { dayItemFromEvent } from "../src/shared/day-item";

function timed(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return {
    id: "evt-1",
    calendarId: "primary",
    title: "Daily - Super Ensino",
    allDay: false,
    start: { dateTime: Date.parse("2026-08-26T15:00:00-03:00"), timeZone: "America/Sao_Paulo" },
    end: { dateTime: Date.parse("2026-08-26T15:15:00-03:00"), timeZone: "America/Sao_Paulo" },
    location: null,
    hasGuests: false,
    htmlLink: null,
    ...overrides,
  } as CalendarEventDto;
}

function allDay(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return timed({
    id: "evt-allday",
    title: "momo",
    allDay: true,
    start: { date: "2026-08-25" },
    end: { date: "2026-08-26" },
    ...overrides,
  } as Partial<CalendarEventDto>);
}

describe("dayItemFromEvent", () => {
  it("tags the item as coming from google", () => {
    expect(dayItemFromEvent(timed()).source).toBe("google");
  });

  it("carries the event's own id", () => {
    expect(dayItemFromEvent(timed({ id: "evt-42" })).id).toBe("evt-42");
  });

  it("keeps the whole event reachable as the payload, without copying its fields", () => {
    const event = timed();

    expect(dayItemFromEvent(event).payload).toBe(event);
  });

  it("is never closed — an Event has no completion state", () => {
    // `docs/domain/areas/events.md`: an Event occurs or is cancelled, never
    // "done". A `true` here would put commitments in *Concluídas*.
    expect(dayItemFromEvent(timed()).closed).toBe(false);
    expect(dayItemFromEvent(allDay()).closed).toBe(false);
  });
});

describe("dayItemFromEvent — the due day", () => {
  it("uses an all-day event's local date verbatim", () => {
    // An all-day event carries no zone at all, so its date IS the day. Passing
    // it through a timezone conversion is how such events land one day off.
    expect(dayItemFromEvent(allDay()).dueDate).toBe("2026-08-25");
  });

  it("derives a timed event's day in the owner's fixed zone", () => {
    expect(dayItemFromEvent(timed()).dueDate).toBe("2026-08-26");
  });

  it("puts a late-evening event on its LOCAL day, not on the UTC one", () => {
    // 22:00 in Sao Paulo is 01:00 UTC the next day. Deriving the day from the
    // instant's UTC date would move every late commitment to tomorrow — the
    // most likely off-by-one in the whole unit.
    const late = timed({
      start: { dateTime: Date.parse("2026-08-26T22:00:00-03:00"), timeZone: "America/Sao_Paulo" },
    } as Partial<CalendarEventDto>);

    expect(dayItemFromEvent(late).dueDate).toBe("2026-08-26");
  });

  it("never yields a null due date — an event always happens on a day", () => {
    expect(dayItemFromEvent(timed()).dueDate).not.toBeNull();
    expect(dayItemFromEvent(allDay()).dueDate).not.toBeNull();
  });
});
