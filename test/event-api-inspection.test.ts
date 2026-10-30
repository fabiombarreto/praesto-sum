// PRPs/prds/events-and-day-view.prd.md AC-16 One writer, hash always right (inspection half)
// PRPs/prds/events-and-day-view.prd.md AC-34 Documentation synced (the docs/api-reference.md part)
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A8 and AC-A15; Tasks 5-8 keep the route files free of the hash and the link table, Task
// 15 documents the contract). The plan's Notes ("How AC-A8 is made verifiable") specify this
// file: a Node-side test, because workerd has no `node:fs`.
//
// Runs in the `docs` vitest project (plain Node). It is registered in that project's `include`
// AND in the `worker` project's `exclude` in vitest.config.ts; one without the other makes the
// workerd copy fail to load with a file-level error whose tests never even get counted.
//
// WHAT THIS CAN AND CANNOT PROVE. Like test/source-invariants.test.ts it is a TRIPWIRE
// against the accidental introduction of a second writer, not a proof that none can exist: it
// matches literal tokens in the raw text, so a renamed import, an aliased table or a wrapper
// helper evades it. The plan's shell greps (Tasks 5-8, 17) run the same patterns as an
// independent check. What it does buy: the two rules AC-16 names are checked on every run,
// not once at review time.
//
// Honesty about the detectors. Source-invariants was wrong four times, each time found only by
// planting a violation and watching the check pass. The detectors here are therefore
// exercised against PLANTED text in the first describe: each must flag a violation and must
// leave a legitimate lookalike alone. The patterns avoid regex word-boundary escapes on
// purpose (one such escape was once mangled into a literal backspace by a writing tool,
// leaving a pattern that matched nothing and made the check pass unconditionally).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). Today neither the repository
// nor the events router exists, so the "the files being inspected exist" guard and the
// documentation rows are RED; the two "finds nothing" checks are meaningful only because of
// that guard, which is why it sits beside them.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY = "src/worker/event-repository.ts";
const EVENTS_ROUTER = "src/worker/routes/events.ts";
const ROUTES_DIR = "src/worker/routes";
const API_REFERENCE = "docs/api-reference.md";

