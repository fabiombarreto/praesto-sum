// PRPs/prds/push-channel-proven.prd.md AC-9 (via plan AC-A1) — the
// *Notificações* screen must reach the `denied` ("bloqueadas", the way
// back) and `default` (explainer) views without ever waiting on a
// subscription lookup, since neither view needs one.
//
// Source plan: PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 10 amendment — src/shared/notifications-load.ts: loadNotificationsSettings)
//
// --- Why this file exists (test-reviewer R-TRIVIAL-ASSERT, 2026-09-07) ----
// The prior revision's three "loaded omits subscribed" tests in
// test/notifications-settings.test.ts proved only that the REDUCER
// TOLERATES a `loaded` event without `subscribed` — a tolerance the runtime
// already had before that revision (all three passed unchanged; the only
// new RED was a `tsc -b` type mismatch). None of them pinned the actual
// defect: `NotificationsCard.tsx`'s `load()` awaited
// `getCurrentDeviceEndpoint()` (which awaits `navigator.serviceWorker.ready`
// — a promise that can hang forever and never rejects) BEFORE dispatching
// ANY state, so an implementer could satisfy every assertion by loosening
// the event's type alone while leaving the await ORDER untouched, and the
// hang would remain.
//
// Per `docs/context/methodology.md`'s "Browser-API work" split (the same
// move this phase already made once for `src/sw.ts`'s payload parsing, see
// `test/push-payload-parse.test.ts`), `load()`'s two-step sequence is
// extracted into a pure, DOM-free orchestrator here that takes an INJECTED
// `() => Promise<boolean>` subscription-check port instead of calling
// `getCurrentDeviceEndpoint()` itself. `NotificationsCard.tsx` becomes the
// thin adapter that supplies the real port
// (`() => getCurrentDeviceEndpoint().then((endpoint) => endpoint !== null)`)
// and the real `Notification.permission` value; the ORDER in which the
// port's result is awaited relative to dispatching the permission state is
// the decidable part this suite pins, using a subscription-check port that
// deliberately NEVER SETTLES — the exact shape of the real hang — so no
// type-only fix can satisfy it. A type edit is not an ordering fix.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/notifications-load.ts does not exist yet, so this file is RED
// for the right reason (module-not-found on the import below) until the
// amended plan's corresponding task lands.
//
// Contract asserted here (`loadNotificationsSettings(permission,
// checkSubscribed, dispatch)`):
//   1. Dispatches `{ type: "loaded", permission }` SYNCHRONOUSLY, before any
//      `await` — in particular before `checkSubscribed()` is ever called for
//      views that need no subscription result at all (`blocked`,
//      `explainer`), and before its result is awaited for `enabled`.
//   2. For `denied`/`default` permissions, NEVER calls `checkSubscribed` —
//      there is nothing to look up for a view with no subscribe control.
//   3. For a `granted` permission, DOES call and await `checkSubscribed` —
//      the enabled/subscribed distinction genuinely needs that result — and
//      on success dispatches `{ type: "permission-changed", permission,
//      subscribed }` to carry it into the state once resolved.
//   4. If `checkSubscribed` rejects, dispatches the EXISTING `toggle-failed`
//      event (not a new one — `test-reviewer` R-DUPLICATE already ruled out
//      a parallel event for this exact shape in the prior revision) so the
//      `enabled` view stays actionable instead of getting stuck.

import { describe, expect, it, vi } from "vitest";
import { loadNotificationsSettings } from "../src/shared/notifications-load";
import {
  INITIAL_NOTIFICATIONS_SETTINGS_STATE,
  reduceNotificationsSettings,
  type NotificationsSettingsEvent,
} from "../src/shared/notifications-settings";

/** A promise that deliberately never settles — the exact shape of the real
 * hang (`navigator.serviceWorker.ready` with zero service-worker
 * registrations never resolves and never rejects). */
function neverSettles<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** Races `promise` against a short timer so a test can fail fast, with a
 * distinguishable sentinel, instead of hanging the whole run when the
 * orchestrator regresses to awaiting a port it should not be awaiting. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "TIMED_OUT"> {
  return Promise.race([
    promise,
    new Promise<"TIMED_OUT">((resolve) => setTimeout(() => resolve("TIMED_OUT"), ms)),
  ]);
}

/** Reads the event argument of the `dispatch` spy's Nth call, failing loudly
 * (rather than typing as `T | undefined` under `noUncheckedIndexedAccess`)
 * when that call never happened. */
function nthDispatchedEvent(
  dispatch: { mock: { calls: Array<[NotificationsSettingsEvent]> } },
  index: number,
): NotificationsSettingsEvent {
  const call = dispatch.mock.calls[index];
  if (call === undefined) {
    throw new Error(`expected dispatch to have been called at least ${index + 1} time(s)`);
  }
  return call[0];
}

