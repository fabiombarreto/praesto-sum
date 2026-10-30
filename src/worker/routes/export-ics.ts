import { Hono } from "hono";
import { buildTasksIcs } from "../../shared/ics";
import { todayIn } from "../../shared/dates";
import { createDb } from "../db/client";
import { tasks } from "../db/schema";
import { toEventDto, toTaskDto } from "../dto";
import { listAllEvents } from "../event-repository";

/**
 * `GET /api/export.ics` — the FR-042 iCalendar half (data-export PRD phase 2
 * "The calendar file"), which since unit 14 exports the owner's Events too.
 *
 * Mounted under `/api/*`, so `requireToken` already gates it — no auth code
 * of its own. Queries every Task with no `WHERE`: `buildTasksIcs` itself
 * decides which Tasks produce a `VEVENT` (dated vs. undated), exactly as
 * `dayItemFromTask` decides bucket membership rather than the query. Every
 * Event is read through the Event repository and becomes a `VEVENT` of its
 * own; this route imports neither the `events` table nor the link table.
 */
export const icsRoutes = new Hono<{ Bindings: Env }>();

icsRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const taskRows = await db.select().from(tasks);
  const eventRows = await listAllEvents(db);

  const now = new Date();
  const ics = buildTasksIcs(now, taskRows.map(toTaskDto), eventRows.map(toEventDto));

  const filename = `praesto-${todayIn(now)}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
