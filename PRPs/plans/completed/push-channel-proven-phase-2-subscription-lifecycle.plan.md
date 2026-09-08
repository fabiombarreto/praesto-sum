# Feature: subscription-lifecycle (Phase 2 of push-channel-proven)

```
**Decision Gate**
- Active context: none
- Activated criteria: architectural decisions; cross-cutting patterns; reuse or creation of
  components; impact on shared services (the Worker's route table, DTO mapping); domain rules
  (reminders)
- Decisions found: ADR-0003 (canonical data in D1 behind Workers; Web Push is the declared FR-041
  mechanism) · ADR-0013 (`@block65/webcrypto-web-push@2.0.0` is the adopted send library, replacing
  `web-push`; already the sole dependency in `package.json`) · 2026-08-11 methodology decision
  (browser-API work splits decidable logic into `src/shared` behind a port, exempting only the thin
  adapter — this phase's `src/shared/push-payload.ts`/`push-outcome.ts` are themselves the decidable
  half, mirroring `src/shared/request-failure.ts`/`google-settings.ts`, not glue around a browser
  API) · ADR-0001/ADR-0009 (English artifacts; pt-BR carve-out is visible UI copy only — this phase
  ships no UI)
- Applicable anti-patterns: "Hand-duplicated entity types" — the new `PushSubscriptionDto` is
  mapped in `src/worker/dto.ts`, never hand-declared twice · "Version ranges in dependencies" — no
  new dependency is introduced this phase · "Weakening tests to force green" — not applicable to
  this DRAFT (no tests exist in this plan to weaken; the test pair owns the suite) · "Portuguese in
  artifacts" — this phase ships no UI copy, so no pt-BR carve-out applies
- Applicable architectural rules: one Worker serves assets, `/api/*` (Hono) and `scheduled()` ·
  bearer token on every `/api/*` route, no exceptions · types originate in
  `src/worker/db/schema.ts` and flow outward through `src/worker/dto.ts` into `src/shared/api.ts` ·
  `push_subscriptions` already exists (migration `0000`) — no migration in this phase
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/push-channel-proven.prd.md` — Implementation Phases row 2: "subscription-lifecycle" —
  Goal: Store, refresh and prune subscriptions, and make one dispatch observable on demand —
  Success signal: `npm test` covers AC-1..AC-4 and AC-8; a test push fired from a route reaches the
  device; re-submitting the same endpoint leaves the row count unchanged.

## Summary

This phase gives the Web Push channel a real subscription lifecycle and one on-demand dispatch
route. It extracts the two pieces of decidable logic phase 1's spike deliberately left out of
`src/shared` — a payload builder that shapes what `src/sw.ts` already parses (title truncated to 30
visible characters, body, icon, badge, `tag`, target route under `data`, at most 2 actions) and an
outcome mapper that classifies a `sendPush()` result into delivered / gone / retryable — then wires
three Hono routes (subscribe, unsubscribe, test-push) over the existing `push_subscriptions` table,
with the endpoint as the identity an upsert refreshes rather than duplicates. It does **not** touch
`scheduled()`, the `cron_runs` table, the diagnostics endpoint, or any UI; those are phases 3 and 4.

## User Story

As the owner, I want the assistant to remember my device's push subscription, refresh it instead of
duplicating it when it changes, and let me fire a test notification on demand, so that I can trust
the channel is wired correctly before Reminders (unit 7) ever depends on it.

## Problem Statement

Phase 1 proved a push can leave workerd, but it built no lifecycle around that fact: there is no
route to store a subscription, no logic to tell a dead endpoint from a merely slow one, and no way
to fire a dispatch except the throwaway single-row spike route. Without an upsert keyed on the
endpoint, a browser that re-subscribes (a documented, ordinary browser behavior) would either be
silently ignored or would duplicate a row `push_subscriptions_endpoint_unq` already exists to
prevent from mattering. Without an outcome mapper, a 404/410 and a transient 5xx look identical to
every caller, and PRD AC-4's own warning — "a transient error never silently discards the owner's
only subscription" — has nothing enforcing it.

## Solution Statement

Two new `src/shared` modules carry the decidable logic, each mirroring the existing
`request-failure.ts`/`google-settings.ts` shape (pure functions, no DOM, no runtime dependency,
environment-agnostic so they compile into both the browser and Worker targets even though this
phase only calls them from the Worker): `push-payload.ts` builds the exact notification shape
`ui-ux-guidelines.md` §8 and `src/sw.ts` already expect, and `push-outcome.ts` classifies a
`sendPush()` result into `delivered` / `gone` / `retryable` using the industry-standard 404/410
(permanent, prune) vs 429/5xx (transient, retain) split (`web.dev`'s push-library guide;
Pushpad's documented mapping) — defaulting any other failure shape (an unclassified status code, or
no status code at all because the network call itself failed) to `retryable`, never to `gone`, so an
ambiguous failure can never silently delete the owner's only subscription. A new
`src/worker/routes/push.ts` router adds `POST /api/push/subscriptions` (upsert by endpoint),
`DELETE /api/push/subscriptions` (remove by endpoint) and `POST /api/push/test` (dispatch to every
stored subscription, pruning any that come back `gone`), mounted under the existing `requireToken`
gate exactly like every other route. `src/worker/dto.ts` gains `toPushSubscriptionDto`, following
the existing field-by-field mapping convention with `toEpochSeconds` for the two instant columns.

## Metadata

| Field | Value |
|---|---|
| Type | Feature — subscription lifecycle logic + routes |
| Complexity | Medium — two new `src/shared` modules plus a three-route Hono file, no schema change |
| Systems Affected | `src/shared`, `src/worker/routes`, `src/worker/dto.ts`, `src/worker/index.ts`, `docs/api-reference.md` |
| Dependencies | Phase 1's `sendPush()` adapter (`src/worker/push/send.ts`) and `@block65/webcrypto-web-push@2.0.0` (already pinned); the existing `push_subscriptions` table (migration `0000`) |
| Estimated Tasks | 7 |
| Source PRD line ref | `PRPs/prds/push-channel-proven.prd.md` Implementation Phases row 2 |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/worker/db/schema.ts` | 272-289 | `pushSubscriptions` — the exact columns (`endpoint`, `p256dh`, `auth`, `deviceLabel`, `createdAt`, `lastSeenAt`) and the unique `endpoint` index the upsert (AC-A2) is built around |
| P0 | `src/worker/push/send.ts` | 1-56 | `sendPush()`'s existing outcome shape (`{ ok, statusCode?, error? }`) — the outcome mapper (Task 2) classifies exactly this shape, it does not reshape it |
| P0 | `src/worker/routes/push-spike.ts` | 1-43 | The file-doc-comment convention, the `createDb(c.env)` + `db.select().from(pushSubscriptions)` read pattern, and the never-a-vacuous-outcome response shape this phase's routes extend |
| P0 | `src/worker/index.ts` | 1-63 | Where every route is mounted under `/api/*`; the `requireToken` gate line (20); the exact registration-line shape (22-27) Task 6 copies |
| P0 | `src/worker/dto.ts` | 41-43, 107-122 | `toEpochSeconds` and the field-by-field `toReminderDto` mapping — the exact shape `toPushSubscriptionDto` (Task 4) follows |
| P0 | `src/shared/request-failure.ts` | 1-57 | The canonical `src/shared` pure-module shape: a discriminated `kind` result type, no DOM/runtime dependency, duck-typed inputs — both new `src/shared` modules mirror this |
| P1 | `src/shared/google-settings.ts` | 1-49 | A second worked example of the same `src/shared` pattern, including the doc-comment convention citing the PRD/plan ACs it satisfies |
| P1 | `src/sw.ts` | 12-19, 68-82 | The `PushPayload` shape the client currently parses (flat `title`/`body`/`url`/`tag`, `icon`/`badge` hardcoded) — the payload builder (Task 1) must emit values consistent with what the mark/badge paths already are; see `## Risks and Mitigations` for the `data.route` naming gap this phase does not close |
| P1 | `src/worker/routes/google.ts` | 216-236 | Hand-rolled body validation (`Array.isArray`, explicit 400s) — this project has no schema-validation library; the new routes validate the same way |
| P1 | `src/worker/routes/tasks.ts` | 120-134, 305-313 | `readJson()` plus the create-route validation/insert/201 shape Task 5's subscribe route follows |
| P1 | `documentation/40-engineering/ui-ux-guidelines.md` | 88 | §8 "Notification content" row — the exact payload shape AC-1/AC-A1 encode: title ≤ 30 visible characters, body = when and what, icon = the mark, monochrome 72 px badge, ≤ 2 actions in the infinitive, `tag` per target so a re-send replaces rather than stacks |
| P1 | `tsconfig.base.json` | 7-9 | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — every optional field in the new DTO/payload/outcome types and every array index in the new routes is written against these from the first line |
| P2 | `test/push-send-adapter.test.ts` | 1-91 | The `vitest-pool-workers` unit-test shape (`.invalid` endpoint, `crypto.subtle`-generated keys) the test pair is likely to mirror for the new `src/shared` modules |
| P2 | `test/push-send-spike-route.test.ts` | 1-86 | The route-test shape (`exports.default.fetch`, `env.API_BEARER_TOKEN`, `beforeEach` cleanup) the test pair is likely to mirror for the new routes |
| P2 | `docs/context/testing.md` | 51-63 | The `worker` vitest project's isolation rules — relevant context, not exercised by this plan's own VALIDATE commands |
| P2 | `docs/domain/areas/reminders.md` | 14-16 | "Push failure is SILENT — ... a manual test-push route is recommended" — the domain justification for `POST /api/push/test` |

## Patterns to Mirror

```
# SOURCE: src/worker/db/schema.ts:272-289
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceLabel: text("device_label"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_unq").on(t.endpoint)],
);
```
Read by Tasks 3, 4 and 5 — `endpoint`/`p256dh`/`auth`/`deviceLabel`/`createdAt`/`lastSeenAt` are the
exact fields the DTO and the subscribe/unsubscribe routes read and write; the unique index is the
invariant the upsert (AC-A2) relies on rather than a convention it merely respects.

```
# SOURCE: src/worker/push/send.ts:24-56
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapid: { subject: string; publicKey: string; privateKey: string },
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  ...
  if (response.ok) {
    return { ok: true, statusCode: response.status };
  }
  const bodyText = await response.text();
  return {
    ok: false,
    statusCode: response.status,
    error: bodyText.length > 0 ? bodyText : `push service responded ${response.status}`,
  };
  ...
}
```
Read by Task 2 — the outcome mapper classifies exactly this `{ ok, statusCode?, error? }` shape; it
does not call `sendPush` itself and does not reshape its return value, only interprets it.

```
# SOURCE: src/worker/routes/push-spike.ts:17-43
export const pushSpikeRoutes = new Hono<{ Bindings: Env }>();

pushSpikeRoutes.post("/", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(pushSubscriptions).limit(1);
  const subscription = rows[0];

  if (!subscription) {
    return c.json({ ok: false, error: "no stored subscription" }, 200);
  }
  ...
  return c.json(result, result.ok ? 200 : 502);
});
```
Copied by Task 5 — the sub-router shape, the `createDb(c.env)` read, the `noUncheckedIndexedAccess`-
safe `rows[0]` branch, and the "never a vacuous outcome" response convention (AC-A5), extended to
every stored row instead of `limit(1)`.

```
# SOURCE: src/worker/index.ts:20-27
app.use("/api/*", requireToken);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/google", googleRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/export.ics", icsRoutes);
app.route("/api/push-spike", pushSpikeRoutes);
```
Copied by Task 6 — the new `pushRoutes` router is mounted the same way, below the `requireToken`
line, never above it.

```
# SOURCE: src/worker/dto.ts:111-122
export function toReminderDto(row: Reminder): ReminderDto {
  return {
    id: row.id,
    taskId: row.taskId,
    label: row.label,
    fireAt: toEpochSeconds(row.fireAt) ?? 0,
    originOffsetMinutes: row.originOffsetMinutes,
    sentAt: toEpochSeconds(row.sentAt),
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
    updatedAt: toEpochSeconds(row.updatedAt) ?? 0,
  };
}
```
Mirrored by Task 4 — `toPushSubscriptionDto` writes every field explicitly the same way, converting
`createdAt`/`lastSeenAt` with the same `toEpochSeconds` helper (`src/worker/dto.ts:41-43`).

```
# SOURCE: src/shared/request-failure.ts:28-57
export interface RequestFailure {
  kind: "server-unreachable" | "http-error";
  message: string;
}

export function classifyRequestFailure(cause: unknown): RequestFailure {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    typeof (cause as { status: unknown }).status === "number"
  ) {
    const status = (cause as { status: number }).status;
    return { kind: "http-error", message: `...${status}...` };
  }
  return { kind: "server-unreachable", message: "..." };
}
```
Mirrored by Task 2 — a discriminated `kind` result type, duck-typed input, never throws, exactly the
shape `classifyPushOutcome` takes for `delivered` / `gone` / `retryable`.

```
# SOURCE: src/worker/routes/google.ts:216-236
googleRoutes.put("/calendars", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { calendarIds?: unknown } | null;
  const ids = Array.isArray(body?.calendarIds) ? body.calendarIds : null;
  if (ids === null) return c.json({ error: "calendarIds must be an array" }, 400);
  if (ids.length === 0) {
    return c.json({ error: "at least one calendar must be selected", hint: "..." }, 400);
  }
  if (ids.some((id) => typeof id !== "string" || id.trim() === "")) {
    return c.json({ error: "every calendarId must be a non-empty string" }, 400);
  }
  ...
});
```
Mirrored by Task 5 — hand-rolled `typeof`/`Array.isArray` body validation with explicit 400s; this
project has no schema-validation library, and the new subscribe/unsubscribe routes validate the same
way.

```
# SOURCE: src/shared/api.ts:24-40, 187-194
export interface TaskDto {
  id: string;
  title: string;
  ...
}
...
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: TaskPriority | null;
  lifeAreaId?: string | null;
}
```
Mirrored by Task 3 — the DTO/input-type placement and naming convention (a plain exported
`interface`, optional fields marked with `?`, no class, no runtime validation baked into the type
itself) this file already establishes.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/push-payload.ts` | CREATE | The AC-1 payload builder: title truncation, body, icon, badge, `tag`, target route under `data`, capped at 2 actions |
| `src/shared/push-outcome.ts` | CREATE | The AC-3/AC-4 outcome mapper: classifies a `sendPush()` result into `delivered` / `gone` / `retryable` |
| `src/shared/api.ts` | UPDATE | Add `PushSubscriptionDto` (the wire shape for a stored subscription) and `SubscribePushInput` (the subscribe route's request body shape) |
| `src/worker/dto.ts` | UPDATE | Add `toPushSubscriptionDto`, following the existing field-by-field mapping convention |
| `src/worker/routes/push.ts` | CREATE | `POST /api/push/subscriptions` (upsert), `DELETE /api/push/subscriptions` (remove by endpoint), `POST /api/push/test` (dispatch + prune) |
| `src/worker/index.ts` | UPDATE | Mount `/api/push` under the existing `requireToken` gate, same line shape as the other routes |
| `docs/api-reference.md` | UPDATE | Add the three new routes to the `## Implemented` table; this file's own header states "Keep this in sync as routes land" |

## NOT Building (Scope Limits)

- **`scheduled()`, `cron_runs`, the freshness classifier, the diagnostics endpoint.** Phase 3's
  scope entirely; no task below touches `src/worker/index.ts`'s `scheduled()` handler.
- **The `/settings` → *Notificações* route, the permission flow, any UI.** Phase 4's scope; this
  phase ships no `src/app/` change and no pt-BR copy.
- **Updating `src/sw.ts` to consume the payload builder's `data.route` field.** `src/sw.ts` today
  parses a flat `{title, body, url, tag}` shape and reads `data.url` on click — not the nested
  `data: { route }` shape AC-1 requires the payload builder to emit. Reconciling the two is a real
  gap (see `## Risks and Mitigations`), but `src/sw.ts` is not named in Phase 2's Scope in the PRD's
  Phase Details, and this phase's own success signal ("a test push fired from a route reaches the
  device") only requires a notification to appear, not that tapping it opens the right route —
  that is AC-10's concern, owned by Phase 4's device pass.
- **Automatic retry scheduling for `retryable` outcomes.** The outcome mapper classifies a failure
  as retryable and the route retains the row and records the failure; nothing in this phase
  schedules a re-attempt. A cron-driven retry, if ever wanted, is a Phase 3+ concern.
- **`pushsubscriptionchange` handling.** Web research surfaced this as a way to rotate an endpoint
  proactively before it expires, but no route or client code for it is named by the PRD; out of
  scope here.
- **Multi-device fan-out policy.** The table already supports many rows via the unique `endpoint`
  index; this phase ships the CRUD, not a strategy for choosing among several devices (PRD's own
  "What We're NOT Building").

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/push-payload.ts`

**ACTION**: Create a module exporting `interface NotificationPayload { title: string; body: string;
icon: string; badge: string; tag: string; data: { route: string }; actions?: readonly
NotificationActionPayload[] }` and `interface NotificationActionPayload { action: string; title:
string }`, plus `buildNotificationPayload(input: { title: string; body: string; route: string; tag:
string; actions?: readonly NotificationActionPayload[] }): NotificationPayload`. Truncate `title` to
its first 30 characters when longer (`ui-ux-guidelines.md` §8's "≤ 30 characters shown"); pass
`body` through unchanged (the caller decides "when and what is due" wording — out of this module's
concern). Hardcode `icon: "/icons/icon-192.png"` and `badge: "/icons/badge-72.png"` — the same two
paths `src/sw.ts:76-77` already hardcodes, so the two halves of the channel agree on the asset
without either importing the other (`src/shared` compiles into the Worker, `src/sw.ts` is a separate
build target). Set `data: { route: input.route }` verbatim. Cap `actions` to at most 2 by slicing,
and — respecting `exactOptionalPropertyTypes` — include the `actions` key on the returned object
only when the (possibly sliced) array is non-empty; never assign an empty array or `undefined` to an
optional key. No task in this phase ever calls `buildNotificationPayload` with `actions` set (see
`## NOT Building`), so the invariant is exercised only by the cap logic itself, not by a caller.

**MIRROR**: `# SOURCE: src/shared/request-failure.ts:28-57` for the environment-agnostic, no-DOM
module shape; `# SOURCE: src/sw.ts:68-82`'s hardcoded `icon`/`badge` paths, which this module must
match byte-for-byte so the two halves of the channel agree without a shared import.

**Delivers**: AC-A1 (PRD AC-1) — the payload builder's exact output shape.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 2: CREATE `src/shared/push-outcome.ts`

**ACTION**: Create a module exporting a discriminated union `type PushOutcome = { kind:
"delivered"; statusCode: number } | { kind: "gone" } | { kind: "retryable"; error: string;
statusCode?: number }` and `classifyPushOutcome(result: { ok: boolean; statusCode?: number; error?:
string }): PushOutcome`. When `result.ok` is `true`, return `{ kind: "delivered", statusCode:
result.statusCode ?? 200 }` (mirrors `sendPush`'s own `ok:true` branch, which always sets
`statusCode` from a real `Response`, so the `?? 200` is a defensive fallback, never the observed
path). When `result.ok` is `false` and `result.statusCode` is `404` or `410`, return `{ kind: "gone"
}` — PRD AC-3's "classifies that endpoint as gone" (the industry-standard split: 410 is the
preferred code for a permanently expired subscription and 404 is treated the same way by every push
provider surveyed, since RFC 7231 gives 404 no temporary/permanent signal of its own — see
web.dev's push-library guide and Pushpad's documented status-code mapping). Otherwise — `429`, any
`5xx`, an unrecognized status code, or no `statusCode` at all because the network call itself
failed — return `{ kind: "retryable", error: result.error ?? "push dispatch failed with no status
code", ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }) }`, respecting
`exactOptionalPropertyTypes` by omitting `statusCode` rather than setting it to `undefined`. This
default-to-retryable behavior for anything not explicitly `404`/`410` is deliberate: PRD AC-4's own
rationale is "a transient error never silently discards the owner's only subscription", so an
unrecognized failure must never be classified as `gone`.

**MIRROR**: `# SOURCE: src/shared/request-failure.ts:28-57` for the discriminated `kind` result type
and the duck-typed, never-throws input handling.

**Delivers**: AC-A2 (PRD AC-3) and AC-A3 (PRD AC-4) — the `gone`/`retryable` split and the
default-to-retryable safety rule.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 3: UPDATE `src/shared/api.ts`

**ACTION**: Add `export interface PushSubscriptionDto { id: string; endpoint: string; deviceLabel:
string | null; createdAt: number; lastSeenAt: number }` (never `p256dh`/`auth` — those are the
subscription's cryptographic keys, not display data, and the DTO is what the wire actually carries)
and `export interface SubscribePushInput { endpoint: string; keys: { p256dh: string; auth: string };
deviceLabel?: string | null }` (the subscribe route's request body shape, mirroring
`CreateTaskInput`'s existing placement in this same file). Both instants (`createdAt`, `lastSeenAt`)
are epoch seconds per this file's own header convention.

**MIRROR**: `# SOURCE: src/shared/api.ts:24-40, 187-194` (the existing `TaskDto`/`CreateTaskInput`
pair, read during grounding) for the DTO/input-type placement and naming convention in this file.

**Infrastructure/scaffolding — no AC of its own**: this task only declares the wire types Task 4
and Task 5 consume; it delivers no behavior by itself.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 4: UPDATE `src/worker/dto.ts`

**ACTION**: Add `export function toPushSubscriptionDto(row: PushSubscription): PushSubscriptionDto`
(import the `PushSubscription` row type from `./db/schema`, alongside the existing `Task`/`Reminder`
imports), writing every field explicitly: `id: row.id, endpoint: row.endpoint, deviceLabel:
row.deviceLabel, createdAt: toEpochSeconds(row.createdAt) ?? 0, lastSeenAt: toEpochSeconds(
row.lastSeenAt) ?? 0`. Never map `p256dh` or `auth`.

**MIRROR**: `# SOURCE: src/worker/dto.ts:111-122` (`toReminderDto`) for the field-by-field shape and
the `toEpochSeconds(...) ?? 0` idiom for a `notNull` timestamp column.

**Delivers**: AC-A2 (PRD AC-3, AC-2's identity-is-the-endpoint) — the DTO is what the subscribe
route (Task 5) returns to confirm the upsert happened against the existing row, never a fresh one.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 5: CREATE `src/worker/routes/push.ts`

**ACTION**: Create `export const pushRoutes = new Hono<{ Bindings: Env }>();` with three routes.

1. `POST /` (subscribe) — read and validate the JSON body the same hand-rolled way
   `googleRoutes.put("/calendars")` does: `endpoint` must be a non-empty string, `keys.p256dh` and
   `keys.auth` must be non-empty strings, `deviceLabel` (if present) must be a string or `null` —
   400 with a specific `error` message on any violation. Look up an existing row by `eq(
   pushSubscriptions.endpoint, endpoint)`; if found, `UPDATE` its `p256dh`, `auth`, `deviceLabel`
   (only when the key was present in the body — an absent `deviceLabel` leaves the stored value
   unchanged, mirroring `tasks.ts`'s `Object.hasOwn` partial-update discipline) and `lastSeenAt: new
   Date()`, `.returning()`; if not found, `INSERT` a new row with `id: crypto.randomUUID()`. Respond
   `c.json({ subscription: toPushSubscriptionDto(row) }, existing ? 200 : 201)`.
2. `DELETE /` (unsubscribe) — read `{ endpoint: string }` from the JSON body (400 if missing or not
   a string), `DELETE FROM push_subscriptions WHERE endpoint = ?`, `.returning()`; respond `c.body(
   null, 204)` if a row was deleted, `c.json({ error: "No subscription with that endpoint" }, 404)`
   otherwise.
3. `POST /test` (test-push) — `db.select().from(pushSubscriptions)` (every row, not `limit(1)` —
   the spike route's precursor scope no longer applies). If the array is empty, respond `c.json({
   ok: false, error: "no stored subscriptions", results: [] }, 200)` (never a bare/vacuous success,
   PRD AC-8's zero-subscriptions clause). Otherwise, for each subscription: build the payload via
   `buildNotificationPayload({ title: "Praesto", body: "Notificação de teste", route: "/", tag:
   "test-push" })`, call `sendPush(...)` with the subscription's `endpoint`/`keys` and the VAPID
   trio from `c.env`, classify the result via `classifyPushOutcome`, and — when the outcome is `{
   kind: "gone" }` — `DELETE` that row (`eq(pushSubscriptions.endpoint, subscription.endpoint)`),
   AC-3's pruning applied here rather than deferred to a future cron. Respond `c.json({ ok: true,
   results: [{ endpoint, outcome }, ...] })` where each `outcome` is the `PushOutcome` object
   verbatim — PRD AC-8's "names, per endpoint, whether the push service accepted it and with which
   status code" is satisfied by echoing the discriminated `kind`/`statusCode`/`error` fields rather
   than collapsing them into a single boolean.

**MIRROR**: `# SOURCE: src/worker/routes/push-spike.ts:17-43` for the sub-router shape and the
`rows[0]`-branch / never-vacuous-outcome convention; `# SOURCE: src/worker/routes/google.ts:216-236`
for the hand-rolled body validation; `# SOURCE: src/worker/routes/tasks.ts:120-134` (readJson) and
`tasks.ts:190-264` (`Object.hasOwn` partial-update discipline) for the subscribe route's body
handling.

**Delivers**: AC-A2 (PRD AC-2) — the subscribe route's upsert-by-endpoint; AC-A2 (PRD AC-3) and
AC-A3 (PRD AC-4) — the test-push route's prune-on-`gone` / retain-on-`retryable` wiring; AC-A4 (PRD
AC-8) — the test-push route's per-endpoint, never-vacuous outcome reporting.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 6: UPDATE `src/worker/index.ts`

**ACTION**: Import `pushRoutes` from `./routes/push` and add `app.route("/api/push", pushRoutes);`
directly below the existing `app.route("/api/push-spike", pushSpikeRoutes);` line — inside the
`/api/*` block, above the unauthenticated `/oauth` route, so it inherits `requireToken` exactly like
every other route. Do not remove `pushSpikeRoutes` — it is superseded functionally by `POST
/api/push/test` but its removal is not named in Phase 2's Scope, and leaving it costs nothing (it is
already bearer-gated, dev-only-in-practice code). Do not touch the `scheduled()` handler (out of
this phase's scope — see `## NOT Building`).

**MIRROR**: `# SOURCE: src/worker/index.ts:20-27` for the registration line shape.

**Infrastructure/scaffolding — no AC of its own**: this task only wires the routes already built by
Task 5 into the app's route table under the existing `requireToken` gate; it delivers no observable
behavior itself.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
if git diff --unified=0 -- src/worker/index.ts | grep -E "^\+[^+]" | grep -q 'app.route("/api/push",'; then
  echo "PASS: push route registered under /api/*"
else
  echo "FAIL: push route not found in the diff"
  exit 1
fi
```

### Task 7: UPDATE `docs/api-reference.md`

**ACTION**: Add three rows to the `## Implemented` table (below the existing `DELETE /api/tasks/:id`
row): `POST /api/push/subscriptions` (upsert by endpoint — 201 on insert, 200 on update, 400 on
invalid body), `DELETE /api/push/subscriptions` (remove by endpoint — 204, or 404 when absent), and
`POST /api/push/test` (dispatch to every stored subscription, pruning any that come back gone — `{
ok, results: [...] }`, or an explicit `{ ok: false, error: "no stored subscriptions" }` with zero
rows). This file's own header states "Keep this in sync as routes land — it is the contract the PWA
codes against"; leaving it stale the same session these routes land would itself be the drift the
header warns against.

**MIRROR**: `# SOURCE: docs/api-reference.md:14-22` (the existing `## Implemented` table) — add rows
in the same `| Method | Route | Behavior |` shape, do not restructure the table.

**Infrastructure/scaffolding — no AC of its own**: this task keeps a maintenance document truthful;
it delivers no PRD-observable behavior beyond what Task 5 already implements.

**VALIDATE**:
```bash
set -euo pipefail
if grep -q '/api/push/subscriptions' docs/api-reference.md && grep -q '/api/push/test' docs/api-reference.md; then
  echo "PASS: new push routes documented in docs/api-reference.md"
else
  echo "FAIL: one or more new push routes missing from docs/api-reference.md"
  exit 1
fi
```

## Validation Commands

### Level 1 STATIC_ANALYSIS
```bash
set -euo pipefail
npm run check
```
Runs `wrangler types --check && tsc -b && eslint . && prettier --check .` — catches any
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violation introduced by Tasks 1-5, plus
lint/format drift, with a real non-zero exit on any failure.

### Level 2 CONTENT_INVARIANTS
```bash
set -euo pipefail
if ! grep -qE '^\s*app\.route\("/api/push",\s*pushRoutes\);' src/worker/index.ts; then
  echo "FAIL: /api/push is not mounted"
  exit 1
fi
GATE_LINE=$(grep -n 'app.use("/api/\*", requireToken);' src/worker/index.ts | cut -d: -f1)
ROUTE_LINE=$(grep -n 'app.route("/api/push",' src/worker/index.ts | cut -d: -f1)
if [ -z "$GATE_LINE" ] || [ -z "$ROUTE_LINE" ] || [ "$ROUTE_LINE" -lt "$GATE_LINE" ]; then
  echo "FAIL: /api/push registered above (or without) the requireToken gate — it would be unauthenticated"
  exit 1
fi
if grep -nE "row\.p256dh|row\.auth\b" src/worker/dto.ts; then
  echo "FAIL: dto.ts maps a subscription's raw crypto keys onto a DTO — they must never cross the wire"
  exit 1
fi
echo "PASS: /api/push exists below the requireToken gate, and no DTO mapper leaks p256dh/auth"
```
This asserts real ordering (the mount line's number strictly greater than the gate's), not just the
presence of two independent lines, and separately proves the negative security invariant — that
`toPushSubscriptionDto` never maps the subscription's cryptographic keys — by grepping the actual
diff target rather than trusting the task description.

### Level 3 DRY-RUN END-TO-END
```bash
set -euo pipefail
npx wrangler dev --local --port 18787 &
WRANGLER_PID=$!
trap 'kill $WRANGLER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:18787/api/health >/dev/null 2>&1 && break
  sleep 1
done

# 1. Unauthenticated calls are rejected.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:18787/api/push/subscriptions)
if [ "$STATUS" != "401" ]; then
  echo "FAIL: POST /api/push/subscriptions answered $STATUS without a bearer token, expected 401"
  exit 1
fi

# 2. Subscribing twice with the same endpoint but different keys upserts, never duplicates
#    (AC-A2 / PRD AC-2's own success signal: row count unchanged).
TOKEN="${API_BEARER_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "FAIL: API_BEARER_TOKEN is not set in this shell — cannot exercise the authenticated path"
  exit 1
fi
BODY1='{"endpoint":"https://push.invalid/level3-dry-run","keys":{"p256dh":"a","auth":"b"}}'
BODY2='{"endpoint":"https://push.invalid/level3-dry-run","keys":{"p256dh":"c","auth":"d"}}'
curl -sf -X POST http://127.0.0.1:18787/api/push/subscriptions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY1" >/dev/null
curl -sf -X POST http://127.0.0.1:18787/api/push/subscriptions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY2" >/dev/null
COUNT=$(npx wrangler d1 execute praesto-db --local --command \
  "select count(*) as n from push_subscriptions where endpoint = 'https://push.invalid/level3-dry-run'" --json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].results[0].n))")
if [ "$COUNT" != "1" ]; then
  echo "FAIL: expected exactly 1 row for the re-submitted endpoint, found $COUNT"
  exit 1
fi

# 3. Unsubscribing removes exactly that row.
curl -sf -X DELETE http://127.0.0.1:18787/api/push/subscriptions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"endpoint":"https://push.invalid/level3-dry-run"}' >/dev/null
COUNT_AFTER=$(npx wrangler d1 execute praesto-db --local --command \
  "select count(*) as n from push_subscriptions where endpoint = 'https://push.invalid/level3-dry-run'" --json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].results[0].n))")
if [ "$COUNT_AFTER" != "0" ]; then
  echo "FAIL: expected 0 rows after unsubscribe, found $COUNT_AFTER"
  exit 1
fi

# 4. Zero-subscription test-push answers explicitly, never a vacuous success.
TESTBODY=$(curl -sf -X POST http://127.0.0.1:18787/api/push/test -H "Authorization: Bearer $TOKEN")
echo "$TESTBODY" | grep -q '"ok":false' || { echo "FAIL: test-push with zero subscriptions did not report ok:false"; exit 1; }
echo "$TESTBODY" | grep -q '"error"' || { echo "FAIL: test-push with zero subscriptions carried no error field"; exit 1; }

echo "PASS: /api/push subscribe upserts by endpoint, unsubscribe removes exactly one row, and zero-subscription test-push is explicit"
```
This is entirely local (`wrangler dev --local`, a local D1, `.invalid` endpoints that never resolve)
— no deploy, no real device, no real push service call, per the project's own recorded rule against
requiring the autonomous implementer to touch production. It proves AC-2's upsert claim against the
real local database rather than trusting the route's own success response.

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** Given a notification request with a title longer than 30 characters and a
  target route, when `buildNotificationPayload` builds the payload, then the emitted object carries
  the title truncated to 30 characters, the body verbatim, `icon: "/icons/icon-192.png"`, `badge:
  "/icons/badge-72.png"`, the given `tag`, the target route under `data.route`, and never more than
  2 entries in `actions`.
- **AC-A2 (PRD AC-2, AC-3):** Given a subscription for an endpoint already stored, when it is
  submitted again with different keys via `POST /api/push/subscriptions`, then the existing row is
  updated in place (keys and `lastSeenAt` refreshed) and the row count for that endpoint stays 1 —
  the unique `endpoint` index is the invariant, not a convention; given the push service answers 404
  or 410 for a stored endpoint during `POST /api/push/test`, then `classifyPushOutcome` returns `{
  kind: "gone" }` and that row is deleted.
- **AC-A3 (PRD AC-4):** Given the push service answers 429 or any 5xx (or the network call fails
  with no status code at all), when `classifyPushOutcome` maps the result, then it returns `{ kind:
  "retryable", error, statusCode? }`, the subscription row survives, and the failure's status code
  (when one exists) is carried in the result — an unrecognized failure shape is never classified as
  `gone`.
- **AC-A4 (PRD AC-8):** Given at least one stored subscription, when `POST /api/push/test` is called
  with a valid bearer token, then the response names, per endpoint, the classified outcome (`kind`
  plus `statusCode`/`error` as applicable); given zero stored subscriptions, then the response
  states `ok: false` with an explicit `error`, never a bare/vacuous success.

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| `src/sw.ts` still parses the flat `{title, body, url, tag}` shape and reads `data.url` on click, not the nested `data: { route }` shape this phase's payload builder emits — a real-world test push would show a notification but tap-through would silently fall back to `/` instead of the intended route | M | Named explicitly in `## NOT Building` rather than silently left; Phase 2's own success signal only requires the notification to appear, not correct tap-through (that is AC-10, Phase 4's device pass) — but Phase 4's plan MUST reconcile this before its own device pass, or AC-10 will fail on the route half even though the phone rings |
| The subscribe route's two-step read-then-write (select, then update-or-insert) is not atomic; two concurrent subscribe calls for the same new endpoint could both attempt an insert and one would fail on the unique index | L | Single-owner, single/near-single-device usage (CON-002) makes true concurrency here vanishingly unlikely; a failed insert surfaces as a clear D1 constraint error rather than silent data loss, and is not the scenario AC-2 is written to test (re-submission, not concurrent first-submission) |
| Classifying an unrecognized status code as `retryable` rather than surfacing it distinctly could mask a genuinely permanent failure (e.g., 400 from a malformed VAPID header) as merely transient | L | This is the deliberate, PRD-directed default: AC-4's own rationale is "a transient error never silently discards the owner's only subscription" — the cost of over-retaining a truly-dead row is recoverable (the owner can unsubscribe manually), while the cost of wrongly pruning a live one is not |
| `POST /api/push/test` fans out to every stored subscription with no concurrency limit | L | The table holds at most a handful of rows for a single owner (PRD's own "not a fan-out strategy" framing); not a real risk at this scale |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in
`docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above,
before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the
`test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` →
`/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any
test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a test
file, so this plan's `**VALIDATE**` commands exercise the change directly (type-check per task, plus
a real local `wrangler dev` dry run at Level 3 proving the upsert/delete/zero-subscription behavior
against the actual local database) rather than invoking the test framework. This mirrors the
approved precedent set by `PRPs/plans/completed/push-channel-proven-phase-1-push-send-spike.plan.md`
(Notes section), which used exactly this shape and shipped `IMPLEMENTED`.

**Why no migration task.** `push_subscriptions` already exists (migration `0000`); this phase adds
no column and no table, so no `drizzle-kit generate` / `wrangler d1 migrations apply` step appears
above.

**Why `pushSpikeRoutes` is not removed.** `POST /api/push/test` supersedes it functionally, but
removing it is not named in Phase 2's Scope in the PRD's Phase Details, and it costs nothing to
leave (already bearer-gated). A future phase or a dedicated cleanup task may retire it.

*Generated: 2026-09-07*
*Approved: 2026-09-07*
*Status: IMPLEMENTED*
