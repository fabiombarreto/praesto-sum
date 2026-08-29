/**
 * The agenda's decidable half (unit 4 `google-calendar-read`, phase 4).
 *
 * Two jobs, both of which can be wrong SILENTLY — which is exactly why they
 * live here rather than inside the component, where `docs/context/methodology.md`
 * would leave them verified only by eye:
 *
 *  1. **Narrow the window to today.** The API returns 7 days (kept for unit
 *     16's week view); layout standard §2.4 puts one group on screen showing
 *     today. The owner decided that on 2026-08-28 after comparing the two
 *     visually.
 *  2. **Order the rows.** `/api/google/events` concatenates calendar by
 *     calendar and `collectDayItems` never sorts, so without this the rows sit
 *     in calendar order and §2.4's "collapsed to the next event" names
 *     whichever calendar was queried first — wrong on any multi-calendar day.
 *
 * Like every module in `src/shared`, this compiles into both targets: no DOM
 * globals, no runtime dependencies, no clock. `today` is an argument.
 */

import type { CalendarEventDto } from "./api";
import { PRAESTO_TIMEZONE, todayIn } from "./dates";

/**
 * The local calendar day an event belongs to.
 *
 * An all-day event's `date` is used VERBATIM: it carries no zone at all, and
 * putting it through a conversion is exactly how such events land a day off. A
 * timed event's day comes from its instant in the owner's fixed zone — 22:00
 * in São Paulo is 01:00 UTC tomorrow, so a UTC-derived day would push every
 * late commitment off today.
 *
 * Deliberately the same rule as `dayItemFromEvent`; if one ever changes, both
 * must.
 */
function localDayOf(event: CalendarEventDto): string {
  return "date" in event.start
    ? event.start.date
    : todayIn(new Date(event.start.dateTime), PRAESTO_TIMEZONE);
}

/**
 * Sort key. All-day events sort before every timed one — they have no instant,
 * and ranking them by a fabricated midnight would place them against real
 * times as though they happened at 00:00, which is a claim the data does not
 * make.
 */
function startsAt(event: CalendarEventDto): number {
  return "date" in event.start ? Number.NEGATIVE_INFINITY : event.start.dateTime;
}

/**
 * Today's events, in the order the screen shows them.
 *
 * Copies before sorting: `Array.prototype.sort` mutates in place, and the
 * caller's array is React state.
 */
export function agendaForToday(
  events: readonly CalendarEventDto[],
  today: string,
): CalendarEventDto[] {
  return events
    .filter((event) => localDayOf(event) === today)
    .slice()
    .sort((a, b) => startsAt(a) - startsAt(b));
}
