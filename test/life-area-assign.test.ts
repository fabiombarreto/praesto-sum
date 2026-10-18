// PRPs/prds/life-areas.prd.md AC-14 Capture inherits the filter (the pure decision)
// PRPs/prds/life-areas.prd.md AC-20 Task sheet (manual) — the decidable half: the *Área*
// group's choices and what a pressed chip means
// PRPs/prds/life-areas.prd.md AC-22 Degraded states (manual) — the decidable half: a failed
// areas request is "absent", never "you have no areas"
//
// Source plan: PRPs/plans/life-areas-phase-3-assign-and-show.plan.md
// (Task 3 — src/shared/life-area-assign.ts; plan AC-A1, AC-A5, AC-A7, and AC-A2's name lookup).
//
// PRD AC-14 is the one criterion of this row that is decidable as written: "the decision is a
// pure function tested without the DOM". AC-20 and AC-22 are manual (the sheet and the row are
// React, and this project's only test tier is Vitest inside workerd, which has no DOM), but the
// plan extracts the decisions behind them into this module — the same split
// docs/context/methodology.md records under "Browser-API work: split the logic out, then the
// glue is exempt". What is asserted below is therefore the plan's pinned contract of
// `src/shared/life-area-assign.ts`, clause by clause; the chips, the copy and the wiring are
// verified by hand and recorded in the phase's ui-checklist.md.
//
// The vocabulary is the one PRD AC-13 gives the filter's own field and the server already
// reserves: `null` is "no area filter", the literal `"none"` is *Sem área* (never a stored
// area), any other string is an area id.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): src/shared/life-area-assign.ts
// does not exist yet, so this file is expected to be RED for the right reason — the module
// import cannot be resolved — until plan Task 3 lands. No other RED reason is expected.
//
// The ordering assertions discriminate: a bytewise sort puts `Ética` (U+00C9) after
// `Trabalho`, and uppercase letters before lowercase ones; only a locale-aware comparison
// gets pt-BR order right.

import { describe, expect, it } from "vitest";
import {
  areaChoiceValue,
  captureAreaFields,
  decideAreaFilterChip,
  decideAreaGroup,
  lifeAreaIdFromChoice,
  lifeAreaNameOf,
  NO_AREA_VALUE,
  type AreaOption,
} from "../src/shared/life-area-assign";

const CASA: AreaOption = { id: "3f2c9d1e-0000-4000-8000-000000000001", name: "Casa" };
const ETICA: AreaOption = { id: "3f2c9d1e-0000-4000-8000-000000000002", name: "Ética" };
const TRABALHO: AreaOption = { id: "3f2c9d1e-0000-4000-8000-000000000003", name: "Trabalho" };

describe("NO_AREA_VALUE", () => {
  it("is the reserved literal 'none' that the sheet's chip, the filter and the query share for Sem área", () => {
    expect(NO_AREA_VALUE).toBe("none");
  });
});

describe("captureAreaFields — what area a captured Task takes from the area filter (PRD AC-14)", () => {
  it("adds no lifeAreaId key at all when no area filter is active", () => {
    const fields = captureAreaFields(null);

    expect(fields).toEqual({});
    expect(Object.keys(fields)).toEqual([]);
    expect(fields).not.toHaveProperty("lifeAreaId");
  });

  it("carries an explicit null for Sem área, so the create request says 'no area' on purpose", () => {
    const fields = captureAreaFields("none");

    expect(fields).toHaveProperty("lifeAreaId", null);
    expect(fields).toEqual({ lifeAreaId: null });
  });

  it("carries the area id when the filter is an area", () => {
    expect(captureAreaFields(CASA.id)).toEqual({ lifeAreaId: CASA.id });
  });

  it("treats only the exact reserved value as Sem área — any other string is an area id", () => {
    expect(captureAreaFields("none-of-these")).toEqual({ lifeAreaId: "none-of-these" });
  });

  it("leaves the create body of marcar consulta with exactly its title when no filter is active", () => {
    const body = { title: "marcar consulta", ...captureAreaFields(null) };

    expect(Object.keys(body)).toEqual(["title"]);
  });

  it("adds lifeAreaId: null to the create body of marcar consulta under the Sem área filter", () => {
    const body = { title: "marcar consulta", ...captureAreaFields(NO_AREA_VALUE) };

    expect(body).toEqual({ title: "marcar consulta", lifeAreaId: null });
  });

  it("adds the area id to the create body of marcar consulta under an area filter", () => {
    const body = { title: "marcar consulta", ...captureAreaFields(CASA.id) };

    expect(body).toEqual({ title: "marcar consulta", lifeAreaId: CASA.id });
  });
});

