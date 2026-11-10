// PRPs/prds/events-and-day-view.prd.md AC-33 Invariants (the mirror-inventory clause:
// `scripts/check-mirror-inventory.mjs` passes)
//
// Source plan: PRPs/plans/events-and-day-view-phase-5-close-out.plan.md (AC-A1; Task 1 and the
// Notes entries "test/mirror-inventory.test.ts" and "Why the mirror-inventory script is
// extended rather than the two lines rewritten").
//
// WHAT IS UNDER TEST. The ADR-0007 tripwire keeps Google's `attendees`, `reminders` and
// `recurrence` out of Praesto. It is positional, not textual: the three fields may be read in
// one file only, the Google mapper, and there only as a presence test. The script was written
// for `CalendarEventDto` and wired into nothing, so it was never run against Praesto's OWN
// Reminder entity (unit 7), and it has failed on `main` since on exactly two lines that read
// that entity: `return body.reminders;` in `src/app/api.ts` and `reminders: tables.reminders,`
// in `src/shared/export.ts`. The plan fixes the script by pinning those two lines (a file AND
// the whole trimmed line), never by a pattern, a directory or a field name.
//
// HOW IT IS TESTED. The script is run for real (`node scripts/check-mirror-inventory.mjs`) with
// a planted tree as its working directory (it walks `src` relative to its cwd) and then against
// the real repository, so `npm test` runs the tripwire on every run — that is the permanent
// guard that stops the script rotting unwired again. The cases observe only the exit status and
// the text the script prints; nothing here reads or imitates the script's source.
//
// RED TODAY, AND WHY. Ten cases fail before the Implementer's change, all for one reason: the
// two pinned lines are still refused (exit 1), so every case that expects them to pass (alone,
// indented, together, in CRLF files, followed by a comment, as the real repository holds them)
// or expects only the unpinned neighbour to be named fails. Every other case describes
// behaviour the shipped
// script already has (a read outside the mapper is refused, a comment cannot disarm it, the
// mapper's presence test is the one sanctioned shape). Those pass today and exist so that the
// exemption cannot be written too loosely: each of them fails the day an exemption is by file
// only, by line only, by suffix, by field name or by directory.
//
// WHAT THIS CANNOT PROVE. It cannot prove no Google read is spelled exactly like a pinned line
// inside the pinned file (the residual risk the plan records in `phase-5/invariants.md`; it is
// unreachable because `CalendarEventDto` has no such field), and it says nothing about the
// destructuring shape `const { reminders } = x` that the script's regex cannot see in any file.
//
// Runs in the `docs` vitest project (plain Node: it needs `node:child_process` and `node:fs`,
// which workerd lacks). It is registered in that project's `include` AND in the `worker`
// project's `exclude` in vitest.config.ts; one without the other makes the workerd copy fail to
// load with a file-level error whose tests never even get counted.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/** The project's cwd: the other `docs` suites read `src/` and `docs/` relative to it too. */
const REPOSITORY_ROOT = process.cwd();
const SCRIPT = resolve(REPOSITORY_ROOT, "scripts", "check-mirror-inventory.mjs");

const MAPPER = "src/shared/google-events.ts";
const OWN_API = "src/app/api.ts";
const OWN_EXPORT = "src/shared/export.ts";

/** The two lines of Praesto's own Reminder entity, exactly as they stand in the shipped files. */
const API_LINE = "return body.reminders;";
const EXPORT_LINE = "reminders: tables.reminders,";

const PASS_MESSAGE = "PASS: mirror inventory closed";

interface Outcome {
  status: number | null;
  output: string;
}

/** Runs the real script with `cwd` as its working directory. */
function runScript(cwd: string): Outcome {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

const plantedTrees: string[] = [];

/** A fresh temporary tree holding `src/` and the given files (paths relative, `/`-separated). */
function plantTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "mirror-inventory-"));
  plantedTrees.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, ...path.split("/"));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

