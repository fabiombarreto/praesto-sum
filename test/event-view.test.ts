// PRPs/prds/events-and-day-view.prd.md AC-27 Draft and patch builders (the copy half: "an end before
// the start yields the error code the sheet shows" and the sentence the sheet shows for it)
// PRPs/prds/events-and-day-view.prd.md AC-28 The Compromisso sheet (the decidable half: "leaving the
// end empty shows the resolved end", "an end before the start shows an inline reason")
// PRPs/prds/events-and-day-view.prd.md AC-29 Search (the decidable half: "a Compromissos group lists
// matching local commitments with date and time", "with no match the group is absent", "a one-
// character query sends no request" is the screen's `shouldSearch`; the request path, the row
// label and the body decision are pinned here)
// PRPs/prds/events-and-day-view.prd.md AC-30 Offline, errors and targets (the decidable half: "a
// failed save keeps the sheet open with an inline persistent reason" - the sentence a failure maps
// to, and whether the list on screen can still be trusted)
//
// Source plan: PRPs/plans/events-and-day-view-phase-4-the-compromisso-sheet-and-search-results.plan.md
// (Task 3 - src/shared/event-view.ts: NEW_EVENT_LABEL, EVENT_SEARCH_GROUP, eventDraftErrorMessage,
// formatDraftEnd, eventWriteFailure, eventsSearchPath, formatEventSearchWhen, SearchBodyKind,
// decideSearchBody; plan AC-A4 (the copy half), AC-A8 (the path, the row label, the body decision)
// and AC-A9 (the failure mapping)).
//
// ADR-0009 and ui-ux-guidelines section 12.3: a string a FUNCTION chooses lives in src/shared and is
// tested in Portuguese, so the sentences the plan fixes verbatim in Task 3 are pinned verbatim
// here, the way test/request-failure.test.ts and test/life-areas-view.test.ts pin theirs. Nothing
// beyond what the plan fixes is pinned: no wording the Implementer was left to choose appears
// below. The words the React components render as literals (the sheet's *Hora*, *Excluir este
// compromisso?*, the offline banner) have no exported symbol and are verified in the UI checklist.
//
// Pure, DOM-free, clock-free. Written BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/event-view.ts does not exist yet, so this file is RED for the right reason - the
// module import cannot be resolved - until plan Task 3 lands.
//
// The middle dot of the search label is U+00B7, spelled as an escape below so the file stays
// unambiguous in every editor.

import { describe, expect, it } from "vitest";
import type { EventDto } from "../src/shared/api";
import type { EventDraftError } from "../src/shared/event-edit";
import {
  EVENT_SEARCH_GROUP,
  NEW_EVENT_LABEL,
  decideSearchBody,
  eventDraftErrorMessage,
  eventWriteFailure,
  eventsSearchPath,
  formatDraftEnd,
  formatEventSearchWhen,
} from "../src/shared/event-view";
import type { SearchBodyKind } from "../src/shared/event-view";
import { EVENT_DESCRIPTION_MAX, EVENT_LOCATION_MAX, EVENT_TITLE_MAX } from "../src/shared/events";
import { ALL_DAY_LABEL } from "../src/shared/format";
import { classifyRequestFailure } from "../src/shared/request-failure";
import { localAllDay, localTimed, spSeconds, withoutClock } from "./day-fixtures";

const DOT = "·";

describe("the two words two components must say identically", () => {
  it("pins the button that opens an empty sheet", () => {
    expect(NEW_EVENT_LABEL).toBe("Novo compromisso");
  });

  it("pins the heading of the search group", () => {
    expect(EVENT_SEARCH_GROUP).toBe("Compromissos");
  });
});

