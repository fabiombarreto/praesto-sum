// PRPs/prds/life-areas.prd.md AC-19 Áreas screen (manual) — the decidable half of
// "open counts", "a read-only Sem área row with its count", "delete asks once,
// repeats the verb and says how many Tarefas and séries lose the area", "with no
// area the empty state invites the first one", "a failed request is an inline
// persistent error" and "the copy is pt-BR".
//
// Source plan: PRPs/plans/life-areas-phase-2-the-reas-screen.plan.md
// (Task 2 — src/shared/life-areas-view.ts; plan AC-A2, AC-A3, AC-A5, AC-A6).
//
// ADR-0009 and ui-ux-guidelines §12.3: a string a FUNCTION chooses lives in
// src/shared and is tested in Portuguese, so the sentences the plan fixes
// verbatim in Task 2's ACTION are pinned verbatim here, the way
// test/request-failure.test.ts pins its two. Nothing beyond what the plan fixes is
// pinned: no wording the Implementer was left to choose appears below.
//
// PRD AC-19 is a manual criterion and names no function, so the exported names and
// signatures are the ones the plan pins in Task 2 and in its Notes ("For the test
// pair"): NO_AREA_LABEL, formatOpenTaskCount, LIFE_AREAS_EMPTY_TITLE,
// LIFE_AREAS_EMPTY_BODY, LIFE_AREA_LIMIT_NOTICE, formatLifeAreaDeleteTitle,
// formatLifeAreaDeleteBody, formatLifeAreaDeletedNotice, lifeAreaNameProblemMessage
// and lifeAreaWriteFailure.
//
// Not covered here, on purpose: the retry label *Tentar de novo*, the *Cancelar* /
// *Excluir* button labels and the offline banner text. The plan renders them as
// literals in the React screen (Task 5 and Task 6 grep for them) and exports no
// symbol that carries them, so they are verified in the UI checklist, not here.
//
// Pure, DOM-free, clock-free. Written BEFORE the Implementer (test-first, per
// `tdd: true`): src/shared/life-areas-view.ts does not exist yet, so this file is
// expected to be RED for the right reason — the module import cannot be resolved —
// until plan Task 2 lands. No other RED reason is expected.

import { describe, expect, it } from "vitest";
import type { LifeAreaNameProblem } from "../src/shared/life-areas-list";
import { classifyRequestFailure } from "../src/shared/request-failure";
import {
  formatLifeAreaDeleteBody,
  formatLifeAreaDeletedNotice,
  formatLifeAreaDeleteTitle,
  formatOpenTaskCount,
  LIFE_AREA_LIMIT_NOTICE,
  LIFE_AREAS_EMPTY_BODY,
  LIFE_AREAS_EMPTY_TITLE,
  lifeAreaNameProblemMessage,
  lifeAreaWriteFailure,
  NO_AREA_LABEL,
} from "../src/shared/life-areas-view";

// The plan fixes curved quotes: U+201C and U+201D, never the straight ASCII one.
const OPEN_QUOTE = "“";
const CLOSE_QUOTE = "”";

describe("NO_AREA_LABEL (AC-19: the read-only Sem área row)", () => {
  it("is the pt-BR copy Sem área", () => {
    expect(NO_AREA_LABEL).toBe("Sem área");
  });
});

describe("formatOpenTaskCount (AC-19: each area's open count)", () => {
  it.each([
    [0, "Nenhuma tarefa aberta"],
    [1, "1 tarefa aberta"],
    [2, "2 tarefas abertas"],
    [12, "12 tarefas abertas"],
  ])("renders %i as a count in pt-BR", (count, expected) => {
    expect(formatOpenTaskCount(count)).toBe(expected);
  });
});

describe("the empty state and the limit notice (AC-19; PRD AC-3 at the screen)", () => {
  it("pins the empty-state title and the body that invites the first area", () => {
    expect(LIFE_AREAS_EMPTY_TITLE).toBe("Nenhuma área ainda.");
    expect(LIFE_AREAS_EMPTY_BODY).toBe(
      "Crie a primeira, como Casa ou Saúde, e agrupe suas tarefas.",
    );
  });

  it("pins the notice that replaces the add form at the limit", () => {
    expect(LIFE_AREA_LIMIT_NOTICE).toBe("Você já tem 12 áreas. Exclua uma para criar outra.");
  });
});

describe("formatLifeAreaDeleteTitle (AC-19: delete repeats the verb)", () => {
  it("asks Excluir a área with the name in curved quotes", () => {
    const expected = `Excluir a área ${OPEN_QUOTE}Casa${CLOSE_QUOTE}?`;

    expect(formatLifeAreaDeleteTitle("Casa")).toBe(expected);
  });

  it("carries the name exactly as the owner typed it", () => {
    const expected = `Excluir a área ${OPEN_QUOTE}Saúde & bem-estar${CLOSE_QUOTE}?`;

    expect(formatLifeAreaDeleteTitle("Saúde & bem-estar")).toBe(expected);
  });
});

