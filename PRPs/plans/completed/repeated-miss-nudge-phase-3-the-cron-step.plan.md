# Feature: The cron step (Phase 3 of repeated-miss-nudge)

```
**Decision Gate**
- Active context: none
- Activated criteria: a new cron step inside `scheduled()` (push dispatch); domain rules for tasks (Recurrence Series, `missed` history) and reminders (claim-before-send, push outcomes); a deep link to an existing Task route; no schema change (the two columns shipped in phase 2)
- Decisions found:
  - ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording — misses are permanently recorded; the nudge is derived from the closed rows, never from the series counters
  - ADR-0013 / [2026-09-07] the only push sender is `@block65/webcrypto-web-push` through `src/worker/push/send.ts`; no second sender is introduced
  - [2026-09-10] The due-Reminder sweep claims before it sends (the claim-then-send template this step copies)
  - ADR-0003 — one Worker, cron, D1; no second service, no queue
  - ADR-0009 — visible copy pt-BR, code and identifiers English
  - PRD repeated-miss-nudge D-D (exactly-once marker is a column set by a conditional update), D-F (deep link is the open occurrence's existing Task route), D-G (from 09:00 in the series' own zone), D-I (a muted run is consumed silently), D-J (vocabulary *não concluída*)
- Applicable anti-patterns:
  - Hand-duplicated entity types (the row shape is `AdherenceRow` from `src/shared/adherence.ts`, the series row is the Drizzle `RecurrenceSeries`)
  - Glossary synonym drift (the copy says *não concluídas*, never "falha", "falhando" or "pulada")
  - Portuguese in artifacts (copy values pt-BR; identifiers, comments and tests English)
  - Weakening tests to force green (the test pair owns every test file; no task here touches one)
  - Editing accepted ADRs (append-only; none touched)
- Applicable architectural rules:
  - One Worker serves everything: the nudge is a step inside `runScheduledJob`, not a new trigger or service
  - `src/shared/` stays free of DOM/Worker globals; the pure copy builder lives there, every DB and send call stays in `src/worker/`
  - `src/shared/recurrence.ts`, `src/shared/adherence.ts` and `src/shared/nudge.ts` stay byte-unchanged
  - Every API route stays behind the bearer gate (no route is added)
  - The cron records every run into `cron_runs` from a `finally` block; a failed nudge must surface there
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/repeated-miss-nudge.prd.md` — Implementation Phases row 3: "The cron step" — Goal: the owner's phone rings once — Success signal: AC-6, AC-7, AC-9, AC-10, AC-12, AC-13 green against an injected sender.

## Summary

