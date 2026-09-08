# Feature: notifications-settings (Phase 4 of push-channel-proven)

```
**Decision Gate**
- Active context: none
- Activated criteria: new screens/routes in `src/app/`; a cross-cutting navigation-seam extension
  (`AppRoute` grows two members); reuse of existing owned components (`Button`, `Banner`,
  `ConfirmView`); browser-API work (`Notification`, `PushManager`, `permissions.query`) — the
  2026-08-11 methodology split applies directly; domain rules (`docs/domain/areas/reminders.md`'s
  manual-test-push recommendation, already routed server-side in phase 2); impact on shared UI
  (`SettingsScreen.tsx` gains a new entry point)
- Decisions found: ADR-0003 (bearer token on every `/api/*` route, no exceptions — the new
  `GET /api/push/vapid-key` route inherits the existing `requireToken` gate rather than becoming a
  second unauthenticated surface; no offline write queue — subscribe/unsubscribe/test-push are
  online-only writes, gated the same way `GoogleConnectionCard` already gates its own writes) ·
  ADR-0004 (single installable PWA; `display: "standalone"`) · ADR-0005 (React 19 SPA, exact pins —
  this phase adds zero new npm dependencies, since `Notification`/`PushManager` are Web Platform
  APIs already available where `src/sw.ts` runs) · ADR-0008 (test-first) · ADR-0009 (visible UI
  copy pt-BR; identifiers/comments/tests English) · ADR-0010/ADR-0011 (Arcade tokens; owned
  components over Base UI — `Button`, `Banner`, `ConfirmView` reused, not re-derived) · ADR-0013
  (`@block65/webcrypto-web-push@2.0.0` — unaffected; this phase touches no server-side send code) ·
  the 2026-08-11 methodology decision ("Browser-API work: split the logic out, then the glue is
  exempt") — the central decision for this phase: permission classification, key encoding,
  diagnostics copy and the settings screen's own state machine move to `src/shared/`; only the
  literal `Notification.requestPermission()` / `PushManager.subscribe()` / `permissions.query()`
  calls are the exempt thin adapter
- Applicable anti-patterns: "Offline write queue" — a failed subscribe/unsubscribe/test-push is
  never queued; the screen shows the same inline request-error idiom `GoogleConnectionCard` already
  uses · "Hand-duplicated entity types" — `SubscribePushInput`, `PushSubscriptionDto` and
  `DiagnosticsDto` are imported from `src/shared/api.ts` (all three already exist since phases 2–3),
  never re-declared · "Version ranges in dependencies" — not implicated, zero new dependencies ·
  "Portuguese in artifacts" with the ADR-0009 carve-out — visible copy pt-BR, identifiers/tests
  English · "Weakening tests to force green" — not applicable to this DRAFT, no test exists in this
  plan to weaken
- Applicable architectural rules: bearer token on every `/api/*` route, no exceptions · types
  originate in `src/worker/db/schema.ts` and flow outward through `src/worker/dto.ts` into
  `src/shared/api.ts` — this phase adds no schema and reuses every DTO already on the wire ·
  layout standard §3 ("long flows [...] are ROUTES with real history entries, not sheets") — the
  reason *Notificações* and its diagnostics sub-page are two more `AppRoute` members, not `<dialog>`
  sheets · layout standard §2.2 / guidelines §2.2 (Android back is a close request; never make a
  top-left arrow the only way out) · guidelines §8's "Notification permission" and "Notification
  content" rows — the two-step flow and the payload shape this phase must satisfy · the port/adapter
  split (`docs/context/methodology.md`, "Browser-API work") — decidable logic in `src/shared/`, only
  the browser-API calls themselves are the exempt glue
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/push-channel-proven.prd.md` — Implementation Phases row 4: "notifications-settings" —
  Goal: Give the owner the screen that lets him enable the channel and judge it alone — Success
  signal: The owner reads the screen on his phone and can say whether the cron is alive without
  asking anyone — and AC-10's device pass is recorded in the phase report.

## Summary

This phase closes two deliberate gaps phases 1–3 left open and builds the screen the whole unit
exists to deliver. First, it fixes the payload mismatch phase 2's plan flagged as a phase-4
dependency: `src/sw.ts` currently parses a flat `{title, body, url, tag}` shape and reads
`data.url` on notification click, while `src/shared/push-payload.ts` (already shipped, already
tested under AC-1) emits `{title, body, icon, badge, tag, data: {route}, actions?}`. `src/sw.ts`
adapts to the builder's shape — never the reverse — because the builder's shape is what AC-1's
already-APPROVED test suite pins; the decidable half of that adaptation is extracted into its own
pure, testable module (`src/shared/push-payload-parse.ts`) so `src/sw.ts` itself is reduced to glue,
per this project's "Browser-API work" rule. Second, it writes the entire client half of the push
channel that has never existed: a pure key-encoding module, a permission-view classifier, a
diagnostics-copy module, and the settings screen's own state machine in `src/shared/`, with a thin
`src/app/push-subscribe.ts` adapter doing the actual `PushManager`/`Notification` calls. Third, it
extends the existing two-route navigation seam (`src/shared/app-route.ts`, unchanged since
`google-calendar-read` phase 5) with two more members — `/settings/notifications` and
`/settings/notifications/diagnostics` — and builds three new screens: a small entry card on
`/settings`, the *Notificações* card (two-step permission flow, subscribe/unsubscribe toggle, the
manual test-push control), and the diagnostics sub-page (last run absolute + relative, the stale
threshold, subscription count with this device's own status, and the last dispatch attempt). No
schema change; no new npm dependency; the server-side dispatch/prune/record logic from phases 2–3 is
reused exactly as it already stands, except for one new bearer-gated route
(`GET /api/push/vapid-key`) the browser needs to call `pushManager.subscribe()` at all.

## User Story

As the owner,
I want to turn on push notifications from inside the app, see whether the channel is actually alive,
and send myself a test push,
So that the phone can ring while the app is closed and I can tell a dead channel from an idle one
without reading `wrangler tail`.

## Problem Statement

Narrowed to this phase from the PRD: the server half of the push channel (phases 1–3) is complete
and tested, but nothing in `src/app/` or `src/shared/` calls `PushManager.subscribe`, and
`src/sw.ts` cannot correctly open the route a real payload carries because it was written against a
flat shape phase 2 superseded. Without this phase, "the owner enables notifications" and "the owner
judges the channel's health" are both still true only of someone holding a bearer token and `curl`.

## Solution Statement

Two `src/shared/` modules with no dependency on this phase's other work
(`notification-permission.ts`'s three-way permission classifier, `push-key-encode.ts`'s
`ArrayBuffer <-> base64url` pair) ground everything else. `notifications-settings.ts` is the
screen's own reducer, mirroring `google-settings.ts` shape for shape: `explainer` (permission
`default`, no prompt fired yet), `blocked` (permission `denied`, the "bloqueadas" state), `enabled`
(permission `granted`, carrying `subscribed`/toggling/test-result fields), `failed`. `src/app/
push-subscribe.ts` is the thin, exempt adapter: `ensureServiceWorkerReady`, `subscribeDevice`,
`unsubscribeDevice`, `getCurrentDeviceEndpoint` — the only file in this phase that calls
`PushManager` directly. `src/app/api.ts` gains five one-line wrappers over the existing
`request<T>()` (mirroring the five Google wrappers `google-calendar-read` phase 5 added), plus one
new server route, `GET /api/push/vapid-key`, so the browser has a public key to hand
`pushManager.subscribe()`. `src/shared/app-route.ts` grows two more `AppRoute` members exactly the
way it already models two; `NotificationsScreen.tsx` and `NotificationsDiagnosticsScreen.tsx` mirror
`SettingsScreen.tsx`'s shell (header, wordmark, back-that-is-not-the-only-way-out, offline banner).
`NotificationsCard.tsx` renders the two-step flow, the toggle and the test-push control;
`NotificationsEntryCard.tsx` is the small link from `/settings` into `/settings/notifications`.
The decidable transformation for the nested shape `src/shared/push-payload.ts` already emits lives in
a new pure module, `src/shared/push-payload-parse.ts` (`parsePushPayload`/`fallbackPushPayload`);
`src/sw.ts` is updated in place to keep only the `event.data.json()`/`.text()` try-catch and the
`addEventListener` wiring, delegating to that module — closing the loop AC-10's device pass needs,
and closing it on a testable seam, without this plan ever performing or simulating that device pass
itself.

## Metadata

| Field | Value |
|---|---|
| Type | Feature — client-side push subscription lifecycle, settings UI, service-worker payload fix |
| Complexity | High — five new `src/shared` modules, one new adapter, five new/updated screens, one new server route, and a service-worker contract change, with no schema change and no new dependency |
| Systems Affected | `src/shared/` (5 new modules, 1 update), `src/app/` (1 new adapter, 4 new components, 2 updates), `src/worker/routes/push.ts` (1 new route), `src/sw.ts` (payload-parsing glue only), `docs/api-reference.md` |
| Dependencies | Phase 3 (`implemented`) — `cron_runs`, `push_dispatch_attempts`, `GET /api/diagnostics`, `classifyCronFreshness`; phase 2's `POST /api/push/subscriptions`, `DELETE /api/push/subscriptions`, `POST /api/push/test`, `push_subscriptions`; `src/shared/push-payload.ts`, `src/shared/push-outcome.ts`; `src/app/hooks/useRoute.ts` / `src/shared/app-route.ts` (unit 4, unchanged mechanism); `Button`/`Banner`/`ConfirmView` (`src/app/components/ui/`); chore C4's `VAPID_PUBLIC_KEY` secret |
| Estimated Tasks | 18 |
| Source PRD line ref | `PRPs/prds/push-channel-proven.prd.md` Implementation Phases row 4; Phase Details at the "Phase 4: notifications-settings" heading |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | §8 (Notification permission / Notification content rows, lines 87-88); Review checklist, lines 146-169 | The two-step flow and the payload-content rules this phase must satisfy; the mandatory checklist run this phase's Notes commit to |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | §1, §3 (lines 40-41), §6 (line 62) | §3 is why *Notificações* and its diagnostics sub-page are routes, not sheets; §6 already assigns this exact shape to unit 6 |
| P0 | `docs/context/methodology.md` | "Browser-API work" section, lines 38-62 | Why the four `src/shared` modules exist and why only `push-subscribe.ts` is exempt glue |
| P0 | `src/sw.ts` | 1-102 (whole file) | The exact file Task 7 edits — today's flat-shape `parsePush` and `data.url` read, being replaced |
| P0 | `src/shared/push-payload.ts` | 1-60 (whole file) | The nested `{data: {route}}` shape `src/sw.ts` must be made to parse — already shipped, already covered by AC-1's test suite, never itself edited by this phase |
| P0 | `src/shared/cron-freshness.ts` | 1-24 (whole file) | The canonical `src/shared` pure-module shape (narrow exported type + one function, no DOM, no runtime dependency) Tasks 1-3 and Task 6.5 mirror |
| P0 | `src/shared/google-settings.ts` | 38-58 (state union), 71-112 (reducer) | The exact reducer shape (`kind`-discriminated union, guard-then-return branches) Task 4's `notifications-settings.ts` mirrors field for field |
| P0 | `src/app/components/GoogleConnectionCard.tsx` | 42-98 (props/state/mount-load effect), 118-133 (`handleConnect` — an async op fired directly from a click handler, mirrored by the permission-prompt call) | The load/skeleton/effect idiom and the "fire the real browser action synchronously from the tap" pattern Task 10 copies |
| P0 | `src/app/components/SettingsScreen.tsx` | 1-110 (whole file) | The exact route-shell shape (`100dvh` grid, header with wordmark + back button, Esc listener, offline banner slot) Tasks 11 and 12 copy verbatim for the two new screens |
| P0 | `src/shared/app-route.ts` | 1-38 (whole file) | The two-member union Task 5 extends to four, in the same shape |
| P0 | `src/worker/routes/push.ts` | 1-24, 102-135 | The router declaration and an existing handler shape Task 6's new `GET /vapid-key` handler is added beside |
| P1 | `src/app/api.ts` | 71-97 (`request<T>`), 181-200 (five one-line Google wrappers) | The exact wrapper shape Task 8's five new functions copy |
| P1 | `src/shared/push-outcome.ts` | 21-47 | The `PushOutcome` union Task 3's `pushOutcomeLabel` maps to pt-BR text |
| P1 | `src/app/components/DataExportCard.tsx` | 1-115 (whole file) | A simpler card precedent (local busy/error state, no reducer) for Task 13's small entry card |
| P1 | `src/app/App.tsx` | 1-85 (whole file) | The binary-then-ternary switch Task 15 extends to four branches |
| P2 | `docs/api-reference.md` | 12-26 | The `## Implemented` table's exact row shape Task 16 extends |

## Patterns to Mirror

```
# SOURCE: src/shared/cron-freshness.ts:1-24
/**
 * Freshness classifier for the cron's last recorded run (PRD AC-6; ...).
 * ...
 */
