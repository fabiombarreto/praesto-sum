// PRPs/prds/adherence-mirror.prd.md AC-15 The Hoje line - threshold
// PRPs/prds/adherence-mirror.prd.md AC-16 The Hoje line - absent
// PRPs/prds/adherence-mirror.prd.md AC-19 Visible copy (vocabulary half)
//
// Source plan: PRPs/plans/adherence-mirror-phase-3-the-screen.plan.md
// (Task 1 - src/shared/adherence-line.ts; plan AC-A1, AC-A2, AC-A5).
//
// Pure, DOM-free, clock-free: the decision "show the line or not, and which
// text" is derived only from the AdherenceResponse it is handed. React glue
// (the line's placement, tap target, fetch isolation: AC-17) is verified
// manually per docs/context/methodology.md and is not tested here.
//
// Test-first: src/shared/adherence-line.ts does not exist yet, so this file is
// RED for the right reason (module-not-found on the import below).

import { describe, expect, it } from "vitest";
import type { AdherenceResponse, SeriesAdherenceDto } from "../src/shared/api";
import {
  ADHERENCE_LINE_MIN_MISSES,
  decideAdherenceLine,
  orderByMisses,
  seriesDisplayTitle,
  UNTITLED_SERIES_LABEL,
} from "../src/shared/adherence-line";

function series(over: Partial<SeriesAdherenceDto> & { seriesId: string }): SeriesAdherenceDto {
  return {
    title: "Academia",
    status: "active",
    done: 0,
    closed: 0,
    currentStreak: 0,
    recentMisses: [],
    ...over,
  };
}

function response(list: SeriesAdherenceDto[]): AdherenceResponse {
  // The server `ranking` is deliberately left empty: the line must be
  // recomputed from `series`, never read from `ranking`.
  return { series: list, ranking: [] };
}

describe("ADHERENCE_LINE_MIN_MISSES", () => {
  it("is two misses", () => {
    expect(ADHERENCE_LINE_MIN_MISSES).toBe(2);
  });
});

describe("seriesDisplayTitle", () => {
  it("returns the title when it is not empty", () => {
    expect(seriesDisplayTitle(series({ seriesId: "a", title: "Academia" }))).toBe("Academia");
  });

  it("falls back to the untitled label when the title is the empty string", () => {
    expect(UNTITLED_SERIES_LABEL).toBe("Sem título");
    expect(seriesDisplayTitle(series({ seriesId: "a", title: "" }))).toBe("Sem título");
  });
});

describe("decideAdherenceLine - show or hide (AC-15, AC-16)", () => {
  it("is absent for an empty response", () => {
    expect(decideAdherenceLine(response([]))).toBeNull();
  });

  it("is absent when the only active series has exactly one miss in the window", () => {
    const r = response([series({ seriesId: "a", recentMisses: ["2026-10-01"] })]);
    expect(decideAdherenceLine(r)).toBeNull();
  });

  it("appears when an active series has exactly two misses in the window", () => {
    const r = response([series({ seriesId: "a", recentMisses: ["2026-10-02", "2026-09-25"] })]);
    expect(decideAdherenceLine(r)).not.toBeNull();
  });

  it("is absent when the only qualifying series is ended", () => {
    const r = response([
      series({
        seriesId: "ended-1",
        status: "ended",
        recentMisses: ["2026-10-02", "2026-09-25", "2026-09-18"],
      }),
    ]);
    expect(decideAdherenceLine(r)).toBeNull();
  });

  it("ignores an ended series that would rank first and picks the qualifying active one", () => {
    const r = response([
      series({
        seriesId: "ended-1",
        title: "Antiga",
        status: "ended",
        recentMisses: ["2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30"],
      }),
      series({ seriesId: "act-1", title: "Corrida", recentMisses: ["2026-09-20", "2026-09-10"] }),
    ]);
    const decided = decideAdherenceLine(r);
    expect(decided).not.toBeNull();
    expect(decided!.seriesId).toBe("act-1");
    expect(decided!.text).toContain("Corrida");
    expect(decided!.text).not.toContain("Antiga");
    expect(decided!.text).not.toContain("+");
  });
});

