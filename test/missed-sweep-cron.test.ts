// PRPs/prds/missed-sweep.prd.md AC-4 Catch-up is bounded (the cron half: a still-past successor gets no Reminders)
// PRPs/prds/missed-sweep.prd.md AC-10 One batch writes the plan
// PRPs/prds/missed-sweep.prd.md AC-11 Running it twice changes nothing
// PRPs/prds/missed-sweep.prd.md AC-12 A race with a manual completion is harmless
// PRPs/prds/missed-sweep.prd.md AC-13 One series cannot block another
// PRPs/prds/missed-sweep.prd.md AC-14 The sweep runs before the Reminder sweep
// PRPs/prds/missed-sweep.prd.md AC-15 "Today" is the series' local day
// PRPs/prds/missed-sweep.prd.md AC-16 A detached occurrence is missed like any other (D-E)
// PRPs/prds/missed-sweep.prd.md AC-17 The repair runs in the cron (D-F)
// PRPs/prds/missed-sweep.prd.md AC-18 One-off Tasks are untouched
//
// Source plan: PRPs/plans/missed-sweep-phase-2-the-sweep-in-the-cron.plan.md
// (plan AC-A1..AC-A10).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): today
// `runScheduledJob` takes no injectable `now`, runs no missed sweep and
// `writeMissedSweepPlan` is not exported, so every test below is RED for the
// right reason: series rows are never touched by the cron.
//
// Clock discipline (plan Notes/Risks): the injected `now` drives ONLY the
// missed sweep; the due-Reminder sweep keeps its own wall-clock read. The
// system clock is therefore pinned (`vi.setSystemTime`) below every Reminder
// the successor arms, so "one unsent Reminder" cannot become a time bomb.
//
// Mocking: only the outbound push HTTP call is substituted
// (`vi.stubGlobal("fetch")`, the seam `test/cron-sweep.test.ts` uses). The
// cron, the routes and D1 are real. Rows are seeded by direct D1 insert
// because the suite needs states the routes do not expose (a stale open
// occurrence, a detached row, a series with no open occurrence).

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { offsetToInstant, PRAESTO_TIMEZONE } from "../src/shared/dates";
import { planMissedSweep } from "../src/shared/missed-sweep";
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
import { DRAIN_BUDGET_MS, resetTaskTables } from "./isolation";

const { runScheduledJob, runCronHeartbeat, writeMissedSweepPlan } = cronModule;

/** Pinned wall clock: below every Reminder instant the sweeps in this file arm. */
const PINNED_NOW = new Date("2026-10-01T12:00:00Z");
/** The injected sweep clock: inside local (America/Sao_Paulo) day 2026-10-04. */
const NOW_OCT_4 = new Date("2026-10-04T15:00:00Z");

beforeEach(async () => {
  vi.setSystemTime(PINNED_NOW);
  await resetTaskTables();
  const db = createDb(env);
  await db.delete(reminders);
  await db.delete(pushSubscriptions);
  await db.delete(cronRuns);
}, DRAIN_BUDGET_MS);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------- seeding

type SeriesOverrides = Partial<typeof recurrenceSeries.$inferInsert>;

async function insertSeries(overrides: SeriesOverrides = {}): Promise<RecurrenceSeries> {
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
  opts: { status?: "open" | "done" | "missed"; title?: string; detached?: boolean } = {},
): Promise<Task> {
  const status = opts.status ?? "open";
  const [row] = await createDb(env)
    .insert(tasks)
    .values({
      id: crypto.randomUUID(),
      title: opts.title ?? (series.title as string),
      status,
      completedAt: status === "done" ? new Date(PINNED_NOW) : null,
      priority: series.priority,
      deadline: series.dateMode === "deadline" ? date : null,
      scheduledDate: series.dateMode === "scheduled" ? date : null,
      seriesId: series.id,
      occurrenceDate: date,
      detached: opts.detached ?? false,
    })
    .returning();
  return row as Task;
}

