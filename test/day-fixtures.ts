// Shared fixtures for the day-view pure suites (unit 14 events-and-day-view, phase 3).
//
// Not a test file: the missing `.test` in the name keeps vitest from collecting it, the same way
// `test/isolation.ts` and `test/event-fixtures.ts` are support code. It holds only what the five
// new pure suites (day-range, day-item-local, day-groups-local, agenda-items, day-view) would
// otherwise copy five times: builders for the three DTOs a day is made of, a way to name a
// wall-clock moment in the owner's zone, and a guard that proves a function read no clock.
//
// It imports TYPES from the wire contract and nothing the Implementer writes in this phase, so a
// defect in a fixture can never hide behind a missing production module, and a production module
// can never vouch for its own input.

import type { CalendarEventDto, EventDto, TaskDto, TaskStatus } from "../src/shared/api";

/** The owner's zone, and the zone every fixture is authored in unless a case says otherwise. */
export const SAO_PAULO = "America/Sao_Paulo";

/**
 * Epoch SECONDS of a wall-clock moment in São Paulo, which has carried a fixed -03:00 offset
 * since 2019 and observes no DST in the dates these suites use: `spSeconds("2026-10-20", "09:30")`
 * is 2026-10-20T12:30Z (1_792_499_400). Seconds are what `EventDto` stores.
 */
export function spSeconds(day: string, time = "00:00"): number {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, date, hour + 3, minute) / 1000;
}

/** The same moment in epoch MILLISECONDS, which is what `CalendarEventDto` carries. */
export function spMillis(day: string, time = "00:00"): number {
  return spSeconds(day, time) * 1000;
}

/** A timed local Event. `startAt` and `endAt` are epoch SECONDS (use `spSeconds`). */
export function localTimed(
  id: string,
  startAt: number,
  endAt: number,
  overrides: Partial<EventDto> = {},
): EventDto {
  return {
    id,
    title: id,
    description: null,
    location: null,
    allDay: false,
    startAt,
    endAt,
    startDate: null,
    endDate: null,
    timezone: SAO_PAULO,
    source: "local",
    contentHash: "0".repeat(64),
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

/** An all-day local Event. `endDate` is EXCLUSIVE, as stored: one day `D` is `(D, D + 1)`. */
export function localAllDay(
  id: string,
  startDate: string,
  endDate: string,
  overrides: Partial<EventDto> = {},
): EventDto {
  return {
    id,
    title: id,
    description: null,
    location: null,
    allDay: true,
    startAt: null,
    endAt: null,
    startDate,
    endDate,
    timezone: SAO_PAULO,
    source: "local",
    contentHash: "0".repeat(64),
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

/** A timed Google event. `startMs` and `endMs` are epoch MILLISECONDS (use `spMillis`). */
export function googleTimed(
  id: string,
  startMs: number,
  endMs: number,
  overrides: Partial<CalendarEventDto> = {},
): CalendarEventDto {
  return {
    id,
    calendarId: "primary",
    title: id,
    allDay: false,
    start: { dateTime: startMs, timeZone: SAO_PAULO },
    end: { dateTime: endMs, timeZone: SAO_PAULO },
    location: null,
    hasGuests: false,
    htmlLink: null,
    ...overrides,
  };
}

/**
 * An all-day Google event. `endDate` defaults to `startDate`, which is what the shipped Agenda
 * fixtures carry (`test/agenda.test.ts`); Google's own convention is an EXCLUSIVE end.
 */
export function googleAllDay(
  id: string,
  startDate: string,
  endDate: string = startDate,
  overrides: Partial<CalendarEventDto> = {},
): CalendarEventDto {
  return {
    id,
    calendarId: "primary",
    title: id,
    allDay: true,
    start: { date: startDate },
    end: { date: endDate },
    location: null,
    hasGuests: false,
    htmlLink: null,
    ...overrides,
  };
}

/** A Task. Open and undated unless a case says otherwise; at most one date is ever set. */
export function task(
  id: string,
  overrides: {
    status?: TaskStatus;
    deadline?: string | null;
    scheduledDate?: string | null;
  } = {},
): TaskDto {
  const isMissed = overrides.status === "missed";
  return {
    id,
    title: id,
    description: null,
    status: overrides.status ?? "open",
    deadline: overrides.deadline ?? null,
    scheduledDate: overrides.scheduledDate ?? null,
    priority: null,
    lifeAreaId: null,
    seriesId: isMissed ? `series-${id}` : null,
    occurrenceDate: isMissed ? (overrides.deadline ?? null) : null,
    detached: false,
    completedAt: null,
    createdAt: 1_700_000_000,
  };
}

/** The ids of a list of day items (or of any records that carry one), in order. */
export function idsOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

/**
 * Runs `run` while the global `Date` refuses to read the clock: `Date.now()` and a `Date`
 * constructed with no argument both throw, while `new Date(<value>)`, `Date.UTC` and
 * `Date.parse` behave as ever. A function that reads the clock therefore fails loudly here
 * instead of passing by luck on the day the suite happens to run. `Date` is restored whatever
 * `run` does.
 *
 * Nothing is asserted INSIDE `run`: the assertion machinery may legitimately stamp a time.
 */
export function withoutClock<T>(run: () => T): T {
  const RealDate = globalThis.Date;
  const GuardedDate: DateConstructor = new Proxy(RealDate, {
    construct(target, argArray: unknown[]) {
      if (argArray.length === 0) throw new Error("the clock was read: new Date() with no argument");
      return Reflect.construct(target, argArray);
    },
    get(target, property) {
      if (property === "now") {
        return () => {
          throw new Error("the clock was read: Date.now()");
        };
      }
      return Reflect.get(target, property);
    },
  });

  globalThis.Date = GuardedDate;
  try {
    return run();
  } finally {
    globalThis.Date = RealDate;
  }
}
