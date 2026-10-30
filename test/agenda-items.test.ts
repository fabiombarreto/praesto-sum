// PRPs/prds/events-and-day-view.prd.md AC-22 One range function, three sources
// PRPs/prds/events-and-day-view.prd.md AC-23 Agenda on Hoje (the decidable half of a manual AC)
// PRPs/prds/events-and-day-view.prd.md AC-25 Future days and degraded Google (the notice rule)
//
// Source plan: PRPs/plans/events-and-day-view-phase-3-the-range-function-and-the-day.plan.md
// (Task 4 — src/shared/agenda.ts: `agendaItemsForToday`, `agendaForToday` as a thin caller of
// `itemsInRange`, `AgendaState`, `AGENDA_EMPTY`, `agendaPartialMessage`, `decideAgendaNotice`;
// plan AC-A3).
//
// WHY THIS IS A NEW FILE: test/agenda.test.ts is the approved unit-4 suite for `agendaForToday`
// and must pass UNMODIFIED against the rewritten function (the plan's Level 3 diffs it against
// the merge base). This file adds only what that suite cannot say.
//
// The screens are verified by eye (`docs/context/methodology.md`: UI stays manual), so what lands
// here is exactly the part that can be wrong SILENTLY:
//
//   - which commitments belong in today's Agenda, in what order, and with what identity;
//   - when the Agenda or the day view is allowed to say "nothing here". A failed Google fetch, or
//     another source that has not answered, must NEVER let a day read as free — that outcome is
//     the unit's success metric set to zero. `decideAgendaNotice` is where that rule lives.
//
// Beyond the PRD text, pinned because the plan fixes it: the exact signatures and the
// `othersReady` input (true once every OTHER source has answered successfully); the notice
// strings are byte-for-byte what `TodayScreen` renders today (`AGENDA.partial`, `AGENDA.empty`);
// and plan decision D3-3 — a multi-day or overnight Google event now also appears on its later
// days in Hoje, where the old start-day-only rule showed it once.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): `agendaItemsForToday`,
// `decideAgendaNotice`, `agendaPartialMessage`, `AGENDA_EMPTY` and the new `agendaForToday`
// behaviour do not exist in src/shared/agenda.ts yet, so every case is RED until plan Task 4,
// except one on purpose: "returns the very Google event objects it was given" passes today (the
// shipped function already returns the same objects) and stays as the guard that a rewrite as a
// caller of `itemsInRange` must not start copying them.

import { describe, expect, it } from "vitest";
import {
  AGENDA_EMPTY,
  agendaForToday,
  agendaItemsForToday,
  agendaPartialMessage,
  decideAgendaNotice,
  type AgendaState,
} from "../src/shared/agenda";
import { googleFailureMessage } from "../src/shared/google-failure-copy";
import {
  googleAllDay,
  googleTimed,
  idsOf,
  localAllDay,
  localTimed,
  spMillis,
  spSeconds,
  withoutClock,
} from "./day-fixtures";

const TODAY = "2026-10-20";

/** `source:id` for every row, in order — the part of the Agenda the cases below talk about. */
function rows(items: readonly { source: string; id: string }[]): string[] {
  return items.map((item) => `${item.source}:${item.id}`);
}

