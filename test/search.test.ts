// PRPs/prds/text-search.prd.md AC-11 One normalization, two implementations that agree
// PRPs/prds/text-search.prd.md AC-8 Invalid queries are rejected, not guessed
//
// This file pins the JAVASCRIPT half of AC-11 — the exact fixture values the
// PRD names for `normalizeSearchText` and `searchWords` — plus AC-8's
// validation contract at the pure-function layer. The SQL half (the
// generated expression evaluated inside real D1) is
// `test/search-sql-agreement.test.ts`, kept separate because it needs the
// workerd D1 binding this file does not. The end-to-end HTTP shape of AC-8
// (a 400 naming `q` from `GET /api/tasks`) is `test/task-list-search.test.ts`.
//
// `src/shared/search.ts` is new to this phase (Task 2 of
// PRPs/plans/text-search-phase-1-search-on-the-api.plan.md) — like
// `task-filter.ts`, `task-groups.ts`, `format.ts` and `dates.ts`, it stays
// DOM-free, clock-free and dependency-free, so it is unit-tested directly
// the same way `test/task-filter.test.ts` unit-tests `task-filter.ts`.

import { describe, expect, it } from "vitest";
import { MAX_SEARCH_QUERY_LENGTH } from "../src/shared/api";
import {
  normalizeSearchText,
  searchWords,
  SEARCH_MIN_QUERY_LENGTH,
  shouldSearch,
  validateSearchQuery,
} from "../src/shared/search";

describe("normalizeSearchText (PRD AC-11)", () => {
  it("lowercases and folds every pt-BR diacritic to its base letter — the PRD's own fixture", () => {
    expect(normalizeSearchText("ÁÉÍÓÚ Ç ãõ â ê ô à ü")).toBe("aeiou c ao a e o a u");
  });

  it("leaves plain ASCII untouched but for case", () => {
    expect(normalizeSearchText("Aluguel de SETEMBRO")).toBe("aluguel de setembro");
  });

  it("folds an uppercase accented letter the same as its lowercase form", () => {
    // The exact case JS's own toLowerCase() already handles correctly (unlike
    // SQLite's ASCII-only lower()) — pinned here so a regression in the
    // mapping table itself, not just the SQL side, is caught at this layer.
    expect(normalizeSearchText("Á")).toBe(normalizeSearchText("á"));
    expect(normalizeSearchText("É")).toBe(normalizeSearchText("é"));
    expect(normalizeSearchText("Ç")).toBe(normalizeSearchText("ç"));
  });
});

describe("searchWords (PRD AC-11)", () => {
  it("trims, splits on whitespace and normalizes each token — the PRD's own fixture", () => {
    expect(searchWords("  Renovar   PASSAPORTE ")).toEqual(["renovar", "passaporte"]);
  });

  it("drops empty tokens produced by repeated or trailing whitespace", () => {
    expect(searchWords("   ")).toEqual([]);
  });
});

describe("validateSearchQuery (PRD AC-8)", () => {
  it("rejects a blank query, naming q", () => {
    const blank = validateSearchQuery("   ");
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.error.toLowerCase()).toContain("q");
  });

  it("rejects an empty-string query, naming q", () => {
    const empty = validateSearchQuery("");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.toLowerCase()).toContain("q");
  });

  it("rejects a query over the length ceiling", () => {
    const tooLong = validateSearchQuery("a".repeat(MAX_SEARCH_QUERY_LENGTH + 1));
    expect(tooLong.ok).toBe(false);
  });

  it("accepts a query at the ceiling itself", () => {
    const atCeiling = validateSearchQuery("a".repeat(MAX_SEARCH_QUERY_LENGTH));
    expect(atCeiling.ok).toBe(true);
  });

  it("returns the normalized words on success", () => {
    const result = validateSearchQuery("Passaporte Renovar");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.words).toEqual(["passaporte", "renovar"]);
  });
});

// --- UPDATE (text-search phase 2, the search route) ------------------------
// PRD AC-12 ("typing fewer than 2 characters fires no request") via
// PRPs/plans/text-search-phase-2-the-search-route.plan.md Task 6, plan
// AC-A2. `shouldSearch`/`SEARCH_MIN_QUERY_LENGTH` are the DECIDABLE half of
// AC-A2, extracted into this module precisely so this predicate is tested
// here rather than folded into SearchScreen.tsx and exempted as UI glue —
// docs/context/methodology.md's "Browser-API work" section is explicit that
// the manual-verification exemption is for glue, never for logic. The
// rendering half (the pt-BR prompt SearchScreen shows when this predicate is
// false) stays out of this file: it is React conditional rendering with no
// dedicated test-file convention anywhere in this codebase, verified
// manually via the plan's own AC-A12 device pass.
//
// Neither export exists yet: this suite is RED for that reason (a
// compile-time import error on `SEARCH_MIN_QUERY_LENGTH`/`shouldSearch`
// above) until plan Task 6 lands. Every assertion above this point is
// untouched.

describe("shouldSearch / SEARCH_MIN_QUERY_LENGTH (PRD AC-12 via phase-2 plan AC-A2)", () => {
  it("SEARCH_MIN_QUERY_LENGTH is 2 — the constant this suite pins", () => {
    expect(SEARCH_MIN_QUERY_LENGTH).toBe(2);
  });

  it("is false one character below the minimum", () => {
    expect(shouldSearch("a")).toBe(false);
  });

  it("is true exactly at the minimum", () => {
    expect(shouldSearch("ab")).toBe(true);
  });

  it("is true one character above the minimum", () => {
    expect(shouldSearch("abc")).toBe(true);
  });

  it("is false for an empty string", () => {
    expect(shouldSearch("")).toBe(false);
  });

  it("is false for whitespace-only input, regardless of its raw length", () => {
    expect(shouldSearch("      ")).toBe(false);
  });

  it("counts length only AFTER trimming: surrounding whitespace does not pad a too-short query over the line", () => {
    expect(shouldSearch(" a ")).toBe(false);
  });

  it("counts length only AFTER trimming: surrounding whitespace does not stop a long-enough query from passing", () => {
    expect(shouldSearch("  ab  ")).toBe(true);
  });
});
