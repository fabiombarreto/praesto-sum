/**
 * Downloads Praesto's two self-hosted fonts (ADR-0010) once, from the Google
 * Fonts CSS2 API and its gstatic-hosted files, plus their SIL Open Font
 * License texts — owner-authorized 2026-08-21. Zero dependencies (ADR-0005):
 * global `fetch`, `node:fs`, `node:path` only, like scripts/generate-icons.js.
 *
 * Run: node scripts/fetch-fonts.mjs
 *
 * Re-run only when the fonts are deliberately upgraded (a new weight, a new
 * subset, a version bump) — not on every install or every build. The CSS2
 * API's answer depends on the request's User-Agent: a generic client is
 * handed plain TTF with no `unicode-range`; a desktop Chrome UA is handed
 * one `@font-face` block per script subset in `woff2`, each carrying its own
 * `unicode-range` — that is the shape this script parses (verified
 * 2026-08-21). The `gstatic` file URLs are versioned and change whenever a
 * font is rebuilt upstream, so they are parsed out of the CSS2 response
 * rather than hard-coded.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "fonts");

const CSS2_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Unbounded:wght@800&display=optional";
// A desktop UA is the documented key: a generic client gets TTF with no
// `unicode-range` from this same URL.
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const FONTS = [
  { family: "Inter", outFile: "inter-latin-var.woff2" },
  { family: "Unbounded", outFile: "unbounded-latin-800.woff2" },
];

const OFL_FILES = [
  {
    outFile: "OFL-Inter.txt",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt",
  },
  {
    outFile: "OFL-Unbounded.txt",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/unbounded/OFL.txt",
  },
];

const MAX_TOTAL_BYTES = 102400;
const WOFF2_MAGIC = "wOF2";

async function fetchOrThrow(url) {
  const response = await fetch(url, { headers: { "User-Agent": CHROME_UA } });
  if (response.status !== 200) {
    throw new Error(`GET ${url} returned ${response.status}, expected 200`);
  }
  return response;
}

// Each response block is its own `/* <subset> */` comment immediately
// followed by exactly one `@font-face { ... }` rule (verified 2026-08-21) —
// so every subset/family pair is captured together in one regex pass. A
// family requested alongside another (Inter carries seven subsets, Unbounded
// fewer) means a family's OWN "latin" comment is not the only "latin" text
// in the response, and a naive split-then-search can pick up the nearest
// `src:`/`unicode-range:` from an unrelated block that merely mentions the
// right family name further down the same chunk — this scopes both the
// family check and the extraction to the SAME single block, every time.
const FONT_FACE_BLOCK = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;

/** The `latin`-subset `@font-face` block whose `font-family` is `family` — its `src` URL and `unicode-range`. */
function findLatinBlock(css, family) {
  for (const match of css.matchAll(FONT_FACE_BLOCK)) {
    const [, subset, body] = match;
    if (subset !== "latin" || body === undefined) continue;
    const familyMatch = /font-family:\s*'([^']+)'/.exec(body);
    if (familyMatch?.[1] !== family) continue;
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    if (url && unicodeRange) return { url, unicodeRange };
  }
  return null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const cssResponse = await fetchOrThrow(CSS2_URL);
  const css = await cssResponse.text();

  let total = 0;
  for (const { family, outFile } of FONTS) {
    const block = findLatinBlock(css, family);
    if (!block) {
      throw new Error(`No "/* latin */" @font-face block found for font-family '${family}'`);
    }
    const fontResponse = await fetchOrThrow(block.url);
    const bytes = Buffer.from(await fontResponse.arrayBuffer());
    const magic = bytes.subarray(0, 4).toString("ascii");
    if (magic !== WOFF2_MAGIC) {
      throw new Error(
        `${outFile}: expected WOFF2 magic bytes "wOF2", got ${JSON.stringify(magic)}`,
      );
    }
    writeFileSync(join(OUT_DIR, outFile), bytes);
    console.log(`${outFile.padEnd(28)} ${String(bytes.length).padStart(6)} bytes  <- ${block.url}`);
    console.log(`${"".padEnd(28)} latin unicode-range: ${block.unicodeRange}`);
    total += bytes.length;
  }

  console.log(`Total (both fonts): ${total} bytes`);
  if (total > MAX_TOTAL_BYTES) {
    throw new Error(
      `fonts total ${total} bytes exceeds the ${MAX_TOTAL_BYTES}-byte budget (guidelines §5.3)`,
    );
  }

  for (const { outFile, url } of OFL_FILES) {
    const response = await fetchOrThrow(url);
    const text = await response.text();
    writeFileSync(join(OUT_DIR, outFile), text);
    console.log(`${outFile.padEnd(28)} ${Buffer.byteLength(text)} bytes`);
  }

  console.log(
    `PASS: two WOFF2 files (${total} bytes together) and two OFL texts written to public/fonts/`,
  );
}

main().catch((err) => {
  console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
