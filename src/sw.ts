/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open on click, e.g. "/tasks/42". */
  url?: string;
  /** Collapse key: a newer notification with the same tag replaces the old one. */
  tag?: string;
}

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
// Optional fields are spread conditionally rather than passed as `undefined`,
// which is what keeps `exactOptionalPropertyTypes: true` viable project-wide.
function parsePush(event: PushEvent): PushPayload {
  const fallback: PushPayload = { title: "Praesto Sum", body: "Voce tem um lembrete." };
  if (!event.data) return fallback;
  try {
    const parsed = event.data.json() as Partial<PushPayload>;
    return {
      title: parsed.title ?? fallback.title,
      body: parsed.body ?? fallback.body,
      ...(parsed.url === undefined ? {} : { url: parsed.url }),
      ...(parsed.tag === undefined ? {} : { tag: parsed.tag }),
    };
  } catch {
    return { ...fallback, body: event.data.text() };
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
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: payload.url ?? "/" },
      ...(payload.tag === undefined ? {} : { tag: payload.tag }),
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const target = new URL(data?.url ?? "/", self.location.origin);

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
