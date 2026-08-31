import { useEffect, useState } from "react";
import type { ShareTarget } from "../shared/share-target";
import { readToken } from "./api";
import { SettingsScreen } from "./components/SettingsScreen";
import { TodayScreen } from "./components/TodayScreen";
import { TokenGate, type TokenGateReason } from "./components/TokenGate";
import { Skeleton } from "./components/ui/Skeleton";
import { useRoute } from "./hooks/useRoute";

/**
 * The token-gate switch — everything else lives in `TodayScreen` (A5),
 * `SettingsScreen` (unit 4 phase 5), `TokenGate` (A5 phase 3) and their
 * shared `src/app/components/ui/`.
 *
 * It exists to prove the whole stack end to end (PWA → Worker → D1) and to be
 * the surface the remaining Phase 1 requirements grow into — recurrence
 * (FR-009), misses (FR-011/FR-012), reminders (FR-041/FR-044), search (FR-040).
 */
export function App({ initialShare }: { initialShare: ShareTarget | null }) {
  // `null` = still checking IndexedDB for a stored token. `readToken()` is
  // async (the token now lives behind src/shared/token-store.ts), so this
  // starts as "unknown" rather than assuming unauthorized.
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  // Why the gate is showing again — set on a 401 route from `TodayScreen` or
  // `SettingsScreen`, cleared once a fresh token is saved.
  const [gateReason, setGateReason] = useState<TokenGateReason>(null);
  // Called unconditionally, before either early return below, per the Rules
  // of Hooks — `route`/`navigate` are only READ once the gate has passed.
  const { route, navigate, back } = useRoute();

  useEffect(() => {
    let cancelled = false;
    void readToken()
      .then((token) => {
        if (!cancelled) setAuthorized(token !== null);
      })
      .catch(() => {
        // Unreachable by contract: `read()` guards every storage call and is
        // tested never to reject. Kept anyway because this is the app's one
        // unrecoverable state — an unhandled rejection here leaves `authorized`
        // at `null` forever, and the owner stares at the skeleton with no way
        // forward. Degrading to the token screen is always recoverable; a hang
        // never is. If a future change makes `read()` able to reject, this line
        // is what keeps that a bad afternoon instead of a dead app.
        if (!cancelled) setAuthorized(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authorized === null) {
    // Never render TokenGate while the read is still pending — doing so
    // would flash the token screen on every cold start, which is exactly
    // what AC-2 forbids.
    return <Skeleton />;
  }

  if (!authorized) {
    return (
      <TokenGate
        reason={gateReason}
        onAuthorized={() => {
          setGateReason(null);
          setAuthorized(true);
        }}
      />
    );
  }

  function onUnauthorized(): void {
    setGateReason("unauthorized");
    setAuthorized(false);
  }

  return route === "settings" ? (
    <SettingsScreen onUnauthorized={onUnauthorized} back={back} />
  ) : (
    <TodayScreen
      onUnauthorized={onUnauthorized}
      initialShare={initialShare}
      onOpenSettings={() => navigate("settings")}
    />
  );
}
