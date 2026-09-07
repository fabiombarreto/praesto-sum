#!/usr/bin/env node
/**
 * Guards what `tsc -b` cannot: that the dev-only bearer token injected by
 * `vite.config.ts`'s `devApiToken()` never reaches a shipped bundle.
 *
 * Chore C17 (2026-09-05) removed the local TokenGate re-typing step by handing
 * the client the token `.dev.vars` already holds, under `import.meta.env.DEV`.
 * Two guards make that safe by construction — the define is null outside
 * `mode === "development"`, and the consuming branch is tree-shaken from a
 * production build. This script is the third, and the only one that inspects
 * the artifact rather than the intent.
 *
 * It exists because the failure mode is silent and severe: a token in a
 * publicly served bundle is readable by anyone who opens devtools, and chore
 * C10 already fired once in this project because the token leaked through an
 * ordinary channel — a screenshot.
 *
 * ## Two directories, two rules — and why the distinction is the whole point
 *
 * `vite build` emits two trees, and they have completely different exposure:
 *
 *   - `dist/client/` is uploaded as static assets and served to anyone. A token
 *     here is a public disclosure. **Every file is scanned, with no extension
 *     filter**, because a filter is exactly how the one file that matters gets
 *     missed (see below).
 *
 *   - `dist/praesto/` is the Worker build. The Cloudflare Vite plugin copies
 *     `.dev.vars` into it so `wrangler dev` can run against the built output;
 *     that copy DOES contain the token. This predates chore C17 and is not
 *     caused by it. It is allow-listed by exact path — never skipped silently —
 *     so that any OTHER file in that tree carrying the token still fails.
 *
 * An earlier version of this script filtered by extension (`.js`, `.json`, …).
 * `.dev.vars` matched none of them, so the single file in `dist/` that actually
 * held the token was the one file the guard could not see. That is recorded
 * here rather than quietly fixed, because it is the mistake most likely to be
 * reintroduced by someone "optimising" the walk.
 *
 * Wired into `npm run build`, so every build — including the `--dry-run` the
 * plans use at Validation Level 3 — proves itself.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = "dist";
const PUBLIC_DIR = join(DIST, "client");
const PLACEHOLDER = "__DEV_API_TOKEN__";

/** Known local-only artifacts that legitimately carry the token. Exact paths. */
const ALLOWED = new Set([join(DIST, "praesto", ".dev.vars")]);

function readDevToken() {
  try {
    const raw = readFileSync(".dev.vars", "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.trimStart().startsWith("API_BEARER_TOKEN"));
    if (!line) return null;
    const value = line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']/, "")
      .replace(/["']$/, "");
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isBinary(buf) {
  // A NUL byte in the first 8 KiB is the usual heuristic; fonts and images hit
  // it immediately and are skipped rather than decoded.
  return buf.subarray(0, 8192).includes(0);
}

try {
  statSync(DIST);
} catch {
  console.error(
    `check-dev-token-absent: no ${DIST}/ to scan. This script runs AFTER a build; ` +
      "if you invoked it directly, run `npx vite build` first.",
  );
  process.exit(1);
}

const devToken = readDevToken();
const offenders = [];
const allowedSeen = [];
let scanned = 0;

for (const file of walk(DIST)) {
  const buf = readFileSync(file);
  if (isBinary(buf)) continue;
  scanned += 1;
  const text = buf.toString("utf8");
  const rel = relative(".", file);
  const hasToken = devToken !== null && text.includes(devToken);
  const hasPlaceholder = text.includes(PLACEHOLDER);
  if (!hasToken && !hasPlaceholder) continue;

  const inPublic = rel.startsWith(PUBLIC_DIR + sep);
  if (ALLOWED.has(rel) && !inPublic && !hasPlaceholder) {
    allowedSeen.push(rel);
    continue;
  }
  offenders.push(
    `${rel}: ${hasToken ? "contains the literal .dev.vars API_BEARER_TOKEN value" : ""}` +
      `${hasToken && hasPlaceholder ? " and " : ""}` +
      `${hasPlaceholder ? `contains the ${PLACEHOLDER} placeholder` : ""}` +
      `${inPublic ? "  [PUBLICLY SERVED]" : ""}`,
  );
}

if (offenders.length > 0) {
  console.error("check-dev-token-absent: FAIL — the dev token reached the build output.");
  for (const o of offenders) console.error(`  - ${o}`);
  console.error(
    "\nDo not deploy this bundle. `define.__DEV_API_TOKEN__` in vite.config.ts must stay null " +
      "outside mode === 'development', and main.tsx's use of it must stay behind " +
      "import.meta.env.DEV.",
  );
  process.exit(1);
}

const note = devToken
  ? ""
  : " (no API_BEARER_TOKEN in .dev.vars on this machine, so only the placeholder was checked)";
console.log(
  `check-dev-token-absent: PASS — ${scanned} text files scanned under ${DIST}/, ` +
    `nothing in ${PUBLIC_DIR}/ carries the token or the placeholder${note}.`,
);
if (allowedSeen.length > 0) {
  console.log(
    `  allow-listed local-only artifact(s), not deployed as public assets: ${allowedSeen.join(", ")}`,
  );
}
