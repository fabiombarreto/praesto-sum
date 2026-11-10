// PRPs/prds/events-and-day-view.prd.md AC-6 The schema refuses bad rows itself
// PRPs/prds/events-and-day-view.prd.md AC-7 The link table outlives the event
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A6 and AC-A7; Task 6 — the `events` and `event_sync_links` tables; Task 7 — the
// generated migration 0007 that the test database applies).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): migration 0007 does not
// exist, so neither table exists in the test database and every statement below fails
// with `no such table` — that is the RED reason, and the only one expected. The
// assertions name the KIND of SQLite refusal they expect (`CHECK`, `NOT NULL`,
// `UNIQUE`), so a missing table cannot satisfy them by accident.
//
// Why raw SQL through `env.DB` and not Drizzle: the PRD says "inserted directly
// (bypassing every route)" and "rejected by SQL". Drizzle's `text(..., { enum })` is
// TypeScript-only, so an insert that goes through its types could never reach the
// `outlook` case at all, and the schema module is not what is under test — the migrated
// database is. No route exists in this phase either.
//
// Attribution: every refused row below is one of two known-good rows (`TIMED`, `ALL_DAY`)
// with exactly ONE thing broken, and both known-good rows are inserted successfully by
// the first describe. So a refusal can only be the broken thing's doing.
//
// Cleanup: `test/isolation.ts` is an Implementer file (plan Task 9) and does not yet know
// the two new tables, so this suite must not depend on that update. It composes
// `resetTaskTables()` — which drains every abandoned test body BEFORE wiping, the barrier
// docs/context/testing.md says never to hand-roll — and then clears the two new tables,
// link table first. Once Task 9 lands the two deletes below are redundant and harmless.
//
// Foreign keys: AC-7's `ON DELETE SET NULL` half needs the test D1 to enforce foreign
// keys. D1 does by default, but no existing test asserted it from a direct insert. If the
// link keeps pointing at a deleted event, that is a finding about the test database, to
// be raised, not a reason to loosen the assertion.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

type Cell = string | number | null;
type Row = Record<string, Cell>;

const CHECK = /CHECK constraint failed/i;
const NOT_NULL = /NOT NULL constraint failed/i;
const UNIQUE = /UNIQUE constraint failed/i;

/** 2026-10-20 09:30 America/Sao_Paulo, as epoch seconds, and one hour later. */
const START = Date.UTC(2026, 9, 20, 12, 30) / 1000;
const END = START + 3600;

/** A valid timed row. Every refusal below is this row with one thing broken. */
const TIMED: Row = {
  id: "timed-ok",
  title: "Dentista",
  all_day: 0,
  start_at: START,
  end_at: END,
  start_date: null,
  end_date: null,
  timezone: "America/Sao_Paulo",
  content_hash: "hash-timed",
};

/** A valid all-day row (end is exclusive: 26th and 27th). */
const ALL_DAY: Row = {
  id: "allday-ok",
  title: "Feriado",
  all_day: 1,
  start_at: null,
  end_at: null,
  start_date: "2026-10-26",
  end_date: "2026-10-28",
  timezone: "America/Sao_Paulo",
  content_hash: "hash-allday",
};

async function resetEventTables(): Promise<void> {
  await resetTaskTables();
  await env.DB.prepare("DELETE FROM event_sync_links").run();
  await env.DB.prepare("DELETE FROM events").run();
}

beforeEach(resetEventTables, DRAIN_BUDGET_MS);

