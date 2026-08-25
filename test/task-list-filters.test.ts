// PRPs/prds/today-view-and-filters.prd.md AC-1 filter-from
// PRPs/prds/today-view-and-filters.prd.md AC-2 filter-to
// PRPs/prds/today-view-and-filters.prd.md AC-3 filter-range
// PRPs/prds/today-view-and-filters.prd.md AC-4 filter-date-validation
// PRPs/prds/today-view-and-filters.prd.md AC-5 filter-priority
// PRPs/prds/today-view-and-filters.prd.md AC-6 filters-compose
//
// Phase 1 spends the three query-parameter names unit 2 reserved in
// `docs/api-reference.md`: `from`, `to` and `priority`. The contract they
// extend is frozen, so these tests pin the two properties that make the
// extension safe rather than merely present — the filter narrows the set the
// urgency ordering runs over (never the reverse), and `limit` still takes the
// first N *of the ordered filtered set*.
//
// Every date here is derived from the server's own notion of "today"
// (`todayIn`, the same function the route uses) rather than hardcoded — the
// discipline `test/task-list-contract.test.ts` established, and the reason
// PRD AC-1 states it explicitly: the route reads the wall clock, so a fixed
// fixture date stops testing the overdue/today/future boundary the moment the
// calendar passes it.
//
// The no-filter half of AC-6 is deliberately NOT re-asserted here: it is
// exactly what `test/task-list-contract.test.ts` already pins, and that suite
// passing UNCHANGED is the evidence the frozen contract did not move. A second
// copy would be a duplicate, not a second guarantee.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import type { TaskDto } from "../src/shared/api";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
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

async function list(query = ""): Promise<TaskDto[]> {
  const res = await exports.default.fetch(`${BASE}${query}`, auth());
  expect(res.status).toBe(200);
  return ((await res.json()) as { tasks: TaskDto[] }).tasks;
}

async function listRaw(query: string): Promise<Response> {
  return exports.default.fetch(`${BASE}${query}`, auth());
}

/** Titles in response order — the assertion shape that pins ordering as well as membership. */
function titles(rows: TaskDto[]): string[] {
  return rows.map((row) => row.title);
}

/**
 * The four-Task fixture PRD AC-1..AC-3 name: one overdue, one near future, one
 * far future, and one with no date at all. The undated row is the point — it
 * must fall outside EVERY date range, because a range compares against
 * `coalesce(deadline, scheduled_date)` and a NULL comparison is never true.
 */
async function seedDateFixture(): Promise<void> {
  await create({ title: "A overdue", deadline: dayOffset(-3) });
  await create({ title: "B soon", scheduledDate: dayOffset(1) });
  await create({ title: "C later", deadline: dayOffset(3) });
  await create({ title: "D undated" });
}

// Storage isolation is per test FILE, so wipe the tables between tests instead
// of reset() (which would also drop the schema). The wipe first waits for work
// an abandoned — timed-out — test left in flight, so a row it is still writing
// cannot land after the cleanup and be read by the test after it. Why that
// barrier and not a bigger timeout: test/isolation.ts.
//
// The explicit hook budget is the barrier's, not the wipe's: draining means
// waiting out the REST of an abandoned body — every request it had still to
// make — so on a machine already slow enough to blow a 5 s test budget the
// default 10 s hook budget is too tight. Blowing this one means the machine
// gave up, never that the contract moved.
beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

describe("Task list — the `from` filter (PRD AC-1)", () => {
  it("returns only Tasks on or after the given day, in urgency order", async () => {
    await seedDateFixture();

    expect(titles(await list(`?from=${dayOffset(1)}`))).toEqual(["B soon", "C later"]);
  });

  it("is inclusive of the boundary day itself", async () => {
    await seedDateFixture();

    expect(titles(await list(`?from=${dayOffset(3)}`))).toEqual(["C later"]);
  });

  it("never places an undated Task inside a date range", async () => {
    await seedDateFixture();

    // The widest range the fixture allows still excludes D: a Task with no
    // date is not "after" any day.
    expect(titles(await list(`?from=${dayOffset(-3)}`))).toEqual([
      "A overdue",
      "B soon",
      "C later",
    ]);
  });

  it("compares against the scheduled date when there is no deadline", async () => {
    await create({ title: "scheduled only", scheduledDate: dayOffset(5) });
    await create({ title: "deadline only", deadline: dayOffset(-5) });

    expect(titles(await list(`?from=${dayOffset(5)}`))).toEqual(["scheduled only"]);
  });
});

describe("Task list — the `to` filter (PRD AC-2)", () => {
  it("returns only Tasks on or before the given day, in urgency order", async () => {
    await seedDateFixture();

    // A is overdue (bucket 0) and B is future (bucket 2), so A comes first —
    // the urgency ordering is unchanged by the filter.
    expect(titles(await list(`?to=${dayOffset(1)}`))).toEqual(["A overdue", "B soon"]);
  });

  it("is inclusive of the boundary day itself", async () => {
    await seedDateFixture();

    expect(titles(await list(`?to=${dayOffset(-3)}`))).toEqual(["A overdue"]);
  });

  it("never places an undated Task inside a date range", async () => {
    await seedDateFixture();

    expect(titles(await list(`?to=${dayOffset(3)}`))).toEqual(["A overdue", "B soon", "C later"]);
  });
});

