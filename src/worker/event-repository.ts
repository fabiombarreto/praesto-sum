import { eq } from "drizzle-orm";
import { computeEventContentHash } from "../shared/event-hash";
import type { ResolvedEvent } from "../shared/events";
import type { Db } from "./db/client";
import { eventSyncLinks, events, type EventRow, type EventSyncLink } from "./db/schema";

/**
 * The Event repository (ADR-0016 decision 2, events-and-day-view PRD AC-16).
 *
 * This module is the ONLY place in `src/` that inserts, updates or deletes `events`,
 * the ONLY place that computes `content_hash`, and the ONLY place that reads
 * `event_sync_links`. Routes call it and never the other way round, which is what
 * makes "the stored hash always equals the hash of the stored fields" checkable by
 * inspection instead of by hope: a second writer is the only way for it to go stale,
 * and `updated_at` is bookkeeping, never the sync dirty flag.
 *
 * Every write takes an already-validated `ResolvedEvent` (`validateEventInput`), so
 * the shape rules live in one place and the hash is computed from exactly the fields
 * that are stored. No function here writes `event_sync_links`: deleting an Event
 * relies on that table's `ON DELETE SET NULL`, and unit 15 will own the link writer.
 */

/** Epoch seconds to the `Date` a timestamp-mode column takes; `null` stays `null`. */
function toDate(seconds: number | null): Date | null {
  return seconds === null ? null : new Date(seconds * 1000);
}

/** The Event with `id`, or `undefined` when there is none. */
export async function findEventById(db: Db, id: string): Promise<EventRow | undefined> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row;
}

/**
 * Stores a new Event and returns the row. The id is generated here, `source` is
 * always `local` (the function has no `source` parameter, so no caller can create a
 * `google` row), the hash is computed from `event`, and `createdAt`/`updatedAt` are
 * one instant. Every column is written explicitly: `all_day`, `timezone` and
 * `content_hash` have no SQL default.
 */
export async function createEvent(db: Db, event: ResolvedEvent): Promise<EventRow> {
  const now = new Date();
  const [row] = await db
    .insert(events)
    .values({
      id: crypto.randomUUID(),
      title: event.title,
      description: event.description,
      location: event.location,
      allDay: event.allDay,
      startAt: toDate(event.startAt),
      endAt: toDate(event.endAt),
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      source: "local",
      contentHash: await computeEventContentHash(event),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (row === undefined) throw new Error("Insert returned no row");
  return row;
}

/**
 * Replaces every authored column of the Event `id` with `event` and recomputes the
 * hash from the NEW fields, so a timed-to-all-day conversion writes the instants as
 * `null` and the days as values in one statement. `id`, `source` and `created_at`
 * are never written. Returns the row, or `undefined` when no Event has that id.
 */
export async function updateEvent(
  db: Db,
  id: string,
  event: ResolvedEvent,
): Promise<EventRow | undefined> {
  const [row] = await db
    .update(events)
    .set({
      title: event.title,
      description: event.description,
      location: event.location,
      allDay: event.allDay,
      startAt: toDate(event.startAt),
      endAt: toDate(event.endAt),
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      contentHash: await computeEventContentHash(event),
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
    .returning();
  return row;
}

/** Deletes the Event `id`; true when a row was deleted, false when there was none. */
export async function deleteEvent(db: Db, id: string): Promise<boolean> {
  const deleted = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
  return deleted.length > 0;
}

/** Every Event, for the export dump and the `.ics`. */
export async function listAllEvents(db: Db): Promise<EventRow[]> {
  return await db.select().from(events);
}

/** Every sync link, orphans included, for the export dump. */
export async function listAllEventSyncLinks(db: Db): Promise<EventSyncLink[]> {
  return await db.select().from(eventSyncLinks);
}
