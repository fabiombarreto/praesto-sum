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
    const filter: TaskFilter = {
      status: "open",
      priority: "high",
      from: "2026-08-01",
      to: TODAY,
      q: null,
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

  it("never exceeds three", () => {
    expect(
      activeCount({ status: "open", priority: "high", from: "2026-08-01", to: TODAY, q: null }),
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
    const rich: TaskFilter = {
      status: "done",
      priority: "low",
      from: "2026-08-01",
      to: "2026-09-30",
      q: null,
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

  it("EMPTY_FILTER has all five dimensions null", () => {
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
    expect(EMPTY_FILTER).toEqual({ status: null, priority: null, from: null, to: null, q: null });
  });
});
