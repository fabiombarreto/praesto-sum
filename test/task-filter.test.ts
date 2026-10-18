// PRPs/prds/today-view-and-filters.prd.md AC-12 chips-map-to-query
//
// `task-filter.ts` is the single source of truth for what a filter IS. The chip
// row and the filter sheet are two VIEWS of one `TaskFilter` — never two states
// kept in sync — so every question either surface can ask (is this chip
// pressed? what does the request look like? how many dimensions are active?)
// is answered here and nowhere else.
//
// `today` is an argument, never read from the clock — the discipline
// `src/shared/dates.ts`, `format.ts` and `task-groups.ts` already follow.
//
// Two properties carry the weight:
//   1. `toggleChip` touches EXACTLY its own dimension. A chip that clears a
//      neighbouring field would make the sheet and the row disagree the moment
//      both are used, which is the defect this module exists to prevent.
//   2. `toQuery` on an empty filter is the empty string — that is what keeps an
//      unfiltered screen load byte-identical to the request the app makes today.

import { describe, expect, it } from "vitest";
import {
  activeCount,
  EMPTY_FILTER,
  isChipActive,
  toggleChip,
  toQuery,
  type TaskFilter,
} from "../src/shared/task-filter";

const TODAY = "2026-08-24";

describe("toQuery", () => {
  it("returns the empty string for an untouched filter", () => {
    // The load-bearing case: an unfiltered load must issue exactly the request
    // the screen issued before filters existed.
    expect(toQuery(EMPTY_FILTER)).toBe("");
  });

  it("carries a single dimension on its own", () => {
    expect(toQuery({ ...EMPTY_FILTER, status: "open" })).toBe("?status=open");
    expect(toQuery({ ...EMPTY_FILTER, priority: "high" })).toBe("?priority=high");
    expect(toQuery({ ...EMPTY_FILTER, to: TODAY })).toBe("?to=2026-08-24");
  });

  it("carries every set dimension in one query string, in a fixed order", () => {
    // EXISTING_TEST_UPDATED (life-areas PRD AC-13): the literal gains the new
    // required key `lifeAreaId: null` so it still builds a whole `TaskFilter`;
    // the expected string below is unchanged because an unset area emits nothing.
    const filter: TaskFilter = {
      status: "open",
      priority: "high",
      from: "2026-08-01",
      to: TODAY,
      q: null,
      lifeAreaId: null,
    };

    // status, from, to, priority — fixed so the output is assertable and so
    // two callers building the same filter never produce two different URLs.
    expect(toQuery(filter)).toBe("?status=open&from=2026-08-01&to=2026-08-24&priority=high");
  });

  it("encodes values rather than concatenating them raw", () => {
    expect(toQuery({ ...EMPTY_FILTER, status: "missed" })).toBe("?status=missed");
    expect(toQuery({ ...EMPTY_FILTER, from: "2026-12-31" })).toContain("from=2026-12-31");
  });
});

// PRPs/prds/text-search.prd.md — phase 1 added `q` to TaskFilter/EMPTY_FILTER
// and to toQuery's own fixed order (the module's doc comment: "q sits last so
// no existing assertion's expected string changes"), but no AC in phase 1
// exercised it directly through toQuery — see this file's own "EMPTY_FILTER
// has all five dimensions null" comment below, which named phase 2 as the
// point this gap closes. Phase 2's SearchScreen is the first real caller
// (PRPs/plans/text-search-phase-2-the-search-route.plan.md, Task 6:
// `listTasks({ ...EMPTY_FILTER, q: debounced }, undefined, controller.signal)`,
// the request AC-A3 issues), so this is where `toQuery` carrying `q` — and
// carrying it LAST when composed with another dimension — actually gets
// pinned. EXISTING_TEST_UPDATED: this file already exists and already tests
// every other `toQuery` dimension; these cases close the one dimension left
// unexercised, they do not touch or narrow any assertion above.
describe("toQuery — q (PRD text-search AC-12 via phase-2 plan AC-A3)", () => {
  it("carries q on its own", () => {
    expect(toQuery({ ...EMPTY_FILTER, q: "aluguel" })).toBe("?q=aluguel");
  });

  it("places q LAST when composed with another dimension, per the module's fixed order", () => {
    expect(toQuery({ ...EMPTY_FILTER, status: "open", q: "aluguel" })).toBe(
      "?status=open&q=aluguel",
    );
  });

  it("encodes q rather than concatenating it raw", () => {
    expect(toQuery({ ...EMPTY_FILTER, q: "boleto atrasado" })).toBe("?q=boleto+atrasado");
  });
});

