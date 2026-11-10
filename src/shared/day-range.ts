/**
 * THE range function (unit 14 `events-and-day-view`, phase 3; ADR-0016 / PRD D-J).
 *
 * `itemsInRange(sources, { from, to })` turns local Events, Google events and
 * open dated Tasks into per-day items: one entry per day of the range, each
 * listing everything that occupies that day. *Hoje*'s Agenda (a one-day range)
 * and the `/day/AAAA-MM-DD` route (a one-day range) call it now; unit 16's week
 * view will call it with a week. Like `collectDayItems`, it takes a LIST of
 * sources and there is deliberately no branch on how many arrived or on what a
 * source is called — zero, one, two, three and five run the same code.
 *
 * **The seam.** `EventDto` stores epoch SECONDS and `CalendarEventDto` epoch
 * MILLISECONDS. `dayItemPlacement` is the single place that turns an item into
 * milliseconds and covered days for the range function: every day this module
 * derives from an instant goes through it, so inside the range function the two
 * DTOs cannot disagree about which day the same moment is on.
 * (`dayItemFromLocalEvent` in `day-item.ts` scales the Event's start for its own
 * `dueDate`; it applies the same owner-zone rule and agrees with the
 * placement's `firstDay`, but the range function never reads it for an Event.)
 *
 * **The owner's day.** A "day" is always a day in `PRAESTO_TIMEZONE` (plan
 * decision D3-1), for local and Google items alike. 22:00 there is 01:00 UTC
 * tomorrow, and 00:30 UTC is still last evening. An all-day date carries no
 * zone and is used verbatim.
 *
 * **Spans** (D3-3). An all-day item covers its start day through the day BEFORE
 * its exclusive end; a timed item covers the day of its start through the day
 * of its last instant (`end - 1`), so an item ending exactly at 00:00 does not
 * spill onto the next day. An end that is not after its start is read as the
 * start itself and the item covers its start day only — it never throws.
 *
 * **Order within a day** (D3-4): all-day items first, in arrival order; then
 * timed items ascending by their real start, ties in ARRIVAL order (a stable
 * sort — `test/agenda.test.ts` pins arrival order for tied starts, which is
 * why this is not id-ordered); then open Tasks in arrival order. "Arrival
 * order" is the flattened order of `sources`, then of each source's `items`. A
 * continuation of an earlier day sorts by its real start, which is before
 * everything that starts on the day.
 *
 * The output items are the input `DayItem` references, never copies. Like every
 * module in `src/shared` this compiles into both targets: no DOM globals, no
 * runtime dependencies, and no clock — there is no `Date.now()` and no `new
 * Date()` without an argument; `new Date(<number>)` is the only form used.
 */

import type { CalendarEventDto, EventDto } from "./api";
import { PRAESTO_TIMEZONE, todayIn } from "./dates";
import type { DayItemSource } from "./day-groups";
import { assertNeverDaySource, type DayItem } from "./day-item";
import { displayEndDay, isValidLocalDay, shiftLocalDay } from "./events";

/** An inclusive range of local days, `YYYY-MM-DD` on both ends. */
export interface DayRange {
  from: string;
  to: string;
}

/** One day of the answer: the day and every item that occupies it. */
export interface DayRangeEntry {
  day: string;
  items: DayItem[];
}

/**
 * Where an item sits on the calendar. `firstDay` and `lastDay` are inclusive
 * and in the owner's zone; `startMs`/`endMs` are epoch MILLISECONDS whichever
 * DTO the item came from, and `endMs` is never before `startMs`.
 */
export type DayItemPlacement =
  | { kind: "allDay"; firstDay: string; lastDay: string }
  | { kind: "timed"; startMs: number; endMs: number; firstDay: string; lastDay: string }
  | { kind: "task"; day: string };

/** The owner's local day of an instant in epoch milliseconds. */
function dayOfMs(epochMs: number): string {
  return todayIn(new Date(epochMs), PRAESTO_TIMEZONE);
}

/**
 * The inclusive last day of an all-day span written with an EXCLUSIVE end. An
 * end that is not after the start covers the start day alone (Google is
 * reported to accept equal dates, and the schema refuses them only for local
 * rows).
 */
