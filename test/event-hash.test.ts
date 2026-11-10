// PRPs/prds/events-and-day-view.prd.md AC-4 Content hash
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A4; Task 5 — `computeEventContentHash` in src/shared/event-hash.ts; the plan's
// Notes fix the canonicalization byte for byte).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `src/shared/event-hash.ts`
// does not exist yet, so this file is expected to be RED for the right reason — the
// module import cannot be resolved — until plan Task 5 lands.
//
// The content hash is the dirty signal unit 15 will compare against the hash last synced
// to Google (ADR-0007, ADR-0016), so it must change when, and only when, the owner's
// content changes. Two golden digests anchor it. They were computed OUTSIDE this
// repository, with Node's `crypto.createHash("sha256")` over these exact UTF-8 bytes
// (the plan's canonicalization: "v1\n" + JSON.stringify of the seven fields in order),
// never by running the code under test:
//
//   timed:   v1\n["Dentista","","Clínica Sorriso",false,1792499400,1792503000,"America/Sao_Paulo"]
//            (85 bytes)
//   all-day: v1\n["Feriado","","",true,"2026-10-26","2026-10-28","America/Sao_Paulo"]
//            (71 bytes)
//
// If a golden assertion ever fails, the canonicalization changed. That is a versioned
// event, not a test to loosen: bump the `v1` prefix, re-derive the digests independently,
// and record the change (ADR-0016 consequences).

import { describe, expect, it } from "vitest";
import { computeEventContentHash } from "../src/shared/event-hash";
import type { EventHashInput } from "../src/shared/event-hash";

const GOLDEN_TIMED_DIGEST = "c25b398c4548bcf2f6fdc645ff4bc3c2b7a1d21da48fa0e37f5e4c661cd06e79";
const GOLDEN_ALL_DAY_DIGEST = "0712a038ecd8032e76451e75fab6dcc31b1a5e4f82a0e6fc30acba95bda1c302";

/** 2026-10-20 09:30 America/Sao_Paulo, and the same moment one hour later. */
const START = Date.UTC(2026, 9, 20, 12, 30) / 1000;
const END = START + 3600;

/** The fixed, documented timed input behind `GOLDEN_TIMED_DIGEST`. */
const TIMED: EventHashInput = {
  title: "Dentista",
  description: null,
  location: "Clínica Sorriso",
  allDay: false,
  startAt: 1792499400,
  endAt: 1792503000,
  startDate: null,
  endDate: null,
  timezone: "America/Sao_Paulo",
};

/** The fixed, documented all-day input behind `GOLDEN_ALL_DAY_DIGEST`. */
const ALL_DAY: EventHashInput = {
  title: "Feriado",
  description: null,
  location: null,
  allDay: true,
  startAt: null,
  endAt: null,
  startDate: "2026-10-26",
  endDate: "2026-10-28",
  timezone: "America/Sao_Paulo",
};

/** Both start and end empty, so flipping `allDay` is the ONLY difference between two inputs. */
const NO_TIMES: EventHashInput = {
  ...TIMED,
  startAt: null,
  endAt: null,
  startDate: null,
  endDate: null,
};

