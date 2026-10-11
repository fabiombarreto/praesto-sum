// PRPs/prds/repeated-miss-nudge.prd.md AC-8  Re-arm on completion (the clearing half)
// PRPs/prds/repeated-miss-nudge.prd.md AC-11 Mute is per series and leaves Reminders alone
// PRPs/prds/repeated-miss-nudge.prd.md AC-14 Migration and export
//
// Source plan: PRPs/plans/repeated-miss-nudge-phase-2-columns-mute-and-wire.plan.md
// (plan AC-A1..AC-A6). Phase 1's pure decision lives in test/nudge.test.ts; the
// cron step (AC-6, AC-7, AC-9, AC-10, AC-12, AC-13) is phase 3 and not tested here.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): the columns
// `nudged_at` / `nudge_muted`, migration 0006, `SeriesDto.nudgeMuted`, the PATCH
// `nudgeMuted` validation and the complete-route clearing do not exist yet, so
// this file is RED for those reasons only.
//
// Idioms mirror test/series.test.ts and test/missed-sweep-cron.test.ts: real
// Worker through `exports.default.fetch`, real D1, direct inserts for states the
// routes do not expose (a series with a claim marker set).

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import type { SeriesDto, TaskDto } from "../src/shared/api";
import { PRAESTO_TIMEZONE } from "../src/shared/dates";
import * as cronModule from "../src/worker/cron";
import { createDb } from "../src/worker/db/client";
import { recurrenceSeries, reminders, tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const SERIES = "https://example.com/api/series";
const TASKS = "https://example.com/api/tasks";
const EXPORT = "https://example.com/api/export";

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function post(path: string, body?: unknown): Promise<Response> {
  return exports.default.fetch(
    path,
    auth(body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) }),
  );
}

async function get(path: string): Promise<Response> {
  return exports.default.fetch(path, auth());
}

async function patch(path: string, body: unknown): Promise<Response> {
  return exports.default.fetch(path, auth({ method: "PATCH", body: JSON.stringify(body) }));
}

beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(reminders);
}, DRAIN_BUDGET_MS);

afterEach(() => {
  vi.useRealTimers();
});

const SERIES_BODY = {
  title: "Pagar aluguel",
  freq: "monthly",
  byMonthday: 5,
  dtstart: "2026-10-05",
  dateMode: "deadline",
  reminderOffsets: [1440],
};

async function createSeries(
  overrides: Record<string, unknown> = {},
): Promise<{ series: SeriesDto; occurrence: TaskDto }> {
  const res = await post(SERIES, { ...SERIES_BODY, ...overrides });
  expect(res.status).toBe(201);
  return (await res.json()) as { series: SeriesDto; occurrence: TaskDto };
}

async function seriesRow(id: string) {
  const [row] = await createDb(env)
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, id));
  return row as NonNullable<typeof row>;
}

async function setNudgedAt(id: string, at: Date): Promise<void> {
  await createDb(env)
    .update(recurrenceSeries)
    .set({ nudgedAt: at } as Partial<typeof recurrenceSeries.$inferInsert>)
    .where(eq(recurrenceSeries.id, id));
}

/** The nudge columns read back from D1 as plain values (untyped: they land with the phase). */
async function nudgeColumns(id: string): Promise<{ nudgedAt: unknown; nudgeMuted: unknown }> {
  const row = (await seriesRow(id)) as unknown as Record<string, unknown>;
  return { nudgedAt: row.nudgedAt, nudgeMuted: row.nudgeMuted };
}

const MARKER = new Date("2026-10-04T12:00:00Z");

// ---------------------------------------------------------------------------
// AC-14 — migration 0006
// ---------------------------------------------------------------------------

