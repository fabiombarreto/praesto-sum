// PRPs/prds/text-search.prd.md AC-11 One normalization, two implementations that agree
//
// The half of AC-11 that explicitly must be proven "evaluated by D1": the
// SQL expression `buildNormalizedSqlExpression` generates must return
// exactly what `normalizeSearchText` returns, for every character
// `DIACRITIC_MAP` folds — in BOTH cases, because SQLite's own `lower()` only
// folds ASCII, so an uppercase accented letter passing through `lower()`
// unchanged (and only the chained `replace()`s catching it) is exactly the
// silent-miss defect this test exists to catch (Risk table, this phase's
// plan: "JS and SQL normalization disagree on a character, so a query
// silently misses a Task").
//
// Runs inside workerd against the real D1 binding (`env.DB`, via
// `createDb`), the same binding `test/task-list-filters.test.ts` and
// `test/tasks.test.ts` use — but writes no row and needs no table reset:
// each case evaluates a literal string through the generated SQL expression
// directly (`select <expr> as value`), with no FROM clause, which the
// underlying SQLite/D1 engine supports natively.
//
// The character list mirrors this phase's plan (Task 2, CREATE
// src/shared/search.ts): "á à â ã ä → a; é è ê ë → e; í ì î ï → i;
// ó ò ô õ ö → o; ú ù û ü → u; ç → c" — both cases of each.

import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { buildNormalizedSqlExpression, normalizeSearchText } from "../src/shared/search";
import { createDb } from "../src/worker/db/client";

const MAPPED_CHARACTERS = [..."áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇ"];

const REALISTIC_TITLES = [
  "ÁÉÍÓÚ Ç ãõ â ê ô à ü", // the PRD's own AC-11 fixture string
  "Reunião com o contador",
  "cafe da manha",
  "CAFÉ MANHÃ",
  "Renovar passaporte na PF",
  "Última chamada",
  "Ótimo dia",
  "Não é urgente",
];

const FIXTURE: readonly string[] = [...MAPPED_CHARACTERS, ...REALISTIC_TITLES];

describe("AC-11 — buildNormalizedSqlExpression agrees with normalizeSearchText, evaluated by D1", () => {
  it.each(FIXTURE)("normalizes %j identically in SQL and in JS", async (text) => {
    const db = createDb(env);
    const expr = buildNormalizedSqlExpression(sql`${text}`);

    const row = await db.get<{ value: string }>(sql`select ${expr} as value`);

    expect(row?.value).toBe(normalizeSearchText(text));
  });
});