export type CronFreshness = "fresh" | "stale" | "unknown";
export const FRESHNESS_THRESHOLD_MS = 10 * 60 * 1000;
export function classifyCronFreshness(lastRunAt: Date | null, now: Date): CronFreshness {
  if (lastRunAt === null) return "unknown";
  const gapMs = now.getTime() - lastRunAt.getTime();
  return gapMs < FRESHNESS_THRESHOLD_MS ? "fresh" : "stale";
}
```
Mirrored by Tasks 1-3 (`notification-permission.ts`, `push-key-encode.ts`, `diagnostics-copy.ts`)
and Task 6.5 (`push-payload-parse.ts`) — a documented, environment-agnostic, DOM-free module
exporting a narrow type plus pure functions.

```
# SOURCE: src/shared/google-settings.ts:38-58, 71-95
export type GoogleSettingsState =
  | { kind: "loading" }
  | { kind: "disconnected" }
  | { kind: "connected"; calendars: readonly GoogleCalendarDto[]; draft: ReadonlySet<string>; saving: boolean }
  | { kind: "failed"; reason: string | null };

export function reduceGoogleSettings(state: GoogleSettingsState, event: GoogleSettingsEvent): GoogleSettingsState {
  switch (event.type) {
    case "load-failed": return { kind: "failed", reason: event.reason };
    case "loaded-disconnected": return { kind: "disconnected" };
    ...
    case "toggle-calendar": {
      if (state.kind !== "connected") return state;
      ...
    }
  }
}
```
Mirrored by Task 4 (`notifications-settings.ts`) — the `kind`-discriminated union, the
guard-then-return-unchanged-state idiom for events that only apply to one kind, and the exported
initial-state constant.

```
# SOURCE: src/app/components/GoogleConnectionCard.tsx:74-98, 118-133
async function load(): Promise<void> {
  try {
    const { connection: loaded } = await fetchGoogleConnection();
    ...
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) { onUnauthorized(); return; }
    dispatch({ type: "load-failed", reason: cause instanceof ApiError ? cause.reason : null });
  }
}
useEffect(() => { void load(); }, []);
...
async function handleConnect(): Promise<void> {
  setConnectError(null);
  setConnecting(true);
  try {
    const { consentUrl } = await startGoogleConnect();
    window.location.href = consentUrl;
  } catch (cause) { ... } finally { setConnecting(false); }
}
```
Mirrored by Task 10 (`NotificationsCard.tsx`) — the mount-load-dispatch idiom, and the pattern of
firing the real browser action (`Notification.requestPermission()`, here `window.location.href`)
as the FIRST thing the click handler does, with no unrelated `await` ahead of it that could cost
user-activation.

```
# SOURCE: src/app/components/SettingsScreen.tsx:64-97
return (
  <div data-shell className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr] overflow-clip bg-bg">
    <header className="flex items-center gap-3 px-4 pt-6 pb-2">
      <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
        <ArrowLeft className="size-[22px]" aria-hidden="true" />
      </Button>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <img src="/brand/mark-flat.svg" alt="" className="size-5" />
        <span className="font-display text-t2 font-extrabold text-muted">praesto</span>
      </span>
      <h1 className="m-0 font-text text-t4 font-bold text-ink">Configurações</h1>
    </header>
    {connectivity !== "online" ? (
      <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
    ) : (
      <div />
    )}
    <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
      ...
    </main>
  </div>
);
```
Copied verbatim (title text changed) by Tasks 11 and 12 for `NotificationsScreen.tsx` and
`NotificationsDiagnosticsScreen.tsx` — the `100dvh` grid, the header's wordmark + back-button +
`<h1>` triplet, and the always-render-a-banner-slot discipline that keeps the grid's row template
from shifting.

```
# SOURCE: src/app/components/SettingsScreen.tsx:48-62
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") back();
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [back]);
```
Copied verbatim by Tasks 11 and 12 — Android back and the header arrow are two of the three ways
out; `Esc` is the third and needs its own listener on every route shell, per guidelines §2.2.

```
# SOURCE: src/shared/app-route.ts:25-38
export type AppRoute = "today" | "settings";
export function routeFromPath(pathname: string): AppRoute {
  return withoutTrailingSlash(pathname) === "/settings" ? "settings" : "today";
}
export function pathOf(route: AppRoute): string {
  return route === "settings" ? "/settings" : "/";
}
```
Extended by Task 5 — two more literal members and two more `if`/`switch` branches, same shape,
same "unrecognised path resolves to `today`" fallback rule.

```
# SOURCE: src/worker/routes/push.ts:22-24, 102-108
export const pushRoutes = new Hono<{ Bindings: Env }>();
...
pushRoutes.post("/test", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(pushSubscriptions);
  ...
```
Mirrored by Task 6 — a new handler on the same `pushRoutes` router, so it inherits the existing
`/api/push` mount and `requireToken` gate with no new wiring in `src/worker/index.ts`.

```
# SOURCE: src/app/api.ts:181-187
export async function startGoogleConnect(): Promise<{ consentUrl: string }> {
  return request<{ consentUrl: string }>("/api/google/connect", { method: "POST" });
}
export async function fetchGoogleConnection(): Promise<{ connection: GoogleConnectionDto | null }> {
  return request<{ connection: GoogleConnectionDto | null }>("/api/google/connection");
}
```
Mirrored by Task 8 — five one-line wrappers over `request<T>()`, no local types, no error
re-mapping.

```
# SOURCE: src/app/components/DataExportCard.tsx:87-115
export function DataExportCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const json = useExportControl("json", onUnauthorized);
  const ics = useExportControl("ics", onUnauthorized);
  return (
    <section aria-label="Exportar dados" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4">
      <Button type="button" variant="primary" onClick={json.trigger} disabled={json.busy}>
        {json.showBusy ? "Baixando…" : LABELS.json}
      </Button>
      ...
```
Mirrored by Task 13 (`NotificationsEntryCard.tsx`) — a small, single-purpose card with local state
only, no reducer, `aria-label`'d `<section>`, `rounded-card bg-surface-1 p-4`.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/notification-permission.ts` | CREATE | The three-way `NotificationPermission -> view` classifier AC-9's two-step flow and "bloqueadas" state are built on |
| `src/shared/push-key-encode.ts` | CREATE | Pure `ArrayBuffer <-> base64url` pair the client needs to send the VAPID key to `pushManager.subscribe()` and to turn the returned subscription's keys into `SubscribePushInput` |
| `src/shared/diagnostics-copy.ts` | CREATE | Pure pt-BR formatting (absolute/relative instant, device-subscription label, push-outcome label) the diagnostics screen renders from |
| `src/shared/notifications-settings.ts` | CREATE | The *Notificações* card's own reducer — explainer / blocked / enabled / failed, mirroring `google-settings.ts` |
| `src/shared/app-route.ts` | UPDATE | Add `"notifications"` and `"notifications-diagnostics"` to `AppRoute`, plus their paths |
| `src/worker/routes/push.ts` | UPDATE | Add `GET /vapid-key`, returning `{ publicKey: c.env.VAPID_PUBLIC_KEY }`, bearer-gated like every sibling route |
| `src/shared/push-payload-parse.ts` | CREATE | The decidable half of the push-payload parse: a pure, DOM-free transform from an already-parsed JSON value to the normalized `PushPayload` shape with fallback defaults — extracted so it is testable outside `ServiceWorkerGlobalScope`, per `docs/context/methodology.md`'s "Browser-API work" rule |
| `src/sw.ts` | UPDATE | Keep only the glue: `event.data.json()`/`event.data.text()` try-catch and the `self.addEventListener` wiring, delegating the transformation to `src/shared/push-payload-parse.ts` so it acts on the nested `{data: {route}}` shape `src/shared/push-payload.ts` already emits, instead of the flat `{url}` shape it was written against |
| `src/app/api.ts` | UPDATE | Add `fetchVapidPublicKey`, `subscribeToPush`, `unsubscribeFromPush`, `sendTestPush`, `fetchDiagnostics` |
| `src/app/push-subscribe.ts` | CREATE | The thin, exempt adapter: the only file calling `PushManager`/`navigator.serviceWorker` directly |
| `src/app/components/NotificationsCard.tsx` | CREATE | The two-step permission flow, the subscribe/unsubscribe toggle, and the manual test-push control |
| `src/shared/notifications-load.ts` | CREATE | **(2026-09-07 amendment)** The decidable load-orchestration logic extracted out of `NotificationsCard.tsx`'s mount effect — dispatches `loaded` synchronously for `denied`/`default` permission (no service-worker/subscription check needed for those states) and only awaits the subscription-check port for `granted`, so the "bloqueadas" state can render even when `navigator.serviceWorker.ready` never resolves |
| `src/app/components/NotificationsCard.tsx` | UPDATE | **(2026-09-07 amendment)** Mount effect now calls `loadNotificationsSettings(permission, checkSubscribed, dispatch)` instead of unconditionally awaiting `getCurrentDeviceEndpoint()` before dispatching any state, so `denied`/`default` render immediately and `granted` no longer hangs indefinitely when zero service workers are registered |
| `src/app/components/NotificationsScreen.tsx` | CREATE | The `/settings/notifications` route shell |
| `src/app/components/NotificationsDiagnosticsScreen.tsx` | CREATE | The `/settings/notifications/diagnostics` route shell |
| `src/app/components/NotificationsEntryCard.tsx` | CREATE | The small `/settings` card linking into `/settings/notifications` |
| `src/app/components/SettingsScreen.tsx` | UPDATE | Accept a `navigate` prop; render `NotificationsEntryCard` after `DataExportCard` |
| `src/app/App.tsx` | UPDATE | Extend the route switch to four branches; thread `navigate` into `SettingsScreen`, `navigate`/`back` into the two new screens |
| `docs/api-reference.md` | UPDATE | Document `GET /api/push/vapid-key` |

## NOT Building (Scope Limits)

- **The due-Reminder scan, or anything that reads a Reminder.** Unit 7's scope; unchanged from
  phases 1-3.
- **AC-10's device pass itself.** No task below performs or simulates "the phone rings with the app
  closed and tapping it opens Praesto" — Task 7 makes it POSSIBLE by fixing the payload contract;
  the pass itself is the owner's manual verification, recorded in the phase report (see Notes).
- **A server-side subscription-list endpoint.** The diagnostics screen's "this device's status" is
  derived entirely from the local `PushSubscription` object (`getCurrentDeviceEndpoint()`), not from
  a new `GET /api/push/subscriptions` list route — no AC requires the server to enumerate endpoints
  back to a client, and CON-002's single/owner-device scale makes the local check sufficient.
- **A device-label editor.** The PRD's own Open Question defers `device_label` until the owner has
  more than one subscribed device.
- **A fallback notification channel (e-mail, ntfy).** Pre-authorized by ADR-0003 but explicitly
  deferred in the PRD until the channel has run in real use for a week.
- **Deploying, applying a migration to production, or any call to production.** No migration exists
  in this phase at all; the new route is exercised only against `wrangler dev --local`.
- **A browser test tier.** Rejected at its own trigger in this PRD's Decisions Log; not
  re-litigated here.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/notification-permission.ts`

**ACTION**: Create a pure, DOM-free module exporting `export type NotificationPermissionView =
"explainer" | "blocked" | "enabled";` and `export function classifyNotificationPermissionView(
permission: NotificationPermission): NotificationPermissionView` — `"granted"` maps to
`"enabled"`, `"denied"` maps to `"blocked"`, and `"default"` (the only remaining value) maps to
`"explainer"`. Open the file with a doc comment naming this the decidable half of AC-9's two-step
flow, mirroring `cron-freshness.ts`'s doc-comment shape, and noting that `permission-changed` events
(fired from `permissions.query({name:'notifications'}).onchange`, wired in Task 10) reuse this exact
classifier so the screen never grows a second vocabulary for the same three states.

**MIRROR**: `# SOURCE: src/shared/cron-freshness.ts:1-24`

**Delivers**: AC-A1 (PRD AC-9) — the classifier the two-step flow and the "bloqueadas" state are
built on.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/notification-permission.test.ts
```

### Task 2: CREATE `src/shared/push-key-encode.ts`

**ACTION**: Create a pure module exporting two functions, both DOM-free (only the JS-builtin
`ArrayBuffer`/`Uint8Array`/`btoa`/`atob`, all available in both the browser and workerd — never
`Buffer`, which does not exist in the browser target):
```ts
export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
```
`arrayBufferToBase64Url` turns a subscription's raw `p256dh`/`auth` keys (from
`PushSubscription.getKey()`) into the string shape `SubscribePushInput.keys` expects.
`base64UrlToUint8Array` turns the server's VAPID public key string into the `BufferSource`
`pushManager.subscribe({ applicationServerKey })` expects — the exact reverse operation, which is
why both live in the same module and the pair is tested for round-tripping.

**MIRROR**: `# SOURCE: src/shared/cron-freshness.ts:1-24` (module shape only — this module's own
logic has no existing local precedent, unlike Task 1 and Task 3).

**Delivers**: AC-A1 (PRD AC-9) — the encode/decode pair `push-subscribe.ts` (Task 9) needs to
actually call `pushManager.subscribe()` and report the result back to the server.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/push-key-encode.test.ts
```

### Task 3: CREATE `src/shared/diagnostics-copy.ts`

**ACTION**: Create a pure module exporting four functions:
```ts
import type { PushOutcome } from "./push-outcome";

export function formatAbsoluteInstant(epochSeconds: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(epochSeconds * 1000));
}

