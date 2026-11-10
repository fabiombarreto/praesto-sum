import { and, asc, desc, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import {
  EDITABLE_EVENT_FIELDS,
  MAX_EVENT_SEARCH_RESULTS,
  type EventResponse,
  type EventsResponse,
} from "../../shared/api";
import { offsetMinutesAt, PRAESTO_TIMEZONE } from "../../shared/dates";
import { dayRangeInstants, EVENT_RANGE_MAX_DAYS, validateDayRange } from "../../shared/event-range";
import { eventCapabilities, validateEventInput, type EventField } from "../../shared/events";
import { buildSearchClauses, SEARCH_MIN_QUERY_LENGTH, shouldSearch } from "../../shared/search";
import { createDb } from "../db/client";
import { events } from "../db/schema";
import { toEventDto } from "../dto";
import { dayRangeProblemMessage, eventProblemMessage, eventTypeMessage } from "../event-messages";
import { createEvent, deleteEvent, findEventById, updateEvent } from "../event-repository";

/**
 * Event routes — phase 2 of the events-and-day-view unit (ADR-0016, PRD AC-9..AC-17).
 *
 * Mirrors `src/worker/routes/life-areas.ts`: a file-local `readJson` guard, validation
 * by hand ahead of the database, a closed `EDITABLE_EVENT_FIELDS` allowlist, DTO mapping
 * only at the response boundary. Mounted below the bearer gate in `src/worker/index.ts`,
 * so every route here answers 401 before a handler runs (AC-15).
 *
 * This file decides nothing about what a valid Event is: it type-checks the JSON body
 * (the shared validator takes typed input) and hands it to `validateEventInput`, the
 * same function the sheet will use. It also never writes: every write goes through
 * `src/worker/event-repository.ts`, the only place that stores an Event and the only
 * place its content hash is made (AC-16).
 *
 * Error copy is pt-BR with the field in parentheses (ADR-0009), from `event-messages.ts`.
 */
export const eventRoutes = new Hono<{ Bindings: Env }>();

const BODY_NOT_OBJECT_MESSAGE = "Body must be a JSON object";
const SEARCH_TOO_SHORT_MESSAGE = `A busca deve ter ao menos ${SEARCH_MIN_QUERY_LENGTH} caracteres (q)`;
const NEEDS_A_BOUND_MESSAGE = "Informe um período (from e to) ou uma busca (q)";
const EVENT_NOT_FOUND_MESSAGE = "Compromisso não encontrado";
const GOOGLE_NOT_EDITABLE_MESSAGE =
  "Este compromisso vem do Google e não pode ser alterado aqui (source)";
const GOOGLE_NOT_DELETABLE_MESSAGE =
  "Este compromisso vem do Google e não pode ser excluído aqui (source)";

/** The body keys that were present, each typed by what `checkBody` verified. */
interface EventFields {
  title?: string;
  description?: string | null;
  location?: string | null;
  allDay?: boolean;
  startAt?: number | null;
  endAt?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string | null;
}

type BodyCheck = { ok: true; fields: EventFields } | { ok: false; error: string };

function typeProblem(field: EventField): BodyCheck {
  return { ok: false, error: eventTypeMessage(field) };
}

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

/**
 * The checks `POST` and `PATCH` share, ahead of the database. First the closed key
 * set: any key outside `EDITABLE_EVENT_FIELDS` — `id`, `source`, `contentHash`,
 * `createdAt`, `updatedAt` or a typo — is a 400 naming it, on `POST` too. Then the JSON
 * type of every key that is PRESENT, so an absent key stays absent in the result (the
 * difference `PATCH` is built on). Whether the values make a valid Event is not decided
 * here.
 */
function checkBody(body: Record<string, unknown>): BodyCheck {
  const unknownKey = Object.keys(body).find((key) => !EDITABLE_EVENT_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return { ok: false, error: `Campo não editável: ${unknownKey}` };
  }

  const fields: EventFields = {};
  const { title, description, location, allDay, startAt, endAt, startDate, endDate, timezone } =
    body;

  if (Object.hasOwn(body, "title")) {
    if (typeof title !== "string") return typeProblem("title");
    fields.title = title;
  }
  if (Object.hasOwn(body, "description")) {
    if (!isTextOrNull(description)) return typeProblem("description");
    fields.description = description;
  }
  if (Object.hasOwn(body, "location")) {
    if (!isTextOrNull(location)) return typeProblem("location");
    fields.location = location;
  }
  if (Object.hasOwn(body, "allDay")) {
    if (typeof allDay !== "boolean") return typeProblem("allDay");
    fields.allDay = allDay;
  }
  if (Object.hasOwn(body, "startAt")) {
    if (!isNumberOrNull(startAt)) return typeProblem("startAt");
    fields.startAt = startAt;
  }
  if (Object.hasOwn(body, "endAt")) {
    if (!isNumberOrNull(endAt)) return typeProblem("endAt");
    fields.endAt = endAt;
  }
  if (Object.hasOwn(body, "startDate")) {
    if (!isTextOrNull(startDate)) return typeProblem("startDate");
    fields.startDate = startDate;
  }
  if (Object.hasOwn(body, "endDate")) {
    if (!isTextOrNull(endDate)) return typeProblem("endDate");
    fields.endDate = endDate;
  }
  if (Object.hasOwn(body, "timezone")) {
    if (!isTextOrNull(timezone)) return typeProblem("timezone");
    fields.timezone = timezone;
  }

  return { ok: true, fields };
}

/**
 * Create an Event (AC-9, AC-10). The body is a closed set of keys; the shared
 * validator trims the text, fills a missing end (start + 1 h, or the next day) and
 * the default zone, and refuses the first bad field, naming it. A `POST` carries no
 * `source`: the repository stores every Event it creates as `local`.
 */
eventRoutes.post("/", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: BODY_NOT_OBJECT_MESSAGE }, 400);

  const checked = checkBody(body);
  if (!checked.ok) return c.json({ error: checked.error }, 400);

  const { title, ...rest } = checked.fields;
  if (title === undefined) {
    return c.json({ error: eventProblemMessage({ field: "title", code: "required" }) }, 400);
  }

  const resolved = validateEventInput({ ...rest, title, allDay: rest.allDay ?? false });
  if (!resolved.ok) return c.json({ error: eventProblemMessage(resolved.error) }, 400);

  const row = await createEvent(createDb(c.env), resolved.value);
  const response: EventResponse = { event: toEventDto(row) };
  return c.json(response, 201);
});