function runOn(files: Record<string, string>): Outcome {
  return runScript(plantTree(files));
}

afterAll(() => {
  for (const root of plantedTrees) rmSync(root, { recursive: true, force: true });
});

function expectClosed(outcome: Outcome): void {
  expect(outcome.output).toContain(PASS_MESSAGE);
  expect(outcome.status, outcome.output).toBe(0);
}

function expectRefused(outcome: Outcome): void {
  expect(outcome.status, outcome.output).toBe(1);
  expect(outcome.output).not.toContain(PASS_MESSAGE);
}

describe("mirror inventory — what the tripwire has always refused", () => {
  it("passes a tree that reads none of the three fields", () => {
    expectClosed(runOn({ "src/app/ok.ts": "export const total = 1;\n" }));
  });

  it.each([
    ["reminders", "const r = raw.reminders;"],
    ["recurrence", "const rule = raw.recurrence;"],
    ["attendees", "const guests = raw.attendees;"],
  ])("refuses a read of %s outside the mapper", (_field, line) => {
    expectRefused(runOn({ "src/app/foo.ts": `${line}\n` }));
  });

  it("lets the mapper test attendees for presence, the one sanctioned shape", () => {
    expectClosed(runOn({ [MAPPER]: "if (Array.isArray(raw.attendees)) {}\n" }));
  });

  it("refuses the very same presence test outside the mapper (the rule is positional)", () => {
    expectRefused(runOn({ "src/app/other.ts": "if (Array.isArray(raw.attendees)) {}\n" }));
  });

  it("refuses the mapper binding the value even behind a hasGuests comment, and names file and line", () => {
    const outcome = runOn({
      [MAPPER]:
        "export function map(raw: Raw) {\n  const ok = true;\n  const leaked = raw.attendees; // hasGuests\n}\n",
    });

    expectRefused(outcome);
    expect(outcome.output).toContain(`${MAPPER}:3:`);
  });

  it.each([
    ["a line comment", "// body.reminders\n"],
    ["a trailing line comment", "const total = 1; // raw.attendees\n"],
    ["an inline block comment", "const total = 1; /* raw.recurrence */\n"],
  ])("lets %s mention a field", (_label, text) => {
    expectClosed(runOn({ "src/app/commented.ts": text }));
  });

  it("still sees a read that follows an https:// URL on the same line", () => {
    expectRefused(
      runOn({
        "src/app/url.ts": 'const url = "https://example.test/a"; const guests = raw.attendees;\n',
      }),
    );
  });

  it("scans .tsx files as well as .ts files", () => {
    expectRefused(
      runOn({ "src/app/View.tsx": "export const View = () => <p>{raw.reminders}</p>;\n" }),
    );
  });
});

