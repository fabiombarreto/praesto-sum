/**
 * `Content-Disposition` filename extraction, shared by both compile targets.
 *
 * Scoped deliberately to what this project's own two export routes emit
 * (`src/worker/routes/export.ts`, `src/worker/routes/export-ics.ts`): a
 * simple quoted-ASCII `filename="..."`, with `filename*=UTF-8''...` (RFC
 * 6266) supported as defensive-but-untested-against-a-real-server-emission
 * robustness. This is not a general-purpose, published parsing library.
 *
 * This module carries no imports so it stays usable from the browser bundle
 * and the Worker alike, matching the constraint stated at the top of
 * `src/shared/api.ts` — and, like `src/shared/dates.ts`, reads no clock and
 * touches no DOM or Worker globals.
 */

/**
 * Reduces a raw extracted filename value to a safe last path segment.
 *
 * RFC 6266 warns implementers not to trust the `filename` parameter as a
 * literal path: splits on both `/` and `\` (a header could arrive with
 * either separator regardless of the server's own OS) and keeps only the
 * last segment, trimmed. Returns `null` for an empty, `"."` or `".."`
 * result rather than ever handing back an unsanitized value.
 */
function sanitizeFilename(value: string): string | null {
  const segments = value.split(/[/\\]/);
  const last = segments[segments.length - 1]?.trim() ?? "";
  if (last === "" || last === "." || last === "..") return null;
  return last;
}

const EXTENDED_FILENAME_RE = /filename\*\s*=\s*UTF-8''([^;]+)/i;
const QUOTED_FILENAME_RE = /filename\s*=\s*"([^"]*)"/i;
const UNQUOTED_FILENAME_RE = /filename\s*=\s*([^;]+)/i;

/**
 * Extracts the RFC 6266 `filename*` (preferred, percent-decoded) or
 * `filename` parameter from a raw `Content-Disposition` header value,
 * sanitized to its last path segment. Returns `null` when the header is
 * absent, carries no filename parameter of any form, or sanitizes down to
 * an empty/`.`/`..` result.
 */
export function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (header === null) return null;

  const extended = EXTENDED_FILENAME_RE.exec(header);
  const extendedValue = extended?.[1];
  if (extendedValue !== undefined) {
    try {
      const decoded = decodeURIComponent(extendedValue.trim());
      return sanitizeFilename(decoded);
    } catch {
      // Malformed percent-encoding — fall through to the plain forms below
      // rather than throwing or giving up on a usable plain filename.
    }
  }

  const quoted = QUOTED_FILENAME_RE.exec(header);
  const quotedValue = quoted?.[1];
  if (quotedValue !== undefined) {
    return sanitizeFilename(quotedValue);
  }

  const unquoted = UNQUOTED_FILENAME_RE.exec(header);
  const unquotedValue = unquoted?.[1];
  if (unquotedValue !== undefined) {
    return sanitizeFilename(unquotedValue.trim());
  }

  return null;
}

/**
 * The browser save-dialog filename for an export download.
 *
 * Returns the parsed filename when the header yields one, so the save
 * dialog always matches the Worker's dated name (`praesto-<date>.<ext>`)
 * rather than a second, independently-computed client-side convention.
 *
 * When the header is missing or unparseable, returns the fallback
 * `praesto-export.<ext>` — the ONLY place this literal is defined anywhere
 * in the codebase. The fallback is deliberately UNDATED, unlike every real
 * name the Worker emits: a server-side `Content-Disposition` regression
 * then produces a visually distinct, obviously-wrong filename instead of
 * quietly blending in as a plausible dated one.
 */
export function exportFilename(header: string | null, kind: "json" | "ics"): string {
  const parsed = parseFilenameFromContentDisposition(header);
  return parsed ?? `praesto-export.${kind}`;
}