function allDaySpan(startDate: string, endDate: string | null): DayItemPlacement {
  const lastDay = endDate !== null && endDate > startDate ? displayEndDay(endDate) : startDate;
  return { kind: "allDay", firstDay: startDate, lastDay };
}

/** A timed span between two instants in milliseconds. */
function timedSpan(startMs: number, rawEndMs: number): DayItemPlacement {
  const endMs = rawEndMs > startMs ? rawEndMs : startMs;
  const firstDay = dayOfMs(startMs);
  // The day of the LAST INSTANT, not of the end instant: an item ending exactly
  // at local midnight belongs to the day it ran in.
  const lastDay = endMs > startMs ? dayOfMs(endMs - 1) : firstDay;
  return { kind: "timed", startMs, endMs, firstDay, lastDay };
}

function placeLocal(event: EventDto): DayItemPlacement | null {
  if (event.allDay) {
    if (event.startDate === null) return null;
    return allDaySpan(event.startDate, event.endDate);
  }
  if (event.startAt === null) return null;
  const startMs = event.startAt * 1000;
  return timedSpan(startMs, event.endAt === null ? startMs : event.endAt * 1000);
}

function placeGoogle(event: CalendarEventDto): DayItemPlacement {
  if ("date" in event.start) {
    return allDaySpan(event.start.date, "date" in event.end ? event.end.date : null);
  }
  const startMs = event.start.dateTime;
  // A missing or mismatched end (a date where a time was expected) is read as
  // the start: nothing to span with, so the start's day only.
  return timedSpan(startMs, "dateTime" in event.end ? event.end.dateTime : startMs);
}

/**
 * Where a day item sits, or `null` when it cannot be placed — a closed or
 * undated Task. Exhaustive over the item's source: a new source stops
 * compiling here until it is decided.
 */
export function dayItemPlacement(item: DayItem): DayItemPlacement | null {
  switch (item.source) {
    case "task":
      if (item.closed || item.dueDate === null) return null;
      return { kind: "task", day: item.dueDate };
    case "local":
      return placeLocal(item.event);
    case "google":
      return placeGoogle(item.payload);
    default:
      return assertNeverDaySource(item);
  }
}

/** An item with its placement resolved once, ready to be listed on each day it covers. */
interface Placed {
  item: DayItem;
  placement: DayItemPlacement;
}

/** The first and last day a placement occupies, inclusive. */
function coveredDays(placement: DayItemPlacement): { first: string; last: string } {
  if (placement.kind === "task") return { first: placement.day, last: placement.day };
  return { first: placement.firstDay, last: placement.lastDay };
}

/**
 * Every item of every source, per day of `range`, in the order the screens
 * show them. An inverted or malformed range returns no entries.
 */
export function itemsInRange(sources: readonly DayItemSource[], range: DayRange): DayRangeEntry[] {
  if (!isValidLocalDay(range.from) || !isValidLocalDay(range.to) || range.from > range.to) {
    return [];
  }

  const perDay = new Map<string, Placed[]>();
  for (let day = range.from; day <= range.to; day = shiftLocalDay(day, 1)) {
    perDay.set(day, []);
  }

  for (const source of sources) {
    for (const item of source.items) {
      const placement = dayItemPlacement(item);
      if (placement === null) continue;

      // Clip to the range first, so an item spanning years costs only the days
      // that are actually asked for.
      const { first, last } = coveredDays(placement);
      const start = first > range.from ? first : range.from;
      const end = last < range.to ? last : range.to;
      for (let day = start; day <= end; day = shiftLocalDay(day, 1)) {
        perDay.get(day)?.push({ item, placement });
      }
    }
  }

  return Array.from(perDay, ([day, placed]) => {
    const allDay = placed.filter((entry) => entry.placement.kind === "allDay");
    const tasks = placed.filter((entry) => entry.placement.kind === "task");
    const timed = placed
      .flatMap((entry) =>
        entry.placement.kind === "timed"
          ? [{ item: entry.item, startMs: entry.placement.startMs }]
          : [],
      )
      // `Array.prototype.sort` is stable: tied starts keep arrival order.
      .sort((a, b) => a.startMs - b.startMs);

    const itemOf = (entry: { item: DayItem }): DayItem => entry.item;
    return { day, items: [...allDay.map(itemOf), ...timed.map(itemOf), ...tasks.map(itemOf)] };
  });
}
