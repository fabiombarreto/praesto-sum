/**
 * The pure connectivity state machine the offline banner and the capture
 * deck read from (PRD AC-7). Total and side-effect free: it never touches a
 * browser API or a timer — it only reduces the events it is handed.
 *
 * Like `src/shared/dates.ts` and `src/shared/format.ts`, this module is
 * compiled into BOTH the browser and the Worker projects, so it stays
 * environment-agnostic: no DOM globals, no runtime dependencies.
 *
 * Why two signal kinds feed the same reducer: the browser's own online/
 * offline flag alone misses an unreachable server — the browser can report a
 * live link while the Worker itself is down or the phone sits behind a
 * captive portal; a failed request alone misses airplane mode, because
 * nothing then tells the reducer the browser itself went offline between
 * requests. Phase 2's `useConnectivity()` hook is the only caller that ever
 * touches those browser connectivity events and the request outcomes this
 * reducer consumes — this module is the decidable half of that exempt glue
 * (`docs/context/methodology.md`, "Browser-API work: split the logic out,
 * then the glue is exempt").
 *
 * Transition rules:
 * - `browser-offline` -> `offline`, `browser-online` -> `online`, from any
 *   state — the browser's own signal always wins for itself.
 * - `request-failed` with `kind: "server-unreachable"` -> `unreachable`,
 *   UNLESS the state is already `offline`, which wins: airplane mode already
 *   explains every failed request, and "unreachable" would be a less honest
 *   read of the same fact.
 * - `request-failed` with `kind: "http-error"` leaves the state unchanged —
 *   the server answered, so connectivity itself is not in question.
 * - `request-succeeded` -> `online`, from any state.
 */

import type { RequestFailure } from "./request-failure";

export type ConnectivityState = "online" | "offline" | "unreachable";

export type ConnectivityEvent =
  | { type: "browser-online" }
  | { type: "browser-offline" }
  | { type: "request-failed"; kind: RequestFailure["kind"] }
  | { type: "request-succeeded" };

export function reduceConnectivity(
  state: ConnectivityState,
  event: ConnectivityEvent,
): ConnectivityState {
  switch (event.type) {
    case "browser-offline":
      return "offline";
    case "browser-online":
      return "online";
    case "request-succeeded":
      return "online";
    case "request-failed":
      if (event.kind === "http-error") return state;
      // server-unreachable: offline wins — airplane mode already explains
      // every failed request, so a request outcome must never override it.
      return state === "offline" ? "offline" : "unreachable";
  }
}

/** Writes (capture, complete, save, delete) are allowed only when fully `online`. */
export function canWrite(state: ConnectivityState): boolean {
  return state === "online";
}