describe("loadNotificationsSettings — reaches a no-subscription-needed view without ever waiting on the port (PRD AC-9)", () => {
  it("reaches blocked for a denied permission, and never calls the port at all", async () => {
    const dispatch = vi.fn<(event: NotificationsSettingsEvent) => void>();
    const checkSubscribed = vi.fn(() => neverSettles<boolean>());

    const result = await withTimeout(
      loadNotificationsSettings("denied", checkSubscribed, dispatch),
      50,
    );

    expect(result).not.toBe("TIMED_OUT");
    expect(checkSubscribed).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "loaded", permission: "denied" });

    // Effect check, not just was-called: replaying the dispatched event
    // through the REAL reducer must land on the actual PRD-required view.
    const next = reduceNotificationsSettings(
      INITIAL_NOTIFICATIONS_SETTINGS_STATE,
      nthDispatchedEvent(dispatch, 0),
    );
    expect(next).toEqual({ kind: "blocked" });
  });

  it("reaches the explainer for a default permission, and never calls the port at all", async () => {
    const dispatch = vi.fn<(event: NotificationsSettingsEvent) => void>();
    const checkSubscribed = vi.fn(() => neverSettles<boolean>());

    const result = await withTimeout(
      loadNotificationsSettings("default", checkSubscribed, dispatch),
      50,
    );

    expect(result).not.toBe("TIMED_OUT");
    expect(checkSubscribed).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "loaded", permission: "default" });

    const next = reduceNotificationsSettings(
      INITIAL_NOTIFICATIONS_SETTINGS_STATE,
      nthDispatchedEvent(dispatch, 0),
    );
    expect(next).toMatchObject({ kind: "explainer", requesting: false });
  });
});

describe("loadNotificationsSettings — a hung or rejected port must not block the enabled view either (PRD AC-9 defect fix)", () => {
  it("dispatches the initial loaded event for a granted permission before the (never-settling) port ever resolves", async () => {
    const dispatch = vi.fn<(event: NotificationsSettingsEvent) => void>();
    const checkSubscribed = vi.fn(() => neverSettles<boolean>());

    // Deliberately not awaited to completion — for `granted` the returned
    // promise legitimately never settles while the port is hung. What must
    // happen regardless is the SYNCHRONOUS first dispatch, before this hang.
    void loadNotificationsSettings("granted", checkSubscribed, dispatch);

    // Flush the microtask queue so the synchronous dispatch (issued before
    // the orchestrator's first `await`) has had a chance to run.
    await Promise.resolve();
    await Promise.resolve();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "loaded", permission: "granted" });

    const next = reduceNotificationsSettings(
      INITIAL_NOTIFICATIONS_SETTINGS_STATE,
      nthDispatchedEvent(dispatch, 0),
    );
    expect(next).toMatchObject({
      kind: "enabled",
      subscribed: false,
      togglingSubscription: false,
      subscriptionError: null,
    });
  });

  it("leaves the enabled view actionable, via the existing toggle-failed event, when the port rejects", async () => {
    const dispatch = vi.fn<(event: NotificationsSettingsEvent) => void>();
    const checkSubscribed = vi.fn(() =>
      Promise.reject(new Error("navigator.serviceWorker.ready rejected")),
    );

    await loadNotificationsSettings("granted", checkSubscribed, dispatch);

    expect(checkSubscribed).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "loaded", permission: "granted" });

    const secondEvent = nthDispatchedEvent(dispatch, 1);
    expect(secondEvent.type).toBe("toggle-failed");
    if (secondEvent.type === "toggle-failed") {
      expect(typeof secondEvent.message).toBe("string");
      expect(secondEvent.message.length).toBeGreaterThan(0);
    }

    // Effect check: replaying both dispatched events through the REAL
    // reducer must land the card on an ACTIONABLE enabled view — not
    // `failed`, not stuck `loading` — per guidelines §8 ("a request failure
    // is shown inline next to the action that failed, never a silent
    // indefinite wait").
    const afterLoaded = reduceNotificationsSettings(
      INITIAL_NOTIFICATIONS_SETTINGS_STATE,
      nthDispatchedEvent(dispatch, 0),
    );
    const afterFailure = reduceNotificationsSettings(afterLoaded, secondEvent);
    expect(afterFailure.kind).toBe("enabled");
    if (afterFailure.kind === "enabled") {
      expect(afterFailure.togglingSubscription).toBe(false);
      expect(afterFailure.subscriptionError).toBe(
        secondEvent.type === "toggle-failed" ? secondEvent.message : null,
      );
    }
  });
});

describe("loadNotificationsSettings — DOES await the port when the result is genuinely needed (no overcorrection into never checking)", () => {
  it("awaits the subscription check for a granted permission and reflects a resolved true only once it settles", async () => {
    const dispatch = vi.fn<(event: NotificationsSettingsEvent) => void>();
    let resolveCheck!: (value: boolean) => void;
    const checkSubscribed = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveCheck = resolve;
        }),
    );

    const pending = loadNotificationsSettings("granted", checkSubscribed, dispatch);

    await Promise.resolve();
    await Promise.resolve();

    // Before the port settles: the port WAS invoked (it is genuinely needed
    // here), but its result has not yet been dispatched.
    expect(checkSubscribed).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "loaded", permission: "granted" });

    resolveCheck(true);
    await pending;

    expect(dispatch).toHaveBeenCalledTimes(2);
    const secondEvent = nthDispatchedEvent(dispatch, 1);
    expect(secondEvent).toMatchObject({
      type: "permission-changed",
      permission: "granted",
      subscribed: true,
    });

    const afterLoaded = reduceNotificationsSettings(
      INITIAL_NOTIFICATIONS_SETTINGS_STATE,
      nthDispatchedEvent(dispatch, 0),
    );
    const afterCheck = reduceNotificationsSettings(afterLoaded, secondEvent);
    expect(afterCheck).toMatchObject({ kind: "enabled", subscribed: true });
  });
});
