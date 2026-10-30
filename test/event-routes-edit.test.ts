// PRPs/prds/events-and-day-view.prd.md AC-12 Edit
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A4; Task 8 — `PATCH /api/events/:id`; Task 9 — mounted below the bearer gate).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): nothing is mounted at
// `/api/events`, so every request answers 404 until plan Tasks 8 and 9 land — the RED reason.
// Cases that expect a 404 for an UNKNOWN id carry a positive control (a PATCH of a known id
// in the same file succeeds), so a route that is simply absent cannot satisfy them by accident.
//
// Every case starts from one stored timed Event whose `created_at` and `updated_at` are
// seeded in 2020 (test/event-fixtures.ts): "updatedAt moved" can then be seen even though
// the column has one-second precision, and "createdAt did not move" is exact. The seeded hash
// is the TRUE hash of the seeded fields, so "a PATCH carrying the stored values leaves the
// hash equal" is a real comparison; every other hash is recomputed from the STORED row.
//
// Merge semantics (plan Task 8, the absent-versus-null contract of `UpdateTaskInput`): an
// absent key keeps the stored value, an explicit `null` clears an optional field, and a kind
// change carries only the target shape's fields. The closed key set is the same as for POST;
// an offending key is refused WITHOUT applying the valid keys beside it.

