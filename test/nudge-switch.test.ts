// PRPs/prds/repeated-miss-nudge.prd.md AC-15 The switch (visibility, pt-BR copy,
// persisted body)
// PRPs/prds/repeated-miss-nudge.prd.md AC-16 Visible copy (vocabulary half; the
// UI/UX checklist itself is a manual record, not a test)
//
// Source plan: PRPs/plans/repeated-miss-nudge-phase-4-the-switch-and-the-proof.plan.md
// (Task 3 - src/shared/nudge-switch.ts; plan AC-A1, AC-A2 body half).
//
// Pure, DOM-free, clock-free. Test-first: the module does not exist yet, so this
// file is RED for the right reason (module-not-found on the import). The React
// glue (hook, TaskSheet) is verified manually per docs/context/methodology.md.

import { describe, expect, it } from "vitest";
import { NUDGE_THRESHOLD } from "../src/shared/nudge";
import { NUDGE_MUTED_LABEL, nudgePatch, nudgeSwitchView } from "../src/shared/nudge-switch";

const FORBIDDEN = /falha|falhando|pulada/i;

describe("NUDGE_MUTED_LABEL (AC-15)", () => {
  it("is 'Avisos silenciados'", () => {
    expect(NUDGE_MUTED_LABEL).toBe("Avisos silenciados");
  });
});

describe("nudgeSwitchView - visibility (AC-15)", () => {
  it("is absent while the series has not loaded", () => {
    expect(nudgeSwitchView(null)).toBeNull();
  });

  it("is absent for an ended series, muted or not", () => {
    expect(nudgeSwitchView({ status: "ended", nudgeMuted: false })).toBeNull();
    expect(nudgeSwitchView({ status: "ended", nudgeMuted: true })).toBeNull();
  });

  it("is present for an active series, muted or not", () => {
    expect(nudgeSwitchView({ status: "active", nudgeMuted: false })).not.toBeNull();
    expect(nudgeSwitchView({ status: "active", nudgeMuted: true })).not.toBeNull();
  });
});

describe("nudgeSwitchView - state and copy (AC-15)", () => {
  it("reads 'notify me': on and 'Avisos ativos' when the series is not muted", () => {
    expect(nudgeSwitchView({ status: "active", nudgeMuted: false })).toEqual({
      label: "Avisar após 3 não concluídas seguidas",
      checked: true,
      statusText: "Avisos ativos para esta série.",
    });
  });

  it("is off and says the Reminders stay normal when the series is muted", () => {
    expect(nudgeSwitchView({ status: "active", nudgeMuted: true })).toEqual({
      label: "Avisar após 3 não concluídas seguidas",
      checked: false,
      statusText: "Avisos silenciados. Seus lembretes continuam normais.",
    });
  });

  it("states the nudge threshold the cron uses", () => {
    expect(NUDGE_THRESHOLD).toBe(3);
    const view = nudgeSwitchView({ status: "active", nudgeMuted: false });
    expect(view?.label).toContain(String(NUDGE_THRESHOLD));
  });

  it("never uses the forbidden vocabulary or a percentage in any string", () => {
    for (const nudgeMuted of [false, true]) {
      const view = nudgeSwitchView({ status: "active", nudgeMuted });
      for (const text of [view?.label ?? "", view?.statusText ?? ""]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(FORBIDDEN);
        expect(text).not.toContain("%");
      }
    }
    expect(NUDGE_MUTED_LABEL).not.toMatch(FORBIDDEN);
  });
});

describe("nudgePatch (AC-15 persisted body)", () => {
  it("turning the switch off sends exactly { nudgeMuted: true }", () => {
    expect(nudgePatch(false)).toEqual({ nudgeMuted: true });
  });

  it("turning the switch on sends exactly { nudgeMuted: false }", () => {
    expect(nudgePatch(true)).toEqual({ nudgeMuted: false });
  });

  it("carries no other key (never part of the Task draft, rule or template)", () => {
    expect(Object.keys(nudgePatch(true))).toEqual(["nudgeMuted"]);
    expect(Object.keys(nudgePatch(false))).toEqual(["nudgeMuted"]);
  });
});
