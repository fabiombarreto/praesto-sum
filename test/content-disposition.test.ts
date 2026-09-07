// PRPs/prds/data-export.prd.md AC-9 one-tap-from-settings (the parser slice: plan AC-A5)
//
// Source plan: PRPs/plans/data-export-phase-3-the-button.plan.md
// (Task 1 — parseFilenameFromContentDisposition(header: string | null): string | null).
//
// Scope note (see PRPs/reports/data-export/test-suite-phase-3.diff for the full per-AC
// outcome record): `docs/context/methodology.md` keeps React component verification and
// browser-API glue manual, so this phase authors exactly ONE test-first target —
// `src/shared/content-disposition.ts`, the pure, DOM-free, import-free parser this file
// covers. `src/app/api.ts`'s `fetchExportFile` (the caller that applies a hardcoded
// `praesto-export.<ext>` fallback name when this parser returns `null`), `src/app/download.ts`
// and `DataExportCard.tsx` are exempt glue/presentation, verified on-device per Task 8 of the
// plan — this file does not and cannot assert on that downstream fallback string, only on the
// `null` signal this module emits to trigger it.
//
// This suite is written BEFORE the Implementer (`tdd: true`, test-first ordering per
// docs/context/methodology.md) — `src/shared/content-disposition.ts` does not exist yet, so
// this file is expected to fail to resolve its own import. That failure is the correct RED:
// once the Implementer creates the module per the plan's Task 1 spec, every case below must
// pass unmodified.

import { describe, expect, it } from "vitest";
import {
  exportFilename,
  parseFilenameFromContentDisposition,
} from "../src/shared/content-disposition";

describe("parseFilenameFromContentDisposition — plain filename= (PRD AC-9, plan AC-A5)", () => {
  it("extracts a quoted plain filename matching the exact shape src/worker/routes/export.ts emits", () => {
    // src/worker/routes/export.ts:57-63 — `attachment; filename="praesto-<date>.json"`.
    const header = 'attachment; filename="praesto-2026-09-05.json"';
    expect(parseFilenameFromContentDisposition(header)).toBe("praesto-2026-09-05.json");
  });

  it("extracts the .ics-flavored shape src/worker/routes/export-ics.ts emits", () => {
    const header = 'attachment; filename="praesto-2026-09-05.ics"';
    expect(parseFilenameFromContentDisposition(header)).toBe("praesto-2026-09-05.ics");
  });

  it("extracts an unquoted plain filename up to the next ; or end", () => {
    const header = "attachment; filename=praesto-2026-09-05.json; size=1024";
    expect(parseFilenameFromContentDisposition(header)).toBe("praesto-2026-09-05.json");
  });

  it("matches the filename= parameter key case-insensitively", () => {
    const header = 'attachment; FILENAME="Relatorio.json"';
    expect(parseFilenameFromContentDisposition(header)).toBe("Relatorio.json");
  });
});

describe("parseFilenameFromContentDisposition — filename* preference over filename (RFC 6266, plan AC-A5)", () => {
  it("prefers filename* over filename when both are present, returning the extended value", () => {
    // The whole point of the preference rule: if an implementation used whichever
    // parameter it found first (or the plain one), this would return the wrong,
    // stale-looking name instead of the extended one RFC 6266 says to prefer.
    const header =
      "attachment; filename=\"stale-fallback-name.json\"; filename*=UTF-8''praesto-2026-09-05.json";
    expect(parseFilenameFromContentDisposition(header)).toBe("praesto-2026-09-05.json");
  });

  it("prefers filename* over filename regardless of parameter order in the header", () => {
    const header =
      "attachment; filename*=UTF-8''praesto-2026-09-05.json; filename=\"stale-fallback-name.json\"";
    expect(parseFilenameFromContentDisposition(header)).toBe("praesto-2026-09-05.json");
  });

  it("percent-decodes a non-ASCII byte sequence in the extended form (pt-BR filenames are not exotic)", () => {
    // "relatório-2026-09-05.json" UTF-8 percent-encoded.
    const header = "attachment; filename*=UTF-8''relat%C3%B3rio-2026-09-05.json";
    expect(parseFilenameFromContentDisposition(header)).toBe("relatório-2026-09-05.json");
  });

  it("falls through to the plain form when the extended form's percent-decoding fails", () => {
    // decodeURIComponent throws on a malformed escape sequence (a lone "%" not
    // followed by two hex digits). The catch must fall through to the plain form
    // rather than propagating the exception or silently returning null when a
    // usable plain filename is right there.
    const header = "attachment; filename=\"fallback-name.json\"; filename*=UTF-8''%E0%A4%A";
    expect(parseFilenameFromContentDisposition(header)).toBe("fallback-name.json");
  });
});