This phase adds the cron step that turns the phase-1 decision and the phase-2 columns into one push. After the missed sweep has recorded misses, `scheduled()` loads every task series with its closed rows, asks `decideNudge` whether each is due at `now`, and for a due series that has an open occurrence and at least one stored subscription claims the run with a conditional `UPDATE ... WHERE nudged_at IS NULL` before sending one notification (per-series `tag`, `data.route` the open occurrence's Task path) to every subscription. A `gone` subscription is pruned, a `retryable` outcome releases the claim, and a muted series that reaches the threshold has its run consumed silently. Any error in the step is deferred and rethrown after the Reminder sweep so `runCronHeartbeat` records it and Reminders are never blocked. The closed-row loader the adherence route already uses is extracted so the route and the cron share one query.

## User Story

As the owner of Praesto Sum
I want exactly one notification, at the first cron tick from 09:00 local, when a recurring Task series reaches three consecutive non-completions
So that I replan or end a commitment I keep failing without being scolded daily and without losing my Reminders.

## Problem Statement

The owner keeps failing the same recurring Task and only passive surfaces say so. FR-012 promised a proactive notification; ADR-0006 records his words. Phases 1 and 2 provide the pure decision and the persisted state, but nothing yet sends: no cron step reads the decision, claims the run, builds the notification or handles the send outcomes. A naive "push for every miss" would be noise he mutes at the operating-system level, taking real Reminders with it, so the step must be exactly-once, silent while the run continues, and isolated from the Reminder sweep.

## Solution Statement

One exported step `sweepRepeatedMissNudges(db, now, vapid)` in `src/worker/cron.ts`, wired into `runScheduledJob` after the Reminder sweep with its own deferred error, reusing `decideNudge`, `buildNotificationPayload`, `classifyPushOutcome` and `sendPush` unchanged. A tiny pure module `src/shared/nudge-copy.ts` owns the pt-BR copy, title truncation, tag and route so the wording rules are decidable without a database. The series-closed-rows query and the open-occurrence lookup move into one worker module used by both the adherence route and the cron.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT (new cron step over shipped primitives) |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/nudge-copy.ts` (new), `src/worker/series-closed-rows.ts` (new), `src/worker/routes/series.ts`, `src/worker/cron.ts` |
| Dependencies | Phase 1 (`src/shared/nudge.ts`: `decideNudge`, `NudgeSeries`), Phase 2 (`nudged_at`, `nudge_muted` columns); no new package, no migration |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/repeated-miss-nudge.prd.md` Implementation Phases row 3; AC-6, AC-7, AC-9, AC-10, AC-12, AC-13; D-D, D-F, D-G, D-I |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/repeated-miss-nudge.prd.md` | 88-145, 220-242, 294-308 | AC-6/7/9/10/12/13 text, the architecture notes and D-D/D-F/D-G/D-I |
| P0 | `src/worker/cron.ts` | 112-163, 182-259, 274-295 | The deferred-error shape of the missed sweep, the claim-before-send Reminder sweep this step copies, and the heartbeat that records a rethrown failure |
| P0 | `src/shared/nudge.ts` | 14-78 | `NudgeSeries`, `NudgeDecision`, the reason order and the `muted` contract the caller must consume |
| P0 | `src/worker/routes/series.ts` | 38-52, 253-308 | `findOpenOccurrenceId`, `todayForSeries` (the zone fallback) and `loadSeriesAdherence` (the loader to extract) |
| P0 | `src/shared/push-payload.ts` | 19-60 | `buildNotificationPayload` input and the 30-character title cap |
| P1 | `src/shared/push-outcome.ts` | 21-47 | `classifyPushOutcome`: `delivered` / `gone` (404, 410) / `retryable` |
| P1 | `src/shared/app-route.ts` | 39-75 | `taskRouteOf` and `pathOf` — the deep link is `/tasks/<id>` |
| P1 | `src/worker/push/send.ts` | 24-56 | `sendPush` never throws; every failure is `{ ok: false, statusCode?, error }` |
| P1 | `src/worker/db/schema.ts` | 87-92 | `nudgedAt` (nullable timestamp) and `nudgeMuted` (boolean) on `recurrence_series` |
| P1 | `test/cron-sweep.test.ts`, `test/cron-heartbeat.test.ts`, `test/cron-reminder-route.test.ts`, `test/missed-sweep-cron.test.ts` | whole file | Existing cron behaviour that must stay green; read to know the injected-sender and heartbeat seams (read only — never edited here) |

## Patterns to Mirror

```ts
// SOURCE: src/worker/cron.ts:209-215
  for (const reminder of dueReminders) {
    const [claimed] = await db
      .update(reminders)
      .set({ sentAt: reminderNow })
      .where(and(eq(reminders.id, reminder.id), isNull(reminders.sentAt)))
      .returning();
    if (claimed === undefined) continue;
```
Copied by Task 4 (the conditional-update claim; a row that does not come back means another run won).

```ts
// SOURCE: src/worker/cron.ts:233-255
    const subscriptions = await db.select().from(pushSubscriptions);
    const outcomes: PushOutcome[] = [];
    for (const subscription of subscriptions) {
      const result = await sendPush(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        vapid,
      );
      const outcome = classifyPushOutcome(result);
      outcomes.push(outcome);
      if (outcome.kind === "gone") {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      }
    }

    if (outcomes.some((outcome) => outcome.kind === "retryable")) {
      await db.update(reminders).set({ sentAt: null }).where(eq(reminders.id, reminder.id));
    }
```
Copied by Task 4 (send to every subscription, prune `gone`, release the claim on `retryable`).

```ts
// SOURCE: src/worker/cron.ts:189-194
  let sweepError: unknown = null;
  try {
    await sweepMissedOccurrences(db, now);
  } catch (error) {
    sweepError = error;
  }
```
Copied by Task 5 (the deferred-error shape for the nudge step; rethrown after the Reminder sweep).

```ts
// SOURCE: src/worker/routes/series.ts:43-52
async function findOpenOccurrenceId(
  db: ReturnType<typeof createDb>,
  seriesId: string,
): Promise<string | null> {
  const [open] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.seriesId, seriesId), eq(tasks.status, "open")));
  return open?.id ?? null;
}
```
Copied by Task 2 (moved verbatim into the shared worker module; the route imports it back).

```ts
// SOURCE: src/worker/routes/series.ts:279-290
  const closedRows = await db
    .select()
    .from(tasks)
    .where(and(isNotNull(tasks.seriesId), inArray(tasks.status, ["done", "missed"])));

  const bySeries = new Map<string, AdherenceRow[]>();
  for (const row of closedRows) {
    if (row.seriesId === null || row.occurrenceDate === null) continue;
    const list = bySeries.get(row.seriesId) ?? [];
    list.push({ occurrenceDate: row.occurrenceDate, status: row.status });
    bySeries.set(row.seriesId, list);
  }