import { beforeEach, describe, expect } from "vitest";
import type { EventResponse } from "../src/shared/api";
import { EVENT_TITLE_MAX } from "../src/shared/events";
import {
  EVENTS_URL,
  LONG_AGO,
  SAO_PAULO,
  call,
  callRaw,
  countEvents,
  errorOf,
  names,
  readEvent,
  recomputedHash,
  seedAllDay,
  seedTimed,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

/** 2026-10-20 09:30 America/Sao_Paulo (12:30Z), and one hour later. */
const START = 1792499400;
const END = 1792503000;

const ID = "evt-edit";

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

async function seedBase() {
  return await seedTimed({
    id: ID,
    title: "Dentista",
    location: "Clínica Sorriso",
    startAt: START,
    endAt: END,
  });
}

function patch(body: unknown, id = ID): Promise<Response> {
  return call("PATCH", `${EVENTS_URL}/${id}`, body);
}

async function patched(body: unknown, id = ID): Promise<EventResponse["event"]> {
  const res = await patch(body, id);
  expect(res.status).toBe(200);
  return ((await res.json()) as EventResponse).event;
}

describe("PATCH /api/events/:id — a title edit (PRD AC-12)", () => {
  it("answers 200 with the new title and every other field as it was", async () => {
    const before = await seedBase();

    const event = await patched({ title: "Dentista (retorno)" });

    expect(event).toMatchObject({
      id: ID,
      title: "Dentista (retorno)",
      location: "Clínica Sorriso",
      allDay: false,
      startAt: START,
      endAt: END,
      timezone: SAO_PAULO,
      source: "local",
    });
    expect(event.createdAt).toBe(Math.floor(before.createdAt.getTime() / 1000));
  });

  it("moves updatedAt forward and changes the content hash", async () => {
    const before = await seedBase();
    const now = Math.floor(Date.now() / 1000);

    const event = await patched({ title: "Dentista (retorno)" });

    expect(event.updatedAt).toBeGreaterThan(LONG_AGO);
    expect(event.updatedAt).toBeGreaterThanOrEqual(now - 5);
    expect(event.contentHash).not.toBe(before.contentHash);
  });

  it("stores the edit, with a hash that matches the new fields and createdAt untouched", async () => {
    const before = await seedBase();

    const event = await patched({ title: "Dentista (retorno)" });
    const stored = await readEvent(ID);

    expect(stored?.title).toBe("Dentista (retorno)");
    expect(stored?.contentHash).toBe(event.contentHash);
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
    expect(stored?.createdAt).toEqual(before.createdAt);
    expect(stored?.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("trims the new title", async () => {
    await seedBase();

    const event = await patched({ title: "   Retorno  " });

    expect(event.title).toBe("Retorno");
  });
});

describe("PATCH /api/events/:id — a PATCH carrying the stored values leaves the hash equal (PRD AC-12)", () => {
  it("keeps the content hash when nothing authored changes", async () => {
    const before = await seedBase();

    const event = await patched({
      title: "Dentista",
      description: null,
      location: "Clínica Sorriso",
      allDay: false,
      startAt: START,
      endAt: END,
      timezone: SAO_PAULO,
    });

    expect(event.contentHash).toBe(before.contentHash);
    expect((await readEvent(ID))?.contentHash).toBe(before.contentHash);
  });

  it("keeps the hash when the title is sent with padding that trims back to the stored title", async () => {
    const before = await seedBase();

    const event = await patched({ title: "  Dentista  " });

    expect(event.contentHash).toBe(before.contentHash);
  });
});

describe("PATCH /api/events/:id — absent keys keep their value, null clears (plan Task 8)", () => {
  it("clears the location with an explicit null and rehashes", async () => {
    const before = await seedBase();

    const event = await patched({ location: null });
    const stored = await readEvent(ID);

    expect(event.location).toBeNull();
    expect(event.title).toBe("Dentista");
    expect(event.contentHash).not.toBe(before.contentHash);
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("sets a description, trimmed", async () => {
    await seedBase();

    const event = await patched({ description: "  levar exames " });

    expect(event.description).toBe("levar exames");
  });

  it("moves an Event by sending both ends, and rehashes", async () => {
    const before = await seedBase();
    const nextDay = 86_400;

    const event = await patched({ startAt: START + nextDay, endAt: END + nextDay });
    const stored = await readEvent(ID);

    expect(event.startAt).toBe(START + nextDay);
    expect(event.endAt).toBe(END + nextDay);
    expect(event.contentHash).not.toBe(before.contentHash);
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("changes the zone and rehashes", async () => {
    const before = await seedBase();

    const event = await patched({ timezone: "America/New_York" });

    expect(event.timezone).toBe("America/New_York");
    expect(event.startAt).toBe(START);
    expect(event.contentHash).not.toBe(before.contentHash);
  });
});

describe("PATCH /api/events/:id — toggling all-day carries only the target shape's fields (PRD AC-12)", () => {
  it("converts a timed Event to all-day: instants null, days set, the end the next day", async () => {
    const before = await seedBase();

    const event = await patched({ allDay: true, startDate: "2026-10-20" });
    const stored = await readEvent(ID);

    expect(event).toMatchObject({
      allDay: true,
      startAt: null,
      endAt: null,
      startDate: "2026-10-20",
      endDate: "2026-10-21",
      title: "Dentista",
    });
    expect(stored?.allDay).toBe(true);
    expect(stored?.startAt).toBeNull();
    expect(stored?.endAt).toBeNull();
    expect(stored?.startDate).toBe("2026-10-20");
    expect(stored?.endDate).toBe("2026-10-21");
    expect(event.contentHash).not.toBe(before.contentHash);
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("converts an all-day Event to timed: days null, instants set", async () => {
    await seedAllDay({ id: ID, title: "Feriado", startDate: "2026-10-26", endDate: "2026-10-28" });

    const event = await patched({ allDay: false, startAt: START, endAt: END });
    const stored = await readEvent(ID);

    expect(event).toMatchObject({
      allDay: false,
      startAt: START,
      endAt: END,
      startDate: null,
      endDate: null,
      title: "Feriado",
    });
    expect(stored?.startDate).toBeNull();
    expect(stored?.endDate).toBeNull();
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("edits the days of an all-day Event in place", async () => {
    await seedAllDay({ id: ID, title: "Feriado", startDate: "2026-10-26", endDate: "2026-10-28" });

    const event = await patched({ startDate: "2026-10-27", endDate: "2026-10-30" });

    expect(event).toMatchObject({ startDate: "2026-10-27", endDate: "2026-10-30", allDay: true });
  });
});

/** [what is wrong, the body, the field key the refusal must name] */
const REFUSED: Array<[string, unknown, string]> = [
  ["an endAt before the start", { endAt: START - 60 }, "endAt"],
  ["a null title", { title: null }, "title"],
  ["a blank title", { title: "   " }, "title"],
  ["a title of 201 characters", { title: "a".repeat(EVENT_TITLE_MAX + 1) }, "title"],
  ["an unknown timezone", { timezone: "Mars/Base" }, "timezone"],
  ["a text allDay", { allDay: "yes" }, "allDay"],
  ["a text startAt", { startAt: "soon" }, "startAt"],
  ["a number for a description", { description: 7 }, "description"],
  ["an id key", { title: "Novo", id: "other" }, "id"],
  ["a source key", { title: "Novo", source: "google" }, "source"],
  ["a source key on its own", { source: "local" }, "source"],
  ["a contentHash key", { title: "Novo", contentHash: "forged" }, "contentHash"],
  ["a createdAt key", { title: "Novo", createdAt: 1 }, "createdAt"],
  ["an updatedAt key", { title: "Novo", updatedAt: 1 }, "updatedAt"],
  ["a typo in a key", { titel: "Novo" }, "titel"],
];

describe("PATCH /api/events/:id — what it refuses leaves the row exactly as it was (PRD AC-12)", () => {
  it.each(REFUSED)("rejects %s with 400 naming the field", async (_label, body, field) => {
    const before = await seedBase();

    const res = await patch(body);

    expect(res.status).toBe(400);
    expect(names(await errorOf(res), field)).toBe(true);
    expect(await readEvent(ID)).toEqual(before);
  });

  it("rejects an empty body with 400 and changes nothing", async () => {
    const before = await seedBase();

    const res = await patch({});

    expect(res.status).toBe(400);
    expect((await errorOf(res)).length).toBeGreaterThan(0);
    expect(await readEvent(ID)).toEqual(before);
  });

  it.each([
    ["a JSON array", "[]"],
    ["JSON null", "null"],
    ["malformed JSON", "{not json"],
  ])("rejects %s as the body with 400 and changes nothing", async (_label, raw) => {
    const before = await seedBase();

    const res = await callRaw("PATCH", `${EVENTS_URL}/${ID}`, raw);

    expect(res.status).toBe(400);
    expect(await readEvent(ID)).toEqual(before);
  });

  it("does not apply the valid keys that arrive beside a refused one", async () => {
    const before = await seedBase();

    const res = await patch({ title: "Mudou", contentHash: "forged" });

    expect(res.status).toBe(400);
    expect((await readEvent(ID))?.title).toBe(before.title);
  });
});

describe("PATCH /api/events/:id — an unknown id (PRD AC-12)", () => {
  it("answers 404 and creates nothing, while the same body succeeds on a known id", async () => {
    await seedBase();

    const missing = await patch({ title: "Fantasma" }, "no-such-event");
    const known = await patch({ title: "Real" });

    expect(missing.status).toBe(404);
    expect(known.status).toBe(200);
    expect(await countEvents()).toBe(1);
  });
});