describe("mirror inventory — Praesto's own Reminder entity: exactly two pinned lines", () => {
  const PINNED: Array<[string, string, string]> = [
    ["the Reminder list wrapper", OWN_API, API_LINE],
    ["the export envelope key", OWN_EXPORT, EXPORT_LINE],
  ];

  it.each(PINNED)("passes %s as the only content of its file", (_label, path, line) => {
    expectClosed(runOn({ [path]: `${line}\n` }));
  });

  it.each(PINNED)("passes %s indented inside a block", (_label, path, line) => {
    expectClosed(runOn({ [path]: `export function f() {\n  if (ready) {\n    ${line}\n  }\n}\n` }));
  });

  it("passes both pinned lines together, the way the real repository holds them", () => {
    expectClosed(runOn({ [OWN_API]: `${API_LINE}\n`, [OWN_EXPORT]: `${EXPORT_LINE}\n` }));
  });

  it("passes the pinned lines in files with CRLF line endings", () => {
    expectClosed(
      runOn({
        [OWN_API]: `export function f() {\r\n  ${API_LINE}\r\n}\r\n`,
        [OWN_EXPORT]: `export const e = {\r\n  ${EXPORT_LINE}\r\n};\r\n`,
      }),
    );
  });

  it.each([
    ["a line comment", "// Praesto's own entity"],
    ["a block comment", "/* Praesto's own entity */"],
  ])("passes both pinned lines when %s follows them (comments are stripped first)", (_label, c) => {
    expectClosed(
      runOn({
        [OWN_API]: `export function f() {\n  ${API_LINE} ${c}\n}\n`,
        [OWN_EXPORT]: `export const e = {\n  ${EXPORT_LINE} ${c}\n};\n`,
      }),
    );
  });

  it.each([
    ["the wrapper line in another file of src/app", "src/app/other.ts", API_LINE],
    ["the wrapper line in the export module", OWN_EXPORT, API_LINE],
    ["the wrapper line in a worker file of the same name", "src/worker/api.ts", API_LINE],
    [
      "the wrapper line in a path that only ends the same way",
      "src/vendor/src/app/api.ts",
      API_LINE,
    ],
    ["the export key in another file of src/app", "src/app/other.ts", EXPORT_LINE],
    ["the export key in the api wrapper", OWN_API, EXPORT_LINE],
    ["the export key in a worker file of the same name", "src/worker/export.ts", EXPORT_LINE],
    [
      "the export key in a path that only ends the same way",
      "src/vendor/src/shared/export.ts",
      EXPORT_LINE,
    ],
  ])("refuses %s", (_label, path, line) => {
    const outcome = runOn({ [path]: `${line}\n` });

    expectRefused(outcome);
    expect(outcome.output).toContain(`${path}:1:`);
  });

  it.each([
    ["a binding of reminders", OWN_API, "const reminders = body.reminders;"],
    ["a call on reminders", OWN_API, "return body.reminders.slice();"],
    ["a read of attendees", OWN_API, "return body.attendees;"],
    ["a read of recurrence", OWN_API, "return body.recurrence;"],
    [
      "the wrapper line with a second read after it",
      OWN_API,
      `${API_LINE} const g = raw.attendees;`,
    ],
    [
      "the wrapper line with a read before it on the same line",
      OWN_API,
      `const g = body.attendees; ${API_LINE}`,
    ],
    [
      "the export key with an attendees key before it",
      OWN_EXPORT,
      `attendees: tables.attendees, ${EXPORT_LINE}`,
    ],
    ["another read of reminders", OWN_EXPORT, "return tables.reminders;"],
    [
      "the export key beside a recurrence key",
      OWN_EXPORT,
      `${EXPORT_LINE} recurrence: t.recurrence,`,
    ],
    ["a recurrence key", OWN_EXPORT, "recurrence: tables.recurrence,"],
    ["an attendees key", OWN_EXPORT, "attendees: tables.attendees,"],
  ])("refuses %s inside a file that holds a pinned line", (_label, path, line) => {
    expectRefused(runOn({ [path]: `${line}\n` }));
  });

  it("flags only the unpinned read when a pinned line sits beside it", () => {
    const outcome = runOn({
      [OWN_API]: `export function a() {\n  ${API_LINE}\n}\nconst r = body.reminders;\n`,
    });

    expectRefused(outcome);
    expect(outcome.output).toContain(`${OWN_API}:4:`);
    expect(outcome.output).not.toContain(`${OWN_API}:2:`);
  });
});

describe("mirror inventory — the real repository", () => {
  it("still holds the two lines the exemption pins, so the exemption is not dead", () => {
    const hasLine = (path: string, wanted: string): boolean =>
      readFileSync(join(REPOSITORY_ROOT, path), "utf8")
        .split(/\r?\n/)
        .some((line) => line.trim() === wanted);

    expect(existsSync(join(REPOSITORY_ROOT, MAPPER))).toBe(true);
    expect(hasLine(OWN_API, API_LINE)).toBe(true);
    expect(hasLine(OWN_EXPORT, EXPORT_LINE)).toBe(true);
  });

  it("reports the mirror inventory closed", () => {
    expectClosed(runScript(REPOSITORY_ROOT));
  });
});
