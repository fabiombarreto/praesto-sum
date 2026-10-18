// PRPs/prds/life-areas.prd.md AC-19 Áreas screen (manual) — the decidable half of
// "lists his areas alphabetically with their open counts and a read-only Sem área
// row with its count" and of "he can add one, rename one in place and delete one".
//
// Source plan: PRPs/plans/life-areas-phase-2-the-reas-screen.plan.md
// (Task 1 — src/shared/life-areas-list.ts; plan AC-A2, AC-A3, AC-A4, AC-A5, AC-A6).
//
// The name rules and the limit are PRD AC-2 and AC-3: the route already enforces
// them (phase 1, test/life-areas-routes.test.ts). What this file adds is that the
// SCREEN applies the same rules before it sends a request, and that its list stays
// correct after each of its own writes without a refetch (the POST and PATCH
// answers carry no counts).
//
// PRD AC-19 is a manual criterion and names no function, so the names, the state
// and event shapes and the transition rules below are the ones the plan pins in
// Task 1's ACTION and in its Notes ("For the test pair"): INITIAL_LIFE_AREAS_LIST_STATE,
// reduceLifeAreasList (events loaded, load-failed, created, renamed, deleted; states
// loading, ready { areas, noAreaOpenTaskCount }, failed { message }), canCreateLifeArea,
// checkLifeAreaName and isLifeAreaRenameNoop. Nothing here asserts a private helper.
//
// Pure, DOM-free, clock-free. The React screen, its focus handling and its rendered
// layout are the exempt glue half of docs/context/methodology.md's "Browser-API
// work" split and stay manually verified (plan Task 9's checklist record).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/life-areas-list.ts does not exist yet, so this file is expected to be
// RED for the right reason — the module import cannot be resolved — until plan
// Task 1 lands. No other RED reason is expected.
//
// The ordering assertions discriminate: a bytewise sort puts `Ética` (U+00C9) after
// `Trabalho`; only a locale-aware comparison gets pt-BR order right.

import { describe, expect, it } from "vitest";
import type { LifeAreaDto, LifeAreaSummaryDto, LifeAreasResponse } from "../src/shared/api";
import { LIFE_AREA_LIMIT, LIFE_AREA_NAME_MAX } from "../src/shared/life-areas";
import {
  canCreateLifeArea,
  checkLifeAreaName,
  INITIAL_LIFE_AREAS_LIST_STATE,
  isLifeAreaRenameNoop,
  reduceLifeAreasList,
  type LifeAreasListState,
} from "../src/shared/life-areas-list";

const NOW = 1_760_000_000;

function summary(
  over: Partial<LifeAreaSummaryDto> & { id: string; name: string },
): LifeAreaSummaryDto {
  return {
    description: null,
    createdAt: NOW,
    updatedAt: NOW,
    openTaskCount: 0,
    taskCount: 0,
    seriesCount: 0,
    ...over,
  };
}

/** What POST and PATCH answer: the area itself, with no counts. */
function dto(over: Partial<LifeAreaDto> & { id: string; name: string }): LifeAreaDto {
  return { description: null, createdAt: NOW, updatedAt: NOW, ...over };
}

function ready(areas: LifeAreaSummaryDto[], noAreaOpenTaskCount = 0): LifeAreasListState {
  return { kind: "ready", areas, noAreaOpenTaskCount };
}

function response(areas: LifeAreaSummaryDto[], noAreaOpenTaskCount = 0): LifeAreasResponse {
  return { lifeAreas: areas, noArea: { openTaskCount: noAreaOpenTaskCount } };
}

/** The names of a ready list, in the order it would be rendered. */
function names(state: LifeAreasListState): string[] {
  if (state.kind !== "ready") throw new Error(`expected a ready list, got ${state.kind}`);
  return state.areas.map((area) => area.name);
}

/** `n` distinct areas, named so that no two share a duplicate key. */
function areasOf(n: number): LifeAreaSummaryDto[] {
  return Array.from({ length: n }, (_, index) =>
    summary({ id: `id-${index}`, name: `Area ${String.fromCharCode(65 + index)}` }),
  );
}

describe("INITIAL_LIFE_AREAS_LIST_STATE", () => {
  it("starts loading — the screen has not yet heard back from GET /api/life-areas", () => {
    expect(INITIAL_LIFE_AREAS_LIST_STATE).toEqual({ kind: "loading" });
  });
});