describe("decideAdherenceLine - the text (AC-15)", () => {
  it("names the series, its miss count and the 30-day window", () => {
    const r = response([
      series({ seriesId: "a", title: "Academia", recentMisses: ["2026-10-02", "2026-09-25"] }),
    ]);
    expect(decideAdherenceLine(r)).toEqual({
      seriesId: "a",
      text: "Academia · 2 não concluídas em 30 dias",
    });
  });

  it("counts every miss in the window, not just the threshold", () => {
    const r = response([
      series({
        seriesId: "a",
        title: "Academia",
        recentMisses: ["2026-10-02", "2026-09-25", "2026-09-18", "2026-09-11"],
      }),
    ]);
    expect(decideAdherenceLine(r)!.text).toBe("Academia · 4 não concluídas em 30 dias");
  });

  it("uses the untitled label for a series with an empty title", () => {
    const r = response([
      series({ seriesId: "a", title: "", recentMisses: ["2026-10-02", "2026-09-25"] }),
    ]);
    expect(decideAdherenceLine(r)!.text).toBe("Sem título · 2 não concluídas em 30 dias");
  });

  it("picks the series with the most misses as the top series", () => {
    const r = response([
      series({ seriesId: "a", title: "Pouca", recentMisses: ["2026-10-02", "2026-09-25"] }),
      series({
        seriesId: "b",
        title: "Muita",
        recentMisses: ["2026-09-30", "2026-09-23", "2026-09-16"],
      }),
    ]);
    const decided = decideAdherenceLine(r)!;
    expect(decided.seriesId).toBe("b");
    expect(decided.text.startsWith("Muita · 3 não concluídas em 30 dias")).toBe(true);
  });

  it("adds ' · +1 série' (singular) for exactly one other qualifying active series", () => {
    const r = response([
      series({
        seriesId: "a",
        title: "Academia",
        recentMisses: ["2026-10-02", "2026-09-25", "2026-09-18"],
      }),
      series({ seriesId: "b", title: "Corrida", recentMisses: ["2026-10-01", "2026-09-24"] }),
    ]);
    expect(decideAdherenceLine(r)!.text).toBe("Academia · 3 não concluídas em 30 dias · +1 série");
  });

  it("adds ' · +2 séries' (plural) for two other qualifying active series", () => {
    const r = response([
      series({
        seriesId: "a",
        title: "Academia",
        recentMisses: ["2026-10-02", "2026-09-25", "2026-09-18"],
      }),
      series({ seriesId: "b", title: "Corrida", recentMisses: ["2026-10-01", "2026-09-24"] }),
      series({ seriesId: "c", title: "Leitura", recentMisses: ["2026-09-30", "2026-09-23"] }),
    ]);
    expect(decideAdherenceLine(r)!.text).toBe("Academia · 3 não concluídas em 30 dias · +2 séries");
  });

  it("does not count non-qualifying, ended or miss-free series in the '+N'", () => {
    const r = response([
      series({ seriesId: "a", title: "Academia", recentMisses: ["2026-10-02", "2026-09-25"] }),
      series({ seriesId: "one-miss", title: "Uma", recentMisses: ["2026-10-01"] }),
      series({ seriesId: "clean", title: "Limpa", recentMisses: [] }),
      series({
        seriesId: "ended",
        title: "Antiga",
        status: "ended",
        recentMisses: ["2026-10-01", "2026-09-24"],
      }),
    ]);
    expect(decideAdherenceLine(r)!.text).toBe("Academia · 2 não concluídas em 30 dias");
  });

  it("breaks a count tie by the newest miss, and recomputes the order instead of reading `ranking`", () => {
    const older = series({
      seriesId: "old",
      title: "Aaa",
      recentMisses: ["2026-09-20", "2026-09-10"],
    });
    const newer = series({
      seriesId: "new",
      title: "Zzz",
      recentMisses: ["2026-10-02", "2026-09-12"],
    });
    const r: AdherenceResponse = { series: [older, newer], ranking: ["old", "new"] };
    expect(decideAdherenceLine(r)!.seriesId).toBe("new");
  });

  it("never uses the forbidden vocabulary", () => {
    const r = response([
      series({ seriesId: "a", title: "Academia", recentMisses: ["2026-10-02", "2026-09-25"] }),
      series({ seriesId: "b", title: "Corrida", recentMisses: ["2026-10-01", "2026-09-24"] }),
    ]);
    const text = decideAdherenceLine(r)!.text;
    expect(text).toMatch(/não concluídas/);
    expect(text).not.toMatch(/falha|falhando|pulada/i);
    expect(text).not.toContain("%");
  });
});

describe("orderByMisses", () => {
  it("excludes ended series and series with no recent miss", () => {
    const out = orderByMisses([
      series({ seriesId: "clean", recentMisses: [] }),
      series({ seriesId: "ended", status: "ended", recentMisses: ["2026-10-01", "2026-09-30"] }),
      series({ seriesId: "one", recentMisses: ["2026-10-01"] }),
    ]);
    expect(out.map((s) => s.seriesId)).toEqual(["one"]);
  });

  it("orders by recent-miss count descending", () => {
    const out = orderByMisses([
      series({ seriesId: "two", recentMisses: ["2026-10-02", "2026-09-25"] }),
      series({ seriesId: "three", recentMisses: ["2026-09-30", "2026-09-23", "2026-09-16"] }),
      series({ seriesId: "one", recentMisses: ["2026-10-03"] }),
    ]);
    expect(out.map((s) => s.seriesId)).toEqual(["three", "two", "one"]);
  });

  it("breaks a count tie by the newest miss descending", () => {
    const out = orderByMisses([
      series({ seriesId: "a", title: "Aaa", recentMisses: ["2026-09-20", "2026-09-10"] }),
      series({ seriesId: "b", title: "Bbb", recentMisses: ["2026-10-02", "2026-09-12"] }),
    ]);
    expect(out.map((s) => s.seriesId)).toEqual(["b", "a"]);
  });

  it("breaks a full miss tie by title with pt-BR collation (an accented initial sorts with its base letter)", () => {
    const misses = ["2026-10-02", "2026-09-25"];
    const out = orderByMisses([
      series({ seriesId: "x", title: "Bike", recentMisses: misses }),
      series({ seriesId: "y", title: "Água", recentMisses: misses }),
    ]);
    expect(out.map((s) => s.title)).toEqual(["Água", "Bike"]);
  });

  it("breaks a full title tie by seriesId ascending", () => {
    const misses = ["2026-10-02", "2026-09-25"];
    const out = orderByMisses([
      series({ seriesId: "b-2", title: "Mesma", recentMisses: misses }),
      series({ seriesId: "a-1", title: "Mesma", recentMisses: misses }),
    ]);
    expect(out.map((s) => s.seriesId)).toEqual(["a-1", "b-2"]);
  });

  it("does not mutate its input", () => {
    const input = [
      series({ seriesId: "one", recentMisses: ["2026-10-03"] }),
      series({ seriesId: "two", recentMisses: ["2026-10-02", "2026-09-25"] }),
    ];
    const snapshot = input.map((s) => s.seriesId);
    orderByMisses(input);
    expect(input.map((s) => s.seriesId)).toEqual(snapshot);
  });
});
