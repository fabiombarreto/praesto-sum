import { useSyncExternalStore } from "react";
import {
  INITIAL_TOAST_STATE,
  TOAST_AUTO_DISMISS_MS,
  autoDismisses,
  reduceToast,
  type ToastEvent,
  type ToastSpec,
  type ToastState,
} from "../shared/toast";

/**
 * Module-level store over `reduceToast` (`docs/context/methodology.md`'s
 * exempt glue) — one toast slot the whole app shares, so `main.tsx`'s update
 * prompt and the *Hoje* screen's own toasts (saved, complete/undo, request
 * error) go through the same subscription without prop-drilling it through
 * the tree. Every RULE (one at a time, what persists, what is remembered)
 * lives in `src/shared/toast.ts`; this file owns only the 4 s auto-dismiss
 * timer and the `useSyncExternalStore` wiring.
 */

let state: ToastState = INITIAL_TOAST_STATE;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function dispatch(event: ToastEvent): void {
  const next = reduceToast(state, event);
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * Shows `toast`, replacing whatever is current (never a queue). When it
 * auto-dismisses, arms one `setTimeout` of `TOAST_AUTO_DISMISS_MS` that
 * dispatches `expire` for its key, clearing any previously armed timer
 * first. A `toast` whose key is suppressed for the session is a no-op —
 * nothing is shown and no timer is armed.
 */
export function showToast(toast: ToastSpec): void {
  const before = state;
  dispatch({ type: "show", toast });
  if (state === before) return;
  clearTimer();
  if (autoDismisses(toast)) {
    timer = setTimeout(() => {
      timer = null;
      dispatch({ type: "expire", key: toast.key });
    }, TOAST_AUTO_DISMISS_MS);
  }
}

/** Dismisses the toast with `key`; `remember` suppresses that key for the rest of the session (the *Depois* rule). */
export function dismissToast(key: string, remember = false): void {
  const wasCurrent = state.current !== null && state.current.key === key;
  dispatch({ type: "dismiss", key, remember });
  if (wasCurrent) clearTimer();
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns the SAME object until the state changes, as `useSyncExternalStore` requires. */
export function getToastSnapshot(): ToastState {
  return state;
}

export function useToast(): ToastState {
  return useSyncExternalStore(subscribeToast, getToastSnapshot);
}
