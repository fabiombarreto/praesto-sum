import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setupPwa } from "./pwa";

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

createRoot(container).render(
  <StrictMode>
    <App />
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
