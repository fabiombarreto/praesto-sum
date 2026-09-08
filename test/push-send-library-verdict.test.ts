// PRPs/prds/push-channel-proven.prd.md AC-11 The send-library verdict is recorded, not just reached
//
// Added on test-reviewer's R-AC-COVERAGE finding against the phase-1 suite: AC-A4 (PRD AC-11) had
// zero test-file coverage, mapped only to the plan's Task 4 shell VALIDATE block that `npm test`
// never collects. This file mirrors the established "read the repo state off disk in plain Node"
// idiom `test/docs-consistency.test.ts` and `test/source-invariants.test.ts` already use, rather
// than inventing a new one — it belongs in the `docs` vitest project (workerd has no `node:fs`).
//
// AC-11 has three clauses, checked as three independent groups below:
//   1. Exactly one send library is declared in package.json, pinned exact (no ^ or ~), with
//      @types/web-push declared if and only if `web-push` itself is still the adopted library.
//   2. The Decisions Log "Send library" ROW ITSELF (not the whole PRD file — AC-11's own prose
//      contains the phrase "settled by running... rather than by reading", so a whole-file
//      assertion would pass vacuously; this is the exact false-positive the plan's own Task 4
//      VALIDATE block was written to avoid, and this suite mirrors that scoping) states the verdict
//      was settled by running the library inside workerd, not by reading about it.
//   3. A superseding ADR exists precisely when the adopted library is not `web-push` — asserted in
//      both directions so neither branch of the conditional passes vacuously.
//
// Today (before phase 1's spike has run) this file is expected to be RED on group 2: the Decisions
// Log row still carries its pre-spike wording ("Decided in phase 1 by running it, not by reading.").
// Groups 1 and 3 are expected to pass today, because `web-push@3.6.7` is still the sole, exactly
// pinned, incumbent library and no superseding ADR exists — exactly the state before the spike
// changes anything.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_JSON_PATH = "package.json";
const PRD_PATH = "PRPs/prds/push-channel-proven.prd.md";
const ADR_DIR = "documentation/60-decisions";

function read(relativePath: string): string {
  return readFileSync(relativePath, "utf8");
}

function escapeForRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDeclared(packageJsonText: string, libraryName: string): boolean {
  return new RegExp(`"${escapeForRegex(libraryName)}"\\s*:`).test(packageJsonText);
}

function pinFor(packageJsonText: string, libraryName: string): string | undefined {
  const match = new RegExp(`"${escapeForRegex(libraryName)}":\\s*"([^"]*)"`).exec(packageJsonText);
  return match?.[1];
}

// The only two candidates this project has ever named: the incumbent (ADR-0005) and the one
// Technical Risks names as the swap target if the spike proves the incumbent unusable.
const SEND_LIBRARY_CANDIDATES = ["web-push", "@block65/webcrypto-web-push"] as const;

const packageJsonText = read(PACKAGE_JSON_PATH);
const declaredCandidates = SEND_LIBRARY_CANDIDATES.filter((lib) =>
  isDeclared(packageJsonText, lib),
);
const adopted: (typeof SEND_LIBRARY_CANDIDATES)[number] | undefined = declaredCandidates[0];

describe("AC-11 clause 1 — exactly one send library, pinned exact", () => {
  it("declares exactly one of the two candidate send libraries (zero or both must fail)", () => {
    expect(
      declaredCandidates,
      `expected exactly one of ${SEND_LIBRARY_CANDIDATES.join(", ")} declared in package.json, ` +
        `found: ${declaredCandidates.join(", ") || "none"}`,
    ).toHaveLength(1);
  });

  it("pins the adopted library to an exact version — no ^ or ~ range", () => {
    if (adopted === undefined) {
      // Covered, and already failed, by the exclusivity test above — nothing further to assert
      // against an undecided adoption.
      return;
    }
    const pin = pinFor(packageJsonText, adopted);
    expect(
      pin,
      `${adopted} is declared in package.json but carries no version string`,
    ).toBeDefined();
    if (pin === undefined) return;
    expect(
      pin.startsWith("^") || pin.startsWith("~"),
      `${adopted} is pinned as "${pin}" in package.json, which is a range, not an exact version`,
    ).toBe(false);
  });

  it("keeps @types/web-push declared if and only if web-push itself is still the adopted library", () => {
    if (adopted === undefined) return;
    const typesDeclared = isDeclared(packageJsonText, "@types/web-push");
    if (adopted === "web-push") {
      expect(
        typesDeclared,
        "web-push is the adopted send library but @types/web-push is not declared in package.json",
      ).toBe(true);
    } else {
      expect(
        typesDeclared,
        `web-push was replaced by ${adopted} but @types/web-push is still declared in package.json`,
      ).toBe(false);
    }
  });
});