async function tasksOf(seriesId: string): Promise<Task[]> {
  const rows = await createDb(env).select().from(tasks).where(eq(tasks.seriesId, seriesId));
  return rows.sort((a, b) => (a.occurrenceDate ?? "").localeCompare(b.occurrenceDate ?? ""));
}

async function seriesRow(id: string): Promise<RecurrenceSeries> {
  const [row] = await createDb(env)
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, id));
  return row as RecurrenceSeries;
}

async function remindersOf(taskId: string) {
  return createDb(env).select().from(reminders).where(eq(reminders.taskId, taskId));
}

/** Every row of the three tables, in a stable order, as plain JSON text. */
async function snapshotAll(): Promise<string> {
  const db = createDb(env);
  const [t, r, s] = await Promise.all([
    db.select().from(tasks),
    db.select().from(reminders),
    db.select().from(recurrenceSeries),
  ]);
  const byId = <T extends { id: string }>(rows: T[]) =>
    rows.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ tasks: byId(t), reminders: byId(r), series: byId(s) });
}

function addDays(day: string, days: number): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function completeViaRoute(taskId: string): Promise<Response> {
  return exports.default.fetch(
    `https://example.com/api/tasks/${taskId}/complete`,
    auth({ method: "POST" }),
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function insertSubscription(endpoint: string): Promise<void> {
  const keyPair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const rawPublicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer,
  );
  await createDb(env)
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      endpoint,
      p256dh: base64UrlEncode(rawPublicKey),
      auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
    });
}

// ------------------------------------------------------------------ tests

describe("missed sweep in the cron — AC-A1 (PRD AC-10): one batch writes the plan", () => {
  it("closes the open row, records one missed row per skipped cycle, opens today's occurrence with its Reminder and counts 3", async () => {
    const series = await insertSeries({ reminderOffsets: "[1440]" });
    const open = await insertOccurrence(series, "2026-10-01");

    await runScheduledJob(env, NOW_OCT_4);

    const rows = await tasksOf(series.id);
    expect(rows.map((r) => [r.occurrenceDate, r.status])).toEqual([
      ["2026-10-01", "missed"],
      ["2026-10-02", "missed"],
      ["2026-10-03", "missed"],
      ["2026-10-04", "open"],
    ]);
    expect(rows[0]?.id).toBe(open.id);
    for (const missed of rows.slice(0, 3)) {
      expect(missed.completedAt).toBeNull();
      expect(missed.title).toBe("Tomar remedio");
      expect(missed.priority).toBe("high");
      expect(missed.deadline).toBe(missed.occurrenceDate);
      expect(missed.scheduledDate).toBeNull();
    }
    // The two catch-up rows carry no Reminders.
    expect(await remindersOf(rows[1]?.id as string)).toHaveLength(0);
    expect(await remindersOf(rows[2]?.id as string)).toHaveLength(0);

    const successor = rows[3] as Task;
    expect(successor.title).toBe("Tomar remedio");
    expect(successor.deadline).toBe("2026-10-04");
    const successorReminders = await remindersOf(successor.id);
    expect(successorReminders).toHaveLength(1);
    expect(successorReminders[0]?.sentAt).toBeNull();
    expect(successorReminders[0]?.originOffsetMinutes).toBe(1440);
    expect(Math.floor((successorReminders[0]?.fireAt.getTime() ?? 0) / 1000)).toBe(
      offsetToInstant("2026-10-04", 1440, PRAESTO_TIMEZONE),
    );

    const after = await seriesRow(series.id);
    expect(after.missedCount).toBe(3);
    expect(after.doneCount).toBe(0);
    expect(after.status).toBe("active");
  }, 20_000);
});

describe("missed sweep in the cron — AC-A2 (PRD AC-11): running it twice changes nothing", () => {
  it("leaves every row of tasks, reminders and recurrence_series byte-identical on a second run", async () => {
    const series = await insertSeries({ reminderOffsets: "[1440]" });
    await insertOccurrence(series, "2026-10-01");

    await runScheduledJob(env, NOW_OCT_4);
    const afterFirst = await snapshotAll();
    // Guard against a vacuous pass: the first run really did write.
    expect(JSON.parse(afterFirst).tasks).toHaveLength(4);

    await runScheduledJob(env, NOW_OCT_4);

    expect(await snapshotAll()).toBe(afterFirst);
  }, 20_000);
});

