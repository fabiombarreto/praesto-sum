// PRPs/prds/text-search.prd.md AC-1 one-word-any-case-any-position
// PRPs/prds/text-search.prd.md AC-2 diacritics-ignored-both-ways
// PRPs/prds/text-search.prd.md AC-3 every-word-must-match-any-order
// PRPs/prds/text-search.prd.md AC-4 description-searched-separately
// PRPs/prds/text-search.prd.md AC-5 all-statuses-without-a-filter
// PRPs/prds/text-search.prd.md AC-6 composes-with-existing-filters
// PRPs/prds/text-search.prd.md AC-7 special-characters-are-literal
// PRPs/prds/text-search.prd.md AC-8 invalid-queries-are-rejected
// PRPs/prds/text-search.prd.md AC-9 ordering-and-existing-responses-unchanged
//
// The `q` route-level contract on `GET /api/tasks`
// (PRPs/plans/text-search-phase-1-search-on-the-api.plan.md, Task 3). Mirrors
// the D1 isolation/seeding/request pattern of `test/task-list-filters.test.ts`
// exactly: storage isolation is per test FILE under
// `@cloudflare/vitest-pool-workers`, so tables are wiped between tests via
// `resetTaskTables` rather than `reset()` (which would also drop the schema).
//
// AC-9's regression half ("every existing test/task-list-filters.test.ts
// assertion still passes untouched") is deliberately NOT re-asserted here —
// that file is left byte-for-byte untouched by this session, and it passing
// unmodified IS the evidence. This file only adds the POSITIVE half: a `q`
// match set still comes back in the frozen urgency order.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import { MAX_SEARCH_QUERY_LENGTH, type TaskDto } from "../src/shared/api";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
import { createDb } from "../src/worker/db/client";
import { tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/tasks";

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

/** A local calendar day `offset` days from the server's today, as YYYY-MM-DD. */
function dayOffset(offset: number): string {
  const today = todayIn(new Date(), PRAESTO_TIMEZONE);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

async function create(body: unknown): Promise<TaskDto> {
  const res = await exports.default.fetch(
    BASE,
    auth({ method: "POST", body: JSON.stringify(body) }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { task: TaskDto }).task;
}

async function complete(id: string): Promise<void> {
  const res = await exports.default.fetch(`${BASE}/${id}/complete`, auth({ method: "POST" }));
  expect(res.status).toBe(200);
}

/** Bypasses the route entirely — there is no HTTP action that produces `missed`. */
async function markMissed(id: string): Promise<void> {
  const db = createDb(env);
  await db.update(tasks).set({ status: "missed" }).where(eq(tasks.id, id));
}

async function list(query = ""): Promise<TaskDto[]> {
  const res = await exports.default.fetch(`${BASE}${query}`, auth());
  expect(res.status).toBe(200);
  return ((await res.json()) as { tasks: TaskDto[] }).tasks;
}

async function listRaw(query: string): Promise<Response> {
  return exports.default.fetch(`${BASE}${query}`, auth());
}

/** Titles in response order — pins ordering as well as membership. */
function titles(rows: TaskDto[]): string[] {
  return rows.map((row) => row.title);
}

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

describe("Task list — the `q` search parameter, one word (PRD AC-1)", () => {
  it("finds a Task by a whole word, any case", async () => {
    await create({ title: "Pagar o Aluguel de setembro" });

    expect(titles(await list("?q=ALUGUEL"))).toEqual(["Pagar o Aluguel de setembro"]);
  });

  it("finds a Task by a fragment inside a word, at any position", async () => {
    await create({ title: "Pagar o Aluguel de setembro" });

    expect(titles(await list("?q=lugue"))).toEqual(["Pagar o Aluguel de setembro"]);
  });
});

describe("Task list — diacritics are ignored both ways (PRD AC-2)", () => {
  it("finds an accented title from a plain query", async () => {
    await create({ title: "Reunião com o contador" });

    expect(titles(await list("?q=reuniao"))).toEqual(["Reunião com o contador"]);
  });

  it("finds a plain title from an accented, uppercase query", async () => {
    await create({ title: "cafe da manha" });

    expect(titles(await list(`?q=${encodeURIComponent("CAFÉ MANHÃ")}`))).toEqual(["cafe da manha"]);
  });
});

describe("Task list — every word must match, in any order (PRD AC-3)", () => {
  it("matches when both words are present, regardless of query word order", async () => {
    await create({ title: "Renovar passaporte na PF" });

    expect(titles(await list("?q=passaporte renovar"))).toEqual(["Renovar passaporte na PF"]);
  });

  it("excludes a Task missing even one of the query's words", async () => {
    await create({ title: "Renovar passaporte na PF" });

    expect(titles(await list("?q=passaporte carteira"))).toEqual([]);
  });
});

describe("Task list — the description is searched, separately from the title (PRD AC-4)", () => {
  it("matches a word that is only in the description", async () => {
    await create({ title: "Documentos", description: "levar comprovante de residência" });

    expect(titles(await list("?q=comprovante residencia"))).toEqual(["Documentos"]);
  });

  it("never matches a query word split across the title/description boundary", async () => {
    await create({ title: "ab", description: "cd" });

    // "bc" only exists by joining the tail of the title to the head of the
    // description — the newline join must keep that from ever matching.
    expect(titles(await list("?q=bc"))).toEqual([]);
  });

  it("still finds a Task by title when its description is NULL", async () => {
    await create({ title: "Chamar dentista" });

    expect(titles(await list("?q=dentista"))).toEqual(["Chamar dentista"]);
  });
});

describe("Task list — all statuses are searched without a status filter (PRD AC-5)", () => {
  it("returns open, done and missed Tasks alike", async () => {
    const open = await create({ title: "boleto aberto" });
    const done = await create({ title: "boleto pago" });
    await complete(done.id);
    const missed = await create({ title: "boleto vencido" });
    await markMissed(missed.id);

    const found = await list("?q=boleto");
    expect(found.map((t) => t.id).sort()).toEqual([open.id, done.id, missed.id].sort());
  });
});

describe("Task list — `q` composes with the existing filters (PRD AC-6)", () => {
  it("narrows a `q` match set by `status`", async () => {
    const open = await create({ title: "boleto aberto" });
    const done = await create({ title: "boleto pago" });
    await complete(done.id);

    expect(titles(await list("?q=boleto&status=done"))).toEqual(["boleto pago"]);
    expect((await list("?q=boleto&status=open")).map((t) => t.id)).toEqual([open.id]);
  });

  /**
   * Six Tasks, all containing the search word, arranged exactly like
   * `test/task-list-filters.test.ts`'s own AC-6 composition fixture: the two
   * rows a `q`-only request would return first (N1, H5) are precisely the
   * ones `status`/`priority`/`to` remove, and one unrelated Task (X) has
   * every filter dimension right but never matches `q` at all.
   */
  async function seedCompositionFixture(): Promise<{ unrelated: TaskDto }> {
    await create({ title: "N1 boleto normal oldest", deadline: dayOffset(-9), priority: "normal" });
    const done = await create({
      title: "H5 boleto done high",
      deadline: dayOffset(-7),
      priority: "high",
    });
    await complete(done.id);
    await create({ title: "H1 boleto oldest overdue", deadline: dayOffset(-5), priority: "high" });
    await create({ title: "H2 boleto recent overdue", deadline: dayOffset(-1), priority: "high" });
    await create({ title: "H3 boleto due today", deadline: dayOffset(0), priority: "high" });
    await create({ title: "H4 boleto future high", deadline: dayOffset(5), priority: "high" });
    const unrelated = await create({
      title: "X unrelated",
      deadline: dayOffset(-1),
      priority: "high",
    });
    return { unrelated };
  }

  it("applies `q`, `status`, `priority` and a date bound in the same request", async () => {
    await seedCompositionFixture();

    const query = `?q=boleto&status=open&priority=high&to=${dayOffset(0)}`;
    expect(titles(await list(query))).toEqual([
      "H1 boleto oldest overdue",
      "H2 boleto recent overdue",
      "H3 boleto due today",
    ]);
  });

  it("takes the first N of the ORDERED, `q`-FILTERED set when `limit` is present", async () => {
    await seedCompositionFixture();

    const query = `?q=boleto&status=open&priority=high&to=${dayOffset(0)}&limit=2`;
    expect(titles(await list(query))).toEqual([
      "H1 boleto oldest overdue",
      "H2 boleto recent overdue",
    ]);
  });

  it("never returns a Task that matches every other filter but not `q`", async () => {
    const { unrelated } = await seedCompositionFixture();

    const found = await list(`?q=boleto&priority=high`);
    expect(found.map((t) => t.id)).not.toContain(unrelated.id);
  });
});

describe("Task list — special characters in `q` are matched literally (PRD AC-7)", () => {
  it("matches `%` literally rather than as a wildcard", async () => {
    await create({ title: "100% pago" });
    await create({ title: "1000 pagos" });

    expect(titles(await list(`?q=${encodeURIComponent("100%")}`))).toEqual(["100% pago"]);
  });

  it("matches `_` literally rather than as a single-character wildcard", async () => {
    await create({ title: "100% pago" });
    await create({ title: "1000 pagos" });

    // Neither title contains a literal underscore; a wildcard interpretation
    // of `_` would match any of them by accident.
    expect(await list("?q=_")).toEqual([]);
  });
});

describe("Task list — invalid `q` values are rejected, not guessed (PRD AC-8)", () => {
  it("rejects an empty `q` with 400 naming q", async () => {
    const res = await listRaw("?q=");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error.toLowerCase()).toContain("q");
  });

  it("rejects a whitespace-only `q` with 400 naming q", async () => {
    const res = await listRaw("?q=%20%20");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error.toLowerCase()).toContain("q");
  });

  it("rejects a `q` longer than 100 characters with 400", async () => {
    const res = await listRaw(`?q=${"a".repeat(MAX_SEARCH_QUERY_LENGTH + 1)}`);

    expect(res.status).toBe(400);
  });

  it("accepts a `q` at the 100-character ceiling itself", async () => {
    await create({ title: "a".repeat(MAX_SEARCH_QUERY_LENGTH) });

    const res = await listRaw(`?q=${"a".repeat(MAX_SEARCH_QUERY_LENGTH)}`);
    expect(res.status).toBe(200);
  });

  it("behaves exactly as today when no `q` key is present at all", async () => {
    const a = await create({ title: "no q one" });
    const b = await create({ title: "no q two" });

    const found = await list("");
    expect(found.map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe("Task list — adding `q` never reorders the result set (PRD AC-9)", () => {
  it("keeps the frozen urgency order among the Tasks `q` matches", async () => {
    const overdue = await create({ title: "achado overdue", deadline: dayOffset(-5) });
    const today = await create({ title: "achado today", deadline: dayOffset(0) });
    const future = await create({ title: "achado future", deadline: dayOffset(5) });
    await create({ title: "not matched at all", deadline: dayOffset(-100) });

    const ids = (await list("?q=achado")).map((t) => t.id);

    expect(ids).toEqual([overdue.id, today.id, future.id]);
  });
});
