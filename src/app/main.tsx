import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { parseShareTarget, type ShareTarget } from "../shared/share-target";
import { App } from "./App";
import { setupPwa } from "./pwa";
import { requestPersistentStorage } from "./token-storage";

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

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
    // Replace with real UI (toast/snackbar) later.
    if (window.confirm("A new version is available. Update now?")) void update();
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
