// PRPs/prds/events-and-day-view.prd.md AC-19 Export dump
// PRPs/prds/events-and-day-view.prd.md AC-21 Restore drill on a fixture (the part a Vitest file
// can observe: the dump has the exact shape the drill rebuilds from)
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A11 and the mechanical precondition of AC-A13; Task 11 — `GET /api/export` carries
// `events` and `event_sync_links`; Task 4 — `toEventDto` and `toEventSyncLinkDto`, the one
// mapping point to the wire in epoch seconds).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): the dump route still hard-codes
// five tables, so `tables.events` and `tables.event_sync_links` are absent — the RED reason.
//
// What AC-21 itself is, and what is NOT here. AC-21 is a SCRIPT RUN: `scripts/restore-drill.mjs`
// rebuilding a snapshot pulled from a local worker holding one timed and one all-day Event made
// through the real routes, with the result recorded under PRPs/reports/events-and-day-view/.
// That is plan Task 16 / Level 3 at the command layer; no Vitest file can run it. What a Vitest
// file CAN pin is the property the drill's mechanics depend on: it rebuilds each dumped row by
// turning every key from camelCase to snake_case and inserting it into the migrated table, then
// compares each field. So (a) every dumped key must be a real column of its table, (b) every
// column must be dumped (FR-042: 100% of the data), and (c) `events` must precede
// `event_sync_links` in the document, because the drill inserts tables in key order and a link
// references its Event. A dump that misses (a) or (c) would make the recorded drill fail.
//
// The expected row is computed on THIS side from the stored row (test/event-fixtures.ts), never
// by calling the mapper under test.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import {
  call,
  expectedDto,
  expectedLinkDto,
  saoPaulo,
  seedAllDay,
  seedLink,
  seedTimed,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const EXPORT = "https://example.com/api/export";

interface ExportBody {
  formatVersion: number;
  tables: Record<string, Array<Record<string, unknown>>>;
}

async function exportDocument(): Promise<ExportBody> {
  const res = await call("GET", EXPORT);
  expect(res.status).toBe(200);
  return (await res.json()) as ExportBody;
}

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

describe("GET /api/export — Events travel field for field (PRD AC-19)", () => {
  it("dumps a timed Event with every field, the content hash and allDay false included", async () => {
    const row = await seedTimed({
      id: "dump-timed",
      title: "Dentista",
      description: "levar exames",
      location: "Clínica Sorriso",
      startAt: saoPaulo(2026, 10, 20, 9, 30),
      endAt: saoPaulo(2026, 10, 20, 10, 30),
    });

    const dump = await exportDocument();

    expect(dump.tables.events).toEqual([expectedDto(row)]);
    expect(dump.tables.events?.[0]).toMatchObject({
      allDay: false,
      contentHash: row.contentHash,
      startAt: 1792499400,
      endAt: 1792503000,
      startDate: null,
      endDate: null,
    });
  });

  it("dumps an all-day Event with allDay true, no instants and the exclusive end day", async () => {
    const row = await seedAllDay({
      id: "dump-allday",
      title: "Feriado",
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });

    const dump = await exportDocument();

    expect(dump.tables.events).toEqual([expectedDto(row)]);
    expect(dump.tables.events?.[0]).toMatchObject({
      allDay: true,
      startAt: null,
      endAt: null,
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });
  });

  it("dumps every Event, whatever its shape or source", async () => {
    const timed = await seedTimed({ id: "a", title: "A", startAt: saoPaulo(2026, 10, 20, 9, 0) });
    const allDay = await seedAllDay({ id: "b", title: "B", startDate: "2026-10-26" });
    const google = await seedTimed({
      id: "c",
      title: "C",
      startAt: saoPaulo(2026, 10, 21, 9, 0),
      source: "google",
    });

    const dump = await exportDocument();

    const dumped = [...(dump.tables.events ?? [])].sort((x, y) =>
      String(x.id).localeCompare(String(y.id)),
    );
    expect(dumped).toEqual([expectedDto(timed), expectedDto(allDay), expectedDto(google)]);
  });

  it("dumps event_sync_links as an empty array when there are no links", async () => {
    await seedTimed({ id: "alone", title: "Sozinho", startAt: saoPaulo(2026, 10, 20, 9, 0) });

    const dump = await exportDocument();

    expect(dump.tables.event_sync_links).toEqual([]);
  });

  it("keeps formatVersion at 1: the dump gained keys, it did not change shape", async () => {
    await seedTimed({ id: "alone", title: "Sozinho", startAt: saoPaulo(2026, 10, 20, 9, 0) });

    expect((await exportDocument()).formatVersion).toBe(1);
  });

  it("lists events before event_sync_links, because a link references its Event", async () => {
    const keys = Object.keys((await exportDocument()).tables);

    expect(keys).toContain("events");
    expect(keys).toContain("event_sync_links");
    expect(keys.indexOf("events")).toBeLessThan(keys.indexOf("event_sync_links"));
  });
});

