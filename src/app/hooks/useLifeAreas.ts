import { useEffect, useRef, useState } from "react";
import type { LifeAreaSummaryDto } from "../../shared/api";
import { ApiError, fetchLifeAreas } from "../api";

/**
 * The owner's Life Areas, held in their OWN atom — never folded into the Task
 * list, `busy`, an error state or the offline reducer — so a failed or slow
 * request can neither blank the list nor be mistaken for "no areas": `null` means
 * unknown or failed, `[]` means he has none, and `decideAreaGroup`
 * (`src/shared/life-area-assign.ts`) tells the two apart.
 *
 * Shared by *Hoje* and the search screen so the two sheets and the two row lists
 * cannot drift, as `useSeriesSheet` states for its own two callers.
 *
 * Failure is absence by design (life-areas PRD AC-22): a failed request leaves
 * `null`, the rows show no name, the sheet offers no group, and nothing is
 * announced — no banner, no toast, no error state. The Task list never waits for
 * it. Only the newest request may write, so a slow older response cannot overwrite
 * fresher data; a 401 routes to the token gate like every other request.
 *
 * It loads on mount and whenever the document returns to the foreground
 * (guidelines §12.4: there is no manual refresh gesture); the caller may also call
 * `refresh` itself, as *Hoje* does when the connection comes back.
 */
export function useLifeAreas(onUnauthorized: () => void): {
  lifeAreas: readonly LifeAreaSummaryDto[] | null;
  refresh: () => Promise<void>;
} {
  const [lifeAreas, setLifeAreas] = useState<LifeAreaSummaryDto[] | null>(null);
  const latestRequest = useRef(0);

  async function refresh(): Promise<void> {
    const mine = ++latestRequest.current;
    try {
      const response = await fetchLifeAreas();
      if (mine === latestRequest.current) setLifeAreas(response.lifeAreas);
    } catch (cause) {
      if (mine !== latestRequest.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setLifeAreas(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return { lifeAreas, refresh };
}