```
Copied by Task 2 (the grouping becomes `loadClosedRowsBySeries`, shared by the route and the cron).

```ts
// SOURCE: src/worker/routes/series.ts:258-264
function todayForSeries(now: Date, timeZone: string): string {
  try {
    return todayIn(now, timeZone);
  } catch {
    return todayIn(now, PRAESTO_TIMEZONE);
  }
}
```
Copied by Task 2 (same fallback, expressed as `resolveSeriesZone`: an unresolvable zone becomes `PRAESTO_TIMEZONE` before it reaches `decideNudge`).

```ts
// SOURCE: src/worker/cron.ts:224-231
    const payload = JSON.stringify(
      buildNotificationPayload({
        title: "Praesto",
        body: reminder.label ?? task?.title ?? "Lembrete",
        route: reminder.taskId !== null ? pathOf(taskRouteOf(reminder.taskId)) : "/",
        tag: `reminder-${reminder.id}`,
      }),
    );
```
Copied by Tasks 1 and 4 (route and tag construction; the nudge's route is the open occurrence's path and its tag is per series).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/nudge-copy.ts` | CREATE | Pure builder of the notification's title (≤ 30), pt-BR body, `tag` and deep-link route (AC-9) |
| `src/worker/series-closed-rows.ts` | CREATE | Shared worker module: `loadClosedRowsBySeries`, `findOpenOccurrenceId`, `resolveSeriesZone` — one query for the adherence route and the cron |
| `src/worker/routes/series.ts` | UPDATE | Use the shared loader and open-occurrence lookup; behaviour of `GET /api/series/adherence` and `GET /api/series` unchanged |
| `src/worker/cron.ts` | UPDATE | Add `sweepRepeatedMissNudges` (claim-before-send, outcomes, consumed muted run) and wire it into `runScheduledJob` with a deferred error |

## NOT Building (Scope Limits)

- The sheet's switch, the *Aderência* row's *Avisos silenciados* state, the UI/UX checklist and any `src/app/` change (phase 4: AC-15, AC-16).
- Documentation sync (`docs/api-reference.md`, tasks/reminders area docs, roadmap, `device-proof.md`) and the owner's device proof (phase 4: AC-17). No `documentation/` or `docs/` file is edited in this phase.
- Any change to `src/shared/nudge.ts`, `src/shared/recurrence.ts` or `src/shared/adherence.ts`; the threshold, the 09:00 gate and the reason order are phase 1's and stay as shipped.
- Any schema, migration, DTO, PATCH or complete-route change (phase 2 delivered them).
- A new `AppRoute` member, a new API route, a notification action, snooze, escalation, digest or a configurable threshold (PRD "What We're NOT Building").
- Writing to `push_dispatch_attempts` (only `POST /api/push/test` writes it) or any new table for nudges.
- A backfill of `nudged_at` for series already at three or more misses (D-H: each is nudged once on first run).
- Authoring or editing any test file: the test pair (`test-writer`/`test-reviewer`) owns them.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/nudge-copy.ts