describe("activeCount", () => {
  it("is zero for an untouched filter", () => {
    expect(activeCount(EMPTY_FILTER)).toBe(0);
  });

  it("counts status and priority as one dimension each", () => {
    expect(activeCount({ ...EMPTY_FILTER, status: "open" })).toBe(1);
    expect(activeCount({ ...EMPTY_FILTER, priority: "low" })).toBe(1);
    expect(activeCount({ ...EMPTY_FILTER, status: "done", priority: "low" })).toBe(2);
  });

  it("counts a date range as ONE period, whether one end is set or both", () => {
    // The badge says how many *questions* are narrowing the list. A range is
    // one question, so counting `from` and `to` separately would inflate it.
    expect(activeCount({ ...EMPTY_FILTER, from: "2026-08-01" })).toBe(1);
    expect(activeCount({ ...EMPTY_FILTER, to: TODAY })).toBe(1);
    expect(activeCount({ ...EMPTY_FILTER, from: "2026-08-01", to: TODAY })).toBe(1);
  });

  // EXISTING_TEST_UPDATED (life-areas PRD AC-13): the old title, "never exceeds
  // three", stops being true once the area is a fourth countable dimension (the
  // range is now 0 to 4 — pinned below). What this case observed is unchanged: with
  // status, priority and a two-ended range set and NO area, the count is three, and
  // an unset area adds nothing. The literal gains the new required key.
  it("is three for status, priority and a two-ended range together when no area is set", () => {
    expect(
      activeCount({
        status: "open",
        priority: "high",
        from: "2026-08-01",
        to: TODAY,
        q: null,
        lifeAreaId: null,
      }),
    ).toBe(3);
  });
});

describe("isChipActive", () => {
  it("reads each chip from its own dimension", () => {
    expect(isChipActive({ ...EMPTY_FILTER, status: "open" }, "open", TODAY)).toBe(true);
    expect(isChipActive({ ...EMPTY_FILTER, priority: "high" }, "high", TODAY)).toBe(true);
    expect(isChipActive({ ...EMPTY_FILTER, to: TODAY }, "today", TODAY)).toBe(true);
  });

  it("is false when the dimension holds a different value", () => {
    // The sheet can set values no chip represents. Those must leave the chip
    // unpressed rather than pressed-but-wrong — this is the round trip between
    // the two surfaces.
    expect(isChipActive({ ...EMPTY_FILTER, status: "done" }, "open", TODAY)).toBe(false);
    expect(isChipActive({ ...EMPTY_FILTER, priority: "low" }, "high", TODAY)).toBe(false);
    expect(isChipActive({ ...EMPTY_FILTER, to: "2026-09-30" }, "today", TODAY)).toBe(false);
  });

  it("is false on an untouched filter for every chip", () => {
    for (const chip of ["open", "today", "high"] as const) {
      expect(isChipActive(EMPTY_FILTER, chip, TODAY)).toBe(false);
    }
  });
});

