// PRPs/prds/repeated-miss-nudge.prd.md AC-6  Exactly once under overlap
// PRPs/prds/repeated-miss-nudge.prd.md AC-7  No repetition while the run continues
// PRPs/prds/repeated-miss-nudge.prd.md AC-9  Payload and deep link (cron half)
// PRPs/prds/repeated-miss-nudge.prd.md AC-10 Send outcomes
// PRPs/prds/repeated-miss-nudge.prd.md AC-12 A muted run is consumed, not queued
// PRPs/prds/repeated-miss-nudge.prd.md AC-13 A nudge failure never blocks Reminders
//
// Source plan: PRPs/plans/repeated-miss-nudge-phase-3-the-cron-step.plan.md
// (plan AC-A1..AC-A6).
//
// Authored test-first (per `tdd: true`), before the Implementer: the step
// `sweepRepeatedMissNudges(db, now, vapid)` and its wiring in
// `runScheduledJob` do not exist yet, so every test below is RED for the right
// reason (the export is missing / the cron never nudges). Only the seams the
// plan declares are used: `sweepRepeatedMissNudges` (src/worker/cron.ts),
// `runScheduledJob`, `runCronHeartbeat` and the existing `sendPush` adapter.
//
// Mocking discipline: exactly the documented `test/cron-reminder-route.test.ts`
// idiom — `vi.spyOn(sendModule, "sendPush")`, the thin exempt network adapter,
// never the SUT. Every assertion checks an EFFECT (the plaintext payload
// handed to the sender, `nudged_at` on the row, the subscriptions that remain,
// `cron_runs`), never a bare was-called. The sender's outcome is chosen per
// endpoint through the spy's implementation.
//
// AC-13's failing step is a REAL fault, not a mock: a SQLite trigger makes the
// `nudged_at` claim update abort, so the step genuinely throws inside
// `runScheduledJob`, with the Reminder sweep and the heartbeat untouched.
//
// Clock: the system clock is pinned (`vi.setSystemTime`) so `runScheduledJob`
// / `runCronHeartbeat` (which take no `now`) read a deterministic instant:
// 2026-10-04T15:00Z is 12:00 on 2026-10-04 in America/Sao_Paulo, past the 09:00
// window. Series rows are seeded by direct D1 insert (closed rows with
// `status = 'missed'`) because the suite needs states the routes do not expose.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { PRAESTO_TIMEZONE } from "../src/shared/dates";
import * as cronModule from "../src/worker/cron";
import { createDb } from "../src/worker/db/client";
import {
  cronRuns,
  pushSubscriptions,
  recurrenceSeries,
  reminders,
  tasks,
  type RecurrenceSeries,
  type Task,
} from "../src/worker/db/schema";
import * as sendModule from "../src/worker/push/send";
import { DRAIN_BUDGET_MS, resetTaskTables } from "./isolation";

const { runScheduledJob, runCronHeartbeat, sweepRepeatedMissNudges } = cronModule;

/** 12:00 local on 2026-10-04 in America/Sao_Paulo — inside the 09:00 window. */
const NOW = new Date("2026-10-04T15:00:00Z");

const VAPID = {
  subject: "mailto:owner@example.com",
  publicKey: "test-public-key",
  privateKey: "test-private-key",
};

type SendResult = { ok: boolean; statusCode?: number; error?: string };
const DELIVERED: SendResult = { ok: true, statusCode: 201 };

/** Per-endpoint sender answers; an endpoint not listed answers `DELIVERED`. */
let answers: Record<string, SendResult> = {};
let sendSpy: MockInstance<typeof sendModule.sendPush>;

interface Sent {
  endpoint: string;
  payload: { title: string; body: string; tag: string; data: { route: string } };
}

function sentPayloads(): Sent[] {
  return sendSpy.mock.calls.map((call) => ({
    endpoint: call[0].endpoint,
    payload: JSON.parse(call[1]) as Sent["payload"],
  }));
}

beforeEach(async () => {
  vi.setSystemTime(NOW);
  answers = {};
  sendSpy = vi
    .spyOn(sendModule, "sendPush")
    .mockImplementation(async (subscription) => answers[subscription.endpoint] ?? DELIVERED);
  await resetTaskTables();
  const db = createDb(env);
  await db.delete(reminders);
  await db.delete(pushSubscriptions);
  await db.delete(cronRuns);
}, DRAIN_BUDGET_MS);