describe("AC-27 eventDraftErrorMessage - the sentence for each draft error", () => {
  it.each<[EventDraftError, string]>([
    [{ field: "title", code: "blank" }, "Informe o título."],
    [{ field: "start", code: "day_required" }, "Informe o dia de início."],
    [{ field: "start", code: "time_required" }, "Informe a hora de início."],
    [{ field: "end", code: "end_before_start" }, "O fim não pode ser antes do início."],
  ])("says %j as %j", (error, message) => {
    expect(eventDraftErrorMessage(error)).toBe(message);
  });

  it("names the field's own limit when a text is too long", () => {
    expect(eventDraftErrorMessage({ field: "title", code: "too_long" })).toBe(
      `Use no máximo ${EVENT_TITLE_MAX} caracteres.`,
    );
    expect(eventDraftErrorMessage({ field: "description", code: "too_long" })).toBe(
      `Use no máximo ${EVENT_DESCRIPTION_MAX} caracteres.`,
    );
    expect(eventDraftErrorMessage({ field: "location", code: "too_long" })).toBe(
      `Use no máximo ${EVENT_LOCATION_MAX} caracteres.`,
    );
  });

  it("pins the limits as the owner reads them", () => {
    expect(eventDraftErrorMessage({ field: "title", code: "too_long" })).toBe(
      "Use no máximo 200 caracteres.",
    );
    expect(eventDraftErrorMessage({ field: "description", code: "too_long" })).toBe(
      "Use no máximo 5000 caracteres.",
    );
    expect(eventDraftErrorMessage({ field: "location", code: "too_long" })).toBe(
      "Use no máximo 200 caracteres.",
    );
  });

  it("answers every error the draft can produce with a sentence, never an empty one", () => {
    const every: EventDraftError[] = [
      { field: "title", code: "blank" },
      { field: "title", code: "too_long" },
      { field: "description", code: "too_long" },
      { field: "location", code: "too_long" },
      { field: "start", code: "day_required" },
      { field: "start", code: "time_required" },
      { field: "end", code: "end_before_start" },
    ];
    for (const error of every) {
      const message = eventDraftErrorMessage(error);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/undefined|NaN|\[object/);
      expect(message.endsWith(".")).toBe(true);
    }
  });
});

describe("AC-28 formatDraftEnd - the end the owner has not typed yet", () => {
  it("reads a timed end as a date and a time", () => {
    expect(formatDraftEnd({ day: "2026-10-20", time: "10:30" })).toBe(
      "Termina em 20/10/2026 às 10:30.",
    );
  });

  it("reads an all-day end as a date alone", () => {
    expect(formatDraftEnd({ day: "2026-10-27", time: null })).toBe("Termina em 27/10/2026.");
  });

  it.each<[{ day: string; time: string | null }, string]>([
    [{ day: "2026-01-05", time: "09:05" }, "Termina em 05/01/2026 às 09:05."],
    [{ day: "2027-01-01", time: "00:00" }, "Termina em 01/01/2027 às 00:00."],
    [{ day: "2026-12-31", time: "23:59" }, "Termina em 31/12/2026 às 23:59."],
    [{ day: "2028-02-29", time: null }, "Termina em 29/02/2028."],
  ])("zero-pads and orders the parts of %j", (end, expected) => {
    expect(formatDraftEnd(end)).toBe(expected);
  });
});

/** A caught failure shaped like `ApiError`: an Error carrying the numeric HTTP status. */
class StatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

