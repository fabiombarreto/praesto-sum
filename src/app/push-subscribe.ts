/**
 * The thin, exempt adapter (`docs/context/methodology.md`, "Browser-API
 * work: split the logic out, then the glue is exempt") — the only file in
 * this phase calling `navigator.serviceWorker` or `PushManager` directly.
 * No decision lives in this file: every branch belongs in
 * `src/shared/notifications-settings.ts`; this file only performs the
 * calls.
 */

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
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
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

/**
 * Unsubscribes locally FIRST, then returns the endpoint for the caller to
 * `DELETE` server-side — if the `DELETE` itself fails (e.g. offline), the
 * row is not orphaned forever: the next `POST /api/push/test` dispatch
 * against a locally-unsubscribed endpoint gets a `410` from the push
 * service, and phase 2's existing `gone`-pruning
 * (`src/worker/routes/push.ts`'s `POST /test` handler) removes it — the
 * channel self-heals through code that already exists, per ADR-0003's
 * data-safety posture.
 */
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