afterEach(async () => {
  await env.DB.exec("DROP TRIGGER IF EXISTS nudge_claim_fault");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------- seeding

async function insertSeries(
  overrides: Partial<typeof recurrenceSeries.$inferInsert> = {},
): Promise<RecurrenceSeries> {
  const [row] = await createDb(env)
    .insert(recurrenceSeries)
    .values({
      id: crypto.randomUUID(),
      kind: "task",
      freq: "daily",
      interval: 1,
      dtstart: "2026-10-01",
      timezone: PRAESTO_TIMEZONE,
      title: "Tomar remedio",
      priority: "high",
      dateMode: "deadline",
      reminderOffsets: null,
      ...overrides,
    })
    .returning();
  return row as RecurrenceSeries;
}

async function insertOccurrence(
  series: RecurrenceSeries,
  date: string,
  status: "open" | "done" | "missed",
): Promise<Task> {
  const [row] = await createDb(env)
    .insert(tasks)
    .values({
      id: crypto.randomUUID(),
      title: series.title as string,
      status,
      completedAt: status === "done" ? new Date(NOW) : null,
      priority: series.priority,
      deadline: date,
      scheduledDate: null,
      seriesId: series.id,
      occurrenceDate: date,
      detached: false,
    })
    .returning();
  return row as Task;
}

/**
 * A series sitting at three consecutive misses (2026-10-01..03) with its open
 * occurrence on 2026-10-04 — the state the missed sweep leaves behind, and one
 * the missed sweep itself leaves untouched at `NOW`.
 */
async function seedDueSeries(
  overrides: Partial<typeof recurrenceSeries.$inferInsert> = {},
): Promise<{ series: RecurrenceSeries; open: Task; missed: Task[] }> {
  const series = await insertSeries(overrides);
  const missed = [
    await insertOccurrence(series, "2026-10-01", "missed"),
    await insertOccurrence(series, "2026-10-02", "missed"),
    await insertOccurrence(series, "2026-10-03", "missed"),
  ];
  const open = await insertOccurrence(series, "2026-10-04", "open");
  return { series, open, missed };
}

async function seriesRow(id: string): Promise<RecurrenceSeries> {
  const [row] = await createDb(env)
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, id));
  return row as RecurrenceSeries;
}

async function insertSubscription(endpoint: string): Promise<void> {
  await createDb(env)
    .insert(pushSubscriptions)
    .values({ id: crypto.randomUUID(), endpoint, p256dh: "fake-p256dh", auth: "fake-auth" });
}

async function remainingEndpoints(): Promise<string[]> {
  const rows = await createDb(env).select().from(pushSubscriptions);
  return rows.map((row) => row.endpoint).sort();
}

function sweep(now: Date = NOW): Promise<void> {
  return sweepRepeatedMissNudges(createDb(env), now, VAPID);
}

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

const FORBIDDEN = /falha|falhando|pulada/i;

// ------------------------------------------------------------------ tests

describe("repeated-miss nudge cron — AC-A1 (PRD AC-6): exactly once under overlap", () => {
  it("dispatches one push per subscription when two sweeps race, and marks the run nudged", async () => {
    await insertSubscription("https://push.invalid/nudge-race-a");
    await insertSubscription("https://push.invalid/nudge-race-b");
    const { series } = await seedDueSeries();

    await Promise.all([sweep(), sweep()]);

    const sent = sentPayloads();
    expect(sent.map((s) => s.endpoint).sort()).toEqual([
      "https://push.invalid/nudge-race-a",
      "https://push.invalid/nudge-race-b",
    ]);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
  }, 20_000);

  it("dispatches the nudge once when two scheduled jobs race", async () => {
    await insertSubscription("https://push.invalid/nudge-race-job");
    const { series } = await seedDueSeries();

    await Promise.all([runScheduledJob(env, NOW), runScheduledJob(env, NOW)]);

    expect(sentPayloads()).toHaveLength(1);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
  }, 20_000);

  it("a later sequential sweep of the same run sends nothing more", async () => {
    await insertSubscription("https://push.invalid/nudge-seq");
    await seedDueSeries();

    await sweep();
    expect(sentPayloads()).toHaveLength(1);
    await sweep();

    expect(sentPayloads()).toHaveLength(1);
  }, 20_000);
});