export function formatRelativeInstant(epochSeconds: number, now: Date): string {
  const diffMinutes = Math.round((now.getTime() - epochSeconds * 1000) / 60000);
  if (diffMinutes <= 0) return "agora";
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (diffMinutes < 60) return rtf.format(-diffMinutes, "minute");
  return rtf.format(-Math.round(diffMinutes / 60), "hour");
}

export function deviceSubscriptionLabel(subscribed: boolean): string {
  return subscribed ? "Este dispositivo está inscrito." : "Este dispositivo não está inscrito.";
}

export function pushOutcomeLabel(outcome: PushOutcome): string {
  switch (outcome.kind) {
    case "delivered": return "Entregue";
    case "gone": return "Inscrição expirada";
    case "retryable": return "Falha temporária";
  }
}
```
`formatRelativeInstant`'s zero/negative-diff branch reading `"agora"` is the explicit
zero-special-case guidelines §9.4 requires for `Intl`-driven copy — never letting
`Intl.RelativeTimeFormat` render "há 0 minutos". `now` is always an argument, never read from the
clock internally, mirroring `format.ts`'s own discipline for testability.

**MIRROR**: `# SOURCE: src/shared/cron-freshness.ts:1-24` (module shape); imports `PushOutcome` per
`# SOURCE: src/shared/push-outcome.ts:21-47`.

**Delivers**: AC-A3 (PRD AC-7) — the pt-BR formatting the diagnostics screen (Task 12) renders.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/diagnostics-copy.test.ts
```

### Task 4: CREATE `src/shared/notifications-settings.ts`

**ACTION**: Create the *Notificações* card's own reducer, mirroring `google-settings.ts` shape for
shape. State:
```ts
export type NotificationsSettingsState =
  | { kind: "loading" }
  | { kind: "explainer"; requesting: boolean }
  | { kind: "blocked" }
  | {
      kind: "enabled";
      subscribed: boolean;
      togglingSubscription: boolean;
      subscriptionError: string | null;
      sendingTest: boolean;
      testResult: { ok: boolean; message: string } | null;
    }
  | { kind: "failed"; reason: string | null };
```
Events: `loaded` (`{permission, subscribed}`), `load-failed` (`{reason}`), `request-start` (no
payload — the explainer's "prompt in flight" flag), `permission-changed`
(`{permission, subscribed?}`), `toggle-start`, `toggle-succeeded` (`{subscribed}`), `toggle-failed`
(`{message}`), `test-start`, `test-succeeded` (`{message}`), `test-failed` (`{message}`). The
reducer derives `kind` from `classifyNotificationPermissionView` (Task 1) on `loaded` and
`permission-changed`; `toggle-*` and `test-*` events are no-ops (return `state` unchanged) unless
the current `kind` is `"enabled"`, exactly like `google-settings.ts`'s `case "toggle-calendar": {
if (state.kind !== "connected") return state; ... }` guard. `permission-changed` reclassifies fresh
but — when the new view is `"enabled"` and no `subscribed` was supplied — carries the PREVIOUS
`subscribed` value forward if the prior state was already `"enabled"`, else defaults to `false`
(never invents a truth it was not told). Export `INITIAL_NOTIFICATIONS_SETTINGS_STATE = { kind:
"loading" }`.

**MIRROR**: `# SOURCE: src/shared/google-settings.ts:38-58, 71-95`

