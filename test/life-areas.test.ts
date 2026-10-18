// PRPs/prds/life-areas.prd.md AC-12 shared-helpers
//
// Source plan: PRPs/plans/life-areas-phase-1-areas-api-and-the-filter.plan.md
// (Task 1 — the pure module `src/shared/life-areas.ts`).
//
// The pure core the `/api/life-areas` route and, in phase 2, the Áreas screen both
// import, so the two cannot drift on what a valid, a duplicate or an ordered area
// name is. The names it exports are pinned by the plan (PRD AC-12 left them open):
// `LIFE_AREA_NAME_MAX`, `LIFE_AREA_LIMIT`, `validateLifeAreaName` (an error code,
// `null` meaning valid), `lifeAreaNameKey` and `compareLifeAreaNames`.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// `src/shared/life-areas.ts` does not exist yet, so this file is expected to be RED
// for the right reason — the module import cannot be resolved — until plan Task 1
// lands. No other RED reason is expected.
//
// The ordering assertions are chosen to discriminate: a bytewise sort puts `Ética`
// (U+00C9) after `Trabalho`, and puts the lowercase `casa` (U+0063) after the
// uppercase `Trabalho` (U+0054). Only a locale-aware comparison gets both right.

import { describe, expect, it } from "vitest";
import {
  compareLifeAreaNames,
  LIFE_AREA_LIMIT,
  LIFE_AREA_NAME_MAX,
  lifeAreaNameKey,
  validateLifeAreaName,
} from "../src/shared/life-areas";

describe("AC-12 — the documented limits", () => {
  it("caps a name at 40 characters", () => {
    expect(LIFE_AREA_NAME_MAX).toBe(40);
  });

  it("caps the number of areas at 12", () => {
    expect(LIFE_AREA_LIMIT).toBe(12);
  });
});

describe("AC-12 — name validation returns an error code, or null when valid", () => {
  it("accepts an ordinary name, padded or not", () => {
    expect(validateLifeAreaName("Casa")).toBeNull();
    expect(validateLifeAreaName("  Casa ")).toBeNull();
  });

  it.each([
    ["an empty string", ""],
    ["spaces only", "   "],
    ["tabs and newlines only", "\t\n "],
  ])("flags %s as blank", (_label, raw) => {
    expect(validateLifeAreaName(raw)).toBe("blank");
  });

  it("flags a name of 41 characters as too long", () => {
    expect(validateLifeAreaName("a".repeat(41))).toBe("too_long");
  });

  it("accepts a name of exactly 40 characters", () => {
    expect(validateLifeAreaName("a".repeat(40))).toBeNull();
  });

  it("measures the length after trimming, not before", () => {
    // 40 characters of name plus padding is a valid name; 41 plus padding is not.
    expect(validateLifeAreaName(` ${"a".repeat(40)} `)).toBeNull();
    expect(validateLifeAreaName(` ${"a".repeat(41)} `)).toBe("too_long");
  });
});

describe("AC-12 — the duplicate key ignores case, accents and surrounding space", () => {
  it("gives Saúde, SAUDE and ' saude ' the same key", () => {
    const reference = lifeAreaNameKey("Saúde");

    expect(lifeAreaNameKey("SAUDE")).toBe(reference);
    expect(lifeAreaNameKey(" saude ")).toBe(reference);
  });

  it("folds an uppercase accented letter too", () => {
    expect(lifeAreaNameKey("SAÚDE")).toBe(lifeAreaNameKey("saude"));
  });

  it("treats a decomposed accent as the precomposed one", () => {
    // `u` followed by a combining acute accent must not slip past a duplicate
    // check that the precomposed `ú` would have tripped (plan Risk row). Built with
    // `normalize` so the two strings differ in code points, not just on screen.
    const precomposed = "Saúde".normalize("NFC");
    const decomposed = precomposed.normalize("NFD");

    expect(decomposed).not.toBe(precomposed);
    expect(lifeAreaNameKey(decomposed)).toBe(lifeAreaNameKey(precomposed));
  });

  it("keeps different names apart", () => {
    expect(lifeAreaNameKey("Casa")).not.toBe(lifeAreaNameKey("Casas"));
    expect(lifeAreaNameKey("Casa")).not.toBe(lifeAreaNameKey("Trabalho"));
  });
});

describe("AC-12 — the comparator orders in pt-BR alphabetical order", () => {
  it("orders Ética before Saúde", () => {
    expect(compareLifeAreaNames("Ética", "Saúde")).toBeLessThan(0);
    expect(compareLifeAreaNames("Saúde", "Ética")).toBeGreaterThan(0);
  });

  it("orders casa before Trabalho whatever the case", () => {
    expect(compareLifeAreaNames("casa", "Trabalho")).toBeLessThan(0);
    expect(compareLifeAreaNames("Trabalho", "casa")).toBeGreaterThan(0);
  });

  it("reports an identical name as equal", () => {
    expect(compareLifeAreaNames("Casa", "Casa")).toBe(0);
  });

  it("sorts a list into Casa, Ética, Trabalho rather than bytewise", () => {
    const sorted = ["Trabalho", "Ética", "Casa"].sort(compareLifeAreaNames);

    expect(sorted).toEqual(["Casa", "Ética", "Trabalho"]);
  });
});