describe("repeated-miss nudge cron — AC-A2 (PRD AC-7): no repetition while the run continues", () => {
  it("sends nothing for the 4th and 5th consecutive miss, across several sweeps", async () => {
    await insertSubscription("https://push.invalid/nudge-continues");
    const { series, open } = await seedDueSeries();

    await sweep();
    expect(sentPayloads()).toHaveLength(1);
    const claimed = (await seriesRow(series.id)).nudgedAt;
    expect(claimed).not.toBeNull();

    // The 4th miss is recorded and a 5th occurrence opens.
    const db = createDb(env);
    await db.update(tasks).set({ status: "missed" }).where(eq(tasks.id, open.id));
    const fifth = await insertOccurrence(series, "2026-10-05", "open");
    const day5 = new Date("2026-10-05T15:00:00Z");
    await sweep(day5);
    await sweep(day5);

    // The 5th miss is recorded and a 6th occurrence opens.
    await db.update(tasks).set({ status: "missed" }).where(eq(tasks.id, fifth.id));
    await insertOccurrence(series, "2026-10-06", "open");
    const day6 = new Date("2026-10-06T15:00:00Z");
    await sweep(day6);
    await sweep(day6);

    expect(sentPayloads()).toHaveLength(1);
    expect((await seriesRow(series.id)).nudgedAt).toEqual(claimed);
  }, 30_000);
});

describe("repeated-miss nudge cron — AC-A3 (PRD AC-9): payload and deep link", () => {
  it("sends a title of at most 30 characters, a per-series tag, the open occurrence's path and pt-BR copy naming the count", async () => {
    await insertSubscription("https://push.invalid/nudge-payload");
    const { series, open, missed } = await seedDueSeries({
      title: "Revisar o planejamento financeiro mensal da familia inteira",
    });

    await sweep();

    const sent = sentPayloads();
    expect(sent).toHaveLength(1);
    const { payload } = sent[0] as Sent;
    expect(payload.title.length).toBeLessThanOrEqual(30);
    expect(payload.tag).toBe(`nudge-${series.id}`);
    expect(payload.data.route).toBe(`/tasks/${open.id}`);
    for (const closed of missed) expect(payload.data.route).not.toContain(closed.id);
    expect(payload.body).toContain("3");
    expect(payload.body).toMatch(/n[ãa]o conclu[ií]d/i);
    expect(payload.title).not.toMatch(FORBIDDEN);
    expect(payload.body).not.toMatch(FORBIDDEN);
  }, 20_000);

  it("names the count the run actually reached", async () => {
    await insertSubscription("https://push.invalid/nudge-count-five");
    const series = await insertSeries();
    for (const day of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]) {
      await insertOccurrence(series, day, "missed");
    }
    await insertOccurrence(series, "2026-10-04", "open");

    await sweep();

    const sent = sentPayloads();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload.body).toContain("5");
  }, 20_000);

  it("gives two due series two distinct tags, each pointing at its own open occurrence", async () => {
    await insertSubscription("https://push.invalid/nudge-two-series");
    const first = await seedDueSeries({ title: "Series one" });
    const second = await seedDueSeries({ title: "Series two" });

    await sweep();

    const sent = sentPayloads();
    expect(sent).toHaveLength(2);
    const byTag = new Map(sent.map((s) => [s.payload.tag, s.payload.data.route]));
    expect(byTag.get(`nudge-${first.series.id}`)).toBe(`/tasks/${first.open.id}`);
    expect(byTag.get(`nudge-${second.series.id}`)).toBe(`/tasks/${second.open.id}`);
  }, 20_000);

  it("does not nudge a series with no open occurrence and takes no claim; it is nudged once an occurrence opens", async () => {
    await insertSubscription("https://push.invalid/nudge-no-open");
    const series = await insertSeries();
    for (const day of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
      await insertOccurrence(series, day, "missed");
    }

    await sweep();

    expect(sentPayloads()).toHaveLength(0);
    expect((await seriesRow(series.id)).nudgedAt).toBeNull();

    const open = await insertOccurrence(series, "2026-10-04", "open");
    await sweep();

    const sent = sentPayloads();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload.data.route).toBe(`/tasks/${open.id}`);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
  }, 20_000);
});