describe("formatLifeAreaDeleteBody (AC-19: how many Tarefas and séries lose the area)", () => {
  it("says nothing holds the area when both counts are zero", () => {
    expect(formatLifeAreaDeleteBody({ taskCount: 0, seriesCount: 0 })).toBe(
      "Nenhuma tarefa ou série tem esta área. Não dá para desfazer.",
    );
  });

  it.each([
    {
      taskCount: 3,
      seriesCount: 0,
      expected: "3 tarefas ficam sem área. Nenhuma é excluída. Não dá para desfazer.",
    },
    {
      taskCount: 1,
      seriesCount: 0,
      expected: "1 tarefa fica sem área. Nenhuma é excluída. Não dá para desfazer.",
    },
    {
      taskCount: 5,
      seriesCount: 1,
      expected: "5 tarefas e 1 série ficam sem área. Nenhuma é excluída. Não dá para desfazer.",
    },
    {
      taskCount: 0,
      seriesCount: 2,
      expected: "2 séries ficam sem área. Nenhuma é excluída. Não dá para desfazer.",
    },
    {
      taskCount: 1,
      seriesCount: 1,
      expected: "1 tarefa e 1 série ficam sem área. Nenhuma é excluída. Não dá para desfazer.",
    },
    {
      taskCount: 0,
      seriesCount: 1,
      expected: "1 série fica sem área. Nenhuma é excluída. Não dá para desfazer.",
    },
  ])("names $taskCount tarefas and $seriesCount séries", ({ taskCount, seriesCount, expected }) => {
    expect(formatLifeAreaDeleteBody({ taskCount, seriesCount })).toBe(expected);
  });
});

describe("formatLifeAreaDeletedNotice (AC-19: the deletion is announced)", () => {
  it("names the area that was deleted, in curved quotes", () => {
    const expected = `Área ${OPEN_QUOTE}Casa${CLOSE_QUOTE} excluída.`;

    expect(formatLifeAreaDeletedNotice("Casa")).toBe(expected);
  });
});

describe("lifeAreaNameProblemMessage (AC-19 add and rename; PRD AC-2 at the screen)", () => {
  const messages: [LifeAreaNameProblem, string][] = [
    ["blank", "O nome está em branco. Escreva um nome para a área."],
    ["too_long", "O nome passa de 40 caracteres. Use um nome mais curto."],
    ["duplicate", "Já existe uma área com esse nome. Escolha outro nome."],
  ];

  it.each(messages)("pins the field message for %s", (problem, expected) => {
    expect(lifeAreaNameProblemMessage(problem)).toBe(expected);
  });
});

describe("lifeAreaWriteFailure (AC-19: a failed write keeps the text and says why)", () => {
  it("answers a 400 with the name-not-accepted sentence and leaves the list alone", () => {
    expect(lifeAreaWriteFailure({ status: 400 })).toEqual({
      message: "O nome não foi aceito. Confira o nome e tente de novo.",
      staleList: false,
    });
  });

  it("answers a 404 with the area-is-gone sentence and marks the list stale", () => {
    expect(lifeAreaWriteFailure({ status: 404 })).toEqual({
      message: "Essa área não existe mais. A lista foi atualizada.",
      staleList: true,
    });
  });

  it("answers a 409 with the name-exists-or-limit sentence and marks the list stale", () => {
    expect(lifeAreaWriteFailure({ status: 409 })).toEqual({
      message: "Esse nome já existe ou o limite de 12 áreas foi atingido. A lista foi atualizada.",
      staleList: true,
    });
  });

  it("falls back to the shared request-failure message for any other status", () => {
    const cause = { status: 500 };

    expect(lifeAreaWriteFailure(cause)).toEqual({
      message: classifyRequestFailure(cause).message,
      staleList: false,
    });
  });

  it("falls back to the shared message when the network failed and there is no status", () => {
    const cause = new TypeError("Failed to fetch");

    expect(lifeAreaWriteFailure(cause)).toEqual({
      message: classifyRequestFailure(cause).message,
      staleList: false,
    });
  });

  it("does not treat a non-numeric status as an HTTP status, exactly as the shared classifier", () => {
    const cause = { status: "404" };

    expect(lifeAreaWriteFailure(cause)).toEqual({
      message: classifyRequestFailure(cause).message,
      staleList: false,
    });
  });

  it.each([null, undefined, "boom"])("never throws on a %s cause", (cause) => {
    expect(() => lifeAreaWriteFailure(cause)).not.toThrow();
    expect(lifeAreaWriteFailure(cause).staleList).toBe(false);
  });

  it.each([400, 404, 409, 500])(
    "never shows the server's own error text for a %i, which carries a tool-facing marker",
    (status) => {
      const serverText = "name must be between 1 and 40 characters (name)";

      const { message } = lifeAreaWriteFailure({ status, message: serverText });

      expect(message).not.toContain(serverText);
      expect(message).not.toContain("(name)");
    },
  );
});
