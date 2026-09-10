// PRPs/prds/reminders.prd.md AC-5 The sweep claims before it sends
// PRPs/prds/reminders.prd.md AC-6 A retryable push outcome releases the claim; a delivered or gone one does not
// PRPs/prds/reminders.prd.md AC-7 A dead subscription is pruned, and one dead endpoint does not suppress a live one
// PRPs/prds/reminders.prd.md AC-9 A closed Task's Reminder does not ring
// PRPs/prds/reminders.prd.md AC-10 A Reminder that came due while the scheduler was down still fires once
//
// Source plan: PRPs/plans/reminders-phase-2-the-due-reminder-sweep.plan.md
// (plan AC-A1..AC-A5, all folding into `runScheduledJob`).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// `runScheduledJob` (`src/worker/cron.ts`) is today an intentionally empty
// placeholder — `export async function runScheduledJob(_env: Env): Promise<void> {}`
// — so every test below is RED for the right reason: no row is ever claimed,
// no push is ever attempted, and `sentAt` never moves, until plan Tasks 1-4
// land the sweep body.
//
// Mocking mechanism: exactly `test/push-test-route.test.ts`'s own seam —
// `vi.stubGlobal("fetch", ...)` substitutes only the outbound push service's
// HTTP response (the "final wire" `sendPush()` hits), never the SUT
// (`runScheduledJob`, `sendPush`, `classifyPushOutcome`, or the D1 rows under
// test). Subscriptions are seeded with structurally real P-256 keys via
// `crypto.subtle`, exactly like that file's `generateP256Keys()` helper, so
// `sendPush`'s real sign/encrypt path runs before the stubbed network call.
// Reminders and Tasks are seeded by direct D1 insert (not through
// `/api/reminders` or `/api/tasks`) because this suite needs to set
// `sentAt`/`fireAt`/`status` combinations those routes do not expose
// (a past `fireAt`, a pre-set `sentAt`, a `done`/`missed` Task).

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/worker/db/client";
import { pushSubscriptions, reminders, tasks, type Reminder } from "../src/worker/db/schema";
import { runScheduledJob } from "../src/worker/cron";
import { DRAIN_BUDGET_MS, resetTaskTables } from "./isolation";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Structurally real P-256 keys, mirroring `test/push-test-route.test.ts`. */
async function generateP256Keys(): Promise<{ p256dh: string; auth: string }> {
  const keyPair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const rawPublicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer,
  );
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return { p256dh: base64UrlEncode(rawPublicKey), auth: base64UrlEncode(authSecret) };
}

async function insertSubscription(endpoint: string): Promise<void> {
  const keys = await generateP256Keys();
  await createDb(env)
    .insert(pushSubscriptions)
    .values({ id: crypto.randomUUID(), endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

async function remainingEndpoints(): Promise<string[]> {
  const rows = await createDb(env).select().from(pushSubscriptions);
  return rows.map((row) => row.endpoint);
}

async function insertReminder(opts: {
  label?: string | null;
  taskId?: string | null;
  fireAtMs: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  await createDb(env)
    .insert(reminders)
    .values({
      id,
      taskId: opts.taskId ?? null,
      label: opts.label ?? null,
      fireAt: new Date(opts.fireAtMs),
      originOffsetMinutes: null,
      sentAt: null,
    });
  return id;
}

async function fetchReminder(id: string): Promise<Reminder | undefined> {
  const [row] = await createDb(env).select().from(reminders).where(eq(reminders.id, id));
  return row;
}

async function insertClosedTask(status: "done" | "missed"): Promise<string> {
  const id = crypto.randomUUID();
  await createDb(env)
    .insert(tasks)
    .values({
      id,
      title: `Closed task (${status})`,
      status,
      completedAt: status === "done" ? new Date() : null,
    });
  return id;
}

/** Same seam as `test/push-test-route.test.ts`, plus a shared call log. */
function stubFetchByEndpoint(responses: Record<string, () => Response>, calls: string[]): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const reply = responses[url];
    if (reply === undefined) {
      throw new Error(`Unstubbed fetch to ${url} — a real network call would fire`);
    }
    return reply();
  });
}

const FIVE_MIN_AGO_MS = Date.now() - 5 * 60 * 1000;
const FORTY_MIN_AGO_MS = Date.now() - 40 * 60 * 1000;

beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(reminders);
  await createDb(env).delete(pushSubscriptions);
}, DRAIN_BUDGET_MS);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runScheduledJob — AC-A1 (PRD AC-5): the sweep claims before it sends", () => {
  it("dispatches sendPush at most once per due row even when two ticks race concurrently", async () => {
    const ENDPOINT = "https://push.invalid/ac5-race";
    await insertSubscription(ENDPOINT);
    const idA = await insertReminder({ label: "Reminder A", fireAtMs: FIVE_MIN_AGO_MS });
    const idB = await insertReminder({ label: "Reminder B", fireAtMs: FIVE_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) }, calls);

    // Two overlapping invocations in "the same window" (plan AC-A1 wording):
    // claim-before-send must make this indistinguishable from one invocation
    // as far as sendPush call count goes.
    await Promise.all([runScheduledJob(env), runScheduledJob(env)]);

    // One dispatch per Reminder, never two — a second claimant of the same
    // row must find it already claimed and send nothing for it.
    expect(calls).toHaveLength(2);
    const rowA = await fetchReminder(idA);
    const rowB = await fetchReminder(idB);
    expect(rowA?.sentAt).not.toBeNull();
    expect(rowB?.sentAt).not.toBeNull();
  }, 20_000);

  it("a second sequential run sends nothing once every due row is already claimed and sent", async () => {
    const ENDPOINT = "https://push.invalid/ac5-sequential";
    await insertSubscription(ENDPOINT);
    const id = await insertReminder({ label: "Reminder", fireAtMs: FIVE_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) }, calls);

    await runScheduledJob(env);
    expect(calls).toHaveLength(1);

    await runScheduledJob(env);
    // The row's sentAt is already set — the conditional claim (`sentAt IS
    // NULL`) matches nothing on this second run, so no further dispatch.
    expect(calls).toHaveLength(1);

    const row = await fetchReminder(id);
    expect(row?.sentAt).not.toBeNull();
  }, 15_000);
});

