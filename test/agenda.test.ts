/**
 * Unit 4 `google-calendar-read`, phase 4 — the agenda's decidable half.
 *
 * The screen itself is verified on the device (`docs/context/methodology.md`
 * keeps React component verification manual), so what lands here is precisely
 * the part that can be wrong SILENTLY: which events belong to today, and in
 * what order they sit.
 *
 * Ordering is not cosmetic. `/api/google/events` concatenates per calendar and
 * `collectDayItems` states outright that it never sorts — inside the `today`
 * bucket every item ties on `dueDate`, so without this function the rows
 * arrive in calendar order and layout standard §2.4's "collapsed to the next
 * event" names whichever calendar happened to be queried first.
 *
 * Fixtures use the payload shapes chore C12 pulled from the owner's real
 * account on 2026-08-25, and `today` is always an argument — nothing here
 * decays as the calendar moves.
 */

import { describe, expect, it } from "vitest";
import type { CalendarEventDto } from "../src/shared/api";
import { agendaForToday } from "../src/shared/agenda";

const TODAY = "2026-08-28";

function timed(id: string, iso: string, title: string | null = id): CalendarEventDto {
  return {
    id,
    calendarId: "primary",
    title,
    allDay: false,
    start: { dateTime: Date.parse(iso), timeZone: "America/Sao_Paulo" },
    end: { dateTime: Date.parse(iso) + 3_600_000, timeZone: "America/Sao_Paulo" },
    location: null,
    hasGuests: false,
    htmlLink: null,
  };
}

function allDay(id: string, date: string, title: string | null = id): CalendarEventDto {
  return {
    id,
    calendarId: "primary",
    title,
    allDay: true,
    start: { date },
    end: { date },
    location: null,
    hasGuests: false,
    htmlLink: null,
  };
}

const ids = (events: readonly CalendarEventDto[]): string[] => events.map((e) => e.id);

describe("agendaForToday — the window narrows to one day", () => {
  it("keeps only events whose local day is today", () => {
    const week = [
      timed("hoje", "2026-08-28T15:00:00-03:00"),
      timed("amanha", "2026-08-29T15:00:00-03:00"),
      timed("semana", "2026-09-02T15:00:00-03:00"),
    ];

    expect(ids(agendaForToday(week, TODAY))).toEqual(["hoje"]);
  });

  it("drops yesterday, even though the API window never returns it", () => {
    // Defensive: the window starts today, so this should not arrive. If it
    // ever does, it must not render on a screen called *Hoje*.
    expect(ids(agendaForToday([timed("ontem", "2026-08-27T15:00:00-03:00")], TODAY))).toEqual([]);
  });

  it("keeps an all-day event whose date IS today", () => {
    expect(ids(agendaForToday([allDay("hoje", TODAY)], TODAY))).toEqual(["hoje"]);
  });

  it("drops an all-day event on another day", () => {
    expect(ids(agendaForToday([allDay("outro", "2026-08-30")], TODAY))).toEqual([]);
  });

  it("keeps a late-evening event on ITS local day, not on the UTC one", () => {
    // 22:00 in São Paulo is 01:00 UTC tomorrow. Deriving the day from the
    // instant's UTC date would move every late commitment off today — the
    // most likely off-by-one in the whole phase.
    const late = timed("noite", "2026-08-28T22:00:00-03:00");

    expect(ids(agendaForToday([late], TODAY))).toEqual(["noite"]);
  });

  it("drops an early-morning event that is still yesterday locally", () => {
    // 00:30 UTC on the 29th is 21:30 on the 28th in São Paulo — the mirror of
    // the case above, and the one a naive UTC comparison gets wrong the other
    // way.
    const boundary = timed("limite", "2026-08-29T00:30:00Z");

    expect(ids(agendaForToday([boundary], TODAY))).toEqual(["limite"]);
  });

  it("returns an empty list rather than throwing when nothing is today", () => {
    expect(agendaForToday([timed("amanha", "2026-08-29T10:00:00-03:00")], TODAY)).toEqual([]);
  });

  it("returns an empty list for an empty input", () => {
    expect(agendaForToday([], TODAY)).toEqual([]);
  });
});

describe("agendaForToday — the order §2.4 depends on", () => {
  it("sorts timed events by start instant, whatever order they arrived in", () => {
    const scrambled = [
      timed("tarde", "2026-08-28T15:00:00-03:00"),
      timed("manha", "2026-08-28T09:00:00-03:00"),
      timed("meio", "2026-08-28T12:00:00-03:00"),
    ];

    expect(ids(agendaForToday(scrambled, TODAY))).toEqual(["manha", "meio", "tarde"]);
  });

  it("puts all-day events FIRST, before any timed one", () => {
    // An all-day event has no instant; placing it by a fabricated midnight
    // would rank it against real times as though it happened at 00:00. First
    // is a stated rule, not a side effect of a comparator.
    const mixed = [
      timed("cedo", "2026-08-28T08:00:00-03:00"),
      allDay("inteiro", TODAY),
      timed("tarde", "2026-08-28T18:00:00-03:00"),
    ];

    expect(ids(agendaForToday(mixed, TODAY))).toEqual(["inteiro", "cedo", "tarde"]);
  });

  it("keeps two all-day events in their arrival order", () => {
    const two = [allDay("a", TODAY), allDay("b", TODAY)];

    expect(ids(agendaForToday(two, TODAY))).toEqual(["a", "b"]);
  });

  it("orders across calendars, not within them — the reason this exists", () => {
    // `/api/google/events` concatenates calendar by calendar, so the second
    // calendar's morning event arrives after the first calendar's evening one.
    // Without this sort, §2.4's "next event" would be the evening one.
    const concatenated = [
      { ...timed("trabalho-noite", "2026-08-28T19:00:00-03:00"), calendarId: "work@example.com" },
      { ...timed("pessoal-manha", "2026-08-28T08:00:00-03:00"), calendarId: "primary" },
    ];

    expect(ids(agendaForToday(concatenated, TODAY))[0]).toBe("pessoal-manha");
  });

  it("breaks a tie on identical start instants deterministically", () => {
    const tied = [
      timed("segundo", "2026-08-28T10:00:00-03:00"),
      timed("primeiro", "2026-08-28T10:00:00-03:00"),
    ];

    // Arrival order survives a tie — a stable sort, so the same input always
    // renders the same way rather than shuffling between loads.
    expect(ids(agendaForToday(tied, TODAY))).toEqual(["segundo", "primeiro"]);
  });
});

describe("agendaForToday — purity", () => {
  it("does not mutate the array it is given", () => {
    const events = [
      timed("b", "2026-08-28T15:00:00-03:00"),
      timed("a", "2026-08-28T09:00:00-03:00"),
    ];

    agendaForToday(events, TODAY);

    // `.sort()` mutates in place; the caller's array must survive intact.
    expect(ids(events)).toEqual(["b", "a"]);
  });

  it("reads no clock — the same input and day always give the same answer", () => {
    const events = [timed("x", "2026-08-28T15:00:00-03:00")];

    expect(agendaForToday(events, TODAY)).toEqual(agendaForToday(events, TODAY));
    expect(agendaForToday(events, "2026-08-29")).toEqual([]);
  });

  it("carries an untitled event through untouched", () => {
    // Deciding what an untitled event READS as belongs to the screen; this
    // function must not quietly drop it or label it.
    const untitled = timed("sem-titulo", "2026-08-28T17:45:00-03:00", null);

    const [only] = agendaForToday([untitled], TODAY);
    expect(only?.title).toBeNull();
  });
});
