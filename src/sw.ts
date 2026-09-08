/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

import {
  parsePushPayload,
  fallbackPushPayload,
  resolvePushNotificationOptions,
  type PushPayload,
} from "./shared/push-payload-parse";

declare const self: ServiceWorkerGlobalScope;

// --- Precache -------------------------------------------------------------
// `self.__WB_MANIFEST` is replaced at build time by vite-plugin-pwa. Its type
// comes from workbox-precaching's global augmentation — no manual declaration.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback served from the precached index.html.
// The /api/ denylist is mandatory: without it a navigation to /api/... would be
// answered from the cached HTML and the API would silently stop responding.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }),
);

// --- Update flow (registerType: 'prompt') ---------------------------------
// workbox-window posts { type: 'SKIP_WAITING' } when the user accepts the
// update prompt. With injectManifest this listener is NOT injected for you —
// omit it and the "Update" button does nothing, with no console error.
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data: unknown = event.data;
  if (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "SKIP_WAITING"
  ) {
    void self.skipWaiting();
  }
});

// --- Web Push -------------------------------------------------------------
// This is the thin, exempt adapter (`docs/context/methodology.md`,
// "Browser-API work"): the `event.data.json()`/`event.data.text()`
// try-catch and nothing else. Every shaping decision — fallback defaults,
// the nested `{data: {route}}` parse — lives in
// `src/shared/push-payload-parse.ts`.
function parsePush(event: PushEvent): PushPayload {
  if (!event.data) return fallbackPushPayload();
  try {
    return parsePushPayload(event.data.json());
  } catch {
    return fallbackPushPayload(event.data.text());
  }
}

self.addEventListener("push", (event: PushEvent) => {
  const payload = parsePush(event);
  // showNotification MUST be awaited inside waitUntil, otherwise the browser
  // shows the generic "site updated in the background" notice — and Chrome can
  // revoke push permission if that happens repeatedly.
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      ...resolvePushNotificationOptions(payload),
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  // `resolvePushNotificationOptions` guarantees `data.route` is always a
  // resolved string by the time it reaches `showNotification`, so there is
  // nothing left to fall back on here.
  const data = event.notification.data as { route: string };
  const target = new URL(data.route, self.location.origin);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (new URL(client.url).origin !== target.origin) continue;
        await client.focus();
        // The SPA listens for this message and navigates client-side.
        client.postMessage({ type: "NOTIFICATION_CLICK", url: target.pathname + target.search });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

clientsClaim();
