/**
 * The decidable half of AC-9's two-step permission flow (PRD AC-9, plan
 * AC-A1): the browser's raw three-value `NotificationPermission` collapses
 * to exactly one of three screen-facing views. Like `cron-freshness.ts`,
 * this module is total, DOM-free and has no runtime dependency of its own.
 *
 * `permission-changed` events — fired from
 * `permissions.query({name:'notifications'}).onchange`, wired in
 * `NotificationsCard.tsx` (the exempt glue half of
 * `docs/context/methodology.md`'s "Browser-API work" split) — reuse this
 * exact classifier, so the screen never grows a second vocabulary for the
 * same three states.
 *
 * `NotificationPermissionValue` is this module's own type rather than the
 * ambient DOM `NotificationPermission`, because `src/shared/` is compiled
 * under the Worker/test `tsconfig` too (`lib: ["ES2022"]`, no DOM), like
 * every other environment-agnostic module here (`connectivity.ts`,
 * `toast.ts`). It is structurally identical to the DOM type's three values,
 * so a real `Notification.permission` read in `src/app/` (which does have
 * the DOM lib) is assignable here with no cast.
 */

export type NotificationPermissionValue = "default" | "denied" | "granted";
export type NotificationPermissionView = "explainer" | "blocked" | "enabled";

export function classifyNotificationPermissionView(
  permission: NotificationPermissionValue,
): NotificationPermissionView {
  if (permission === "granted") return "enabled";
  if (permission === "denied") return "blocked";
  return "explainer";
}