**Delivers**: AC-A1 (PRD AC-9) — the state machine the two-step flow, the "bloqueadas" state, the
subscribe/unsubscribe toggle and the test-push control (Task 10) are all built on.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/notifications-settings.test.ts
```

### Task 5: UPDATE `src/shared/app-route.ts`

**ACTION**: Extend `AppRoute` to `"today" | "settings" | "notifications" |
"notifications-diagnostics"`. `routeFromPath` checks the most specific path first: `"/settings/
notifications/diagnostics"` → `"notifications-diagnostics"`, else `"/settings/notifications"` →
`"notifications"`, else `"/settings"` → `"settings"`, else `"today"` (the existing fallback,
unchanged). `pathOf` mirrors: `"notifications-diagnostics"` → `"/settings/notifications/
diagnostics"`, `"notifications"` → `"/settings/notifications"`, `"settings"` → `"/settings"`,
`"today"` → `"/"`. No change to `src/app/hooks/useRoute.ts` — its `navigate`/`back` mechanism
already generalises to any number of pushed history entries; only the pure path<->route mapping
grows.

**MIRROR**: `# SOURCE: src/shared/app-route.ts:25-38`

**Infrastructure/scaffolding — no AC of its own**: this task only extends the navigation vocabulary
Tasks 11, 12, 14 and 15 consume; it delivers no observable behavior by itself.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/app-route.test.ts
```

### Task 6: UPDATE `src/worker/routes/push.ts`

**ACTION**: Add one handler to the existing `pushRoutes` router, placed after the `POST
/subscriptions` and `DELETE /subscriptions` handlers and before `POST /test`:
```ts
pushRoutes.get("/vapid-key", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));
```
No auth code of its own — mounted under the existing `/api/push` prefix (`src/worker/index.ts`),
which is already below the `requireToken` middleware line, exactly like every other route in this
file. A VAPID public key is meant to be handed to the browser (it travels inside every real
`pushManager.subscribe()` call the browser itself makes); gating it behind the existing bearer token
is this project's "every `/api/*` route requires the token, no exceptions" rule applied
consistently, not a new secret-handling decision.

**MIRROR**: `# SOURCE: src/worker/routes/push.ts:22-24, 102-108`

**Delivers**: AC-A1 (PRD AC-9) — infrastructure the client's subscribe call (Task 9) depends on;
the client cannot call `pushManager.subscribe()` without a public key to hand it.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
grep -q 'pushRoutes.get("/vapid-key"' src/worker/routes/push.ts || {
  echo "FAIL: GET /vapid-key route not added to src/worker/routes/push.ts"; exit 1;
}
echo "PASS: GET /api/push/vapid-key route added"
```

### Task 6.5: CREATE `src/shared/push-payload-parse.ts`

**ACTION**: Create a pure, DOM-free module — the decidable half of the payload parse, extracted so
it is reachable by a test outside `ServiceWorkerGlobalScope` (`src/sw.ts` cannot be `import`ed in a
test environment; this module can, because it touches no `self`, no `event`, and performs no
`JSON.parse` of its own — it only shapes an already-parsed value):
```ts
export interface NotificationActionPayload {
  action: string;
  title: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  route?: string;
  actions?: readonly NotificationActionPayload[];
}

const FALLBACK_TITLE = "Praesto Sum";
const FALLBACK_BODY = "Você tem um lembrete.";
const FALLBACK_ICON = "/icons/icon-192.png";
const FALLBACK_BADGE = "/icons/badge-72.png";
const FALLBACK_ROUTE = "/";

/**
 * Normalizes an already-parsed push payload (the result of `event.data.json()`
 * in the caller) into the shape `src/sw.ts` renders. Reads the nested
 * `{data: {route}}` field `src/shared/push-payload.ts` emits — never the flat
 * `{url}` shape this module supersedes. Takes `unknown` because a real push
 * body is attacker-influenced network input, never assumed well-shaped: every
 * field is `typeof`-checked, not merely nullish-checked, because a wrong-type
 * non-nullish value (e.g. `title: 12345`) is a real network input, not a
 * hypothetical — a bare `??` would let it through unchanged.
 */
export function parsePushPayload(value: unknown): PushPayload {
  if (typeof value !== "object" || value === null) {
    return { title: FALLBACK_TITLE, body: FALLBACK_BODY };
  }
  const parsed = value as {
    title?: unknown; body?: unknown; icon?: string; badge?: string; tag?: string;
    data?: { route?: unknown }; actions?: readonly NotificationActionPayload[];
  };
  const title = typeof parsed.title === "string" ? parsed.title : FALLBACK_TITLE;
  const body = typeof parsed.body === "string" ? parsed.body : FALLBACK_BODY;
  const route = typeof parsed.data?.route === "string" ? parsed.data.route : undefined;
  return {
    title,
    body,
    ...(parsed.icon === undefined ? {} : { icon: parsed.icon }),
    ...(parsed.badge === undefined ? {} : { badge: parsed.badge }),
    ...(parsed.tag === undefined ? {} : { tag: parsed.tag }),
    ...(route === undefined ? {} : { route }),
    ...(parsed.actions === undefined ? {} : { actions: parsed.actions }),
  };
}

/** The malformed-or-data-less-push fallback, with an optional raw-text body
 * for the `event.data.text()` branch (the caller's `catch` block). */
export function fallbackPushPayload(bodyOverride?: string): PushPayload {
  return bodyOverride === undefined
    ? { title: FALLBACK_TITLE, body: FALLBACK_BODY }
    : { title: FALLBACK_TITLE, body: bodyOverride };
}

export interface ResolvedPushNotificationOptions {
  icon: string;
  badge: string;
  data: { route: string };
  tag?: string;
  actions?: readonly NotificationActionPayload[];
}

/**
 * Resolves EVERY remaining fallback decision (icon, badge, route) that a
 * `PushPayload` may still be missing, into a single object `src/sw.ts` can
 * spread directly into `showNotification`'s options with no `??`, no
 * conditional and no defaulting of its own — the entire decidable half of
 * "what does the browser call see" lives here, never in the exempt glue file.
 * `tag`/`actions` are carried through unresolved (still conditionally
 * present-or-absent) since `showNotification` treats a missing `tag` as "no
 * collapse key", which is already correct with no default needed.
 */
export function resolvePushNotificationOptions(
  payload: PushPayload,
): ResolvedPushNotificationOptions {
  return {
    icon: payload.icon ?? FALLBACK_ICON,
    badge: payload.badge ?? FALLBACK_BADGE,
    data: { route: payload.route ?? FALLBACK_ROUTE },
    ...(payload.tag === undefined ? {} : { tag: payload.tag }),
    ...(payload.actions === undefined ? {} : { actions: payload.actions }),
  };
}
```
This module performs no `JSON.parse`, calls no browser API, and imports nothing from `src/sw.ts` or
`src/app/` — it is the exact "decidable part…behind a port" `docs/context/methodology.md`'s
2026-08-11 "Browser-API work" rule requires before the thin adapter (Task 7) is allowed to claim the
glue exemption. `resolvePushNotificationOptions` is what makes that claim literally true: EVERY `??`
that would otherwise have to live in `src/sw.ts` (icon, badge, route) is decided here instead, so
Task 7 only ever spreads an already-resolved object.

**MIRROR**: `# SOURCE: src/shared/cron-freshness.ts:1-24` (module shape) and
`# SOURCE: src/shared/push-payload.ts:1-60` (the target field shape this module's output must
agree with — same `data: { route }` nesting, same optional-field idiom).

**Delivers**: AC-A4 (PRD AC-10, infrastructure only) — the testable transformation half of the
tap-opens-the-right-route fix, including the notification-options defaulting; Task 7 supplies the
untestable glue around it.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/push-payload-parse.test.ts
```

### Task 7: UPDATE `src/sw.ts`

**ACTION**: Reduce `parsePush` to the thin, exempt adapter: the `event.data.json()`/
`event.data.text()` try-catch and nothing else, delegating all shaping to Task 6.5's
`parsePushPayload`/`fallbackPushPayload`. Remove the local `PushPayload` interface entirely (import
the type from Task 6.5 instead):
```ts
import {
  parsePushPayload,
  fallbackPushPayload,
  resolvePushNotificationOptions,
  type PushPayload,
} from "./shared/push-payload-parse";

function parsePush(event: PushEvent): PushPayload {
  if (!event.data) return fallbackPushPayload();
  try {
    return parsePushPayload(event.data.json());
  } catch {
    return fallbackPushPayload(event.data.text());
  }
}
```
Update the `push` listener to spread Task 6.5's already-resolved
`resolvePushNotificationOptions(payload)` straight into the `showNotification` options — no `??`, no
conditional, no defaulting of any kind in this file:
```ts
self.addEventListener("push", (event: PushEvent) => {
  const payload = parsePush(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      ...resolvePushNotificationOptions(payload),
    }),
  );
});
```
Update the `notificationclick` listener to read `event.notification.data as { route: string }` —
non-optional, because `resolvePushNotificationOptions` guarantees `data.route` is always a resolved
string by the time it reaches `showNotification`, so there is nothing left to fall back on here —
and build `target` from `data.route` directly, with no `??`, instead of today's `data?.url ?? "/"`:
```ts
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { route: string };
  const target = new URL(data.route, self.location.origin);
  ...
```
Everything else in the file (`clients.matchAll` → `focus()`/`postMessage` else `openWindow()`) stays
unchanged. No decidable logic remains in this file: `parsePush` is pure glue calling Task 6.5's
parser, and both listeners consume an already-fully-resolved value with zero `??`, zero ternary and
zero conditional spread of their own — exactly as `docs/context/methodology.md`'s "Browser-API work"
rule requires for the exemption to hold. Every fallback decision (icon, badge, route) that the
original draft placed in this file now lives in Task 6.5's `resolvePushNotificationOptions`.

**MIRROR**: `# SOURCE: src/shared/push-payload.ts:1-60` (the target shape) and the existing
`# SOURCE: src/sw.ts:52-102` (the code being edited, quoted for what must NOT change — the
`waitUntil` wrapping, the `clients.matchAll`/`postMessage`/`openWindow` fallback chain).