describe("missed sweep in the cron — AC-A3 (PRD AC-12): a race with a manual completion is harmless", () => {
  it("a stale plan for an ended series writes nothing once the owner has completed the occurrence", async () => {
    const series = await insertSeries({
      freq: "monthly",
      byMonthday: 5,
      dtstart: "2026-10-05",
      status: "ended",
    });
    const open = await insertOccurrence(series, "2026-10-05");
    const staleSeries = await seriesRow(series.id);
    const plan = planMissedSweep({
      rule: {
        freq: "monthly",
        interval: 1,
        byWeekday: null,
        byMonthday: 5,
        dtstart: "2026-10-05",
        timezone: PRAESTO_TIMEZONE,
        anchorMode: "calendar",
        endKind: "never",
        untilDate: null,
        maxCount: null,
      },
      status: "ended",
      doneCount: 0,
      missedCount: 0,
      openOccurrenceDate: "2026-10-05",
      lastClosedOccurrenceDate: null,
      today: "2026-11-05",
    });
    expect(plan.closeOpenAsMissed).toBe(true);

    // The owner's completion lands first.
    expect((await completeViaRoute(open.id)).status).toBe(200);

    await expect(
      writeMissedSweepPlan(createDb(env), staleSeries, open, plan),
    ).resolves.not.toThrow();

    const rows = await tasksOf(series.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("done");
    const after = await seriesRow(series.id);
    expect(after.missedCount).toBe(0);
    expect(after.doneCount).toBe(1);
  });

  it("a stale plan with catch-up rows and a successor is rejected whole once the owner has completed the occurrence", async () => {
    const series = await insertSeries({});
    const open = await insertOccurrence(series, "2026-10-01");
    const staleSeries = await seriesRow(series.id);
    const plan = planMissedSweep({
      rule: {
        freq: "daily",
        interval: 1,
        byWeekday: null,
        byMonthday: null,
        dtstart: "2026-10-01",
        timezone: PRAESTO_TIMEZONE,
        anchorMode: "calendar",
        endKind: "never",
        untilDate: null,
        maxCount: null,
      },
      status: "active",
      doneCount: 0,
      missedCount: 0,
      openOccurrenceDate: "2026-10-01",
      lastClosedOccurrenceDate: null,
      today: "2026-10-04",
    });

    // The owner's completion lands first and spawns 2026-10-02.
    expect((await completeViaRoute(open.id)).status).toBe(200);

    await expect(
      writeMissedSweepPlan(createDb(env), staleSeries, open, plan),
    ).resolves.not.toThrow();

    const rows = await tasksOf(series.id);
    expect(rows.map((r) => [r.occurrenceDate, r.status])).toEqual([
      ["2026-10-01", "done"],
      ["2026-10-02", "open"],
    ]);
    const after = await seriesRow(series.id);
    expect(after.missedCount).toBe(0);
    expect(after.doneCount).toBe(1);
  });
});

describe("missed sweep in the cron — AC-A4 (PRD AC-13): one series cannot block another", () => {
  async function seedConflictingPair() {
    // Series A's catch-up would write 2026-10-02, but a done row already holds it.
    const seriesA = await insertSeries({ title: "Series A" });
    const openA = await insertOccurrence(seriesA, "2026-10-01");
    await insertOccurrence(seriesA, "2026-10-02", { status: "done" });
    // Series B sorts after A (its open occurrence is later) and is cleanly due.
    const seriesB = await insertSeries({ title: "Series B", dtstart: "2026-10-02" });
    const openB = await insertOccurrence(seriesB, "2026-10-02");
    return { seriesA, openA, seriesB, openB };
  }

  it("still sweeps the second series when the first one's write hits a unique-index conflict", async () => {
    const { seriesA, openA, seriesB, openB } = await seedConflictingPair();

    await expect(runScheduledJob(env, NOW_OCT_4)).resolves.not.toThrow();

    const rowsB = await tasksOf(seriesB.id);
    expect(rowsB.map((r) => [r.occurrenceDate, r.status])).toEqual([
      ["2026-10-02", "missed"],
      ["2026-10-03", "missed"],
      ["2026-10-04", "open"],
    ]);
    expect(rowsB[0]?.id).toBe(openB.id);
    expect((await seriesRow(seriesB.id)).missedCount).toBe(2);

    // The conflicting series is left exactly as it was (its batch rolled back).
    const rowsA = await tasksOf(seriesA.id);
    expect(rowsA.map((r) => [r.occurrenceDate, r.status])).toEqual([
      ["2026-10-01", "open"],
      ["2026-10-02", "done"],
    ]);
    expect(rowsA[0]?.id).toBe(openA.id);
    expect((await seriesRow(seriesA.id)).missedCount).toBe(0);
  }, 20_000);

  it("records a success in cron_runs when the only trouble was a unique-index conflict", async () => {
    await seedConflictingPair();
    const original = runScheduledJob;
    vi.spyOn(cronModule, "runScheduledJob").mockImplementation((e: Env) => original(e, NOW_OCT_4));

    await runCronHeartbeat(env);

    const runs = await createDb(env).select().from(cronRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.outcome).toBe("success");
    expect(runs[0]?.errorMessage).toBeNull();
  }, 20_000);
});

describe("missed sweep in the cron — AC-A5 (PRD AC-14): the sweep runs before the Reminder sweep", () => {
  it("marks the occurrence missed and dispatches no push for its already-due Reminder", async () => {
    const ENDPOINT = "https://push.invalid/missed-sweep-before-reminders";
    await insertSubscription(ENDPOINT);
    const series = await insertSeries();
    const open = await insertOccurrence(series, "2026-10-01");
    const reminderId = crypto.randomUUID();
    await createDb(env)
      .insert(reminders)
      .values({
        id: reminderId,
        taskId: open.id,
        fireAt: new Date(PINNED_NOW.getTime() - 5 * 60 * 1000),
        originOffsetMinutes: null,
        sentAt: null,
      });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
      calls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return new Response(null, { status: 201 });
    });

    // Superseded today: daily series, open 2026-10-01, local day 2026-10-02.
    await runScheduledJob(env, new Date("2026-10-02T15:00:00Z"));

    const [row] = await createDb(env).select().from(tasks).where(eq(tasks.id, open.id));
    expect(row?.status).toBe("missed");
    expect(calls).toHaveLength(0);
  }, 20_000);
});

