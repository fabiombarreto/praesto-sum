/**
 * The *Notificações* card's own state machine (PRD AC-9 via plan AC-A1),
 * mirroring `google-settings.ts` shape for shape. Total and side-effect
 * free: it only reduces the events it is handed and never touches the DOM,
 * a timer, `Notification` or the network.
 *
 * The real permission prompt, the subscribe/unsubscribe calls, the
 * `permissions.query` listener and the JSX rendering the four kinds are
 * React glue in `src/app/components/NotificationsCard.tsx` — the exempt
 * half of `docs/context/methodology.md`'s "Browser-API work" split. This
 * module is the decidable half, authored test-first
 * (`test/notifications-settings.test.ts`).
 *
 * `kind` is always derived from `classifyNotificationPermissionView`
 * (`notification-permission.ts`) on `loaded` and `permission-changed`, so
 * the screen never grows a second vocabulary for the same three
 * permission states. `toggle-*` and `test-*` events are no-ops (return
 * `state` unchanged) unless the current `kind` is `"enabled"` — the exact
 * guard-then-return-unchanged-state idiom `google-settings.ts`'s
 * `case "toggle-calendar"` already uses, and what makes AC-9's "no control
 * that would silently do nothing" on the `blocked` state structural rather
 * than a component-level convention: `blocked` carries no togglable field
 * at all.
 */

import {
  classifyNotificationPermissionView,
  type NotificationPermissionValue,
} from "./notification-permission";

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

export const INITIAL_NOTIFICATIONS_SETTINGS_STATE: NotificationsSettingsState = {
  kind: "loading",
};

export type NotificationsSettingsEvent =
  | { type: "loaded"; permission: NotificationPermissionValue; subscribed?: boolean }
  | { type: "load-failed"; reason: string | null }
  | { type: "request-start" }
  | { type: "permission-changed"; permission: NotificationPermissionValue; subscribed?: boolean }
  | { type: "toggle-start" }
  | { type: "toggle-succeeded"; subscribed: boolean }
  | { type: "toggle-failed"; message: string }
  | { type: "test-start" }
  | { type: "test-succeeded"; message: string }
  | { type: "test-failed"; message: string };

/** A fresh `enabled` state, carrying only `subscribed` forward. */
function enabledState(subscribed: boolean): NotificationsSettingsState {
  return {
    kind: "enabled",
    subscribed,
    togglingSubscription: false,
    subscriptionError: null,
    sendingTest: false,
    testResult: null,
  };
}

/**
 * Reclassifies a permission into one of the three screen kinds. For
 * `enabled`, an explicit `subscribed` on the event always wins; otherwise
 * the prior state's own `subscribed` is carried forward when it was already
 * `enabled`, else defaults to `false` — never inventing a truth it was not
 * told.
 */
function classify(
  priorState: NotificationsSettingsState,
  permission: NotificationPermissionValue,
  subscribed: boolean | undefined,
): NotificationsSettingsState {
  const view = classifyNotificationPermissionView(permission);
  if (view === "explainer") return { kind: "explainer", requesting: false };
  if (view === "blocked") return { kind: "blocked" };
  const resolvedSubscribed =
    subscribed !== undefined
      ? subscribed
      : priorState.kind === "enabled"
        ? priorState.subscribed
        : false;
  return enabledState(resolvedSubscribed);
}

export function reduceNotificationsSettings(
  state: NotificationsSettingsState,
  event: NotificationsSettingsEvent,
): NotificationsSettingsState {
  switch (event.type) {
    case "loaded":
      return classify(state, event.permission, event.subscribed);
    case "load-failed":
      return { kind: "failed", reason: event.reason };
    case "request-start":
      return state.kind === "explainer" ? { ...state, requesting: true } : state;
    case "permission-changed":
      return classify(state, event.permission, event.subscribed);
    case "toggle-start":
      return state.kind === "enabled" ? { ...state, togglingSubscription: true } : state;
    case "toggle-succeeded":
      return state.kind === "enabled"
        ? {
            ...state,
            subscribed: event.subscribed,
            togglingSubscription: false,
            subscriptionError: null,
          }
        : state;
    case "toggle-failed":
      return state.kind === "enabled"
        ? { ...state, togglingSubscription: false, subscriptionError: event.message }
        : state;
    case "test-start":
      return state.kind === "enabled" ? { ...state, sendingTest: true } : state;
    case "test-succeeded":
      return state.kind === "enabled"
        ? { ...state, sendingTest: false, testResult: { ok: true, message: event.message } }
        : state;
    case "test-failed":
      return state.kind === "enabled"
        ? { ...state, sendingTest: false, testResult: { ok: false, message: event.message } }
        : state;
  }
}