**Delivers**: AC-A4 (PRD AC-10, infrastructure only) — makes the tap-opens-the-right-route half of
the device pass possible; this task does not perform or simulate the device pass itself.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/sw.ts
grep -q 'from "./shared/push-payload-parse"' src/sw.ts || {
  echo "FAIL: src/sw.ts does not delegate to src/shared/push-payload-parse.ts"; exit 1;
}
grep -q 'resolvePushNotificationOptions(payload)' src/sw.ts || {
  echo "FAIL: push handler does not spread Task 6.5's resolved notification options"; exit 1;
}
grep -q 'data.route' src/sw.ts || {
  echo "FAIL: notificationclick does not read data.route"; exit 1;
}
if grep -qE '\?\?|\.route \? |data\?\.route|data\?\.url' src/sw.ts; then
  echo "FAIL: src/sw.ts still contains a fallback/conditional decision (?? or a ternary/optional read) instead of delegating it to src/shared/push-payload-parse.ts"; exit 1;
fi
if grep -qE '^\s*(interface|type) PushPayload' src/sw.ts; then
  echo "FAIL: src/sw.ts still declares its own PushPayload type instead of importing Task 6.5's"; exit 1;
fi
echo "PASS: service worker delegates parsing and all fallback decisions to src/shared/push-payload-parse.ts, keeping only glue"
```

### Task 8: UPDATE `src/app/api.ts`

**ACTION**: Add five one-line wrappers over `request<T>()`, placed near the existing Google
wrappers, importing `SubscribePushInput`, `PushSubscriptionDto` and `DiagnosticsDto` from
`../shared/api` (all three already declared since phases 2-3):
```ts
export async function fetchVapidPublicKey(): Promise<{ publicKey: string }> {
  return request<{ publicKey: string }>("/api/push/vapid-key");
}

export async function subscribeToPush(
  input: SubscribePushInput,
): Promise<{ subscription: PushSubscriptionDto }> {
  return request<{ subscription: PushSubscriptionDto }>("/api/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await request<void>("/api/push/subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendTestPush(): Promise<{
  ok: boolean;
  error?: string;
  results: { endpoint: string; outcome: import("../shared/push-outcome").PushOutcome }[];
}> {
  return request("/api/push/test", { method: "POST" });
}

export async function fetchDiagnostics(): Promise<DiagnosticsDto> {
  return request<DiagnosticsDto>("/api/diagnostics");
}
```
No local types beyond `sendTestPush`'s inline return shape (the route's own ad-hoc `{ok, error?,
results}` body was never given a named DTO in phases 2-3, so none is invented here either — the
`PushOutcome` import keeps `results[].outcome` real rather than `unknown`). No error re-mapping —
`request<T>()` already turns a 401 into a thrown `ApiError`.

**MIRROR**: `# SOURCE: src/app/api.ts:181-187`

**Infrastructure/scaffolding — no AC of its own**: this task only declares the wrappers Tasks 9-12
call; it delivers no behavior by itself.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/api.ts
for fn in fetchVapidPublicKey subscribeToPush unsubscribeFromPush sendTestPush fetchDiagnostics; do
  grep -q "export async function $fn" src/app/api.ts || {
    echo "FAIL: $fn missing from src/app/api.ts"; exit 1;
  }
done
echo "PASS: all five push/diagnostics API wrappers present"
```

### Task 9: CREATE `src/app/push-subscribe.ts`

**ACTION**: Create the thin, exempt adapter — the only file in this phase calling
`navigator.serviceWorker` or `PushManager` directly:
```ts
import { arrayBufferToBase64Url, base64UrlToUint8Array } from "../shared/push-key-encode";
import type { SubscribePushInput } from "../shared/api";

export async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function subscribeDevice(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<SubscribePushInput> {
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  });
  const p256dhKey = subscription.getKey("p256dh");
  const authKey = subscription.getKey("auth");
  if (p256dhKey === null || authKey === null) {
    throw new Error("A inscrição não retornou as chaves de criptografia esperadas.");
  }
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: arrayBufferToBase64Url(p256dhKey), auth: arrayBufferToBase64Url(authKey) },
  };
}

export async function unsubscribeDevice(): Promise<string | null> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription === null) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export async function getCurrentDeviceEndpoint(): Promise<string | null> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}
```
`unsubscribeDevice` unsubscribes locally FIRST, then returns the endpoint for the caller to `DELETE`
server-side — if the `DELETE` itself fails (e.g. offline), the row is not orphaned forever: the next
`POST /api/push/test` dispatch against a locally-unsubscribed endpoint gets a `410` from the push
service, and phase 2's existing `gone`-pruning (`src/worker/routes/push.ts`'s `POST /test` handler)
removes it — the channel self-heals through code that already exists, per ADR-0003's data-safety
posture. No decision lives in this file: every branch belongs in `src/shared/notifications-settings.
ts` (Task 4); this file only performs the calls.

**MIRROR**: `# SOURCE: src/app/hooks/useRoute.ts:1-33` (the exempt-glue doc-comment shape, quoted in
Mandatory Reading — a hook that reads/calls the browser API and decides nothing).

**Delivers**: AC-A1 (PRD AC-9) — the actual subscribe/unsubscribe mechanics the card (Task 10)
calls into.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/push-subscribe.ts
```

### Task 10: CREATE `src/app/components/NotificationsCard.tsx`

**ACTION**: Build the *Notificações* screen's one card, rendering all four `notifications-settings.
ts` (Task 4) kinds, none omitted:

- **`loading`**: a skeleton mirroring `GoogleConnectionCard`'s own (indicator only after 300-500 ms,
  guidelines §8's "Pending request" rule).
- **`explainer`**: one sentence saying what enabling does ("Ative para receber um aviso quando algo
  vencer, mesmo com o app fechado."), and a button *Ativar notificações* whose `onClick` handler
  calls, in this exact order and with no unrelated `await` ahead of the first one (browsers can
  otherwise treat the prompt as no longer tied to the tap that triggered it): (1) dispatch
  `request-start`; (2) `const permission = await Notification.requestPermission();`; (3) dispatch
  `{type: "permission-changed", permission}`; (4) if `permission !== "granted"`, return (the banner
  already reflects `blocked`/`explainer`); (5) otherwise, inside a `try`, call
  `ensureServiceWorkerReady()`, `fetchVapidPublicKey()`, `subscribeDevice(registration, publicKey)`,
  `subscribeToPush(input)`, then dispatch `{type: "toggle-succeeded", subscribed: true}`; on any
  thrown error in step 5, dispatch `{type: "toggle-failed", message: "Não foi possível ativar as
  notificações agora. Tente novamente."}`. Mount effect: read `Notification.permission`, await
  `getCurrentDeviceEndpoint()` to compute `subscribed`, dispatch `loaded`; also register
  `navigator.permissions.query({name: "notifications"})` and its `change` listener, which re-reads
  `Notification.permission` and `getCurrentDeviceEndpoint()` and dispatches `permission-changed` —
  per guidelines §8's explicit ask that the screen stay honest when permission changes outside the
  app.
- **`blocked`**: one sentence naming the condition plainly ("Notificações bloqueadas neste
  navegador.") plus the way back ("Toque no cadeado ao lado do endereço e permita notificações, ou
  ajuste nas configurações do site.") — no button, since AC-9 forbids a control that would silently
  do nothing here.
- **`enabled`**: when `subscribed` is `false` (permission granted outside this flow, e.g. a cleared
  local subscription), a button *Ativar neste dispositivo* re-running steps 5 above via
  `toggle-start`/`toggle-succeeded`/`toggle-failed`. When `subscribed` is `true`, a button
  *Desativar notificações* calling `unsubscribeDevice()` then, if it returned a non-null endpoint,
  `unsubscribeFromPush(endpoint)`, dispatching `toggle-start` before and `toggle-succeeded`/
  `toggle-failed` after; and a button *Enviar notificação de teste*, enabled only while `subscribed`
  and not `sendingTest`, dispatching `test-start` then calling `sendTestPush()` and dispatching
  `test-succeeded`/`test-failed` with a message built from the response (`ok: false` with zero
  subscriptions → "Nenhuma inscrição salva."; otherwise one line per result using
  `pushOutcomeLabel` from `diagnostics-copy.ts`). Render `subscriptionError`/`testResult` inline,
  `role="alert"` on error, mirroring `GoogleConnectionCard`'s `saveError` rendering.
- **`failed`**: one message plus a *Tentar de novo* button re-running the mount load, mirroring
  `GoogleConnectionCard`'s own `failed` branch exactly.

Receives `canWrite: boolean` from `NotificationsScreen` (Task 11) and disables every write-triggering
button (`Ativar*`, `Desativar*`, `Enviar notificação de teste`) while `false` — mirroring
`GoogleConnectionCard`'s own `canWrite` gating; reads (`Tentar de novo`) stay enabled.

**MIRROR**: `# SOURCE: src/app/components/GoogleConnectionCard.tsx:42-98, 118-133`

**Delivers**: AC-A1 (PRD AC-9), AC-A2 (PRD AC-8).

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/components/NotificationsCard.tsx
```

### Task 11: CREATE `src/app/components/NotificationsScreen.tsx`

**ACTION**: Build the `/settings/notifications` route shell, copying `SettingsScreen.tsx`'s grid,
header (wordmark + back button + `<h1>Notificações</h1>`), `Esc`-closes effect and offline-banner
slot verbatim. Renders `<NotificationsCard canWrite={canWrite(connectivity)} />` (own
`useConnectivity()` call, mirroring `SettingsScreen`'s) and, below it, a plain button/link *Ver
diagnóstico* calling `onOpenDiagnostics` (a prop, wired to `navigate("notifications-diagnostics")`
in `App.tsx`, Task 15). Props: `{ onUnauthorized, back, onOpenDiagnostics }`.

**MIRROR**: `# SOURCE: src/app/components/SettingsScreen.tsx:1-110` (whole file, header + effects +
grid copied verbatim, title and content swapped).

**Delivers**: AC-A1 (PRD AC-9) — the route the card lives on.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/components/NotificationsScreen.tsx
```

### Task 12: CREATE `src/app/components/NotificationsDiagnosticsScreen.tsx`

**ACTION**: Build the `/settings/notifications/diagnostics` route shell, copying the same grid/
header/Esc-effect/banner shape as Task 11, titled *Diagnóstico*. On mount, call `fetchDiagnostics()`
(catching a 401 into `onUnauthorized`, per the existing pattern) and `getCurrentDeviceEndpoint()` to
know this device's own subscription state; render, in order: (1) last run — `diagnostics.lastRun ===
null` reads "Nenhuma execução registrada ainda."; otherwise
`formatAbsoluteInstant(diagnostics.lastRun.instant)` and `formatRelativeInstant(diagnostics.lastRun.
instant, new Date())` together (e.g. "12/09/2026, 14:05 · há 3 min"), plus a plainly-worded stale
notice when `diagnostics.freshness === "stale"` ("O cron não roda há mais de 10 minutos.") — never
colour alone, per guidelines §4.4; (2) `diagnostics.subscriptionCount` alongside
`deviceSubscriptionLabel(deviceEndpoint !== null)`; (3) last dispatch — `diagnostics.lastDispatch ===
null` reads "Nenhum teste enviado ainda."; otherwise `formatAbsoluteInstant(diagnostics.lastDispatch.
instant)` plus one line per `{endpoint, outcome}` in `diagnostics.lastDispatch.results` using
`pushOutcomeLabel(outcome)`. Props: `{ onUnauthorized, back }`.

**MIRROR**: `# SOURCE: src/app/components/SettingsScreen.tsx:1-110` (shell); calls
`formatAbsoluteInstant`/`formatRelativeInstant`/`deviceSubscriptionLabel`/`pushOutcomeLabel` from
Task 3 and `fetchDiagnostics` from Task 8 and `getCurrentDeviceEndpoint` from Task 9.

**Delivers**: AC-A3 (PRD AC-7).

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/components/NotificationsDiagnosticsScreen.tsx
```

### Task 13: CREATE `src/app/components/NotificationsEntryCard.tsx`

**ACTION**: Build the small `/settings` card linking into the new route: a one-line status derived
synchronously from `classifyNotificationPermissionView(Notification.permission)` (`"explainer"` →
"Notificações desativadas.", `"blocked"` → "Notificações bloqueadas.", `"enabled"` → "Notificações
ativas.") plus a button *Abrir* calling the `onOpenNotifications` prop. No local reducer needed —
this card holds no async state of its own, mirroring `DataExportCard`'s simplicity rather than
`GoogleConnectionCard`'s.

**MIRROR**: `# SOURCE: src/app/components/DataExportCard.tsx:87-115`

**Infrastructure/scaffolding — no AC of its own**: a navigation entry point; the behaviour it links
to is Task 10/11's, not its own.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/components/NotificationsEntryCard.tsx
```

### Task 14: UPDATE `src/app/components/SettingsScreen.tsx`

**ACTION**: Add a `navigate: (route: AppRoute) => void` prop (imported type from
`../../shared/app-route`). Render `<NotificationsEntryCard onOpenNotifications={() =>
navigate("notifications")} />` in `<main>`, after `<DataExportCard onUnauthorized={onUnauthorized}
/>`. No other change to this file.

**MIRROR**: `# SOURCE: src/app/components/SettingsScreen.tsx:105-106` (the existing two-card
composition this task extends to three).

