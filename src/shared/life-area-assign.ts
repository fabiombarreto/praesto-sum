/**
 * The pure decisions behind giving a Task or a series a Life Area and showing it
 * (life-areas PRD AC-14, AC-15, AC-20, AC-22; plan AC-A1, AC-A2, AC-A5, AC-A7):
 * what area a captured Task takes from the area filter, the id-to-name lookup the
 * row reads, the three states of the sheet's *Área* group, what a chip press
 * means and (phase 4, plan AC-A3) whether the applied area chip shows and what
 * names it.
 *
 * Extracted here so they are tested without a DOM, per `docs/context/methodology.md`
 * ("Browser-API work: split the logic out, then the glue is exempt"); the sheet, the
 * row and the hook are the exempt glue. Like `life-areas.ts` it carries no DOM
 * globals and no Worker globals, reads no clock and makes no request, so it compiles
 * into every target. It imports only `./api` (types) and `./life-areas`.
 */

import type { LifeAreaDto } from "./api";
import { compareLifeAreaNames } from "./life-areas";

/**
 * The one literal for "no area": the chip value in the sheet and the
 * `lifeAreaId=none` filter and query value. Ids are UUIDs, so it cannot collide with
 * one; the server already reserves it. Serves AC-A1 and AC-A5.
 */
export const NO_AREA_VALUE = "none";

/** What the sheet and the row need to know about an area: its id and its name. */
export type AreaOption = Pick<LifeAreaDto, "id" | "name">;

/**
 * The name of the area with that id — what the row appends to an open Task's meta
 * line. `null` when `areas` is `null` (not loaded, or the request failed: rows then
 * show no name, AC-22), when `lifeAreaId` is `null`, or when no loaded area has that
 * id (one deleted on another device). Serves AC-A2 and AC-A7.
 */
export function lifeAreaNameOf(
  areas: readonly AreaOption[] | null,
  lifeAreaId: string | null,
): string | null {
  if (areas === null || lifeAreaId === null) return null;
  return areas.find((area) => area.id === lifeAreaId)?.name ?? null;
}

/**
 * The three states of the Task sheet's *Área* group (AC-A5, AC-A7):
 * - `hidden`: the areas request failed or has not answered — the sheet offers
 *   nothing and says nothing, because "you have no areas" would be false;
 * - `empty`: he has no areas — one line and a button that opens *Áreas*;
 * - `choices`: the areas to pick from.
 */
export type AreaGroupView =
  { kind: "hidden" } | { kind: "empty" } | { kind: "choices"; options: readonly AreaOption[] };

/**
 * Decides which of the three states the group is in. `choices` holds a COPY of the
 * input sorted alphabetically in pt-BR by `compareLifeAreaNames` — the comparator is
 * reused, never re-implemented — and the argument is never mutated. Serves AC-A5 and
 * AC-A7.
 */
export function decideAreaGroup(areas: readonly AreaOption[] | null): AreaGroupView {
  if (areas === null) return { kind: "hidden" };
  if (areas.length === 0) return { kind: "empty" };
  const options = [...areas].sort((a, b) => compareLifeAreaNames(a.name, b.name));
  return { kind: "choices", options };
}

/**
 * The chip value that is selected for a Task's area: `NO_AREA_VALUE` for no area,
 * otherwise the area's own id. Serves AC-A5.
 *
 * For the Task sheet only: the filter's own value is already `NO_AREA_VALUE` or an id,
 * so mapping it through here would be wrong there.
 */
export function areaChoiceValue(lifeAreaId: string | null): string {
  return lifeAreaId === null ? NO_AREA_VALUE : lifeAreaId;
}

/**
 * Reads the single-choice group's pressed value back as an area id: `null` for no
 * pressed chip (tapping the pressed chip again clears the area, as *Prioridade*
 * does) and for the *Sem área* chip, otherwise the first element. Serves AC-A5.
 *
 * It maps `NO_AREA_VALUE` to `null`, which is right for the sheet ("no area") and
 * wrong for the filter, where `null` means "no filter" and `NO_AREA_VALUE` is itself
 * the value to keep.
 */
export function lifeAreaIdFromChoice(next: readonly string[]): string | null {
  const first = next[0];
  if (first === undefined || first === NO_AREA_VALUE) return null;
  return first;
}

/**
 * The area fields a newly captured Task carries, given the area-filter value
 * (AC-A1, PRD AC-14). The vocabulary is the one the filter's own field has:
 * `null` is no area filter and returns `{}` — NO `lifeAreaId` key at all, so the
 * create request is byte-identical to one sent without areas; `NO_AREA_VALUE` is
 * *Sem área* and returns an explicit `{ lifeAreaId: null }`; any other string is an
 * area id and returns `{ lifeAreaId: <id> }`.
 */
export function captureAreaFields(areaFilter: string | null): { lifeAreaId?: string | null } {
  if (areaFilter === null) return {};
  if (areaFilter === NO_AREA_VALUE) return { lifeAreaId: null };
  return { lifeAreaId: areaFilter };
}

/**
 * What the applied area chip in the quick-filter row says (plan AC-A3, PRD AC-21):
 * - `absent`: there is no area filter, so no chip;
 * - `no-area`: the filter is *Sem área*;
 * - `area`: the filter is an area the loaded list holds, with its `name`;
 * - `unknown`: the filter is an id the list does not hold.
 */
export type AreaFilterChipView =
  { kind: "absent" } | { kind: "no-area" } | { kind: "area"; name: string } | { kind: "unknown" };

/**
 * Whether the applied chip shows and what names it, given the area-filter value and
 * the areas as `useLifeAreas` holds them (plan AC-A3, PRD AC-21). `null` returns
 * `absent`; `NO_AREA_VALUE` returns `no-area` whatever `areas` holds, `null` included
 * (*Sem área* needs no list); any other string returns `area` with the name
 * `lifeAreaNameOf` finds, and `unknown` when it finds none.
 *
 * `unknown` exists so an applied narrowing filter is never hidden (layout standard
 * §2.3): an area deleted on another device, an empty list and a list that is `null`
 * because the request failed all land there, and the component shows a neutral label
 * for it instead of dropping the chip. The lookup is reused and `areas` is never
 * mutated.
 */
export function decideAreaFilterChip(
  areaFilter: string | null,
  areas: readonly AreaOption[] | null,
): AreaFilterChipView {
  if (areaFilter === null) return { kind: "absent" };
  if (areaFilter === NO_AREA_VALUE) return { kind: "no-area" };
  const name = lifeAreaNameOf(areas, areaFilter);
  return name === null ? { kind: "unknown" } : { kind: "area", name };
}