describe("missed sweep in the cron — AC-A6 (PRD AC-15): today is the series' local day", () => {
  async function seedMonthly() {
    const series = await insertSeries({
      freq: "monthly",
      byMonthday: 5,
      dtstart: "2026-09-05",
    });
    await insertOccurrence(series, "2026-09-05");
    return series;
  }

  it("changes nothing at 02:30Z, which is still 2026-10-04 in America/Sao_Paulo", async () => {
    await seedMonthly();
    const before = await snapshotAll();

    await runScheduledJob(env, new Date("2026-10-05T02:30:00Z"));

    expect(await snapshotAll()).toBe(before);
  });

  it("sweeps the occurrence at 03:30Z, once the series' local day is 2026-10-05", async () => {
    const series = await seedMonthly();

    await runScheduledJob(env, new Date("2026-10-05T03:30:00Z"));

    const rows = await tasksOf(series.id);
    expect(rows.map((r) => [r.occurrenceDate, r.status])).toEqual([
      ["2026-09-05", "missed"],
      ["2026-10-05", "open"],
    ]);
  });
});

describe("missed sweep in the cron — AC-A7 (PRD AC-16): a detached occurrence is missed like any other", () => {
  it("keeps the edited title on the missed row and gives the successor the series template's title", async () => {
    const series = await insertSeries({ title: "Template title" });
    const detached = await insertOccurrence(series, "2026-10-03", {
      title: "Edited by the owner",
      detached: true,
    });

    await runScheduledJob(env, NOW_OCT_4);

    const rows = await tasksOf(series.id);
    const missed = rows.find((r) => r.id === detached.id);
    expect(missed?.status).toBe("missed");
    expect(missed?.title).toBe("Edited by the owner");
    const open = rows.filter((r) => r.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.occurrenceDate).toBe("2026-10-04");
    expect(open[0]?.title).toBe("Template title");
    expect(open[0]?.detached).toBe(false);
  });
});