describe("parseFilenameFromContentDisposition — path-traversal sanitization (security-relevant, plan AC-A5)", () => {
  it("reduces a Unix-style traversal prefix to its last path segment, stripping every '..' component", () => {
    const header = 'attachment; filename="../../etc/passwd"';
    // Asserted on the resulting value, not merely "did not throw": a wrong
    // implementation that returns the untouched string ("../../etc/passwd") or
    // returns null instead of stripping to the safe last segment would fail this.
    expect(parseFilenameFromContentDisposition(header)).toBe("passwd");
  });

  it("reduces a Windows-style backslash traversal prefix to its last path segment", () => {
    const header = 'attachment; filename="..\\..\\Windows\\evil.json"';
    expect(parseFilenameFromContentDisposition(header)).toBe("evil.json");
  });

  it("strips a leading absolute-path slash down to the last segment", () => {
    const header = 'attachment; filename="/etc/passwd"';
    expect(parseFilenameFromContentDisposition(header)).toBe("passwd");
  });

  it("rejects a bare '..' filename outright, returning null rather than the literal string", () => {
    const header = 'attachment; filename=".."';
    expect(parseFilenameFromContentDisposition(header)).toBeNull();
  });

  it("rejects a bare '.' filename outright, returning null rather than the literal string", () => {
    const header = 'attachment; filename="."';
    expect(parseFilenameFromContentDisposition(header)).toBeNull();
  });

  it("rejects a traversal value whose last segment is empty (trailing separator), returning null", () => {
    const header = 'attachment; filename="../"';
    expect(parseFilenameFromContentDisposition(header)).toBeNull();
  });

  it("rejects an empty quoted filename, returning null rather than an empty string", () => {
    const header = 'attachment; filename=""';
    expect(parseFilenameFromContentDisposition(header)).toBeNull();
  });

  it("sanitizes traversal in the preferred filename* form the same way as the plain form", () => {
    // The sanitizer must apply after extraction regardless of which of the two
    // forms supplied the raw value — a fix applied only to the plain-form branch
    // would leave this path exploitable.
    const header = "attachment; filename*=UTF-8''..%2F..%2Fetc%2Fpasswd";
    expect(parseFilenameFromContentDisposition(header)).toBe("passwd");
  });
});

describe("parseFilenameFromContentDisposition — missing or malformed header (defensive fallback trigger, plan AC-A5)", () => {
  it("returns null for a null header (no Content-Disposition sent at all)", () => {
    expect(parseFilenameFromContentDisposition(null)).toBeNull();
  });

  it("returns null when the header carries no filename parameter of any form", () => {
    const header = "attachment";
    expect(parseFilenameFromContentDisposition(header)).toBeNull();
  });

  it("returns null for a header naming an unrelated parameter only, never inventing a name", () => {
    // A wrong implementation might mistake `name="file"` for a filename source.
    // The returned value here would then equal "file" instead of null, which is
    // exactly the kind of visible-vs-hidden-fallback bug this case is designed to
    // catch: this null is what src/app/api.ts's fetchExportFile relies on to swap
    // in its own distinct, visibly-not-a-real-date fallback name
    // (`praesto-export.<ext>`) rather than silently using an unrelated parameter's
    // value as if it were a filename.
    const header = 'form-data; name="file"';
    expect(parseFilenameFromContentDisposition(header)).toBeNull();
  });

  it("does not throw on a garbled header with unbalanced quotes", () => {
    const header = 'attachment; filename="unterminated';
    expect(() => parseFilenameFromContentDisposition(header)).not.toThrow();
  });
});

// PRPs/prds/data-export.prd.md AC-9 one-tap-from-settings (the fallback-name slice: plan AC-A6)
//
// Source plan: PRPs/plans/data-export-phase-3-the-button.plan.md
// (Task 2 — exportFilename(header: string | null, kind: "json" | "ics"): string).
//
// This closes the gap the test-reviewer found in the earlier parser-only suite: the
// fallback filename substituted when the header is missing or unparseable was previously
// a hardcoded literal inside src/app/api.ts, reachable by neither this automated suite
// (correctly scoped to parseFilenameFromContentDisposition's own null-vs-not behavior)
// nor the manual device pass (both real routes always send a header per AC-6, so the
// fallback path never triggers on-device). exportFilename moves that decision into this
// pure module so the same test tier that covers the parser now covers the fallback too.
describe("exportFilename — parsed name takes priority over the fallback (plan AC-A6)", () => {
  it("returns the PARSED filename, not the fallback, when the header yields one", () => {
    // A wrong implementation that always returns the fallback regardless of the
    // parse result would still pass every other case below — this is the one
    // case that catches exactly that bug.
    const header = 'attachment; filename="praesto-2026-09-05.json"';
    expect(exportFilename(header, "json")).toBe("praesto-2026-09-05.json");
  });

  it("returns the PARSED .ics filename, not the fallback, when the header yields one", () => {
    const header = 'attachment; filename="praesto-2026-09-05.ics"';
    expect(exportFilename(header, "ics")).toBe("praesto-2026-09-05.ics");
  });
});

describe("exportFilename — undated fallback on a missing or unparseable header (plan AC-A6)", () => {
  it("returns the exact undated JSON fallback when the header is missing (null)", () => {
    // Asserted as an exact string, not a pattern: the whole point of the
    // fallback is that it is deliberately, visibly NOT a dated name, so a
    // server-side Content-Disposition regression is obvious rather than
    // blending in as a plausible dated one. A loose pattern here (e.g.
    // /^praesto-export/) would accept a dated name too and defeat that design.
    expect(exportFilename(null, "json")).toBe("praesto-export.json");
  });

  it("returns the exact undated .ics fallback when the header is missing (null)", () => {
    expect(exportFilename(null, "ics")).toBe("praesto-export.ics");
  });

  it("returns the exact undated JSON fallback when the header carries no filename parameter of any form", () => {
    const header = "attachment";
    expect(exportFilename(header, "json")).toBe("praesto-export.json");
  });

  it("returns the exact undated .ics fallback when the header is garbled beyond parsing", () => {
    // Unbalanced quotes with no plain-form fallback path to salvage — the
    // underlying parser's own defensive case, wired through to this wrapper.
    const header = 'form-data; name="file"';
    expect(exportFilename(header, "ics")).toBe("praesto-export.ics");
  });

  it("never lands on the same filename for the two kinds — the extension always follows kind", () => {
    // Pins that "kind" actually drives the extension rather than both
    // downloads silently colliding on one hardcoded name.
    expect(exportFilename(null, "json")).not.toBe(exportFilename(null, "ics"));
  });
});
