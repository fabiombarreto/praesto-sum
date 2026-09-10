# Feature: The due-Reminder sweep (Phase 2 of reminders)

```
**Decision Gate**
- Active context: none (no .context.md provided or referenced)
- Activated criteria: filling an existing `scheduled()` job body (`src/worker/cron.ts`); reuse of a cross-cutting shared service (the push dispatch path — `sendPush`/`classifyPushOutcome`/`buildNotificationPayload`); impact on domain data (`reminders`, `push_subscriptions`, read-only join against `tasks`); no new route, no new UI, no new dependency
- Decisions found:
  - ADR-0003 — D1 as the single canonical store; `scheduled()` is one of the three things the one Worker serves; no offline write queue
  - ADR-0005 — Hono/Drizzle stack, exact version pins (no new dependency introduced by this phase)
  - ADR-0008 (2026-08-04) — test-first methodology declared active (`tdd: true`); this phase's `scheduled()`-job logic falls inside the automated scope named in `docs/context/methodology.md`
  - ADR-0009 (2026-08-18) — visible UI copy in pt-BR; the notification payload's `title`/`body` are owner-facing text the owner reads on his phone, so this rule applies here even though this phase ships no screen (the existing `POST /api/push/test` route already sets the precedent: `body: "Notificação de teste"`, `src/worker/routes/push.ts:115`)
  - ADR-0013 (2026-09-07, ratified 2026-09-09) — `@block65/webcrypto-web-push` is the sole Web Push send library; `web-push` is removed and must never be reintroduced
  - PRD Decisions Log (`PRPs/prds/reminders.prd.md`) — claim-before-send with release-only-on-retryable; Reminders for closed Tasks are marked sent but never delivered; no new database table
- Applicable anti-patterns:
  - "Hand-duplicated entity types" (`docs/anti-patterns.md`) — the sweep reads `Reminder`/`Task`/`PushSubscription` rows straight from the Drizzle schema types; it introduces no parallel type
  - "Portuguese in artifacts" carve-out — the notification `body` names the Reminder's own `label` or the linked Task's `title` (owner-authored data, language-neutral); no new hardcoded English UI string is introduced by this phase
  - Writing under `.claude/` — not triggered; the only write is `src/worker/cron.ts`
  - Version ranges in dependencies — not triggered; no new dependency
- Applicable architectural rules:
  - One Worker serves `scheduled()` too (ADR-0003) — no second service, no queue of Praesto's own
  - Reuse, never reimplement, the dispatch path: `sendPush`, `classifyPushOutcome`, `buildNotificationPayload` (`src/worker/routes/push.ts:127-144` is the proven call shape)
  - Invariants that protect the owner's data are unique indexes/CHECKs, not conventions — `reminders_due_idx` on `(sent_at, fire_at)` is "the cron's only scan" (`src/worker/db/schema.ts:256`)
  - Genuine instants cross the wire and are stored as epoch/timestamp values; the sweep compares `fireAt` against `now`, never against a bare string
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/reminders.prd.md` — Implementation Phases row 2: "The due-Reminder
  sweep" — Goal: the cron rings the phone on its own, exactly once per
  Reminder. — Success signal: AC-5, AC-6, AC-7, AC-9 and AC-10 green; the
  local dev cron delivers a due Reminder to a real subscription once and only
  once.

## Summary

