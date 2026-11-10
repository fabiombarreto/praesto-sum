// PRPs/prds/events-and-day-view.prd.md AC-9 Create
// PRPs/prds/events-and-day-view.prd.md AC-10 Create validation
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A1 and AC-A2; Task 6 — `POST /api/events`; Task 9 — mounted below the bearer gate).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): nothing is mounted at
// `/api/events`, so every request below answers 404 (Hono's not-found) until plan Tasks 6
// and 9 land. That is the RED reason, and the only one expected.
//
// What the answer must be, and where the expectations come from:
//
//   * The `contentHash` of the AC-9 payload is pinned to a golden SHA-256 computed OUTSIDE
//     this repository over the canonical bytes (the same digest test/event-hash.test.ts pins
//     for that input), so the route cannot be right merely by agreeing with itself. The other
//     hashes are recomputed here from the STORED row with the shared hash function.
//   * `createdAt` and `updatedAt` are epoch SECONDS (ADR-0016 decision 4; the shipped Google
//     DTO's milliseconds are a separate type). A value within a few seconds of the test's own
//     clock, as an integer, can only be seconds.
//   * Error text is pt-BR (ADR-0009) and the wording is deliberately not pinned. Each refusal
//     is matched on the FIELD KEY it names, as a whole word (`names` in test/event-fixtures.ts).
//     The non-object-body case has no field to name, so it asserts only the 400 and a string.
//
// Setup goes straight to D1 where setup is not the thing under test (test/event-fixtures.ts).
// Cleanup is `resetTaskTables`, which already wipes both event tables (phase 1).

import { beforeEach, describe, expect } from "vitest";
import type { EventResponse } from "../src/shared/api";
import { EVENT_DESCRIPTION_MAX, EVENT_LOCATION_MAX, EVENT_TITLE_MAX } from "../src/shared/events";
import {
  EVENTS_URL,
  SAO_PAULO,
  UUID,
  allEvents,
  call,
  callRaw,
  countEvents,
  errorOf,
  names,
  readEvent,
  recomputedHash,
  secondsOf,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

/** 2026-10-20 09:30 America/Sao_Paulo (12:30Z), and one hour later. */
const START = 1792499400;
const END = 1792503000;

/** SHA-256 of the canonical bytes of the AC-9 payload; see test/event-hash.test.ts. */
const GOLDEN_AC9_HASH = "c25b398c4548bcf2f6fdc645ff4bc3c2b7a1d21da48fa0e37f5e4c661cd06e79";

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

async function createdEvent(res: Response): Promise<EventResponse["event"]> {
  expect(res.status).toBe(201);
  return ((await res.json()) as EventResponse).event;
}

describe("POST /api/events — a timed Event (PRD AC-9)", () => {
  it("answers 201 with the trimmed title, the owner's zone, source local and nulls where nothing was given", async () => {
    const before = Math.floor(Date.now() / 1000);

    const res = await call("POST", EVENTS_URL, {
      title: "  Dentista ",
      startAt: START,
      endAt: END,
      location: "Clínica Sorriso",
    });
    const after = Math.floor(Date.now() / 1000);
    const event = await createdEvent(res);

    expect(event).toEqual({
      id: expect.stringMatching(UUID),
      title: "Dentista",
      description: null,
      location: "Clínica Sorriso",
      allDay: false,
      startAt: START,
      endAt: END,
      startDate: null,
      endDate: null,
      timezone: SAO_PAULO,
      source: "local",
      contentHash: GOLDEN_AC9_HASH,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
    for (const stamp of [event.createdAt, event.updatedAt]) {
      expect(Number.isInteger(stamp)).toBe(true);
      expect(stamp).toBeGreaterThanOrEqual(before - 5);
      expect(stamp).toBeLessThanOrEqual(after + 5);
    }
  });

  it("stores exactly one row, equal to what it answered, with a hash that matches its own fields", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, {
        title: "  Dentista ",
        startAt: START,
        endAt: END,
        location: "Clínica Sorriso",
      }),
    );

    const rows = await allEvents();
    const stored = await readEvent(event.id);

    expect(rows).toHaveLength(1);
    expect(stored).toBeDefined();
    expect(stored?.title).toBe("Dentista");
    expect(stored?.location).toBe("Clínica Sorriso");
    expect(stored?.allDay).toBe(false);
    expect(secondsOf(stored?.startAt ?? null)).toBe(START);
    expect(secondsOf(stored?.endAt ?? null)).toBe(END);
    expect(stored?.startDate).toBeNull();
    expect(stored?.endDate).toBeNull();
    expect(stored?.timezone).toBe(SAO_PAULO);
    expect(stored?.source).toBe("local");
    expect(stored?.contentHash).toBe(event.contentHash);
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("gives an Event with only a start an end one hour later", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, { title: "Ligar", startAt: START }),
    );

    expect(event.startAt).toBe(START);
    expect(event.endAt).toBe(START + 3600);
  });

  it("accepts a zero-duration Event, whose end equals its start", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, { title: "Ponto", startAt: START, endAt: START }),
    );

    expect(event.startAt).toBe(START);
    expect(event.endAt).toBe(START);
  });

  it("keeps a known IANA zone the caller names, and hashes it", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, {
        title: "Call",
        startAt: START,
        timezone: "America/New_York",
      }),
    );
    const stored = await readEvent(event.id);

    expect(event.timezone).toBe("America/New_York");
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("trims a description and a location, and stores empty text as null", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, {
        title: "Exames",
        startAt: START,
        description: "  levar exames ",
        location: "   ",
      }),
    );

    expect(event.description).toBe("levar exames");
    expect(event.location).toBeNull();
  });

  it("mints a different id for every Event", async () => {
    const first = await createdEvent(
      await call("POST", EVENTS_URL, { title: "A", startAt: START }),
    );
    const second = await createdEvent(
      await call("POST", EVENTS_URL, { title: "B", startAt: START }),
    );

    expect(first.id).not.toBe(second.id);
    expect(await countEvents()).toBe(2);
  });
});

