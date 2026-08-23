// PRPs/prds/ui-design-pass.prd.md AC-10 complete-with-undo (the toast half: "persists
// until used, dismissed or replaced by the next toast")
// PRPs/prds/ui-design-pass.prd.md AC-15 update-toast (the toast half: "Depois dismisses
// it for the session")
//
// Source plan: PRPs/plans/ui-design-pass-phase-2-today-screen.plan.md
// (Task 1 — src/shared/toast.ts: TOAST_AUTO_DISMISS_MS, ToastSpec, ToastState,
// INITIAL_TOAST_STATE, ToastEvent, autoDismisses, reduceToast; plan AC-A13).
//
// This is a pure, DOM-free unit under test (src/shared/toast.ts must stay
// environment-agnostic and dual-compiled into both the browser and Worker targets —
// tsconfig.test.json's `include` lists `test`, `src/worker`, `src/shared` but NOT
// `src/app`). It needs neither the D1 fixture nor the bearer-token auth helpers,
// mirroring test/connectivity.test.ts's shape. The 4 s timer, the React subscription
// and the buttons live in src/app/toast-store.ts and the Toast component — the exempt
// glue under docs/context/methodology.md's "Browser-API work" rule; this suite never
// fakes a timer, it hands the reducer the `expire` event the timer would send.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/toast.ts does not exist yet, so this file is expected to be RED for the
// right reason (module-not-found on the import below) until plan Task 1 is
// implemented. The discriminating cases once it exists: an `expire` for a toast that
// carries an action is a no-op (a "clear on any expire" reducer fails), `show` of a
// remembered key is ignored (a reducer without the suppressed list fails), and a new
// toast always replaces the current one (a queueing reducer fails).

import { describe, expect, it } from "vitest";
import {
  INITIAL_TOAST_STATE,
  TOAST_AUTO_DISMISS_MS,
  autoDismisses,
  reduceToast,
} from "../src/shared/toast";
import type { ToastSpec, ToastState } from "../src/shared/toast";

const saved: ToastSpec = { key: "task-saved", text: "Tarefa salva" };
const done: ToastSpec = {
  key: "task-done",
  text: "Tarefa concluída",
  action: { label: "Desfazer" },
};
const update: ToastSpec = {
  key: "sw-update",
  text: "Nova versão disponível",
  action: { label: "Atualizar" },
  secondary: { label: "Depois" },
};
const failure: ToastSpec = {
  key: "task-error",
  tone: "error",
  text: "Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.",
};

function showing(toast: ToastSpec, suppressed: readonly string[] = []): ToastState {
  return { current: toast, suppressed };
}

describe("toast constants and shape (PRD AC-10, AC-15 — plan AC-A13)", () => {
  it("auto-dismisses after 4 s — the guidelines §8 figure", () => {
    expect(TOAST_AUTO_DISMISS_MS).toBe(4000);
  });

  it("starts with no toast and nothing remembered", () => {
    expect(INITIAL_TOAST_STATE).toEqual({ current: null, suppressed: [] });
  });
});

describe("autoDismisses (PRD AC-10 — a toast with an action persists)", () => {
  it("is true for a toast without an action, even one with a secondary button", () => {
    expect(autoDismisses(saved)).toBe(true);
    expect(autoDismisses(failure)).toBe(true);
    expect(autoDismisses({ key: "x", text: "x", secondary: { label: "Depois" } })).toBe(true);
  });

  it("is false for a toast with an action (Desfazer, Atualizar)", () => {
    expect(autoDismisses(done)).toBe(false);
    expect(autoDismisses(update)).toBe(false);
  });
});

describe("reduceToast — show (one toast at a time)", () => {
  it("shows a toast when nothing is showing", () => {
    expect(reduceToast(INITIAL_TOAST_STATE, { type: "show", toast: saved })).toEqual(
      showing(saved),
    );
  });

  it("replaces the current toast with the new one — never a queue", () => {
    const next = reduceToast(showing(done), { type: "show", toast: saved });
    expect(next.current).toEqual(saved);
  });

  it("replaces a persistent toast too: a new toast is 'the next navigation' of §8", () => {
    const next = reduceToast(showing(update), { type: "show", toast: done });
    expect(next.current).toEqual(done);
  });

  it("ignores a show whose key was remembered, leaving the state untouched", () => {
    const state = showing(saved, ["sw-update"]);
    expect(reduceToast(state, { type: "show", toast: update })).toBe(state);
  });

  it("keeps the remembered keys when showing another toast", () => {
    const remembered: ToastState = { current: null, suppressed: ["sw-update"] };
    const next = reduceToast(remembered, { type: "show", toast: saved });
    expect(next.current).toEqual(saved);
    expect(next.suppressed).toEqual(["sw-update"]);
  });
});