describe("reduceLifeAreasList — loaded (AC-19: alphabetical list, open counts, Sem área count)", () => {
  it("lists the areas in pt-BR alphabetical order, not bytewise", () => {
    const state = reduceLifeAreasList(INITIAL_LIFE_AREAS_LIST_STATE, {
      type: "loaded",
      response: response([
        summary({ id: "t", name: "Trabalho" }),
        summary({ id: "c", name: "Casa" }),
        summary({ id: "e", name: "Ética" }),
      ]),
    });

    expect(names(state)).toEqual(["Casa", "Ética", "Trabalho"]);
  });

  it("keeps every area's id, name and three counts, and takes the Sem área count from noArea", () => {
    const casa = summary({
      id: "c",
      name: "Casa",
      openTaskCount: 2,
      taskCount: 7,
      seriesCount: 1,
    });

    const state = reduceLifeAreasList(INITIAL_LIFE_AREAS_LIST_STATE, {
      type: "loaded",
      response: response([casa], 4),
    });

    expect(state).toEqual({ kind: "ready", areas: [casa], noAreaOpenTaskCount: 4 });
  });

  it("turns an empty response into a ready, empty list that still carries the Sem área count", () => {
    const state = reduceLifeAreasList(INITIAL_LIFE_AREAS_LIST_STATE, {
      type: "loaded",
      response: response([], 6),
    });

    expect(state).toEqual({ kind: "ready", areas: [], noAreaOpenTaskCount: 6 });
  });

  it("does not reorder the response it was handed", () => {
    const handed = response([
      summary({ id: "t", name: "Trabalho" }),
      summary({ id: "c", name: "Casa" }),
    ]);

    reduceLifeAreasList(INITIAL_LIFE_AREAS_LIST_STATE, { type: "loaded", response: handed });

    expect(handed.lifeAreas.map((area) => area.id)).toEqual(["t", "c"]);
  });

  it("recovers a failed screen: loaded is accepted from any state", () => {
    const failed: LifeAreasListState = { kind: "failed", message: "Sem conexão." };

    const state = reduceLifeAreasList(failed, {
      type: "loaded",
      response: response([summary({ id: "c", name: "Casa" })], 1),
    });

    expect(state.kind).toBe("ready");
    expect(names(state)).toEqual(["Casa"]);
  });

  it("replaces a list already on screen with the newer one (a refetch wins)", () => {
    const before = ready([summary({ id: "c", name: "Casa", openTaskCount: 1 })], 0);
    const casaNow = summary({ id: "c", name: "Casa", openTaskCount: 5 });
    const saude = summary({ id: "s", name: "Saúde" });

    const state = reduceLifeAreasList(before, {
      type: "loaded",
      response: response([casaNow, saude], 3),
    });

    expect(state).toEqual({ kind: "ready", areas: [casaNow, saude], noAreaOpenTaskCount: 3 });
  });
});

describe("reduceLifeAreasList — load-failed (AC-19: an inline, persistent error)", () => {
  it("moves a loading screen to a failed one that carries the message", () => {
    const state = reduceLifeAreasList(INITIAL_LIFE_AREAS_LIST_STATE, {
      type: "load-failed",
      message: "Sem conexão com o servidor.",
    });

    expect(state).toEqual({ kind: "failed", message: "Sem conexão com o servidor." });
  });

  it("moves a failed screen to a failed one that carries the newest message", () => {
    const state = reduceLifeAreasList(
      { kind: "failed", message: "primeira" },
      { type: "load-failed", message: "segunda" },
    );

    expect(state).toEqual({ kind: "failed", message: "segunda" });
  });

  it("keeps a list that is already on screen when a refresh fails", () => {
    const onScreen = ready([summary({ id: "c", name: "Casa", openTaskCount: 2 })], 1);

    const state = reduceLifeAreasList(onScreen, { type: "load-failed", message: "Sem conexão." });

    expect(state).toEqual(onScreen);
  });
});

