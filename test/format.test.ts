// PRPs/prds/ui-design-pass.prd.md AC-5 header-formatters
// PRPs/prds/ui-design-pass.prd.md AC-6 row-meta-formatter
//
// Source plan: PRPs/plans/ui-design-pass-phase-1-chrome-fonts-and-foundation.plan.md
// (Task 2 — src/shared/format.ts: formatRemaining, formatDayShort, formatHeaderDate and
// taskMetaLine; plan AC-A2 and AC-A3).
//
// This is a pure, DOM-free unit under test (src/shared/format.ts must stay
// environment-agnostic and dual-compiled into both the browser and Worker targets —
// tsconfig.test.json's `include` lists `test`, `src/worker`, `src/shared` but NOT
// `src/app`). It needs neither the D1 fixture nor the bearer-token auth helpers that
// test/tasks.test.ts uses, mirroring test/share-target.test.ts's shape.
//
// Determinism: `now` and `today` are ARGUMENTS of the functions under test — the plan
// forbids the module from reading the clock — so every expectation below is a fixed
// string. Calendar facts the fixtures rely on (checked against ICU 78 / CLDR 48):
// 2026-08-21 is a Friday (`sex.`), 2026-08-18 a Tuesday (`ter.`), 2026-08-22 a
// Saturday (`sáb.`), 2026-08-23 a Sunday (`dom.`), 2026-08-29 a Saturday.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/format.ts does not exist yet, so this file is expected to be RED for the
// right reason (module-not-found on the import below) until plan Task 2 is implemented.
// What carries the discrimination once the module exists is the content of the
// assertions: the zero-in-singular special case (CLDR maps 0 to `one` for pt-BR, so a
// PluralRules-driven label would read "restante"), the timezone case (01:00Z on the
// 22nd is still the 21st in São Paulo), the relative words across a month and a year
// boundary, and the closed-Task rules (done → null, missed → "não concluída").

import { describe, expect, it } from "vitest";
import type { TaskDto } from "../src/shared/api";
import {
  formatDayShort,
  formatHeaderDate,
  formatRemaining,
  taskMetaLine,
} from "../src/shared/format";

/** A minimal open, undated, unprioritised Task; override only what a case needs. */
function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-1",
    title: "Pagar aluguel",
    description: null,
    status: "open",
    deadline: null,
    scheduledDate: null,
    priority: null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    completedAt: null,
    createdAt: 0,
    ...overrides,
  };
}

const TODAY = "2026-08-21";

describe("formatRemaining (PRD AC-5 header-formatters)", () => {
  it("special-cases zero as 'nenhuma restante' with no figure", () => {
    // CLDR's pt rule is `i = 0..1`, so Intl.PluralRules("pt-BR").select(0) is "one";
    // a label derived from PluralRules alone would read "0 restante". Guidelines §9.4
    // require zero to be special-cased, and the header shows no figure for it.
    expect(formatRemaining(0)).toEqual({ figure: null, label: "nenhuma restante" });
  });

  it("uses the singular for exactly one", () => {
    expect(formatRemaining(1)).toEqual({ figure: "1", label: "restante" });
  });

  it("uses the plural from two on, carrying the figure as a string", () => {
    expect(formatRemaining(2)).toEqual({ figure: "2", label: "restantes" });
    expect(formatRemaining(4)).toEqual({ figure: "4", label: "restantes" });
    expect(formatRemaining(12)).toEqual({ figure: "12", label: "restantes" });
  });
});

describe("formatDayShort (PRD AC-5 header-formatters)", () => {
  it("renders a calendar day as the pt-BR short weekday, a comma, and dd/mm", () => {
    expect(formatDayShort("2026-08-21")).toBe("sex., 21/08");
    expect(formatDayShort("2026-08-18")).toBe("ter., 18/08");
  });

  it("keeps diacritics and zero-pads the day and the month", () => {
    expect(formatDayShort("2026-08-22")).toBe("sáb., 22/08");
    expect(formatDayShort("2026-01-04")).toBe("dom., 04/01");
  });

  it("ends the weekday with exactly one period whatever the ICU build emits", () => {
    for (const day of ["2026-08-17", "2026-08-19", "2026-08-20", "2026-08-23"]) {
      expect(formatDayShort(day)).toMatch(/^[a-záéíóúâêôãõç]{3}\., \d{2}\/\d{2}$/);
    }
  });

  it("is a calendar-day formatter: the same day string never shifts by timezone", () => {
    // A day is not an instant. Whatever zone the runtime sits in, 2026-08-21 is Friday.
    expect(formatDayShort("2026-08-21")).toBe(formatDayShort("2026-08-21"));
    expect(formatDayShort("2026-12-31")).toBe("qui., 31/12");
  });
});

describe("formatHeaderDate (PRD AC-5 header-formatters)", () => {
  it("formats the instant's calendar day in America/Sao_Paulo by default", () => {
    expect(formatHeaderDate(new Date("2026-08-21T15:00:00Z"))).toBe("sex., 21/08");
  });

  it("reads the day in the owner's zone, not UTC: 01:00Z on the 22nd is still Friday the 21st in São Paulo", () => {
    expect(formatHeaderDate(new Date("2026-08-22T01:00:00Z"))).toBe("sex., 21/08");
  });

  it("honours an explicit timezone argument", () => {
    expect(formatHeaderDate(new Date("2026-08-22T01:00:00Z"), "UTC")).toBe("sáb., 22/08");
  });
});