describe("toggleChip", () => {
  it("sets each chip's own dimension when pressed", () => {
    expect(toggleChip(EMPTY_FILTER, "open", TODAY)).toEqual({
      ...EMPTY_FILTER,
      status: "open",
    });
    expect(toggleChip(EMPTY_FILTER, "today", TODAY)).toEqual({ ...EMPTY_FILTER, to: TODAY });
    expect(toggleChip(EMPTY_FILTER, "high", TODAY)).toEqual({
      ...EMPTY_FILTER,
      priority: "high",
    });
  });

  it("clears its own dimension when pressed a second time", () => {
    const once = toggleChip(EMPTY_FILTER, "high", TODAY);
    expect(toggleChip(once, "high", TODAY)).toEqual(EMPTY_FILTER);
  });

  it("touches no dimension but its own", () => {
    // The defect this pins: a chip that also cleared `from`, or reset the
    // status, would silently undo what the sheet had set — and the two
    // surfaces would disagree from that tap onwards.
    // EXISTING_TEST_UPDATED (life-areas PRD AC-13): the literal gains the new
    // required key `lifeAreaId: null`; every expectation below is unchanged. The
    // case where the area is SET and survives a toggle is pinned in the appended
    // "isChipActive and toggleChip — the area rides along untouched" block at the
    // end of the file.
    const rich: TaskFilter = {
      status: "done",
      priority: "low",
      from: "2026-08-01",
      to: "2026-09-30",
      q: null,
      lifeAreaId: null,
    };

    const afterHigh = toggleChip(rich, "high", TODAY);
    expect(afterHigh).toEqual({ ...rich, priority: "high" });

    const afterOpen = toggleChip(rich, "open", TODAY);
    expect(afterOpen).toEqual({ ...rich, status: "open" });
  });

  it("clears only `to` when the today chip is switched off, leaving `from` alone", () => {
    const ranged: TaskFilter = { ...EMPTY_FILTER, from: "2026-08-01", to: TODAY };

    expect(toggleChip(ranged, "today", TODAY)).toEqual({ ...EMPTY_FILTER, from: "2026-08-01" });
  });

  it("returns a new object and never mutates the one it was given", () => {
    const before: TaskFilter = { ...EMPTY_FILTER, status: "open" };
    const snapshot = { ...before };

    const after = toggleChip(before, "high", TODAY);

    expect(before).toEqual(snapshot);
    expect(after).not.toBe(before);
  });

  it("composes into the query string the three chips together produce", () => {
    // The end-to-end shape PRD AC-12 names: three taps, one request.
    let filter = toggleChip(EMPTY_FILTER, "open", TODAY);
    filter = toggleChip(filter, "today", TODAY);
    filter = toggleChip(filter, "high", TODAY);

    expect(toQuery(filter)).toBe("?status=open&to=2026-08-24&priority=high");
    expect(activeCount(filter)).toBe(3);
  });
});

describe("purity", () => {
  it("reads no clock: the today chip depends only on the argument", () => {
    const a = toggleChip(EMPTY_FILTER, "today", "2026-01-01");
    const b = toggleChip(EMPTY_FILTER, "today", "2030-06-15");

    expect(a.to).toBe("2026-01-01");
    expect(b.to).toBe("2030-06-15");
  });

  it("EMPTY_FILTER has all six dimensions null", () => {
    // PRPs/prds/text-search.prd.md — Task 4 of
    // PRPs/plans/text-search-phase-1-search-on-the-api.plan.md adds `q:
    // string | null` to TaskFilter/EMPTY_FILTER so it stays the single
    // source of truth for filter state (no PRD AC-N exercises `q` directly
    // in this phase — AC-12's search route, phase 2, is what calls
    // `toQuery({ ...EMPTY_FILTER, q: <value> })`). The struct's shape
    // genuinely changes in this phase, so this is an EXISTING_TEST_UPDATED
    // fix, not a weakening: dropping this assertion would leave a real
    // shape change unpinned, and narrowing it to four keys would silently
    // accept a `q` the struct is never supposed to carry.
    //
    // PRPs/prds/life-areas.prd.md AC-13 — the same reasoning, one dimension
    // later (EXISTING_TEST_UPDATED again, retitled "five" -> "six"): the area
    // adds `lifeAreaId: string | null` to TaskFilter/EMPTY_FILTER, so the exact
    // shape this assertion pins genuinely changes. Every key it already named
    // is still asserted `null`; the one added key is asserted `null` as well,
    // and `toEqual` still refuses any further key this struct is not supposed
    // to carry.
    expect(EMPTY_FILTER).toEqual({
      status: null,
      priority: null,
      from: null,
      to: null,
      q: null,
      lifeAreaId: null,
    });
  });
});

