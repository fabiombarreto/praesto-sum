import { Hono } from "hono";
import { buildExportEnvelope } from "../../shared/export";
import { todayIn } from "../../shared/dates";
import { createDb } from "../db/client";
import { EXCLUDED_TABLES } from "../db/export-manifest";
import {
  googleCalendarSelections,
  lifeAreas,
  recurrenceSeries,
  reminders,
  tasks,
} from "../db/schema";
import {
  toEventDto,
  toEventSyncLinkDto,
  toGoogleCalendarSelectionDto,
  toLifeAreaDto,
  toRecurrenceSeriesDto,
  toReminderDto,
  toTaskDto,
} from "../dto";
import { listAllEvents, listAllEventSyncLinks } from "../event-repository";

/**
 * `GET /api/export` — the FR-042 dump (data-export PRD phase 1).
 *
 * Mounted under `/api/*`, so `requireToken` already gates it — no auth code
 * of its own. Queries only the seven data-bearing tables named in
 * `EXPORTED_TABLE_NAMES`; `google_connections`, `push_subscriptions` and
 * `oauth_states` are never imported here, so no row of theirs can ever reach
 * the response (AC-3). The two Event tables are read through the Event
 * repository, so this route imports neither.
 */
export const exportRoutes = new Hono<{ Bindings: Env }>();

exportRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const [
    lifeAreaRows,
    recurrenceSeriesRows,
    taskRows,
    reminderRows,
    googleCalendarSelectionRows,
    eventRows,
    linkRows,
  ] = await Promise.all([
    db.select().from(lifeAreas),
    db.select().from(recurrenceSeries),
    db.select().from(tasks),
    db.select().from(reminders),
    db.select().from(googleCalendarSelections),
    listAllEvents(db),
    listAllEventSyncLinks(db),
  ]);

  const now = new Date();
  const envelope = buildExportEnvelope(
    now,
    {
      lifeAreas: lifeAreaRows.map(toLifeAreaDto),
      recurrenceSeries: recurrenceSeriesRows.map(toRecurrenceSeriesDto),
      tasks: taskRows.map(toTaskDto),
      reminders: reminderRows.map(toReminderDto),
      googleCalendarSelections: googleCalendarSelectionRows.map(toGoogleCalendarSelectionDto),
      events: eventRows.map(toEventDto),
      eventLinks: linkRows.map(toEventSyncLinkDto),
    },
    EXCLUDED_TABLES,
  );

  const filename = `praesto-${todayIn(now)}.json`;
  return new Response(JSON.stringify(envelope), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
