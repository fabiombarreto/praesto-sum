/**
 * The single normalization definition for text search over Tasks (PRD
 * AC-11). One `DIACRITIC_MAP` table generates BOTH the JavaScript normalizer
 * (`normalizeSearchText`/`searchWords`, used to turn the caller's `q` into
 * words) and the SQL expression (`buildNormalizedSqlExpression`, used to
 * normalize the columns being searched) — so the two sides cannot drift.
 *
 * Like `src/shared/task-filter.ts`, `task-groups.ts`, `format.ts` and
 * `dates.ts`, this module is compiled into BOTH the browser and the Worker
 * projects, so it stays environment-agnostic: no DOM globals, no runtime
 * dependencies, and no reads of the clock. Every function here is a pure
 * transform of its arguments.
 */

import { sql, type SQL } from "drizzle-orm";
import { MAX_SEARCH_QUERY_LENGTH } from "./api";

/**
 * Lowercase pt-BR accented characters mapped to their base ASCII letter.
 * SQLite's own `lower()` only folds ASCII, so `buildNormalizedSqlExpression`
 * also chains a `replace()` for the UPPERCASE form of every entry here — see
 * that function's own comment.
 */
export const DIACRITIC_MAP: Readonly<Record<string, string>> = {
  á: "a",
  à: "a",
  â: "a",
  ã: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  õ: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
};

/**
 * Lowercases `text`, then replaces every character present in
 * `DIACRITIC_MAP` with its mapped base letter. This is the JavaScript half
 * of AC-11 — `buildNormalizedSqlExpression` is the SQL half, generated from
 * the same table.
 */
export function normalizeSearchText(text: string): string {
  const lowered = text.toLowerCase();
  let result = "";
  for (const char of lowered) {
    result += DIACRITIC_MAP[char] ?? char;
  }
  return result;
}

/**
 * Trims `query`, splits on whitespace, drops empty tokens produced by
 * repeated or trailing whitespace, and normalizes each remaining token.
 */
export function searchWords(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map(normalizeSearchText);
}

/**
 * Renders `value` as a single-quoted SQL string literal, doubling every
 * embedded single quote — the standard SQL escaping rule — so the generator
 * stays correct even if a future `DIACRITIC_MAP` entry contains a quote.
 * Only ever called with compile-time constants from `DIACRITIC_MAP`, never
 * with user input.
 */
function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Wraps `expr` in `lower(...)`, then chains a `replace()` for every
 * `DIACRITIC_MAP` entry, in BOTH cases. Both cases are needed because
 * SQLite's `lower()` only folds ASCII — an uppercase accented letter (e.g.
 * `Á`) passes through `lower()` unchanged, and only the chained `replace()`
 * for the uppercase form catches it. This is the SQL half of AC-11,
 * generated from the same `DIACRITIC_MAP` table `normalizeSearchText` uses,
 * so the two sides cannot drift.
 *
 * The accented and base characters are embedded as SQL string literals via
 * `sql.raw`, never bound as parameters: binding them would put two
 * parameters into every `replace()` — roughly 92 per normalized column,
 * doubled for title and description — and D1 rejects any statement over 100
 * bound parameters with "too many SQL variables" (found by the phase-1
 * suite on attempt 1). Embedding is safe because the literals are
 * compile-time constants from `DIACRITIC_MAP`, never user input. The only
 * bound parameter this module ever adds is the search word itself, in
 * `buildSearchClauses`.
 */
export function buildNormalizedSqlExpression(expr: SQL): SQL {
  let result = sql`lower(${expr})`;
  for (const [accented, base] of Object.entries(DIACRITIC_MAP)) {
    const accentedLiteral = sql.raw(sqlStringLiteral(accented));
    const upperLiteral = sql.raw(sqlStringLiteral(accented.toUpperCase()));
    const baseLiteral = sql.raw(sqlStringLiteral(base));
    result = sql`replace(replace(${result}, ${accentedLiteral}, ${baseLiteral}), ${upperLiteral}, ${baseLiteral})`;
  }
  return result;
}

/**
 * The decidable half of AC-A2 (text-search phase 2): typing fewer than this
 * many characters (after trimming) fires no request. Extracted here rather
 * than folded into `SearchScreen.tsx` so the predicate is tested directly,
 * per `docs/context/methodology.md`'s "Browser-API work" split — the
 * exemption is for glue, never for logic.
 */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/**
 * Whether `raw`, after trimming, is long enough to search for (AC-A2). A
 * pure, single-argument, no-DOM predicate, exactly like `normalizeSearchText`
 * above.
 */
export function shouldSearch(raw: string): boolean {
  return raw.trim().length >= SEARCH_MIN_QUERY_LENGTH;
}

export type SearchQueryValidation = { ok: true; words: string[] } | { ok: false; error: string };

/**
 * Validates the raw `q` query parameter (AC-8): rejects blank/whitespace-only
 * and over-length queries, naming `q` in the error. On success, returns the
 * normalized words `buildSearchClauses` turns into one `instr()` clause each.
 */
export function validateSearchQuery(raw: string): SearchQueryValidation {
  if (raw.trim().length === 0) {
    return { ok: false, error: "q must not be blank" };
  }
  if (raw.length > MAX_SEARCH_QUERY_LENGTH) {
    return { ok: false, error: `q must be at most ${MAX_SEARCH_QUERY_LENGTH} characters` };
  }
  return { ok: true, words: searchWords(raw) };
}

export type SearchClausesResult = { ok: true; clauses: SQL[] } | { ok: false; error: string };

/**
 * Validates `raw` via `validateSearchQuery`, then — on success — builds one
 * bound-parameter `instr(searchable, word) > 0` clause per word, where
 * `searchable` is the normalized `titleColumn` and the normalized, `NULL`-
 * coalesced `descriptionColumn` joined by a newline. The newline join keeps
 * a word from ever matching across the title/description boundary (AC-4).
 * Forwards the `{ ok: false }` shape from validation unchanged.
 */
export function buildSearchClauses(
  raw: string,
  titleColumn: SQL,
  descriptionColumn: SQL,
): SearchClausesResult {
  const validated = validateSearchQuery(raw);
  if (!validated.ok) return validated;

  const normalizedTitle = buildNormalizedSqlExpression(titleColumn);
  const normalizedDescription = buildNormalizedSqlExpression(
    sql`coalesce(${descriptionColumn}, '')`,
  );
  const searchable = sql`${normalizedTitle} || char(10) || ${normalizedDescription}`;

  const clauses = validated.words.map((word) => sql`instr(${searchable}, ${word}) > 0`);

  return { ok: true, clauses };
}
