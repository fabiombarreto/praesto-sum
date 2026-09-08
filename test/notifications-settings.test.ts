// PRPs/prds/push-channel-proven.prd.md AC-9 Permission flow is a two-step
// state machine (via plan AC-A1).
//
// Source plan: PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 4 — src/shared/notifications-settings.ts: NotificationsSettingsState,
// INITIAL_NOTIFICATIONS_SETTINGS_STATE, the events named in the task's own
// prose, and the reducer that derives `kind` from
// `classifyNotificationPermissionView`; plan AC-A1)
//
// Mirrors `src/shared/google-settings.ts`/`test/google-settings.test.ts`
// shape for shape: the `kind`-discriminated union and the
// guard-then-return-unchanged-state idiom for events that only apply to one
// kind. The real permission prompt, the subscribe/unsubscribe calls, and the
// JSX rendering the four kinds are React glue in
// `src/app/components/NotificationsCard.tsx` — the exempt half of
// `docs/context/methodology.md`'s "Browser-API work" split, verified on the
// device. This module is the decidable half: AC-9's "no control that would
// silently do nothing" on the `blocked` state is enforced structurally here
// (the `blocked` kind carries no togglable field at all, and every
// toggle/test event is a documented no-op unless `kind === "enabled"`), even
// though the actual absence of a button is a component concern this suite
// cannot and does not assert.
//
// The task's own prose names the state's four kinds and every event's name
// and payload, but not the reducer's exported function name — mirroring
// `test/google-settings.test.ts`'s own precedent (its header note: "the plan
// names the four kinds and the two predicates' rules in prose but not a
// literal shape, so authoring that shape here [...] is what test-first
// means"), this suite names the reducer `reduceNotificationsSettings`,
// mirroring `reduceGoogleSettings` character for character, as ITS OWN
// prescription of the contract: plan Task 4 conforms to this name, not the
// other way around.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/notifications-settings.ts does not exist yet, so this file is
// RED for the right reason (module-not-found on the import below) until plan
// Task 4 lands.

import { describe, expect, it } from "vitest";
import {
  INITIAL_NOTIFICATIONS_SETTINGS_STATE,
  reduceNotificationsSettings,
  type NotificationsSettingsState,
} from "../src/shared/notifications-settings";

function enabled(
  overrides: Partial<Extract<NotificationsSettingsState, { kind: "enabled" }>> = {},
): NotificationsSettingsState {
  return {
    kind: "enabled",
    subscribed: false,
    togglingSubscription: false,
    subscriptionError: null,
    sendingTest: false,
    testResult: null,
    ...overrides,
  };
}

describe("INITIAL_NOTIFICATIONS_SETTINGS_STATE", () => {
  it("starts loading — the screen has not yet read Notification.permission", () => {
    expect(INITIAL_NOTIFICATIONS_SETTINGS_STATE.kind).toBe("loading");
  });
});

describe("reduceNotificationsSettings — 'loaded' derives kind from permission (PRD AC-9)", () => {
  it("a default permission lands on the explainer view, not requesting yet", () => {
    const next = reduceNotificationsSettings(INITIAL_NOTIFICATIONS_SETTINGS_STATE, {
      type: "loaded",
      permission: "default",
      subscribed: false,
    });
    expect(next).toMatchObject({ kind: "explainer", requesting: false });
  });

  it("a denied permission lands on the blocked view", () => {
    const next = reduceNotificationsSettings(INITIAL_NOTIFICATIONS_SETTINGS_STATE, {
      type: "loaded",
      permission: "denied",
      subscribed: false,
    });
    expect(next.kind).toBe("blocked");
  });

  it("a granted permission lands on the enabled view, carrying the subscribed flag it was told", () => {
    const next = reduceNotificationsSettings(INITIAL_NOTIFICATIONS_SETTINGS_STATE, {
      type: "loaded",
      permission: "granted",
      subscribed: true,
    });
    expect(next).toMatchObject({
      kind: "enabled",
      subscribed: true,
      togglingSubscription: false,
      subscriptionError: null,
      sendingTest: false,
      testResult: null,
    });
  });
});

describe("reduceNotificationsSettings — 'load-failed'", () => {
  it("lands on kind: failed, carrying the reason through unchanged", () => {
    const next = reduceNotificationsSettings(INITIAL_NOTIFICATIONS_SETTINGS_STATE, {
      type: "load-failed",
      reason: "offline",
    });
    expect(next).toMatchObject({ kind: "failed", reason: "offline" });
  });
});

describe("reduceNotificationsSettings — 'request-start' only applies to the explainer (PRD AC-9)", () => {
  it("sets requesting true on the explainer — the prompt is now in flight", () => {
    const explainer: NotificationsSettingsState = { kind: "explainer", requesting: false };
    const next = reduceNotificationsSettings(explainer, { type: "request-start" });
    expect(next).toMatchObject({ kind: "explainer", requesting: true });
  });

  it("is a no-op on blocked — there is no prompt this state could ever fire", () => {
    const blocked: NotificationsSettingsState = { kind: "blocked" };
    expect(reduceNotificationsSettings(blocked, { type: "request-start" })).toEqual(blocked);
  });

  it("is a no-op on enabled — the prompt has already been answered", () => {
    const state = enabled();
    expect(reduceNotificationsSettings(state, { type: "request-start" })).toEqual(state);
  });
});