describe("AC-30 eventWriteFailure - a failed save or delete stays inline", () => {
  it("says a deleted-elsewhere commitment is gone, and that the list on screen is stale", () => {
    expect(eventWriteFailure(new StatusError(404, "Compromisso não encontrado"))).toEqual({
      message: "Este compromisso não existe mais. A lista foi atualizada.",
      staleList: true,
    });
  });

  it("reads the status the way the generic classifier does: any object with a numeric status", () => {
    expect(eventWriteFailure({ status: 404 })).toEqual({
      message: "Este compromisso não existe mais. A lista foi atualizada.",
      staleList: true,
    });
  });

  it.each([400, 403, 409, 413, 429, 500, 502, 503])(
    "falls back to the generic sentence for status %i, and the list is still trusted",
    (status) => {
      const cause = new StatusError(status, "mensagem do servidor");
      expect(eventWriteFailure(cause)).toEqual({
        message: classifyRequestFailure(cause).message,
        staleList: false,
      });
    },
  );

  it("names the status in the generic sentence the owner reads", () => {
    expect(eventWriteFailure(new StatusError(500, "x")).message).toContain("500");
  });

  it("says the server cannot be reached for a failure with no status", () => {
    for (const cause of [
      new TypeError("Failed to fetch"),
      new Error("boom"),
      "boom",
      42,
      null,
      undefined,
    ]) {
      expect(eventWriteFailure(cause)).toEqual({
        message: classifyRequestFailure(cause).message,
        staleList: false,
      });
    }
  });

  it("does not take a status that is not a number for a 404", () => {
    const cause = { status: "404" };
    expect(eventWriteFailure(cause)).toEqual({
      message: classifyRequestFailure(cause).message,
      staleList: false,
    });
  });

  it("never shows the server's own error text, which carries a field marker meant for tools", () => {
    const marker = "title: Campo inválido (title)";
    for (const status of [400, 404, 409, 500]) {
      expect(eventWriteFailure(new StatusError(status, marker)).message).not.toContain(marker);
      expect(eventWriteFailure(new StatusError(status, marker)).message).not.toContain("title");
    }
  });
});

describe("AC-29 eventsSearchPath - the request behind the Compromissos group", () => {
  it("trims the text and encodes it into the q parameter", () => {
    expect(eventsSearchPath("  consulta dentista ")).toBe("/api/events?q=consulta%20dentista");
  });

  it("is the bare route and q for a plain word", () => {
    expect(eventsSearchPath("dentista")).toBe("/api/events?q=dentista");
  });

  it("percent-encodes accents as UTF-8", () => {
    expect(eventsSearchPath("reunião")).toBe("/api/events?q=reuni%C3%A3o");
  });

  it("encodes the characters that would otherwise end the value", () => {
    expect(eventsSearchPath("a&b=c")).toBe("/api/events?q=a%26b%3Dc");
    expect(eventsSearchPath("100%")).toBe("/api/events?q=100%25");
    expect(eventsSearchPath("o que?#x")).toBe("/api/events?q=o%20que%3F%23x");
  });

  it("sends no range, so the search spans every date", () => {
    expect(eventsSearchPath("consulta")).not.toContain("from=");
    expect(eventsSearchPath("consulta")).not.toContain("to=");
  });
});