**ACTION**: Create the pure module. It imports only `pathOf` and `taskRouteOf` from `./app-route` and has no DOM, Worker or database dependency. Export `buildNudgeNotification(input: { seriesId: string; seriesTitle: string | null; streak: number; openOccurrenceId: string }): { title: string; body: string; route: string; tag: string }` (the exact input shape `buildNotificationPayload` takes, so the caller passes it straight through). Rules: `title` is the trimmed series title, or the fallback `Tarefa recorrente` when the title is null or blank; a title longer than 30 characters is cut to 29 characters plus `…` so the total stays ≤ 30 and never relies on `buildNotificationPayload`'s hard slice; `body` is the pt-BR sentence naming the count — `<streak> não concluídas seguidas. Toque para replanejar ou encerrar.`; `route` is `pathOf(taskRouteOf(openOccurrenceId))` (so `/tasks/<id>`); `tag` is `nudge-<seriesId>`. No output string may contain `falha`, `falhando` or `pulada` (glossary: *não concluída*). Code, identifiers and comments stay English. Delivers AC-A3 (PRD AC-9: title ≤ 30, per-series tag, route is the open occurrence's path, copy names the count and avoids the forbidden words).
**MIRROR**: `src/worker/cron.ts:224-231` (Patterns to Mirror — route and tag construction).
**VALIDATE**: `set -euo pipefail; npx tsc -b; if grep -qiE 'falha|falhando|pulada' src/shared/nudge-copy.ts; then echo "FAIL: forbidden vocabulary in nudge copy"; exit 1; else echo "PASS: no forbidden vocabulary"; fi; if grep -qE 'from "\.\./worker|document\.|window\.' src/shared/nudge-copy.ts; then echo "FAIL: shared module reaches the Worker or the DOM"; exit 1; else echo "PASS: shared module stays environment-agnostic"; fi`

### Task 2: CREATE src/worker/series-closed-rows.ts