describe("agendaItemsForToday — today's commitments from both sources", () => {
  it("returns nothing when neither source has anything", () => {
    expect(agendaItemsForToday([], [], TODAY)).toEqual([]);
  });

  it("lists local commitments when only the local source has any", () => {
    const local = [localTimed("dentist", spSeconds(TODAY, "09:30"), spSeconds(TODAY, "10:30"))];

    expect(rows(agendaItemsForToday(local, [], TODAY))).toEqual(["local:dentist"]);
  });

  it("lists Google events when only Google has any", () => {
    const google = [googleTimed("standup", spMillis(TODAY, "09:00"), spMillis(TODAY, "09:15"))];

    expect(rows(agendaItemsForToday([], google, TODAY))).toEqual(["google:standup"]);
  });

  it("counts both kinds together — one local and one Google row make two", () => {
    const local = [localTimed("dentist", spSeconds(TODAY, "09:30"), spSeconds(TODAY, "10:30"))];
    const google = [googleTimed("standup", spMillis(TODAY, "09:00"), spMillis(TODAY, "09:15"))];

    expect(agendaItemsForToday(local, google, TODAY)).toHaveLength(2);
  });

  it("puts all-day rows first, then timed rows by start, local before Google on a tie", () => {
    const local = [
      localTimed("l-0900", spSeconds(TODAY, "09:00"), spSeconds(TODAY, "10:00")),
      localAllDay("l-allday", TODAY, "2026-10-21"),
    ];
    const google = [
      googleTimed("g-0800", spMillis(TODAY, "08:00"), spMillis(TODAY, "09:00")),
      googleAllDay("g-allday", TODAY),
      googleTimed("g-0900", spMillis(TODAY, "09:00"), spMillis(TODAY, "10:00")),
    ];

    expect(rows(agendaItemsForToday(local, google, TODAY))).toEqual([
      "local:l-allday",
      "google:g-allday",
      "google:g-0800",
      "local:l-0900",
      "google:g-0900",
    ]);
  });

  it("orders across the two sources, not within them", () => {
    // The reason the order is derived and not trusted: the sources arrive separately, so a Google
    // morning event arrives after a local evening one.
    const local = [localTimed("evening", spSeconds(TODAY, "19:00"), spSeconds(TODAY, "20:00"))];
    const google = [googleTimed("morning", spMillis(TODAY, "08:00"), spMillis(TODAY, "09:00"))];

    expect(rows(agendaItemsForToday(local, google, TODAY))).toEqual([
      "google:morning",
      "local:evening",
    ]);
  });

  it("carries the original DTOs through, local under `event` and Google under `payload`", () => {
    const localEvent = localTimed("dentist", spSeconds(TODAY, "09:30"), spSeconds(TODAY, "10:30"));
    const googleEvent = googleTimed("standup", spMillis(TODAY, "10:00"), spMillis(TODAY, "10:15"));

    const [first, second] = agendaItemsForToday([localEvent], [googleEvent], TODAY);

    expect(first?.source === "local" && first.event).toBe(localEvent);
    expect(second?.source === "google" && second.payload).toBe(googleEvent);
  });
});