**Infrastructure/scaffolding — no AC of its own**: wires Task 13's card into the existing screen;
the behaviour is Task 13's.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/components/SettingsScreen.tsx
grep -q 'NotificationsEntryCard' src/app/components/SettingsScreen.tsx || {
  echo "FAIL: SettingsScreen does not render NotificationsEntryCard"; exit 1;
}
grep -q 'navigate' src/app/components/SettingsScreen.tsx || {
  echo "FAIL: SettingsScreen does not accept/use a navigate prop"; exit 1;
}
echo "PASS: SettingsScreen wires the notifications entry point"
```

### Task 15: UPDATE `src/app/App.tsx`

**ACTION**: Extend the `route === "settings" ? ... : ...` ternary into a four-branch switch over
the now four-member `AppRoute`: `"settings"` renders `<SettingsScreen onUnauthorized={onUnauthorized}
back={back} navigate={navigate} />` (now passing `navigate`, per Task 14); `"notifications"` renders
`<NotificationsScreen onUnauthorized={onUnauthorized} back={back} onOpenDiagnostics={() =>
navigate("notifications-diagnostics")} />`; `"notifications-diagnostics"` renders
`<NotificationsDiagnosticsScreen onUnauthorized={onUnauthorized} back={back} />`; the remaining
(`"today"`) branch renders `<TodayScreen .../>` exactly as today. The token-gate branches above the
switch (`authorized === null` skeleton, `!authorized` → `TokenGate`) stay first and unchanged — an
unauthenticated visit to any of the three new paths still reaches the token gate, not a screen,
exactly as `SettingsScreen` already guarantees.

**MIRROR**: `# SOURCE: src/app/App.tsx:76-84` (the two-branch ternary being extended).

**Infrastructure/scaffolding — no AC of its own**: wires Tasks 11 and 12's screens into the app;
the behaviour is theirs.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/App.tsx
grep -q 'NotificationsScreen' src/app/App.tsx || {
  echo "FAIL: App.tsx does not render NotificationsScreen"; exit 1;
}
grep -q 'NotificationsDiagnosticsScreen' src/app/App.tsx || {
  echo "FAIL: App.tsx does not render NotificationsDiagnosticsScreen"; exit 1;
}
echo "PASS: App.tsx routes to both new screens"
```

### Task 16: UPDATE `docs/api-reference.md`

**ACTION**: Add a row to the `## Implemented` table, below the existing `GET /api/diagnostics` row:
`GET | \`/api/push/vapid-key\` | { publicKey: string } — the VAPID public key the browser hands
\`pushManager.subscribe()\`; bearer-gated like every other route`. Update the "5 `push-channel-
proven`" row of the "## Not built yet" table's own scope description if it still reads as
server-only (it currently says "Subscription registration, a test-push route, cron diagnostics" —
append ", client subscription UI" only if that row is not already removed/superseded by this row
moving to Implemented — read the file first to avoid duplicating a row).

**MIRROR**: `# SOURCE: docs/api-reference.md:25-26` (the existing push/diagnostics rows).

**Infrastructure/scaffolding — no AC of its own**: keeps a maintenance document truthful; delivers
no PRD-observable behavior beyond what Task 6 already implements.

**VALIDATE**:
```bash
set -euo pipefail
grep -q '/api/push/vapid-key' docs/api-reference.md || {
  echo "FAIL: GET /api/push/vapid-key undocumented"; exit 1;
}
echo "PASS: vapid-key route documented"
```

### Task 17 (amendment, 2026-09-07): CREATE `src/shared/notifications-load.ts`

**ACTION**: Extract the decidable load-orchestration logic that Task 10's mount effect inlined into a
pure, DOM-free module: `export function loadNotificationsSettings(permission:
NotificationPermission, checkSubscribed: () => Promise<boolean>, dispatch: (event:
NotificationsSettingsEvent) => void): Promise<void>`. For `permission === "denied"` or `permission
=== "default"`, dispatch `{type: "loaded", permission, subscribed: false}` synchronously — before any
`await` — since the "bloqueadas" and explainer states never depend on a subscription check. For
`permission === "granted"`, `await checkSubscribed()` and dispatch `{type: "loaded", permission,
subscribed: result}`; if `checkSubscribed()` rejects, dispatch `{type: "toggle-failed", message:
"Não foi possível verificar a inscrição."}` (reusing the existing event) rather than leaving the
reducer on `loading` forever. This is the fix for the real defect the UI/UX guidelines checklist
found on the live `/settings/notifications` screen (see Notes, "Amendment (2026-09-07)" below):
`NotificationsCard.load()` awaited `getCurrentDeviceEndpoint()` (which awaits
`navigator.serviceWorker.ready`) before dispatching any state at all, so with zero service-worker
registrations the card's skeleton rendered indefinitely — AC-9's "bloqueadas" state, the one this
screen exists to show, could not render, and `navigator.serviceWorker.ready` can only hang, never
reject, so there was no error path either.

**MIRROR**: `# SOURCE: src/shared/cron-freshness.ts:1-24` (module shape) and
`# SOURCE: src/shared/push-payload-parse.ts:1-60` (Task 6.5) — the same "extract the decidable
part behind a port, taking dependencies as arguments rather than reading them from the global scope"
move this plan already applied once, per `docs/context/methodology.md`'s "Browser-API work" rule.

**Delivers**: AC-A1 (PRD AC-9) — the "bloqueadas" and explainer states must render regardless of
service-worker registration state; this is the state that could not render before this amendment.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b && npx vitest run --project worker test/notifications-load.test.ts
```

### Task 18 (amendment, 2026-09-07): UPDATE `src/app/components/NotificationsCard.tsx`

**ACTION**: Replace the mount effect's direct `await getCurrentDeviceEndpoint()` (gating every
`dispatch({type: "loaded", ...})` behind it) with a call to Task 17's
`loadNotificationsSettings(Notification.permission, () =>
getCurrentDeviceEndpoint().then((endpoint) => endpoint !== null), dispatch)`. No change to the
`permissions.query` `change` listener's own re-read, which already re-derives `subscribed` the same
way and is unaffected by this defect (it fires only after `loaded` has already dispatched once).

**MIRROR**: `# SOURCE: src/app/components/GoogleConnectionCard.tsx:74-98` (the mount-load-dispatch
idiom this task keeps, now delegating the decidable ordering to Task 17 instead of inlining it).

