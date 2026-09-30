// Chore C6 (roadmap) — the restore drill's value mapping.
//
// Found 2026-09-30 by the drill's first run over a snapshot carrying a boolean:
// `tasks.detached` reached the export in v0.9.2 (recurring-tasks PRD AC-30) as a
// JSON `false`, and scripts/restore-drill.mjs bound every non-number, non-string
// value through JSON.stringify — so the INTEGER column received the TEXT "false"
// and every Task's `detached` came back corrupted. The drill failed, correctly.
//
// Written BEFORE src/shared/restore-values.ts exists (`tdd: true`): this file is
// RED on its own import until the module lands. scripts/restore-drill.mjs stays
// the I/O glue (temp database, file reads, printing) and imports these two pure
// functions, so the code the drill runs is the code this suite pins.

import { describe, expect, it } from "vitest";
import { restoredValueMatches, toSqliteValue } from "../src/shared/restore-values";

describe("toSqliteValue — how a snapshot value is bound into the rebuilt database", () => {
  it("binds a boolean as the integer SQLite stores for Drizzle's boolean mode", () => {
    expect(toSqliteValue(false)).toBe(0);
    expect(toSqliteValue(true)).toBe(1);
  });

  it("passes null, numbers and strings through unchanged", () => {
    expect(toSqliteValue(null)).toBeNull();
    expect(toSqliteValue(0)).toBe(0);
    expect(toSqliteValue(1_727_000_000_000)).toBe(1_727_000_000_000);
    expect(toSqliteValue("2026-10-05")).toBe("2026-10-05");
    expect(toSqliteValue("")).toBe("");
  });

  it("serializes an array or an object as JSON text, as before", () => {
    expect(toSqliteValue([1440, 60])).toBe("[1440,60]");
    expect(toSqliteValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("restoredValueMatches — whether a restored column equals its snapshot value", () => {
  it("accepts the integer a boolean was stored as, and only that integer", () => {
    expect(restoredValueMatches(false, 0)).toBe(true);
    expect(restoredValueMatches(true, 1)).toBe(true);
    expect(restoredValueMatches(false, 1)).toBe(false);
    expect(restoredValueMatches(true, 0)).toBe(false);
  });

  it("rejects the corrupted text form the drill used to write", () => {
    expect(restoredValueMatches(false, "false")).toBe(false);
    expect(restoredValueMatches(true, "true")).toBe(false);
  });

  it("compares null, numbers and strings strictly", () => {
    expect(restoredValueMatches(null, null)).toBe(true);
    expect(restoredValueMatches(null, 0)).toBe(false);
    expect(restoredValueMatches(5, 5)).toBe(true);
    expect(restoredValueMatches(5, "5")).toBe(false);
    expect(restoredValueMatches("x", "x")).toBe(true);
  });

  it("accepts an array or object restored as its JSON text", () => {
    expect(restoredValueMatches([1440, 60], "[1440,60]")).toBe(true);
    expect(restoredValueMatches([1440, 60], "[60,1440]")).toBe(false);
  });
});
