// PRPs/prds/events-and-day-view.prd.md AC-27 Draft and patch builders (the last clause: "the sheet
// state keeps one draft per event for the session as the Task sheet does")
// PRPs/prds/events-and-day-view.prd.md AC-28 The Compromisso sheet (the decidable half: "a closed
// sheet keeps its unsaved draft in memory", "prefilled with that date", "Excluir behind an
// irreversible confirmation")
//
// Source plan: PRPs/plans/events-and-day-view-phase-4-the-compromisso-sheet-and-search-results.plan.md
// (Task 2 - src/shared/event-sheet.ts: EventSheetView, EventSheetTarget, EventSheetState,
// INITIAL_EVENT_SHEET_STATE, eventSheetKey, currentEventDraft, EventSheetEvent, reduceEventSheet;
// plan AC-A5).
//
// Pure, DOM-free, clock-free unit under test: the sheet's state machine - which commitment is
// open, which view the sheet shows, one kept draft per commitment, one per DAY for new ones, and
// a snapshot of the commitment being edited. The native <dialog>, the fields and the POST / PATCH
// / DELETE requests are the exempt glue of docs/context/methodology.md; they are verified in the
// browser pane and on the device. What a draft holds and what a save sends live in
// test/event-edit.test.ts and are not re-tested here.
//
// The discriminating cases once the module exists: `open` and `open-new` must NOT re-seed a draft
// that is already kept (a reducer that always seeds fails the restore rule), `close` must keep
// every draft, `saved` / `deleted` must drop only the draft of their own key and close the sheet
// only when that key is the open one (a response that arrives after the owner moved on closes
// nothing), a Google row must never open the sheet, and every no-op must return the very same
// state object.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): src/shared/event-sheet.ts
// does not exist yet, so this file is RED for the right reason - the module import cannot be
// resolved - until plan Task 2 lands.
//
// Deliberately NOT pinned (the plan is silent): whether `open` / `open-new` / `edit` return a new
// state object when they change nothing observable (only the no-ops the plan names are pinned as
// identical); whether an `edit` whose every change was dropped (an unknown zone) returns the same
// state object or an equal one; whether `target.event` is the very object passed to `open` or a
// copy of it (only equality is asserted).

import { describe, expect, it } from "vitest";
import type { EventDto } from "../src/shared/api";
import { eventDraftFromEvent, newEventDraft } from "../src/shared/event-edit";
import type { EventDraft } from "../src/shared/event-edit";
import {
  INITIAL_EVENT_SHEET_STATE,
  currentEventDraft,
  eventSheetKey,
  reduceEventSheet,
} from "../src/shared/event-sheet";
import type { EventSheetEvent, EventSheetState } from "../src/shared/event-sheet";
import { localAllDay, localTimed, spSeconds, withoutClock } from "./day-fixtures";

const NOW = spSeconds("2026-10-20", "14:00");
const DAY = "2026-10-25";
const OTHER_DAY = "2026-10-26";

const dentist = localTimed(
  "event-1",
  spSeconds("2026-10-20", "09:30"),
  spSeconds("2026-10-20", "10:30"),
  { title: "Dentista" },
);
const holiday = localAllDay("event-2", "2026-10-26", "2026-10-27", { title: "Feriado" });
const googleRow = localTimed(
  "google-1",
  spSeconds("2026-10-20", "11:00"),
  spSeconds("2026-10-20", "12:00"),
  { title: "Reunião do Google", source: "google" },
);
const googleAllDay = localAllDay("google-2", "2026-10-26", "2026-10-27", { source: "google" });

/** Applies `events` to `state`, one after the other. */
function run(state: EventSheetState, ...events: EventSheetEvent[]): EventSheetState {
  return events.reduce(reduceEventSheet, state);
}

function openedNew(day = DAY): EventSheetState {
  return run(INITIAL_EVENT_SHEET_STATE, { type: "open-new", day, nowSeconds: NOW });
}

