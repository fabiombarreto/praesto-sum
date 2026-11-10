// Shared fixtures for the Events API suites (unit 14 events-and-day-view, phase 2).
//
// Not a test file: the missing `.test` in the name keeps vitest from collecting it, the same
// way `test/isolation.ts` and `test/apply-migrations.ts` are support code. It holds only what
// the route suites would otherwise copy seven times: how to call the Worker with the bearer
// token, how to put an Event straight into D1 (the "Given" of most cases, so that a defect in
// one route cannot hide behind a failure in another), and how to read the database back.
//
// Nothing here knows how the Implementer will build the routes. The expected wire shape and
// the expected content hash are computed on THIS side, from the stored row, with the phase-1
// shared hash function that has its own pinned golden digests (test/event-hash.test.ts). The
// code under test is never asked to vouch for itself.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import type { EventDto, EventSyncLinkDto } from "../src/shared/api";
import { computeEventContentHash } from "../src/shared/event-hash";
import type { EventHashInput } from "../src/shared/event-hash";
import { shiftLocalDay } from "../src/shared/events";
import { createDb } from "../src/worker/db/client";
import { eventSyncLinks, events } from "../src/worker/db/schema";
import type { EventRow, EventSyncLink } from "../src/worker/db/schema";

export const EVENTS_URL = "https://example.com/api/events";

/** The owner's zone, and the zone an Event is authored in when the caller names none. */
export const SAO_PAULO = "America/Sao_Paulo";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Epoch seconds of a UTC moment: `utc(2026, 10, 20, 12, 30)` is 2026-10-20T12:30Z. */
export function utc(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) / 1000;
}

/**
 * Epoch seconds of a wall-clock moment in `America/Sao_Paulo`, which has carried a fixed
 * -03:00 offset since 2019: `saoPaulo(2026, 10, 20, 9, 30)` is 2026-10-20T12:30Z.
 */
export function saoPaulo(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return utc(year, month, day, hour + 3, minute);
}

/** Epoch seconds of 2020-01-01: far enough back that any later write visibly moves a stamp. */
export const LONG_AGO = utc(2020, 1, 1);

export function withToken(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

/** A request with the right bearer token and `body` serialized as JSON. */
export function call(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit =
    body === undefined ? { method } : { method, body: JSON.stringify(body) };
  return exports.default.fetch(path, withToken(env.API_BEARER_TOKEN, init));
}

/** A request with the right bearer token and `rawBody` sent exactly as given (not valid JSON). */
export function callRaw(method: string, path: string, rawBody: string): Promise<Response> {
  return exports.default.fetch(path, withToken(env.API_BEARER_TOKEN, { method, body: rawBody }));
}

/** The `error` string of a 4xx body; fails loudly when the body carries none. */
export async function errorOf(res: Response): Promise<string> {
  const body: unknown = await res.json();
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error !== "string") {
    throw new Error(`Expected a string "error" in the response body, got ${JSON.stringify(body)}`);
  }
  return error;
}

/**
 * True when `error` mentions `field` as a whole word, so "(title)", "title" and
 * "Campo não editável: title" all count while "que" does not name `q` and "inválido" does not
 * name `id`. The API's copy is pt-BR (ADR-0009); the field key is the one stable thing in it.
 */
export function names(error: string, field: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])${field}($|[^A-Za-z0-9_])`).test(error);
}

/** The Events a successful `GET /api/events?<query>` answered. */
export async function listEvents(query: string): Promise<EventDto[]> {
  const res = await call("GET", `${EVENTS_URL}?${query}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { events: EventDto[] };
  return body.events;
}

interface SeedBase {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  timezone?: string;
  source?: EventRow["source"];
  /** Defaults to the TRUE hash of the authored fields. */
  contentHash?: string;
  /** Epoch seconds. Both default to 2020-01-01, so a later edit visibly moves `updated_at`. */
  createdAt?: number;
  updatedAt?: number;
}

export interface TimedSeed extends SeedBase {
  /** Epoch seconds. */
  startAt: number;
  /** Epoch seconds; defaults to an hour after the start. Pass the start itself for zero length. */
  endAt?: number;
}

export interface AllDaySeed extends SeedBase {
  startDate: string;
  /** EXCLUSIVE end, as stored; defaults to the day after `startDate`. */
  endDate?: string;
}

async function insertSeed(seed: SeedBase, fields: EventHashInput): Promise<EventRow> {
  const [row] = await createDb(env)
    .insert(events)
    .values({
      id: seed.id ?? crypto.randomUUID(),
      title: fields.title,
      description: fields.description ?? null,
      location: fields.location ?? null,
      allDay: fields.allDay,
      startAt: fields.startAt === null ? null : new Date(fields.startAt * 1000),
      endAt: fields.endAt === null ? null : new Date(fields.endAt * 1000),
      startDate: fields.startDate,
      endDate: fields.endDate,
      timezone: fields.timezone,
      source: seed.source ?? "local",
      contentHash: seed.contentHash ?? (await computeEventContentHash(fields)),
      createdAt: new Date((seed.createdAt ?? LONG_AGO) * 1000),
      updatedAt: new Date((seed.updatedAt ?? LONG_AGO) * 1000),
    })
    .returning();
  if (row === undefined) throw new Error("Seeding an Event returned no row");
  return row;
}

