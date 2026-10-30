import type { EventDto, TaskDto } from "./api";

/**
 * Pure, DB-free `.ics` serializer (data-export PRD AC-7/AC-8, phase 2 "The
 * calendar file"). Reads no clock — like every other module in
 * `src/shared/` — so the generation instant is a parameter, never
 * `Date.now()`.
 *
 * Emits all-day `VEVENT`s, never `VTODO`: Google Calendar and Outlook
 * silently ignore `VTODO` on import, and the owner lives in Google Calendar
 * (PRD Decisions Log, 2026-09-03). The loss is deliberate and recorded in
 * the file itself via a `COMMENT` property on every Task event.
 *
 * Since unit 14 (events-and-day-view PRD AC-20) it also emits the owner's own
 * Events as `VEVENT`s — they ARE calendar events, so they carry no such comment:
 * a timed Event as UTC date-times (no `TZID`, so no `VTIMEZONE` is needed) and
 * an all-day Event as `VALUE=DATE` days with the stored EXCLUSIVE end.
 */

const PRODID = "-//Praesto Sum//Data Export//EN";
const TODO_COMMENT =
  "Originally a Praesto to-do (Task), exported as an all-day event for calendar compatibility.";

/**
 * Backslash-escapes RFC 5545 §3.3.11 TEXT-reserved characters (`\`, `;`,
 * `,`) and rewrites literal newlines as the two-character escape `\n`, in
 * that order so a newline's own escape backslash is never re-escaped.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * UTC basic-format `YYYYMMDDTHHMMSSZ` (RFC 5545 §3.3.4's DATE-TIME form).
 */
function formatDtstamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Folds one logical content line into one or more CRLF-joined physical
 * lines per RFC 5545 §3.1: no physical line may exceed 75 OCTETS, and every
 * continuation line begins with exactly one space (which itself counts
 * toward that line's own 75-octet budget).
 *
 * Measures with `new TextEncoder().encode(...)` — mirrored from
 * `src/worker/auth.ts`'s `timingSafeEqual` — never a JS string's UTF-16
 * `.length`, which under- or over-counts every multi-byte character. Cuts
 * are found at UTF-8 code-point boundaries: a candidate cut offset that
 * lands on a continuation byte (`10xxxxxx`, i.e. `(byte & 0xc0) === 0x80`)
 * is walked back until it lands on a lead byte or an ASCII byte, so a
 * multi-byte character is never split across two physical lines.
 */
function foldContentLine(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const physicalLines: string[] = [];
  let offset = 0;
  let budget = 75;

  while (offset < bytes.length) {
    let cut = Math.min(offset + budget, bytes.length);
    while (cut > offset && ((bytes[cut] ?? 0) & 0xc0) === 0x80) {
      cut -= 1;
    }
    const chunk = bytes.slice(offset, cut);
    const text = decoder.decode(chunk);
    physicalLines.push(physicalLines.length === 0 ? text : ` ${text}`);
    offset = cut;
    budget = 74; // continuation lines reserve 1 octet for the leading space
  }

  return physicalLines.join("\r\n");
}

/**
 * The `VEVENT` content lines of one Event, or none for a row that does not have the
 * fields its kind needs (the schema's CHECK makes that unreachable, but the DTO type
 * cannot say so). A zero-duration timed Event has no `DTEND`: RFC 5545 needs `DTEND`
 * to be LATER than `DTSTART`, and a date-time start with no end is zero-duration.
 * `DESCRIPTION` and `LOCATION` are written only when present, escaped like `SUMMARY`.
 */
function eventLines(event: EventDto, dtstamp: string): string[] {
  const times: string[] = [];
  if (event.allDay) {
    if (event.startDate === null || event.endDate === null) return [];
    times.push(
      `DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${event.endDate.replace(/-/g, "")}`,
    );
  } else {
    if (event.startAt === null) return [];
    times.push(`DTSTART:${formatDtstamp(new Date(event.startAt * 1000))}`);
    if (event.endAt !== null && event.endAt !== event.startAt) {
      times.push(`DTEND:${formatDtstamp(new Date(event.endAt * 1000))}`);
    }
  }

  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@praesto.local`,
    `DTSTAMP:${dtstamp}`,
    ...times,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description !== null) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location !== null) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Assembles the `.ics` document from the given instant, the already
 * DTO-mapped Tasks and, optionally, the already DTO-mapped Events. Filters to
 * Tasks whose `deadline ?? scheduledDate` is non-null — the exact expression
 * `dayItemFromTask` (`src/shared/day-item.ts`) already uses to decide
 * day-bucket membership, not reimplemented here as a separate comparison. Each
 * surviving Task becomes one all-day `VEVENT` with a `UID` stable across
 * re-exports (`<task.id>@praesto.local`), since `task.id` is already a
 * globally-unique `crypto.randomUUID()` value.
 *
 * The Task `VEVENT`s come first, exactly as they were before Events existed, so the
 * Task-only output is a byte-identical prefix; the Event `VEVENT`s follow in the order
 * given, each with the same kind of stable `UID` (`<event.id>@praesto.local`). The name
 * stays `buildTasksIcs` and `events` defaults to none, so every earlier call is unchanged.
 */
export function buildTasksIcs(
  now: Date,
  tasks: TaskDto[],
  events: readonly EventDto[] = [],
): string {
  const dtstamp = formatDtstamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
  ];

  for (const task of tasks) {
    const date = task.deadline ?? task.scheduledDate;
    if (date === null) continue;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@praesto.local`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`,
      `SUMMARY:${escapeIcsText(task.title)}`,
      `COMMENT:${escapeIcsText(TODO_COMMENT)}`,
      "END:VEVENT",
    );
  }

  for (const event of events) lines.push(...eventLines(event, dtstamp));

  lines.push("END:VCALENDAR");

  return lines.map(foldContentLine).join("\r\n") + "\r\n";
}