describe("agendaItemsForToday — only today", () => {
  it("leaves out yesterday, tomorrow and next Tuesday, for both kinds", () => {
    const local = [
      localTimed("l-yesterday", spSeconds("2026-10-19", "10:00"), spSeconds("2026-10-19", "11:00")),
      localTimed("l-tomorrow", spSeconds("2026-10-21", "10:00"), spSeconds("2026-10-21", "11:00")),
      localTimed("l-tuesday", spSeconds("2026-10-27", "10:00"), spSeconds("2026-10-27", "11:00")),
      localAllDay("l-allday-tomorrow", "2026-10-21", "2026-10-22"),
    ];
    const google = [
      googleTimed("g-yesterday", spMillis("2026-10-19", "10:00"), spMillis("2026-10-19", "11:00")),
      googleTimed("g-tuesday", spMillis("2026-10-27", "10:00"), spMillis("2026-10-27", "11:00")),
      googleAllDay("g-allday-tomorrow", "2026-10-21"),
    ];

    expect(agendaItemsForToday(local, google, TODAY)).toEqual([]);
  });

  it("keeps a late-evening commitment on ITS local day, not on the UTC one", () => {
    // 22:00 in São Paulo is 01:00 UTC tomorrow.
    const local = [localTimed("night", spSeconds(TODAY, "22:00"), spSeconds(TODAY, "23:00"))];
    const google = [googleTimed("g-night", spMillis(TODAY, "22:30"), spMillis(TODAY, "23:30"))];

    expect(rows(agendaItemsForToday(local, google, TODAY))).toEqual([
      "local:night",
      "google:g-night",
    ]);
  });

  it("treats local midnight as the first instant of the day and its last second as the last", () => {
    const local = [
      localTimed("first", spSeconds(TODAY, "00:00"), spSeconds(TODAY, "00:30")),
      localTimed("last", spSeconds(TODAY, "23:59"), spSeconds(TODAY, "23:59") + 30),
      localTimed("tomorrow", spSeconds("2026-10-21", "00:00"), spSeconds("2026-10-21", "00:30")),
    ];

    expect(rows(agendaItemsForToday(local, [], TODAY))).toEqual(["local:first", "local:last"]);
  });

  it("puts a Google event at 00:30 UTC tomorrow on today, because it is still last evening here", () => {
    const google = [
      googleTimed("late", Date.UTC(2026, 9, 21, 0, 30), Date.UTC(2026, 9, 21, 1, 30)),
    ];

    expect(rows(agendaItemsForToday([], google, TODAY))).toEqual(["google:late"]);
  });

  it("lists an overnight commitment on the day it continues into (plan decision D3-3)", () => {
    // It began at 23:00 yesterday and runs to 01:00 today: it is on today's Agenda too, listed
    // by its real start, which is before everything that starts today.
    const local = [
      localTimed("overnight", spSeconds("2026-10-19", "23:00"), spSeconds(TODAY, "01:00")),
      localTimed("morning", spSeconds(TODAY, "08:00"), spSeconds(TODAY, "09:00")),
    ];

    expect(rows(agendaItemsForToday(local, [], TODAY))).toEqual([
      "local:overnight",
      "local:morning",
    ]);
  });

  it("does not list a commitment that ended exactly at midnight when today began", () => {
    const local = [
      localTimed("ended", spSeconds("2026-10-19", "22:00"), spSeconds(TODAY, "00:00")),
    ];

    expect(agendaItemsForToday(local, [], TODAY)).toEqual([]);
  });

  it("lists a multi-day all-day commitment on every day it covers, first among today's rows (D3-3)", () => {
    // Both began before today: the retreat yesterday (covers the 19th to the 21st) and the trip
    // two days ago (Google's exclusive end 2026-10-21 makes the 20th its last day).
    const local = [localAllDay("retreat", "2026-10-19", "2026-10-22")];
    const google = [
      googleAllDay("trip", "2026-10-18", "2026-10-21"),
      googleTimed("standup", spMillis(TODAY, "09:00"), spMillis(TODAY, "09:15")),
    ];

    expect(rows(agendaItemsForToday(local, google, TODAY))).toEqual([
      "local:retreat",
      "google:trip",
      "google:standup",
    ]);
  });

  it("does not list a multi-day all-day commitment whose exclusive end is today", () => {
    const google = [googleAllDay("trip", "2026-10-18", TODAY)];

    expect(agendaItemsForToday([], google, TODAY)).toEqual([]);
  });
});

describe("agendaItemsForToday — purity", () => {
  it("does not mutate the lists it is given", () => {
    const local = Object.freeze([
      localTimed("b", spSeconds(TODAY, "15:00"), spSeconds(TODAY, "16:00")),
      localTimed("a", spSeconds(TODAY, "09:00"), spSeconds(TODAY, "10:00")),
    ]);
    const google = Object.freeze([
      googleTimed("d", spMillis(TODAY, "13:00"), spMillis(TODAY, "14:00")),
      googleTimed("c", spMillis(TODAY, "08:00"), spMillis(TODAY, "09:00")),
    ]);

    expect(() => agendaItemsForToday(local, google, TODAY)).not.toThrow();
    expect(idsOf(local)).toEqual(["b", "a"]);
    expect(idsOf(google)).toEqual(["d", "c"]);
  });

  it("reads no clock — today is an argument", () => {
    const local = [localTimed("a", spSeconds(TODAY, "09:00"), spSeconds(TODAY, "10:00"))];
    const google = [googleAllDay("g", TODAY)];

    const guarded = withoutClock(() => agendaItemsForToday(local, google, TODAY));

    expect(rows(guarded)).toEqual(["google:g", "local:a"]);
    expect(rows(agendaItemsForToday(local, google, "2026-10-21"))).toEqual([]);
  });
});