describe("lifeAreaNameOf — the name a row shows for its Task's area (PRD AC-15, AC-22)", () => {
  const areas: AreaOption[] = [CASA, ETICA, TRABALHO];

  it("returns the name of the area with that id, wherever it sits in the list", () => {
    expect(lifeAreaNameOf(areas, CASA.id)).toBe("Casa");
    expect(lifeAreaNameOf(areas, ETICA.id)).toBe("Ética");
    expect(lifeAreaNameOf(areas, TRABALHO.id)).toBe("Trabalho");
  });

  it("returns null for a Task with no area", () => {
    expect(lifeAreaNameOf(areas, null)).toBeNull();
  });

  it("returns null when the areas request failed or has not answered — rows show no name (AC-22)", () => {
    expect(lifeAreaNameOf(null, CASA.id)).toBeNull();
  });

  it("returns null for an id no loaded area has, such as an area deleted on another device", () => {
    expect(lifeAreaNameOf(areas, "3f2c9d1e-0000-4000-8000-0000000000ff")).toBeNull();
  });

  it("returns null against an empty list", () => {
    expect(lifeAreaNameOf([], CASA.id)).toBeNull();
  });
});

describe("decideAreaGroup — the three states of the Área group (PRD AC-20, AC-22)", () => {
  it("hides the group when the areas request failed or has not answered", () => {
    // "You have no areas" would be false here: the sheet offers nothing and says nothing.
    expect(decideAreaGroup(null)).toEqual({ kind: "hidden" });
  });

  it("asks for the one-line empty state, not the group, when the owner has no areas", () => {
    expect(decideAreaGroup([])).toEqual({ kind: "empty" });
  });

  it("offers a single area as a choice group, not as the empty state", () => {
    expect(decideAreaGroup([CASA])).toEqual({ kind: "choices", options: [CASA] });
  });

  it("offers the areas alphabetically in pt-BR, not bytewise", () => {
    const group = decideAreaGroup([TRABALHO, CASA, ETICA]);

    expect(group).toEqual({ kind: "choices", options: [CASA, ETICA, TRABALHO] });
  });

  it("orders by name regardless of case and accent: casa, Ética, Saúde, Trabalho", () => {
    const group = decideAreaGroup([
      { id: "d", name: "Trabalho" },
      { id: "c", name: "Saúde" },
      { id: "a", name: "casa" },
      { id: "b", name: "Ética" },
    ]);

    expect(group).toEqual({
      kind: "choices",
      options: [
        { id: "a", name: "casa" },
        { id: "b", name: "Ética" },
        { id: "c", name: "Saúde" },
        { id: "d", name: "Trabalho" },
      ],
    });
  });

  it("never reorders or mutates the list it was given", () => {
    // A frozen array makes an in-place sort throw, so a mutating implementation cannot pass.
    const input: readonly AreaOption[] = Object.freeze([TRABALHO, CASA, ETICA]);

    const group = decideAreaGroup(input);

    expect(input.map((area) => area.name)).toEqual(["Trabalho", "Casa", "Ética"]);
    if (group.kind !== "choices") throw new Error(`expected choices, got ${group.kind}`);
    expect(group.options).not.toBe(input);
  });
});

describe("areaChoiceValue and lifeAreaIdFromChoice — what a chip press means (PRD AC-20)", () => {
  it("selects the Sem área chip for a Task with no area", () => {
    expect(areaChoiceValue(null)).toBe(NO_AREA_VALUE);
  });

  it("selects the chip whose value is the area's own id", () => {
    expect(areaChoiceValue(CASA.id)).toBe(CASA.id);
  });

  it("reads no pressed chip as no area — tapping the pressed chip again clears the area", () => {
    expect(lifeAreaIdFromChoice([])).toBeNull();
  });

  it("reads the Sem área chip as no area, never as an id", () => {
    expect(lifeAreaIdFromChoice([NO_AREA_VALUE])).toBeNull();
  });

  it("reads an area chip as that area's id", () => {
    expect(lifeAreaIdFromChoice([CASA.id])).toBe(CASA.id);
  });

  it("reads the first element of a choice with more than one value", () => {
    expect(lifeAreaIdFromChoice([ETICA.id, CASA.id])).toBe(ETICA.id);
  });

  it("round-trips: the chip a Task's area selects reads back as that same area", () => {
    for (const lifeAreaId of [null, CASA.id, ETICA.id]) {
      expect(lifeAreaIdFromChoice([areaChoiceValue(lifeAreaId)])).toBe(lifeAreaId);
    }
  });
});