function insert(table: string, row: Row): Promise<unknown> {
  const columns = Object.keys(row);
  const marks = columns.map(() => "?").join(", ");
  return env.DB.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${marks})`)
    .bind(...columns.map((column) => row[column] ?? null))
    .run();
}

function without(row: Row, column: string): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== column));
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  if (row === null) throw new Error(`COUNT(*) over ${table} returned no row`);
  return row.n;
}

function fetchOne(table: string, id: string): Promise<Record<string, unknown> | null> {
  return env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
}

/** Everything D1 reports about a failure, including its cause chain, as one string. */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    const { message, cause } = current as { message?: unknown; cause?: unknown };
    if (typeof message === "string") parts.push(message);
    current = cause;
  }
  return parts.length > 0 ? parts.join(" | ") : String(error);
}

/** The reason an insert was refused; fails the test if the insert was accepted. */
async function refusalOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return describeError(error);
  }
  throw new Error("expected the database to refuse this row, but it was accepted");
}

describe("AC-6 — the schema accepts valid rows", () => {
  it("accepts a valid timed row, stores it field for field and defaults the source to local", async () => {
    await insert("events", TIMED);

    expect(await fetchOne("events", "timed-ok")).toMatchObject({
      ...TIMED,
      source: "local",
      created_at: expect.any(Number),
      updated_at: expect.any(Number),
    });
  });

  it("accepts a valid all-day row", async () => {
    await insert("events", ALL_DAY);

    expect(await fetchOne("events", "allday-ok")).toMatchObject({ ...ALL_DAY, source: "local" });
  });

  it("accepts a timed row whose end equals its start", async () => {
    await insert("events", { ...TIMED, id: "zero-duration", end_at: START });

    expect(await fetchOne("events", "zero-duration")).toMatchObject({
      start_at: START,
      end_at: START,
    });
  });

  it("accepts a row whose source is google", async () => {
    await insert("events", { ...TIMED, id: "from-google", source: "google" });

    expect(await fetchOne("events", "from-google")).toMatchObject({ source: "google" });
  });
});

describe("AC-6 — the schema refuses a row that breaks a CHECK", () => {
  const refusedByCheck: Array<[string, Row]> = [
    ["a title that is an empty string", { ...TIMED, title: "" }],
    ["a title of spaces only", { ...TIMED, title: "   " }],
    ["a title that is a single tab", { ...TIMED, title: "\t" }],
    ["a title that is a single newline", { ...TIMED, title: "\n" }],
    ["a title of mixed whitespace", { ...TIMED, title: " \t\r\n " }],
    ["a source of outlook", { ...TIMED, source: "outlook" }],
    ["an all-day row with start_at set", { ...ALL_DAY, start_at: START }],
    ["an all-day row with end_at set", { ...ALL_DAY, end_at: END }],
    ["an all-day row with both timestamps set", { ...ALL_DAY, start_at: START, end_at: END }],
    ["a timed row with start_date set", { ...TIMED, start_date: "2026-10-20" }],
    ["a timed row with end_date set", { ...TIMED, end_date: "2026-10-21" }],
    ["an all-day row whose end_date equals its start_date", { ...ALL_DAY, end_date: "2026-10-26" }],
    [
      "an all-day row whose end_date is before its start_date",
      { ...ALL_DAY, end_date: "2026-10-25" },
    ],
    ["a timed row whose end_at is before its start_at", { ...TIMED, end_at: START - 1 }],
    ["a timed row with no end_at", { ...TIMED, end_at: null }],
    ["a timed row with no start_at", { ...TIMED, start_at: null }],
    ["an all-day row with no end_date", { ...ALL_DAY, end_date: null }],
    ["an all-day row with no start_date", { ...ALL_DAY, start_date: null }],
    ["an all_day flag that is neither 0 nor 1", { ...TIMED, all_day: 2 }],
  ];

  it.each(refusedByCheck)("refuses %s", async (_label, row) => {
    expect(await refusalOf(insert("events", row))).toMatch(CHECK);
    expect(await count("events")).toBe(0);
  });
});

describe("AC-6 — the schema refuses a row with a required column null or missing", () => {
  const refusedByNotNull: Array<[string, Row]> = [
    ["a null title", { ...TIMED, title: null }],
    ["a null timezone", { ...TIMED, timezone: null }],
    ["a null content_hash", { ...TIMED, content_hash: null }],
    ["a null all_day", { ...TIMED, all_day: null }],
    ["a row that omits timezone", without(TIMED, "timezone")],
    ["a row that omits content_hash", without(TIMED, "content_hash")],
    ["a row that omits all_day", without(TIMED, "all_day")],
  ];

  it.each(refusedByNotNull)("refuses %s", async (_label, row) => {
    expect(await refusalOf(insert("events", row))).toMatch(NOT_NULL);
    expect(await count("events")).toBe(0);
  });
});

describe("AC-7 — the link table outlives the event", () => {
  const EVENT_E: Row = { ...TIMED, id: "event-e" };
  const EVENT_F: Row = { ...TIMED, id: "event-f", title: "Reunião", content_hash: "hash-f" };

  /** The link of E under calendar c1 and external id x1, with its whole sync baseline set. */
  const LINK_1: Row = {
    id: "link-1",
    event_id: "event-e",
    calendar_id: "c1",
    external_event_id: "x1",
    etag: '"etag-1"',
    synced_content_hash: "hash-timed",
    synced_at: START,
  };

  async function seedEventsAndFirstLink(): Promise<void> {
    await insert("events", EVENT_E);
    await insert("events", EVENT_F);
    await insert("event_sync_links", LINK_1);
  }

  it("accepts a link for an event and stores its identity and sync baseline", async () => {
    await seedEventsAndFirstLink();

    expect(await fetchOne("event_sync_links", "link-1")).toMatchObject(LINK_1);
    expect(await count("event_sync_links")).toBe(1);
  });

  it.each([
    ["another event", "event-f"],
    ["no event at all", null],
  ])(
    "refuses a second link with the same calendar and external id that targets %s",
    async (_label, eventId) => {
      await seedEventsAndFirstLink();

      const second: Row = {
        id: "link-2",
        event_id: eventId,
        calendar_id: "c1",
        external_event_id: "x1",
      };

      expect(await refusalOf(insert("event_sync_links", second))).toMatch(UNIQUE);
      expect(await count("event_sync_links")).toBe(1);
    },
  );

  it.each([
    ["another external id", "c1", "x2"],
    ["another calendar and external id", "c2", "x9"],
  ])(
    "refuses a second link for the same event under %s",
    async (_label, calendarId, externalId) => {
      await seedEventsAndFirstLink();

      const second: Row = {
        id: "link-2",
        event_id: "event-e",
        calendar_id: calendarId,
        external_event_id: externalId,
      };

      expect(await refusalOf(insert("event_sync_links", second))).toMatch(UNIQUE);
      expect(await count("event_sync_links")).toBe(1);
    },
  );

  it("accepts the same external id under a different calendar for another event", async () => {
    await seedEventsAndFirstLink();

    await insert("event_sync_links", {
      id: "link-2",
      event_id: "event-f",
      calendar_id: "c2",
      external_event_id: "x1",
    });

    expect(await count("event_sync_links")).toBe(2);
  });

  it("keeps the link with event_id null when its event is deleted, and changes no other row", async () => {
    await seedEventsAndFirstLink();
    await insert("event_sync_links", {
      id: "link-2",
      event_id: "event-f",
      calendar_id: "c1",
      external_event_id: "x2",
      etag: '"etag-2"',
      synced_content_hash: "hash-f",
      synced_at: END,
    });
    const eventFBefore = await fetchOne("events", "event-f");
    const link1Before = await fetchOne("event_sync_links", "link-1");
    const link2Before = await fetchOne("event_sync_links", "link-2");

    await env.DB.prepare("DELETE FROM events WHERE id = ?").bind("event-e").run();

    expect(await fetchOne("events", "event-e")).toBeNull();
    expect(await count("events")).toBe(1);
    expect(await count("event_sync_links")).toBe(2);
    expect(link1Before).not.toBeNull();
    expect(await fetchOne("event_sync_links", "link-1")).toEqual({
      ...link1Before,
      event_id: null,
    });
    expect(await fetchOne("events", "event-f")).toEqual(eventFBefore);
    expect(await fetchOne("event_sync_links", "link-2")).toEqual(link2Before);
  });

  it("lets two orphan links with different external ids coexist", async () => {
    await insert("event_sync_links", {
      id: "orphan-1",
      event_id: null,
      calendar_id: "c1",
      external_event_id: "x5",
    });
    await insert("event_sync_links", {
      id: "orphan-2",
      event_id: null,
      calendar_id: "c1",
      external_event_id: "x6",
    });

    expect(await count("event_sync_links")).toBe(2);
  });

  it("leaves both links standing when two linked events are deleted", async () => {
    await seedEventsAndFirstLink();
    await insert("event_sync_links", {
      id: "link-2",
      event_id: "event-f",
      calendar_id: "c1",
      external_event_id: "x2",
    });

    await env.DB.prepare("DELETE FROM events").run();

    expect(await count("events")).toBe(0);
    expect(await count("event_sync_links")).toBe(2);
    expect(await fetchOne("event_sync_links", "link-1")).toMatchObject({ event_id: null });
    expect(await fetchOne("event_sync_links", "link-2")).toMatchObject({ event_id: null });
  });
});
