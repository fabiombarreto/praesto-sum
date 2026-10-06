// PRPs/prds/adherence-mirror.prd.md AC-18 The Aderencia route (ordering and
// per-series copy; the screen itself is verified manually)
// PRPs/prds/adherence-mirror.prd.md AC-19 Visible copy (pt-BR, no percentage,
// no forbidden vocabulary)
//
// Source plan: PRPs/plans/adherence-mirror-phase-3-the-screen.plan.md
// (Task 2 - src/shared/adherence-view.ts; plan AC-A4, AC-A5).
//
// Pure, DOM-free, clock-free. Test-first: the module does not exist yet, so
// this file is RED for the right reason (module-not-found on the import).

import { describe, expect, it } from "vitest";
import type { AdherenceResponse, SeriesAdherenceDto } from "../src/shared/api";
import {
  adherenceSections,
  formatDoneOfClosed,
  formatMissDates,
  formatStreak,
} from "../src/shared/adherence-view";

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
  return { series: list, ranking: [] };
}

const ids = (list: SeriesAdherenceDto[]): string[] => list.map((s) => s.seriesId);

describe("adherenceSections (AC-18)", () => {
  it("returns three empty sections for an empty response", () => {
    expect(adherenceSections(response([]))).toEqual({ missed: [], otherActive: [], ended: [] });
  });

  it("puts active series with misses first, then other active, then ended", () => {
    const sections = adherenceSections(
      response([
        series({ seriesId: "ended-1", title: "Antiga", status: "ended" }),
        series({ seriesId: "clean-1", title: "Leitura" }),
        series({
          seriesId: "miss-1",
          title: "Academia",
          recentMisses: ["2026-10-02", "2026-09-25"],
        }),
      ]),
    );
    expect(ids(sections.missed)).toEqual(["miss-1"]);
    expect(ids(sections.otherActive)).toEqual(["clean-1"]);
    expect(ids(sections.ended)).toEqual(["ended-1"]);
  });

  it("keeps a single-miss active series in the missed section (any miss in the window counts)", () => {
    const sections = adherenceSections(
      response([series({ seriesId: "one", recentMisses: ["2026-10-02"] })]),
    );
    expect(ids(sections.missed)).toEqual(["one"]);
    expect(sections.otherActive).toEqual([]);
  });

  it("orders the missed section by recent-miss count, then newest miss", () => {
    const sections = adherenceSections(
      response([
        series({ seriesId: "two-old", title: "A", recentMisses: ["2026-09-20", "2026-09-10"] }),
        series({
          seriesId: "three",
          title: "B",
          recentMisses: ["2026-09-30", "2026-09-23", "2026-09-16"],
        }),
        series({ seriesId: "two-new", title: "C", recentMisses: ["2026-10-02", "2026-09-12"] }),
      ]),
    );
    expect(ids(sections.missed)).toEqual(["three", "two-new", "two-old"]);
  });

  it("orders other active series by title with pt-BR collation, then seriesId", () => {
    const sections = adherenceSections(
      response([
        series({ seriesId: "3", title: "Bike" }),
        series({ seriesId: "2", title: "Mesma" }),
        series({ seriesId: "1", title: "Mesma" }),
        series({ seriesId: "4", title: "Água" }),
      ]),
    );
    expect(ids(sections.otherActive)).toEqual(["4", "3", "1", "2"]);
  });

  it("keeps an ended series with misses in the ended section, never in missed", () => {
    const sections = adherenceSections(
      response([
        series({
          seriesId: "ended-miss",
          title: "Antiga",
          status: "ended",
          recentMisses: ["2026-10-02", "2026-09-25"],
        }),
      ]),
    );
    expect(sections.missed).toEqual([]);
    expect(ids(sections.ended)).toEqual(["ended-miss"]);
  });

  it("orders ended series by title with pt-BR collation, then seriesId", () => {
    const sections = adherenceSections(
      response([
        series({ seriesId: "b", title: "Zebra", status: "ended" }),
        series({ seriesId: "a", title: "Ótima", status: "ended" }),
        series({ seriesId: "c", title: "Banana", status: "ended" }),
      ]),
    );
    expect(ids(sections.ended)).toEqual(["c", "a", "b"]);
  });

  it("places every series in exactly one section", () => {
    const list = [
      series({ seriesId: "m", recentMisses: ["2026-10-02"] }),
      series({ seriesId: "o" }),
      series({ seriesId: "e", status: "ended" }),
      series({ seriesId: "em", status: "ended", recentMisses: ["2026-10-02"] }),
    ];
    const s = adherenceSections(response(list));
    expect([...ids(s.missed), ...ids(s.otherActive), ...ids(s.ended)].sort()).toEqual([
      "e",
      "em",
      "m",
      "o",
    ]);
  });
});

describe("formatDoneOfClosed (AC-18, AC-19)", () => {
  it("renders 'N de M feitas'", () => {
    expect(formatDoneOfClosed(7, 10)).toBe("7 de 10 feitas");
  });

  it("renders zero done of some closed", () => {
    expect(formatDoneOfClosed(0, 3)).toBe("0 de 3 feitas");
  });

  it("special-cases zero closed without dividing or showing a ratio", () => {
    expect(formatDoneOfClosed(0, 0)).toBe("Nenhuma ocorrência concluída ainda");
  });

  it("never emits a percentage sign", () => {
    expect(formatDoneOfClosed(7, 10)).not.toContain("%");
    expect(formatDoneOfClosed(0, 0)).not.toContain("%");
  });
});

describe("formatStreak (AC-18)", () => {
  it("renders the current streak for one or more", () => {
    expect(formatStreak(1)).toBe("Sequência atual: 1");
    expect(formatStreak(5)).toBe("Sequência atual: 5");
  });

  it("renders 'Sem sequência' for zero", () => {
    expect(formatStreak(0)).toBe("Sem sequência");
  });
});

describe("formatMissDates (AC-18, AC-19)", () => {
  it("renders a single date as dd/mm with the singular wording", () => {
    expect(formatMissDates(["2026-10-20"])).toBe("Não concluída em 20/10");
  });

  it("renders several dates newest first as given, with the plural wording", () => {
    expect(formatMissDates(["2026-10-20", "2026-10-01"])).toBe("Não concluídas em 20/10, 01/10");
  });

  it("zero-pads day and month and does not reorder the dates", () => {
    expect(formatMissDates(["2026-09-05", "2026-08-30", "2026-08-02"])).toBe(
      "Não concluídas em 05/09, 30/08, 02/08",
    );
  });

  it("renders the none-case for an empty list", () => {
    expect(formatMissDates([])).toBe("Nenhuma não concluída em 30 dias");
  });

  it("never uses the forbidden vocabulary or a percentage", () => {
    const outputs = [
      formatMissDates([]),
      formatMissDates(["2026-10-20"]),
      formatMissDates(["2026-10-20", "2026-10-01"]),
    ];
    for (const out of outputs) {
      expect(out).not.toMatch(/falha|falhando|pulada/i);
      expect(out).not.toContain("%");
    }
  });
});
