import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { AdherenceRow } from "../shared/adherence";
import { PRAESTO_TIMEZONE, todayIn } from "../shared/dates";
import type { createDb } from "./db/client";
import { tasks } from "./db/schema";

type Db = ReturnType<typeof createDb>;

/**
 * Every closed (`done`/`missed`) series occurrence, grouped by series id (two
 * consumers share this one query: the adherence route and the repeated-miss
 * nudge cron step).
 */
export async function loadClosedRowsBySeries(db: Db): Promise<Map<string, AdherenceRow[]>> {
  const closedRows = await db
    .select()
    .from(tasks)
    .where(and(isNotNull(tasks.seriesId), inArray(tasks.status, ["done", "missed"])));

  const bySeries = new Map<string, AdherenceRow[]>();
  for (const row of closedRows) {
    if (row.seriesId === null || row.occurrenceDate === null) continue;
    const list = bySeries.get(row.seriesId) ?? [];
    list.push({ occurrenceDate: row.occurrenceDate, status: row.status });
    bySeries.set(row.seriesId, list);
  }
  return bySeries;
}

/**
 * Looks up the Task id of a series' current open occurrence, or `null` when
 * none exists.
 */
export async function findOpenOccurrenceId(db: Db, seriesId: string): Promise<string | null> {
  const [open] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.seriesId, seriesId), eq(tasks.status, "open")));
  return open?.id ?? null;
}

/**
 * A usable IANA zone for a series: its own when the runtime can resolve it,
 * otherwise the owner's zone, so one bad row never takes a whole step down.
 */
export function resolveSeriesZone(now: Date, timeZone: string): string {
  try {
    todayIn(now, timeZone);
    return timeZone;
  } catch {
    return PRAESTO_TIMEZONE;
  }
}
