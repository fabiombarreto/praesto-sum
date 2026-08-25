// Shared test isolation for every suite that writes to the ephemeral D1.
//
// Storage isolation in @cloudflare/vitest-pool-workers is per test FILE, not
// per test, so these suites wipe `tasks` between tests themselves. That
// cleanup had a hole. When a test exceeds its Vitest timeout, Vitest gives up
// on the TEST but does not cancel the WORK its body started: the request into
// the Worker — and the D1 INSERT behind it — keeps running, and its row can
// land AFTER the next test's cleanup has already run. The next test then reads
// rows it never created. Reproduced 2026-08-24 under CPU contention with
// exactly the reported signature: a bare `Test timed out in 5000ms`,
// immediately followed by the next test in the same file receiving 5 ids where
// it expected 3.
//
// The fix is a happens-before barrier, not a bigger timeout — a bigger timeout
// only moves the threshold the race needs to cross. Two alternatives were
// weighed and rejected:
//
//   * Aborting the in-flight request through the test's AbortSignal. That
//     cancels the client side only; a D1 write already dispatched still lands,
//     so the row still leaks.
//   * Scoping every read to ids the test itself created. Stronger wherever it
//     applies, but it cannot express the two properties the frozen Task read
//     contract exists to pin — `limit` returns the first N of the GLOBAL
//     ordered set, and "no limit returns everything" asserts an absolute
//     count. Narrowing those to a per-test subset would weaken the very cases
//     that matter (docs/anti-patterns.md). So the shared table stays shared,
//     and is made deterministic instead of raced.
//
// Every test body therefore registers itself here, and `resetTaskTables()`
// refuses to wipe until every registered body has settled. A machine slow
// enough to blow the timeout still fails that one test — honestly, and alone.
// It can no longer corrupt its neighbours in either direction: the old hole
// could also HIDE a real regression behind a leaked row that happened to sort
// into the expected place.

import { env } from "cloudflare:workers";
import { it as baseIt } from "vitest";
import { createDb } from "../src/worker/db/client";
import { recurrenceSeries, tasks } from "../src/worker/db/schema";

/**
 * Test bodies that have started and not yet settled — including bodies Vitest
 * has already given up on. The promises kept here never reject: a body that
 * throws after its own test was reported must not surface as an unhandled
 * rejection and fail some unrelated test.
 */
const running = new Set<Promise<void>>();

function track(work: unknown): void {
  const settled: Promise<void> = Promise.resolve(work).then(
    () => {
      running.delete(settled);
    },
    () => {
      running.delete(settled);
    },
  );
  running.add(settled);
}

/** Wrap a test body so that starting it registers it. Non-functions pass through. */
function registerBody(arg: unknown): unknown {
  if (typeof arg !== "function") return arg;
  const body = arg as (...args: unknown[]) => unknown;
  return function (this: unknown, ...args: unknown[]): unknown {
    const result: unknown = body.apply(this, args);
    track(result);
    return result;
  };
}

/**
 * `it.each(cases)` / `it.for(cases)` return a collector that defines the cases.
 * The collector must be built with Vitest's own chainable context as `this`
 * (it calls `getChainableContext(this)`), hence the explicit `.apply(owner)`.
 */
function registerCollector(owner: object, each: unknown): unknown {
  const build = each as (...cases: unknown[]) => (...args: unknown[]) => unknown;
  return (...cases: unknown[]) => {
    const define = build.apply(owner, cases);
    return (...args: unknown[]) => define(...args.map(registerBody));
  };
}

/**
 * Mirrors Vitest's `it` — same call signatures, same chain (`.each`, `.skip`,
 * `.only`, …) — and additionally registers each body it defines.
 */
function isolate<T extends object>(target: T): T {
  return new Proxy(target, {
    apply(fn, thisArg, args: unknown[]) {
      return Reflect.apply(fn as (...a: unknown[]) => unknown, thisArg, args.map(registerBody));
    },
    get(fn, prop) {
      const value: unknown = Reflect.get(fn, prop);
      if (prop === "each" || prop === "for") return registerCollector(fn, value);
      return typeof value === "function" ? isolate(value as object) : value;
    },
  });
}

/** Drop-in for Vitest's `it`. Import it as `it` — the bodies read unchanged. */
export const isolatedIt: typeof baseIt = isolate(baseIt);

/**
 * How many bodies are currently registered. Exists for `test/isolation.test.ts`
 * to prove the wrapping is still live: if a Vitest upgrade ever changed the
 * internals `isolate()` reaches through, registration would stop silently and
 * every suite would keep passing — until a slow machine leaked a row again.
 */
export function pendingBodyCount(): number {
  return running.size;
}

// A body that keeps starting new work forever would spin here; fail loudly
// instead. Reaching this is a bug in the test, not a slow machine — a slow
// machine settles, it just takes longer.
const MAX_DRAIN_ROUNDS = 100;

/**
 * Hook budget for the suites that call `resetTaskTables()`, wide enough to
 * outlast the tail of an abandoned test body: a test that already blew a 5 s
 * budget on one request still owes every request after it, so Vitest's default
 * 10 s hook budget is too tight and reports the drain as a second failure. The
 * barrier is not weakened by the wider budget — cleanup still refuses to run
 * early, and a drain that overruns even this still fails the run.
 */
export const DRAIN_BUDGET_MS = 30_000;

/** Block until nothing a previous test started is still running. */
async function settleRunningBodies(): Promise<void> {
  for (let round = 0; running.size > 0; round++) {
    if (round === MAX_DRAIN_ROUNDS) {
      throw new Error(
        `Test isolation: a previous test body was still starting new work after ${MAX_DRAIN_ROUNDS} drain rounds.`,
      );
    }
    await Promise.all([...running]);
  }
}

/**
 * `beforeEach` cleanup for every suite that writes to the shared D1: drain
 * abandoned work FIRST, then wipe. `reset()` from "cloudflare:test" is
 * deliberately not used — it drops the schema too.
 */
export async function resetTaskTables(): Promise<void> {
  await settleRunningBodies();
  const db = createDb(env);
  await db.delete(tasks);
  await db.delete(recurrenceSeries);
}