**ACTION**: Create a worker module exporting three functions. (a) `loadClosedRowsBySeries(db: ReturnType<typeof createDb>): Promise<Map<string, AdherenceRow[]>>` — the select and in-memory grouping of every closed (`done`/`missed`) series occurrence, moved verbatim from `loadSeriesAdherence` (type `AdherenceRow` imported from `../shared/adherence`, never redeclared). (b) `findOpenOccurrenceId(db, seriesId)` — moved verbatim from `routes/series.ts`. (c) `resolveSeriesZone(now: Date, timeZone: string): string` — returns `timeZone` when `todayIn(now, timeZone)` resolves and `PRAESTO_TIMEZONE` when it throws, so the nudge decision always receives a usable zone (the same fallback `todayForSeries` applies). Do not change any query's predicates or ordering. Infrastructure task: it carries no acceptance criterion of its own; it is the shared seam Tasks 3 and 4 consume (AC-A3 needs the open-occurrence lookup, AC-A1/AC-A2/AC-A5 need the closed rows).
**MIRROR**: `src/worker/routes/series.ts:43-52`, `src/worker/routes/series.ts:279-290` and `src/worker/routes/series.ts:258-264` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; grep -qF 'export async function loadClosedRowsBySeries' src/worker/series-closed-rows.ts; grep -qF 'export async function findOpenOccurrenceId' src/worker/series-closed-rows.ts; grep -qF 'export function resolveSeriesZone' src/worker/series-closed-rows.ts`

### Task 3: UPDATE src/worker/routes/series.ts

**ACTION**: Delete the local `findOpenOccurrenceId` and import it from `../series-closed-rows`; in `loadSeriesAdherence` replace the `closedRows` select and the `bySeries` grouping loop with `const bySeries = await loadClosedRowsBySeries(db);`, keeping the `seriesRows` select, `todayForSeries`, `toSeriesAdherenceDto`, `rankAdherence` and the returned `{ series, ranking }` exactly as they are. Remove only the imports that become unused (`inArray`, `isNotNull`, and `AdherenceRow` if nothing else in the file uses it; the lint gate names any other). `GET /api/series/adherence`, `GET /api/series` and `GET /api/series/:id` must behave byte-for-byte as before. Infrastructure refactor: it delivers no new acceptance criterion; its guard is that the existing adherence and series suites stay green.
**MIRROR**: `src/worker/routes/series.ts:279-290` (Patterns to Mirror — the grouping now lives in the shared module).
**VALIDATE**: `set -euo pipefail; npx tsc -b; if grep -qF 'async function findOpenOccurrenceId' src/worker/routes/series.ts; then echo "FAIL: findOpenOccurrenceId still duplicated in the route"; exit 1; else echo "PASS: route imports the shared lookup"; fi; npx vitest run test/adherence-endpoint.test.ts test/series.test.ts test/series-edit.test.ts`

### Task 4: UPDATE src/worker/cron.ts — the nudge step

**ACTION**: Add and export `sweepRepeatedMissNudges(db: Db, now: Date, vapid: { subject: string; publicKey: string; privateKey: string }): Promise<void>`. Algorithm: (1) select every `recurrenceSeries` row with `kind = 'task'` (both `active` and `ended` — `decideNudge` returns `ended` for the latter) and call `loadClosedRowsBySeries(db)` once. (2) For each series build the `NudgeSeries`: `status` from the row, `nudgeMuted` from the row, `nudgedAt` as epoch seconds (`Math.floor(getTime() / 1000)`) or null, `timeZone` from `resolveSeriesZone(now, row.timezone)`; call `decideNudge(series, rows ?? [], now)`. (3) When `reason` is `muted`, consume the run without sending: `db.update(recurrenceSeries).set({ nudgedAt: now }).where(and(eq(recurrenceSeries.id, row.id), isNull(recurrenceSeries.nudgedAt)))` — nothing is sent, and unmuting later never fires a retroactive nudge (AC-A5). (4) When `due` is false for any other reason, do nothing. (5) When `due`: look up `findOpenOccurrenceId(db, row.id)` — `null` means no nudge and NO claim is taken; read `db.select().from(pushSubscriptions)` — zero subscriptions means no claim is taken, so the series stays un-nudged and the owner can still be told after subscribing. (6) Claim with `db.update(recurrenceSeries).set({ nudgedAt: now }).where(and(eq(recurrenceSeries.id, row.id), isNull(recurrenceSeries.nudgedAt))).returning()` and `continue` when no row comes back — two racing runs produce exactly one claimant and exactly one push (AC-A1). (7) Build `JSON.stringify(buildNotificationPayload(buildNudgeNotification({ seriesId: row.id, seriesTitle: row.title, streak: decision.streak, openOccurrenceId })))`, send it to every subscription with `sendPush`, classify with `classifyPushOutcome`, delete a `gone` subscription by endpoint, and when any outcome is `retryable` release the claim with `.set({ nudgedAt: null })` so the next tick retries (AC-A4). A claimed series whose run is still continuing is never reconsidered: `nudgedAt` stays set, so a 4th and 5th consecutive miss send nothing (AC-A2). (8) Wrap each series in its own try/catch: on an error after the claim was taken, release it best-effort with `.set({ nudgedAt: null })`, remember the first failure and continue; after the loop throw `new Error(\`repeated-miss nudge failed for series <id>: <message>\`)` for the first failure, mirroring `sweepMissedOccurrences`. Add the imports `decideNudge` (from `../shared/nudge`), `buildNudgeNotification` (from `../shared/nudge-copy`) and the three helpers from `./series-closed-rows`. Delivers AC-A1 (exactly once under overlap), AC-A2 (no repetition while the run continues), AC-A3 (payload and deep link; a series with no open occurrence is not nudged), AC-A4 (404/410 pruned, retryable releases, no subscription is not marked nudged) and AC-A5 (a muted run is consumed, not queued).
**MIRROR**: `src/worker/cron.ts:209-215` (the claim) and `src/worker/cron.ts:233-255` (send loop, prune, release) (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; grep -qF 'export async function sweepRepeatedMissNudges' src/worker/cron.ts; grep -qF 'isNull(recurrenceSeries.nudgedAt)' src/worker/cron.ts; grep -qF '.set({ nudgedAt: now })' src/worker/cron.ts; grep -qF '.set({ nudgedAt: null })' src/worker/cron.ts; npx vitest run test/cron-sweep.test.ts test/cron-heartbeat.test.ts test/cron-reminder-route.test.ts test/missed-sweep-cron.test.ts`

### Task 5: UPDATE src/worker/cron.ts — wire the step into runScheduledJob

**ACTION**: In `runScheduledJob`, after the due-Reminder `for` loop and before the final rethrow, run the nudge step in its own try/catch: `let nudgeError: unknown = null; try { await sweepRepeatedMissNudges(db, now, vapid); } catch (error) { nudgeError = error; }`. It reuses the `vapid` object and the missed-sweep `now`, runs after the missed sweep has recorded its misses (so a just-recorded third miss is counted), and sits after the Reminder loop so a slow or failing nudge can never delay or block a due Reminder (AC-A6). Replace the final `if (sweepError !== null) throw sweepError;` with: when exactly one of `sweepError` / `nudgeError` is set, rethrow that value unchanged (the missed-sweep behaviour the heartbeat tests already pin is preserved); when both are set, throw one `Error` whose message joins both messages with `; `, so neither failure is lost. Update the `runScheduledJob` doc comment with one sentence naming the nudge step and its position. Do not touch `runCronHeartbeat`: it already records a rethrown failure in `cron_runs` from its `finally`. Delivers AC-A6 (PRD AC-13: a nudge failure never blocks Reminders and is recorded in `cron_runs`).
**MIRROR**: `src/worker/cron.ts:189-194` (Patterns to Mirror — deferred-error shape).
**VALIDATE**: `set -euo pipefail; npx tsc -b; grep -qF 'sweepRepeatedMissNudges(db, now, vapid)' src/worker/cron.ts; npx vitest run test/cron-sweep.test.ts test/cron-heartbeat.test.ts test/cron-reminder-route.test.ts test/missed-sweep-cron.test.ts test/cron-freshness.test.ts`

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
set -euo pipefail
npm run check
```

### Level 2: UNIT_TESTS

```bash
set -euo pipefail
npm test
# the pure modules and the recurrence rule must be byte-identical to main
git diff --quiet main -- src/shared/recurrence.ts src/shared/adherence.ts
```

### Level 3: INTEGRATION

```bash
set -euo pipefail
# existing cron behaviour (missed sweep, Reminder sweep, heartbeat) and the adherence route stay green
npx vitest run test/cron-sweep.test.ts test/cron-heartbeat.test.ts test/cron-reminder-route.test.ts test/missed-sweep-cron.test.ts test/cron-freshness.test.ts test/adherence-endpoint.test.ts test/series.test.ts
# the nudge step was added without importing a second push sender
if grep -nE "from \"web-push\"|from 'web-push'" src/worker/cron.ts; then
  echo "FAIL: web-push imported in the cron (ADR-0013)"; exit 1
else
  echo "PASS: only the shared sender is used"
fi
```

## Acceptance Criteria

- **AC-A1 (PRD AC-6):** Given a due nudge and two cron invocations racing, exactly one claims it through the conditional update on `nudged_at IS NULL` and exactly one push is dispatched per subscription.
- **AC-A2 (PRD AC-7):** Given a series nudged at three misses, when a 4th and 5th consecutive miss are recorded and the cron runs, no further notification is sent; a completion (phase 2) is the only re-arm.
- **AC-A3 (PRD AC-9):** Given a due nudge, the payload's title is ≤ 30 characters, its `tag` is `nudge-<seriesId>`, `data.route` is `/tasks/<open occurrence id>`, and the pt-BR body names the count and never contains "falha", "falhando" or "pulada"; a series with no open occurrence is not nudged and its claim is not taken.
- **AC-A4 (PRD AC-10):** Given a due nudge, a subscription answering 404/410 is pruned; a retryable outcome (429, 5xx, no status) releases the claim so the next tick retries; with no stored subscription the series is not marked nudged.
- **AC-A5 (PRD AC-12):** Given a muted series that reaches three consecutive misses, the cron sets `nudged_at` without sending; unmuting it later sends nothing for that run, and a new run of three after a completion nudges normally.
- **AC-A6 (PRD AC-13):** Given the nudge step throws, the due-Reminder sweep still executes and `cron_runs` records the failure through the existing heartbeat, the same deferred-error behaviour the missed sweep has.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Duplicate nudge from two overlapping cron runs | M | H | Conditional-update claim with `RETURNING` (Task 4 step 6); a run whose update returns no row sends nothing (AC-A1) |
| The claim is taken and the process dies before the send finishes | L | M | Same residual as Reminders (ADR 2026-09-10); `cron_runs` makes the crash visible and the next run of misses re-arms |
| Every subscription is `gone` (all pruned): the claim stays set with nothing delivered | L | L | Parity with the Reminder sweep and with AC-10, which only releases on `retryable`; the next run of three after a completion re-arms. Recorded for the test pair, not changed |
| One subscription delivers and another is `retryable`: the release re-sends to the delivered one next tick | L | L | Parity with the Reminder sweep (a duplicate is preferred to a lost notification); single-user, usually one subscription |
| An unresolvable series zone throws inside `decideNudge` and aborts the step | L | M | `resolveSeriesZone` falls back to `PRAESTO_TIMEZONE` before the call (Task 2) |
| A slow push endpoint delays later work in the same cron tick | L | L | The step runs after the Reminder loop (Task 5), so a due Reminder is never behind a nudge send; a hang is bounded by the runtime as for Reminders |
| The Reminder loop throws (database error), so the nudge step does not run that tick | L | L | Nothing is claimed, so the next 5-minute tick retries; the existing behaviour already loses the deferred missed-sweep error in that case |
| First-day burst: every series already at three or more misses is nudged once | M | L | Accepted by the PRD (D-H, open question); one tap silences a series |
| Refactoring `loadSeriesAdherence` changes the adherence route | L | M | Task 3 is behaviour-preserving and its VALIDATE re-runs the adherence and series suites |
| research-codebase / research-web were not dispatched for this plan | - | L | Grounding was taken from direct reads of the cited files and the approved PRD; the phase composes shipped primitives and has no web-research value |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework (the `npx vitest run` calls only re-run the existing suites to prove they stay green).
- **Seam names for the test pair:** the step is `sweepRepeatedMissNudges(db, now, vapid)` exported from `src/worker/cron.ts`; the pure copy is `buildNudgeNotification` in `src/shared/nudge-copy.ts`. The send goes through `sendPush` from `src/worker/push/send.ts`, the same seam the Reminder sweep tests already stub.
- **Placement, a reading of the PRD:** the architecture note says "immediately after `sweepMissedOccurrences` and before/alongside the Reminder sweep". The step runs after the missed sweep has finished (so the third miss it just recorded is counted) and after the Reminder loop, inside the same `runScheduledJob`; the 09:00 gate makes the order irrelevant to the owner, and it guarantees a nudge can never delay a Reminder.
- **No-subscription handling:** the PRD says the series is "not marked nudged". The step checks for subscriptions before the claim, so no claim is ever taken and none needs releasing; the observable end state (`nudged_at` null) is identical to claim-then-release.
- **Consumed muted run:** `decideNudge` reports `muted` only for a series at or above the threshold with no marker and not ended, which is exactly the run to consume; it is consumed at any hour (the 09:00 gate is evaluated after the mute check by design).
- `src/shared/nudge.ts` is present in the worktree `.worktrees/repeated-miss-nudge` (branch `feature/repeated-miss-nudge`) uncommitted, with phases 1-2; it cannot be compared against `main` with `git diff`, so its "byte-unchanged" rule is a plain instruction to the Implementer here.
- Docs sync and the UI half are phase 4's, per the PRD.

*Generated: 2026-10-10*
*Approved: 2026-10-10*
*Implemented: 2026-10-10*
*Status: IMPLEMENTED*