describe("reduceLifeAreasList — created (AC-19: add; the POST answers no counts)", () => {
  it("puts the new area in its alphabetical position with zero counts", () => {
    const casa = summary({ id: "c", name: "Casa", openTaskCount: 2, taskCount: 4, seriesCount: 1 });
    const trabalho = summary({ id: "t", name: "Trabalho", openTaskCount: 1, taskCount: 1 });
    const etica = dto({ id: "e", name: "Ética" });

    const state = reduceLifeAreasList(ready([casa, trabalho], 2), {
      type: "created",
      lifeArea: etica,
    });

    expect(state).toEqual({
      kind: "ready",
      areas: [casa, { ...etica, openTaskCount: 0, taskCount: 0, seriesCount: 0 }, trabalho],
      noAreaOpenTaskCount: 2,
    });
  });

  it("adds the first area to an empty list", () => {
    const casa = dto({ id: "c", name: "Casa" });

    const state = reduceLifeAreasList(ready([], 3), { type: "created", lifeArea: casa });

    expect(state).toEqual({
      kind: "ready",
      areas: [{ ...casa, openTaskCount: 0, taskCount: 0, seriesCount: 0 }],
      noAreaOpenTaskCount: 3,
    });
  });

  it("is idempotent by id: the same created event applied twice adds one area", () => {
    const etica = dto({ id: "e", name: "Ética" });
    const event = { type: "created", lifeArea: etica } as const;

    const once = reduceLifeAreasList(ready([summary({ id: "c", name: "Casa" })]), event);
    const twice = reduceLifeAreasList(once, event);

    expect(names(twice)).toEqual(["Casa", "Ética"]);
  });

  it("never zeroes the counts of an area a refetch already brought in", () => {
    const casa = summary({ id: "c", name: "Casa", openTaskCount: 3, taskCount: 5, seriesCount: 1 });

    const state = reduceLifeAreasList(ready([casa], 0), {
      type: "created",
      lifeArea: dto({ id: "c", name: "Casa" }),
    });

    expect(state).toEqual(ready([casa], 0));
  });
});

describe("reduceLifeAreasList — renamed (AC-19: rename in place; the PATCH answers no counts)", () => {
  it("replaces the area's own fields from the event and keeps its three counts", () => {
    const casa = summary({ id: "c", name: "Casa", openTaskCount: 3, taskCount: 5, seriesCount: 1 });
    const saude = summary({ id: "s", name: "Saúde", openTaskCount: 1, taskCount: 1 });
    const lar = dto({ id: "c", name: "Lar", updatedAt: NOW + 60 });

    const state = reduceLifeAreasList(ready([casa, saude], 2), { type: "renamed", lifeArea: lar });

    expect(state).toEqual({
      kind: "ready",
      areas: [{ ...lar, openTaskCount: 3, taskCount: 5, seriesCount: 1 }, saude],
      noAreaOpenTaskCount: 2,
    });
  });

  it("moves the area to its new alphabetical position", () => {
    const list = ready([
      summary({ id: "c", name: "Casa" }),
      summary({ id: "s", name: "Saúde" }),
      summary({ id: "t", name: "Trabalho" }),
    ]);

    const toTheEnd = reduceLifeAreasList(list, {
      type: "renamed",
      lifeArea: dto({ id: "c", name: "Zeta" }),
    });
    const accented = reduceLifeAreasList(list, {
      type: "renamed",
      lifeArea: dto({ id: "t", name: "Ética" }),
    });

    expect(names(toTheEnd)).toEqual(["Saúde", "Trabalho", "Zeta"]);
    expect(names(accented)).toEqual(["Casa", "Ética", "Saúde"]);
  });

  it("accepts a case-only rename and keeps the counts", () => {
    const casa = summary({ id: "c", name: "Casa", openTaskCount: 2, taskCount: 2 });

    const state = reduceLifeAreasList(ready([casa]), {
      type: "renamed",
      lifeArea: dto({ id: "c", name: "casa" }),
    });

    expect(state).toEqual(ready([{ ...casa, name: "casa" }]));
  });

  it("ignores a rename for an area the list does not hold", () => {
    const onScreen = ready([summary({ id: "c", name: "Casa", openTaskCount: 2 })], 1);

    const state = reduceLifeAreasList(onScreen, {
      type: "renamed",
      lifeArea: dto({ id: "unknown", name: "Lar" }),
    });

    expect(state).toEqual(onScreen);
  });
});