describe("GET /api/export — sync links are dumped too, orphans included (ADR-0016)", () => {
  it("dumps a link field for field, with its sync instant in epoch seconds", async () => {
    await seedTimed({ id: "linked", title: "Dentista", startAt: saoPaulo(2026, 10, 20, 9, 30) });
    const link = await seedLink({
      id: "link-1",
      eventId: "linked",
      calendarId: "primary",
      externalEventId: "google-abc",
      etag: '"etag-1"',
      syncedContentHash: "last-synced-hash",
      syncedAt: saoPaulo(2026, 10, 19, 12, 0),
    });

    const dump = await exportDocument();

    expect(dump.tables.event_sync_links).toEqual([expectedLinkDto(link)]);
    expect(dump.tables.event_sync_links?.[0]).toMatchObject({
      eventId: "linked",
      syncedAt: saoPaulo(2026, 10, 19, 12, 0),
    });
  });

  it("dumps an orphan link, whose Event is gone, with a null eventId", async () => {
    const orphan = await seedLink({ id: "link-orphan", eventId: null, externalEventId: "g-9" });

    const dump = await exportDocument();

    expect(dump.tables.event_sync_links).toEqual([expectedLinkDto(orphan)]);
    expect(dump.tables.event_sync_links?.[0]).toMatchObject({ eventId: null, syncedAt: null });
  });
});

/** The same camelCase to snake_case step `scripts/restore-drill.mjs` applies to every key. */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
}

async function columnsOf(table: string): Promise<string[]> {
  const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return results.map((column) => column.name).sort();
}

describe("GET /api/export — the dump has the shape the restore drill rebuilds from (PRD AC-21)", () => {
  it("dumps exactly the columns of the events table, no more and no fewer, under snake_case", async () => {
    await seedTimed({ id: "t", title: "T", startAt: saoPaulo(2026, 10, 20, 9, 0) });
    await seedAllDay({ id: "d", title: "D", startDate: "2026-10-26" });

    const dump = await exportDocument();
    const columns = await columnsOf("events");

    expect(columns.length).toBeGreaterThan(0);
    for (const row of dump.tables.events ?? []) {
      expect(Object.keys(row).map(camelToSnake).sort()).toEqual(columns);
    }
    expect(dump.tables.events).toHaveLength(2);
  });

  it("dumps exactly the columns of the event_sync_links table under snake_case", async () => {
    await seedTimed({ id: "t", title: "T", startAt: saoPaulo(2026, 10, 20, 9, 0) });
    await seedLink({ id: "l", eventId: "t", externalEventId: "g-1" });

    const dump = await exportDocument();
    const columns = await columnsOf("event_sync_links");

    expect(columns.length).toBeGreaterThan(0);
    expect(dump.tables.event_sync_links).toHaveLength(1);
    for (const row of dump.tables.event_sync_links ?? []) {
      expect(Object.keys(row).map(camelToSnake).sort()).toEqual(columns);
    }
  });

  it("dumps allDay as a JSON boolean, which the drill binds as the 0 or 1 SQLite stores", async () => {
    await seedTimed({ id: "t", title: "T", startAt: saoPaulo(2026, 10, 20, 9, 0) });
    await seedAllDay({ id: "d", title: "D", startDate: "2026-10-26" });

    const dump = await exportDocument();
    const byId = new Map((dump.tables.events ?? []).map((row) => [row.id, row.allDay]));

    expect(byId.get("t")).toBe(false);
    expect(byId.get("d")).toBe(true);
  });
});
