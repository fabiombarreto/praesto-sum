/**
 * Structural invariants over the source tree (unit 4 phase 3).
 *
 * Covers PRD **AC-13** — "read-only is enforced by construction" — which is a
 * UNIVERSAL NEGATIVE and therefore not expressible as a unit test over the
 * calls a suite happens to construct. Asserting `method === "GET"` on
 * `listEvents` proves that `listEvents` is a read; it says nothing about
 * whether an `events.insert` exists three files away. The claim is about the
 * whole codebase, so the test has to read the whole codebase.
 *
 * This runs in the `docs` vitest project, in plain Node, because workerd has
 * no `node:fs` — the same reason `docs-consistency.test.ts` lives there.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir = "src"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

/** Every file's code with comments stripped — a comment cannot call an API. */
const CODE = sourceFiles().map((path) => ({
  path: path.replaceAll("\\", "/"),
  // `//` only starts a comment when NOT preceded by `:`. Without that guard
  // this strips the tail of every line holding an `https://` URL — which is
  // precisely the lines this suite exists to inspect. Found on 2026-08-28 by
  // planting a deliberate violation and watching the check pass anyway.
  code: readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1"),
}));

describe("AC-13 — read-only by construction", () => {
  it("contains no Calendar mutation call anywhere in src/", () => {
    // The Calendar API's write surface. Unit 15 introduces these deliberately,
    // behind a re-consent to a scope this unit does not hold; until then their
    // presence would mean the read-only claim is false.
    const forbidden =
      /\bevents\.(insert|update|patch|delete|move|import)\b|\bcalendars\.(insert|update|patch|delete|clear)\b|\bacl\.(insert|update|patch|delete)\b/;
    const offenders = CODE.filter((f) => forbidden.test(f.code)).map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  it("issues no non-GET request to the Calendar API", () => {
    // The two legitimate non-GET calls in the whole unit target the OAuth
    // endpoints (token exchange, revoke), never googleapis.com/calendar.
    const offenders = CODE.filter((f) => {
      if (!/googleapis\.com\/calendar/.test(f.code)) return false;
      return /method:\s*["'](POST|PUT|PATCH|DELETE)["']/.test(f.code);
    }).map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  it("requests no write-capable Google scope", () => {
    // `calendar.events` WITHOUT `.readonly` is the write scope. A test that
    // only checked for the two readonly strings would pass on a set that also
    // contained the write one.
    const offenders = CODE.filter((f) =>
      /auth\/calendar(\.events)?["'\s]/.test(
        f.code.replace(/auth\/calendar[a-z.]*\.readonly/g, ""),
      ),
    ).map((f) => f.path);

    expect(offenders).toEqual([]);
  });
});