describe("reduceLifeAreasList — deleted (AC-19: delete; its open Tasks become Sem área)", () => {
  it("removes the area and adds its OPEN count, not its Task count, to Sem área", () => {
    const casa = summary({
      id: "c",
      name: "Casa",
      openTaskCount: 3,
      taskCount: 10,
      seriesCount: 2,
    });
    const saude = summary({ id: "s", name: "Saúde", openTaskCount: 1, taskCount: 1 });

    const state = reduceLifeAreasList(ready([casa, saude], 2), { type: "deleted", id: "c" });

    expect(state).toEqual({ kind: "ready", areas: [saude], noAreaOpenTaskCount: 5 });
  });

  it("leaves the Sem área count alone when the area held no open Task", () => {
    const closedOnly = summary({ id: "c", name: "Casa", openTaskCount: 0, taskCount: 4 });

    const state = reduceLifeAreasList(ready([closedOnly], 7), { type: "deleted", id: "c" });

    expect(state).toEqual({ kind: "ready", areas: [], noAreaOpenTaskCount: 7 });
  });

  it("leaves a ready, empty list behind when the last area goes — the empty state", () => {
    const only = summary({ id: "c", name: "Casa", openTaskCount: 1 });

    const state = reduceLifeAreasList(ready([only], 0), { type: "deleted", id: "c" });

    expect(state).toEqual({ kind: "ready", areas: [], noAreaOpenTaskCount: 1 });
  });

  it("ignores a delete for an area the list does not hold, so a repeat adds nothing", () => {
    const onScreen = ready([summary({ id: "s", name: "Saúde", openTaskCount: 1 })], 2);

    const state = reduceLifeAreasList(onScreen, { type: "deleted", id: "gone" });

    expect(state).toEqual(onScreen);
  });
});

describe("reduceLifeAreasList — created, renamed and deleted apply only to a ready list", () => {
  const notReady: [string, LifeAreasListState][] = [
    ["loading", { kind: "loading" }],
    ["failed", { kind: "failed", message: "Sem conexão." }],
  ];

  it.each(notReady)("returns a %s screen unchanged for all three", (_label, state) => {
    const created = reduceLifeAreasList(state, {
      type: "created",
      lifeArea: dto({ id: "x", name: "Nova" }),
    });
    const renamed = reduceLifeAreasList(state, {
      type: "renamed",
      lifeArea: dto({ id: "x", name: "Outra" }),
    });
    const deleted = reduceLifeAreasList(state, { type: "deleted", id: "x" });

    expect(created).toEqual(state);
    expect(renamed).toEqual(state);
    expect(deleted).toEqual(state);
  });
});

describe("reduceLifeAreasList — a reducer is pure (React hands it the state it holds)", () => {
  it("does not mutate a frozen ready state for created, renamed or deleted", () => {
    const frozen: LifeAreasListState = Object.freeze({
      kind: "ready" as const,
      areas: Object.freeze([
        Object.freeze(summary({ id: "c", name: "Casa", openTaskCount: 1 })),
        Object.freeze(summary({ id: "t", name: "Trabalho" })),
      ]),
      noAreaOpenTaskCount: 2,
    });

    const created = reduceLifeAreasList(frozen, {
      type: "created",
      lifeArea: dto({ id: "e", name: "Ética" }),
    });
    const renamed = reduceLifeAreasList(frozen, {
      type: "renamed",
      lifeArea: dto({ id: "t", name: "Academia" }),
    });
    const deleted = reduceLifeAreasList(frozen, { type: "deleted", id: "c" });

    expect(names(created)).toEqual(["Casa", "Ética", "Trabalho"]);
    expect(names(renamed)).toEqual(["Academia", "Casa"]);
    expect(names(deleted)).toEqual(["Trabalho"]);
    expect(names(frozen)).toEqual(["Casa", "Trabalho"]);
  });
});