/**
 * List Events by a bounded day range, by a text search, or by both (AC-11, AC-17). The
 * API never lists without a bound: neither `from`/`to` nor `q` is a 400. Everything is
 * validated before the database is touched, `q` first, then the range.
 *
 * The range is `from` and `to` together (inclusive local days in the owner's zone, at
 * most `EVENT_RANGE_MAX_DAYS`), turned into the half-open interval `[startAt, endAt)` of
 * epoch seconds by the shared `dayRangeInstants`. An Event is in the range when it
 * OVERLAPS that interval, which gives the semantics the PRD fixes:
 *
 *  - a timed Event overlaps when it starts before the interval ends and either starts
 *    inside it or ends after it starts — so one that ends exactly when the range starts
 *    is out, a zero-duration one inside the range is in, and one that crosses midnight
 *    is listed for BOTH days it touches;
 *  - an all-day Event overlaps when its first day is on or before `to` and its
 *    EXCLUSIVE end is after `from`, so `2026-10-28` (the end of a two-day Event on the
 *    26th and 27th) never leaks into the 28th.
 *
 * The clauses use the `sql` tag with plain numbers and strings, so the stored integer
 * seconds are compared directly rather than Drizzle's `Date`s. With a range the order is
 * all-day first, then by start, then by id (a single ORDER BY orders both kinds, with one
 * term per start column: the other kind's column is uniformly NULL within each group, so
 * the term that does not apply to a group never breaks a tie). `q` alone searches every
 * date, most recent start first and at most `MAX_EVENT_SEARCH_RESULTS`; an all-day Event
 * sorts at its local midnight, using the owner's offset today, which is exact for
 * `America/Sao_Paulo` since 2019 (a fixed -03:00).
 *
 * `q` reuses the Task search (`buildSearchClauses` over the title and description:
 * every word must match, case- and diacritic-insensitive). Unlike `GET /api/tasks`,
 * whose floor is client-side, a query under `SEARCH_MIN_QUERY_LENGTH` characters is a 400
 * naming `q` here.
 */
eventRoutes.get("/", async (c) => {
  const q = c.req.query("q");
  let qClauses: SQL[] = [];
  if (q !== undefined) {
    if (!shouldSearch(q)) return c.json({ error: SEARCH_TOO_SHORT_MESSAGE }, 400);
    const result = buildSearchClauses(q, sql`${events.title}`, sql`${events.description}`);
    if (!result.ok) return c.json({ error: result.error }, 400);
    qClauses = result.clauses;
  }

  const from = c.req.query("from");
  const to = c.req.query("to");
  const hasRange = from !== undefined || to !== undefined;
  if (!hasRange && q === undefined) return c.json({ error: NEEDS_A_BOUND_MESSAGE }, 400);

  let rangeClause: SQL | undefined;
  if (hasRange) {
    const range = validateDayRange(from, to, EVENT_RANGE_MAX_DAYS);
    if (!range.ok) return c.json({ error: dayRangeProblemMessage(range.error) }, 400);

    const { startAt, endAt } = dayRangeInstants(range.from, range.to);
    rangeClause = sql`(
      (${events.allDay} = 0 and ${events.startAt} < ${endAt}
        and (${events.startAt} >= ${startAt} or ${events.endAt} > ${startAt}))
      or (${events.allDay} = 1 and ${events.startDate} <= ${range.to} and ${events.endDate} > ${range.from})
    )`;
  }

  const clauses = [rangeClause, ...qClauses].filter((clause) => clause !== undefined);
  const db = createDb(c.env);
  const matching = db
    .select()
    .from(events)
    .where(and(...clauses));

  // `strftime('%s', day)` is the day's UTC midnight; subtracting the (negative) owner
  // offset lands on its local midnight, so an all-day Event sorts against timed ones.
  const ownerOffsetSeconds = offsetMinutesAt(new Date(), PRAESTO_TIMEZONE) * 60;
  const mostRecentStart = sql`coalesce(${events.startAt}, cast(strftime('%s', ${events.startDate}) as integer) - ${ownerOffsetSeconds}) desc`;

  const rows = hasRange
    ? await matching.orderBy(
        desc(events.allDay),
        asc(events.startDate),
        asc(events.startAt),
        asc(events.id),
      )
    : await matching.orderBy(mostRecentStart, desc(events.id)).limit(MAX_EVENT_SEARCH_RESULTS);

  const response: EventsResponse = { events: rows.map(toEventDto) };
  return c.json(response);
});

