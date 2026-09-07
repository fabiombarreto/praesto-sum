import { Hono } from "hono";
import { buildTasksIcs } from "../../shared/ics";
import { todayIn } from "../../shared/dates";
import { createDb } from "../db/client";
import { tasks } from "../db/schema";
import { toTaskDto } from "../dto";

/**
 * `GET /api/export.ics` — the FR-042 iCalendar half (data-export PRD phase 2
 * "The calendar file").
 *
 * Mounted under `/api/*`, so `requireToken` already gates it — no auth code
 * of its own. Queries every Task with no `WHERE`: `buildTasksIcs` itself
 * decides which Tasks produce a `VEVENT` (dated vs. undated), exactly as
 * `dayItemFromTask` decides bucket membership rather than the query.
 */
export const icsRoutes = new Hono<{ Bindings: Env }>();

icsRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const taskRows = await db.select().from(tasks);

  const now = new Date();
  const ics = buildTasksIcs(now, taskRows.map(toTaskDto));

  const filename = `praesto-${todayIn(now)}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