describe("AC-14 / AC-A4 migration 0006 keeps existing rows and defaults the new columns", () => {
  const SCRATCH = "scratch_series_0006";

  afterEach(async () => {
    await env.DB.prepare(`DROP TABLE IF EXISTS ${SCRATCH}`).run();
  });

  it("ships exactly one 0006 migration, additive: it never drops or recreates the table", () => {
    const sixth = env.TEST_MIGRATIONS.filter((m) => m.name.startsWith("0006_"));
    expect(sixth).toHaveLength(1);
    const sql = (sixth[0]?.queries ?? []).join("\n");
    expect(sql).toMatch(/nudged_at/);
    expect(sql).toMatch(/nudge_muted/);
    expect(sql.toUpperCase()).not.toContain("DROP TABLE");
  });

  it("applied to a table holding a row, the row keeps its data, nudge_muted is false and nudged_at is null", async () => {
    const sixth = env.TEST_MIGRATIONS.filter((m) => m.name.startsWith("0006_"));
    expect(sixth).toHaveLength(1);

    // A pre-0006 table with an existing row; the real migration statements are
    // replayed against it (retargeted from recurrence_series to the scratch table).
    await env.DB.prepare(
      `CREATE TABLE ${SCRATCH} (id text PRIMARY KEY NOT NULL, title text, done_count integer DEFAULT 0 NOT NULL)`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO ${SCRATCH} (id, title, done_count) VALUES ('s-old', 'Beber agua', 7)`,
    ).run();

    for (const query of sixth[0]?.queries ?? []) {
      const retargeted = query
        .replaceAll("`recurrence_series`", SCRATCH)
        .replaceAll("recurrence_series", SCRATCH);
      await env.DB.prepare(retargeted).run();
    }

    const row = await env.DB.prepare(
      `SELECT id, title, done_count, nudge_muted, nudged_at FROM ${SCRATCH} WHERE id = 's-old'`,
    ).first<Record<string, unknown>>();
    expect(row?.title).toBe("Beber agua");
    expect(row?.done_count).toBe(7);
    expect(row?.nudge_muted).toBe(0);
    expect(row?.nudged_at).toBeNull();
  });

  it("the real table declares nudge_muted NOT NULL and nudged_at nullable", async () => {
    const info = await env.DB.prepare("PRAGMA table_info(recurrence_series)").all<{
      name: string;
      notnull: number;
    }>();
    const byName = new Map(info.results.map((c) => [c.name, c]));
    expect(byName.get("nudge_muted")?.notnull).toBe(1);
    expect(byName.get("nudged_at")?.notnull).toBe(0);
  });

  it("a series inserted without the new columns reads back unmuted and unmarked", async () => {
    const id = crypto.randomUUID();
    await createDb(env)
      .insert(recurrenceSeries)
      .values({ id, kind: "task", freq: "daily", dtstart: "2026-10-01", title: "Beber agua" });
    expect(await nudgeColumns(id)).toEqual({ nudgedAt: null, nudgeMuted: false });
  });
});

// ---------------------------------------------------------------------------
// AC-14 — export and the series wire
// ---------------------------------------------------------------------------

describe("AC-14 / AC-A5 the FR-042 export carries both columns", () => {
  it("carries nudgedAt (epoch seconds, or null) and nudgeMuted on each recurrence_series row", async () => {
    const db = createDb(env);
    await db.insert(recurrenceSeries).values({
      id: "series-marked",
      kind: "task",
      freq: "daily",
      dtstart: "2026-10-01",
      title: "Marcada",
      nudgeMuted: true,
      nudgedAt: MARKER,
    } as typeof recurrenceSeries.$inferInsert);
    await db.insert(recurrenceSeries).values({
      id: "series-plain",
      kind: "task",
      freq: "daily",
      dtstart: "2026-10-01",
      title: "Simples",
    });

    const res = await get(EXPORT);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tables: { recurrence_series: Array<Record<string, unknown>> };
    };
    const marked = body.tables.recurrence_series.find((r) => r.id === "series-marked");
    const plain = body.tables.recurrence_series.find((r) => r.id === "series-plain");

    expect(marked?.nudgeMuted).toBe(true);
    expect(marked?.nudgedAt).toBe(Math.floor(MARKER.getTime() / 1000));
    expect(plain?.nudgeMuted).toBe(false);
    expect(plain?.nudgedAt).toBeNull();
  });
});

describe("AC-14 / AC-A6 the series wire carries nudgeMuted and never nudgedAt", () => {
  it("create, list, read and patch all expose nudgeMuted: false and no nudgedAt, even with a marker set", async () => {
    const { series } = await createSeries();
    expect(series.nudgeMuted).toBe(false);
    expect("nudgedAt" in series).toBe(false);

    await setNudgedAt(series.id, MARKER);

    const listed = ((await (await get(SERIES)).json()) as { series: SeriesDto[] }).series.find(
      (s) => s.id === series.id,
    );
    expect(listed?.nudgeMuted).toBe(false);
    expect(listed !== undefined && "nudgedAt" in listed).toBe(false);

    const read = ((await (await get(`${SERIES}/${series.id}`)).json()) as { series: SeriesDto })
      .series;
    expect(read.nudgeMuted).toBe(false);
    expect("nudgedAt" in read).toBe(false);

    const patched = await patch(`${SERIES}/${series.id}`, { title: "Aluguel do apê" });
    expect(patched.status).toBe(200);
    const patchedSeries = ((await patched.json()) as { series: SeriesDto }).series;
    expect(patchedSeries.nudgeMuted).toBe(false);
    expect("nudgedAt" in patchedSeries).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-11 — the mute
// ---------------------------------------------------------------------------

describe("AC-11 / AC-A2 PATCH nudgeMuted is per series and leaves Reminders alone", () => {
  it("persists true on that series only, returns it, and leaves the other series, the occurrence and every Reminder untouched", async () => {
    const target = await createSeries({ title: "Pagar aluguel" });
    const other = await createSeries({ title: "Lavar o carro" });
    const db = createDb(env);

    const remindersBefore = await db.select().from(reminders);
    expect(remindersBefore).toHaveLength(2);
    const [occurrenceBefore] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, target.occurrence.id));

    const res = await patch(`${SERIES}/${target.series.id}`, { nudgeMuted: true });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { series: SeriesDto }).series.nudgeMuted).toBe(true);

    expect((await nudgeColumns(target.series.id)).nudgeMuted).toBe(true);
    expect((await nudgeColumns(other.series.id)).nudgeMuted).toBe(false);

    const sortById = <T extends { id: string }>(rows: T[]) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(await db.select().from(reminders))).toEqual(sortById(remindersBefore));
    const [occurrenceAfter] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, target.occurrence.id));
    expect(occurrenceAfter).toEqual(occurrenceBefore);

    // the read route agrees
    const read = (
      (await (await get(`${SERIES}/${target.series.id}`)).json()) as {
        series: SeriesDto;
      }
    ).series;
    expect(read.nudgeMuted).toBe(true);
  });

  it("persists false again when the owner turns it back on", async () => {
    const { series } = await createSeries();
    expect((await patch(`${SERIES}/${series.id}`, { nudgeMuted: true })).status).toBe(200);

    const res = await patch(`${SERIES}/${series.id}`, { nudgeMuted: false });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { series: SeriesDto }).series.nudgeMuted).toBe(false);
    expect((await nudgeColumns(series.id)).nudgeMuted).toBe(false);
  });

  it("travels with a template edit in one body", async () => {
    const { series } = await createSeries();
    const res = await patch(`${SERIES}/${series.id}`, {
      nudgeMuted: true,
      title: "Aluguel do apê",
    });
    expect(res.status).toBe(200);
    const edited = ((await res.json()) as { series: SeriesDto }).series;
    expect(edited.nudgeMuted).toBe(true);
    expect(edited.title).toBe("Aluguel do apê");
  });
});

describe("AC-11 / AC-A3 PATCH nudgeMuted validation writes nothing on a bad body", () => {
  it.each([
    ["the string 'true'", "true"],
    ["the number 1", 1],
    ["the number 0", 0],
    ["null", null],
    ["an object", {}],
  ])(
    "rejects %s with 400 naming nudgeMuted, and writes nothing — not even a valid sibling field",
    async (_label, value) => {
      const { series } = await createSeries();
      const before = await seriesRow(series.id);

      const res = await patch(`${SERIES}/${series.id}`, {
        title: "Nunca gravado",
        nudgeMuted: value,
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error.toLowerCase()).toContain("nudgemuted");

      expect(await seriesRow(series.id)).toEqual(before);
    },
  );

  it("keeps the existing rejection naming an unknown extra key, and does not apply nudgeMuted", async () => {
    const { series } = await createSeries();

    const res = await patch(`${SERIES}/${series.id}`, { nudgeMuted: true, nonsenseKey: 1 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("nonsenseKey");
    expect((await nudgeColumns(series.id)).nudgeMuted).toBe(false);
  });

  it("still refuses nudgedAt on the wire: the marker is system state, not editable", async () => {
    const { series } = await createSeries();
    const res = await patch(`${SERIES}/${series.id}`, { nudgedAt: 1_790_000_000 });
    expect(res.status).toBe(400);
    expect((await nudgeColumns(series.id)).nudgedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-8 — completion clears the marker
// ---------------------------------------------------------------------------

describe("AC-8 / AC-A1 completing an occurrence clears the series' nudge marker", () => {
  it("sets nudged_at to null in the same operation that marks the occurrence done and spawns the successor", async () => {
    const { series, occurrence } = await createSeries();
    await setNudgedAt(series.id, MARKER);
    expect((await nudgeColumns(series.id)).nudgedAt).not.toBeNull();

    const res = await post(`${TASKS}/${occurrence.id}/complete`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { task: TaskDto; successor?: TaskDto };
    expect(body.task.status).toBe("done");
    expect(body.successor).toBeDefined();

    const row = await seriesRow(series.id);
    expect((row as unknown as Record<string, unknown>).nudgedAt).toBeNull();
    expect(row.doneCount).toBe(1);
  });

  it("clears the marker of that series only", async () => {
    const completed = await createSeries({ title: "Pagar aluguel" });
    const untouched = await createSeries({ title: "Lavar o carro" });
    await setNudgedAt(completed.series.id, MARKER);
    await setNudgedAt(untouched.series.id, MARKER);

    expect((await post(`${TASKS}/${completed.occurrence.id}/complete`)).status).toBe(200);

    expect((await nudgeColumns(completed.series.id)).nudgedAt).toBeNull();
    const kept = (await nudgeColumns(untouched.series.id)).nudgedAt;
    expect(kept).not.toBeNull();
    expect(new Date(kept as Date).getTime()).toBe(MARKER.getTime());
  });

  it("leaves nudged_at null when completing a series that was never nudged", async () => {
    const { series, occurrence } = await createSeries();
    const res = await post(`${TASKS}/${occurrence.id}/complete`);
    expect(res.status).toBe(200);
    expect((await nudgeColumns(series.id)).nudgedAt).toBeNull();
  });

  it("clears the marker when the completed occurrence is the series' last (the series ends)", async () => {
    const { series, occurrence } = await createSeries({ endKind: "count", maxCount: 1 });
    await setNudgedAt(series.id, MARKER);

    const res = await post(`${TASKS}/${occurrence.id}/complete`);
    expect(res.status).toBe(200);
    expect((await nudgeColumns(series.id)).nudgedAt).toBeNull();
  });

  it("does not touch the owner's mute when it clears the marker", async () => {
    const { series, occurrence } = await createSeries();
    expect((await patch(`${SERIES}/${series.id}`, { nudgeMuted: true })).status).toBe(200);
    await setNudgedAt(series.id, MARKER);

    expect((await post(`${TASKS}/${occurrence.id}/complete`)).status).toBe(200);
    expect(await nudgeColumns(series.id)).toEqual({ nudgedAt: null, nudgeMuted: true });
  });

  it("a missed close by the sweep does NOT clear the marker", async () => {
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const seriesId = crypto.randomUUID();
    const db = createDb(env);
    await db.insert(recurrenceSeries).values({
      id: seriesId,
      kind: "task",
      freq: "daily",
      dtstart: "2026-10-01",
      timezone: PRAESTO_TIMEZONE,
      title: "Tomar remedio",
      dateMode: "deadline",
      reminderOffsets: null,
      nudgedAt: MARKER,
    } as typeof recurrenceSeries.$inferInsert);
    const occurrenceId = crypto.randomUUID();
    await db.insert(tasks).values({
      id: occurrenceId,
      title: "Tomar remedio",
      status: "open",
      deadline: "2026-10-01",
      seriesId,
      occurrenceDate: "2026-10-01",
    });

    await cronModule.runScheduledJob(env, new Date("2026-10-04T15:00:00Z"));

    // the sweep did close the occurrence as missed...
    const [closed] = await db.select().from(tasks).where(eq(tasks.id, occurrenceId));
    expect(closed?.status).toBe("missed");
    // ...and the marker survived it: only a completion re-arms the nudge (D-C).
    const marker = (await nudgeColumns(seriesId)).nudgedAt;
    expect(marker).not.toBeNull();
    expect(new Date(marker as Date).getTime()).toBe(MARKER.getTime());
  });
});