// PRPs/prds/life-areas.prd.md AC-13 Filter dimension (life-areas phase 4, plan AC-A1)
//
// `lifeAreaId` is the sixth dimension of `TaskFilter`. Its vocabulary is the one the server
// already reserves for `GET /api/tasks?lifeAreaId=`: `null` is "no area filter" (no key at
// all), the literal `"none"` is the Tasks that have no area, and any other string is an area
// id. `null` and `"none"` mean opposite things and must never be folded into one another,
// which is why no case below normalises one into the other.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). Expected RED reasons against
// today's module: `toQuery` ignores the key and `activeCount` does not count it, so every case
// that expects the area to be emitted or counted fails at the assertion. The cases that pin what
// must NOT change — `isChipActive` ignores the area, `toggleChip` carries it through untouched —
// are GREEN today on purpose, as regression guards against an implementation that rebuilds the
// filter key by key or lets the area leak into a chip.
//
// The first clause of AC-13 — the dimension starts as `null`, `toQuery` emits `""` and
// `activeCount` is `0` for `EMPTY_FILTER`, and an unset area emits no key even beside another
// dimension — is pinned by the cases above: "returns the empty string for an untouched filter",
// "carries a single dimension on its own", "carries every set dimension in one query string, in
// a fixed order", "is zero for an untouched filter" and the exact-shape "EMPTY_FILTER has all
// six dimensions null". No second copy of those is appended here.

const AREA_A = "3f2c9d1e-0000-4000-8000-000000000001";

describe("toQuery — lifeAreaId (life-areas PRD AC-13)", () => {
  it("carries an area id on its own", () => {
    expect(toQuery({ ...EMPTY_FILTER, lifeAreaId: AREA_A })).toBe(`?lifeAreaId=${AREA_A}`);
  });

  it("carries Sem área as the literal none, unchanged", () => {
    expect(toQuery({ ...EMPTY_FILTER, lifeAreaId: "none" })).toBe("?lifeAreaId=none");
  });

  it("places the area last, after every parameter already emitted, whose order is unchanged", () => {
    const everything: TaskFilter = {
      status: "open",
      from: "2026-08-01",
      to: TODAY,
      priority: "high",
      q: "aluguel",
      lifeAreaId: "none",
    };

    expect(toQuery(everything)).toBe(
      "?status=open&from=2026-08-01&to=2026-08-24&priority=high&q=aluguel&lifeAreaId=none",
    );
  });

  // The same property one neighbour at a time, so a failure names the dimension the area was
  // put in front of (`q` is the one it must follow most closely).
  const beside: [string, Partial<TaskFilter>, string][] = [
    ["status", { status: "open" }, `?status=open&lifeAreaId=${AREA_A}`],
    ["from", { from: "2026-08-01" }, `?from=2026-08-01&lifeAreaId=${AREA_A}`],
    ["to", { to: TODAY }, `?to=2026-08-24&lifeAreaId=${AREA_A}`],
    ["priority", { priority: "high" }, `?priority=high&lifeAreaId=${AREA_A}`],
    ["q", { q: "aluguel" }, `?q=aluguel&lifeAreaId=${AREA_A}`],
  ];

  for (const [dimension, set, expected] of beside) {
    it(`emits the area after ${dimension} when the two are set together`, () => {
      expect(toQuery({ ...EMPTY_FILTER, ...set, lifeAreaId: AREA_A })).toBe(expected);
    });
  }
});