describe("missed sweep in the cron — AC-A8 (PRD AC-17): the repair runs in the cron", () => {
  it("opens exactly one occurrence with its Reminders armed for an active series that has none, adding no missed row", async () => {
    const series = await insertSeries({ reminderOffsets: "[1440]" });
    await insertOccurrence(series, "2026-09-01", { status: "done" });

    await runScheduledJob(env, NOW_OCT_4);

    const rows = await tasksOf(series.id);
    expect(rows.filter((r) => r.status === "missed")).toHaveLength(0);
    const open = rows.filter((r) => r.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.occurrenceDate).toBe("2026-10-04");
    const armed = await remindersOf(open[0]?.id as string);
    expect(armed).toHaveLength(1);
    expect(armed[0]?.sentAt).toBeNull();
    expect(Math.floor((armed[0]?.fireAt.getTime() ?? 0) / 1000)).toBe(
      offsetToInstant("2026-10-04", 1440, PRAESTO_TIMEZONE),
    );
    expect((await seriesRow(series.id)).missedCount).toBe(0);
  });
});

describe("missed sweep in the cron — AC-A9 (PRD AC-18): one-off Tasks are untouched", () => {
  it("leaves a series-less Task whose deadline is 30 days past open and unchanged", async () => {
    const id = crypto.randomUUID();
    await createDb(env)
      .insert(tasks)
      .values({ id, title: "Pay the old bill", deadline: "2026-09-04", seriesId: null });
    const before = await snapshotAll();

    await runScheduledJob(env, NOW_OCT_4);

    expect(await snapshotAll()).toBe(before);
    const [row] = await createDb(env).select().from(tasks).where(eq(tasks.id, id));
    expect(row?.status).toBe("open");
  });
});

describe("missed sweep in the cron — AC-A10 (PRD AC-4 / D-B, cron half): a still-past successor gets no Reminders", () => {
  it("writes 366 missed cycles, leaves a past-dated open successor without Reminders, and the next run reaches today with Reminders armed", async () => {
    const today = "2026-10-04";
    const openDate = addDays(today, -400);
    const series = await insertSeries({ dtstart: openDate, reminderOffsets: "[1440]" });
    await insertOccurrence(series, openDate);

    await runScheduledJob(env, NOW_OCT_4);

    const afterFirst = await tasksOf(series.id);
    expect(afterFirst.filter((r) => r.status === "missed")).toHaveLength(366);
    const open = afterFirst.filter((r) => r.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.occurrenceDate).toBe(addDays(openDate, 366));
    expect((open[0]?.occurrenceDate as string) < today).toBe(true);
    expect(await remindersOf(open[0]?.id as string)).toHaveLength(0);
    expect((await seriesRow(series.id)).missedCount).toBe(366);

    // Repeating the sweep walks the rest of the way to today.
    await runScheduledJob(env, NOW_OCT_4);

    const afterSecond = await tasksOf(series.id);
    expect(afterSecond.filter((r) => r.status === "missed")).toHaveLength(400);
    const openNow = afterSecond.filter((r) => r.status === "open");
    expect(openNow).toHaveLength(1);
    expect(openNow[0]?.occurrenceDate).toBe(today);
    expect(await remindersOf(openNow[0]?.id as string)).toHaveLength(1);
    expect((await seriesRow(series.id)).missedCount).toBe(400);
  }, 60_000);
});
