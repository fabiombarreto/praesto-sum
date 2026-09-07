// PRPs/prds/data-export.prd.md AC-5 the-document-describes-itself
//
// `buildExportEnvelope` is the pure, DB-free assembly point (src/shared/export.ts,
// plan Task 2): it takes the current instant and the already-mapped DTO arrays
// and returns one self-describing document. It reads no clock — matching every
// other module in src/shared/ — so `now` is a parameter throughout this suite.

import { describe, expect, it } from "vitest";
import type {
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

  it("carries a key for each of the five data-bearing tables, populated with the given rows", () => {
    const lifeArea = { id: "la-1" } as unknown as LifeAreaDto;
    const tables = { ...emptyTables(), lifeAreas: [lifeArea] };

    const doc = buildExportEnvelope(new Date(), tables, EXCLUDED);

    expect(doc.tables.life_areas).toEqual([lifeArea]);
    expect(Object.keys(doc.tables).sort()).toEqual(
      [
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
  });
});
