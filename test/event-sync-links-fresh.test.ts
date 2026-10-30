// PRPs/prds/events-and-day-view.prd.md AC-7 The link table outlives the event
// (the last clause: "a freshly migrated database holds zero rows in event_sync_links")
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A7; Task 7 — migration 0007 creates the table and seeds nothing).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): migration 0007 does not
// exist, so `event_sync_links` does not exist in the test database and the query below
// fails with `no such table` — the RED reason, and the only one expected.
//
// Why this is a file of its own. Storage isolation in @cloudflare/vitest-pool-workers is
// per test FILE, and `test/apply-migrations.ts` migrates the database before the first
// test of each file, so the first thing a file sees is exactly "a freshly migrated
// database". `test/event-schema.test.ts` wipes both event tables before every test, which
// would make this same assertion vacuous there — a count of zero after our own DELETE
// proves nothing about the migration. This file deliberately has no cleanup and writes
// nothing, so what it reads is what the migration left.

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("AC-7 — a freshly migrated database", () => {
  it("holds zero rows in event_sync_links", async () => {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM event_sync_links").first<{
      n: number;
    }>();

    expect(row).toEqual({ n: 0 });
  });
});