describe("agendaForToday — a thin caller of the range function (plan AC-A3)", () => {
  it("returns the very Google event objects it was given", () => {
    const first = googleTimed("a", spMillis(TODAY, "09:00"), spMillis(TODAY, "10:00"));
    const second = googleAllDay("b", TODAY);

    const answer = agendaForToday([first, second], TODAY);

    expect(answer).toHaveLength(2);
    expect(answer[0]).toBe(second);
    expect(answer[1]).toBe(first);
  });

  it("answers exactly the Google rows of the combined function with no local commitments", () => {
    const events = [
      googleTimed("late", spMillis(TODAY, "18:00"), spMillis(TODAY, "19:00")),
      googleAllDay("trip", "2026-10-18", "2026-10-22"),
      googleTimed("early", spMillis(TODAY, "07:00"), spMillis(TODAY, "08:00")),
      googleTimed("tomorrow", spMillis("2026-10-21", "07:00"), spMillis("2026-10-21", "08:00")),
    ];

    const viaCombined = agendaItemsForToday([], events, TODAY).flatMap((item) =>
      item.source === "google" ? [item.payload] : [],
    );

    expect(agendaForToday(events, TODAY)).toEqual(viaCombined);
    expect(idsOf(agendaForToday(events, TODAY))).toEqual(["trip", "early", "late"]);
  });

  it("keeps showing a multi-day all-day event on its later days (plan decision D3-3)", () => {
    // The old start-day-only rule dropped the second and third day of a trip.
    const trip = googleAllDay("trip", "2026-10-18", "2026-10-22");

    expect(idsOf(agendaForToday([trip], TODAY))).toEqual(["trip"]);
    expect(idsOf(agendaForToday([trip], "2026-10-21"))).toEqual(["trip"]);
    expect(idsOf(agendaForToday([trip], "2026-10-22"))).toEqual([]);
  });
});

describe("the Agenda's own copy", () => {
  it("keeps the empty line byte-for-byte what Hoje says today", () => {
    expect(AGENDA_EMPTY).toBe("Nada na agenda hoje.");
  });

  it("keeps the partial line byte-for-byte what Hoje says today, singular and plural", () => {
    expect(agendaPartialMessage(1)).toBe(
      "Um calendário não respondeu — a agenda pode estar incompleta.",
    );
    expect(agendaPartialMessage(2)).toBe(
      "2 calendários não responderam — a agenda pode estar incompleta.",
    );
    expect(agendaPartialMessage(5)).toBe(
      "5 calendários não responderam — a agenda pode estar incompleta.",
    );
  });
});