describe("AC-29 formatEventSearchWhen - the date and time a search row shows", () => {
  it("reads a timed Event as dd/MM/aaaa, a middle dot and HH:mm", () => {
    const event = localTimed(
      "e1",
      spSeconds("2026-10-20", "09:30"),
      spSeconds("2026-10-20", "10:30"),
    );
    expect(formatEventSearchWhen(event)).toBe(`20/10/2026 ${DOT} 09:30`);
  });

  it("zero-pads the day and the month", () => {
    const event = localTimed(
      "e2",
      spSeconds("2026-01-05", "08:05"),
      spSeconds("2026-01-05", "09:00"),
    );
    expect(formatEventSearchWhen(event)).toBe(`05/01/2026 ${DOT} 08:05`);
  });

  it("reads the owner's clock for an Event authored in another zone", () => {
    // 14:00 UTC is 10:00 in New York but 11:00 in São Paulo, and the search row says 11:00.
    const event = localTimed(
      "e3",
      Date.UTC(2026, 9, 20, 14, 0) / 1000,
      Date.UTC(2026, 9, 20, 15, 0) / 1000,
      {
        timezone: "America/New_York",
      },
    );
    expect(formatEventSearchWhen(event)).toBe(`20/10/2026 ${DOT} 11:00`);
  });

  it("puts the Event on the owner's day, not the Event's, across midnight", () => {
    // 23:30 in New York on the 20th is 03:30 UTC and 00:30 in São Paulo on the 21st.
    const event = localTimed(
      "e4",
      Date.UTC(2026, 9, 21, 3, 30) / 1000,
      Date.UTC(2026, 9, 21, 4, 30) / 1000,
      {
        timezone: "America/New_York",
      },
    );
    expect(formatEventSearchWhen(event)).toBe(`21/10/2026 ${DOT} 00:30`);
  });

  it("reads the owner's late evening as the owner's day even when UTC is on the next one", () => {
    const event = localTimed(
      "e5",
      spSeconds("2026-10-20", "23:30"),
      spSeconds("2026-10-21", "00:30"),
    );
    expect(formatEventSearchWhen(event)).toBe(`20/10/2026 ${DOT} 23:30`);
  });

  it("reads local midnight as 00:00", () => {
    const event = localTimed(
      "e6",
      spSeconds("2026-10-21", "00:00"),
      spSeconds("2026-10-21", "01:00"),
    );
    expect(formatEventSearchWhen(event)).toBe(`21/10/2026 ${DOT} 00:00`);
  });

  it("pins the all-day wording the time column already uses", () => {
    expect(ALL_DAY_LABEL).toBe("dia todo");
  });

  it("reads an all-day Event as its first day and the all-day label", () => {
    const event = localAllDay("a1", "2026-10-26", "2026-10-28");
    expect(formatEventSearchWhen(event)).toBe(`26/10/2026 ${DOT} ${ALL_DAY_LABEL}`);
  });

  it("copies an all-day Event's first day verbatim, with no zone conversion", () => {
    const event = localAllDay("a2", "2027-01-01", "2027-01-02", { timezone: "Pacific/Kiritimati" });
    expect(formatEventSearchWhen(event)).toBe(`01/01/2027 ${DOT} ${ALL_DAY_LABEL}`);
  });

  it("reads an empty string for an Event that lacks the start its kind needs", () => {
    const timed: EventDto = localTimed("x1", 0, 0, { startAt: null, endAt: null });
    const allDay: EventDto = localAllDay("x2", "", "", { startDate: null, endDate: null });
    expect(formatEventSearchWhen(timed)).toBe("");
    expect(formatEventSearchWhen(allDay)).toBe("");
  });

  it("reads no clock", () => {
    const event = localTimed(
      "e1",
      spSeconds("2026-10-20", "09:30"),
      spSeconds("2026-10-20", "10:30"),
    );
    expect(() => withoutClock(() => formatEventSearchWhen(event))).not.toThrow();
  });
});

