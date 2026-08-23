/**
 * The pure toast rules — one toast slot for the whole app (PRD AC-10,
 * AC-15). Total and side-effect free: it never touches a timer or the DOM,
 * it only reduces the `show` / `dismiss` / `expire` events it is handed.
 *
 * Like `src/shared/connectivity.ts`, this module is compiled into BOTH the
 * browser and the Worker projects, so it stays environment-agnostic: no DOM
 * globals and no scheduled callback of its own. The 4 s auto-dismiss clock
 * lives in `src/app/toast-store.ts` (the exempt glue under
 * `docs/context/methodology.md`'s "Browser-API work" rule) — it arms one
 * `TOAST_AUTO_DISMISS_MS` wait and hands this reducer the `expire` event
 * when it elapses; this module never starts, cancels or knows about that
 * wait itself.
 *
 * `key` is what lets a toast be found again later: `dismiss` with
 * `remember: true` on a key appends it to `suppressed`, so a later `show`
 * of the same key is silently ignored for the rest of the session — the
 * rule that makes the update toast's *Depois* stick (`dismiss` with
 * `remember: true` on key `"sw-update"`).
 *
 * `action.run` / `secondary.run` are opaque callbacks the reducer never
 * calls, inspects or requires — only `autoDismisses` reads whether `action`
 * is present at all, never what it does.
 *
 * Rules encoded here:
 * - `show`: a toast whose key is in `suppressed` is ignored, state
 *   unchanged; otherwise the new toast always REPLACES the current one —
 *   never a queue, whatever kind either toast is.
 * - `expire` (the auto-dismiss timer's event): clears the current toast
 *   only when its key matches AND `autoDismisses` is true for it — a toast
 *   with an action (*Desfazer*, *Atualizar*) persists until used or
 *   dismissed, so an expiry for it, for a stale key or for no toast is a
 *   no-op.
 * - `dismiss` (used, closed, or *Depois*): clears the current toast only
 *   when its key matches; with `remember: true` the key is appended to
 *   `suppressed` (idempotent — never appended twice) whether or not that
 *   toast was current.
 *
 * The function never mutates `state`, `state.suppressed` or the `ToastSpec`
 * it is given, and always returns a `ToastState` — the SAME state object
 * when nothing changes (a suppressed `show`, a no-op `expire`), so a caller
 * fed through `useSyncExternalStore` never re-renders for a no-op event.
 */

export interface ToastAction {
  label: string;
  run?: () => void;
}

export interface ToastSpec {
  key: string;
  text: string;
  tone?: "info" | "error";
  action?: ToastAction;
  secondary?: ToastAction;
}

export interface ToastState {
  current: ToastSpec | null;
  suppressed: readonly string[];
}

export const TOAST_AUTO_DISMISS_MS = 4000;

export const INITIAL_TOAST_STATE: ToastState = { current: null, suppressed: [] };

export type ToastEvent =
  | { type: "show"; toast: ToastSpec }
  | { type: "dismiss"; key: string; remember?: boolean }
  | { type: "expire"; key: string };

/** True only when `toast` carries no `action` — a toast with an action persists until used, dismissed or replaced (guidelines §8). */
export function autoDismisses(toast: ToastSpec): boolean {
  return toast.action === undefined;
}

export function reduceToast(state: ToastState, event: ToastEvent): ToastState {
  switch (event.type) {
    case "show": {
      if (state.suppressed.includes(event.toast.key)) return state;
      return { current: event.toast, suppressed: state.suppressed };
    }
    case "dismiss": {
      const current =
        state.current !== null && state.current.key === event.key ? null : state.current;
      if (event.remember !== true) return { current, suppressed: state.suppressed };
      const suppressed = state.suppressed.includes(event.key)
        ? state.suppressed
        : [...state.suppressed, event.key];
      return { current, suppressed };
    }
    case "expire": {
      if (state.current === null) return state;
      if (state.current.key !== event.key) return state;
      if (!autoDismisses(state.current)) return state;
      return { current: null, suppressed: state.suppressed };
    }
  }
}
