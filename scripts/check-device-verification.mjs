/**
 * Guards a manual task (unit 4 phase 4, Task 8).
 *
 * Task 8's work is entirely manual — a device pass on two machines plus the
 * guidelines' review checklist. `npm test` would report PASS even if none of
 * it happened, which review named plainly: a VALIDATE that cannot fail for the
 * reason its task exists is decoration.
 *
 * This cannot prove the owner looked at anything; nothing can. What it can do
 * is fail when nobody wrote down that he did, and fail when the record skips a
 * condition — including the two AC-A8 conditions that cannot be staged on a
 * device on demand, which are the ones most likely to be quietly dropped.
 */
import { existsSync, readFileSync } from "node:fs";

const RECORD = "PRPs/reports/google-calendar-read/phase-4/device-verification.md";

if (!existsSync(RECORD)) {
  console.error(`FAIL: no device-verification record at ${RECORD}`);
  process.exit(1);
}

const text = readFileSync(RECORD, "utf8");

const required = [
  "Android",
  "Windows",
  "rede cortada",
  "token revogado",
  "sem eventos",
  "falha parcial",
];
const missing = required.filter((term) => !text.includes(term));

if (missing.length > 0) {
  console.error(`FAIL: the record does not mention — ${missing.join("; ")}`);
  process.exit(1);
}

if (!/[✔✘]/.test(text)) {
  console.error("FAIL: no review-checklist result pasted (expected ✔ / ✘ marks)");
  process.exit(1);
}

console.log("PASS: device-verification record present, both devices and all four conditions named");