describe("repeated-miss nudge cron — AC-A4 (PRD AC-10): send outcomes", () => {
  it.each([404, 410])(
    "prunes a subscription answering %i, keeps the live one and keeps the run nudged",
    async (status) => {
      const DEAD = "https://push.invalid/nudge-dead";
      const ALIVE = "https://push.invalid/nudge-alive";
      await insertSubscription(DEAD);
      await insertSubscription(ALIVE);
      answers[DEAD] = { ok: false, statusCode: status, error: "gone" };
      const { series } = await seedDueSeries();

      await sweep();

      expect(
        sentPayloads()
          .map((s) => s.endpoint)
          .sort(),
      ).toEqual([ALIVE, DEAD]);
      expect(await remainingEndpoints()).toEqual([ALIVE]);
      expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();

      await sweep();
      expect(sentPayloads()).toHaveLength(2);
    },
    20_000,
  );

  it.each([
    ["429", { ok: false, statusCode: 429, error: "slow down" }],
    ["500", { ok: false, statusCode: 500, error: "boom" }],
    ["503", { ok: false, statusCode: 503, error: "unavailable" }],
    ["no status", { ok: false, error: "network down" }],
  ] as const)(
    "releases the claim on a retryable outcome (%s) so the next tick retries, and keeps the subscription",
    async (_label, result) => {
      const ENDPOINT = "https://push.invalid/nudge-retry";
      await insertSubscription(ENDPOINT);
      answers[ENDPOINT] = { ...result };
      const { series } = await seedDueSeries();

      await sweep();

      expect(sentPayloads()).toHaveLength(1);
      expect((await seriesRow(series.id)).nudgedAt).toBeNull();
      expect(await remainingEndpoints()).toEqual([ENDPOINT]);

      // The release really re-arms: the next tick sends again, and once it
      // is delivered the run stays nudged.
      delete answers[ENDPOINT];
      await sweep();
      expect(sentPayloads()).toHaveLength(2);
      expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
      await sweep();
      expect(sentPayloads()).toHaveLength(2);
    },
    20_000,
  );

  it("does not mark the series nudged when no subscription exists, and nudges it after one is stored", async () => {
    const { series } = await seedDueSeries();

    await sweep();

    expect(sentPayloads()).toHaveLength(0);
    expect((await seriesRow(series.id)).nudgedAt).toBeNull();

    await insertSubscription("https://push.invalid/nudge-late-subscriber");
    await sweep();

    expect(sentPayloads()).toHaveLength(1);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
  }, 20_000);

  it("leaves the run nudged when every subscription is gone — never sent again", async () => {
    const ENDPOINT = "https://push.invalid/nudge-all-gone";
    await insertSubscription(ENDPOINT);
    answers[ENDPOINT] = { ok: false, statusCode: 410, error: "gone" };
    const { series } = await seedDueSeries();

    await sweep();

    expect(sentPayloads()).toHaveLength(1);
    expect(await remainingEndpoints()).toEqual([]);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();

    await sweep();
    expect(sentPayloads()).toHaveLength(1);
  }, 20_000);
});

describe("repeated-miss nudge cron — AC-A5 (PRD AC-12): a muted run is consumed, not queued", () => {
  it("sets nudged_at without sending for a muted series at the threshold", async () => {
    await insertSubscription("https://push.invalid/nudge-muted");
    const { series } = await seedDueSeries({ nudgeMuted: true });

    await sweep();

    expect(sentPayloads()).toHaveLength(0);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
  }, 20_000);

  it("sends nothing for that run after the owner unmutes", async () => {
    await insertSubscription("https://push.invalid/nudge-unmute");
    const { series } = await seedDueSeries({ nudgeMuted: true });
    await sweep();

    await createDb(env)
      .update(recurrenceSeries)
      .set({ nudgeMuted: false })
      .where(eq(recurrenceSeries.id, series.id));
    await sweep();
    await sweep(new Date("2026-10-05T15:00:00Z"));

    expect(sentPayloads()).toHaveLength(0);
  }, 20_000);

  it("nudges a new run of three after a completion, once unmuted", async () => {
    await insertSubscription("https://push.invalid/nudge-new-run");
    const { series, open } = await seedDueSeries({ nudgeMuted: true });
    await sweep();
    await createDb(env)
      .update(recurrenceSeries)
      .set({ nudgeMuted: false })
      .where(eq(recurrenceSeries.id, series.id));
    expect(sentPayloads()).toHaveLength(0);

    // The owner completes the open occurrence; the marker clears and the
    // successor (2026-10-05) opens.
    const completed = await exports.default.fetch(
      `https://example.com/api/tasks/${open.id}/complete`,
      auth({ method: "POST" }),
    );
    expect(completed.status).toBe(200);
    expect((await seriesRow(series.id)).nudgedAt).toBeNull();

    // Three new consecutive misses: 10-05, 10-06, 10-07; 10-08 is open.
    const db = createDb(env);
    const [successor] = await db.select().from(tasks).where(eq(tasks.status, "open"));
    expect(successor?.occurrenceDate).toBe("2026-10-05");
    await db
      .update(tasks)
      .set({ status: "missed" })
      .where(eq(tasks.id, successor?.id as string));
    await insertOccurrence(series, "2026-10-06", "missed");
    await insertOccurrence(series, "2026-10-07", "missed");
    const newOpen = await insertOccurrence(series, "2026-10-08", "open");

    await sweep(new Date("2026-10-08T15:00:00Z"));

    const sent = sentPayloads();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload.data.route).toBe(`/tasks/${newOpen.id}`);
    expect(sent[0]?.payload.body).toContain("3");
  }, 30_000);
});