**Delivers**: AC-A1 (PRD AC-9) — closes the gap: the explainer and "bloqueadas" states now render
immediately on mount instead of hanging behind an unresolved `navigator.serviceWorker.ready`.

**VALIDATE**:
```bash
set -euo pipefail
npx tsc -b
npx eslint src/app/components/NotificationsCard.tsx
grep -q 'loadNotificationsSettings' src/app/components/NotificationsCard.tsx || {
  echo "FAIL: NotificationsCard.tsx does not delegate its mount load to loadNotificationsSettings"; exit 1;
}
```

## Validation Commands

### Level 1 STATIC_ANALYSIS
```bash
set -euo pipefail
npm run check
```
Runs `wrangler types --check && tsc -b && eslint . && prettier --check .` — catches any
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violation across all seventeen tasks, plus
lint/format drift, with a real non-zero exit on any failure.

### Level 2 UNIT_TESTS
```bash
set -euo pipefail
npm test
```
By the time this level runs, the test pair has authored `test/notification-permission.test.ts`,
`test/push-key-encode.test.ts`, `test/diagnostics-copy.test.ts`, `test/notifications-settings.
test.ts` and `test/push-payload-parse.test.ts` (test-first, per `tdd: true`) and updated `test/
app-route.test.ts` for the two new `AppRoute` members — this proves all five new `src/shared`
modules and the extended route mapping against their real suites, not merely a compile check.
`test/push-payload-parse.test.ts` is the AC-A4 coverage this amendment adds — pinning the nested
`{data: {route}}` parse (and its malformed/data-less/fallback branches) against a module `src/sw.ts`
itself can never expose to a test.

### Level 3 DRY-RUN END-TO-END
```bash
set -euo pipefail
npm run build

npx wrangler dev --local --port 18787 &
WRANGLER_PID=$!
trap 'kill $WRANGLER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:18787/api/health >/dev/null 2>&1 && break
  sleep 1
done

TOKEN="${API_BEARER_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "FAIL: API_BEARER_TOKEN is not set in this shell — cannot exercise the authenticated path"
  exit 1
fi

# 1. The new route is bearer-gated, like every /api/* route.
STATUS=$(curl -s -o /tmp/vapid-401-body -w '%{http_code}' http://127.0.0.1:18787/api/push/vapid-key)
if [ "$STATUS" != "401" ]; then
  echo "FAIL: GET /api/push/vapid-key answered $STATUS without a bearer token, expected 401"
  exit 1
fi

# 2. With a token, it returns a non-empty public key.
VAPID=$(curl -sf http://127.0.0.1:18787/api/push/vapid-key -H "Authorization: Bearer $TOKEN")
echo "$VAPID" | grep -qE '"publicKey":"[^"]+"' || {
  echo "FAIL: /api/push/vapid-key did not return a non-empty publicKey. Body: $VAPID"
  exit 1
}

# 3. Diagnostics (phase 3) is unaffected by this phase's changes.
DIAG=$(curl -sf http://127.0.0.1:18787/api/diagnostics -H "Authorization: Bearer $TOKEN")
echo "$DIAG" | grep -qE '"subscriptionCount":[0-9]+' || {
  echo "FAIL: /api/diagnostics regressed - missing subscriptionCount. Body: $DIAG"
  exit 1
}

echo "PASS: /api/push/vapid-key is bearer-gated and returns a public key; diagnostics unaffected"
```
Entirely local (`wrangler dev --local`) — no deploy, no real device, no production network call, per
this project's own rule against requiring the autonomous implementer to touch production.

## Acceptance Criteria

- **AC-A1 (PRD AC-9):** Given notification permission is `default`, when the *Notificações* route
  renders, then it shows the explainer and the enabling control with no permission prompt fired yet;
  given the owner taps the control, then and only then is the real prompt requested; given
  permission is `denied`, then the screen shows the "bloqueadas" state with the way back and offers
  no control that would silently do nothing; given permission is `granted`, then the screen offers a
  subscribe/unsubscribe toggle reflecting this device's own subscription state.
- **AC-A2 (PRD AC-8):** Given at least one stored subscription, when the owner taps *Enviar
  notificação de teste*, then the screen names, per endpoint, whether the push service accepted it;
  given zero stored subscriptions, then the screen says so explicitly rather than a bare success.
- **AC-A3 (PRD AC-7):** Given the diagnostics sub-page loads, then it shows the last cron run's
  absolute and relative time (or "nenhuma execução registrada ainda" when none), a plainly-worded
  stale notice when the gap is 10 minutes or more, the stored subscription count alongside whether
  THIS device currently holds a subscription, and the last test-push dispatch's time and per-endpoint
  outcome (or "nenhum teste enviado ainda" when none).
- **AC-A4 (PRD AC-10, infrastructure only):** Given a real push payload built by
  `src/shared/push-payload.ts`, when `src/sw.ts`'s `push`/`notificationclick` handlers run, then the
  shown notification and the route opened on tap match the payload's `data.route` field exactly —
  closing the shape mismatch phase 2's plan flagged as a phase-4 dependency. This criterion is about
  parsing correctness, split across two verifiable halves: the decidable transformation, covered by
  `test/push-payload-parse.test.ts` against Task 6.5's `src/shared/push-payload-parse.ts` (a real
  test, not a diff inspection — the module is importable outside `ServiceWorkerGlobalScope`), and the
  thin glue in `src/sw.ts` (Task 7), verifiable by inspecting its diff since `src/sw.ts` itself cannot
  be imported into a test. It is NOT AC-10's device pass itself, which stays the owner's manual
  verification (see Notes).

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `Notification.requestPermission()` loses user-activation if an unrelated `await` runs before it inside the click handler, in which case some browsers silently resolve `"default"` instead of showing the prompt | M | H | Task 10's `**ACTION**` fixes the exact call order: `requestPermission()` is the FIRST `await` in the handler, with no `fetchVapidPublicKey()` or other network call ahead of it |
| `PushManager.subscribe()` throws when the browser's push service is unreachable or the VAPID key is malformed | M | M | Wrapped in `try/catch` (Task 10), surfaced as `toggle-failed` with a stable pt-BR message via the existing inline-error idiom, never left as an unhandled rejection |
| A failed `DELETE /api/push/subscriptions` after a successful local `unsubscribe()` leaves a stale server-side row | L | L | Self-healing via phase 2's existing `gone`-pruning: the next `POST /api/push/test` against that endpoint gets a `410` and the row is removed by code that already exists (Task 9's own doc comment names this explicitly) |
| React component behaviour (the permission flow, the diagnostics render) has no automated tier | H | M | Structural, not accidental, per `docs/context/methodology.md` — every DECIDABLE branch is isolated into the four `src/shared` modules (Tasks 1-4), authored test-first; only the browser-API calls themselves (Task 9) and the JSX (Tasks 10-13) are manually verified, on the owner's device, closing this phase |
| "This device's status" is derived from the local `PushSubscription` alone, so a subscription revoked server-side (e.g. by another device's test-push pruning a `gone` endpoint) would not be reflected until this device's own `getSubscription()` call independently notices | L | L | Acceptable for CON-002's single/owner-device scale; no AC requires cross-device consistency, and the diagnostics screen already shows the authoritative server-side `subscriptionCount` alongside the local read, so a divergence is visible rather than hidden |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in
`docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above,
before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the
`test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` →
`/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any
test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a test
file. Tasks 1-5 and Task 6.5's `**VALIDATE**` lines name the suites the test pair will have authored
or updated by the time the Implementer runs (test-first, per `tdd: true`) — they *invoke* those
suites, never create or edit them. Every other task validates through `tsc -b`/`eslint` (plus a
content-invariant grep where a task's own diff is the thing being asserted), because React component
behaviour has no automated tier here (`docs/context/methodology.md`). This mirrors the precedent set by
`PRPs/plans/completed/push-channel-proven-phase-1-push-send-spike.plan.md`,
`...-phase-2-subscription-lifecycle.plan.md`, `...-phase-3-cron-heartbeat.plan.md` and
`PRPs/plans/completed/google-calendar-read-phase-5-consent-made-visible.plan.md` (all four Notes
sections), which used exactly this shape and shipped `IMPLEMENTED`.

**The payload-shape decision, stated plainly.** `src/sw.ts` adapts to
`src/shared/push-payload.ts`'s nested `{data: {route}}` shape — never the reverse. `push-payload.ts`
is already shipped and already covered by AC-1's APPROVED test suite (`test/push-payload.test.ts`,
phase 2); reshaping it to match `src/sw.ts`'s flat, never-tested-against-a-real-device shape would
mean editing an approved, tested contract to match the untested half, exactly backwards from where
the risk sits. Task 6.5 (the decidable transformation) and Task 7 (the thin glue in `src/sw.ts`
alone) split for this reason, and to make the transformation half — the one this amendment adds
coverage for — importable outside `ServiceWorkerGlobalScope`.

**AC-10's device pass is not, and cannot be, a task in this plan.** Per this phase's own governing
constraint, no task purports to perform or simulate "the phone rings with the app closed and tapping
it opens Praesto." Tasks 6.5 and 7 make it possible (the service worker now parses what phase 2
actually sends); Tasks 9-11 make it cheap (a working subscribe flow and a test-push button reachable from the
UI, so the owner does not need `curl` to trigger it). The pass itself — installing the PWA, closing
it, dispatching a push, observing the phone, tapping the notification, and recording the outcome in
the phase report — is the owner's, after this plan's tasks land.

**The UI/UX guidelines review checklist has been run, against the live `/settings/notifications`
screen — this is how the defect Tasks 17-18 fix was found**, not an outstanding closing step: an
autonomous implementer without a real browser pane cannot honestly produce a ✔/✘ verdict against
Tier A's 375px browser-pane items, so the checklist was deferred past the Implementer to a manual pass
on the owner's phone/browser, exactly as this phase's plan record always intended.