describe("POST /api/events — an all-day Event (PRD AC-9)", () => {
  it("answers 201 with the next day as the exclusive end when only a start day is given", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, { title: "Feriado", allDay: true, startDate: "2026-10-26" }),
    );

    expect(event).toMatchObject({
      title: "Feriado",
      allDay: true,
      startDate: "2026-10-26",
      endDate: "2026-10-27",
      startAt: null,
      endAt: null,
      timezone: SAO_PAULO,
      source: "local",
    });
  });

  it("stores the all-day row without instants and with a hash that matches its own fields", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, { title: "Feriado", allDay: true, startDate: "2026-10-26" }),
    );
    const stored = await readEvent(event.id);

    expect(stored?.allDay).toBe(true);
    expect(stored?.startAt).toBeNull();
    expect(stored?.endAt).toBeNull();
    expect(stored?.startDate).toBe("2026-10-26");
    expect(stored?.endDate).toBe("2026-10-27");
    expect(stored?.contentHash).toBe(event.contentHash);
    expect(stored === undefined ? null : await recomputedHash(stored)).toBe(event.contentHash);
  });

  it("keeps an exclusive end day the caller gives (two days: the 26th and the 27th)", async () => {
    const event = await createdEvent(
      await call("POST", EVENTS_URL, {
        title: "Viagem",
        allDay: true,
        startDate: "2026-10-26",
        endDate: "2026-10-28",
      }),
    );

    expect(event.startDate).toBe("2026-10-26");
    expect(event.endDate).toBe("2026-10-28");
  });
});