describe("runScheduledJob — AC-A2 (PRD AC-6): a retryable outcome releases the claim", () => {
  it("resets sentAt to null after a 503 so the next tick retries the same row", async () => {
    const ENDPOINT = "https://push.invalid/ac6-retryable";
    await insertSubscription(ENDPOINT);
    const id = await insertReminder({ label: "Retry me", fireAtMs: FIVE_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response("unavailable", { status: 503 }) }, calls);

    await runScheduledJob(env);

    expect(calls).toHaveLength(1);
    const row = await fetchReminder(id);
    expect(row?.sentAt).toBeNull();

    // The release actually enables a retry: the next tick sees it as due again.
    await runScheduledJob(env);
    expect(calls).toHaveLength(2);
  }, 20_000);

  it("leaves sentAt set forever once the outcome is delivered — no resend on a later tick", async () => {
    const ENDPOINT = "https://push.invalid/ac6-delivered";
    await insertSubscription(ENDPOINT);
    const id = await insertReminder({ label: "Delivered", fireAtMs: FIVE_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) }, calls);

    await runScheduledJob(env);
    expect(calls).toHaveLength(1);
    const afterFirst = await fetchReminder(id);
    expect(afterFirst?.sentAt).not.toBeNull();

    await runScheduledJob(env);
    // Still just the one call from the first tick.
    expect(calls).toHaveLength(1);
    const afterSecond = await fetchReminder(id);
    expect(afterSecond?.sentAt).toEqual(afterFirst?.sentAt);
  }, 20_000);

  it("leaves sentAt set forever once every subscription classified gone — never sent again", async () => {
    const ENDPOINT = "https://push.invalid/ac6-all-gone";
    await insertSubscription(ENDPOINT);
    const id = await insertReminder({ label: "All gone", fireAtMs: FIVE_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response("gone", { status: 410 }) }, calls);

    await runScheduledJob(env);

    expect(calls).toHaveLength(1);
    const row = await fetchReminder(id);
    expect(row?.sentAt).not.toBeNull();

    await runScheduledJob(env);
    // No live subscription remains and sentAt is already set — no re-dispatch.
    expect(calls).toHaveLength(1);
  }, 20_000);
});

describe("runScheduledJob — AC-A3 (PRD AC-7): a dead subscription is pruned without suppressing a live one", () => {
  it("deletes only the gone endpoint, keeps the delivered one stored, and still marks the Reminder sent", async () => {
    const DEAD = "https://push.invalid/ac7-dead";
    const ALIVE = "https://push.invalid/ac7-alive";
    await insertSubscription(DEAD);
    await insertSubscription(ALIVE);
    const id = await insertReminder({ label: "Two subscriptions", fireAtMs: FIVE_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint(
      {
        [DEAD]: () => new Response("gone", { status: 410 }),
        [ALIVE]: () => new Response(null, { status: 201 }),
      },
      calls,
    );

    await runScheduledJob(env);

    expect(calls.sort()).toEqual([ALIVE, DEAD].sort());
    expect(await remainingEndpoints()).toEqual([ALIVE]);

    const row = await fetchReminder(id);
    expect(row?.sentAt).not.toBeNull();
  }, 20_000);
});

describe("runScheduledJob — AC-A4 (PRD AC-9): a closed Task's Reminder does not ring", () => {
  it.each(["done", "missed"] as const)(
    "dispatches no push for a Reminder on a %s Task, but still marks it sent",
    async (status) => {
      const ENDPOINT = `https://push.invalid/ac9-${status}`;
      await insertSubscription(ENDPOINT);
      const taskId = await insertClosedTask(status);
      const id = await insertReminder({ taskId, fireAtMs: FIVE_MIN_AGO_MS });
      const calls: string[] = [];
      stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) }, calls);

      await runScheduledJob(env);

      // No dispatch attempt at all — not even one that could have succeeded.
      expect(calls).toHaveLength(0);
      const row = await fetchReminder(id);
      expect(row?.sentAt).not.toBeNull();

      // Not reconsidered on a later tick either.
      await runScheduledJob(env);
      expect(calls).toHaveLength(0);
    },
    15_000,
  );
});

describe("runScheduledJob — AC-A5 (PRD AC-10): a Reminder overdue by 40 minutes still fires, exactly once", () => {
  it("dispatches a Reminder whose fireAt is 40 minutes in the past, with no lower bound swallowing it", async () => {
    const ENDPOINT = "https://push.invalid/ac10-overdue";
    await insertSubscription(ENDPOINT);
    const id = await insertReminder({ label: "Overdue", fireAtMs: FORTY_MIN_AGO_MS });
    const calls: string[] = [];
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) }, calls);

    await runScheduledJob(env);

    expect(calls).toHaveLength(1);
    const row = await fetchReminder(id);
    expect(row?.sentAt).not.toBeNull();

    // Exactly once — a later tick must not resend it.
    await runScheduledJob(env);
    expect(calls).toHaveLength(1);
  }, 20_000);
});
