// PRPs/prds/data-export.prd.md AC-5 the-document-describes-itself
// PRPs/prds/events-and-day-view.prd.md AC-19 Export dump (the envelope half: `events` and
// `event_sync_links` join the five tables; `formatVersion` stays 1 — asserted above)
//
// `buildExportEnvelope` is the pure, DB-free assembly point (src/shared/export.ts,
// plan Task 2): it takes the current instant and the already-mapped DTO arrays
// and returns one self-describing document. It reads no clock — matching every
// other module in src/shared/ — so `now` is a parameter throughout this suite.

import { describe, expect, it } from "vitest";
import type {
  EventDto,
  EventSyncLinkDto,
  GoogleCalendarSelectionDto,
  LifeAreaDto,
  ReminderDto,
  RecurrenceSeriesDto,
  TaskDto,
} from "../src/shared/api";
import { PRAESTO_TIMEZONE } from "../src/shared/dates";
import { buildExportEnvelope } from "../src/shared/export";

const EXCLUDED = [
  { name: "google_connections", reason: "carries a live OAuth refresh token" },
  { name: "push_subscriptions", reason: "carries a device's push delivery credentials" },
  { name: "oauth_states", reason: "single-use nonces, worthless once consumed or expired" },
];

function emptyTables() {
  return {
    lifeAreas: [] as LifeAreaDto[],
    recurrenceSeries: [] as RecurrenceSeriesDto[],
    tasks: [] as TaskDto[],
    reminders: [] as ReminderDto[],
    googleCalendarSelections: [] as GoogleCalendarSelectionDto[],
    // Unit 14 events-and-day-view phase 2 (AC-19): the two Event tables. `eventLinks` is the
    // `ExportTables` property that feeds the `event_sync_links` key.
    events: [] as EventDto[],
    eventLinks: [] as EventSyncLinkDto[],
  };
}

describe("buildExportEnvelope — AC-5 the document describes itself", () => {
  it("carries a format version", () => {
    const doc = buildExportEnvelope(new Date("2026-09-04T12:00:00Z"), emptyTables(), EXCLUDED);

    expect(doc.formatVersion).toBe(1);
  });

  it("carries the generation instant as epoch seconds of the given `now`", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");

    const doc = buildExportEnvelope(now, emptyTables(), EXCLUDED);

    expect(doc.generatedAt).toBe(Math.floor(now.getTime() / 1000));
  });

  it("reads no clock of its own — the same `now` always reproduces the same instant", () => {
    // Called twice, deliberately, with a fixed instant far from the real
    // present: a builder that secretly reads Date.now() would still pass a
    // single call, but could not reproduce the SAME answer on a second call
    // unless it actually used the parameter.
    const fixedPast = new Date("2020-01-01T00:00:00Z");

    const first = buildExportEnvelope(fixedPast, emptyTables(), EXCLUDED);
    const second = buildExportEnvelope(fixedPast, emptyTables(), EXCLUDED);

    expect(first.generatedAt).toBe(Math.floor(fixedPast.getTime() / 1000));
    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it("names the IANA timezone the app's calendar days are expressed in", () => {
    const doc = buildExportEnvelope(new Date(), emptyTables(), EXCLUDED);

    expect(doc.timezone).toBe("America/Sao_Paulo");
    expect(doc.timezone).toBe(PRAESTO_TIMEZONE);
  });

  it("carries the excluded-table list with its reasons, verbatim", () => {
    const doc = buildExportEnvelope(new Date(), emptyTables(), EXCLUDED);

    expect(doc.excludedTables).toEqual(EXCLUDED);
  });

  it("carries a key for each of the seven data-bearing tables, populated with the given rows", () => {
    const lifeArea = { id: "la-1" } as unknown as LifeAreaDto;
    const tables = { ...emptyTables(), lifeAreas: [lifeArea] };

    const doc = buildExportEnvelope(new Date(), tables, EXCLUDED);

    expect(doc.tables.life_areas).toEqual([lifeArea]);
    expect(Object.keys(doc.tables).sort()).toEqual(
      [
        "event_sync_links",
        "events",
        "google_calendar_selections",
        "life_areas",
        "recurrence_series",
        "reminders",
        "tasks",
      ].sort(),
    );
  });

  it("keeps the tables that were given empty actually empty — never fabricates rows", () => {
    const doc = buildExportEnvelope(new Date(), emptyTables(), EXCLUDED);

    expect(doc.tables.tasks).toEqual([]);
    expect(doc.tables.reminders).toEqual([]);
    expect(doc.tables.recurrence_series).toEqual([]);
    expect(doc.tables.google_calendar_selections).toEqual([]);
    expect(doc.tables.events).toEqual([]);
    expect(doc.tables.event_sync_links).toEqual([]);
  });
});

describe("buildExportEnvelope — AC-19 the Event tables travel with the document", () => {
  it("passes the Events and their sync links through verbatim, under their table names", () => {
    const event = { id: "event-1" } as unknown as EventDto;
    const link = { id: "link-1" } as unknown as EventSyncLinkDto;
    const tables = { ...emptyTables(), events: [event], eventLinks: [link] };

    const doc = buildExportEnvelope(new Date(), tables, EXCLUDED);

    expect(doc.tables.events).toEqual([event]);
    expect(doc.tables.event_sync_links).toEqual([link]);
  });

  it("lists events before event_sync_links, because the restore drill inserts in key order and a link references its Event", () => {
    const keys = Object.keys(buildExportEnvelope(new Date(), emptyTables(), EXCLUDED).tables);

    expect(keys.indexOf("events")).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf("events")).toBeLessThan(keys.indexOf("event_sync_links"));
  });
});
