# Feature: push-send-spike (Phase 1 of push-channel-proven)

```
**Decision Gate**
- Active context: none
- Activated criteria: architectural decisions; cross-cutting patterns; reuse or creation of
  components; impact on shared services (the Worker's route table, the auth gate)
- Decisions found: ADR-0003 (canonical data in D1 behind Workers; Web Push is the declared FR-041
  mechanism) · ADR-0005 (`web-push` under `nodejs_compat`, exact version pins; a library swap
  requires a superseding ADR because ADR-0005 names `web-push` explicitly) · ADR-0001/ADR-0009
  (English artifacts; pt-BR carve-out is visible UI copy only — this phase ships no UI) ·
  2026-08-29 (an APPROVED PRD's phase table may grow only with a dated amendment note — not
  triggered here, no new row is being added) · "Send library" row of this PRD's own Decisions Log
  (decided by running it, not by reading; `web-push@3.6.7` is the incumbent)
- Applicable anti-patterns: "Version ranges in dependencies" — any replacement library is pinned
  exact (`save-exact`) · "Hand-duplicated entity types" — the spike reads `push_subscriptions`
  through the existing Drizzle schema, never a hand-declared shape · "Portuguese in artifacts" —
  this phase ships no UI copy, so no pt-BR carve-out applies · "Weakening tests to force green" —
  not applicable to this DRAFT (no tests exist yet to weaken)
- Applicable architectural rules: one Worker serves assets, `/api/*` (Hono) and `scheduled()` ·
  bearer token on every `/api/*` route, no exceptions · types originate in
  `src/worker/db/schema.ts` and flow outward through `src/worker/dto.ts` · browser-API work splits
  the decidable part into `src/shared` behind a port and exempts only the thin adapter
  (`docs/context/methodology.md`, 2026-08-11) — this phase's adapter (`src/worker/push/send.ts`)
  is the Node/library-dependent thin edge, not decidable logic, so it stays outside `src/shared`
  by design; the pure payload/outcome logic phase 2 extracts is out of this phase's scope
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/push-channel-proven.prd.md` — Implementation Phases row 1: "push-send-spike" —
  Goal: Answer the one question that can invalidate the other three phases — Success signal: A
  push sent from workerd reached the owner's device once, and the repo names the library it will
  use with the reason recorded.

## Summary

This phase answers the single open question the rest of `push-channel-proven` depends on: can
`web-push@3.6.7` actually dispatch a real Web Push message from inside a Cloudflare Worker
(workerd, `nodejs_compat`), or must it be swapped for `@block65/webcrypto-web-push`? It builds the
smallest possible dispatch path — a thin adapter around the send library plus one bearer-gated
spike route that reads the sole manually-stored `push_subscriptions` row and attempts one dispatch
— and it records the verdict in this PRD's own Decisions Log. It does **not** build the
subscription lifecycle, the payload builder, the outcome mapper, or the diagnostics screen; those
are phases 2-4 and depend on this phase's verdict to even choose their library.

## User Story

As the owner, I want the assistant to prove — by actually running the code, not by reading GitHub
issues — whether `web-push` works inside the Worker runtime, so that phases 2-4 are built on a
library that is known to work rather than on documentation that conflicts with itself.

## Problem Statement

`web-push`'s own issue tracker documents that `https.request` and `crypto.createECDH` are missing
under `nodejs_compat` (narrowed to this phase's scope from the PRD's Problem Statement), yet
Cloudflare's own guide still recommends the package for exactly this runtime. Nobody in this
project has run the library inside workerd. Building phases 2-4 on an unverified assumption would
risk discovering the incompatibility only after the subscription lifecycle, the cron heartbeat and
the settings screen already depend on the wrong library.

## Solution Statement

Write the smallest dispatch path that can answer the question by executing it: a thin
`sendPush()` adapter wrapping `web-push`'s `setVapidDetails` + `sendNotification`, and one
bearer-gated route that reads the stored subscription and calls it, returning the per-attempt
outcome explicitly rather than a bare success. The automated half of the verdict — does the
library even load and run its encryption/signing path inside workerd without throwing — is proven
by an automated test the test-writer authors against this phase's own Acceptance Criteria,
pointed at a non-production endpoint so no real device or push service is involved. The
non-automatable half — whether a dispatch actually reaches the owner's Android phone — is the
owner's own manual, indelegable action (mirroring AC-10's device pass), performed by running
`npm run dev` locally and calling the spike route once. Once the verdict is known, the Decisions
Log row is updated with the actual outcome, and — only if the library changed — a superseding ADR
is written and the replacement is pinned exact.

## Metadata

| Field | Value |
|---|---|
| Type | Spike / feasibility investigation |
| Complexity | Medium — small surface area, but the outcome branches the rest of the feature |
| Systems Affected | Worker routes, dependency set, PRD Decisions Log, possibly a new ADR |
| Dependencies | `web-push@3.6.7` (already pinned in `package.json`), VAPID secrets (already in `.dev.vars`, chore C4) |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/push-channel-proven.prd.md` Implementation Phases row 1 |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/worker/index.ts` | 1-61 | Where every route is mounted under `/api/*`; the `requireToken` gate line; the untouched `scheduled()` stub this phase must not modify |
| P0 | `src/worker/auth.ts` | 11-26 | `requireToken` — every `/api/*` route inherits this; the spike route must sit under that prefix, never define its own auth |
| P0 | `src/worker/routes/export.ts` | 1-42 | The `createDb(c.env)` + Drizzle `select` pattern a route uses to read D1; the file-level doc-comment convention |
| P0 | `src/worker/db/schema.ts` | 267-289 | `pushSubscriptions` — the exact columns (`endpoint`, `p256dh`, `auth`) that map onto `web-push`'s `PushSubscription` argument shape |
| P0 | `scripts/generate-vapid.mjs` | 24-29 | The only place this project has touched `web-push` so far — the CommonJS default-import workaround (`import webpush from "web-push"; const { generateVAPIDKeys } = webpush;`) the spike's adapter must reuse for `sendNotification`/`setVapidDetails` |
| P1 | `worker-configuration.d.ts` | 4-13 | `VAPID_SUBJECT` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` already typed on `Env` — no change needed here |
| P1 | `documentation/40-engineering/engineering-conventions.md` | 16 | `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are both `true` (confirmed in `tsconfig.base.json:8-9`) — every array/object index access in the new adapter and route must be written against them from the first line |
| P1 | `PRPs/prds/push-channel-proven.prd.md` | 267-276, 330-338 | Technical Risks table and Decisions Log — the exact wording of the "Send library" row this phase must update with the real verdict |
| P2 | `test/export.test.ts` | 1-60 | The `vitest-pool-workers` route-test shape (`exports.default.fetch`, `env.API_BEARER_TOKEN`, `createDb` cleanup in `beforeEach`) the test pair will likely mirror for this phase's own suite |

## Patterns to Mirror

```
# SOURCE: src/worker/index.ts:22-25
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/google", googleRoutes);
app.route("/api/export", exportRoutes);
```
Copied by Task 3 — the spike route is mounted the same way, below the `requireToken` line, never
above it.

```
# SOURCE: src/worker/auth.ts:11-26
export const requireToken = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const expected = c.env.API_BEARER_TOKEN;
  if (!expected) {
    return c.json({ error: "Server misconfigured: API_BEARER_TOKEN is not set" }, 500);
  }
  const header = c.req.header("Authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!presented || !timingSafeEqual(presented, expected)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
  return;
});
```
Read by Task 2/3 — the spike route needs no auth code of its own; mounting under `/api/*` is
sufficient, exactly as `exportRoutes` does.

```
# SOURCE: src/worker/routes/export.ts:30-42
export const exportRoutes = new Hono<{ Bindings: Env }>();

exportRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const [lifeAreaRows, recurrenceSeriesRows, taskRows, reminderRows, googleCalendarSelectionRows] =
    await Promise.all([
      db.select().from(lifeAreas),
      db.select().from(recurrenceSeries),
      db.select().from(tasks),
      db.select().from(reminders),
      db.select().from(googleCalendarSelections),
    ]);
```
Copied by Task 2 — the shape of a Hono sub-router reading D1 via `createDb(c.env)` + Drizzle
`select().from(...)`, adapted to read `pushSubscriptions` instead.

```
# SOURCE: scripts/generate-vapid.mjs:24-29
// web-push 3.6.7 is CommonJS, so its functions arrive on the default export;
// a named import fails at module-instantiation time under ESM.
import webpush from "web-push";
...
const { generateVAPIDKeys } = webpush;
```
Mirrored by Task 1 — the adapter imports `web-push` the same way and destructures
`setVapidDetails`/`sendNotification` off the default export, since the module is CommonJS
regardless of runtime (Node in this script, workerd in the adapter).

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
Read by Task 2 — `endpoint`/`p256dh`/`auth` are the three fields the adapter's `PushSubscription`
argument needs; no migration required, this table already exists.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/worker/push/send.ts` | CREATE | Thin adapter wrapping `web-push` (`setVapidDetails` + `sendNotification`), isolating the Node/library-dependent call so it never leaks into `src/shared` |
| `src/worker/routes/push-spike.ts` | CREATE | The minimal bearer-gated route that reads the one stored subscription and calls the adapter, returning an explicit per-attempt outcome |
| `src/worker/index.ts` | UPDATE | Mount `/api/push-spike` under the existing `requireToken` gate, same line shape as the other four routes |
| `PRPs/prds/push-channel-proven.prd.md` | UPDATE | Record the actual send-library verdict in the "Send library" row of the Decisions Log, replacing the pre-spike speculative wording with the real outcome and its reason |
| `package.json` | UPDATE (conditional) | Only if the spike proves `web-push` cannot run in workerd: replace it with `@block65/webcrypto-web-push`, pinned exact (`save-exact`, no `^`/`~`) |
| `documentation/60-decisions/ADR-0013-*.md` | CREATE (conditional) | Only if the library changed — a new, append-only ADR superseding ADR-0005's naming of `web-push`, per that ADR's own binding requirement |
| `docs/context/architecture.md` | UPDATE | Record which send library is now in use ("Notifications:" line) so the derived context stays truthful once the verdict lands |

## NOT Building (Scope Limits)

- **The subscription lifecycle** (subscribe/unsubscribe routes, endpoint-identity upsert, DTO
  mapping). Phase 2's scope.
- **The `src/shared` payload builder and outcome mapper** (AC-1, AC-3, AC-4). Phase 2 extracts
  those once the library choice is settled; this phase's route builds only a throwaway minimal
  payload to prove dispatch is possible at all.
- **`cron_runs`, the freshness classifier, the diagnostics endpoint** (AC-5, AC-6, AC-7). Phase 3.
- **The `/settings` → *Notificações* route, the permission flow, the test-push control UI**
  (AC-9). Phase 4.
- **404/410 pruning and 429/5xx retention.** No outcome-mapping logic is written here — the spike
  route surfaces whatever the library returns/throws and stops there.
- **The device pass itself.** Whether the phone actually rings is the owner's own manual,
  indelegable action (mirrors AC-10) — see `## Notes`. No task below performs it or pretends to.

## Step-by-Step Tasks

### Task 1: CREATE `src/worker/push/send.ts`

**ACTION**: Create a thin adapter module exporting a function
`sendPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, vapid: { subject: string; publicKey: string; privateKey: string }): Promise<{ ok: boolean; statusCode?: number; error?: string }>`.
Internally: import `web-push`'s default export (never a named import — it is CommonJS), call
`setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)` then
`sendNotification({ endpoint, keys }, payload)`. Wrap the call in `try/catch`: on success, return
`{ ok: true, statusCode: result.statusCode }`; on a thrown `WebPushError` (or any other thrown
value — `web-push`'s failure mode under `nodejs_compat` is exactly an unexpected throw, not
necessarily its own typed error), return `{ ok: false, statusCode: (err as { statusCode?: number }).statusCode, error: String(err) }` — never swallow the error into a bare `false`. Respect
`exactOptionalPropertyTypes`: only set `statusCode`/`error` on the returned object when a value
actually exists, never assign `undefined` to an optional key.

**MIRROR**: `# SOURCE: scripts/generate-vapid.mjs:24-29` for the default-import shape.

**Delivers**: AC-A3 (PRD AC-4) — this is the `sendPush` outcome mapping AC-A3 describes: a
thrown/non-success result must surface its error and status code explicitly, never collapse to a
bare `false`.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 2: CREATE `src/worker/routes/push-spike.ts`

**ACTION**: Create a Hono sub-router (`export const pushSpikeRoutes = new Hono<{ Bindings: Env }>();`)
with one route, `POST /`. The handler: `createDb(c.env)`, `db.select().from(pushSubscriptions).limit(1)`
(mirror the `Promise.all` + `db.select().from(...)` shape, adapted to a single table). Respect
`noUncheckedIndexedAccess`: reading `rows[0]` yields `T | undefined`, so branch explicitly — if no
row exists, respond `c.json({ ok: false, error: "no stored subscription" }, 200)` (an explicit,
readable outcome, never a silent 200 with an empty body, mirroring the PRD's "never a vacuous
success" principle for AC-8). If a row exists, build a minimal JSON payload
(`JSON.stringify({ title: "Praesto — spike", body: "push-send-spike phase 1" })` — the full AC-1
payload shape is phase 2's job, not this one's) and call `sendPush` from Task 1, reading
`c.env.VAPID_SUBJECT` / `c.env.VAPID_PUBLIC_KEY` / `c.env.VAPID_PRIVATE_KEY`. Respond with the
adapter's result verbatim as JSON, with an explicit HTTP status (`200` if `ok`, `502` if not) —
the outcome must always be legible in the response body, never inferred from a bare status alone.

**MIRROR**: `# SOURCE: src/worker/routes/export.ts:30-42` for the router + `createDb` shape;
`# SOURCE: src/worker/db/schema.ts:272-289` for the subscription's field names.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
```

### Task 3: UPDATE `src/worker/index.ts`

**ACTION**: Import `pushSpikeRoutes` from `./routes/push-spike` and add
`app.route("/api/push-spike", pushSpikeRoutes);` directly below the existing
`app.route("/api/export.ics", icsRoutes);` line — inside the `/api/*` block, above the
unauthenticated `/oauth` route, so it inherits `requireToken` exactly like every other route. Do
not touch the `scheduled()` handler (out of this phase's scope — see `## NOT Building`).

**MIRROR**: `# SOURCE: src/worker/index.ts:22-25` for the registration line shape.

**Infrastructure/scaffolding — no AC of its own**: this task only wires the route already built by
Task 2 into the app's route table under the existing `requireToken` gate. It delivers no observable
behavior itself; it is what makes the behavior Task 2 implements (AC-A1/AC-A2, PRD AC-8) reachable
over HTTP at all.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
if git diff --unified=0 -- src/worker/index.ts | grep -E "^\+[^+]" | grep -q 'app.route("/api/push-spike"'; then
  echo "PASS: push-spike route registered under /api/*"
else
  echo "FAIL: push-spike route not found in the diff"
  exit 1
fi
```

### Task 4: Record the verdict in the PRD's Decisions Log (and swap the library if needed)

**ACTION**: After the owner has manually exercised the spike route once locally (see `## Notes` —
this half is not this task's to perform), update the "Send library" row's own **Choice** cell in
`PRPs/prds/push-channel-proven.prd.md`'s Decisions Log (`## Decisions Log` table) with the actual
outcome, writing the verdict so the row itself — not some other section of the file — states in
those words that it was settled by running the library rather than by reading about it: either
"`web-push@3.6.7` runs inside workerd under `compatibility_date 2026-08-01`, settled by running it
rather than by reading about it; confirmed by [automated test / device pass]" — no dependency
change — or, if the spike proved `web-push` unusable (e.g. `crypto.createECDH is not a function`
thrown, matching [web-push#718](https://github.com/web-push-libs/web-push/issues/718)):
"`@block65/webcrypto-web-push@<version>` replaces `web-push@3.6.7`, settled by running it inside
workerd rather than by reading about it — `web-push` threw `<the actual error text observed>`
under `nodejs_compat`". In the swap case, also: replace `web-push` and `@types/web-push` in
`package.json` with `@block65/webcrypto-web-push` pinned exact (check its current released
version — never a `^`/`~` range; and remove `web-push`/`@types/web-push` entirely so exactly one
send library remains declared), rewrite `src/worker/push/send.ts`'s internals to use its
`buildPushPayload` + `fetch` shape instead of `setVapidDetails`/`sendNotification` (the adapter's
exported function signature from Task 1 does not need to change), update
`scripts/generate-vapid.mjs` only if its own `generateVAPIDKeys` call no longer resolves, and
author `documentation/60-decisions/ADR-0013-<slug>.md` (next sequential number after the current
latest, ADR-0012) recording the swap as superseding ADR-0005's naming of `web-push`, following the
append-only ADR convention (`documentation/00-meta/documentation-guidelines.md`).

**MIRROR**: No prior example of a mid-PRD Decisions Log row update or a superseding ADR was found in
this repo's research findings — this task has no `# SOURCE:` anchor to copy from. Follow instead the
existing structural convention this PRD's own `## Decisions Log` table already establishes (row
shape: Decision / Choice / Alternatives / Rationale), and, for the conditional ADR, the numbering and
section structure (Context / Decision / Reason / Areas affected) used by ADR-0001..ADR-0012.

**Delivers**: AC-A4 (PRD AC-11) — this task performs the exact obligation AC-11 now names: naming
exactly one adopted send library with an exact version pin, recording in the Decisions Log that the
verdict was settled by running the library inside workerd rather than by reading about it, and
writing the superseding ADR when the adopted library is not `web-push`.

**VALIDATE**:
```bash
set -euo pipefail

# 1. Isolate the Decisions Log "Send library" row itself (matched by its own leading cell), and
#    assert against that isolated text only — never the whole file. A whole-file grep for
#    "settled by running" is vacuously satisfied today, before this task ever runs: AC-11's own
#    text already contains that exact phrase ("...states that it was settled by running the
#    library inside workerd rather than by reading about it...", added by the 2026-09-07
#    amendment), regardless of whether the row below is ever touched.
ROW="$(grep '^| Send library |' PRPs/prds/push-channel-proven.prd.md || true)"
if [ -z "$ROW" ]; then
  echo "FAIL: could not locate the 'Send library' row in the Decisions Log table"
  exit 1
fi
if printf '%s' "$ROW" | grep -q 'Decided in phase 1 by running it, not by reading\.'; then
  echo "FAIL: Send library Decisions Log row still carries the pre-spike speculative wording"
  exit 1
fi
if ! printf '%s' "$ROW" | grep -qi 'settled by running .*rather than by reading'; then
  echo "FAIL: Send library Decisions Log row does not itself state the verdict was settled by running the library rather than by reading about it"
  exit 1
fi

# 2. Exactly one send library is declared in package.json — AC-11's "exactly one send library"
#    clause requires exclusivity, not just presence. A botched swap that leaves BOTH candidates
#    declared must fail loudly, naming what was found, rather than silently resolving to whichever
#    branch is checked first.
CANDIDATES=("web-push" "@block65/webcrypto-web-push")
FOUND=()
for lib in "${CANDIDATES[@]}"; do
  if grep -q "\"${lib//\//\\/}\"[[:space:]]*:" package.json; then
    FOUND+=("$lib")
  fi
done
if [ "${#FOUND[@]}" -eq 0 ]; then
  echo "FAIL: no send library (web-push or its replacement) is declared in package.json"
  exit 1
fi
if [ "${#FOUND[@]}" -gt 1 ]; then
  echo "FAIL: more than one send library declared in package.json (${FOUND[*]}) — exactly one must remain after the swap"
  exit 1
fi
ADOPTED="${FOUND[0]}"

# It carries an exact version pin (no ^ or ~) — AC-11's "with an exact version pin" clause.
if grep -qE "\"${ADOPTED//\//\\/}\":[[:space:]]*\"[\^~]" package.json; then
  echo "FAIL: $ADOPTED is pinned with a version range (^ or ~), not exact"
  exit 1
fi

# 3. If the adopted library is not web-push, a superseding ADR must exist — AC-11's conditional
#    ADR clause.
if [ "$ADOPTED" != "web-push" ]; then
  if ! compgen -G "documentation/60-decisions/ADR-0013-*.md" > /dev/null; then
    echo "FAIL: $ADOPTED was adopted but no superseding ADR-0013 file exists"
    exit 1
  fi
fi

echo "PASS: Decisions Log Send library row itself carries a real, running-based verdict; exactly one send library ($ADOPTED) is declared and pinned exact; any non-web-push adoption is ADR-recorded"
```

### Task 5: UPDATE `docs/context/architecture.md`

**ACTION**: Once the verdict from Task 4 is known, update the "Notifications:" line under `##
Stack` to name the library actually in use (unchanged text if `web-push` was confirmed; the
replacement's name and one clause on why, if swapped) — this file is a derived context document
(`documentation/` is authoritative, `docs/` mirrors it per `CLAUDE.md`) and must not go stale the
same session the underlying decision changes.

**MIRROR**: `# SOURCE: docs/context/architecture.md:11` (the existing "Notifications:" bullet) —
edit in place, do not restructure the surrounding `## Stack` list.

**Infrastructure/scaffolding — no AC of its own**: this task keeps the derived context document
truthful once Task 4's verdict lands; it delivers no PRD-observable behavior, only documentation
consistency (`CLAUDE.md`'s "docs/ mirrors documentation/" rule).

**VALIDATE**:
```bash
set -euo pipefail
grep -q '^- \*\*Notifications:\*\*' docs/context/architecture.md
```

## Validation Commands

### Level 1 STATIC_ANALYSIS
```bash
set -euo pipefail
npm run check
```
Runs `wrangler types --check && tsc -b && eslint . && prettier --check .` — catches any
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violation introduced by Tasks 1-2, plus
lint/format drift, with real non-zero exit on any failure.

### Level 2 CONTENT_INVARIANTS
```bash
set -euo pipefail
if ! grep -qE '^\s*app\.route\("/api/push-spike",\s*pushSpikeRoutes\);' src/worker/index.ts; then
  echo "FAIL: push-spike route is not mounted"
  exit 1
fi
if grep -n 'app.route("/api/push-spike"' src/worker/index.ts | awk -F: '{print $1}' | \
   xargs -I{} sh -c 'test {} -lt $(grep -n "app.use(\"/api/\*\", requireToken);" src/worker/index.ts | cut -d: -f1)'; then
  echo "FAIL: push-spike route registered ABOVE the requireToken gate — it would be unauthenticated"
  exit 1
fi
echo "PASS: push-spike route exists and sits below the requireToken gate"
```
This asserts the actual ordering (mount line's number strictly greater than the gate's), not just
the presence of two independent lines — closing the gap a bare double-grep would leave (both
lines could exist in the wrong order).

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
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:18787/api/push-spike)
if [ "$STATUS" != "401" ]; then
  echo "FAIL: /api/push-spike answered $STATUS without a bearer token, expected 401"
  exit 1
fi
echo "PASS: /api/push-spike is token-gated (401 without Authorization)"
```
This starts local `wrangler dev` (not production — no deploy, no real device, no push service
call) and exercises only the auth gate. It deliberately does NOT send a valid-token request that
would attempt a real dispatch — that half is the owner's manual step (see `## Notes`), never the
autonomous implementer's.

## Acceptance Criteria

Phase 1 is a spike preceding the acceptance criteria's full realization in phases 2-4; its own
criteria are necessarily precursor/partial implementations of the PRD's ACs, not the full behavior
those ACs describe. Each bullet below names the PRD AC it previews. AC-A4 is the exception in the
opposite direction: AC-11 describes exactly this phase's own recording obligation (added to the PRD
2026-09-07 for precisely this reason — see the PRD's own amendment note and Decisions Log), so
AC-A4 fully realizes it here rather than merely previewing a behavior phases 2-4 complete later.

- **AC-A1 (PRD AC-8):** Given at least one stored subscription, when the spike route is called
  with a valid bearer token, then the response names whether the push service accepted the
  dispatch and its status code — never a bare/vacuous success — previewing the full test-push
  route's contract that phase 2 hardens.
- **AC-A2 (PRD AC-8):** Given zero stored subscriptions, when the spike route is called, then the
  response says so explicitly (`{ ok: false, error: "no stored subscription" }`) rather than
  silently returning `200` with an empty body.
- **AC-A3 (PRD AC-4):** Given the push service (or the library itself) returns/throws a non-success
  outcome, when `sendPush` maps it, then the result surfaces the error and status code explicitly
  — the same "never silently discard the failure" principle AC-4 states for the full outcome
  mapper, applied here to the spike's minimal version of it.
- **AC-A4 (PRD AC-11):** Given the spike has been exercised (automated test and/or the owner's
  manual device pass), when the phase closes, then exactly one send library is named as adopted
  with an exact version pin (no `^`/`~`), `PRPs/prds/push-channel-proven.prd.md`'s Decisions Log
  "Send library" row carries the actual verdict and states that it was settled by running the
  library inside workerd rather than by reading about it, and — if the adopted library is not
  `web-push` — an ADR exists superseding ADR-0005's naming of it. This is AC-11 itself, added to
  the PRD by the 2026-09-07 amendment for exactly this phase's obligation; unlike AC-A1..AC-A3,
  which preview a behavior phases 2-4 later complete, AC-A4 fully realizes its cited AC within this
  phase.

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| `web-push` throws inside workerd before ever reaching the network (the exact risk this phase exists to test) | H | This IS the spike's success signal either way — a clean throw naming a missing API is itself a decisive, actionable verdict, and Task 4 routes it straight to the library swap + ADR path |
| The automated test (authored separately by the test pair) cannot fully prove real-world delivery, only that the library's call path executes without throwing | M | The PRD itself splits this: the automated half proves the library runs; the device pass (this phase's success signal's second half) is the owner's manual, indelegable action, exactly like AC-10 in phase 4 |
| A task in this plan is misread as requiring the autonomous implementer to trigger a real push to the owner's phone | M | `## NOT Building` and every task's `**ACTION**` scope the implementer's work to code + verdict recording only; the Level 3 validation explicitly stops at the 401 check and never sends an authenticated dispatch |
| `@block65/webcrypto-web-push`'s README could not be verified by research (npm returned 403; only the GitHub repo and its Cloudflare Workers example were readable) | M | Task 4's adapter rewrite is guided by the verified GitHub example (`buildPushPayload` + `fetch`), and Task 1's exported function signature is kept stable so the swap is localized to one file |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in
`docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above,
before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the
`test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` →
`/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on
any test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a
test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than
invoking the test framework. The test pair's own suite — almost certainly a `vitest-pool-workers`
test calling `sendPush` (or the route) against a non-production endpoint URL, to observe whether
the library throws before ever reaching the network — is exactly the automated half of AC-A1/AC-A3
described above, and it is expected to be genuinely informative about the spike's own question.

**The device pass is not a task in this plan.** Per this project's own recorded rule (unit 5's
three corrections), no task above requires the autonomous implementer to run `npm run deploy`,
push to production, make a network call to production, register a Windows Scheduled Task, or
configure the machine. Sending a real push and watching the owner's Android phone ring is squarely
in that same "indelegable" category the PRD itself names for AC-10 — the owner runs `npm run dev`
locally, installs the PWA, calls `POST /api/push-spike` with a valid bearer token once a real
subscription is stored (storing one is itself outside this phase's scope; the owner may insert one
row by hand via `wrangler d1 execute --local` for the purposes of this spike only), and records
the result (rang / did not ring, and if not, what the response body said) in the phase's delivery
report. This plan's automated Level 3 check stops at proving the route is reachable and
token-gated — it never attempts the authenticated dispatch itself.

**Why no migration task.** `push_subscriptions` already exists (migration `0000`); this phase adds
no column and no table, so no `drizzle-kit generate` / `wrangler d1 migrations apply` step
appears above.

*Generated: 2026-09-07*
*Approved: 2026-09-07*
*Status: IMPLEMENTED*
