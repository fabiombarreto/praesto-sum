/**
 * The decidable half of creating and editing an Event (*Compromisso*), unit 14
 * `events-and-day-view` phase 4, PRD AC-27: `task-edit.ts` for an Event.
 *
 * The sheet's form model is a DRAFT of wall-clock parts: a day and a time in the
 * commitment's OWN zone, never instants. `POST` and `PATCH /api/events` take
 * instants (epoch seconds) for a timed Event and exclusive local days for an
 * all-day one, so something has to turn the draft into those bodies and, for a
 * `PATCH`, decide which keys the request carries. That decision is the subtle
 * part of this unit, so it lives here, pure and tested, rather than inside a React
 * component this project has no way to test (`docs/context/methodology.md`,
 * "Browser-API work: split the logic out, then the glue is exempt").
 *
 * **One resolution rule, shared.** `resolveDraftTimes` is the only place a draft
 * becomes instants or days. The errors, the create input, the patch and the end
 * preview all call it, so they cannot disagree about the times, and it goes through
 * the shared `validateEventInput` (the validator the route runs), so the sheet and
 * the route decide the instants, the all-day span and the end-before-start rule with
 * the same code. The draft-level field checks are this module's own, in
 * `eventDraftErrors`: a blank or too long title, a too long description or location
 * (measured against the shared `EVENT_*_MAX` limits), and a day or an `HH:mm` that is
 * not real.
 *
 * **The wall clock is the draft's truth.** A patch decides which time keys to send
 * by comparing the draft's wall-clock parts with the ones the Event seeds, never
 * by comparing instants: an Event stored in an hour that occurs twice, or right
 * after a gap, does not survive instant -> wall clock -> instant, and a title edit
 * must not move it. Changing the zone with the wall clock untouched therefore
 * moves a timed Event's instants.
 *
 * Clock-free and DOM-free ("now" is an argument), compiled into every target.
 */

import type { CreateEventInput, EventDto, UpdateEventInput } from "./api";
import {
  allDaySpanFromInclusive,
  displayEndDay,
  EVENT_DEFAULT_TIMEZONE,
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  instantToWallClock,
  isValidLocalDay,
  isValidTimeZone,
  validateEventInput,
  wallClockToInstant,
  type ResolvedEvent,
} from "./events";

/** The start of a new commitment on a day that is not today. */
export const EVENT_DEFAULT_START_TIME = "09:00";

/**
 * The current value of every control on the Compromisso sheet. Every member is
 * required: a form always has a value, and the empty string means "not given".
 * `startDay`/`endDay` are `YYYY-MM-DD` and `startTime`/`endTime` are `HH:mm`, all
 * WALL-CLOCK parts in `timezone`. For an all-day draft `endDay` is the INCLUSIVE
 * last day the owner sees (the stored end is exclusive), and the two times are
 * not read by the functions below while the draft is all-day yet stay in the
 * draft, so switching *Dia inteiro* off needs no re-typing.
 */
export interface EventDraft {
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  startDay: string;
  startTime: string;
  endDay: string;
  endTime: string;
  timezone: string;
}

/** What is wrong with a draft, by field; the sentence the owner reads lives in `event-view.ts`. */
export type EventDraftError =
  | { field: "title"; code: "blank" | "too_long" }
  | { field: "description" | "location"; code: "too_long" }
  | { field: "start"; code: "day_required" | "time_required" }
  | { field: "end"; code: "end_before_start" };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True for a real `HH:mm`, 00:00 to 23:59. */
function isValidTime(time: string): boolean {
  return TIME_PATTERN.test(time);
}

/**
 * The zone every instant of the draft is resolved in. The select can only offer a
 * zone the runtime knows, but the function stays total for any string.
 */
function effectiveTimeZone(draft: EventDraft): string {
  return isValidTimeZone(draft.timezone) ? draft.timezone : EVENT_DEFAULT_TIMEZONE;
}