describe("canCreateLifeArea — the add form exists until the limit (PRD AC-3 at the screen)", () => {
  it("is false while the list has not loaded and when it failed", () => {
    expect(canCreateLifeArea({ kind: "loading" })).toBe(false);
    expect(canCreateLifeArea({ kind: "failed", message: "Sem conexão." })).toBe(false);
  });

  it("is true for an empty list and for one area short of the limit", () => {
    expect(canCreateLifeArea(ready([]))).toBe(true);
    expect(canCreateLifeArea(ready(areasOf(LIFE_AREA_LIMIT - 1)))).toBe(true);
  });

  it("is false at the limit", () => {
    expect(canCreateLifeArea(ready(areasOf(LIFE_AREA_LIMIT)))).toBe(false);
  });

  it("turns false when the twelfth area is created and true again when one is deleted", () => {
    const eleven = ready(areasOf(LIFE_AREA_LIMIT - 1));

    const atLimit = reduceLifeAreasList(eleven, {
      type: "created",
      lifeArea: dto({ id: "twelfth", name: "Doze" }),
    });
    const afterDelete = reduceLifeAreasList(atLimit, { type: "deleted", id: "twelfth" });

    expect(canCreateLifeArea(atLimit)).toBe(false);
    expect(canCreateLifeArea(afterDelete)).toBe(true);
  });
});

describe("checkLifeAreaName — the screen refuses before it sends (PRD AC-2 at the screen)", () => {
  const areas = [
    { id: "casa-id", name: "Casa" },
    { id: "saude-id", name: "Saúde" },
  ];
  const tooLong = "a".repeat(LIFE_AREA_NAME_MAX + 1);

  it.each([
    ["an empty string", ""],
    ["spaces only", "   "],
    ["tabs and newlines only", "\t\n "],
  ])("reports %s as blank", (_label, raw) => {
    expect(checkLifeAreaName(raw, areas, null)).toBe("blank");
  });

  it("reports a name over the maximum as too_long and accepts exactly the maximum", () => {
    expect(checkLifeAreaName(tooLong, areas, null)).toBe("too_long");
    expect(checkLifeAreaName("a".repeat(LIFE_AREA_NAME_MAX), areas, null)).toBeNull();
  });

  it("measures the length after trimming", () => {
    expect(checkLifeAreaName(` ${"a".repeat(LIFE_AREA_NAME_MAX)} `, areas, null)).toBeNull();
  });

  it.each([
    ["the same name", "Casa"],
    ["another case", "casa"],
    ["no accent", "saude"],
    ["upper case, accent and padding", " SAÚDE "],
    ["a decomposed accent", "Saúde".normalize("NFD")],
  ])("reports %s as a duplicate of an existing area", (_label, raw) => {
    expect(checkLifeAreaName(raw, areas, null)).toBe("duplicate");
  });

  it("does not call a merely similar name a duplicate", () => {
    expect(checkLifeAreaName("Casas", areas, null)).toBeNull();
    expect(checkLifeAreaName("Trabalho", areas, null)).toBeNull();
  });

  it("accepts any valid name when the owner has no area yet", () => {
    expect(checkLifeAreaName("Casa", [], null)).toBeNull();
  });

  it("accepts renaming an area to its own name in another case or without an accent", () => {
    expect(checkLifeAreaName("casa", areas, "casa-id")).toBeNull();
    expect(checkLifeAreaName("Saude", areas, "saude-id")).toBeNull();
  });

  it("still refuses a rename onto another area's name", () => {
    expect(checkLifeAreaName("casa", areas, "saude-id")).toBe("duplicate");
    expect(checkLifeAreaName("SAUDE", areas, "casa-id")).toBe("duplicate");
  });

  it("still reports blank and too_long on a rename", () => {
    expect(checkLifeAreaName("  ", areas, "casa-id")).toBe("blank");
    expect(checkLifeAreaName(tooLong, areas, "casa-id")).toBe("too_long");
  });
});

describe("isLifeAreaRenameNoop — only an unchanged name skips the request (AC-19 rename)", () => {
  it("is true for the same name, with or without surrounding space", () => {
    expect(isLifeAreaRenameNoop("Casa", "Casa")).toBe(true);
    expect(isLifeAreaRenameNoop("  Casa ", "Casa")).toBe(true);
  });

  it("is false for a case-only change, so it is still sent", () => {
    expect(isLifeAreaRenameNoop("casa", "Casa")).toBe(false);
  });

  it("is false for an accent-only change, so it is still sent", () => {
    expect(isLifeAreaRenameNoop("Saude", "Saúde")).toBe(false);
  });

  it("is false for a different name and for a blank draft", () => {
    expect(isLifeAreaRenameNoop("Lar", "Casa")).toBe(false);
    expect(isLifeAreaRenameNoop("   ", "Casa")).toBe(false);
  });
});