describe("repeated-miss nudge cron — AC-A6 (PRD AC-13): a nudge failure never blocks Reminders", () => {
  async function insertDueReminder(): Promise<string> {
    const id = crypto.randomUUID();
    await createDb(env)
      .insert(reminders)
      .values({
        id,
        taskId: null,
        label: "Beber agua",
        fireAt: new Date(NOW.getTime() - 5 * 60 * 1000),
        originOffsetMinutes: null,
        sentAt: null,
      });
    return id;
  }

  async function injectClaimFault(): Promise<void> {
    // One line: D1's `exec` runs line-delimited statements.
    await env.DB.exec(
      "CREATE TRIGGER nudge_claim_fault BEFORE UPDATE OF nudged_at ON recurrence_series BEGIN SELECT RAISE(ABORT, 'injected nudge fault'); END;",
    );
  }

  it("still sends the due Reminder and records the failure in cron_runs when the nudge step throws", async () => {
    await insertSubscription("https://push.invalid/nudge-fault");
    const reminderId = await insertDueReminder();
    const { series } = await seedDueSeries();
    await injectClaimFault();

    await runCronHeartbeat(env);

    const reminderCalls = sentPayloads().filter((s) => s.payload.tag === `reminder-${reminderId}`);
    expect(reminderCalls).toHaveLength(1);
    const [reminder] = await createDb(env)
      .select()
      .from(reminders)
      .where(eq(reminders.id, reminderId));
    expect(reminder?.sentAt).not.toBeNull();

    const runs = await createDb(env).select().from(cronRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.outcome).toBe("failure");
    expect(runs[0]?.errorMessage).toContain(series.id);
    expect(runs[0]?.errorMessage).toMatch(/nudge/i);

    // The failed claim left the run un-nudged, so a healthy tick retries it.
    expect((await seriesRow(series.id)).nudgedAt).toBeNull();
  }, 20_000);

  it("lets one failing series not stop the nudge of another", async () => {
    await insertSubscription("https://push.invalid/nudge-isolated");
    const bad = await seedDueSeries({ title: "Bad series" });
    const good = await seedDueSeries({ title: "Good series" });
    // The fault fires only for the bad series' claim.
    await env.DB.exec(
      `CREATE TRIGGER nudge_claim_fault BEFORE UPDATE OF nudged_at ON recurrence_series WHEN OLD.id = '${bad.series.id}' BEGIN SELECT RAISE(ABORT, 'injected nudge fault'); END;`,
    );

    await expect(sweep()).rejects.toThrow(bad.series.id);

    const tags = sentPayloads().map((s) => s.payload.tag);
    expect(tags).toEqual([`nudge-${good.series.id}`]);
    expect((await seriesRow(good.series.id)).nudgedAt).not.toBeNull();
    expect((await seriesRow(bad.series.id)).nudgedAt).toBeNull();
  }, 20_000);

  it("records a success in cron_runs and the nudge when nothing fails", async () => {
    await insertSubscription("https://push.invalid/nudge-heartbeat");
    const { series, open } = await seedDueSeries();

    await runCronHeartbeat(env);

    const runs = await createDb(env).select().from(cronRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.outcome).toBe("success");
    expect(runs[0]?.errorMessage).toBeNull();
    const sent = sentPayloads();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload.data.route).toBe(`/tasks/${open.id}`);
    expect((await seriesRow(series.id)).nudgedAt).not.toBeNull();
  }, 20_000);
});
