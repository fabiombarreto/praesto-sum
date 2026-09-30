/**
 * The decidable half of chore C6's restore drill: how a value read from an
 * export snapshot is bound into the rebuilt SQLite database, and whether the
 * value read back equals the snapshot's. `scripts/restore-drill.mjs` is the
 * I/O glue and imports both, so the drill runs exactly the code
 * `test/restore-values.test.ts` pins.
 *
 * Booleans are the case that forced this module (2026-09-30): Drizzle's
 * `integer(..., { mode: "boolean" })` stores 0/1, the export carries a JSON
 * boolean, and the drill used to bind it through `JSON.stringify` — writing
 * the TEXT "false" into an INTEGER column.
 *
 * No DOM globals, no clock and no runtime dependencies: imported with an
 * explicit `.ts` extension by a plain Node script (see
 * `scripts/pull-export-snapshot.mjs`), so it must stay erasable-syntax
 * TypeScript — type annotations only.
 */

/** A value SQLite accepts as a bound parameter from `node:sqlite`. */
export type SqliteValue = null | number | string;

/** Maps one snapshot value to the parameter the rebuilt database stores. */
export function toSqliteValue(value: unknown): SqliteValue {
  if (value === null || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return JSON.stringify(value);
}

/** Whether a column read back after the restore equals its snapshot value. */
export function restoredValueMatches(snapshotValue: unknown, restoredValue: unknown): boolean {
  return toSqliteValue(snapshotValue) === restoredValue;
}