describe("reduceToast — expire (the 4 s timer's event)", () => {
  it("clears a toast without an action when its key matches", () => {
    expect(reduceToast(showing(saved), { type: "expire", key: "task-saved" }).current).toBeNull();
  });

  it("does NOT clear a toast with an action — Desfazer persists until used or dismissed", () => {
    const state = showing(done);
    expect(reduceToast(state, { type: "expire", key: "task-done" })).toBe(state);
  });

  it("ignores an expire for a stale key (the previous toast's timer)", () => {
    const state = showing(failure);
    expect(reduceToast(state, { type: "expire", key: "task-saved" })).toBe(state);
  });

  it("ignores an expire when nothing is showing", () => {
    expect(reduceToast(INITIAL_TOAST_STATE, { type: "expire", key: "task-saved" })).toBe(
      INITIAL_TOAST_STATE,
    );
  });
});

describe("reduceToast — dismiss (used, closed, or Depois)", () => {
  it("clears the current toast when the key matches", () => {
    expect(reduceToast(showing(done), { type: "dismiss", key: "task-done" }).current).toBeNull();
  });

  it("leaves a different current toast alone", () => {
    const state = showing(done);
    expect(reduceToast(state, { type: "dismiss", key: "task-saved" }).current).toEqual(done);
  });

  it("remembers the key when asked, so the same toast is not shown again in the session", () => {
    const afterDepois = reduceToast(showing(update), {
      type: "dismiss",
      key: "sw-update",
      remember: true,
    });
    expect(afterDepois.current).toBeNull();
    expect(afterDepois.suppressed).toEqual(["sw-update"]);
    expect(reduceToast(afterDepois, { type: "show", toast: update }).current).toBeNull();
  });

  it("remembers a key at most once", () => {
    const once = reduceToast(showing(update), {
      type: "dismiss",
      key: "sw-update",
      remember: true,
    });
    const twice = reduceToast(once, { type: "dismiss", key: "sw-update", remember: true });
    expect(twice.suppressed).toEqual(["sw-update"]);
  });

  it("remembers the key even when that toast is not the current one", () => {
    const next = reduceToast(showing(saved), { type: "dismiss", key: "sw-update", remember: true });
    expect(next.current).toEqual(saved);
    expect(next.suppressed).toEqual(["sw-update"]);
  });

  it("does not remember a key on a plain dismiss", () => {
    expect(reduceToast(showing(done), { type: "dismiss", key: "task-done" }).suppressed).toEqual(
      [],
    );
  });
});

describe("reduceToast — the two sequences the screen relies on", () => {
  it("Desfazer: completed toast survives the timer, then is dismissed by use", () => {
    let state = reduceToast(INITIAL_TOAST_STATE, { type: "show", toast: done });
    state = reduceToast(state, { type: "expire", key: "task-done" });
    expect(state.current).toEqual(done);
    state = reduceToast(state, { type: "dismiss", key: "task-done" });
    expect(state.current).toBeNull();
  });

  it("Depois: the update toast is remembered for the session but other toasts still show", () => {
    let state = reduceToast(INITIAL_TOAST_STATE, { type: "show", toast: update });
    state = reduceToast(state, { type: "dismiss", key: "sw-update", remember: true });
    state = reduceToast(state, { type: "show", toast: update });
    expect(state.current).toBeNull();
    state = reduceToast(state, { type: "show", toast: saved });
    expect(state.current).toEqual(saved);
    expect(state.suppressed).toEqual(["sw-update"]);
  });

  it("never mutates the state or the toast it is given", () => {
    const state: ToastState = Object.freeze({ current: done, suppressed: Object.freeze([]) });
    const toast: ToastSpec = Object.freeze({ ...saved });
    expect(() => reduceToast(state, { type: "show", toast })).not.toThrow();
    expect(() =>
      reduceToast(state, { type: "dismiss", key: "task-done", remember: true }),
    ).not.toThrow();
    expect(state.current).toEqual(done);
    expect(state.suppressed).toEqual([]);
  });
});