// PRPs/prds/life-areas.prd.md AC-21 Filter sheet (manual) — the decidable half: whether the
// applied area chip shows and what names it (life-areas phase 4, plan AC-A3 and Task 2 —
// `decideAreaFilterChip` in src/shared/life-area-assign.ts)
//
// AC-21 is manual (the sheet and the chip row are React), but it says the picked area "appears
// as a selected chip" and layout standard §2.3 says a narrowing filter never survives silently.
// The plan extracts the one decidable part of that — an applied narrowing filter is never
// hidden — into this module and pins its name, inputs and outputs. What the component prints for
// each kind (the area's name, *Sem área*, the neutral *Área*) is a literal in FilterChips.tsx
// and is deliberately not pinned here.
//
// The vocabulary is the one `captureAreaFields` above already uses for the filter's own field:
// `null` is no area filter, `"none"` is Sem área, any other string is an area id. Unlike the
// Task sheet's `areaChoiceValue` / `lifeAreaIdFromChoice`, the filter keeps `"none"` as `"none"`.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `decideAreaFilterChip` is not
// exported yet, so every case below is expected to be RED for the right reason — the call hits
// `decideAreaFilterChip is not a function` — until plan Task 2 lands. The rest of the file keeps
// loading and keeps passing, because a missing named export is `undefined`, not an import error.

describe("decideAreaFilterChip — whether the applied area chip shows and what names it (PRD AC-21)", () => {
  const areas: AreaOption[] = [CASA, ETICA, TRABALHO];
  const DELETED_ELSEWHERE = "3f2c9d1e-0000-4000-8000-0000000000ff";

  it("shows no chip when no area filter is applied, whatever the list holds", () => {
    expect(decideAreaFilterChip(null, null)).toEqual({ kind: "absent" });
    expect(decideAreaFilterChip(null, [])).toEqual({ kind: "absent" });
    expect(decideAreaFilterChip(null, areas)).toEqual({ kind: "absent" });
  });

  it("names Sem área's chip without needing the list — it is never looked up", () => {
    expect(decideAreaFilterChip(NO_AREA_VALUE, null)).toEqual({ kind: "no-area" });
    expect(decideAreaFilterChip(NO_AREA_VALUE, [])).toEqual({ kind: "no-area" });
    expect(decideAreaFilterChip(NO_AREA_VALUE, areas)).toEqual({ kind: "no-area" });
  });

  it("names an applied area by its own name, wherever it sits in the list", () => {
    expect(decideAreaFilterChip(CASA.id, areas)).toEqual({ kind: "area", name: "Casa" });
    expect(decideAreaFilterChip(ETICA.id, areas)).toEqual({ kind: "area", name: "Ética" });
    expect(decideAreaFilterChip(TRABALHO.id, areas)).toEqual({ kind: "area", name: "Trabalho" });
  });

  it("keeps the chip, as unknown, for an area the list does not hold — it is never dropped", () => {
    // An area deleted on another device, an empty list and a failed request all land here: an
    // applied narrowing filter must stay visible (layout standard §2.3), so it is "unknown",
    // not "absent".
    expect(decideAreaFilterChip(DELETED_ELSEWHERE, areas)).toEqual({ kind: "unknown" });
    expect(decideAreaFilterChip(CASA.id, [])).toEqual({ kind: "unknown" });
    expect(decideAreaFilterChip(CASA.id, null)).toEqual({ kind: "unknown" });
  });

  it("hides an applied filter in no state of the list: only 'no filter' is absent", () => {
    for (const areaFilter of [CASA.id, DELETED_ELSEWHERE, NO_AREA_VALUE]) {
      for (const list of [null, [], areas]) {
        expect(decideAreaFilterChip(areaFilter, list)).not.toEqual({ kind: "absent" });
      }
    }
  });

  it("leaves the list it was given as it found it", () => {
    // A frozen array makes an in-place sort throw, so a mutating implementation cannot pass.
    const input: readonly AreaOption[] = Object.freeze([TRABALHO, CASA, ETICA]);

    decideAreaFilterChip(CASA.id, input);

    expect(input.map((area) => area.name)).toEqual(["Trabalho", "Casa", "Ética"]);
  });
});
