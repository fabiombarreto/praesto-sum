/**
 * Structural invariants over the source tree (unit 4 phase 3).
 *
 * Supports PRD **AC-13** — "read-only is enforced by construction". Asserting
 * `method === "GET"` on `listEvents` proves that `listEvents` is a read; it
 * says nothing about whether an `events.insert` exists three files away, so
 * something has to read the whole tree.
 *
 * **What this suite does NOT do, stated plainly so nobody trusts it further
 * than it reaches.** It is a TRIPWIRE against the ACCIDENTAL introduction of a
 * write, not a proof that none can exist. It matches literal `fetch(` /
 * `fetchImpl(` call tokens, a literal quoted `method:` string, and a window of
 * 500 characters from the call. A determined evasion defeats it: a `new
 * Request()` handed to `fetch`, a renamed import, a wrapper helper, a method
 * held in a variable, or a URL far from its init object. Arbitration on
 * 2026-08-28 ruled that a regex-only check CANNOT be made sound against those
 * — they need data-flow tracing a regex has no model of — and that widening
 * the window or piling on literal patterns would repeat the earlier rounds'
 * mistake. The honest stronger options, if this ever has to be a proof rather
 * than a tripwire: an AST-based check, or a single injected-fetch chokepoint
 * enforced at the type level so no Google call can be written outside it.
 *
 * Runs in the `docs` vitest project, in plain Node, because workerd has no
 * `node:fs` — the same reason `docs-consistency.test.ts` lives there.
 *
 * **This file has been wrong four times**, and the fourth is why the claim
 * above is now narrowed rather than widened again. Each failure was found by planting
 * a violation and watching the check pass, never by reading it:
 *   1. Comment stripping ate the tail of every `https://` URL, so the check saw
 *      files with no Google endpoints at all.
 *   2. The non-GET rule compared method and URL per FILE, firing on
 *      `client.ts`, where the POSTs go to OAuth and only the GETs go to the
 *      Calendar API.
 *   3. Writing the file through a tool that mangled `\b` into a literal
 *      backspace left `/<BS>fetch\s*\(/`, which matches nothing — invisible on
 *      screen, and it made the check pass unconditionally.
 *   4. Review then named four evasions the repaired version still misses,
 *      which is what settled the question: the check is sound for the shapes
 *      it names and unsound as a universal claim, so the docstring says so
 *      instead of the regex pretending otherwise.
 *
 * A guard is worth exactly what its last deliberate failure proved. This one
 * is verified against three planted violations and one legitimate lookalike;
 * that is its whole warranty.
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

describe("AC-13 tripwire — no ACCIDENTAL write reaches the Calendar API", () => {
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
