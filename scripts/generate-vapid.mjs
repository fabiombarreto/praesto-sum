#!/usr/bin/env node
/**
 * Chore C4 — generate the VAPID key pair and place it where it is needed.
 *
 * Writes the generated values DIRECTLY into the target files and prints only
 * metadata: lengths, prefixes, and which file was touched. The private key is
 * never echoed to stdout, so it does not enter a terminal scrollback, a
 * transcript, or a screenshot. That is not paranoia in this project: chore C10
 * fired on 2026-08-12 because the API token was exposed in a screenshot, which
 * is the cheapest and most ordinary way a secret escapes.
 *
 * VAPID_SUBJECT is NOT generated — it is a contact URL (`mailto:` or `https:`)
 * that push services may use to reach the sender, so it is a decision, not a
 * random value, and it is passed in rather than invented here.
 *
 * Usage:
 *   node scripts/generate-vapid.mjs --subject mailto:you@example.com
 *   node scripts/generate-vapid.mjs --subject ... --bulk-out <path.json>
 *
 * `--bulk-out` additionally writes a JSON file shaped for
 * `wrangler secret bulk <file>`. Point it OUTSIDE the repository, and delete it
 * once the secrets are uploaded.
 */
// web-push 3.6.7 is CommonJS, so its functions arrive on the default export;
// a named import fails at module-instantiation time under ESM.
import webpush from "web-push";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const { generateVAPIDKeys } = webpush;

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const subject = argOf("--subject");
const bulkOut = argOf("--bulk-out");
const devVars = ".dev.vars";

if (!subject) {
  console.error("generate-vapid: --subject is required, e.g. --subject mailto:you@example.com");
  console.error("  It is a contact URL for push services, not a generated value.");
  process.exit(1);
}
if (!/^(mailto:|https:\/\/)/.test(subject)) {
  console.error(`generate-vapid: --subject must start with mailto: or https:// (got "${subject}")`);
  process.exit(1);
}

const keys = generateVAPIDKeys();
const values = {
  VAPID_SUBJECT: subject,
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
};

// --- .dev.vars: replace the three keys in place, leave every other line alone.
if (!existsSync(devVars)) {
  console.error(`generate-vapid: ${devVars} not found. Copy .dev.vars.example first.`);
  process.exit(1);
}
const lines = readFileSync(devVars, "utf8").split(/\r?\n/);
const seen = new Set();
const rewritten = lines.map((line) => {
  const match = /^([A-Z_]+)=/.exec(line);
  if (match && match[1] in values) {
    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  }
  return line;
});
for (const [key, value] of Object.entries(values)) {
  if (!seen.has(key)) rewritten.push(`${key}=${value}`);
}
writeFileSync(devVars, rewritten.join("\n"), "utf8");

console.log(`generate-vapid: wrote 3 keys into ${devVars} (gitignored)`);
console.log(`  VAPID_SUBJECT     ${subject}`);
console.log(
  `  VAPID_PUBLIC_KEY  ${keys.publicKey.length} chars, starts "${keys.publicKey.slice(0, 6)}..."`,
);
console.log(`  VAPID_PRIVATE_KEY ${keys.privateKey.length} chars — value deliberately not printed`);

if (bulkOut) {
  writeFileSync(bulkOut, JSON.stringify(values, null, 2) + "\n", "utf8");
  console.log(`\ngenerate-vapid: wrote ${bulkOut} for \`wrangler secret bulk\``);
  console.log("  Upload it, then DELETE it — it holds the private key in plain text:");
  console.log(`    npx wrangler secret bulk "${bulkOut}"`);
}
