// PRPs/prds/events-and-day-view.prd.md AC-16 One writer, hash always right (behaviour half)
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A8; Task 5 — src/worker/event-repository.ts, the only writer of `events` and the only
// place that computes `content_hash`; Tasks 6-8 — the routes that call it).
//
// The source-inspection half of AC-16 ("no route computes the hash or imports the link table,
// and nothing outside the repository writes `events`") cannot run inside workerd, which has no
// `node:fs`; it lives in test/event-api-inspection.test.ts, a Node-side file.
//
// This half is what the database shows. Written BEFORE the Implementer (test-first, per
// `tdd: true`): nothing is mounted at `/api/events`, so the first request below answers 404 —
// the RED reason.
//
//   * "After a create followed by three edits, when the row is read after each, its
//     `content_hash` equals the recomputed hash every time." The recomputation is done HERE,
//     from the STORED row's authored fields, with the shared hash function that has its own
//     pinned golden digests (test/event-hash.test.ts). Each edit also has to change the hash,
//     so a repository that stops rehashing cannot hide behind "still equal to the old fields".
//   * "Every /api/events call leaves the count of `event_sync_links` unchanged." Two link rows
//     are inserted directly (one pointing at the Event under test, one orphan) and the table's
//     rows are compared before and after EVERY verb, including the DELETE that orphans one of
//     them: the count stays 2 and the only change a link may show is `event_id` becoming null.

import { beforeEach, describe, expect } from "vitest";
import type { EventResponse } from "../src/shared/api";
import {
  EVENTS_URL,
  call,
  readEvent,
  readLinks,
  recomputedHash,
  saoPaulo,
  seedLink,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

const START = saoPaulo(2026, 10, 20, 9, 30);

async function created(): Promise<EventResponse["event"]> {
  const res = await call("POST", EVENTS_URL, {
    title: "Dentista",
    startAt: START,
    endAt: START + 3600,
    location: "Clínica Sorriso",
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as EventResponse).event;
}

async function edited(id: string, body: unknown): Promise<EventResponse["event"]> {
  const res = await call("PATCH", `${EVENTS_URL}/${id}`, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as EventResponse).event;
}

/** The stored hash of `id`, after checking it equals the one recomputed from the stored fields. */
async function storedHashIsRight(id: string): Promise<string> {
  const row = await readEvent(id);
  expect(row).toBeDefined();
  if (row === undefined) throw new Error(`Event ${id} is not stored`);
  expect(row.contentHash).toBe(await recomputedHash(row));
  return row.contentHash;
}

describe("the stored content hash always equals the hash of the stored fields (PRD AC-16)", () => {
  it("holds after a create and after each of three edits, and each edit changes it", async () => {
    const event = await created();
    const hashes = [await storedHashIsRight(event.id)];
    expect(hashes[0]).toBe(event.contentHash);

    // Edit 1: the title.
    await edited(event.id, { title: "Dentista (retorno)" });
    hashes.push(await storedHashIsRight(event.id));

    // Edit 2: the time, both ends together.
    await edited(event.id, { startAt: START + 86_400, endAt: START + 86_400 + 5400 });
    hashes.push(await storedHashIsRight(event.id));

    // Edit 3: the kind, from timed to all-day.
    await edited(event.id, { allDay: true, startDate: "2026-10-21" });
    hashes.push(await storedHashIsRight(event.id));

    expect(new Set(hashes).size).toBe(4);
  });

  it("holds when an edit clears a field, and when it only restates what is stored", async () => {
    const event = await created();

    await edited(event.id, { location: null });
    const afterClear = await storedHashIsRight(event.id);
    await edited(event.id, { location: null });
    const afterRestate = await storedHashIsRight(event.id);

    expect(afterRestate).toBe(afterClear);
    expect(afterClear).not.toBe(event.contentHash);
  });

  it("is a 64-character lowercase hex digest", async () => {
    const event = await created();

    expect(await storedHashIsRight(event.id)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("no /api/events call changes the event_sync_links table (PRD AC-16)", () => {
  it("leaves both links as they were across a create, reads, three edits and a delete", async () => {
    const orphan = await seedLink({ id: "link-orphan", eventId: null, externalEventId: "g-1" });
    const event = await created();
    const linked = await seedLink({
      id: "link-linked",
      eventId: event.id,
      externalEventId: "g-2",
      etag: '"v1"',
      syncedContentHash: "last-synced-hash",
      syncedAt: saoPaulo(2026, 10, 19, 12, 0),
    });
    const expectUntouched = async (): Promise<void> => {
      const links = await readLinks();
      expect(links).toHaveLength(2);
      expect(links.find((link) => link.id === orphan.id)).toEqual(orphan);
      expect(links.find((link) => link.id === linked.id)).toEqual(linked);
    };

    await expectUntouched();

    expect((await call("GET", `${EVENTS_URL}?from=2026-10-20&to=2026-10-22`)).status).toBe(200);
    await expectUntouched();
    expect((await call("GET", `${EVENTS_URL}?q=dentista`)).status).toBe(200);
    await expectUntouched();

    await edited(event.id, { title: "Dentista (retorno)" });
    await expectUntouched();
    await edited(event.id, { startAt: START + 3600, endAt: START + 7200 });
    await expectUntouched();
    await edited(event.id, { allDay: true, startDate: "2026-10-21" });
    await expectUntouched();

    await created();
    await expectUntouched();

    const del = await call("DELETE", `${EVENTS_URL}/${event.id}`);
    expect(del.status).toBe(204);
    const links = await readLinks();
    expect(links).toHaveLength(2);
    expect(links.find((link) => link.id === orphan.id)).toEqual(orphan);
    expect(links.find((link) => link.id === linked.id)).toEqual({ ...linked, eventId: null });
  });

  it("writes no link when it creates an Event", async () => {
    await created();
    await created();

    expect(await readLinks()).toEqual([]);
  });
});
