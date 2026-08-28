/**
 * The ADR-0007 mirror-inventory tripwire (unit 4 `google-calendar-read`).
 *
 * Attendees, reminders and recurrence rules must never cross from Google into
 * Praesto: attendees are other people's PII and would reach the FR-042 export,
 * and Google's reminders would double every notification. `CalendarEventDto`
 * has no field that could hold them, so the boundary is closed by the shape of
 * a type — but a type can be widened, and this is the check for the day
 * someone does.
 *
 * Written as a script rather than a grep chain because the grep version was
 * defeatable: excluding every line containing the substring `hasGuests` meant
 * `const leaked = raw.attendees; // hasGuests` passed. A gate guarding PII must
 * not be disarmed by a comment. Verified 2026-08-28 that the grep version let
 * exactly that line through.
 *
 * The rule is positional, not textual:
 *   1. These fields may be READ in exactly one file — the mapper.
 *   2. Inside it, the only permitted read is the presence test behind
 *      `hasGuests`. Anything that binds, spreads or returns the value fails.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = /\.(attendees|reminders|recurrence)\b/;
const MAPPER = "src/shared/google-events.ts";
/** The one sanctioned shape: a presence test, never a binding. */
const PRESENCE_TEST =
  /Array\.isArray\(\s*\w+\.attendees\s*\)|\w+\.attendees\?\?\.length|\w+\.attendees\)\s*&&/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? walk(full)
      : full.endsWith(".ts") || full.endsWith(".tsx")
        ? [full]
        : [];
  });
}

const violations = [];
for (const file of walk("src")) {
  const rel = file.replaceAll("\\", "/");
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      // Comments cannot leak data, and are stripped BEFORE the test rather than
      // used to excuse the line — that inversion is the whole point.
      // `//` only starts a comment when it is not preceded by `:` — otherwise
      // this eats the rest of every line containing an https:// URL, which is
      // how the first version of this check silently saw a file with no Google
      // endpoints in it at all (found 2026-08-28 by deliberately planting a
      // violation and watching the check pass).
      const code = line.replace(/(^|[^:])\/\/.*$/, "$1").replace(/\/\*.*?\*\//g, "");
      if (!FORBIDDEN.test(code)) return;
      if (rel.endsWith(MAPPER) && PRESENCE_TEST.test(code)) return;
      violations.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
}

if (violations.length > 0) {
  console.error("FAIL: mirror-inventory fields read outside the sanctioned presence test:");
  violations.forEach((v) => console.error("  " + v));
  process.exit(1);
}
console.log("PASS: mirror inventory closed (attendees/reminders/recurrence unreachable)");
