/**
 * The agenda's decidable half (unit 4 `google-calendar-read` phase 4; widened
 * by unit 14 `events-and-day-view` phase 3).
 *
 * Four jobs, all of which can be wrong SILENTLY — which is exactly why they live
 * here rather than inside the component, where `docs/context/methodology.md`
 * would leave them verified only by eye:
 *
 *  1. **Narrow the window to today.** The API returns 7 days (kept for unit
 *     16's week view); layout standard §2.4 puts one group on screen showing
 *     today. The owner decided that on 2026-08-28 after comparing the two
 *     visually.
 *  2. **Order the rows.** `/api/google/events` concatenates calendar by
 *     calendar and `collectDayItems` never sorts, so without this the rows sit
 *     in calendar order and the Agenda's first row names whichever calendar
 *     was queried first — wrong on any multi-calendar day.
 *  3. **Join the two kinds of commitment.** Local Events and Google events are
 *     two sources of one Agenda; `agendaItemsForToday` feeds both to the one
 *     range function (`itemsInRange`) with a one-day range, so *Hoje* and the
 *     `/day` route cannot disagree about what a day holds. The placement rule —
 *     which days an all-day span or a timed span occupies, and the
 *     seconds/milliseconds conversion it needs — lives ONLY in
 *     `dayItemPlacement`; this module has no copy of it. (The projections in
 *     `day-item.ts` carry each item's start day as `dueDate` for the partition;
 *     the range function does not read it for an Event.)
 *  4. **Never let a day read as free by mistake.** `decideAgendaNotice` is the
 *     one place that decides when the Agenda or the day view may say "nothing
 *     here": a failed Google fetch, or another source that has not answered,
 *     must never produce the empty text.
 *
 * Like every module in `src/shared`, this compiles into both targets: no DOM
 * globals, no runtime dependencies, no clock. `today` is an argument.
 */

import type { CalendarEventDto, EventDto } from "./api";
import { itemsInRange } from "./day-range";
import {
  dayItemFromEvent,
  dayItemFromLocalEvent,
  type ExternalDayItem,
  type LocalDayItem,
} from "./day-item";
import { googleFailureMessage } from "./google-failure-copy";

/**
 * What the agenda region knows about itself.
 *
 * Four states, and they must never render the same pixels. `TaskGroup` returns
 * `null` at zero rows, so a failed fetch would otherwise be indistinguishable
 * from a genuinely free day — which is the one outcome the unit's success
 * metric sets to zero.
 */
export type AgendaState =
  | { kind: "loading" }
  | { kind: "ready" }
  /** Some calendars answered, at least one did not. A short day, not a free one. */
  | { kind: "partial"; failed: number }
  /** Nothing arrived. `reason` separates "connect" from "reconnect" from "try later". */
  | { kind: "failed"; reason: string | null };

/**
 * The line *Hoje* says over a day with nothing on the Agenda. An owner approval
 * (2026-08-28), not an invention. The failure strings are NOT here: the settings
 * screen says them too, so the words and the reason that selects them live in
 * `google-failure-copy.ts`.
 */
export const AGENDA_EMPTY = "Nada na agenda hoje.";

/** The "some calendars did not answer" line. Byte-for-byte what *Hoje* has said since unit 4. */
export function agendaPartialMessage(failed: number): string {
  return failed === 1
    ? "Um calendário não respondeu — a agenda pode estar incompleta."
    : `${failed} calendários não responderam — a agenda pode estar incompleta.`;
}

/**
 * Today's commitments from both sources, in the order the screen shows them:
 * all-day rows first, then timed rows by start, a local row before a Google row
 * on a tie (the local source is listed first). An item that began on an earlier
 * day and runs into today is listed too, by its real start (plan decision D3-3).
 *
 * Returns the very day items `itemsInRange` produced, whose `event`/`payload`
 * are the caller's DTOs, never copies.
 */
export function agendaItemsForToday(
  local: readonly EventDto[],
  google: readonly CalendarEventDto[],
  today: string,
): (LocalDayItem | ExternalDayItem)[] {
  const [entry] = itemsInRange(
    [
      { id: "local", items: local.map(dayItemFromLocalEvent) },
      { id: "google", items: google.map(dayItemFromEvent) },
    ],
    { from: today, to: today },
  );

  return (entry?.items ?? []).flatMap((item) => (item.source === "task" ? [] : [item]));
}

/**
 * Today's Google events, in the order the screen shows them — a thin caller of
 * the range function, kept for its signature and its return type.
 *
 * The range function sorts only lists it built itself, so the caller's array —
 * React state — is never mutated.
 */
export function agendaForToday(
  events: readonly CalendarEventDto[],
  today: string,
): CalendarEventDto[] {
  return agendaItemsForToday([], events, today).flatMap((item) =>
    item.source === "google" ? [item.payload] : [],
  );
}

/**
 * The one line, if any, that an Agenda or a day view says about itself.
 *
 * `othersReady` is `true` once every OTHER source (the local commitments, and
 * the Tasks on `/day`) has answered successfully, so an unanswered or failed
 * source can never let a day read as free.
 *
 *  - `loading` says nothing: the answer is not in yet.
 *  - `partial` and `failed` always speak, whatever the row count — a short or
 *    unknown day is never silent, and a failed Google fetch with no rows must
 *    not look like a free day.
 *  - `ready` speaks the caller's empty text in exactly one situation: no rows
 *    AND every other source answered.
 */
export function decideAgendaNotice(input: {
  google: AgendaState;
  othersReady: boolean;
  rowCount: number;
  emptyText: string;
}): string | null {
  const { google, othersReady, rowCount, emptyText } = input;

  switch (google.kind) {
    case "loading":
      return null;
    case "partial":
      return agendaPartialMessage(google.failed);
    case "failed":
      return googleFailureMessage(google.reason);
    case "ready":
      return rowCount === 0 && othersReady ? emptyText : null;
  }
}
