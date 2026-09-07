/**
 * The decidable half of the unattended snapshot pull (data-export PRD phase 4
 * "The unattended copy"): given already-fetched outcomes for the two export
 * routes and the already-listed contents of the snapshot directory, decide
 * whether to write, and which of the two files to skip on a same-day rerun.
 *
 * Like every other module in `src/shared/`, this file reads no clock, touches
 * no DOM and no Worker globals, and performs no I/O of any kind — the caller
 * (`scripts/pull-export-snapshot.mjs`) does the fetching, the listing and the
 * writing; this module only decides.
 */
import { exportFilename } from "./content-disposition.ts";

/**
 * The outcome of one `fetch` against an export route, already resolved to
 * plain data by the caller — never a live `Response` or a thrown error.
 */
export type FetchOutcome =
  | {
      readonly ok: true;
      readonly status: number;
      readonly contentDispositionHeader: string | null;
      readonly body: string;
    }
  | {
      readonly ok: false;
      readonly status: number;
    };

/**
 * What the caller should do with a pair of fetch outcomes: write both files
 * (a filename + body per route), or fail — and, on failure, write nothing at
 * all. A partial success (one route `ok`, the other not) is still a failure:
 * half a snapshot is not the safeguard ADR-0003 asks for.
 */
export type SnapshotDecision =
  | {
      readonly action: "write";
      readonly json: { readonly filename: string; readonly body: string };
      readonly ics: { readonly filename: string; readonly body: string };
    }
  | {
      readonly action: "fail";
      readonly reason: string;
    };

function describe(label: "json" | "ics", outcome: FetchOutcome): string {
  return outcome.ok ? `${label} ok` : `${label} failed (status ${outcome.status})`;
}

/**
 * Decides whether a snapshot pull should write, deriving each filename
 * through `exportFilename` (never re-implemented here) so the same
 * path-traversal sanitization and undated fallback the download button
 * relies on also protects the unattended script.
 *
 * Returns `"fail"` — with a reason naming BOTH outcomes' status, not just
 * the failing one — when either `json` or `ics` is not `ok`. This is
 * deliberate even when only one side failed: writing the half that
 * succeeded would leave a snapshot directory that looks like a working
 * backup while silently missing its other half.
 */
export function deriveSnapshotDecision(json: FetchOutcome, ics: FetchOutcome): SnapshotDecision {
  if (!json.ok || !ics.ok) {
    return {
      action: "fail",
      reason: `snapshot pull failed: ${describe("json", json)}, ${describe("ics", ics)}`,
    };
  }

  return {
    action: "write",
    json: {
      filename: exportFilename(json.contentDispositionHeader, "json"),
      body: json.body,
    },
    ics: {
      filename: exportFilename(ics.contentDispositionHeader, "ics"),
      body: ics.body,
    },
  };
}

/**
 * The same-day non-overwrite rule: `false` when `filename` is already
 * present among `existingFilenames` (an existing dated file is left
 * untouched, never overwritten), `true` otherwise — including for the very
 * first run, when `existingFilenames` is empty.
 */
export function shouldWriteFile(existingFilenames: readonly string[], filename: string): boolean {
  return !existingFilenames.includes(filename);
}