describe("AC-29 decideSearchBody - when the screen may say that nothing was found", () => {
  const READY = {
    online: true,
    queryReady: true,
    tasksAnswered: true,
    tasksFailed: false,
    taskCount: 0,
    eventsAnswered: true,
    eventsFailed: false,
    eventCount: 0,
  };

  function decide(overrides: Partial<typeof READY> = {}): SearchBodyKind {
    return decideSearchBody({ ...READY, ...overrides });
  }

  const KINDS: readonly SearchBodyKind[] = [
    "offline",
    "hint",
    "loading",
    "task-error",
    "empty",
    "results",
  ];

  it("says nothing was found only when both searches answered and both are empty", () => {
    expect(decide()).toBe("empty");
  });

  describe("evaluated in order: offline, hint, task-error, loading, results, loading, empty", () => {
    it("is offline whenever the device is, whatever else is true", () => {
      expect(decide({ online: false })).toBe("offline");
      expect(decide({ online: false, queryReady: false })).toBe("offline");
      expect(decide({ online: false, tasksFailed: true, tasksAnswered: false })).toBe("offline");
      expect(decide({ online: false, taskCount: 3, eventCount: 2 })).toBe("offline");
    });

    it("is a hint while the query is too short, whatever else is true", () => {
      expect(decide({ queryReady: false })).toBe("hint");
      expect(decide({ queryReady: false, tasksFailed: true })).toBe("hint");
      expect(decide({ queryReady: false, taskCount: 3, eventCount: 2 })).toBe("hint");
      expect(decide({ queryReady: false, tasksAnswered: false, eventsAnswered: false })).toBe(
        "hint",
      );
    });

    it("is a task error when the Task search failed, ahead of anything the commitments found", () => {
      expect(decide({ tasksFailed: true, tasksAnswered: false })).toBe("task-error");
      expect(decide({ tasksFailed: true })).toBe("task-error");
      expect(decide({ tasksFailed: true, eventCount: 2 })).toBe("task-error");
      expect(decide({ tasksFailed: true, taskCount: 1, eventsFailed: true })).toBe("task-error");
    });

    it("is loading while the Task search has not answered", () => {
      expect(decide({ tasksAnswered: false })).toBe("loading");
      expect(decide({ tasksAnswered: false, eventsAnswered: false })).toBe("loading");
      expect(decide({ tasksAnswered: false, eventCount: 2 })).toBe("loading");
    });

    it("shows results as soon as the Tasks found something, without waiting for the commitments", () => {
      expect(decide({ taskCount: 2 })).toBe("results");
      expect(decide({ taskCount: 2, eventsAnswered: false })).toBe("results");
      expect(decide({ taskCount: 2, eventsAnswered: false, eventsFailed: true })).toBe("results");
    });

    it("shows results when only the commitments found something", () => {
      expect(decide({ eventCount: 1 })).toBe("results");
      expect(decide({ eventCount: 3, taskCount: 2 })).toBe("results");
    });

    it("shows results when the commitments search failed, so its own failure line can show", () => {
      expect(decide({ eventsFailed: true, eventsAnswered: false })).toBe("results");
      expect(decide({ eventsFailed: true })).toBe("results");
    });

    it("is loading while the commitments search has not answered and nothing was found", () => {
      expect(decide({ eventsAnswered: false })).toBe("loading");
    });
  });

  it("never turns a Task result into an error because the commitments search failed", () => {
    for (const eventsAnswered of [true, false]) {
      expect(decide({ taskCount: 4, eventsFailed: true, eventsAnswered })).toBe("results");
    }
  });

  it("never says nothing was found while a search is unanswered or failed (swept over every combination)", () => {
    // Eight inputs, each on or off (a count is 0 or 2): 256 combinations, decoded from the bits of n.
    const bit = (n: number, index: number): boolean => ((n >> index) & 1) === 1;
    let emptyCount = 0;

    for (let n = 0; n < 256; n += 1) {
      const input = {
        online: bit(n, 0),
        queryReady: bit(n, 1),
        tasksAnswered: bit(n, 2),
        tasksFailed: bit(n, 3),
        taskCount: bit(n, 4) ? 2 : 0,
        eventsAnswered: bit(n, 5),
        eventsFailed: bit(n, 6),
        eventCount: bit(n, 7) ? 2 : 0,
      };
      const kind = decideSearchBody(input);
      expect(KINDS).toContain(kind);

      const bothAnsweredAndEmpty =
        input.online &&
        input.queryReady &&
        input.tasksAnswered &&
        !input.tasksFailed &&
        input.taskCount === 0 &&
        input.eventsAnswered &&
        !input.eventsFailed &&
        input.eventCount === 0;
      expect(kind === "empty").toBe(bothAnsweredAndEmpty);
      if (kind === "empty") emptyCount += 1;

      if (!input.online) expect(kind).toBe("offline");
      if (input.online && !input.queryReady) expect(kind).toBe("hint");
      if (input.online && input.queryReady && input.tasksFailed) expect(kind).toBe("task-error");
      if (kind === "results") {
        expect(input.taskCount > 0 || input.eventCount > 0 || input.eventsFailed).toBe(true);
      }
      if (
        input.online &&
        input.queryReady &&
        !input.tasksFailed &&
        input.tasksAnswered &&
        input.taskCount > 0
      ) {
        expect(kind).toBe("results");
      }
    }

    // Of the 256 combinations exactly one may say that nothing was found.
    expect(emptyCount).toBe(1);
  });
});