/** A placeholder title: only the time fields of the validated result are read back. */
const TIMES_ONLY_TITLE = "-";

/**
 * The next full hour after `time` (`HH:mm`), capped at 23:00 because no later full
 * hour exists that day: 14:00 and 14:30 give 15:00, 06:30 gives 07:00, 23:10 gives 23:00.
 */
function nextFullHour(time: string): string {
  const hour = Number(time.slice(0, 2));
  const next = Math.min(hour + 1, 23);
  return `${String(next).padStart(2, "0")}:00`;
}

/**
 * A new commitment's draft for `day`: prefilled with that day, an empty end and
 * the owner's zone. The start is 09:00, EXCEPT when `day` is today in the owner's
 * zone at `nowSeconds`, when it is the next full hour (PRD AC-28).
 */
export function newEventDraft(day: string, nowSeconds: number): EventDraft {
  const now = instantToWallClock(nowSeconds, EVENT_DEFAULT_TIMEZONE);
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    startDay: day,
    startTime: now.day === day ? nextFullHour(now.time) : EVENT_DEFAULT_START_TIME,
    endDay: "",
    endTime: "",
    timezone: EVENT_DEFAULT_TIMEZONE,
  };
}

/**
 * The draft that describes `event` as the server holds it: the wall-clock parts of a
 * timed Event in the Event's OWN zone (not the owner's); for an all-day Event, its
 * first day, its INCLUSIVE last day and a 09:00 start time ready for the *Dia
 * inteiro* switch. A zone the runtime refuses falls back to
 * the owner's zone, and the parts are read there. A DTO missing the start its kind
 * needs (unreachable under the schema's CHECK) seeds empty parts rather than throwing.
 */
export function eventDraftFromEvent(event: EventDto): EventDraft {
  const timezone = isValidTimeZone(event.timezone) ? event.timezone : EVENT_DEFAULT_TIMEZONE;
  const base = {
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    allDay: event.allDay,
    timezone,
  };

  if (event.allDay) {
    return {
      ...base,
      startDay: event.startDate ?? "",
      startTime: EVENT_DEFAULT_START_TIME,
      endDay:
        event.endDate !== null && isValidLocalDay(event.endDate)
          ? displayEndDay(event.endDate)
          : "",
      endTime: "",
    };
  }

  const start = event.startAt === null ? null : instantToWallClock(event.startAt, timezone);
  const end = event.endAt === null ? null : instantToWallClock(event.endAt, timezone);
  return {
    ...base,
    startDay: start?.day ?? "",
    startTime: start?.time ?? "",
    endDay: end?.day ?? "",
    endTime: end?.time ?? "",
  };
}

/** The start's own error, or `null` when the start can be resolved. The day wins over the time. */
function startError(draft: EventDraft): "day_required" | "time_required" | null {
  if (!isValidLocalDay(draft.startDay)) return "day_required";
  if (!draft.allDay && !isValidTime(draft.startTime)) return "time_required";
  return null;
}

/**
 * The one resolution rule (see the header). Assumes the start has no error. A timed
 * draft's end is built from whatever end parts are real: a missing end day takes the
 * start day, a missing end time takes the start time, and an end with neither real is
 * left to the shared default (start plus one hour). The same default applies when the
 * end TIME is missing and the completed end would land exactly on the start (an end
 * that has only the start's own day, which is what switching *Dia inteiro* off leaves
 * on a single-day commitment): a commitment never silently ends where it starts (owner
 * decision 2026-10-27). An end time the owner typed is always kept, even when it
 * equals the start. An all-day draft's last day, when
 * real, gives the exclusive end; no last day is a single day. Returns `null` when the
 * shared validator refuses the times, which for a draft whose start resolves can only
 * mean an end before the start.
 */
