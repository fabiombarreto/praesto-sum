/**
 * The pure core of Life Areas (ADR-0015, life-areas PRD AC-12): the name limits,
 * the name validator, the duplicate key and the pt-BR comparator.
 *
 * The `/api/life-areas` route and, from phase 2, the *Áreas* screen both import
 * this module, so the two cannot drift on what a valid, a duplicate or an
 * ordered area name is. Like `search.ts` and `dates.ts` it is compiled into
 * every target, so it carries no DOM globals and no Worker globals.
 */

import { normalizeSearchText } from "./search";

/** The longest a Life Area name may be, counted after trimming (AC-12). */
export const LIFE_AREA_NAME_MAX = 40;

/** The most Life Areas the owner may hold at once (AC-12, ADR-0015). */
export const LIFE_AREA_LIMIT = 12;

/** Why a name is refused: nothing but whitespace, or longer than `LIFE_AREA_NAME_MAX`. */
export type LifeAreaNameError = "blank" | "too_long";

/**
 * Checks a raw name the way both the route and the screen must: it is trimmed
 * first, then judged. Returns an error code, or `null` when the name is valid
 * (the project's validator convention, as in `recurrenceDraftError`). AC-12.
 */
export function validateLifeAreaName(raw: string): LifeAreaNameError | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "blank";
  if (trimmed.length > LIFE_AREA_NAME_MAX) return "too_long";
  return null;
}

/**
 * The key two names are compared by when deciding whether they are the same
 * area: trimmed, NFC-normalized, lowercased and stripped of the pt-BR
 * diacritics `normalizeSearchText` maps. `Saúde`, `SAUDE` and ` saude ` share a
 * key; `Casa` and `Casas` do not. The trim is here because `normalizeSearchText`
 * does not trim, and NFC keeps a decomposed `u` + combining accent equal to the
 * precomposed `ú` its table maps. AC-12.
 */
export function lifeAreaNameKey(name: string): string {
  return normalizeSearchText(name.trim().normalize("NFC"));
}

const collator = new Intl.Collator("pt-BR");

/**
 * Orders two area names alphabetically in pt-BR (`Casa`, `Ética`, `Trabalho`),
 * never bytewise: a bytewise sort would put `Ética` after `Trabalho`. Usable
 * directly as an `Array.prototype.sort` comparator. AC-12 and AC-6.
 */
export function compareLifeAreaNames(a: string, b: string): number {
  return collator.compare(a, b);
}