describe("reduceNotificationsSettings — toggle-* events only apply to 'enabled' (PRD AC-9)", () => {
  it("toggle-start sets togglingSubscription true", () => {
    const next = reduceNotificationsSettings(enabled(), { type: "toggle-start" });
    expect(next).toMatchObject({ kind: "enabled", togglingSubscription: true });
  });

  it("toggle-start is a no-op on the explainer — there is no toggle to start yet", () => {
    const explainer: NotificationsSettingsState = { kind: "explainer", requesting: false };
    expect(reduceNotificationsSettings(explainer, { type: "toggle-start" })).toEqual(explainer);
  });

  it("toggle-succeeded records the new subscribed flag and clears the in-flight state", () => {
    const next = reduceNotificationsSettings(
      enabled({ togglingSubscription: true, subscribed: false }),
      {
        type: "toggle-succeeded",
        subscribed: true,
      },
    );
    expect(next).toMatchObject({ kind: "enabled", subscribed: true, togglingSubscription: false });
  });

  it("toggle-failed records the message and clears the in-flight state, without touching subscribed", () => {
    const next = reduceNotificationsSettings(
      enabled({ togglingSubscription: true, subscribed: true }),
      { type: "toggle-failed", message: "Não foi possível ativar as notificações agora." },
    );
    expect(next).toMatchObject({
      kind: "enabled",
      subscribed: true,
      togglingSubscription: false,
      subscriptionError: "Não foi possível ativar as notificações agora.",
    });
  });

  it("toggle-succeeded is a no-op on blocked — AC-9 forbids a control here in the first place", () => {
    const blocked: NotificationsSettingsState = { kind: "blocked" };
    expect(
      reduceNotificationsSettings(blocked, { type: "toggle-succeeded", subscribed: true }),
    ).toEqual(blocked);
  });
});

describe("reduceNotificationsSettings — test-* events only apply to 'enabled' (PRD AC-8 via AC-A2)", () => {
  it("test-start sets sendingTest true", () => {
    const next = reduceNotificationsSettings(enabled(), { type: "test-start" });
    expect(next).toMatchObject({ kind: "enabled", sendingTest: true });
  });

  it("test-start is a no-op on the explainer — nothing to test before subscribing", () => {
    const explainer: NotificationsSettingsState = { kind: "explainer", requesting: false };
    expect(reduceNotificationsSettings(explainer, { type: "test-start" })).toEqual(explainer);
  });

  it("test-succeeded records an ok testResult and clears sendingTest", () => {
    const next = reduceNotificationsSettings(enabled({ sendingTest: true }), {
      type: "test-succeeded",
      message: "Entregue.",
    });
    expect(next).toMatchObject({
      kind: "enabled",
      sendingTest: false,
      testResult: { ok: true, message: "Entregue." },
    });
  });

  it("test-failed records a not-ok testResult and clears sendingTest", () => {
    const next = reduceNotificationsSettings(enabled({ sendingTest: true }), {
      type: "test-failed",
      message: "Nenhuma inscrição salva.",
    });
    expect(next).toMatchObject({
      kind: "enabled",
      sendingTest: false,
      testResult: { ok: false, message: "Nenhuma inscrição salva." },
    });
  });
});

describe("reduceNotificationsSettings — 'permission-changed' keeps the screen honest (PRD AC-9)", () => {
  it("reclassifies from enabled to blocked when permission is revoked outside the app", () => {
    const next = reduceNotificationsSettings(enabled({ subscribed: true }), {
      type: "permission-changed",
      permission: "denied",
    });
    expect(next.kind).toBe("blocked");
  });

  it("reclassifies from blocked to explainer when permission resets to default", () => {
    const blocked: NotificationsSettingsState = { kind: "blocked" };
    const next = reduceNotificationsSettings(blocked, {
      type: "permission-changed",
      permission: "default",
    });
    expect(next).toMatchObject({ kind: "explainer", requesting: false });
  });

  it("carries the previous subscribed value forward when re-entering enabled with none supplied", () => {
    const priorEnabled = enabled({ subscribed: true });
    const reclassified = reduceNotificationsSettings(priorEnabled, {
      type: "permission-changed",
      permission: "granted",
    });
    expect(reclassified).toMatchObject({ kind: "enabled", subscribed: true });
  });

  it("never invents subscribed: true out of nowhere — defaults to false when the prior state was not enabled", () => {
    const explainer: NotificationsSettingsState = { kind: "explainer", requesting: true };
    const next = reduceNotificationsSettings(explainer, {
      type: "permission-changed",
      permission: "granted",
    });
    expect(next).toMatchObject({ kind: "enabled", subscribed: false });
  });

  it("an explicit subscribed value on the event always wins over any carried-forward value", () => {
    const priorEnabled = enabled({ subscribed: true });
    const next = reduceNotificationsSettings(priorEnabled, {
      type: "permission-changed",
      permission: "granted",
      subscribed: false,
    });
    expect(next).toMatchObject({ kind: "enabled", subscribed: false });
  });
});