function resolveDraftTimes(draft: EventDraft): ResolvedEvent | null {
  const timezone = effectiveTimeZone(draft);

  if (draft.allDay) {
    const lastDay = isValidLocalDay(draft.endDay) ? draft.endDay : null;
    const span = allDaySpanFromInclusive(draft.startDay, lastDay);
    if (!span.ok) return null;
    const checked = validateEventInput({
      title: TIMES_ONLY_TITLE,
      allDay: true,
      startDate: span.value.startDate,
      endDate: span.value.endDate,
      timezone,
    });
    return checked.ok ? checked.value : null;
  }

  const endDayGiven = isValidLocalDay(draft.endDay);
  const endTimeGiven = isValidTime(draft.endTime);
  const startAt = wallClockToInstant(draft.startDay, draft.startTime, timezone);
  let endAt =
    endDayGiven || endTimeGiven
      ? wallClockToInstant(
          endDayGiven ? draft.endDay : draft.startDay,
          endTimeGiven ? draft.endTime : draft.startTime,
          timezone,
        )
      : null;
  // An end completed from the start that lands ON the start is not an end the owner chose.
  if (!endTimeGiven && endAt === startAt) endAt = null;
  const checked = validateEventInput({
    title: TIMES_ONLY_TITLE,
    allDay: false,
    startAt,
    endAt,
    timezone,
  });
  return checked.ok ? checked.value : null;
}

/**
 * Every problem a draft has, at most one per field, in the order the shared
 * validator judges them (title, description, location, start, end), which is not
 * the order of the form. The end is judged only when the start can be
 * resolved. A timed end equal to the start is accepted, an all-day last day equal to
 * the first day is a single day, and a malformed end part counts as "not given".
 */
export function eventDraftErrors(draft: EventDraft): EventDraftError[] {
  const errors: EventDraftError[] = [];

  const title = draft.title.trim();
  if (title === "") errors.push({ field: "title", code: "blank" });
  else if (title.length > EVENT_TITLE_MAX) errors.push({ field: "title", code: "too_long" });

  if (draft.description.trim().length > EVENT_DESCRIPTION_MAX) {
    errors.push({ field: "description", code: "too_long" });
  }
  if (draft.location.trim().length > EVENT_LOCATION_MAX) {
    errors.push({ field: "location", code: "too_long" });
  }

  const start = startError(draft);
  if (start !== null) errors.push({ field: "start", code: start });
  else if (resolveDraftTimes(draft) === null)
    errors.push({ field: "end", code: "end_before_start" });

  return errors;
}

/**
 * The `POST /api/events` body for a draft, or `null` exactly when the draft has an
 * error. A timed body always carries its end (given, partly filled or the default)
 * and an all-day body carries `startDate` and the EXCLUSIVE `endDate`; never the
 * other kind's keys. Empty description and location are omitted.
 */
export function buildCreateEventInput(draft: EventDraft): CreateEventInput | null {
  if (eventDraftErrors(draft).length > 0) return null;
  const times = resolveDraftTimes(draft);
  if (times === null) return null;

  const input: CreateEventInput = {
    title: draft.title.trim(),
    allDay: draft.allDay,
    timezone: effectiveTimeZone(draft),
  };
  const description = draft.description.trim();
  if (description !== "") input.description = description;
  const location = draft.location.trim();
  if (location !== "") input.location = location;

  if (draft.allDay) {
    input.startDate = times.startDate;
    input.endDate = times.endDate;
  } else {
    input.startAt = times.startAt;
    input.endAt = times.endAt;
  }
  return input;
}

/**
 * The minimal `PATCH /api/events/:id` body that turns `event`, as the server holds
 * it, into `draft`. `{}` when nothing changed AND when the draft has an error (the
 * caller checks the errors first; a patch is never built from a bad draft).
 *
 * Text keys are present only when the trimmed value differs (`null` clears a
 * description or location), the zone only when it differs from the seeded one, and
 * the time keys are decided from the wall-clock parts (see the header):
 *
 *  - the *Dia inteiro* switch differs: `allDay` plus ONLY the target shape's keys;
 *  - timed, the start day, start time or zone differ: BOTH `startAt` and `endAt`
 *    (the route does not shift the end, and a start moved past the stored end is a
 *    400); otherwise the end day or end time differ: `endAt` alone;
 *  - all-day, the first day differs: BOTH days; otherwise the last day differs:
 *    `endDate` alone. A zone-only change sends only `timezone`.
 */
