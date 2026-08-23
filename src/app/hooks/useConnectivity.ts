import { useCallback, useEffect, useRef, useState } from "react";
import {
  reduceConnectivity,
  type ConnectivityEvent,
  type ConnectivityState,
} from "../../shared/connectivity";

/**
 * The exempt glue over `reduceConnectivity` (`docs/context/methodology.md`,
 * "Browser-API work: split the logic out, then the glue is exempt"): every
 * transition rule lives in `src/shared/connectivity.ts`; this hook only adds
 * the `window` `online` / `offline` listeners, the initial `navigator.onLine`
 * read, and `report`, which the screen feeds request outcomes through
 * (`request-succeeded`, `request-failed` with the `kind` from
 * `classifyRequestFailure`).
 */
export function useConnectivity(options?: { onOnline?: () => void }): {
  state: ConnectivityState;
  report: (event: ConnectivityEvent) => void;
} {
  const [state, setState] = useState<ConnectivityState>(() =>
    navigator.onLine ? "online" : "offline",
  );

  // A ref, not a dependency: `options` is typically a fresh object literal on
  // every render (see TodayScreen's `useConnectivity({ onOnline: … })`), so
  // depending on it would tear the listeners down and rebuild them every
  // render. The ref always reads the latest callback without that churn.
  const onOnlineRef = useRef(options?.onOnline);
  onOnlineRef.current = options?.onOnline;

  useEffect(() => {
    function handleOnline() {
      setState((current) => reduceConnectivity(current, { type: "browser-online" }));
      onOnlineRef.current?.();
    }
    function handleOffline() {
      setState((current) => reduceConnectivity(current, { type: "browser-offline" }));
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const report = useCallback((event: ConnectivityEvent) => {
    setState((current) => reduceConnectivity(current, event));
  }, []);

  return { state, report };
}