describe("activeCount — the area counts once (life-areas PRD AC-13)", () => {
  it("counts an area id as one active dimension", () => {
    expect(activeCount({ ...EMPTY_FILTER, lifeAreaId: AREA_A })).toBe(1);
  });

  it("counts Sem área as one active dimension too — it narrows the list, it is not an absence", () => {
    expect(activeCount({ ...EMPTY_FILTER, lifeAreaId: "none" })).toBe(1);
  });

  it("adds the area to status, priority and a range: four dimensions", () => {
    const filter: TaskFilter = {
      status: "open",
      priority: "high",
      from: "2026-08-01",
      to: TODAY,
      q: null,
      lifeAreaId: AREA_A,
    };

    expect(activeCount(filter)).toBe(4);
  });

  it("keeps a range as one question beside an area: two, not three", () => {
    const ranged: TaskFilter = { ...EMPTY_FILTER, from: "2026-08-01", to: TODAY };

    expect(activeCount({ ...ranged, lifeAreaId: AREA_A })).toBe(2);
  });

  it("still counts q for nothing on its own", () => {
    expect(activeCount({ ...EMPTY_FILTER, q: "aluguel" })).toBe(0);
  });

  it("counts only the area when q sits beside it", () => {
    expect(activeCount({ ...EMPTY_FILTER, q: "aluguel", lifeAreaId: AREA_A })).toBe(1);
  });
});

describe("isChipActive and toggleChip — the area rides along untouched (life-areas PRD AC-13)", () => {
  it("reads no chip as pressed because of an area, whichever area value is set", () => {
    for (const lifeAreaId of [AREA_A, "none"]) {
      for (const chip of ["open", "today", "high"] as const) {
        expect(isChipActive({ ...EMPTY_FILTER, lifeAreaId }, chip, TODAY)).toBe(false);
      }
    }
  });

  it("still reads a chip from its own dimension when an area is set beside it", () => {
    const withArea: TaskFilter = { ...EMPTY_FILTER, lifeAreaId: AREA_A };

    expect(isChipActive({ ...withArea, status: "open" }, "open", TODAY)).toBe(true);
    expect(isChipActive({ ...withArea, to: TODAY }, "today", TODAY)).toBe(true);
    expect(isChipActive({ ...withArea, priority: "high" }, "high", TODAY)).toBe(true);
  });

  it("sets a chip's own dimension and leaves the area exactly as it was", () => {
    const withArea: TaskFilter = { ...EMPTY_FILTER, lifeAreaId: AREA_A };

    expect(toggleChip(withArea, "open", TODAY)).toEqual({ ...withArea, status: "open" });
    expect(toggleChip(withArea, "today", TODAY)).toEqual({ ...withArea, to: TODAY });
    expect(toggleChip(withArea, "high", TODAY)).toEqual({ ...withArea, priority: "high" });
  });

  it("keeps the area when a chip is switched off again", () => {
    const withArea: TaskFilter = { ...EMPTY_FILTER, lifeAreaId: AREA_A };
    const once = toggleChip(withArea, "open", TODAY);

    expect(toggleChip(once, "open", TODAY)).toEqual(withArea);
  });

  it("carries Sem área through a toggle as the literal none, never as null", () => {
    // `null` would mean "no area filter" here — the opposite of what was applied.
    const withoutArea: TaskFilter = { ...EMPTY_FILTER, lifeAreaId: "none" };

    const after = toggleChip(withoutArea, "high", TODAY);

    expect(after).toEqual({ ...withoutArea, priority: "high" });
    expect(after.lifeAreaId).toBe("none");
  });

  it("composes with the three chips into the one query the request carries", () => {
    // PRD AC-13 end to end, the area counterpart of the three-taps case above: an area picked
    // in the sheet, then three taps on the row — one request, four dimensions.
    let filter: TaskFilter = { ...EMPTY_FILTER, lifeAreaId: AREA_A };
    filter = toggleChip(filter, "open", TODAY);
    filter = toggleChip(filter, "today", TODAY);
    filter = toggleChip(filter, "high", TODAY);

    expect(toQuery(filter)).toBe(`?status=open&to=2026-08-24&priority=high&lifeAreaId=${AREA_A}`);
    expect(activeCount(filter)).toBe(4);
  });
});
