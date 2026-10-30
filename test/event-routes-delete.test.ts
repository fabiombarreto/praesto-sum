// PRPs/prds/events-and-day-view.prd.md AC-13 Delete
// PRPs/prds/events-and-day-view.prd.md AC-14 Source guard
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A5 and AC-A6; Task 8 — `DELETE /api/events/:id` and the `source` guard on PATCH and
// DELETE; Task 9 — mounted below the bearer gate).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): nothing is mounted at
// `/api/events`, so every request answers 404 until plan Tasks 8 and 9 land — the RED reason.
// Cases that expect a 404 for an UNKNOWN id carry a positive control in the same test, so a
// route that is simply absent cannot satisfy them by accident.
//
// AC-13's last clause: a link row pointing at the deleted Event, inserted DIRECTLY (no route
// writes the link table, ADR-0016), survives with `event_id` null. That is the table's own
// `ON DELETE SET NULL` plus a route that does not touch the link table; both halves are
// observable here as "the link is still there, pointing at nothing, otherwise unchanged".
//
// AC-14: a `google` row exists only because the test inserts it directly (unit 15 will create
// them). `PATCH` and `DELETE` answer 409 naming `source` and leave the row byte for byte as
// it was; the last clause (no `POST` can create one) lives in test/event-routes-create.test.ts.

import { beforeEach, describe, expect } from "vitest";
import {
  EVENTS_URL,
  call,
  countEvents,
  countLinks,
  errorOf,
  names,
  readEvent,
  readLinks,
  saoPaulo,
  seedLink,
  seedTimed,
} from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

const START = saoPaulo(2026, 10, 20, 9, 30);

function remove(id: string): Promise<Response> {
  return call("DELETE", `${EVENTS_URL}/${id}`);
}

describe("DELETE /api/events/:id — a local Event (PRD AC-13)", () => {
  it("answers 204 with no body, and the row is gone", async () => {
    await seedTimed({ id: "doomed", title: "Dentista", startAt: START });

    const res = await remove("doomed");

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await readEvent("doomed")).toBeUndefined();
  });

  it("deletes only the Event it names", async () => {
    await seedTimed({ id: "doomed", title: "Dentista", startAt: START });
    const bystander = await seedTimed({ id: "bystander", title: "Reunião", startAt: START });

    await remove("doomed");

    expect(await readEvent("bystander")).toEqual(bystander);
    expect(await countEvents()).toBe(1);
  });

  it("answers 404 the second time, and for an id that never existed, deleting nothing", async () => {
    const bystander = await seedTimed({ id: "bystander", title: "Reunião", startAt: START });
    await seedTimed({ id: "doomed", title: "Dentista", startAt: START });

    const first = await remove("doomed");
    const again = await remove("doomed");
    const never = await remove("no-such-event");

    expect(first.status).toBe(204);
    expect(again.status).toBe(404);
    expect(never.status).toBe(404);
    expect(await readEvent("bystander")).toEqual(bystander);
  });
});

describe("DELETE /api/events/:id — a sync link pointing at it survives, orphaned (PRD AC-13)", () => {
  it("leaves the link in place with event_id null and every other column unchanged", async () => {
    await seedTimed({ id: "linked", title: "Dentista", startAt: START });
    const link = await seedLink({
      id: "link-1",
      eventId: "linked",
      calendarId: "primary",
      externalEventId: "google-abc",
      etag: '"etag-1"',
      syncedContentHash: "last-synced-hash",
      syncedAt: saoPaulo(2026, 10, 19, 12, 0),
    });

    const res = await remove("linked");
    const links = await readLinks();

    expect(res.status).toBe(204);
    expect(await readEvent("linked")).toBeUndefined();
    expect(links).toEqual([{ ...link, eventId: null }]);
  });

  it("leaves every other link alone, and the link count unchanged", async () => {
    await seedTimed({ id: "linked", title: "Dentista", startAt: START });
    await seedTimed({ id: "other", title: "Reunião", startAt: START });
    await seedLink({ id: "link-1", eventId: "linked", externalEventId: "google-1" });
    const untouched = await seedLink({
      id: "link-2",
      eventId: "other",
      externalEventId: "google-2",
    });
    const orphan = await seedLink({ id: "link-3", eventId: null, externalEventId: "google-3" });

    await remove("linked");

    const links = await readLinks();
    expect(await countLinks()).toBe(3);
    expect(links.find((link) => link.id === "link-2")).toEqual(untouched);
    expect(links.find((link) => link.id === "link-3")).toEqual(orphan);
    expect(links.find((link) => link.id === "link-1")?.eventId).toBeNull();
  });
});

describe("PATCH and DELETE on a google-source Event answer 409 naming source (PRD AC-14)", () => {
  it("refuses a PATCH with 409 naming source, and leaves the row unchanged", async () => {
    const google = await seedTimed({
      id: "from-google",
      title: "Vem do Google",
      startAt: START,
      source: "google",
    });

    const res = await call("PATCH", `${EVENTS_URL}/from-google`, { title: "Mudei" });

    expect(res.status).toBe(409);
    expect(names(await errorOf(res), "source")).toBe(true);
    expect(await readEvent("from-google")).toEqual(google);
  });

  it("refuses a DELETE with 409 naming source, and the row is still there", async () => {
    const google = await seedTimed({
      id: "from-google",
      title: "Vem do Google",
      startAt: START,
      source: "google",
    });

    const res = await remove("from-google");

    expect(res.status).toBe(409);
    expect(names(await errorOf(res), "source")).toBe(true);
    expect(await readEvent("from-google")).toEqual(google);
  });

  it("refuses to touch a google Event's link either: the link keeps its event", async () => {
    await seedTimed({
      id: "from-google",
      title: "Vem do Google",
      startAt: START,
      source: "google",
    });
    const link = await seedLink({
      id: "link-g",
      eventId: "from-google",
      externalEventId: "google-xyz",
    });

    const res = await remove("from-google");

    expect(res.status).toBe(409);
    expect(await readLinks()).toEqual([link]);
  });

  it("still lets the same requests through for a local Event (positive control)", async () => {
    await seedTimed({ id: "mine", title: "Meu", startAt: START });

    const edit = await call("PATCH", `${EVENTS_URL}/mine`, { title: "Meu, editado" });
    const del = await remove("mine");

    expect(edit.status).toBe(200);
    expect(del.status).toBe(204);
  });
});