/**
 * Edit an Event (AC-12, AC-14). Checks run in this order: the body is an object, every
 * key is editable and of the right JSON type, the body is not empty and does not null the
 * `timezone` (all 400, before any lookup); the Event exists (404); its source allows
 * editing (409 naming `source`, the row untouched); then the merged Event is validated
 * (400, the row untouched).
 *
 * The merge is the absent-versus-null contract of `UpdateEventInput`, read with
 * `Object.hasOwn`: an ABSENT key keeps the stored value, an explicit `null` clears an
 * optional field (a null end lets the shared validator fill its default), and `title`,
 * `allDay` and `timezone` cannot be cleared (400). Toggling `allDay` carries only the
 * target shape's fields: the other kind's stored fields are dropped, so a timed Event
 * made all-day needs a `startDate` and a missing `endDate` is the next day. When only a
 * start moves, the end is NOT shifted with it — the caller sends both.
 */
eventRoutes.patch("/:id", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: BODY_NOT_OBJECT_MESSAGE }, 400);

  const checked = checkBody(body);
  if (!checked.ok) return c.json({ error: checked.error }, 400);
  if (Object.keys(body).length === 0) {
    return c.json({ error: "Informe ao menos um campo editável" }, 400);
  }

  const { fields } = checked;
  if (fields.timezone === null) return c.json({ error: eventTypeMessage("timezone") }, 400);

  const db = createDb(c.env);
  const row = await findEventById(db, c.req.param("id"));
  if (row === undefined) return c.json({ error: EVENT_NOT_FOUND_MESSAGE }, 404);
  if (!eventCapabilities(row.source).editable) {
    return c.json({ error: GOOGLE_NOT_EDITABLE_MESSAGE }, 409);
  }

  const stored = toEventDto(row);
  const given = (key: keyof EventFields): boolean => Object.hasOwn(fields, key);
  const allDay = fields.allDay ?? stored.allDay;
  const kindChanged = allDay !== stored.allDay;

  const resolved = validateEventInput({
    title: fields.title ?? stored.title,
    description: given("description") ? (fields.description ?? null) : stored.description,
    location: given("location") ? (fields.location ?? null) : stored.location,
    allDay,
    startAt: given("startAt") ? (fields.startAt ?? null) : kindChanged ? null : stored.startAt,
    endAt: given("endAt") ? (fields.endAt ?? null) : kindChanged ? null : stored.endAt,
    startDate: given("startDate")
      ? (fields.startDate ?? null)
      : kindChanged
        ? null
        : stored.startDate,
    endDate: given("endDate") ? (fields.endDate ?? null) : kindChanged ? null : stored.endDate,
    timezone: fields.timezone ?? stored.timezone,
  });
  if (!resolved.ok) return c.json({ error: eventProblemMessage(resolved.error) }, 400);

  const updated = await updateEvent(db, row.id, resolved.value);
  if (updated === undefined) return c.json({ error: EVENT_NOT_FOUND_MESSAGE }, 404);

  const response: EventResponse = { event: toEventDto(updated) };
  return c.json(response);
});

/**
 * Delete an Event (AC-13, AC-14): 204, or 404 when absent, or 409 naming `source` when
 * its source does not allow deleting. A sync link pointing at the Event is not touched
 * here: the table's own foreign key leaves it behind with a null `event_id`.
 */
eventRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env);
  const row = await findEventById(db, c.req.param("id"));
  if (row === undefined) return c.json({ error: EVENT_NOT_FOUND_MESSAGE }, 404);
  if (!eventCapabilities(row.source).deletable) {
    return c.json({ error: GOOGLE_NOT_DELETABLE_MESSAGE }, 409);
  }

  const deleted = await deleteEvent(db, row.id);
  if (!deleted) return c.json({ error: EVENT_NOT_FOUND_MESSAGE }, 404);

  return c.body(null, 204);
});

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