/** [what is wrong, the body, the field key the refusal must name] */
const REFUSED: Array<[string, unknown, string]> = [
  ["a missing title", { startAt: START }, "title"],
  ["a null title", { title: null, startAt: START }, "title"],
  ["a blank title", { title: "   ", startAt: START }, "title"],
  [
    "a title of 201 characters",
    { title: "a".repeat(EVENT_TITLE_MAX + 1), startAt: START },
    "title",
  ],
  ["a number for a title", { title: 42, startAt: START }, "title"],
  [
    "a description over the limit",
    { title: "X", startAt: START, description: "d".repeat(EVENT_DESCRIPTION_MAX + 1) },
    "description",
  ],
  [
    "a location over the limit",
    { title: "X", startAt: START, location: "l".repeat(EVENT_LOCATION_MAX + 1) },
    "location",
  ],
  [
    "all-day carrying startAt",
    { title: "X", allDay: true, startDate: "2026-10-26", startAt: START },
    "startAt",
  ],
  ["not all-day, with no startAt", { title: "X", allDay: false }, "startAt"],
  ["an endAt before the startAt", { title: "X", startAt: START, endAt: START - 60 }, "endAt"],
  ["a startDate of 2026-02-30", { title: "X", allDay: true, startDate: "2026-02-30" }, "startDate"],
  [
    "an all-day end that is not after its start",
    { title: "X", allDay: true, startDate: "2026-10-26", endDate: "2026-10-26" },
    "endDate",
  ],
  ["an unknown timezone", { title: "X", startAt: START, timezone: "Mars/Base" }, "timezone"],
  ["a source key naming google", { title: "X", startAt: START, source: "google" }, "source"],
  ["a source key naming local", { title: "X", startAt: START, source: "local" }, "source"],
  ["a contentHash key", { title: "X", startAt: START, contentHash: "forged" }, "contentHash"],
  ["a client-chosen id", { title: "X", startAt: START, id: "mine" }, "id"],
  ["a createdAt key", { title: "X", startAt: START, createdAt: 1 }, "createdAt"],
  ["a text allDay", { title: "X", allDay: "yes", startAt: START }, "allDay"],
  ["a text startAt", { title: "X", startAt: "2026-10-20T09:30:00Z" }, "startAt"],
];

describe("POST /api/events — a body the API refuses (PRD AC-10)", () => {
  it.each(REFUSED)(
    "rejects %s with 400 naming the field and writes nothing",
    async (_label, body, field) => {
      const res = await call("POST", EVENTS_URL, body);

      expect(res.status).toBe(400);
      expect(names(await errorOf(res), field)).toBe(true);
      expect(await countEvents()).toBe(0);
    },
  );

  it("names either the missing start day or the stray startAt when all-day has startAt but no startDate", async () => {
    const res = await call("POST", EVENTS_URL, { title: "X", allDay: true, startAt: START });
    const error = res.status === 400 ? await errorOf(res) : "";

    expect(res.status).toBe(400);
    expect(names(error, "startDate") || names(error, "startAt")).toBe(true);
    expect(await countEvents()).toBe(0);
  });

  it("accepts a title of exactly 200 characters", async () => {
    const title = "a".repeat(EVENT_TITLE_MAX);

    const event = await createdEvent(await call("POST", EVENTS_URL, { title, startAt: START }));

    expect(event.title).toBe(title);
  });

  it("does not let a refused request through by also carrying a valid Event", async () => {
    const res = await call("POST", EVENTS_URL, {
      title: "Valid on its own",
      startAt: START,
      source: "google",
    });

    expect(res.status).toBe(400);
    expect(await countEvents()).toBe(0);
  });
});

/** [what the body is, the raw text sent] */
const NOT_AN_OBJECT: Array<[string, string]> = [
  ["a JSON array", "[]"],
  ["a JSON string", '"Dentista"'],
  ["a JSON number", "42"],
  ["JSON null", "null"],
  ["malformed JSON", "{not json"],
  ["an empty body", ""],
];

describe("POST /api/events — a body that is not a JSON object (PRD AC-10)", () => {
  it.each(NOT_AN_OBJECT)("rejects %s with 400 and writes nothing", async (_label, raw) => {
    const res = await callRaw("POST", EVENTS_URL, raw);

    expect(res.status).toBe(400);
    expect((await errorOf(res)).length).toBeGreaterThan(0);
    expect(await countEvents()).toBe(0);
  });
});

describe("POST /api/events — no request can create a google Event (PRD AC-14, last clause)", () => {
  it("stores source local for every Event it creates, and none for google", async () => {
    await call("POST", EVENTS_URL, { title: "A", startAt: START });
    await call("POST", EVENTS_URL, { title: "B", allDay: true, startDate: "2026-10-26" });
    await call("POST", EVENTS_URL, { title: "C", startAt: START, source: "google" });

    const rows = await allEvents();

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.source)).toEqual(["local", "local"]);
  });
});
