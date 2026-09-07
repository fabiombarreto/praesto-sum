// PRPs/prds/data-export.prd.md AC-10 the-unattended-pull-fails-loudly (plan AC-A1)
// PRPs/prds/data-export.prd.md AC-11 the-snapshot-is-dated-and-does-not-overwrite (plan AC-A2)
//
// Source plan: PRPs/plans/data-export-phase-4-the-unattended-copy.plan.md
// (Task 1 — src/shared/snapshot-outcome.ts: deriveSnapshotDecision, shouldWriteFile).
//
// This suite is written BEFORE the Implementer (`tdd: true`, test-first ordering per
// docs/context/methodology.md) — src/shared/snapshot-outcome.ts does not exist yet, so
// this file is expected to fail to resolve its own import. That failure is the correct
// RED: once the Implementer creates the module per the plan's Task 1 spec, every case
// below must pass unmodified.
//
// Scope note: only the two pure, DB-free, network-free decision functions are covered
// here. scripts/pull-export-snapshot.mjs and scripts/mock-export-server.mjs are I/O glue,
// exempt per docs/context/methodology.md's browser/OS-glue split, and are verified by
// Level 3's mock-server dry run, not by this suite.

import { describe, expect, it } from "vitest";
import { deriveSnapshotDecision, shouldWriteFile } from "../src/shared/snapshot-outcome";
import type { FetchOutcome } from "../src/shared/snapshot-outcome";

const jsonOk = (contentDispositionHeader: string | null, body = '{"foo":1}'): FetchOutcome => ({
  ok: true,
  status: 200,
  contentDispositionHeader,
  body,
});

const icsOk = (
  contentDispositionHeader: string | null,
  body = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
): FetchOutcome => ({
  ok: true,
  status: 200,
  contentDispositionHeader,
  body,
});

const failing = (status: number): FetchOutcome => ({ ok: false, status });

describe("deriveSnapshotDecision — loud failure, no write instruction on any failed fetch (PRD AC-10, plan AC-A1)", () => {
  it("fails when neither fetch is ok, naming both statuses in the reason", () => {
    const decision = deriveSnapshotDecision(failing(401), failing(500));
    expect(decision.action).toBe("fail");
    // The exact phrasing the plan's Task 1 spec commits to for this case shape —
    // asserted literally so a future rewording is a deliberate, reviewed change,
    // not a silent drift away from a message the owner reads in his own log.
    if (decision.action === "fail") {
      expect(decision.reason).toContain("json failed (status 401)");
      expect(decision.reason).toContain("ics failed (status 500)");
    }
  });

  it("fails when only the JSON fetch is ok — a partial success is still a failure, not a half-write", () => {
    // The bug this catches: an implementation that writes whichever half
    // succeeded, leaving the owner with a JSON file but a missing/stale .ics,
    // which looks like a working backup until the day it matters.
    const decision = deriveSnapshotDecision(
      jsonOk('attachment; filename="praesto-2026-09-05.json"'),
      failing(401),
    );
    expect(decision.action).toBe("fail");
    // No write instruction of any kind escapes on this path.
    expect("json" in decision).toBe(false);
    expect("ics" in decision).toBe(false);
    if (decision.action === "fail") {
      expect(decision.reason).toContain("ics failed (status 401)");
    }
  });

  it("fails when only the ICS fetch is ok — the symmetric partial-success case", () => {
    const decision = deriveSnapshotDecision(
      failing(500),
      icsOk('attachment; filename="praesto-2026-09-05.ics"'),
    );
    expect(decision.action).toBe("fail");
    expect("json" in decision).toBe(false);
    expect("ics" in decision).toBe(false);
    if (decision.action === "fail") {
      expect(decision.reason).toContain("json failed (status 500)");
    }
  });

  it("distinguishes a 401 (bad/missing token) from a 500 (server misconfigured) in the reason", () => {
    // src/worker/auth.ts:11-26 — the two failure classes the owner's log must be
    // able to tell apart, since only one is caused by his own token file. A wrong
    // implementation that hardcodes "failed" without the status would still pass
    // every other case above but fail this one.
    const unauthorized = deriveSnapshotDecision(failing(401), failing(401));
    const misconfigured = deriveSnapshotDecision(failing(500), failing(500));
    if (unauthorized.action === "fail" && misconfigured.action === "fail") {
      expect(unauthorized.reason).toContain("401");
      expect(misconfigured.reason).toContain("500");
      expect(unauthorized.reason).not.toBe(misconfigured.reason);
    } else {
      throw new Error("expected both decisions to be 'fail'");
    }
  });
});