/** Puts a timed Event straight into D1, bypassing every route. */
export function seedTimed(seed: TimedSeed): Promise<EventRow> {
  return insertSeed(seed, {
    title: seed.title,
    description: seed.description ?? null,
    location: seed.location ?? null,
    allDay: false,
    startAt: seed.startAt,
    endAt: seed.endAt ?? seed.startAt + 3600,
    startDate: null,
    endDate: null,
    timezone: seed.timezone ?? SAO_PAULO,
  });
}

/** Puts an all-day Event straight into D1, bypassing every route. */
export function seedAllDay(seed: AllDaySeed): Promise<EventRow> {
  return insertSeed(seed, {
    title: seed.title,
    description: seed.description ?? null,
    location: seed.location ?? null,
    allDay: true,
    startAt: null,
    endAt: null,
    startDate: seed.startDate,
    endDate: seed.endDate ?? shiftLocalDay(seed.startDate, 1),
    timezone: seed.timezone ?? SAO_PAULO,
  });
}

export interface LinkSeed {
  id: string;
  eventId: string | null;
  calendarId?: string;
  externalEventId: string;
  etag?: string | null;
  syncedContentHash?: string | null;
  /** Epoch seconds. */
  syncedAt?: number | null;
}

/** Puts a sync link straight into D1. No route writes this table (ADR-0016). */
export async function seedLink(seed: LinkSeed): Promise<EventSyncLink> {
  const [row] = await createDb(env)
    .insert(eventSyncLinks)
    .values({
      id: seed.id,
      eventId: seed.eventId,
      calendarId: seed.calendarId ?? "primary",
      externalEventId: seed.externalEventId,
      etag: seed.etag ?? null,
      syncedContentHash: seed.syncedContentHash ?? null,
      syncedAt:
        seed.syncedAt === undefined || seed.syncedAt === null
          ? null
          : new Date(seed.syncedAt * 1000),
    })
    .returning();
  if (row === undefined) throw new Error("Seeding a sync link returned no row");
  return row;
}

export async function readEvent(id: string): Promise<EventRow | undefined> {
  const [row] = await createDb(env).select().from(events).where(eq(events.id, id));
  return row;
}

export async function allEvents(): Promise<EventRow[]> {
  return await createDb(env).select().from(events);
}

export async function countEvents(): Promise<number> {
  return (await allEvents()).length;
}

export async function readLinks(): Promise<EventSyncLink[]> {
  return await createDb(env).select().from(eventSyncLinks);
}

export async function countLinks(): Promise<number> {
  return (await readLinks()).length;
}

/** Epoch seconds of a stored timestamp, or `null`. */
export function secondsOf(date: Date | null): number | null {
  return date === null ? null : Math.floor(date.getTime() / 1000);
}

/** The seven authored fields of a STORED row, in the shape the hash function takes. */
export function hashInputOf(row: EventRow): EventHashInput {
  return {
    title: row.title,
    description: row.description,
    location: row.location,
    allDay: row.allDay,
    startAt: secondsOf(row.startAt),
    endAt: secondsOf(row.endAt),
    startDate: row.startDate,
    endDate: row.endDate,
    timezone: row.timezone,
  };
}

/** The hash a stored row SHOULD carry, recomputed from its own fields. */
export function recomputedHash(row: EventRow): Promise<string> {
  return computeEventContentHash(hashInputOf(row));
}

/** The wire shape a stored row must be answered (and dumped) as: seconds, not milliseconds. */
export function expectedDto(row: EventRow): EventDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    allDay: row.allDay,
    startAt: secondsOf(row.startAt),
    endAt: secondsOf(row.endAt),
    startDate: row.startDate,
    endDate: row.endDate,
    timezone: row.timezone,
    source: row.source,
    contentHash: row.contentHash,
    createdAt: secondsOf(row.createdAt) ?? 0,
    updatedAt: secondsOf(row.updatedAt) ?? 0,
  };
}

/** The wire shape a stored sync link must be dumped as. */
export function expectedLinkDto(link: EventSyncLink): EventSyncLinkDto {
  return {
    id: link.id,
    eventId: link.eventId,
    calendarId: link.calendarId,
    externalEventId: link.externalEventId,
    etag: link.etag,
    syncedContentHash: link.syncedContentHash,
    syncedAt: secondsOf(link.syncedAt),
  };
}
