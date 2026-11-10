// PRPs/prds/events-and-day-view.prd.md AC-11 Range read
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A3; Task 7 — `GET /api/events` over a bounded `from`/`to` range; Task 2 — the shared
// range module; Task 9 — mounted below the bearer gate).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): nothing is mounted at
// `/api/events`, so every request answers 404 until plan Tasks 7 and 9 land — the RED reason.
//
// The oracle is the PRD's own five-event fixture (all `America/Sao_Paulo`, UTC-3):
//
//   E1  timed     2026-10-20 09:30 - 10:30
//   E2  all-day   2026-10-26 and 2026-10-27 (stored end 2026-10-28, exclusive)
//   E3  timed     2026-10-20 23:00 - 2026-10-21 01:00      crosses midnight
//   E4  zero-time 2026-10-21 08:00 (start = end)
//   E5  timed     2026-11-30 10:00 - 11:00
//
// `from=2026-10-20&to=2026-10-21` must answer E1, E3, E4 in that order; `2026-10-27` alone
// must answer E2. Beyond the PRD's fixture, the boundary cases below pin the half-open
// interval the plan fixes in Task 7 (an Event that ends exactly when the range starts is
// outside it; a zero-duration Event inside it is inside; a midnight-crossing Event belongs to
// BOTH days it touches; an all-day exclusive end never leaks into the next day). They follow
// from the PRD's "overlaps the range" reading and the RFC 4791 overlap table, and each names
// its expected outcome so a regression is attributable.
//
// Events are put straight into D1 (test/event-fixtures.ts) so a defect in `POST` cannot hide
// behind a failure here; one round-trip case at the end exercises both together.

