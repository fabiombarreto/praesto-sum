import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { parseShareTarget, type ShareTarget } from "../shared/share-target";
import { App } from "./App";
import { setupPwa } from "./pwa";
import { requestPersistentStorage } from "./token-storage";
import { showToast } from "./toast-store";

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

if (import.meta.env.DEV && window.location.pathname === "/design") {
  // Dev-only token/state playground (PRD AC-20). The dynamic import is what
  // keeps DesignPlayground's module graph out of the production bundle —
  // `import.meta.env.DEV` alone is statically replaced with `false` and the
  // whole branch is tree-shaken at build time, but a STATIC import of the
  // component would still have pulled its module graph into the shared
  // chunk graph before tree-shaking runs. Returns before App, setupPwa and
  // the token-persistence request below, none of which the playground needs.
  const { DesignPlayground } = await import("./components/DesignPlayground");
  document.title = "Design · Praesto Sum";
  createRoot(container).render(
    <StrictMode>
      <DesignPlayground />
    </StrictMode>,
  );
} else {
  mountApp(container);
}

function mountApp(container: HTMLElement) {
  // Detect a share-target invocation (public/manifest.webmanifest's
  // `share_target` GET action) before the first render. The path/query is
  // stripped immediately via `replaceState` so a page reload does not
  // re-trigger the pre-fill or resubmit stale params.
  let initialShare: ShareTarget | null = null;
  if (window.location.pathname === "/share-target") {
    initialShare = parseShareTarget(window.location.search);
    window.history.replaceState(null, "", "/");
  } else if (window.location.pathname === "/new-task") {
    // Launcher shortcut (public/manifest.webmanifest's `shortcuts` entry)
    // carries no payload, only intent, so there is nothing to parse —
    // `initialShare` stays `null`, which is what seeds TaskBoard's `title`
    // to "". Strip the path the same way `/share-target` does above.
    window.history.replaceState(null, "", "/");
  }

  createRoot(container).render(
    <StrictMode>
      <App initialShare={initialShare} />
    </StrictMode>,
  );

  // Registered after render so it does not compete with first paint.
  setupPwa({
    onNeedRefresh(update) {
      showToast({
        key: "sw-update",
        text: "Nova versão disponível",
        action: { label: "Atualizar", run: () => void update() },
        secondary: { label: "Depois" },
      });
    },
    onOfflineReady() {
      console.info("[pwa] ready for offline use");
    },
  });

  // Best-effort and never awaited: a slow or denied persist() must not
  // compete with first paint or gate the token read above. A denial
  // degrades to unprotected IndexedDB, which is still no worse than the
  // localStorage this phase moves away from.
  void requestPersistentStorage();
}
