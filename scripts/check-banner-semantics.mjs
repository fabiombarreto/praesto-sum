/**
 * Guards what `tsc -b` cannot (unit 4 phase 4, Task 3).
 *
 * The Banner gains an optional icon prop so a Google outage stops rendering a
 * wifi-off glyph. Everything else about it must survive: `role="status"`, the
 * decorative `aria-hidden` on the icon, and a doc comment that stops claiming
 * the component serves only the offline condition.
 *
 * `tsc -b` proves none of that — JSX attribute VALUES are not typechecked and
 * comments are not typechecked at all, so a change that silently dropped
 * `role="status"` would have compiled clean. Review raised exactly this.
 */
import { readFileSync } from "node:fs";

const FILE = "src/app/components/ui/Banner.tsx";
const source = readFileSync(FILE, "utf8");

const required = [
  ['role="status"', /role="status"/],
  ["aria-hidden on the icon", /aria-hidden="true"/],
  ["an optional icon prop", /icon\s*\?\s*:/],
  ["a doc comment that no longer describes only the offline case", /Google|two condition/i],
];

const missing = required.filter(([, pattern]) => !pattern.test(source)).map(([name]) => name);

if (missing.length > 0) {
  console.error(`FAIL: ${FILE} is missing — ${missing.join("; ")}`);
  process.exit(1);
}
console.log("PASS: Banner kept its semantics and gained the icon prop");