import { beforeEach, describe, expect } from "vitest";
import type { EventResponse } from "../src/shared/api";
import {
  EVENTS_URL,
  call,
  errorOf,
  expectedDto,
  listEvents,
  names,
  saoPaulo,
  seedAllDay,
  seedTimed,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

/** The PRD's five-event fixture; returns the rows so cases can name them. */
async function seedPrdFixture() {
  const e1 = await seedTimed({
    id: "e1-dentista",
    title: "Dentista",
    startAt: saoPaulo(2026, 10, 20, 9, 30),
    endAt: saoPaulo(2026, 10, 20, 10, 30),
  });
  const e2 = await seedAllDay({
    id: "e2-feriado",
    title: "Feriado",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
  });
  const e3 = await seedTimed({
    id: "e3-plantao",
    title: "Plantão",
    startAt: saoPaulo(2026, 10, 20, 23, 0),
    endAt: saoPaulo(2026, 10, 21, 1, 0),
  });
  const e4 = await seedTimed({
    id: "e4-ponto",
    title: "Ponto",
    startAt: saoPaulo(2026, 10, 21, 8, 0),
    endAt: saoPaulo(2026, 10, 21, 8, 0),
  });
  const e5 = await seedTimed({
    id: "e5-novembro",
    title: "Novembro",
    startAt: saoPaulo(2026, 11, 30, 10, 0),
    endAt: saoPaulo(2026, 11, 30, 11, 0),
  });
  return { e1, e2, e3, e4, e5 };
}

async function idsFor(from: string, to: string): Promise<string[]> {
  return (await listEvents(`from=${from}&to=${to}`)).map((event) => event.id);
}

describe("GET /api/events — the PRD fixture (PRD AC-11)", () => {
  it("returns the first, third and fourth Event for 2026-10-20 to 2026-10-21, in that order", async () => {
    const { e1, e3, e4 } = await seedPrdFixture();

    expect(await idsFor("2026-10-20", "2026-10-21")).toEqual([e1.id, e3.id, e4.id]);
  });

  it("returns the all-day Event for 2026-10-27 alone", async () => {
    const { e2 } = await seedPrdFixture();

    expect(await idsFor("2026-10-27", "2026-10-27")).toEqual([e2.id]);
  });

  it("lists the all-day Event first, then the timed ones by start, when a range holds both", async () => {
    const { e1, e2, e3, e4 } = await seedPrdFixture();

    expect(await idsFor("2026-10-20", "2026-10-27")).toEqual([e2.id, e1.id, e3.id, e4.id]);
  });

  it("answers each Event in the wire shape: epoch seconds, hash and source included", async () => {
    const { e1, e2 } = await seedPrdFixture();

    const listed = await listEvents("from=2026-10-20&to=2026-10-27");

    expect(listed.find((event) => event.id === e1.id)).toEqual(expectedDto(e1));
    expect(listed.find((event) => event.id === e2.id)).toEqual(expectedDto(e2));
  });

  it("answers 200 with an empty list, not an error, for a range with nothing in it", async () => {
    await seedPrdFixture();

    const res = await call("GET", `${EVENTS_URL}?from=2027-01-01&to=2027-01-02`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });
});

describe("GET /api/events — a midnight-crossing Event belongs to both days it touches (PRD AC-11)", () => {
  it("lists the 23:00-01:00 Event on the first day", async () => {
    const { e3 } = await seedPrdFixture();

    expect(await idsFor("2026-10-20", "2026-10-20")).toContain(e3.id);
  });

  it("lists the same Event on the second day", async () => {
    const { e3 } = await seedPrdFixture();

    expect(await idsFor("2026-10-21", "2026-10-21")).toContain(e3.id);
  });

  it("does not list it on the day before it starts or the day after it ends", async () => {
    const { e3 } = await seedPrdFixture();

    expect(await idsFor("2026-10-19", "2026-10-19")).not.toContain(e3.id);
    expect(await idsFor("2026-10-22", "2026-10-22")).not.toContain(e3.id);
  });
});

interface TimedBoundary {
  label: string;
  startAt: number;
  endAt: number;
  from: string;
  to: string;
  inside: boolean;
}

const TIMED_BOUNDARIES: TimedBoundary[] = [
  {
    label: "an Event that ends exactly when the range starts is outside it",
    startAt: saoPaulo(2026, 10, 20, 22, 0),
    endAt: saoPaulo(2026, 10, 21, 0, 0),
    from: "2026-10-21",
    to: "2026-10-21",
    inside: false,
  },
  {
    label: "an Event that ends one minute into the range is inside it",
    startAt: saoPaulo(2026, 10, 20, 22, 0),
    endAt: saoPaulo(2026, 10, 21, 0, 1),
    from: "2026-10-21",
    to: "2026-10-21",
    inside: true,
  },
  {
    label: "an Event that starts exactly when the range ends is outside it",
    startAt: saoPaulo(2026, 10, 22, 0, 0),
    endAt: saoPaulo(2026, 10, 22, 1, 0),
    from: "2026-10-21",
    to: "2026-10-21",
    inside: false,
  },
  {
    label: "that same Event is inside the range that starts on its day",
    startAt: saoPaulo(2026, 10, 22, 0, 0),
    endAt: saoPaulo(2026, 10, 22, 1, 0),
    from: "2026-10-22",
    to: "2026-10-22",
    inside: true,
  },
  {
    label: "an Event that starts in the last minute of the range is inside it",
    startAt: saoPaulo(2026, 10, 21, 23, 59),
    endAt: saoPaulo(2026, 10, 22, 0, 30),
    from: "2026-10-21",
    to: "2026-10-21",
    inside: true,
  },
  {
    label: "a zero-duration Event at the very start of the range is inside it",
    startAt: saoPaulo(2026, 10, 21, 0, 0),
    endAt: saoPaulo(2026, 10, 21, 0, 0),
    from: "2026-10-21",
    to: "2026-10-21",
    inside: true,
  },
  {
    label: "a zero-duration Event at the very end of the range is outside it",
    startAt: saoPaulo(2026, 10, 21, 0, 0),
    endAt: saoPaulo(2026, 10, 21, 0, 0),
    from: "2026-10-20",
    to: "2026-10-20",
    inside: false,
  },
  {
    label: "an Event that wraps the whole range is inside it",
    startAt: saoPaulo(2026, 10, 19, 10, 0),
    endAt: saoPaulo(2026, 10, 23, 10, 0),
    from: "2026-10-21",
    to: "2026-10-21",
    inside: true,
  },
  {
    label: "an Event on the last day of a multi-day range is inside it",
    startAt: saoPaulo(2026, 10, 23, 15, 0),
    endAt: saoPaulo(2026, 10, 23, 16, 0),
    from: "2026-10-20",
    to: "2026-10-23",
    inside: true,
  },
  {
    label: "an Event on the day after a multi-day range is outside it",
    startAt: saoPaulo(2026, 10, 24, 15, 0),
    endAt: saoPaulo(2026, 10, 24, 16, 0),
    from: "2026-10-20",
    to: "2026-10-23",
    inside: false,
  },
];

describe("GET /api/events — timed Events at the edges of a range (PRD AC-11)", () => {
  it.each(TIMED_BOUNDARIES)("$label", async ({ startAt, endAt, from, to, inside }) => {
    const seeded = await seedTimed({ id: "edge", title: "Borda", startAt, endAt });

    expect(await idsFor(from, to)).toEqual(inside ? [seeded.id] : []);
  });

  it("reads the range in the owner's zone, whatever zone the Event was authored in", async () => {
    // 2026-10-20 23:30 in New York (UTC-4) is 2026-10-21 00:30 in São Paulo: the owner's 21st.
    const seeded = await seedTimed({
      id: "ny-call",
      title: "Ligação",
      startAt: Date.UTC(2026, 9, 21, 3, 30) / 1000,
      timezone: "America/New_York",
    });

    expect(await idsFor("2026-10-20", "2026-10-20")).toEqual([]);
    expect(await idsFor("2026-10-21", "2026-10-21")).toEqual([seeded.id]);
  });
});

interface AllDayBoundary {
  label: string;
  startDate: string;
  endDate: string;
  from: string;
  to: string;
  inside: boolean;
}

const ALL_DAY_BOUNDARIES: AllDayBoundary[] = [
  {
    label: "a two-day Event is inside a range on its second day",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    from: "2026-10-27",
    to: "2026-10-27",
    inside: true,
  },
  {
    label: "its exclusive end day is outside the Event",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    from: "2026-10-28",
    to: "2026-10-28",
    inside: false,
  },
  {
    label: "the day before its start is outside the Event",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    from: "2026-10-25",
    to: "2026-10-25",
    inside: false,
  },
  {
    label: "a range that ends on its first day touches it",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    from: "2026-10-25",
    to: "2026-10-26",
    inside: true,
  },
  {
    label: "a range that wraps it whole touches it",
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    from: "2026-10-20",
    to: "2026-10-31",
    inside: true,
  },
  {
    label: "a one-day Event is inside its own day",
    startDate: "2026-10-20",
    endDate: "2026-10-21",
    from: "2026-10-20",
    to: "2026-10-20",
    inside: true,
  },
  {
    label: "a one-day Event does not leak into the next day",
    startDate: "2026-10-20",
    endDate: "2026-10-21",
    from: "2026-10-21",
    to: "2026-10-21",
    inside: false,
  },
  {
    label: "an Event ending at a year boundary does not leak into the new year",
    startDate: "2026-12-31",
    endDate: "2027-01-01",
    from: "2027-01-01",
    to: "2027-01-01",
    inside: false,
  },
];

describe("GET /api/events — all-day Events at the edges of a range (PRD AC-11)", () => {
  it.each(ALL_DAY_BOUNDARIES)("$label", async ({ startDate, endDate, from, to, inside }) => {
    const seeded = await seedAllDay({ id: "edge", title: "Dia", startDate, endDate });

    expect(await idsFor(from, to)).toEqual(inside ? [seeded.id] : []);
  });
});

describe("GET /api/events — order within a range (PRD AC-11: all-day first, then by start, then id)", () => {
  it("breaks a tie between two timed Events with the same start by id", async () => {
    const start = saoPaulo(2026, 10, 20, 9, 0);
    await seedTimed({ id: "evt-b", title: "B", startAt: start });
    await seedTimed({ id: "evt-a", title: "A", startAt: start });

    expect(await idsFor("2026-10-20", "2026-10-20")).toEqual(["evt-a", "evt-b"]);
  });

  it("orders two all-day Events by start day, whatever their ids", async () => {
    await seedAllDay({ id: "aaa-later", title: "Depois", startDate: "2026-10-26" });
    await seedAllDay({ id: "zzz-earlier", title: "Antes", startDate: "2026-10-25" });

    expect(await idsFor("2026-10-25", "2026-10-26")).toEqual(["zzz-earlier", "aaa-later"]);
  });

  it("breaks a tie between two all-day Events on the same day by id", async () => {
    await seedAllDay({ id: "evt-b", title: "B", startDate: "2026-10-26" });
    await seedAllDay({ id: "evt-a", title: "A", startDate: "2026-10-26" });

    expect(await idsFor("2026-10-26", "2026-10-26")).toEqual(["evt-a", "evt-b"]);
  });

  it("puts an all-day Event ahead of an earlier timed Event on the same day", async () => {
    await seedTimed({ id: "early", title: "Cedo", startAt: saoPaulo(2026, 10, 26, 6, 0) });
    await seedAllDay({ id: "all-day", title: "Dia todo", startDate: "2026-10-26" });

    expect(await idsFor("2026-10-26", "2026-10-26")).toEqual(["all-day", "early"]);
  });
});

describe("GET /api/events — the range is bounded, and the API never lists without a bound (PRD AC-11)", () => {
  it("accepts a span of exactly 62 days and lists an Event on its last day", async () => {
    const seeded = await seedTimed({
      id: "last-day",
      title: "Último dia",
      startAt: saoPaulo(2026, 12, 20, 10, 0),
    });

    expect(await idsFor("2026-10-20", "2026-12-20")).toEqual([seeded.id]);
  });

  /** [what is wrong, the query string, the parameter keys at least one of which must be named] */
  const REFUSED: Array<[string, string, string[]]> = [
    ["a missing to", "from=2026-10-20", ["to"]],
    ["a missing from", "to=2026-10-21", ["from"]],
    ["a from that is not a date", "from=abc&to=2026-10-21", ["from"]],
    ["a to that is not a date", "from=2026-10-20&to=abc", ["to"]],
    ["a from of 2026-02-30", "from=2026-02-30&to=2026-03-02", ["from"]],
    ["a to before the from", "from=2026-10-21&to=2026-10-20", ["from", "to"]],
    ["a span of 63 days", "from=2026-10-20&to=2026-12-21", ["from", "to"]],
    ["a span of a year", "from=2026-01-01&to=2026-12-31", ["from", "to"]],
  ];

  it.each(REFUSED)("rejects %s with 400 naming the parameter", async (_label, query, keys) => {
    await seedTimed({ id: "bystander", title: "Qualquer", startAt: saoPaulo(2026, 10, 20, 9, 0) });

    const res = await call("GET", `${EVENTS_URL}?${query}`);

    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(keys.some((key) => names(error, key))).toBe(true);
  });

  it("rejects a request with neither a range nor a search with 400, listing nothing", async () => {
    await seedTimed({ id: "bystander", title: "Qualquer", startAt: saoPaulo(2026, 10, 20, 9, 0) });

    const res = await call("GET", EVENTS_URL);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(body).not.toHaveProperty("events");
  });
});

describe("GET /api/events — an Event created through POST is listed on its day (PRD AC-9, AC-11)", () => {
  it("answers the same Event POST answered", async () => {
    const created = await call("POST", EVENTS_URL, {
      title: "Dentista",
      startAt: saoPaulo(2026, 10, 20, 9, 30),
      endAt: saoPaulo(2026, 10, 20, 10, 30),
      location: "Clínica Sorriso",
    });
    expect(created.status).toBe(201);
    const { event } = (await created.json()) as EventResponse;

    const listed = await listEvents("from=2026-10-20&to=2026-10-20");

    expect(listed).toEqual([event]);
  });

  it("lists an all-day Event created through POST on every day it covers and not on the next", async () => {
    const created = await call("POST", EVENTS_URL, {
      title: "Viagem",
      allDay: true,
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });
    expect(created.status).toBe(201);
    const { event } = (await created.json()) as EventResponse;

    expect(await idsFor("2026-10-26", "2026-10-26")).toEqual([event.id]);
    expect(await idsFor("2026-10-27", "2026-10-27")).toEqual([event.id]);
    expect(await idsFor("2026-10-28", "2026-10-28")).toEqual([]);
  });
});
