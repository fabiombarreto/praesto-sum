// PRPs/prds/events-and-day-view.prd.md AC-17 Search
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A9; Task 7 — the `q` parameter of `GET /api/events`, reusing `buildSearchClauses` and
// `shouldSearch` from src/shared/search.ts without editing them).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): nothing is mounted at
// `/api/events`, so every request answers 404 until plan Tasks 7 and 9 land — the RED reason.
//
// The PRD's fixture: Events titled `Consulta dentista` and `Reunião`, and one whose
// DESCRIPTION reads `levar exames da consulta`. `q=consulta` finds two (a title hit and a
// description hit), `q=CONSULTA dentista` finds one (every word must match), `q=reuniao`
// finds `Reunião` (case- and diacritic-insensitive).
//
// One-character `q` (orchestrator clarification 2). PRD AC-17 says a one-character `q` is 400
// "exactly as on GET /api/tasks", but the shipped Tasks route does not do that (it answers
// 200 for `?q=_`; the two-character floor lives in the client). The plan keeps the explicit
// requirement for EVENTS: a 400 naming `q`, via `shouldSearch`. This suite tests that Events
// behaviour and asserts nothing new about GET /api/tasks.
//
// What the order assertions do and do not pin. Without a range the PRD says "most recent
// start first, at most 100", so those are asserted exactly, with all-day Events placed on
// days that sort unambiguously against the timed ones around them. With a range the PRD says
// nothing about search ordering beyond AC-11's range order, so the composition cases compare
// the SET of ids, not their order.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import { createDb } from "../src/worker/db/client";
import { events } from "../src/worker/db/schema";
import {
  EVENTS_URL,
  call,
  errorOf,
  listEvents,
  names,
  saoPaulo,
  seedAllDay,
  seedTimed,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

/** The PRD's three Events, on three different days. */
async function seedPrdFixture() {
  const consulta = await seedTimed({
    id: "s1-consulta",
    title: "Consulta dentista",
    startAt: saoPaulo(2026, 10, 20, 15, 0),
  });
  const reuniao = await seedTimed({
    id: "s2-reuniao",
    title: "Reunião",
    startAt: saoPaulo(2026, 10, 21, 10, 0),
  });
  const exames = await seedTimed({
    id: "s3-exames",
    title: "Laboratório",
    description: "levar exames da consulta",
    startAt: saoPaulo(2026, 11, 3, 8, 0),
  });
  return { consulta, reuniao, exames };
}

async function idsForQuery(q: string, extra = ""): Promise<string[]> {
  const query = `q=${encodeURIComponent(q)}${extra === "" ? "" : `&${extra}`}`;
  return (await listEvents(query)).map((event) => event.id);
}

describe("GET /api/events?q — the PRD fixture (PRD AC-17)", () => {
  it("finds the title hit and the description hit for q=consulta, most recent start first", async () => {
    const { consulta, exames } = await seedPrdFixture();

    expect(await idsForQuery("consulta")).toEqual([exames.id, consulta.id]);
  });

  it("requires every word: q=CONSULTA dentista finds only the Event that has both", async () => {
    const { consulta } = await seedPrdFixture();

    expect(await idsForQuery("CONSULTA dentista")).toEqual([consulta.id]);
  });

  it("matches in any word order: q=dentista consulta finds the same Event", async () => {
    const { consulta } = await seedPrdFixture();

    expect(await idsForQuery("dentista consulta")).toEqual([consulta.id]);
  });

  it("ignores accents and case: q=reuniao finds Reunião", async () => {
    const { reuniao } = await seedPrdFixture();

    expect(await idsForQuery("reuniao")).toEqual([reuniao.id]);
  });

  it("ignores accents and case in the query too: q=REUNIÃO finds Reunião", async () => {
    const { reuniao } = await seedPrdFixture();

    expect(await idsForQuery("REUNIÃO")).toEqual([reuniao.id]);
  });

  it("finds an Event whose only hit is in the description", async () => {
    const { exames } = await seedPrdFixture();

    expect(await idsForQuery("exames")).toEqual([exames.id]);
  });

  it("answers 200 with an empty list when nothing matches", async () => {
    await seedPrdFixture();

    const res = await call("GET", `${EVENTS_URL}?q=${encodeURIComponent("inexistente")}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });

  it("answers the matches in the wire shape (epoch seconds), not as raw rows", async () => {
    const { consulta } = await seedPrdFixture();

    const [found] = await listEvents(`q=${encodeURIComponent("dentista")}`);

    expect(found?.id).toBe(consulta.id);
    expect(found?.startAt).toBe(saoPaulo(2026, 10, 20, 15, 0));
    expect(found?.createdAt).toBe(Math.floor(consulta.createdAt.getTime() / 1000));
  });
});

describe("GET /api/events?q — a query too short or too long is refused, naming q (PRD AC-17)", () => {
  /** [what is wrong, the already-encoded q value] */
  const REFUSED: Array<[string, string]> = [
    ["a one-character query", "c"],
    ["a one-character query padded with spaces", "%20c%20"],
    ["an empty query", ""],
    ["a whitespace-only query", "%20%20%20"],
    ["a query of 101 characters", "a".repeat(101)],
  ];

  it.each(REFUSED)("rejects %s with 400 naming q", async (_label, encoded) => {
    await seedPrdFixture();

    const res = await call("GET", `${EVENTS_URL}?q=${encoded}`);

    expect(res.status).toBe(400);
    expect(names(await errorOf(res), "q")).toBe(true);
  });

  it("accepts a query of exactly 100 characters", async () => {
    await seedPrdFixture();

    const res = await call("GET", `${EVENTS_URL}?q=${"a".repeat(100)}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });

  it("accepts a query of exactly two characters", async () => {
    const { reuniao } = await seedPrdFixture();

    expect(await idsForQuery("re")).toEqual([reuniao.id]);
  });
});

describe("GET /api/events?q — q composes with from and to (PRD AC-17)", () => {
  it("returns only the matches inside the range", async () => {
    const { consulta } = await seedPrdFixture();
    await seedTimed({
      id: "s4-retorno",
      title: "Consulta de retorno",
      startAt: saoPaulo(2026, 11, 30, 9, 0),
    });

    const ids = await idsForQuery("consulta", "from=2026-10-20&to=2026-10-21");

    expect(ids).toEqual([consulta.id]);
  });

  it("leaves out an Event inside the range that does not match", async () => {
    const { reuniao } = await seedPrdFixture();

    // `Reunião` is inside 2026-10-20..2026-10-21 too, but only the query below names it.
    const ids = await idsForQuery("consulta", "from=2026-10-20&to=2026-10-21");

    expect(ids).not.toContain(reuniao.id);
  });

  it("returns every match inside a wider range", async () => {
    const { consulta, exames } = await seedPrdFixture();
    const retorno = await seedTimed({
      id: "s4-retorno",
      title: "Consulta de retorno",
      startAt: saoPaulo(2026, 11, 30, 9, 0),
    });

    const ids = await idsForQuery("consulta", "from=2026-10-01&to=2026-11-30");

    expect([...ids].sort()).toEqual([consulta.id, exames.id, retorno.id].sort());
  });
});

describe("GET /api/events?q — without a range the match spans all dates, most recent first (PRD AC-17)", () => {
  it("reaches back and forward beyond any 62-day window, newest start first", async () => {
    const past = await seedTimed({
      id: "past",
      title: "Consulta antiga",
      startAt: saoPaulo(2024, 3, 1, 9, 0),
    });
    const now = await seedTimed({
      id: "now",
      title: "Consulta atual",
      startAt: saoPaulo(2026, 10, 20, 9, 0),
    });
    const future = await seedTimed({
      id: "future",
      title: "Consulta futura",
      startAt: saoPaulo(2027, 5, 1, 9, 0),
    });

    expect(await idsForQuery("consulta")).toEqual([future.id, now.id, past.id]);
  });

  it("sorts an all-day Event among timed ones by the day it starts", async () => {
    const earlier = await seedTimed({
      id: "earlier",
      title: "Consulta cedo",
      startAt: saoPaulo(2026, 10, 25, 15, 0),
    });
    const allDay = await seedAllDay({
      id: "all-day",
      title: "Consulta o dia todo",
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });
    const later = await seedTimed({
      id: "later",
      title: "Consulta tarde",
      startAt: saoPaulo(2026, 10, 27, 10, 0),
    });

    expect(await idsForQuery("consulta")).toEqual([later.id, allDay.id, earlier.id]);
  });

  it("returns at most 100 matches, keeping the 100 most recent", async () => {
    const db = createDb(env);
    const first = saoPaulo(2026, 1, 1, 8, 0);
    const rows = Array.from({ length: 101 }, (_unused, index) => {
      const number = index + 1;
      const startAt = new Date((first + number * 3600) * 1000);
      return {
        id: `bulk-${String(number).padStart(3, "0")}`,
        title: `Consulta ${number}`,
        allDay: false,
        startAt,
        endAt: startAt,
        timezone: "America/Sao_Paulo",
        contentHash: "bulk-hash",
      };
    });
    // Small chunks: D1 refuses a statement with more than 100 bound parameters.
    for (let offset = 0; offset < rows.length; offset += 5) {
      await db.insert(events).values(rows.slice(offset, offset + 5));
    }

    const ids = await idsForQuery("consulta");

    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe("bulk-101");
    expect(ids[99]).toBe("bulk-002");
    expect(ids).not.toContain("bulk-001");
    expect(ids).toEqual([...ids].sort().reverse());
  });
});
