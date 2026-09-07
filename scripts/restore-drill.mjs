#!/usr/bin/env node
/**
 * Chore C6 — prove the restore.
 *
 * Rebuilds a THROWAWAY database from an export snapshot and compares per-table
 * row counts against the snapshot's own contents. Touches nothing that matters:
 * the database is a temp file, deleted on the way out, and production is never
 * contacted. Reads only the snapshot file it is given.
 *
 * Why this exists, in the roadmap's own words: "a backup that has never been
 * restored is a hypothesis, not a safeguard." C6's trigger is "right after C5,
 * and again before every migration over real data" — units 13, 14, 15, 17, 18,
 * 19 and 20 each fire it again, so this is written to be re-run, not to be a
 * one-off.
 *
 * The rebuild is SQLite, not D1, and that is deliberate rather than a shortcut:
 * D1 *is* SQLite, `migrations/*.sql` is plain SQL, and running it locally proves
 * the schema and the snapshot agree without creating a billable Cloudflare
 * resource or risking a command aimed at the wrong database. What it therefore
 * does NOT prove is D1-specific behaviour at the network boundary; that is
 * stated in the report rather than glossed.
 *
 * Usage: node scripts/restore-drill.mjs <path-to-snapshot.json>
 */
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const snapshotPath = process.argv[2];
if (!snapshotPath) {
  console.error("restore-drill: usage: node scripts/restore-drill.mjs <snapshot.json>");
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const tables = snapshot.tables ?? {};
const excluded = (snapshot.excludedTables ?? []).map((e) => e.name);

const workdir = mkdtempSync(join(tmpdir(), "praesto-restore-"));
const dbPath = join(workdir, "restored.sqlite");
let failures = 0;

try {
  const db = new DatabaseSync(dbPath);

  // --- 1. Schema, from the same migrations production ran -------------------
  const migrationFiles = readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const sql = readFileSync(join("migrations", file), "utf8");
    // drizzle-kit separates statements with this marker; splitting on it keeps
    // multi-statement migrations working under exec().
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed.length > 0) db.exec(trimmed);
    }
  }
  console.log(`restore-drill: applied ${migrationFiles.length} migrations`);

  // --- 2. Load every dumped row --------------------------------------------
  const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
  const loaded = {};
  for (const [table, rows] of Object.entries(tables)) {
    loaded[table] = 0;
    for (const row of rows) {
      const cols = Object.keys(row).map(camelToSnake);
      const placeholders = cols.map(() => "?").join(", ");
      const values = Object.values(row).map((v) =>
        v === null || typeof v === "number" || typeof v === "string" ? v : JSON.stringify(v),
      );
      db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(
        ...values,
      );
      loaded[table] += 1;
    }
  }

  // --- 3. Compare, per table, against the snapshot -------------------------
  console.log("\nrestore-drill: per-table row counts");
  console.log("  table                        snapshot  restored");
  for (const [table, rows] of Object.entries(tables)) {
    const actual = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const ok = actual === rows.length;
    if (!ok) failures += 1;
    console.log(
      `  ${table.padEnd(28)} ${String(rows.length).padStart(8)}  ${String(actual).padStart(8)}  ${ok ? "OK" : "MISMATCH"}`,
    );
  }

  // --- 4. The excluded tables must exist but stay empty --------------------
  // The schema creates them; the snapshot deliberately carries none of their
  // rows. A restore that somehow populated them would mean the export leaked
  // what it promised to exclude.
  console.log("\nrestore-drill: excluded tables (schema present, no rows restored)");
  for (const table of excluded) {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const ok = n === 0;
    if (!ok) failures += 1;
    console.log(`  ${table.padEnd(28)} ${String(n).padStart(8)}  ${ok ? "OK" : "LEAKED"}`);
  }

  // --- 5. Compare CONTENT, every row and every field -----------------------
  // Counts alone would pass if every row restored as nulls, so each row is read
  // back and compared field by field. Every row, not a sample: a spot check on
  // one row proves that row, and the interesting corruption is the row with the
  // unusual value — the accented title, the null deadline, the epoch that
  // arrived as a string.
  console.log("\nrestore-drill: field-level comparison, every row of every table");
  for (const [table, rows] of Object.entries(tables)) {
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(28)} no rows in this snapshot — restore path NOT exercised`);
      continue;
    }
    let checked = 0;
    const mismatches = [];
    for (const row of rows) {
      const back = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(row.id);
      if (!back) {
        mismatches.push(`${row.id}: row absent after restore`);
        continue;
      }
      for (const [key, want] of Object.entries(row)) {
        const got = back[camelToSnake(key)];
        if (got !== want && !(got === null && want === null)) {
          mismatches.push(
            `${row.id} ${key}: snapshot ${JSON.stringify(want)} != restored ${JSON.stringify(got)}`,
          );
        }
      }
      checked += 1;
    }
    if (mismatches.length === 0) {
      console.log(
        `  ${table.padEnd(28)} ${String(checked).padStart(4)} rows, every field identical  OK`,
      );
    } else {
      failures += 1;
      console.log(`  ${table.padEnd(28)} ${mismatches.length} MISMATCH(es):`);
      for (const m of mismatches.slice(0, 10)) console.log(`      ${m}`);
    }
  }

  db.close();
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

console.log("");
if (failures > 0) {
  console.error(`restore-drill: FAIL — ${failures} check(s) did not match.`);
  process.exit(1);
}
console.log("restore-drill: PASS — the snapshot rebuilds into an empty schema intact.");