Fill the empty `runScheduledJob` placeholder in `src/worker/cron.ts` with the
due-Reminder sweep: scan `reminders` for rows whose `sentAt` is null and whose
`fireAt` is at or before now (no lower bound — a reminder that came due while
the scheduler was down still fires, AC-10); atomically claim each due row with
a conditional `UPDATE ... WHERE id = ? AND sent_at IS NULL` before doing
anything else (AC-5); skip dispatch — but leave the claim set — for a Reminder
whose linked Task is `done` or `missed` (AC-9); otherwise dispatch through the
already-proven `sendPush` / `classifyPushOutcome` / `buildNotificationPayload`
path to every stored `push_subscriptions` row, pruning any that classify
`gone` (AC-7); and release the claim (`sentAt` back to `null`) only when at
least one dispatch attempt classified `retryable`, so a transient 429/5xx gets
another tick while a delivered or fully-`gone` outcome never resends (AC-6).
No new table, no migration, no per-Task `AppRoute` (the payload's `route`
stays `"/"` — phase 3's job), no UI.

## User Story

As the owner, I want a due Reminder to make my phone ring on its own — exactly
once, even if the scheduler missed a window — so that I stop keeping timed
intentions in my head or in a native alarm that knows nothing about my Tasks.

## Problem Statement

`runScheduledJob` is an intentional empty placeholder
(`src/worker/cron.ts:5-14`) whose own doc comment reserves it for this unit;
`runCronHeartbeat` already times, catches and durably records every
invocation, but the job body it wraps does nothing. The `reminders` table and
its `reminders_due_idx` scan index have existed unused since migration `0000`
(`src/worker/db/schema.ts:233-265`), and the full push dispatch path —
`sendPush`, `classifyPushOutcome`, `buildNotificationPayload`, with
prune-on-`gone` — is proven in production by `POST /api/push/test`
(`src/worker/routes/push.ts:104-164`) but nothing on the cron path calls it
yet. Scoped to this phase: the sweep that connects "a row is due" to "the
phone rings" does not exist.

## Solution Statement

Mirror `POST /api/push/test`'s dispatch loop exactly — build the payload once,
call `sendPush` per stored subscription, classify with `classifyPushOutcome`,
delete on `gone` — but wrap it in the claim-before-send discipline the PRD's
Decisions Log requires: a conditional `UPDATE ... WHERE id = ? AND sent_at IS
NULL` claims a row before any push call is made, so duplicates are
structurally impossible; the claim is released (`sentAt` reset to `null`)
only when the outcome was `retryable`, so a transient failure still gets a
retry on the next tick while a crash between claim and dispatch is the one
remaining silence — a silence `runCronHeartbeat`'s `finally`-block `cron_runs`
row already makes visible, per the PRD's own risk table. A Task-linked
Reminder whose Task is closed (`done`/`missed`) is claimed (so it is never
reconsidered) but never dispatched. Drizzle's `and()`/`isNull()`/`lte()`
combinators are new to this codebase (every existing `db.update`/`db.select`
call uses a single `eq()` predicate) — introducing them here, scoped to this
one function, is the smallest change that expresses "not yet sent AND already
due" as one atomic condition.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Medium |
| Systems Affected | Worker cron (`src/worker/cron.ts`); push dispatch reuse (`src/worker/push/send.ts`, `src/shared/push-outcome.ts`, `src/shared/push-payload.ts`); D1 tables `reminders`, `push_subscriptions`, read-only join against `tasks` |
| Dependencies | Phase 1 (`Reminder API and the time contract`) — `complete` |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/reminders.prd.md` Implementation Phases row 2 (lines 369, 388-397) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/worker/cron.ts` | 1-51 | The exact function to fill (`runScheduledJob`) and the `runCronHeartbeat` wrapper that already records `cron_runs` from a `finally` block — do not touch the wrapper, only the placeholder body |
| P0 | `src/worker/routes/push.ts` | 104-164 | The proven dispatch-and-prune loop (`sendPush` → `classifyPushOutcome` → delete on `gone`) this phase's sweep must reuse, not reimplement |
| P0 | `src/shared/push-outcome.ts` | 1-47 | `classifyPushOutcome`'s `{ delivered \| gone \| retryable }` discriminated union — the exact three-way switch the claim-release logic (AC-6) and prune logic (AC-7) branch on |
| P0 | `src/worker/db/schema.ts` | 233-265 | The `reminders` table this phase reads and writes: `sentAt`/`fireAt` claim columns, `reminders_due_idx` ("the cron's only scan"), `taskId` FK. Also lines 147-224 for `tasks.status`'s `'open' \| 'done' \| 'missed'` enum (AC-9) |
| P1 | `src/shared/push-payload.ts` | 1-60 | `buildNotificationPayload`'s signature — what the sweep must call to build each Reminder's notification |
| P1 | `src/worker/routes/reminders.ts` | 44-51 | The existing "look up a Task by id, branch on whether it was found" pattern to mirror for the sweep's per-Reminder Task lookup |
| P1 | `src/worker/routes/oauth-callback.ts` | 120 | The only existing `db.update(...).where(eq(...))` shape in this codebase — the base pattern this phase extends with `and()`/`isNull()`/`lte()`, which have no existing anchor in this repo (`TBD - needs validation`: no prior multi-condition `WHERE` exists here to mirror verbatim) |

## Patterns to Mirror

```
# SOURCE: src/worker/cron.ts:5-14
/**
 * `scheduled()`'s job body (unit 6 phase 3, PRD AC-5 / AC-6 / unit 7).
 *
 * Intentionally empty placeholder: unit 7 will land the due-Reminder scan
 * here. This phase reads no Reminder. Exported specifically so a test can
 * override its behavior (e.g. `vi.mock("../src/worker/cron", ...)`) to force
 * a throw and exercise `runCronHeartbeat`'s failure path without any real
 * job logic existing yet.
 */
export async function runScheduledJob(_env: Env): Promise<void> {}
```
This is the exact function every task in this plan edits. Task 1 replaces the
body; the self-import indirection (`cronModule.runScheduledJob`) that
`runCronHeartbeat` relies on for its own test's `vi.spyOn` seam is untouched.

```
# SOURCE: src/worker/routes/push.ts:104-144
pushRoutes.post("/test", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(pushSubscriptions);
  ...
  const payload = JSON.stringify(
    buildNotificationPayload({ title: "Praesto", body: "Notificação de teste", route: "/", tag: "test-push" }),
  );
  const vapid = { subject: c.env.VAPID_SUBJECT, publicKey: c.env.VAPID_PUBLIC_KEY, privateKey: c.env.VAPID_PRIVATE_KEY };

  const results = [];
  for (const subscription of rows) {
    const result = await sendPush(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
      vapid,
    );
    const outcome = classifyPushOutcome(result);
    if (outcome.kind === "gone") {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    }
    results.push({ endpoint: subscription.endpoint, outcome });
  }
});
```
Copied by Task 3 — same build-payload-once / per-subscription `sendPush` +
`classifyPushOutcome` + delete-on-`gone` loop, adapted so the payload's
`body` names the Reminder (its `label`, or the linked Task's `title`) rather
than the fixed test string, and so the outcomes are inspected afterward by
Task 4 to decide the claim release, rather than merely collected for a
response body.

```
# SOURCE: src/shared/push-outcome.ts:21-24
export type PushOutcome =
  | { kind: "delivered"; statusCode: number }
  | { kind: "gone" }
  | { kind: "retryable"; error: string; statusCode?: number };
```
Read (not copied) by Tasks 3 and 4 — the three-way discriminant Task 3
branches on to prune (`gone`) and Task 4 branches on to release the claim
(`retryable`); `delivered` and `gone`-for-every-subscription both leave the
claim untouched.

```
# SOURCE: src/worker/db/schema.ts:233-264
export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id, { onUpdate: "cascade", onDelete: "cascade" }),
    label: text("label"),
    fireAt: integer("fire_at", { mode: "timestamp" }).notNull(),
    originOffsetMinutes: integer("origin_offset_minutes"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    ...
  },
  (t) => [
    index("reminders_due_idx").on(t.sentAt, t.fireAt), // The cron's only scan: due and not yet sent.
    index("reminders_task_idx").on(t.taskId),
    check("reminders_label_chk", ...),
  ],
);
```
Read (not copied) by Task 1 — `sentAt`/`fireAt` are exactly the two columns
the sweep's `SELECT` predicate and claim `UPDATE` touch, and the column order
of `reminders_due_idx` (`sentAt` first) is why the predicate is written
`sentAt IS NULL AND fireAt <= now`, not the other way round.

```
# SOURCE: src/worker/routes/reminders.ts:44-51
let task: Task | undefined;
if (taskId !== null) {
  const [found] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (found === undefined) return c.json({ error: "Tarefa não encontrada" }, 404);
  task = found;
}
```
Copied by Task 2 — the same "look up by id, `undefined` means not found"
shape, adapted so a missing Task (already impossible once phase 1's
`onDelete: "cascade"` has run, but defensively handled the same way) or an
Task whose `status` is `'done'`/`'missed'` causes the sweep to `continue`
rather than to return an HTTP error.

```
# SOURCE: src/worker/routes/oauth-callback.ts:120
await db.update(oauthStates).set({ consumedAt: new Date() }).where(eq(oauthStates.id, state));
```
Read (not copied verbatim) by Task 1 — the only existing `db.update(...).where(eq(...))`
call in this codebase. Task 1 extends this single-condition shape with
`and(eq(reminders.id, reminder.id), isNull(reminders.sentAt))` for the claim,
and Task 4 reuses the plain single-`eq()` form for the release. Drizzle's
`and()`/`isNull()`/`lte()` are standard exports of the already-pinned
`drizzle-orm@0.45.2` dependency (no new package), but no file in this
codebase combines two conditions in one `WHERE` yet — this is a new idiom to
the repo, not an existing one being copied.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/worker/cron.ts` | UPDATE | Fill `runScheduledJob` with the due-Reminder sweep (claim, closed-Task skip, dispatch, prune, release) — the only file this phase touches |

## NOT Building (Scope Limits)

- **No per-Task `AppRoute` variant.** The notification payload's `route`
  stays `"/"` at the end of this phase, exactly as the PRD's Phase 2 scope
  says — phase 3 gives it somewhere better to point.
- **No UI.** Nothing under `src/app/` changes; there is no screen to review
  against the UI/UX guidelines this phase.
- **No deadline recomputation.** `originOffsetMinutes`-derived `fireAt`
  values are read as already-stored; recomputing them on a Task deadline
  edit (AC-11/AC-12) is phase 4.
- **No new database table, no migration.** `reminders`, `push_subscriptions`
  and `tasks` already carry every column this phase needs.
- **No new dependency.** `and`/`isNull`/`lte` are standard exports of the
  already-pinned `drizzle-orm@0.45.2`; `sendPush` continues to use
  `@block65/webcrypto-web-push` per ADR-0013 — `web-push` is never
  reintroduced.
- **No lease/expiry mechanism, no lease token.** Web research on Cloudflare
  Queues + D1 idempotent jobs suggests an expiring-lease claim for
  crash-recovery; the PRD's own Decisions Log explicitly rejected that in
  favor of the simpler `sent_at IS NULL` claim, on the grounds that
  `runCronHeartbeat`'s `cron_runs` failure row already makes a crash visible
  without a second mechanism. Not revisited here.

## Step-by-Step Tasks

### Task 1: Query due Reminders and add the atomic per-row claim

**ACTION**: In `src/worker/cron.ts`, replace the empty body of
`runScheduledJob(env: Env)` with: (1) `const db = createDb(env);` and
`const now = new Date();`; (2) select every Reminder row matching
`and(isNull(reminders.sentAt), lte(reminders.fireAt, now))` — deliberately no
lower bound on `fireAt`, so a Reminder that came due while the scheduler was
down still appears in this scan (AC-10); (3) for each row returned, perform
the atomic claim: `const [claimed] = await db.update(reminders).set({ sentAt:
now }).where(and(eq(reminders.id, reminder.id), isNull(reminders.sentAt)))
.returning();` and `if (claimed === undefined) continue;` — the conditional
`WHERE` is what makes a second, concurrent `runScheduledJob` invocation claim
nothing for a row this run already claimed (AC-5's core mechanism). Import
`and`, `eq`, `isNull`, `lte` from `drizzle-orm`, and `reminders`, `tasks`,
`type Task` from `./db/schema` (both already exported). Add no dispatch logic
yet — this task ends with each claimed row available in the loop, doing
nothing further with it.

**MIRROR**: `src/worker/db/schema.ts:233-264` (`# SOURCE` block above, for
the two columns and the index shape) and `src/worker/routes/oauth-callback.ts:120`
(the single-condition `db.update(...).where(eq(...))` shape this task
extends with `and()`/`isNull()`).

**VALIDATE**: `npx tsc -b` (exits non-zero on any strict-mode violation —
including `noUncheckedIndexedAccess` on the `[claimed]` destructure and
`exactOptionalPropertyTypes` on the new query's option objects; today, before
this task runs, `runScheduledJob`'s body is empty and this compiles trivially,
so this VALIDATE would not itself catch a missing task — it is the correctness
gate for the new query and claim logic Task 1 introduces, exercised for real
once Task 2's Task-status branch and Task 3/4's dispatch/release code are
layered on top of it in the same function)

### Task 2: Skip dispatch — but keep the claim — for a closed Task's Reminder

**ACTION**: Immediately after the claim succeeds (inside the same loop, right
after the `if (claimed === undefined) continue;` line), look up the claimed
Reminder's linked Task when `reminder.taskId !== null`:
`const [task] = reminder.taskId !== null ? await db.select().from(tasks).where(eq(tasks.id, reminder.taskId)) : [];`.
When `task !== undefined && (task.status === "done" || task.status ===
"missed")`, `continue` — the row's `sentAt` stays set from Task 1's claim
(the Reminder is never reconsidered on a later tick), and no dispatch is
attempted (AC-9). A standalone Reminder (`taskId === null`) or one linked to
an open Task falls through to Task 3's dispatch step.

**MIRROR**: `src/worker/routes/reminders.ts:44-51` (`# SOURCE` block above) —
same "select by id, branch on the row" shape, adapted to branch on `status`
rather than on "not found".

**VALIDATE**: `npx tsc -b` (fails non-zero on a type error in the new
`Task | undefined` branch; against the tree as it stands before this task,
`runScheduledJob` has no Task lookup at all, so this exercises code that
genuinely did not exist)

### Task 3: Dispatch through the proven push path and prune on `gone`

**ACTION**: For every Reminder that reaches this point (survived Task 1's
claim and Task 2's closed-Task skip), build the notification payload once per
Reminder via `buildNotificationPayload({ title: "Praesto", body: reminder.label
?? task?.title ?? "Lembrete", route: "/", tag: \`reminder-${reminder.id}\` })`
(pt-BR fallback string, matching the precedent in
`src/worker/routes/push.ts:115`; `route` stays `"/"` per this phase's
explicit scope limit). Fetch `const subscriptions = await
db.select().from(pushSubscriptions);` once per Reminder (or once before the
loop — either is correct; fetching once before the loop and re-checking
per-Reminder against any rows Task 3 has already pruned in this same run is
the more efficient choice). For each subscription, call `sendPush` with the
same argument shape as `push.ts:127-136`, classify the result with
`classifyPushOutcome`, and when `outcome.kind === "gone"`, delete that
`push_subscriptions` row by `endpoint` — mirroring `push.ts:138-141`
byte-for-shape. Collect each outcome for Task 4 to inspect (e.g. push them
into a local array keyed by Reminder). Import `pushSubscriptions` from
`./db/schema`, `sendPush` from `./push/send`, `classifyPushOutcome` from
`../shared/push-outcome`, `buildNotificationPayload` from
`../shared/push-payload`, and read the VAPID triple from `env` exactly as
`push.ts:121-125` does.

**MIRROR**: `src/worker/routes/push.ts:104-144` (`# SOURCE` block above).

**VALIDATE**: `npm test` (runs the full Vitest suite inside workerd,
including the test-first suite authored against this phase's Acceptance
Criteria — notably AC-7's "one dead endpoint does not suppress a live one" —
before this plan's Implementer runs, per `docs/context/methodology.md`'s
`tdd: true` routing; `vitest run` exits non-zero on any failing test. Against
the tree before this task, `runScheduledJob` calls `sendPush` for no Reminder
at all, so AC-7's dispatch-and-prune assertions fail today for the right
reason)

### Task 4: Release the claim on a retryable outcome

**ACTION**: After Task 3's per-subscription loop finishes for a given
Reminder, inspect the collected outcomes: if at least one outcome classified
`{ kind: "retryable" }`, release the claim — `await
db.update(reminders).set({ sentAt: null }).where(eq(reminders.id,
reminder.id));` — so the next `runScheduledJob` tick reconsiders this row
(AC-6). When every outcome was `{ kind: "delivered" }`, or every subscription
was pruned as `{ kind: "gone" }` (including the case of zero stored
subscriptions), leave `sentAt` exactly as Task 1's claim set it — the
Reminder is never dispatched again. A single `gone` alongside a single
`delivered` (no `retryable` present) also leaves the claim set, matching
AC-7's "one dead endpoint does not suppress a live one, and the Reminder is
still recorded as sent".

**MIRROR**: `src/worker/routes/oauth-callback.ts:120` (`# SOURCE` block
above) — the single-condition `db.update(...).where(eq(...))` shape, reused
here unmodified (no `and()` needed for the release, only for Task 1's claim).

**VALIDATE**: `npm test` (exercises this phase's complete Acceptance
Criteria set — AC-5, AC-6, AC-7, AC-9, AC-10 — end to end against the fully
assembled `runScheduledJob`; against the tree before this task, a retryable
outcome would leave `sentAt` permanently set, so AC-6's release-and-retry
assertion fails today for the right reason)

## Validation Commands

**Level 1 (STATIC_ANALYSIS)**:
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .`,
chained with `&&` — fails non-zero on the first failing stage, including
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violations this
project has twice let slip past a green Vitest run)

**Level 2 (UNIT_TESTS)**:
```
npm test
```
(`vitest run` — exits non-zero on any failing test; exercises the test-first
suite authored against AC-5, AC-6, AC-7, AC-9 and AC-10 before this plan's
Implementer runs, per `docs/context/methodology.md`'s `tdd: true` routing)

**Level 3 (INTEGRATION)**:
```
if grep -q "classifyPushOutcome" src/worker/cron.ts \
   && grep -q "sendPush(" src/worker/cron.ts \
   && grep -q "buildNotificationPayload" src/worker/cron.ts \
   && grep -q "pushSubscriptions" src/worker/cron.ts \
   && grep -qE "sentAt:\s*null" src/worker/cron.ts; then
  echo "PASS: runScheduledJob wires the full claim/dispatch/prune/release chain"
else
  echo "FAIL: runScheduledJob is missing one of dispatch/classify/prune/release"
  exit 1
fi
```
(against the tree as it stands today, `src/worker/cron.ts` contains none of
these five tokens — `runScheduledJob`'s body is empty — so this fails for the
right reason before the plan's tasks run, and passes only once every stage of
the sweep is actually wired)

## Acceptance Criteria

- **AC-A1 (PRD AC-5):** Given two Reminders whose `fireAt` is in the past and
  whose `sentAt` is null, when `runScheduledJob` executes, then each row's
  `sentAt` is set by a conditional update matching only `sentAt IS NULL`, and
  `sendPush` is invoked at most once per row per run — a second
  `runScheduledJob` in the same window sends nothing.
- **AC-A2 (PRD AC-6):** Given a due Reminder claimed by the sweep, when
  `classifyPushOutcome` reports a retryable outcome (429/5xx), `sentAt` is
  reset to null so the next tick retries it; when the outcome is delivered,
  or `gone` for every subscription, `sentAt` stays set and the row is never
  sent again.
- **AC-A3 (PRD AC-7):** Given two push subscriptions where one returns `gone`
  and the other succeeds, when the sweep dispatches a due Reminder, the dead
  subscription row is deleted from `push_subscriptions` and the Reminder is
  still recorded as sent.
- **AC-A4 (PRD AC-9):** Given a Reminder attached to a Task whose status is
  `done` or `missed`, when the sweep runs after its `fireAt`, no push is
  dispatched for it and `sentAt` is set so it is not reconsidered on every
  subsequent tick.
- **AC-A5 (PRD AC-10):** Given a Reminder whose `fireAt` is 40 minutes in the
  past and whose `sentAt` is null, when the sweep next runs, it is dispatched
  exactly once — the sweep's predicate is `fireAt <= now AND sentAt IS NULL`,
  with no lower bound that would let a missed window swallow it silently.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A crash between claiming a row (Task 1) and dispatching it (Task 3) silently swallows that Reminder | M | The owner never learns a Reminder was due | Accepted and made visible rather than hidden, per the PRD: `runCronHeartbeat`'s `finally` block already records a `failure` row in `cron_runs` regardless of where inside `runScheduledJob` the throw happened, and the diagnostics screen surfaces cron freshness. AC-6's release path covers the far more common case (a retryable push outcome); a hard crash is rare and leaves a trace |
| The sweep's extra writes (one claim `UPDATE` per due Reminder, plus an occasional release) push the free-plan D1 write budget, compounding the 288 daily `cron_runs` rows | L | Free-plan D1 write quota exhaustion | Chore C9 is already armed for ~2026-09-15 specifically to read this together; the sweep writes at most one `UPDATE` per due Reminder per tick (typically far fewer than 288/day), small next to what is already measured |
| A suite that passes under Vitest still breaks under `tsc -b` (this project has done this twice) | M | A merged phase ships a type error | `npm run check` (Level 1) runs before Level 2/3 report success, and Tasks 1/2's own `VALIDATE` already runs `tsc -b` directly on the new query/claim/lookup code, catching `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violations at the smallest possible diff |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd`
in `docs/context/methodology.md`: **true**. Test-first ordering — the test
pair (test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are
routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger
(`/relay-write-test` → `/relay-test-write-review`), not authored by the
Implementer — R-X is a blanket straight-fail on any test glob in the
Implementer's diff. No task above and no `## Files to Change` row targets a
test file, so this plan's `**VALIDATE**` commands exercise the change
directly (`npx tsc -b`, or the full `npm test` run once the pre-authored
suite exists) rather than the Implementer inventing test coverage.

**On the claim mechanism's design (research-web cross-check).** Third-party
write-ups on Cloudflare Queues + D1 idempotent jobs (`flaviocopes.com`)
recommend an expiring-lease claim (a random token plus a TTL) so a crashed
worker's claim self-expires. This plan deliberately does NOT adopt that: the
PRD's own Decisions Log already weighed and rejected a lease column in favor
of the simpler `sent_at IS NULL` claim, on the grounds that a lease would be
"a second mechanism for what `sent_at` already expresses" and that
`runCronHeartbeat`'s `cron_runs` failure row already makes a crash visible.
Recorded here so the Implementer does not "improve" the design mid-task —
that would contradict the PRD it is scoped to.

**On dispatch ordering (research-web cross-check).** Pushpad's documented
Web Push status-code guide (`pushpad.xyz`) confirms the classification this
plan's Task 3/4 rely on: 404/410 are permanent (`gone`, prune), 429/5xx are
transient (`retryable`, release the claim) — exactly `classifyPushOutcome`'s
existing contract (`src/shared/push-outcome.ts:21-24`). No change to that
module is needed or made by this phase.

*Generated: 2026-09-09*
*Approved: 2026-09-09*
*Status: IMPLEMENTED*
