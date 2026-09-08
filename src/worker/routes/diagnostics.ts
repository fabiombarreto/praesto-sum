import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { DiagnosticsDto } from "../../shared/api";
import type { PushOutcome } from "../../shared/push-outcome";
import { classifyCronFreshness } from "../../shared/cron-freshness";
import { createDb } from "../db/client";
import {
  cronRuns,
  PUSH_DISPATCH_ATTEMPT_ID,
  pushDispatchAttempts,
  pushSubscriptions,
} from "../db/schema";
import { toCronRunDto } from "../dto";

/**
 * `GET /api/diagnostics` (unit 6 phase 3, PRD AC-7): composes the last cron
 * run, its derived freshness, the stored-subscription count, and the last
 * `POST /api/push/test` dispatch attempt into one response.
 *
 * Mounted under `/api/*`, so `requireToken` already gates it — no auth code
 * of its own.
 */
export const diagnosticsRoutes = new Hono<{ Bindings: Env }>();

diagnosticsRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const [lastRunRow] = await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(1);
  const lastRun = lastRunRow === undefined ? null : toCronRunDto(lastRunRow);
  const freshness = classifyCronFreshness(lastRunRow?.startedAt ?? null, new Date());

  const [subscriptionCountRow] = await db.select({ count: count() }).from(pushSubscriptions);
  const subscriptionCount = subscriptionCountRow?.count ?? 0;

  const [attemptRow] = await db
    .select()
    .from(pushDispatchAttempts)
    .where(eq(pushDispatchAttempts.id, PUSH_DISPATCH_ATTEMPT_ID));
  const lastDispatch =
    attemptRow === undefined
      ? null
      : {
          instant: Math.floor(attemptRow.attemptedAt.getTime() / 1000),
          results: JSON.parse(attemptRow.results) as { endpoint: string; outcome: PushOutcome }[],
        };

  return c.json({ lastRun, freshness, subscriptionCount, lastDispatch } satisfies DiagnosticsDto);
});