describe("taskMetaLine — deadlines (PRD AC-6 row-meta-formatter)", () => {
  it("names an overdue deadline with 'atrasada · venceu' and the short day, flagged overdue", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-18" }), TODAY)).toEqual({
      text: "atrasada · venceu ter., 18/08",
      overdue: true,
    });
  });

  it("says 'ontem' for a deadline that was yesterday", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-20" }), TODAY)).toEqual({
      text: "atrasada · venceu ontem",
      overdue: true,
    });
  });

  it("says 'até hoje' for a deadline today — due, not overdue", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-21" }), TODAY)).toEqual({
      text: "até hoje",
      overdue: false,
    });
  });

  it("says 'até amanhã' for a deadline tomorrow", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-22" }), TODAY)).toEqual({
      text: "até amanhã",
      overdue: false,
    });
  });

  it("uses the short day for any later deadline", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-23" }), TODAY)).toEqual({
      text: "até dom., 23/08",
      overdue: false,
    });
  });

  it("computes 'amanhã' across a month boundary on the calendar, not on day numbers", () => {
    expect(taskMetaLine(task({ deadline: "2026-09-01" }), "2026-08-31")).toEqual({
      text: "até amanhã",
      overdue: false,
    });
  });

  it("computes 'ontem' across a month boundary", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-31" }), "2026-09-01")).toEqual({
      text: "atrasada · venceu ontem",
      overdue: true,
    });
  });
});

describe("taskMetaLine — scheduled dates (PRD AC-6 row-meta-formatter)", () => {
  it("names a past scheduled date with 'atrasada · era para' and the short day, flagged overdue", () => {
    expect(taskMetaLine(task({ scheduledDate: "2026-08-18" }), TODAY)).toEqual({
      text: "atrasada · era para ter., 18/08",
      overdue: true,
    });
  });

  it("says 'ontem' for a scheduled date that was yesterday", () => {
    expect(taskMetaLine(task({ scheduledDate: "2026-08-20" }), TODAY)).toEqual({
      text: "atrasada · era para ontem",
      overdue: true,
    });
  });

  it("says 'fazer hoje' for a scheduled date today", () => {
    expect(taskMetaLine(task({ scheduledDate: "2026-08-21" }), TODAY)).toEqual({
      text: "fazer hoje",
      overdue: false,
    });
  });

  it("says 'fazer amanhã' for tomorrow", () => {
    expect(taskMetaLine(task({ scheduledDate: "2026-08-22" }), TODAY)).toEqual({
      text: "fazer amanhã",
      overdue: false,
    });
  });

  it("uses 'fazer' plus the short day for any later scheduled date", () => {
    expect(taskMetaLine(task({ scheduledDate: "2026-08-29" }), TODAY)).toEqual({
      text: "fazer sáb., 29/08",
      overdue: false,
    });
  });

  it("computes 'amanhã' across a year boundary", () => {
    expect(taskMetaLine(task({ scheduledDate: "2027-01-01" }), "2026-12-31")).toEqual({
      text: "fazer amanhã",
      overdue: false,
    });
  });
});

describe("taskMetaLine — priority words (PRD AC-6 row-meta-formatter)", () => {
  it("appends ' · alta' for a high priority after the date phrase", () => {
    expect(taskMetaLine(task({ scheduledDate: "2026-08-29", priority: "high" }), TODAY)).toEqual({
      text: "fazer sáb., 29/08 · alta",
      overdue: false,
    });
  });

  it("appends ' · baixa' for a low priority", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-23", priority: "low" }), TODAY)).toEqual({
      text: "até dom., 23/08 · baixa",
      overdue: false,
    });
  });

  it("appends nothing for a normal priority — it is the default reading", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-23", priority: "normal" }), TODAY)).toEqual({
      text: "até dom., 23/08",
      overdue: false,
    });
  });

  it("keeps the overdue flag when a priority word is appended to an overdue phrase", () => {
    expect(taskMetaLine(task({ deadline: "2026-08-18", priority: "high" }), TODAY)).toEqual({
      text: "atrasada · venceu ter., 18/08 · alta",
      overdue: true,
    });
  });

  it("shows the priority word alone when the Task has no date", () => {
    expect(taskMetaLine(task({ priority: "high" }), TODAY)).toEqual({
      text: "alta",
      overdue: false,
    });
    expect(taskMetaLine(task({ priority: "low" }), TODAY)).toEqual({
      text: "baixa",
      overdue: false,
    });
  });

  it("yields null for an open, undated Task with no priority or a normal one", () => {
    expect(taskMetaLine(task(), TODAY)).toBeNull();
    expect(taskMetaLine(task({ priority: "normal" }), TODAY)).toBeNull();
  });
});

describe("taskMetaLine — closed Tasks (PRD AC-6 row-meta-formatter)", () => {
  it("yields null for a done Task, even one that was overdue and high priority", () => {
    expect(
      taskMetaLine(
        task({ status: "done", deadline: "2026-08-18", priority: "high", completedAt: 1 }),
        TODAY,
      ),
    ).toBeNull();
    expect(taskMetaLine(task({ status: "done", completedAt: 1 }), TODAY)).toBeNull();
  });

  it("names a missed Task 'não concluída', flagged overdue, with no date or priority appended", () => {
    expect(taskMetaLine(task({ status: "missed" }), TODAY)).toEqual({
      text: "não concluída",
      overdue: true,
    });
    expect(
      taskMetaLine(task({ status: "missed", deadline: "2026-08-18", priority: "high" }), TODAY),
    ).toEqual({ text: "não concluída", overdue: true });
  });
});
