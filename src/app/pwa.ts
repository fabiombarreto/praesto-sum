import { registerSW } from "virtual:pwa-register";

export interface PwaHandlers {
  /** An update is waiting. Call the supplied `update()` to apply it. */
  onNeedRefresh: (update: () => Promise<void>) => void;
  onOfflineReady: () => void;
}

export function setupPwa({ onNeedRefresh, onOfflineReady }: PwaHandlers): void {
  // `devOptions` is disabled in vite.config.ts, so no service worker exists
  // during `vite dev` — registering there only produces a failed request and a
  // console error. Exercise the real PWA (install prompt, precache, push) with
  // `npm run preview`, which serves the production build.
  if (!import.meta.env.PROD) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      onNeedRefresh(() => updateSW());
    },
    onOfflineReady,
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return;
      // A standalone PWA can stay open for weeks and the browser only checks the
      // SW on navigation. Hourly polling is what makes a deploy actually land.
      setInterval(() => void registration.update(), 3600000);
    },
    onRegisterError(error) {
      console.error("[pwa] service worker registration failed", error);
    },
  });

  // Deep-link handling for notificationclick (see src/sw.ts).
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string } | undefined;
    if (data?.type === "NOTIFICATION_CLICK" && data.url) {
      window.history.pushState({}, "", data.url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  });
}