describe("AC-11 clause 2 — the Decisions Log 'Send library' row itself carries the verdict", () => {
  // Isolate the row BEFORE asserting anything against it. AC-11's own prose contains the phrase
  // "settled by running the library inside workerd rather than by reading about it" verbatim, so a
  // whole-file `PRD_TEXT.includes(...)` check would pass today regardless of whether the row below
  // it is ever updated — the exact defect the plan review already caught once in this phase.
  const prdText = read(PRD_PATH);
  const sendLibraryRow = prdText.split(/\r?\n/).find((line) => line.startsWith("| Send library |"));

  it("finds the 'Send library' row (guards against the scan silently matching nothing)", () => {
    expect(
      sendLibraryRow,
      "no line starting with '| Send library |' was found in the Decisions Log table",
    ).toBeDefined();
  });

  it("no longer carries the pre-spike speculative wording", () => {
    if (sendLibraryRow === undefined) return;
    expect(
      sendLibraryRow.includes("Decided in phase 1 by running it, not by reading."),
      `the 'Send library' row still reads its pre-spike wording:\n${sendLibraryRow}`,
    ).toBe(false);
  });

  it("states, in the row itself, that the verdict was settled by running the library rather than by reading about it", () => {
    if (sendLibraryRow === undefined) return;
    expect(
      /settled by running.*rather than by reading/i.test(sendLibraryRow),
      `the 'Send library' row does not itself state the verdict was settled by running the ` +
        `library rather than by reading about it:\n${sendLibraryRow}`,
    ).toBe(true);
  });
});

describe("AC-11 clause 3 — a superseding ADR exists precisely when the adopted library is not web-push", () => {
  // A whole-file co-occurrence check is too loose to trust: every ADR in this repo carries the
  // same boilerplate "Update when: ... a change of course produces a new ADR that supersedes this
  // one" line, and most also cite ADR-0005 elsewhere as an ordinary cross-reference (dependency
  // pins, "Related:" links) with no supersession claim at all. Verified against the real corpus:
  // ADR-0006, ADR-0008, ADR-0009, ADR-0011, ADR-0012 and index.md all contain BOTH tokens
  // somewhere in the file today, yet none of them supersedes ADR-0005 (ADR-0005's own status is
  // still `accepted`). The discriminator has to be the SAME LINE naming both the supersession verb
  // and ADR-0005 together — no such line exists anywhere in the corpus today, which is why this
  // check currently (correctly) finds zero superseding ADRs.
  const adrFileNames = readdirSync(ADR_DIR).filter((name) => name.endsWith(".md"));
  const supersedingAdrFileNames = adrFileNames.filter((name) => {
    const text = read(join(ADR_DIR, name));
    return text.split(/\r?\n/).some((line) => line.includes("ADR-0005") && /supersed/i.test(line));
  });

  it("requires a superseding ADR when a non-web-push library was adopted", () => {
    if (adopted === undefined || adopted === "web-push") {
      // web-push branch is asserted by the sibling test below — this test does not double-assert
      // the same state to avoid a vacuous pass standing in for a real one.
      return;
    }
    expect(
      supersedingAdrFileNames.length,
      `${adopted} was adopted but no ADR in ${ADR_DIR} supersedes ADR-0005's naming of web-push`,
    ).toBeGreaterThan(0);
  });

  it("requires NO superseding ADR when web-push is still the adopted library", () => {
    if (adopted !== "web-push") {
      return;
    }
    expect(
      supersedingAdrFileNames,
      `web-push is still the adopted library, but these ADR(s) claim to supersede ADR-0005: ` +
        `${supersedingAdrFileNames.join(", ")}`,
    ).toEqual([]);
  });
});
