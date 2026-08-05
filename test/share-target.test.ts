// PRPs/prds/install-and-quick-capture.prd.md AC-1 share-creates-task
// PRPs/prds/install-and-quick-capture.prd.md AC-5 empty-share-creates-nothing
//
// Source plan: PRPs/plans/install-and-quick-capture-phase-1-share-target.plan.md
// (Task 1 — parseShareTarget(search: string): { title: string } | null).
//
// This is a pure, DOM-free unit under test (src/shared/share-target.ts carries
// no Worker or browser globals), so it needs neither the D1 fixture nor the
// bearer-token auth helpers that test/tasks.test.ts uses — see
// docs/context/testing.md and the plan's P2 Mandatory Reading row on
// test/tasks.test.ts ("adapted to drop the cloudflare:workers/D1 fixture,
// since the parser under test has no Worker dependency").
//
// Scope note (see PRPs/reports/install-and-quick-capture/test-suite.diff for
// the full per-AC outcome record): this file covers only the observable,
// pure-logic slice of AC-1 and AC-5 — which title `parseShareTarget` extracts
// (or that it returns `null`). The DOM-rendered slice of both ACs (the
// capture field opening pre-filled/focused, the save confirmation appearing,
// a Task actually being POSTed) is unreachable from the workerd-only Vitest
// tier (no browser/DOM tier exists — docs/context/testing.md) and is verified
// manually per the plan's Level 3 MANUAL steps 1 and 2.

import { describe, expect, it } from "vitest";
import { parseShareTarget } from "../src/shared/share-target";

describe("parseShareTarget (PRD AC-1 share-creates-task)", () => {
  it("extracts the shared text as the title when text is present", () => {
    expect(parseShareTarget("?title=&text=Buy%20milk&url=")).toEqual({ title: "Buy milk" });
  });

  it("prefers text over title and url when text is non-empty (Android url-often-empty quirk)", () => {
    expect(
      parseShareTarget("?title=Grocery+List&text=Buy+milk&url=https%3A%2F%2Fexample.com"),
    ).toEqual({ title: "Buy milk" });
  });

  it("falls back to title when text is empty or whitespace-only", () => {
    expect(parseShareTarget("?title=Read+later&text=&url=")).toEqual({ title: "Read later" });
    expect(parseShareTarget("?title=Read+later&text=%20&url=")).toEqual({ title: "Read later" });
  });

  it("falls back to url when both text and title are empty or whitespace-only", () => {
    expect(parseShareTarget("?title=&text=&url=https%3A%2F%2Fexample.com%2Farticle")).toEqual({
      title: "https://example.com/article",
    });
  });

  it("trims surrounding whitespace from the extracted value", () => {
    expect(parseShareTarget("?title=&text=%20%20Buy%20milk%20%20&url=")).toEqual({
      title: "Buy milk",
    });
  });
});

describe("parseShareTarget (PRD AC-5 empty-share-creates-nothing)", () => {
  it("returns null when title, text and url are all empty", () => {
    expect(parseShareTarget("?title=&text=&url=")).toBeNull();
  });

  it("returns null when title, text and url are all whitespace-only", () => {
    expect(parseShareTarget("?title=%20&text=%20&url=%20")).toBeNull();
  });

  it("returns null when the query string carries none of the three params", () => {
    expect(parseShareTarget("")).toBeNull();
  });
});