// --- Defect-fix coverage (2026-09-07): /settings/notifications rendered the
// loading skeleton forever. Root cause, confirmed live: `NotificationsCard`'s
// `load()` did `const subscribed = (await getCurrentDeviceEndpoint()) !==
// null` BEFORE dispatching ANY state, and `getCurrentDeviceEndpoint()` awaits
// `navigator.serviceWorker.ready` — a promise that can hang forever and never
// rejects. `Notification.permission` is synchronous and available
// immediately, and PRD AC-9 requires the `denied` case (the "bloqueadas"
// state with the way back) to render regardless — there is no subscription
// to look up in that case at all. The two groups below are the decidable
// contract the fix must satisfy: (1) `loaded` must not REQUIRE a resolved
// subscription result to reach the two views (`blocked`, `explainer`) that
// never needed one, and must default `enabled`'s `subscribed` to `false`
// rather than block on it either; (2) once the card can render without
// waiting on the subscription lookup, a later, separate lookup that hangs or
// rejects must still leave the `enabled` view actionable, per
// `documentation/40-engineering/ui-ux-guidelines.md` §8 ("a request failure
// is shown inline next to the action that failed, never a silent indefinite
// wait").
//
// The ~10 s "Ainda carregando…" skeleton-threshold line guidelines §8 also
// asks for has NO decidable counterpart proposed here — it is a bare
// `setTimeout` inside `NotificationsCard.tsx` with no branching this suite
// could observe from outside `src/shared`, so it is left to the manual
// device/browser-pane verification the methodology's "Browser-API work"
// split already reserves for glue, not modeled as a new shared module.

// --- Revision (2026-09-07, test-reviewer R-TRIVIAL-ASSERT — blocking) -----
// The three "loaded must not require a resolved subscription lookup" tests
// that stood here were REMOVED (REDUNDANT_TEST_REMOVED). They proved only
// that `reduceNotificationsSettings` TOLERATES a `loaded` event whose
// `subscribed` field is omitted — a tolerance the runtime already had
// before they were written (all three passed unchanged against the
// pre-revision reducer; the only new RED they produced was a `tsc -b` type
// mismatch on the event literals). They never pinned the actual defect:
// `NotificationsCard.tsx`'s `load()` awaited `getCurrentDeviceEndpoint()`
// (which awaits `navigator.serviceWorker.ready`, a promise that can hang
// forever) BEFORE dispatching any state at all — an implementer could
// satisfy every one of these three assertions by loosening the event's
// TYPE alone while leaving that await ORDER untouched, and the hang would
// remain.
//
// Survivor: test/notifications-load.test.ts's
// "loadNotificationsSettings — reaches a no-subscription-needed view
// without ever waiting on the port" and "...DOES await the port when the
// result is genuinely needed" describe blocks. Each dispatches the exact
// same `loaded`-without-`subscribed` event shape these three tests used and
// replays it through this SAME real `reduceNotificationsSettings`,
// asserting the identical blocked / explainer / enabled-default-false
// outcomes — so no coverage is lost — while ADDITIONALLY pinning the
// ordering property (dispatched before, not after, an injected
// subscription-check port ever settles) that is the actual fix. There is no
// discriminative assertion left here that the survivor does not already
// make, so keeping both would be a proven duplicate (R-DUPLICATE) rather
// than added coverage.

// A background subscription-check failure (a hung or rejected
// `navigator.serviceWorker.ready` lookup, run AFTER `loaded` already reached
// `enabled` with no `subscribed` field) is reported through the EXISTING
// `toggle-failed` event, not a separate one. `test-reviewer` (R-DUPLICATE,
// 2026-09-07) found that a distinct `subscription-check-failed` event
// asserting this same shape was byte-identical to what `toggle-failed`
// already produces for `kind === "enabled"`: the reducer's guard checks only
// `state.kind === "enabled"`, never the current `togglingSubscription`
// value, so dispatching `toggle-failed` from a state where
// `togglingSubscription` is already `false` (the background-check case, as
// opposed to the user-initiated-toggle case the pre-existing "toggle-failed
// records the message..." test above already covers with
// `togglingSubscription: true`) yields exactly the same
// `{...state, togglingSubscription: false, subscriptionError: event.message}`
// — including the same no-op on `explainer` and `blocked`. There is no
// second decidable behaviour here, so no second test is written: the
// pre-existing `toggle-failed` group above is this requirement's complete
// coverage (see the manifest's AC outcomes table for the
// EXISTING_TEST_COVERS mapping).
