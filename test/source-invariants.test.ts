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
 * Runs in the `docs` vitest project, in plain Node, because workerd has no
 * `node:fs` — the same reason `docs-consistency.test.ts` lives there.
 *
 * **This file has been wrong three times.** Each failure was found by planting
 * a violation and watching the check pass, never by reading it:
 *   1. Comment stripping ate the tail of every `https://` URL, so the check saw
 *      files with no Google endpoints at all.
 *   2. The non-GET rule compared method and URL per FILE, firing on
 *      `client.ts`, where the POSTs go to OAuth and only the GETs go to the
 *      Calendar API.
 *   3. Writing the file through a tool that mangled `\b` into a literal
 *      backspace left `/<BS>fetch\s*\(/`, which matches nothing — invisible on
 *      screen, and it made the check pass unconditionally.
 * A guard is worth exactly what its last deliberate failure proved.
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

/**
 * Every file's code with comments stripped — a comment cannot call an API.
 *
 * `//` only starts a comment when NOT preceded by `:`; otherwise this strips
 * the tail of every line holding an `https://` URL, which is precisely the
 * lines this suite exists to inspect.
 */
const CODE = sourceFiles().map((path) => ({
  path: path.replaceAll("\\", "/"),
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

    expect(CODE.filter((f) => forbidden.test(f.code)).map((f) => f.path)).toEqual([]);
  });

  it("issues no non-GET request to the Calendar API", () => {
    // Per CALL SITE, not per file. Co-location in a file says nothing: the
    // method and the URL have to belong to the same request to mean anything.
    const offenders: string[] = [];

    for (const file of CODE) {
      // A fresh regex per file — a /g regex carries lastIndex between uses.
      for (const match of file.code.matchAll(/\bfetch(?:Impl)?\s*\(/g)) {
        // A bounded window from the call site: long enough to hold a URL and
        // an init object, short enough not to swallow the next function.
        const call = file.code.slice(match.index, match.index + 500);
        const targetsCalendar = /googleapis\.com\/calendar|\bCALENDAR_API\b/.test(call);
        const nonGet = /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/.test(call);
        if (targetsCalendar && nonGet) offenders.push(`${file.path}@${match.index}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("requests no write-capable Google scope", () => {
    // `calendar.events` WITHOUT `.readonly` is the write scope. Checking only
    // that the two readonly strings are present would pass on a set that also
    // contained the write one, so the readonly ones are removed first and
    // whatever `auth/calendar...` remains is by definition write-capable.
    const offenders = CODE.filter((f) =>
      /auth\/calendar(?:\.events)?["'\s]/.test(
        f.code.replace(/auth\/calendar[a-z.]*\.readonly/g, ""),
      ),
    ).map((f) => f.path);

    expect(offenders).toEqual([]);
  });
});