describe("Task list — `from` and `to` together (PRD AC-3)", () => {
  it("selects the closed interval when both are given", async () => {
    await seedDateFixture();

    const query = `?from=${dayOffset(1)}&to=${dayOffset(1)}`;
    expect(titles(await list(query))).toEqual(["B soon"]);
  });

  it("answers an inverted range with an empty list, not an error", async () => {
    await seedDateFixture();

    const res = await listRaw(`?from=${dayOffset(3)}&to=${dayOffset(-3)}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { tasks: TaskDto[] }).tasks).toEqual([]);
  });
});

describe("Task list — date parameters are validated at the boundary (PRD AC-4)", () => {
  it("rejects a `from` that is not zero-padded ISO", async () => {
    const res = await listRaw("?from=2026-8-1");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("from");
  });

  it("rejects a `to` that is not a real day on the calendar", async () => {
    const res = await listRaw("?to=2026-02-31");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("to");
  });

  it("rejects prose where a date belongs", async () => {
    const res = await listRaw("?from=ontem");

    expect(res.status).toBe(400);
  });

  it("rejects an empty value rather than treating it as no filter", async () => {
    await seedDateFixture();

    // A distinct defect mode from the malformed-date cases above: `?from=`
    // yields the empty string, not `undefined`. An implementation that gates
    // on truthiness (`if (from)`) silently drops the parameter and answers
    // 200 with every Task, while the caller believes a filter was applied.
    // Only "the parameter is absent" may skip the filter.
    const res = await listRaw("?from=");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("from");
  });
});

describe("Task list — the `priority` filter (PRD AC-5)", () => {
  async function seedPriorityFixture(): Promise<void> {
    await create({ title: "high one", priority: "high" });
    await create({ title: "normal one", priority: "normal" });
    await create({ title: "low one", priority: "low" });
    await create({ title: "unset one" });
  }

  it("returns only the high-priority Tasks", async () => {
    await seedPriorityFixture();

    expect(titles(await list("?priority=high"))).toEqual(["high one"]);
  });

  it("returns only the low-priority Tasks", async () => {
    await seedPriorityFixture();

    expect(titles(await list("?priority=low"))).toEqual(["low one"]);
  });

  it("counts an unset priority as normal", async () => {
    await seedPriorityFixture();

    // The domain rule (docs/domain/areas/tasks.md): NULL means "not set" and
    // sorts as normal. A plain equality filter would hide every Task the owner
    // never assigned a priority to — which is most of the real table.
    expect(titles(await list("?priority=normal")).sort()).toEqual(["normal one", "unset one"]);
  });

  it("rejects a priority outside the domain enum", async () => {
    const res = await listRaw("?priority=urgent");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("urgent");
  });
});

describe("Task list — filters compose, and order still precedes limit (PRD AC-6)", () => {
  /**
   * Six Tasks, ordered so that the two rows an UNFILTERED request would return
   * first are precisely the two each filter dimension removes: N1 (wrong
   * priority) and H5 (wrong status) are the most overdue of all. Only H1, H2
   * and H3 survive `status=open` + `priority=high` + `to=<today>`, in that
   * urgency order.
   *
   * The arrangement is the point. With a fixture whose matching rows are also
   * the globally-first rows, `?…&limit=2` returns the same pair whether or not
   * the filter was applied — a test that cannot fail. Here an unfiltered or
   * limit-before-filter implementation returns ["N1 …", "H5 …"] instead.
   */
  async function seedCompositionFixture(): Promise<void> {
    await create({ title: "N1 normal oldest", deadline: dayOffset(-9), priority: "normal" });
    const done = await create({
      title: "H5 done high",
      deadline: dayOffset(-7),
      priority: "high",
    });
    await complete(done.id);
    await create({ title: "H1 oldest overdue", deadline: dayOffset(-5), priority: "high" });
    await create({ title: "H2 recent overdue", deadline: dayOffset(-1), priority: "high" });
    await create({ title: "H3 due today", deadline: dayOffset(0), priority: "high" });
    await create({ title: "H4 future high", deadline: dayOffset(5), priority: "high" });
  }

  it("applies status, priority and a date bound in the same request", async () => {
    await seedCompositionFixture();

    const query = `?status=open&priority=high&to=${dayOffset(0)}`;
    expect(titles(await list(query))).toEqual([
      "H1 oldest overdue",
      "H2 recent overdue",
      "H3 due today",
    ]);
  });

  it("takes the first N of the ORDERED FILTERED set, not of an arbitrary one", async () => {
    await seedCompositionFixture();

    // The discriminative case: filtering after the limit, or limiting before
    // the ordering, both yield a different pair here.
    const query = `?status=open&priority=high&to=${dayOffset(0)}&limit=2`;
    expect(titles(await list(query))).toEqual(["H1 oldest overdue", "H2 recent overdue"]);
  });

  it("still rejects an invalid limit when filters are present", async () => {
    await seedCompositionFixture();

    const res = await listRaw(`?priority=high&limit=0`);

    expect(res.status).toBe(400);
  });
});