describe("deriveSnapshotDecision — write, deriving filenames through the real content-disposition parser (PRD AC-10/AC-11, plan AC-A1/AC-A2)", () => {
  it("returns write with both bodies and dated filenames when both fetches are ok", () => {
    const decision = deriveSnapshotDecision(
      jsonOk('attachment; filename="praesto-2026-09-05.json"', '{"tasks":[]}'),
      icsOk(
        'attachment; filename="praesto-2026-09-05.ics"',
        "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      ),
    );
    expect(decision.action).toBe("write");
    if (decision.action === "write") {
      expect(decision.json).toEqual({ filename: "praesto-2026-09-05.json", body: '{"tasks":[]}' });
      expect(decision.ics).toEqual({
        filename: "praesto-2026-09-05.ics",
        body: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      });
    }
  });

  it("actually routes filename derivation through exportFilename's sanitization, not a hardcoded name", () => {
    // A plausible wrong implementation reads the header directly and trusts it, or
    // invents its own filename logic. Feeding a path-traversal Content-Disposition
    // value proves the real parser (with its last-path-segment sanitization) ran.
    const decision = deriveSnapshotDecision(
      jsonOk('attachment; filename="../../etc/passwd"'),
      icsOk('attachment; filename="../../etc/evil.ics"'),
    );
    expect(decision.action).toBe("write");
    if (decision.action === "write") {
      expect(decision.json.filename).toBe("passwd");
      expect(decision.ics.filename).toBe("evil.ics");
    }
  });

  it("falls back to exportFilename's exact undated fallback when a header is missing, not a fabricated dated name", () => {
    // Proves this module composes content-disposition.ts's exportFilename rather
    // than re-implementing filename derivation: a from-scratch implementation is
    // likely to invent its own (dated) fallback instead of the deliberately
    // undated one exportFilename defines, or to crash on a null header.
    const decision = deriveSnapshotDecision(jsonOk(null), icsOk(null));
    expect(decision.action).toBe("write");
    if (decision.action === "write") {
      expect(decision.json.filename).toBe("praesto-export.json");
      expect(decision.ics.filename).toBe("praesto-export.ics");
    }
  });

  it("prefers filename* over a plain filename per RFC 6266, the same preference exportFilename implements", () => {
    const decision = deriveSnapshotDecision(
      jsonOk("attachment; filename=\"stale.json\"; filename*=UTF-8''praesto-2026-09-05.json"),
      icsOk('attachment; filename="praesto-2026-09-05.ics"'),
    );
    expect(decision.action).toBe("write");
    if (decision.action === "write") {
      expect(decision.json.filename).toBe("praesto-2026-09-05.json");
    }
  });
});

describe("shouldWriteFile — dated, non-overwriting (PRD AC-11, plan AC-A2)", () => {
  it("returns false when the exact filename already exists — the same-day rerun must not overwrite", () => {
    // Fails an implementation that always overwrites (always returns true).
    expect(shouldWriteFile(["praesto-2026-09-05.json"], "praesto-2026-09-05.json")).toBe(false);
  });

  it("returns true for a genuinely new dated filename not present among existing files — a different day must write", () => {
    // Fails an implementation that always returns false regardless of input, which
    // would pass the previous case but silently stop every future run from ever
    // writing again.
    expect(shouldWriteFile(["praesto-2026-09-04.json"], "praesto-2026-09-05.json")).toBe(true);
  });

  it("returns true when the directory is empty — the very first run must write", () => {
    expect(shouldWriteFile([], "praesto-2026-09-05.json")).toBe(true);
  });

  it("returns true for a new filename even when other, unrelated dated files already exist", () => {
    // Guards against an implementation that treats "existingFilenames is
    // non-empty" as the skip signal instead of checking for this exact filename.
    expect(
      shouldWriteFile(
        ["praesto-2026-09-03.json", "praesto-2026-09-04.json"],
        "praesto-2026-09-05.json",
      ),
    ).toBe(true);
  });

  it("distinguishes the .json and .ics siblings of the same day independently", () => {
    // The two files from one run are named differently (different extension), so
    // a same-day rerun's skip decision for one must not affect the other.
    const existing = ["praesto-2026-09-05.json"];
    expect(shouldWriteFile(existing, "praesto-2026-09-05.json")).toBe(false);
    expect(shouldWriteFile(existing, "praesto-2026-09-05.ics")).toBe(true);
  });
});
