/**
 * The pure list behind the *Áreas* screen (life-areas PRD AC-19, plan AC-A2 to
 * AC-A5): what the list holds, how it changes after each of the screen's own
 * writes, and the client-side name check built on the phase 1 rules in
 * `./life-areas`.
 *
 * `POST` and `PATCH /api/life-areas` answer the area with no counts, so the
 * screen cannot simply replace an entry with the response: a new area holds
 * nothing, and a renamed one keeps the counts it already showed. That arithmetic
 * is decidable, so it lives here and is tested; the React screen only wires it.
 *
 * Like `google-settings.ts` and `connectivity.ts` it is total and side-effect
 * free, and like `life-areas.ts` it is compiled into every target, so it
 * carries no DOM globals, no Worker globals, no clock and no network. It
 * imports only its siblings `./api` (types) and `./life-areas` (the rules).
 */

import type { LifeAreaDto, LifeAreaSummaryDto, LifeAreasResponse } from "./api";
import {
  compareLifeAreaNames,
  LIFE_AREA_LIMIT,
  lifeAreaNameKey,
  validateLifeAreaName,
} from "./life-areas";

/**
 * What the *Áreas* screen shows: nothing yet, the areas with their counts plus
 * the read-only *Sem área* count (plan AC-A2), or a failed first load (AC-A6).
 */
export type LifeAreasListState =
  | { kind: "loading" }
  | {
      kind: "ready";
      areas: readonly LifeAreaSummaryDto[];
      /** Open Tasks that carry no area — a count, never a stored area (D-O). */
      noAreaOpenTaskCount: number;
    }
  | { kind: "failed"; message: string };

export const INITIAL_LIFE_AREAS_LIST_STATE: LifeAreasListState = { kind: "loading" };

export type LifeAreasListEvent =
  | { type: "loaded"; response: LifeAreasResponse }
  | { type: "load-failed"; message: string }
  | { type: "created"; lifeArea: LifeAreaDto }
  | { type: "renamed"; lifeArea: LifeAreaDto }
  | { type: "deleted"; id: string };

/** A copy sorted alphabetically in pt-BR; the order is a property of this module, not of the caller. */
function sortedByName(areas: readonly LifeAreaSummaryDto[]): LifeAreaSummaryDto[] {
  return [...areas].sort((a, b) => compareLifeAreaNames(a.name, b.name));
}

/**
 * Applies one event to the list (plan AC-A2). An event that does not apply to
 * the current `kind` — a write acknowledged for an area the list does not hold,
 * or any write while nothing is loaded — returns the state unchanged, so a
 * repeated or late event can never corrupt what is on screen.
 */
export function reduceLifeAreasList(
  state: LifeAreasListState,
  event: LifeAreasListEvent,
): LifeAreasListState {
  switch (event.type) {
    case "loaded":
      return {
        kind: "ready",
        areas: sortedByName(event.response.lifeAreas),
        noAreaOpenTaskCount: event.response.noArea.openTaskCount,
      };
    case "load-failed":
      // A list already on screen is still true, just not the newest: a failed
      // refresh must not blank it (AC-A6, guidelines §8).
      return state.kind === "ready" ? state : { kind: "failed", message: event.message };
    case "created": {
      if (state.kind !== "ready") return state;
      if (state.areas.some((area) => area.id === event.lifeArea.id)) return state;
      // The POST answers no counts and a new area holds nothing.
      const created: LifeAreaSummaryDto = {
        ...event.lifeArea,
        openTaskCount: 0,
        taskCount: 0,
        seriesCount: 0,
      };
      return { ...state, areas: sortedByName([...state.areas, created]) };
    }
    case "renamed": {
      if (state.kind !== "ready") return state;
      if (!state.areas.some((area) => area.id === event.lifeArea.id)) return state;
      // The PATCH answers no counts: the entry keeps the three it already had.
      const areas = state.areas.map((area) =>
        area.id === event.lifeArea.id
          ? {
              ...area,
              name: event.lifeArea.name,
              description: event.lifeArea.description,
              createdAt: event.lifeArea.createdAt,
              updatedAt: event.lifeArea.updatedAt,
            }
          : area,
      );
      return { ...state, areas: sortedByName(areas) };
    }
    case "deleted": {
      if (state.kind !== "ready") return state;
      const gone = state.areas.find((area) => area.id === event.id);
      if (gone === undefined) return state;
      // Its open Tasks are not deleted: they become *Sem área* (ADR-0015).
      return {
        ...state,
        areas: state.areas.filter((area) => area.id !== event.id),
        noAreaOpenTaskCount: state.noAreaOpenTaskCount + gone.openTaskCount,
      };
    }
  }
}

/** `true` only for a loaded list below the 12-area limit — the add form exists until then (plan AC-A3). */
export function canCreateLifeArea(state: LifeAreasListState): boolean {
  return state.kind === "ready" && state.areas.length < LIFE_AREA_LIMIT;
}

/** Why the screen refuses a name before it sends anything (plan AC-A3, AC-A4). */
export type LifeAreaNameProblem = "blank" | "too_long" | "duplicate";

/**
 * The same name rules the route enforces, applied before a request is built
 * (plan AC-A3, AC-A4): `validateLifeAreaName` first (`blank`, `too_long`), then
 * `duplicate` when another area has the same `lifeAreaNameKey`. `ownId` is the
 * area being renamed, so `Casa` to `casa` — its own name in another case — is
 * not a duplicate of itself. Returns `null` for a name that may be sent; the
 * server stays authoritative and answers 409 on the same rule.
 */
export function checkLifeAreaName(
  raw: string,
  areas: readonly Pick<LifeAreaDto, "id" | "name">[],
  ownId: string | null,
): LifeAreaNameProblem | null {
  const invalid = validateLifeAreaName(raw);
  if (invalid !== null) return invalid;
  const key = lifeAreaNameKey(raw);
  const taken = areas.some((area) => area.id !== ownId && lifeAreaNameKey(area.name) === key);
  return taken ? "duplicate" : null;
}

/**
 * `true` only when the draft, trimmed, is exactly the current name, so an
 * unchanged rename sends no request while a case-only or accent-only change is
 * still sent (plan AC-A4).
 */
export function isLifeAreaRenameNoop(draft: string, currentName: string): boolean {
  return draft.trim() === currentName;
}