function openedEdit(event: EventDto = dentist): EventSheetState {
  return run(INITIAL_EVENT_SHEET_STATE, { type: "open", event });
}

/** The draft kept under `key`; fails the test loudly when there is none. */
function draftOf(state: EventSheetState, key: string): EventDraft {
  const found = state.drafts[key];
  if (found === undefined) throw new Error(`no draft is kept under ${key}`);
  return found;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

describe("the initial state and the keys", () => {
  it("starts closed, in the form view, with no draft kept", () => {
    expect(INITIAL_EVENT_SHEET_STATE).toStrictEqual({ target: null, view: "form", drafts: {} });
  });

  it("keys a new commitment by its DAY and an edit by the Event's id", () => {
    expect(eventSheetKey({ kind: "new", day: "2026-10-20" })).toBe("new:2026-10-20");
    expect(eventSheetKey({ kind: "new", day: "2026-10-21" })).toBe("new:2026-10-21");
    expect(eventSheetKey({ kind: "edit", event: dentist })).toBe("event-1");
    expect(eventSheetKey({ kind: "edit", event: holiday })).toBe("event-2");
  });

  it("has no current draft while the sheet is closed", () => {
    expect(currentEventDraft(INITIAL_EVENT_SHEET_STATE)).toBeNull();
  });

  it("returns the kept draft itself as the current one while the sheet is open", () => {
    const state = openedNew();
    expect(currentEventDraft(state)).toBe(draftOf(state, "new:2026-10-25"));
    const editing = openedEdit();
    expect(currentEventDraft(editing)).toBe(draftOf(editing, "event-1"));
  });

  it("has no current draft after the sheet closes, though the draft is kept", () => {
    const closed = run(openedNew(), { type: "close" });
    expect(currentEventDraft(closed)).toBeNull();
    expect(Object.keys(closed.drafts)).toEqual(["new:2026-10-25"]);
  });
});

describe("AC-28 open-new - a commitment that does not exist yet", () => {
  it("opens the sheet on the day, in the form view, with a fresh draft", () => {
    const state = openedNew();
    expect(state.target).toEqual({ kind: "new", day: DAY });
    expect(state.view).toBe("form");
    expect(Object.keys(state.drafts)).toEqual(["new:2026-10-25"]);
    expect(currentEventDraft(state)).toEqual(newEventDraft(DAY, NOW));
  });

  it("prefills the day it was opened for with 09:00, an empty title and an empty end", () => {
    expect(currentEventDraft(openedNew())).toMatchObject({
      title: "",
      allDay: false,
      startDay: DAY,
      startTime: "09:00",
      endDay: "",
      endTime: "",
      timezone: "America/Sao_Paulo",
    });
  });

  it("seeds the start from the clock it was handed when the day is today", () => {
    const state = run(INITIAL_EVENT_SHEET_STATE, {
      type: "open-new",
      day: "2026-10-20",
      nowSeconds: NOW,
    });
    expect(currentEventDraft(state)?.startTime).toBe("15:00");
  });

  it("restores a kept draft untouched instead of re-seeding it", () => {
    const today = "2026-10-20";
    const edited = run(
      INITIAL_EVENT_SHEET_STATE,
      { type: "open-new", day: today, nowSeconds: NOW },
      { type: "edit", changes: { title: "Jantar" } },
    );
    expect(currentEventDraft(edited)?.startTime).toBe("15:00");

    const closed = run(edited, { type: "close" });
    // Three hours later a fresh seed would read 18:00; the kept draft must not move.
    const reopened = reduceEventSheet(closed, {
      type: "open-new",
      day: today,
      nowSeconds: spSeconds(today, "17:00"),
    });
    expect(reopened.target).toEqual({ kind: "new", day: today });
    expect(reopened.view).toBe("form");
    expect(currentEventDraft(reopened)).toBe(draftOf(edited, `new:${today}`));
    expect(currentEventDraft(reopened)?.title).toBe("Jantar");
    expect(currentEventDraft(reopened)?.startTime).toBe("15:00");
  });

  it("keeps one draft per DAY: another day opens prefilled with THAT day", () => {
    const first = run(openedNew(DAY), { type: "edit", changes: { title: "Jantar" } });
    const second = reduceEventSheet(first, {
      type: "open-new",
      day: OTHER_DAY,
      nowSeconds: NOW,
    });
    expect(second.target).toEqual({ kind: "new", day: OTHER_DAY });
    expect(currentEventDraft(second)).toEqual(newEventDraft(OTHER_DAY, NOW));
    expect(currentEventDraft(second)?.startDay).toBe(OTHER_DAY);
    expect(currentEventDraft(second)?.title).toBe("");
    expect(Object.keys(second.drafts).sort()).toEqual(["new:2026-10-25", "new:2026-10-26"]);
    expect(second.drafts["new:2026-10-25"]).toBe(first.drafts["new:2026-10-25"]);
  });

  it("restores each day's draft when the owner comes back to that day", () => {
    const state = run(
      INITIAL_EVENT_SHEET_STATE,
      { type: "open-new", day: DAY, nowSeconds: NOW },
      { type: "edit", changes: { title: "Jantar" } },
      { type: "close" },
      { type: "open-new", day: OTHER_DAY, nowSeconds: NOW },
      { type: "edit", changes: { title: "Almoço" } },
      { type: "close" },
      { type: "open-new", day: DAY, nowSeconds: NOW },
    );
    expect(currentEventDraft(state)?.title).toBe("Jantar");
    const back = reduceEventSheet(state, { type: "open-new", day: OTHER_DAY, nowSeconds: NOW });
    expect(currentEventDraft(back)?.title).toBe("Almoço");
  });

  it("returns to the form view when it opens from a delete confirmation", () => {
    const confirming = run(openedEdit(), { type: "request-delete" });
    expect(confirming.view).toBe("confirm");
    const next = reduceEventSheet(confirming, { type: "open-new", day: DAY, nowSeconds: NOW });
    expect(next.view).toBe("form");
    expect(next.target).toEqual({ kind: "new", day: DAY });
    expect(next.drafts["event-1"]).toBe(confirming.drafts["event-1"]);
  });
});

describe("AC-28 open - a commitment that exists", () => {
  it("opens a local Event in the form view with its draft seeded from the Event", () => {
    const state = openedEdit();
    expect(state.target).toEqual({ kind: "edit", event: dentist });
    expect(state.view).toBe("form");
    expect(Object.keys(state.drafts)).toEqual(["event-1"]);
    expect(currentEventDraft(state)).toEqual(eventDraftFromEvent(dentist));
  });

  it("opens an all-day Event the same way", () => {
    const state = openedEdit(holiday);
    expect(state.target).toEqual({ kind: "edit", event: holiday });
    expect(currentEventDraft(state)).toEqual(eventDraftFromEvent(holiday));
    expect(currentEventDraft(state)?.endDay).toBe("2026-10-26");
  });

  it("restores a kept draft untouched instead of re-seeding it", () => {
    const edited = run(openedEdit(), { type: "edit", changes: { title: "Dentista (retorno)" } });
    const closed = run(edited, { type: "close" });
    const reopened = reduceEventSheet(closed, { type: "open", event: dentist });
    expect(reopened.target).toEqual({ kind: "edit", event: dentist });
    expect(reopened.view).toBe("form");
    expect(reopened.drafts["event-1"]).toBe(edited.drafts["event-1"]);
    expect(currentEventDraft(reopened)?.title).toBe("Dentista (retorno)");
  });

  it("takes the snapshot it is handed on a reopen, and still restores the kept draft", () => {
    const edited = run(openedEdit(), { type: "edit", changes: { title: "Dentista (retorno)" } });
    const closed = run(edited, { type: "close" });
    const refreshed: EventDto = {
      ...dentist,
      title: "Dentista (remarcado)",
      updatedAt: 1_700_000_500,
    };
    const reopened = reduceEventSheet(closed, { type: "open", event: refreshed });
    expect(reopened.target).toEqual({ kind: "edit", event: refreshed });
    expect(reopened.drafts["event-1"]).toBe(edited.drafts["event-1"]);
  });

  it("keeps the drafts of other commitments when another one opens", () => {
    const first = run(openedEdit(dentist), {
      type: "edit",
      changes: { location: "Consultório 2" },
    });
    const second = reduceEventSheet(first, { type: "open", event: holiday });
    expect(second.target).toEqual({ kind: "edit", event: holiday });
    expect(second.drafts["event-1"]).toBe(first.drafts["event-1"]);
    expect(second.drafts["event-2"]).toEqual(eventDraftFromEvent(holiday));
  });

  it("keeps a new-commitment draft when an Event opens, and the Event's when a new one opens", () => {
    const newDraft = run(openedNew(), { type: "edit", changes: { title: "Jantar" } });
    const withEvent = reduceEventSheet(newDraft, { type: "open", event: dentist });
    expect(withEvent.drafts["new:2026-10-25"]).toBe(newDraft.drafts["new:2026-10-25"]);
    const eventDraft = draftOf(withEvent, "event-1");
    const backToNew = reduceEventSheet(withEvent, { type: "open-new", day: DAY, nowSeconds: NOW });
    expect(backToNew.drafts["event-1"]).toBe(eventDraft);
  });

  it("returns to the form view when it opens from a delete confirmation", () => {
    const confirming = run(openedEdit(dentist), { type: "request-delete" });
    const next = reduceEventSheet(confirming, { type: "open", event: holiday });
    expect(next.view).toBe("form");
  });

  it("keeps the snapshot it opened with while the owner edits", () => {
    const state = run(
      openedEdit(),
      { type: "edit", changes: { title: "Outro título" } },
      { type: "edit", changes: { startTime: "10:00" } },
      { type: "request-delete" },
      { type: "cancel-delete" },
    );
    expect(state.target).toEqual({ kind: "edit", event: dentist });
  });
});

describe("AC-28 open - a Google row can never open the sheet", () => {
  it.each([
    ["a timed Google event", googleRow],
    ["an all-day Google event", googleAllDay],
  ])("returns the very same state object for %s", (_label, event) => {
    expect(reduceEventSheet(INITIAL_EVENT_SHEET_STATE, { type: "open", event })).toBe(
      INITIAL_EVENT_SHEET_STATE,
    );
  });

  it("changes nothing while another commitment is open, and keeps no draft for it", () => {
    const open = openedEdit(dentist);
    const after = reduceEventSheet(open, { type: "open", event: googleRow });
    expect(after).toBe(open);
    expect(after.drafts["google-1"]).toBeUndefined();
  });

  it("changes nothing while a new commitment is open, or in the confirmation", () => {
    const editing = openedNew();
    expect(reduceEventSheet(editing, { type: "open", event: googleRow })).toBe(editing);
    const confirming = run(openedEdit(dentist), { type: "request-delete" });
    expect(reduceEventSheet(confirming, { type: "open", event: googleRow })).toBe(confirming);
  });
});

describe("AC-28 edit - the changes go into the open draft", () => {
  it("merges the changes into the open draft and touches nothing else", () => {
    const opened = openedEdit(dentist);
    const withOther = reduceEventSheet(opened, { type: "open-new", day: DAY, nowSeconds: NOW });
    const reopened = reduceEventSheet(withOther, { type: "open", event: dentist });
    const after = reduceEventSheet(reopened, {
      type: "edit",
      changes: { title: "Dentista (retorno)", allDay: true },
    });
    expect(currentEventDraft(after)).toEqual({
      ...eventDraftFromEvent(dentist),
      title: "Dentista (retorno)",
      allDay: true,
    });
    expect(after.target).toEqual({ kind: "edit", event: dentist });
    expect(after.view).toBe("form");
    expect(after.drafts["new:2026-10-25"]).toBe(reopened.drafts["new:2026-10-25"]);
  });

  it("keeps the earlier edits when a later one arrives", () => {
    const after = run(
      openedEdit(dentist),
      { type: "edit", changes: { title: "A" } },
      { type: "edit", changes: { location: "B" } },
    );
    expect(currentEventDraft(after)).toMatchObject({ title: "A", location: "B" });
  });

  it("edits a new commitment's draft too", () => {
    const after = reduceEventSheet(openedNew(), {
      type: "edit",
      changes: { title: "Jantar", startTime: "19:30", endTime: "21:00" },
    });
    expect(currentEventDraft(after)).toEqual({
      ...newEventDraft(DAY, NOW),
      title: "Jantar",
      startTime: "19:30",
      endTime: "21:00",
    });
  });

  it("returns the very same state when the sheet is closed", () => {
    expect(
      reduceEventSheet(INITIAL_EVENT_SHEET_STATE, { type: "edit", changes: { title: "x" } }),
    ).toBe(INITIAL_EVENT_SHEET_STATE);
    const closed = run(openedEdit(), { type: "close" });
    expect(reduceEventSheet(closed, { type: "edit", changes: { title: "x" } })).toBe(closed);
  });

  it("returns the very same state when the open commitment has no kept draft", () => {
    const odd: EventSheetState = {
      target: { kind: "new", day: DAY },
      view: "form",
      drafts: {},
    };
    expect(reduceEventSheet(odd, { type: "edit", changes: { title: "x" } })).toBe(odd);
  });

  it("applies a time zone the runtime knows", () => {
    const after = reduceEventSheet(openedEdit(dentist), {
      type: "edit",
      changes: { timezone: "America/New_York" },
    });
    expect(currentEventDraft(after)?.timezone).toBe("America/New_York");
  });

  it.each(["Mars/Base", "", "not a zone"])(
    "drops a time zone the runtime refuses (%j)",
    (timezone) => {
      const opened = openedEdit(dentist);
      const seed = eventDraftFromEvent(dentist);

      const only = reduceEventSheet(opened, { type: "edit", changes: { timezone } });
      expect(currentEventDraft(only)).toEqual(seed);

      const beside = reduceEventSheet(opened, {
        type: "edit",
        changes: { timezone, title: "Outro" },
      });
      expect(currentEventDraft(beside)).toEqual({ ...seed, title: "Outro" });
    },
  );

  it("does not mutate the state it was given", () => {
    const opened = openedEdit(dentist);
    const before = structuredClone(opened);
    reduceEventSheet(opened, { type: "edit", changes: { title: "Outro" } });
    expect(opened).toEqual(before);
  });
});

describe("AC-28 request-delete and cancel-delete - the irreversible confirmation", () => {
  it("opens the confirmation for an edit target and keeps the draft intact", () => {
    const edited = run(openedEdit(), { type: "edit", changes: { title: "Dentista (retorno)" } });
    const confirming = reduceEventSheet(edited, { type: "request-delete" });
    expect(confirming.view).toBe("confirm");
    expect(confirming.target).toEqual({ kind: "edit", event: dentist });
    expect(confirming.drafts["event-1"]).toBe(edited.drafts["event-1"]);
  });

  it("returns to the form with the draft intact when the owner cancels", () => {
    const edited = run(openedEdit(), { type: "edit", changes: { title: "Dentista (retorno)" } });
    const back = run(edited, { type: "request-delete" }, { type: "cancel-delete" });
    expect(back.view).toBe("form");
    expect(back.target).toEqual({ kind: "edit", event: dentist });
    expect(back.drafts["event-1"]).toBe(edited.drafts["event-1"]);
  });

  it("closing from the confirmation closes the whole sheet and keeps every draft", () => {
    const confirming = run(openedEdit(), { type: "request-delete" });
    const closed = reduceEventSheet(confirming, { type: "close" });
    expect(closed.target).toBeNull();
    expect(closed.view).toBe("form");
    expect(closed.drafts["event-1"]).toBe(confirming.drafts["event-1"]);
  });

  it("has no delete for a new commitment: request-delete returns the very same state", () => {
    const state = openedNew();
    expect(reduceEventSheet(state, { type: "request-delete" })).toBe(state);
  });

  it("has no confirmation to ask for while the sheet is closed", () => {
    expect(reduceEventSheet(INITIAL_EVENT_SHEET_STATE, { type: "request-delete" })).toBe(
      INITIAL_EVENT_SHEET_STATE,
    );
    expect(reduceEventSheet(INITIAL_EVENT_SHEET_STATE, { type: "cancel-delete" })).toBe(
      INITIAL_EVENT_SHEET_STATE,
    );
  });

  it("asks only once: request-delete from the confirmation returns the very same state", () => {
    const confirming = run(openedEdit(), { type: "request-delete" });
    expect(reduceEventSheet(confirming, { type: "request-delete" })).toBe(confirming);
  });

  it("has nothing to cancel in the form: cancel-delete returns the very same state", () => {
    const state = openedEdit();
    expect(reduceEventSheet(state, { type: "cancel-delete" })).toBe(state);
    const fresh = openedNew();
    expect(reduceEventSheet(fresh, { type: "cancel-delete" })).toBe(fresh);
  });
});

describe("AC-28 close - a closed sheet keeps its unsaved draft in memory", () => {
  it("closes an open sheet, back in the form view, keeping every draft by reference", () => {
    const state = run(
      INITIAL_EVENT_SHEET_STATE,
      { type: "open", event: dentist },
      { type: "edit", changes: { title: "A" } },
      { type: "open", event: holiday },
      { type: "edit", changes: { title: "B" } },
      { type: "open-new", day: DAY, nowSeconds: NOW },
      { type: "edit", changes: { title: "C" } },
    );
    const closed = reduceEventSheet(state, { type: "close" });
    expect(closed.target).toBeNull();
    expect(closed.view).toBe("form");
    expect(Object.keys(closed.drafts).sort()).toEqual(["event-1", "event-2", "new:2026-10-25"]);
    for (const key of Object.keys(state.drafts)) {
      expect(closed.drafts[key]).toBe(state.drafts[key]);
    }
  });

  it("returns the very same state when the sheet is already closed", () => {
    expect(reduceEventSheet(INITIAL_EVENT_SHEET_STATE, { type: "close" })).toBe(
      INITIAL_EVENT_SHEET_STATE,
    );
    const closed = run(openedEdit(), { type: "close" });
    expect(reduceEventSheet(closed, { type: "close" })).toBe(closed);
  });
});

describe.each(["saved", "deleted"] as const)(
  "AC-28 %s - the server now holds the truth",
  (type) => {
    it("drops the draft of the open commitment and closes the sheet", () => {
      const state = run(openedEdit(), { type: "edit", changes: { title: "Dentista (retorno)" } });
      const after = reduceEventSheet(state, { type, key: "event-1" });
      expect(after.target).toBeNull();
      expect(after.view).toBe("form");
      expect(after.drafts).toEqual({});
      expect(after.drafts).not.toBe(state.drafts);
      // The state it was given is untouched.
      expect(Object.keys(state.drafts)).toEqual(["event-1"]);
    });

    it("leaves every other draft with its exact reference", () => {
      const state = run(
        INITIAL_EVENT_SHEET_STATE,
        { type: "open", event: holiday },
        { type: "edit", changes: { title: "B" } },
        { type: "open-new", day: DAY, nowSeconds: NOW },
        { type: "edit", changes: { title: "C" } },
        { type: "open", event: dentist },
      );
      const after = reduceEventSheet(state, { type, key: "event-1" });
      expect(Object.keys(after.drafts).sort()).toEqual(["event-2", "new:2026-10-25"]);
      expect(after.drafts["event-2"]).toBe(state.drafts["event-2"]);
      expect(after.drafts["new:2026-10-25"]).toBe(state.drafts["new:2026-10-25"]);
    });

    it("closes from the delete confirmation too", () => {
      const confirming = run(openedEdit(), { type: "request-delete" });
      const after = reduceEventSheet(confirming, { type, key: "event-1" });
      expect(after.target).toBeNull();
      expect(after.view).toBe("form");
      expect(after.drafts).toEqual({});
    });

    it("drops a new commitment's day draft, so the next one opens fresh", () => {
      const key = eventSheetKey({ kind: "new", day: DAY });
      const state = run(openedNew(), {
        type: "edit",
        changes: { title: "Jantar", endTime: "21:00" },
      });
      const after = reduceEventSheet(state, { type, key });
      expect(after.target).toBeNull();
      expect(after.drafts).toEqual({});

      const again = reduceEventSheet(after, { type: "open-new", day: DAY, nowSeconds: NOW });
      expect(currentEventDraft(again)).toEqual(newEventDraft(DAY, NOW));
      expect(currentEventDraft(again)?.title).toBe("");
    });

    it("closes nothing when the response belongs to a commitment the owner moved away from", () => {
      const state = run(
        INITIAL_EVENT_SHEET_STATE,
        { type: "open", event: dentist },
        { type: "edit", changes: { title: "Dentista (retorno)" } },
        { type: "close" },
        { type: "open", event: holiday },
      );
      const after = reduceEventSheet(state, { type, key: "event-1" });
      expect(after.target).toEqual({ kind: "edit", event: holiday });
      expect(after.view).toBe("form");
      expect(Object.keys(after.drafts)).toEqual(["event-2"]);
      expect(after.drafts["event-2"]).toBe(state.drafts["event-2"]);
    });

    it("keeps the confirmation of the commitment that is open", () => {
      const state = run(
        INITIAL_EVENT_SHEET_STATE,
        { type: "open", event: dentist },
        { type: "close" },
        { type: "open", event: holiday },
        { type: "request-delete" },
      );
      const after = reduceEventSheet(state, { type, key: "event-1" });
      expect(after.view).toBe("confirm");
      expect(after.target).toEqual({ kind: "edit", event: holiday });
    });

    it("closes nothing and keeps the draft of a new commitment when an Event's response arrives", () => {
      const state = run(
        openedEdit(dentist),
        { type: "close" },
        { type: "open-new", day: DAY, nowSeconds: NOW },
      );
      const after = reduceEventSheet(state, { type, key: "event-1" });
      expect(after.target).toEqual({ kind: "new", day: DAY });
      expect(after.drafts["new:2026-10-25"]).toBe(state.drafts["new:2026-10-25"]);
      expect(after.drafts["event-1"]).toBeUndefined();
    });

    it("drops the draft of a commitment while the sheet is closed", () => {
      const closed = run(openedEdit(), { type: "close" });
      const after = reduceEventSheet(closed, { type, key: "event-1" });
      expect(after.target).toBeNull();
      expect(after.drafts).toEqual({});
    });

    it("returns the very same state when there is no such draft and another commitment is open", () => {
      const state = openedEdit(dentist);
      expect(reduceEventSheet(state, { type, key: "event-9" })).toBe(state);
      const fresh = openedNew();
      expect(reduceEventSheet(fresh, { type, key: "event-1" })).toBe(fresh);
    });

    it("returns the very same state when there is no such draft and the sheet is closed", () => {
      expect(reduceEventSheet(INITIAL_EVENT_SHEET_STATE, { type, key: "event-1" })).toBe(
        INITIAL_EVENT_SHEET_STATE,
      );
      const closed = run(openedEdit(), { type: "close" });
      expect(reduceEventSheet(closed, { type, key: "event-9" })).toBe(closed);
    });
  },
);

describe("the reducer is total, pure and clock-free", () => {
  it("never mutates a state it was given, whatever the sequence of events", () => {
    let state = deepFreeze(structuredClone(INITIAL_EVENT_SHEET_STATE));
    const frozenDentist = deepFreeze(structuredClone(dentist));
    const frozenHoliday = deepFreeze(structuredClone(holiday));
    const sequence: EventSheetEvent[] = [
      { type: "open-new", day: DAY, nowSeconds: NOW },
      { type: "edit", changes: { title: "Jantar" } },
      { type: "close" },
      { type: "open", event: frozenDentist },
      { type: "edit", changes: { title: "Dentista (retorno)", timezone: "America/New_York" } },
      { type: "request-delete" },
      { type: "cancel-delete" },
      { type: "request-delete" },
      { type: "close" },
      { type: "open", event: frozenHoliday },
      { type: "edit", changes: { allDay: false } },
      { type: "saved", key: "event-1" },
      { type: "deleted", key: "event-2" },
      { type: "saved", key: "new:2026-10-25" },
    ];
    for (const step of sequence) {
      state = deepFreeze(reduceEventSheet(state, step));
    }
    expect(state.target).toBeNull();
    expect(state.drafts).toEqual({});
  });

  it("reads no clock: the instant arrives inside open-new", () => {
    expect(() =>
      withoutClock(() => {
        run(
          INITIAL_EVENT_SHEET_STATE,
          { type: "open-new", day: "2026-10-20", nowSeconds: NOW },
          { type: "edit", changes: { title: "x" } },
          { type: "close" },
          { type: "open", event: dentist },
          { type: "request-delete" },
          { type: "saved", key: "event-1" },
        );
      }),
    ).not.toThrow();
  });

  it("keeps its invariants over a long deterministic sequence of events", () => {
    const pool: EventSheetEvent[] = [
      { type: "open-new", day: "2026-10-20", nowSeconds: NOW },
      { type: "open-new", day: "2026-10-21", nowSeconds: NOW },
      { type: "open", event: dentist },
      { type: "open", event: holiday },
      { type: "open", event: googleRow },
      { type: "edit", changes: { title: "x" } },
      { type: "edit", changes: { timezone: "Mars/Base" } },
      { type: "edit", changes: { allDay: true } },
      { type: "request-delete" },
      { type: "cancel-delete" },
      { type: "close" },
      { type: "saved", key: "new:2026-10-20" },
      { type: "saved", key: "event-1" },
      { type: "deleted", key: "event-2" },
      { type: "deleted", key: "new:2026-10-21" },
      { type: "saved", key: "unknown" },
    ];
    const knownKeys = new Set(["new:2026-10-20", "new:2026-10-21", "event-1", "event-2"]);

    let seed = 20261021;
    const next = (): number => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };

    let state = INITIAL_EVENT_SHEET_STATE;
    for (let step = 0; step < 3000; step += 1) {
      const event = pool[next() % pool.length];
      if (event === undefined) throw new Error("the event pool is empty");
      state = reduceEventSheet(state, event);

      if (state.target === null) {
        expect(state.view).toBe("form");
        expect(currentEventDraft(state)).toBeNull();
      } else {
        // An open sheet always has a kept draft, and a Google row is never the one open.
        expect(currentEventDraft(state)).toBe(state.drafts[eventSheetKey(state.target)]);
        expect(currentEventDraft(state)).not.toBeUndefined();
        if (state.target.kind === "edit") expect(state.target.event.source).toBe("local");
      }
      if (state.view === "confirm") expect(state.target?.kind).toBe("edit");
      for (const key of Object.keys(state.drafts)) {
        expect(knownKeys.has(key)).toBe(true);
        expect(draftOf(state, key).timezone).not.toBe("Mars/Base");
      }
    }
  });
});