describe("AC-4 — the digest is a pinned, 64-character lowercase hex string", () => {
  it("is exactly 64 lowercase hexadecimal characters", async () => {
    expect(await computeEventContentHash(TIMED)).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeEventContentHash(ALL_DAY)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("yields the pinned digest for the documented timed input", async () => {
    expect(TIMED.startAt).toBe(START);
    expect(TIMED.endAt).toBe(END);
    expect(await computeEventContentHash(TIMED)).toBe(GOLDEN_TIMED_DIGEST);
  });

  it("yields the pinned digest for the documented all-day input", async () => {
    expect(await computeEventContentHash(ALL_DAY)).toBe(GOLDEN_ALL_DAY_DIGEST);
  });

  it("is deterministic across calls", async () => {
    expect(await computeEventContentHash(TIMED)).toBe(await computeEventContentHash({ ...TIMED }));
  });
});

describe("AC-4 — what the hash ignores", () => {
  it("is equal for two inputs that differ only in id, source or timestamps", async () => {
    const stored = {
      ...TIMED,
      id: "7d1f0d2e-0000-4000-8000-000000000001",
      source: "google",
      createdAt: 1_790_000_000,
      updatedAt: 1_791_000_000,
    };
    const other = {
      ...TIMED,
      id: "a-completely-different-id",
      source: "local",
      createdAt: new Date(0),
      updatedAt: new Date(86_400_000),
    };
    const expected = await computeEventContentHash(TIMED);
    expect(await computeEventContentHash(stored)).toBe(expected);
    expect(await computeEventContentHash(other)).toBe(expected);
  });

  it("does not feed a previously stored hash back into itself", async () => {
    const stored = { ...TIMED, contentHash: "0".repeat(64) };
    expect(await computeEventContentHash(stored)).toBe(GOLDEN_TIMED_DIGEST);
  });

  it("does not depend on the order of the input's keys", async () => {
    const reversed = Object.fromEntries(Object.entries(TIMED).reverse()) as EventHashInput;
    expect(Object.keys(reversed)).not.toEqual(Object.keys(TIMED));
    expect(await computeEventContentHash(reversed)).toBe(GOLDEN_TIMED_DIGEST);
  });

  it("treats an empty, a null and a missing description as the same", async () => {
    const empty = await computeEventContentHash({ ...TIMED, description: "" });
    const nulled = await computeEventContentHash({ ...TIMED, description: null });
    const missing = await computeEventContentHash({ ...TIMED, description: undefined });
    expect(empty).toBe(nulled);
    expect(missing).toBe(nulled);
  });

  it("treats an empty, a null and a missing location as the same", async () => {
    const base = { ...TIMED, location: null };
    const empty = await computeEventContentHash({ ...base, location: "" });
    const nulled = await computeEventContentHash(base);
    const missing = await computeEventContentHash({ ...base, location: undefined });
    expect(empty).toBe(nulled);
    expect(missing).toBe(nulled);
  });

  it("ignores surrounding whitespace in the title, description and location", async () => {
    const withDescription: EventHashInput = { ...TIMED, description: "levar exames" };
    const padded: EventHashInput = {
      ...withDescription,
      title: "  Dentista\n",
      description: "\tlevar exames  ",
      location: "  Clínica Sorriso ",
    };
    expect(await computeEventContentHash(padded)).toBe(
      await computeEventContentHash(withDescription),
    );
    // The padded timed input is the golden one once its description is empty again.
    expect(
      await computeEventContentHash({
        ...TIMED,
        title: "  Dentista\n",
        description: "   ",
        location: "  Clínica Sorriso ",
      }),
    ).toBe(GOLDEN_TIMED_DIGEST);
  });
});

describe("AC-4 — the hash changes when any one of the seven fields changes", () => {
  const cases: Array<[string, EventHashInput, EventHashInput]> = [
    ["title", TIMED, { ...TIMED, title: "Dentista (retorno)" }],
    ["description", TIMED, { ...TIMED, description: "levar exames" }],
    ["location", TIMED, { ...TIMED, location: "Clínica Sorriso 2" }],
    ["all-day flag", NO_TIMES, { ...NO_TIMES, allDay: true }],
    ["timed start", TIMED, { ...TIMED, startAt: START + 60 }],
    ["timed end", TIMED, { ...TIMED, endAt: END + 60 }],
    ["all-day start", ALL_DAY, { ...ALL_DAY, startDate: "2026-10-27" }],
    ["all-day end", ALL_DAY, { ...ALL_DAY, endDate: "2026-10-29" }],
    ["zone", TIMED, { ...TIMED, timezone: "America/New_York" }],
  ];

  it.each(cases)("differs when the %s differs", async (_field, before, after) => {
    expect(await computeEventContentHash(after)).not.toBe(await computeEventContentHash(before));
  });

  it("differs when text moves from one field to another", async () => {
    const left: EventHashInput = { ...TIMED, title: "ab", location: "c" };
    const right: EventHashInput = { ...TIMED, title: "a", location: "bc" };
    const swapped: EventHashInput = { ...TIMED, title: "c", location: "ab" };
    const hashes = new Set([
      await computeEventContentHash(left),
      await computeEventContentHash(right),
      await computeEventContentHash(swapped),
    ]);
    expect(hashes.size).toBe(3);
  });

  it("differs when only the letter case or an inner space differs", async () => {
    const hashes = new Set([
      await computeEventContentHash(TIMED),
      await computeEventContentHash({ ...TIMED, title: "dentista" }),
      await computeEventContentHash({ ...TIMED, title: "Den tista" }),
    ]);
    expect(hashes.size).toBe(3);
  });
});
