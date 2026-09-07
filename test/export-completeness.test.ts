// PRPs/prds/data-export.prd.md AC-4 the-completeness-guard-cannot-be-silently-disarmed
//
// This is the exit-signal test the whole unit is shaped around
// (data-export.prd.md Success Metrics: "Schema tables covered by the
// completeness guard: 8 of 8"). Its entire point is the EXCLUSION half:
// an inclusion-only check ("the five expected tables are present") passes
// forever once written and never notices a sixth table arriving unclassified.
//
// The checking logic below (`findUnaccountedTables` / `findUnreasonedExclusions`)
// is written directly in this test file, not in production code — the guard
// IS the test, per the plan's Task 1. Two kinds of proof follow:
//   1. Against the REAL schema (`src/worker/db/schema.ts`), so a future table
//      addition that nobody classifies breaks this file.
//   2. Against small FIXTURE lists, proving the checking logic itself
//      discriminates an unaccounted table and an unreasoned exclusion —
//      without which the real-schema assertion above could pass by
//      accident (e.g. if the check secretly always returned `[]`).

import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { EXCLUDED_TABLES, EXPORTED_TABLE_NAMES } from "../src/worker/db/export-manifest";
import * as schema from "../src/worker/db/schema";

/** Every table name present in neither list — the failure AC-4 names. */
function findUnaccountedTables(
  tableNames: readonly string[],
  exported: readonly string[],
  excluded: ReadonlyArray<{ readonly name: string; readonly reason: string }>,
): string[] {
  const exportedNames = new Set(exported);
  const excludedNames = new Set(excluded.map((entry) => entry.name));
  return tableNames.filter((name) => !exportedNames.has(name) && !excludedNames.has(name));
}

/** Every exclusion entry whose reason is empty or whitespace-only — the second failure AC-4 names. */
function findUnreasonedExclusions(
  excluded: ReadonlyArray<{ readonly name: string; readonly reason: string }>,
): string[] {
  return excluded.filter((entry) => entry.reason.trim().length === 0).map((entry) => entry.name);
}

describe("AC-4 — the completeness guard cannot be silently disarmed", () => {
  it("accounts for every real schema table in exactly one of the two lists", () => {
    // NOT `.filter((value): value is SQLiteTable => is(value, SQLiteTable))`:
    // under drizzle-orm@0.45.2 + exactOptionalPropertyTypes: true, the generic
    // `SQLiteTable<TableConfig>` and each concrete table's literal-named type
    // (e.g. the "life_areas" table) are not mutually assignable, so TS rejects
    // an explicit `value is SQLiteTable` predicate in both directions
    // (TS2677/TS2345). `is()` still narrows correctly at runtime — we just
    // widen with a cast at the boundary instead of annotating the predicate.
    const realTableNames = Object.values(schema)
      .filter((value) => is(value, SQLiteTable))
      .map((table) => getTableConfig(table as SQLiteTable).name);

    // A table added to schema.ts and forgotten here shows up BY NAME.
    expect(findUnaccountedTables(realTableNames, EXPORTED_TABLE_NAMES, EXCLUDED_TABLES)).toEqual(
      [],
    );
  });

  it("never lists a table in BOTH the exported set and the exclusion list", () => {
    const excludedNames = new Set(EXCLUDED_TABLES.map((entry) => entry.name));
    const overlap = EXPORTED_TABLE_NAMES.filter((name) => excludedNames.has(name));

    expect(overlap).toEqual([]);
  });

  it("requires every real exclusion to carry a non-empty, non-whitespace reason", () => {
    expect(findUnreasonedExclusions(EXCLUDED_TABLES)).toEqual([]);
  });

  it("fails BY NAME when a table sits in neither list — fixture proof of the check itself", () => {
    // A future table nobody has classified yet, proven against the checking
    // logic directly rather than against the real (already-complete) schema.
    const fixtureTables = ["life_areas", "tasks", "a_future_table_nobody_classified"];

    const violations = findUnaccountedTables(fixtureTables, EXPORTED_TABLE_NAMES, EXCLUDED_TABLES);

    expect(violations).toEqual(["a_future_table_nobody_classified"]);
  });

  it("fails when an exclusion's reason is empty or whitespace-only — fixture proof of the check itself", () => {
    const fixtureExclusions = [
      { name: "google_connections", reason: "a real, written reason" },
      { name: "silently_disarmed", reason: "   " },
    ];

    expect(findUnreasonedExclusions(fixtureExclusions)).toEqual(["silently_disarmed"]);
  });

  it("exports exactly the five data-bearing table names, no more and no less", () => {
    expect([...EXPORTED_TABLE_NAMES].sort()).toEqual(
      [
        "google_calendar_selections",
        "life_areas",
        "recurrence_series",
        "reminders",
        "tasks",
      ].sort(),
    );
  });

  it("excludes exactly the three infrastructure tables, each with a written reason", () => {
    expect(EXCLUDED_TABLES.map((entry) => entry.name).sort()).toEqual(
      ["google_connections", "oauth_states", "push_subscriptions"].sort(),
    );
    for (const entry of EXCLUDED_TABLES) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });
});
