/**
 * The decidable load-orchestration logic for the *Notificações* card (PRD
 * AC-9, plan AC-A1), extracted out of `NotificationsCard.tsx`'s mount effect
 * per `docs/context/methodology.md`'s "Browser-API work" rule — the same
 * "extract the decidable part behind a port, taking dependencies as
 * arguments rather than reading them from the global scope" move already
 * applied once for `src/shared/push-payload-parse.ts`.
 *
 * This is the fix for a real defect the UI/UX guidelines review checklist
 * found on the live `/settings/notifications` screen: the card's mount
 * effect awaited `getCurrentDeviceEndpoint()` (which itself awaits
 * `navigator.serviceWorker.ready` — a promise that can hang forever and
 * never rejects) BEFORE dispatching any state at all, so with zero
 * service-worker registrations the card's loading skeleton rendered
 * indefinitely. AC-9's "bloqueadas" state (`denied`) and the explainer state
 * (`default`) never need a subscription result at all, so they must reach
 * the reducer synchronously, before any `await` — that is the ordering
 * property this module exists to guarantee. Only `granted` genuinely needs
 * the subscription-check port's result, so only `granted` awaits it; a
 * rejecting port is routed through the existing `toggle-failed` event so the
 * `enabled` view stays actionable rather than getting stuck.
 */

import type { NotificationPermissionValue } from "./notification-permission";
import type { NotificationsSettingsEvent } from "./notifications-settings";

export async function loadNotificationsSettings(
  permission: NotificationPermissionValue,
  checkSubscribed: () => Promise<boolean>,
  dispatch: (event: NotificationsSettingsEvent) => void,
): Promise<void> {
  dispatch({ type: "loaded", permission });
  if (permission !== "granted") return;
  try {
    const subscribed = await checkSubscribed();
    dispatch({ type: "permission-changed", permission, subscribed });
  } catch {
    dispatch({ type: "toggle-failed", message: "Não foi possível verificar a inscrição." });
  }
}