export function buildEventPatch(event: EventDto, draft: EventDraft): UpdateEventInput {
  if (eventDraftErrors(draft).length > 0) return {};
  const times = resolveDraftTimes(draft);
  if (times === null) return {};

  const seed = eventDraftFromEvent(event);
  const patch: UpdateEventInput = {};

  const title = draft.title.trim();
  if (title !== event.title) patch.title = title;

  const description = draft.description.trim();
  const nextDescription = description === "" ? null : description;
  if (nextDescription !== (event.description ?? null)) patch.description = nextDescription;

  const location = draft.location.trim();
  const nextLocation = location === "" ? null : location;
  if (nextLocation !== (event.location ?? null)) patch.location = nextLocation;

  const zone = effectiveTimeZone(draft);
  const zoneChanged = zone !== seed.timezone;
  if (zoneChanged) patch.timezone = zone;

  if (draft.allDay !== seed.allDay) {
    patch.allDay = draft.allDay;
    if (draft.allDay) {
      patch.startDate = times.startDate;
      patch.endDate = times.endDate;
    } else {
      patch.startAt = times.startAt;
      patch.endAt = times.endAt;
    }
  } else if (!draft.allDay) {
    const startMoved =
      draft.startDay !== seed.startDay || draft.startTime !== seed.startTime || zoneChanged;
    const endMoved = draft.endDay !== seed.endDay || draft.endTime !== seed.endTime;
    if (startMoved) {
      patch.startAt = times.startAt;
      patch.endAt = times.endAt;
    } else if (endMoved) {
      patch.endAt = times.endAt;
    }
  } else if (draft.startDay !== seed.startDay) {
    patch.startDate = times.startDate;
    patch.endDate = times.endDate;
  } else if (draft.endDay !== seed.endDay) {
    patch.endDate = times.endDate;
  }

  return patch;
}

/**
 * The end the owner has not fully typed, so the sheet shows it BEFORE saving: the
 * resolved end as wall-clock parts in the draft's zone (start plus one hour, or the
 * partly filled end), and for an all-day draft the inclusive last day with no time.
 * `null` when the start cannot be resolved, when the end is fully given (a real day
 * and a real time, or for all-day a real last day), or when a partly typed end
 * falls before the start (the sheet's inline reason says so instead).
 */
export function draftEndPreview(draft: EventDraft): { day: string; time: string | null } | null {
  if (startError(draft) !== null) return null;

  if (draft.allDay) {
    if (isValidLocalDay(draft.endDay)) return null;
    return { day: draft.startDay, time: null };
  }

  if (isValidLocalDay(draft.endDay) && isValidTime(draft.endTime)) return null;
  const times = resolveDraftTimes(draft);
  if (times === null || times.endAt === null) return null;
  return instantToWallClock(times.endAt, effectiveTimeZone(draft));
}

/**
 * The options of *Fuso horário*: the owner's zone first, then `current` when it
 * differs and the runtime accepts it (so a zone `supported` leaves out, such as `UTC`
 * in V8, is still offered when an Event uses it), then every entry of `supported`
 * not already present, in the given order. A fresh array; `supported` is not mutated.
 */
export function timeZoneChoices(supported: readonly string[], current: string): string[] {
  const choices: string[] = [EVENT_DEFAULT_TIMEZONE];
  const seen = new Set(choices);
  if (!seen.has(current) && isValidTimeZone(current)) {
    choices.push(current);
    seen.add(current);
  }
  for (const zone of supported) {
    if (seen.has(zone)) continue;
    choices.push(zone);
    seen.add(zone);
  }
  return choices;
}