describe("decideAgendaNotice — a day is only ever free when every source said so", () => {
  const SENTINEL = "texto de dia livre";

  function notice(google: AgendaState, rowCount: number, othersReady = true): string | null {
    return decideAgendaNotice({ google, othersReady, rowCount, emptyText: SENTINEL });
  }

  const ANSWERS = [true, false] as const;
  const ROW_COUNTS = [0, 1, 4] as const;

  describe("while Google has not answered", () => {
    it("says nothing, whatever the rows and the other sources", () => {
      for (const othersReady of ANSWERS) {
        for (const rowCount of ROW_COUNTS) {
          expect(notice({ kind: "loading" }, rowCount, othersReady)).toBeNull();
        }
      }
    });
  });

  describe("when some calendars did not answer", () => {
    it("names the shortfall whatever the row count and the other sources", () => {
      for (const othersReady of ANSWERS) {
        for (const rowCount of ROW_COUNTS) {
          expect(notice({ kind: "partial", failed: 1 }, rowCount, othersReady)).toBe(
            "Um calendário não respondeu — a agenda pode estar incompleta.",
          );
        }
      }
    });

    it("counts the calendars that did not answer", () => {
      expect(notice({ kind: "partial", failed: 2 }, 3)).toBe(agendaPartialMessage(2));
      expect(notice({ kind: "partial", failed: 3 }, 0)).toBe(
        "3 calendários não responderam — a agenda pode estar incompleta.",
      );
    });
  });

  describe("when Google failed", () => {
    it("says why, in the unit-4 words, whatever the row count and the other sources", () => {
      for (const reason of ["not_connected", "invalid_grant", "http_500", null]) {
        for (const othersReady of ANSWERS) {
          for (const rowCount of ROW_COUNTS) {
            expect(notice({ kind: "failed", reason }, rowCount, othersReady)).toBe(
              googleFailureMessage(reason),
            );
          }
        }
      }
    });

    it("never reads as a free day: no rows and a failed Google is the failure, not the empty text", () => {
      expect(notice({ kind: "failed", reason: "not_connected" }, 0)).toBe("Google não conectado.");
      expect(notice({ kind: "failed", reason: null }, 0)).not.toBe(SENTINEL);
    });
  });

  describe("when Google answered", () => {
    it("says the day is free only with no rows and every other source answered", () => {
      expect(notice({ kind: "ready" }, 0, true)).toBe(SENTINEL);
    });

    it("never says the day is free while another source has not answered successfully", () => {
      expect(notice({ kind: "ready" }, 0, false)).toBeNull();
    });

    it("says nothing when there are rows to show", () => {
      for (const othersReady of ANSWERS) {
        expect(notice({ kind: "ready" }, 1, othersReady)).toBeNull();
        expect(notice({ kind: "ready" }, 4, othersReady)).toBeNull();
      }
    });

    it("passes the caller's empty text through verbatim", () => {
      const text = decideAgendaNotice({
        google: { kind: "ready" },
        othersReady: true,
        rowCount: 0,
        emptyText: "Nada neste dia.",
      });

      expect(text).toBe("Nada neste dia.");
    });
  });

  it("returns the empty text in exactly one situation, out of every combination", () => {
    const states: AgendaState[] = [
      { kind: "loading" },
      { kind: "ready" },
      { kind: "partial", failed: 1 },
      { kind: "failed", reason: null },
    ];
    const emptyTextAt: string[] = [];

    for (const state of states) {
      for (const othersReady of ANSWERS) {
        for (const rowCount of ROW_COUNTS) {
          if (notice(state, rowCount, othersReady) === SENTINEL) {
            emptyTextAt.push(`${state.kind}/othersReady=${othersReady}/rows=${rowCount}`);
          }
        }
      }
    }

    expect(emptyTextAt).toEqual(["ready/othersReady=true/rows=0"]);
  });

  it("reproduces today's Google-only notices byte for byte when the other sources are ready", () => {
    // What TodayScreen renders now (`AGENDA` + `googleFailureMessage`), for a Google-only Hoje.
    const decide = (google: AgendaState, rowCount: number) =>
      decideAgendaNotice({ google, othersReady: true, rowCount, emptyText: AGENDA_EMPTY });

    expect(decide({ kind: "loading" }, 0)).toBeNull();
    expect(decide({ kind: "ready" }, 0)).toBe("Nada na agenda hoje.");
    expect(decide({ kind: "ready" }, 2)).toBeNull();
    expect(decide({ kind: "partial", failed: 1 }, 2)).toBe(
      "Um calendário não respondeu — a agenda pode estar incompleta.",
    );
    expect(decide({ kind: "failed", reason: null }, 0)).toBe(
      "Não foi possível carregar a agenda agora. Tente novamente mais tarde.",
    );
    expect(decide({ kind: "failed", reason: "invalid_grant" }, 0)).toBe(
      "A conexão com o Google expirou. Reconecte para ver a agenda.",
    );
  });
});