interface SourceFile {
  path: string;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

function load(dir: string): SourceFile[] {
  return sourceFiles(dir).map((path) => ({
    path: path.split(sep).join("/"),
    text: readFileSync(path, "utf8"),
  }));
}

/** What a route must never contain: the hash function, or the link table under either name. */
const HASH_OR_LINK_TABLE = /computeEventContentHash|eventSyncLinks|event_sync_links/;

/** A write to `events`, spelled the way Drizzle spells it; space inside the parentheses is fine. */
const EVENTS_WRITE = /(?:insert|update|delete)\(\s*events\s*\)/;

/** The paths of the files whose text matches `pattern`, minus any in `allowed`. */
function offenders(
  files: readonly SourceFile[],
  pattern: RegExp,
  allowed: readonly string[] = [],
): string[] {
  return files
    .filter((file) => !allowed.includes(file.path) && pattern.test(file.text))
    .map((file) => file.path);
}

function planted(text: string): SourceFile[] {
  return [{ path: "src/worker/routes/planted.ts", text }];
}

describe("the detectors flag a planted violation and leave a legitimate lookalike alone", () => {
  it.each([
    ["a call to the hash function", "const hash = await computeEventContentHash(fields);"],
    ["an import of the link table", 'import { eventSyncLinks } from "../db/schema";'],
    ["the link table's SQL name", "await env.DB.prepare('SELECT * FROM event_sync_links').all();"],
  ])("HASH_OR_LINK_TABLE flags %s", (_label, text) => {
    expect(offenders(planted(text), HASH_OR_LINK_TABLE)).toEqual(["src/worker/routes/planted.ts"]);
  });

  it.each([
    ["the repository's link reader", "const linkRows = await listAllEventSyncLinks(db);"],
    ["the link mapper", "eventLinks: linkRows.map(toEventSyncLinkDto),"],
    ["the Event mapper", "events: eventRows.map(toEventDto),"],
  ])("HASH_OR_LINK_TABLE leaves %s alone", (_label, text) => {
    expect(offenders(planted(text), HASH_OR_LINK_TABLE)).toEqual([]);
  });

  it.each([
    ["an insert", "await db.insert(events).values(row);"],
    ["an update", "await db.update(events).set({ title }).where(eq(events.id, id));"],
    ["a delete", "await db.delete(events);"],
    ["an insert with space inside the parentheses", "await db.insert( events ).values(row);"],
  ])("EVENTS_WRITE flags %s", (_label, text) => {
    expect(offenders(planted(text), EVENTS_WRITE)).toEqual(["src/worker/routes/planted.ts"]);
  });

  it.each([
    ["a read", "const rows = await db.select().from(events);"],
    ["a write to another table", "await db.insert(eventSyncLinks).values(link);"],
    ["a table whose name merely starts the same", "await db.insert(eventsArchive).values(row);"],
    ["a repository call", "const gone = await deleteEvent(db, id);"],
    ["a Hono delete route", 'eventRoutes.delete("/:id", async (c) => c.body(null, 204));'],
  ])("EVENTS_WRITE leaves %s alone", (_label, text) => {
    expect(offenders(planted(text), EVENTS_WRITE)).toEqual([]);
  });

  it("exempts only the file it is told to exempt", () => {
    const files = [
      { path: REPOSITORY, text: "db.insert(events)" },
      { path: "src/worker/other.ts", text: "db.insert(events)" },
    ];

    expect(offenders(files, EVENTS_WRITE, [REPOSITORY])).toEqual(["src/worker/other.ts"]);
  });
});

describe("AC-16 — one writer, and no route computes the hash or touches the link table", () => {
  const routeFiles = load(ROUTES_DIR);
  const srcFiles = load("src");

  it("has the repository and the events router to inspect (guards against a vacuous pass)", () => {
    expect(existsSync(REPOSITORY)).toBe(true);
    expect(existsSync(EVENTS_ROUTER)).toBe(true);
    expect(routeFiles.map((file) => file.path)).toContain(EVENTS_ROUTER);
  });

  it("has the repository compute the hash and write events itself", () => {
    const text = existsSync(REPOSITORY) ? readFileSync(REPOSITORY, "utf8") : "";

    expect(text).toContain("computeEventContentHash(");
    expect(EVENTS_WRITE.test(text)).toBe(true);
  });

  it("finds no route that computes the hash or references the link table", () => {
    expect(offenders(routeFiles, HASH_OR_LINK_TABLE)).toEqual([]);
  });

  it("finds no file outside the repository that inserts, updates or deletes events", () => {
    expect(offenders(srcFiles, EVENTS_WRITE, [REPOSITORY])).toEqual([]);
  });
});

/** The table rows of the Implemented section of docs/api-reference.md. */
function implementedRows(): string[] {
  const text = readFileSync(API_REFERENCE, "utf8");
  const start = text.indexOf("## Implemented");
  const end = text.indexOf("\n## ", start + 1);
  return text
    .slice(start, end === -1 ? undefined : end)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|"));
}

describe("AC-34 (the docs/api-reference.md part) — the Events surface is documented", () => {
  const EVENT_ROWS: Array<[string, RegExp]> = [
    ["POST /api/events", /^\|\s*POST\s*\|\s*`\/api\/events`\s*\|/],
    [
      "GET /api/events with a from/to range",
      /^\|\s*GET\s*\|\s*`\/api\/events\?[^`]*from=[^`]*to=[^`]*`\s*\|/,
    ],
    ["PATCH /api/events/:id", /^\|\s*PATCH\s*\|\s*`\/api\/events\/:id`\s*\|/],
    ["DELETE /api/events/:id", /^\|\s*DELETE\s*\|\s*`\/api\/events\/:id`\s*\|/],
  ];

  it.each(EVENT_ROWS)("has an Implemented row for %s", (_label, pattern) => {
    expect(implementedRows().some((row) => pattern.test(row))).toBe(true);
  });

  it("documents the search parameter on the Events list row", () => {
    const row = implementedRows().find((line) => /^\|\s*GET\s*\|\s*`\/api\/events/.test(line));

    expect(row).toBeDefined();
    expect(row).toContain("q=");
  });

  it("documents the source guard: a 409 on an Events row", () => {
    const eventRows = implementedRows().filter((line) => line.includes("/api/events"));

    expect(eventRows.some((line) => line.includes("409"))).toBe(true);
  });

  it("documents the from/to window of GET /api/google/events", () => {
    const googleRow = implementedRows().find((line) =>
      /\/api\/google\/events\?[^`]*from=[^`]*to=/.test(line),
    );

    expect(googleRow).toBeDefined();
  });
});