**Passed:** all five §4.3 contrast pairs (ink on surface-1 15.65:1, muted on surface-1 6.74:1, accent
on surface-1 8.57:1, ink on bg 16.82:1, muted on bg 7.24:1 — all above WCAG AA, matching the numbers
chore C15 recorded for the settings card); the 375px and 1280px viewports, both with no horizontal
overflow; pt-BR visible copy with English identifiers; the Arcade identity with no colour outside
`src/app/tokens.css`; and `/settings/notifications` plus its diagnostics sub-page being real routes
with history entries, not sheets.

**Failed:** one item — §8's loading state — which is precisely the defect Tasks 17-18 fix: the
*Notificações* card's mount effect awaited `getCurrentDeviceEndpoint()` (itself awaiting
`navigator.serviceWorker.ready`, which can hang indefinitely with zero service-worker registrations)
before dispatching any state, so the loading skeleton never resolved and AC-9's "bloqueadas" state
could never render.

The full ✔/✘ record is filed at `PRPs/reports/push-channel-proven/phase-4/ui-checklist-run.md`.

What genuinely remains outstanding is only the owner's half, unaffected by this correction: PRD
AC-10's device pass, and the aesthetic judgement on the phone — both still recorded in the phase
report, per the Notes above.

**Why the explainer's "moment of obvious value" is the *Notificações* screen itself, not the first
Reminder.** Guidelines §8 names "the first Reminder" as the moment to show the explainer; Reminders
(unit 7) do not exist yet at this point in the roadmap. The PRD's own Phase 4 scope routes the
two-step flow through the *Notificações* screen instead, which is the sanctioned approximation for
this unit — revisit when unit 7 ships, per the guidelines' own "a rule proves useless or wrong in
practice" review trigger.

**Task-order sweep.** Task 4 imports `classifyNotificationPermissionView` from Task 1 (earlier).
Task 6.5 has no dependency on any other task in this plan — it imports nothing from `src/sw.ts`,
`src/shared/push-payload.ts` (an existing, already-shipped file it only agrees in shape with, never
imports), or any other task's output. Task 7 imports `parsePushPayload`/`fallbackPushPayload`/`resolvePushNotificationOptions`/
`PushPayload` from Task 6.5 (immediately earlier). Task 9 imports `arrayBufferToBase64Url`/
`base64UrlToUint8Array` from Task 2 and `SubscribePushInput` from the existing `shared/api.ts` (both
earlier/existing). Task 10 imports Task 4's reducer, Task 8's API wrappers, Task 9's adapter, and
Task 3's `pushOutcomeLabel` — all earlier. Task 11 imports Task 10's card. Task 12 imports Task 3's
formatters, Task 8's `fetchDiagnostics`, and Task 9's `getCurrentDeviceEndpoint` — all earlier.
Task 13 imports Task 1's classifier. Task 14 imports Task 13's card and Task 5's `AppRoute` type —
both earlier. Task 15 imports Tasks 11 and 12's screens and Task 14's updated `SettingsScreen` — all
earlier. Task 6 (server route) has no dependency on any other task and is independent of the
`src/app`/`src/shared` chain. Task 16 (docs) depends only on Task 6 already having landed. Task 17
(`src/shared/notifications-load.ts`) takes `NotificationPermission` (a global lib.dom type, not a
project symbol) and `NotificationsSettingsEvent`/`NotificationsSettingsState` (Task 4, earlier) as its
only project-level references, plus a caller-supplied `checkSubscribed`/`dispatch` pair it takes as
arguments rather than importing — it declares no import of its own from any later-numbered task. Task
18 (`src/app/components/NotificationsCard.tsx`) imports `loadNotificationsSettings` from Task 17
(immediately earlier) and continues to use `getCurrentDeviceEndpoint` from Task 9 (earlier) and the
reducer's `dispatch` already in scope from Task 4 (earlier); it introduces no reference to anything
numbered 18 or higher. No ordering inversion found, including across the 2026-09-07 amendment's own
two added tasks.

**Amendment (2026-09-07) — AC-A4 test-coverage gap closed.** The `test-reviewer` agent, running its
`R-AC-COVERAGE` check against the DRAFT test suite for this plan, found that the original Task 7
(which fixed `src/sw.ts`'s unexported `parsePush` in place) left AC-A4 with zero test coverage:
`src/sw.ts` cannot be `import`ed outside a real `ServiceWorkerGlobalScope`, so no test could reach the
fixed parsing logic — on a channel whose defining property is that its failures are silent. The
reviewer ruled this against `docs/context/methodology.md`'s 2026-08-11 "Browser-API work" rule
("Extract the decidable part into `src/shared` behind a port… Only the thin adapter is exempt… The
exemption is for glue, never for logic"), and noted the original Task 7 had conflated two different
exemptions: AC-10's device pass is genuinely unfalsifiable by any tier (Notes, above), while
`parsePush`'s transformation is pure logic whose only obstacle was code organization. The fix is a
production-code change, not a test-side workaround, because the rule is a design obligation: this
amendment extracts the decidable transformation into the new Task 6.5
(`src/shared/push-payload-parse.ts`, a pure module reachable by `test/push-payload-parse.test.ts`)
and reduces Task 7 to the glue the rule actually exempts. Task 6.5 is inserted before Task 7 in this
document; no existing task was renumbered. `## Metadata`'s Estimated Tasks, `## Files to Change`,
`## Mandatory Reading`, `## Patterns to Mirror`, `## Acceptance Criteria` (AC-A4), the Level 2
Validation Commands note, and this Notes section were all updated to keep the plan internally
consistent; every other section is unchanged from the version the `plan-reviewer` originally
APPROVED.

**Correction (2026-09-07) — `plan-reviewer` CHANGES_REQUESTED, two blocking findings, both fixed.**
(1) The prior draft's Task 7 claimed "no decidable logic remains in this file" while its own code
sample computed `payload.icon ?? "..."`, `payload.badge ?? "..."` and `data: { route: payload.route
?? "/" }` inline — introducing exactly the class of untestable fallback-in-`sw.ts` logic this
amendment exists to close. Fixed by moving all three fallbacks into a new Task 6.5 export,
`resolvePushNotificationOptions(payload): ResolvedPushNotificationOptions`, which returns an
already-resolved `{icon, badge, data: {route}, tag?, actions?}` object; Task 7's `push` listener now
does a single flat `...resolvePushNotificationOptions(payload)` spread with zero `??`, and its
`notificationclick` listener reads `event.notification.data as { route: string }` (non-optional,
since the value was resolved before `showNotification` ever stored it) with zero `??`. Task 7's
self-description is now literally true, not aspirational, and its `**VALIDATE**` greps for the
absence of any remaining `??`/ternary/optional-chained fallback in `src/sw.ts`. (2) The prior draft's
Task 6.5 used `parsed.title ?? FALLBACK_TITLE` (nullish-only) against `test/push-payload-parse.test.ts`'s
three wrong-TYPE fixtures (`title: 12345`, `body: {nested: true}`, `data: {route: 42}`), all of
which are non-nullish and so would have passed straight through, leaving those three assertions red
no matter how faithfully the ACTION was transcribed. Fixed by adding a `typeof x === "string"` guard
per field (`title`, `body`, `data.route`) ahead of the fallback, read directly off the test file
already on disk; the test itself was not touched. A task-order sweep of every other task in this plan
found no other instance of this divergence-between-prose-and-code shape.

**Amendment (2026-09-07) — post-close UI/UX guidelines checklist found a real defect, now fixed.**
This phase's own Notes (above) record the guidelines review checklist as a required closing step,
run and pasted into the phase record alongside the device pass. Running it against the live
`/settings/notifications` screen found a real defect, not a dev-only artifact: the *Notificações*
card renders a loading skeleton indefinitely. Confirmed in the browser: zero service-worker
registrations and `navigator.serviceWorker.ready` never resolving, while
`NotificationsCard.load()` awaited `getCurrentDeviceEndpoint()` — which itself awaits
`navigator.serviceWorker.ready` — before dispatching any state at all. The failure mode survives in
production too (slow or failed service-worker registration, or a browser/setting that disables
service workers entirely), so this is a genuine gap against `ui-ux-guidelines.md` §8, not a
dev-environment quirk: PRD **AC-9**'s "bloqueadas" state — the state this screen exists to show — is
the one that cannot render, and because `navigator.serviceWorker.ready` can only hang and never
reject, there is no error path either.

The fix follows the same move this plan already applied once for `src/sw.ts`/`push-payload-parse.ts`
(Task 6.5): the decidable part goes to `src/shared` behind a port, per
`docs/context/methodology.md`'s "Browser-API work" rule, rather than patching the effect in place.
New Task 17 creates `src/shared/notifications-load.ts` exporting
`loadNotificationsSettings(permission, checkSubscribed, dispatch)`, which dispatches `loaded`
synchronously — before any `await` — for `denied`/`default` permission (those states never need a
subscription check), and only awaits the subscription-check port for `granted`, routing a rejecting
port through the existing `toggle-failed` event rather than leaving the reducer on `loading` forever.
New Task 18 updates `NotificationsCard.tsx` to call it in place of the inline
`getCurrentDeviceEndpoint()` await. The test contract was written first: `test/notifications-load.
test.ts` is already APPROVED-pending, and its ordering proof uses a port that never settles — an
assertion no type-level change can satisfy, only the dispatch-before-await ordering this amendment's
Task 17 implements. `## Files to Change`, `## Step-by-Step Tasks` (Tasks 17-18) and this Notes
section are the only parts of the plan touched by this amendment; every other section (including
`## Metadata`'s Estimated Tasks count) is unchanged from the version this phase shipped `IMPLEMENTED`
against.

*Generated: 2026-09-07*
*Approved: 2026-09-07*
*Status: IMPLEMENTED*
