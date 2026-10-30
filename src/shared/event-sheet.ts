/**
 * The state machine behind the Compromisso sheet (unit 14 `events-and-day-view`
 * phase 4, PRD AC-27 and AC-28): `task-sheet.ts` for an Event. Which commitment is
 * open (or whether a new one is being written), which view the sheet shows, and one
 * in-memory draft per commitment for the session, so a closed sheet keeps what the
 * owner had typed (guidelines §8, "Dirty editor closed") and restores it on reopen.
 *
 * Two differences from the Task sheet, both on purpose:
 *
 *  - **A new commitment is kept per DAY** (`new:<day>`), so reopening *Novo
 *    compromisso* on a day restores that day's draft, while on another day it opens
 *    prefilled with THAT day (PRD AC-28).
 *  - **An edit target carries a SNAPSHOT** of the Event as it was when the sheet
 *    opened, so the sheet depends on no screen's list: a refetch that no longer holds
 *    the Event (it was deleted on another device) cannot blank or close the sheet,
 *    and the patch is computed against the snapshot.
 *
 * Total and side-effect free: no DOM, no timer, no network, no clock (the instant
 * arrives inside `open-new`). The no-ops pinned by the pair's suite (a Google row
 * opened, a delete requested on a new commitment or twice, a confirmation cancelled
 * when none is showing, a close or a response with nothing to act on, an `edit` with
 * no open target) return the very same state object; `open-new`, `open` of an
 * editable Event and an `edit` of an open draft always yield a new state, even when
 * `changes` is empty or only holds a zone that gets stripped.
 */

import type { EventDto } from "./api";
import { eventDraftFromEvent, newEventDraft, type EventDraft } from "./event-edit";
import { eventCapabilities, isValidTimeZone } from "./events";

export type EventSheetView = "form" | "confirm";

/** What the open sheet is about: a commitment that does not exist yet, or one that does. */
export type EventSheetTarget = { kind: "new"; day: string } | { kind: "edit"; event: EventDto };

export interface EventSheetState {
  /** `null` while the sheet is closed. */
  target: EventSheetTarget | null;
  view: EventSheetView;
  /** One kept draft per `eventSheetKey`, restored untouched on reopen. */
  drafts: Readonly<Record<string, EventDraft>>;
}

export const INITIAL_EVENT_SHEET_STATE: EventSheetState = {
  target: null,
  view: "form",
  drafts: {},
};

/** `new:<day>` for a new commitment, the Event's `id` for an edit. */
export function eventSheetKey(target: EventSheetTarget): string {
  return target.kind === "new" ? `new:${target.day}` : target.event.id;
}

/** The kept draft of the open target; `null` while the sheet is closed. */
export function currentEventDraft(state: EventSheetState): EventDraft | null {
  if (state.target === null) return null;
  return state.drafts[eventSheetKey(state.target)] ?? null;
}

export type EventSheetEvent =
  | { type: "open-new"; day: string; nowSeconds: number }
  | { type: "open"; event: EventDto }
  | { type: "edit"; changes: Partial<EventDraft> }
  | { type: "request-delete" }
  | { type: "cancel-delete" }
  | { type: "close" }
  | { type: "saved"; key: string }
  | { type: "deleted"; key: string };

/** `changes` without a time zone the runtime refuses (the select cannot produce one; the invariant is kept here). */
function withoutUnknownZone(changes: Partial<EventDraft>): Partial<EventDraft> {
  const { timezone, ...rest } = changes;
  if (timezone === undefined || isValidTimeZone(timezone)) return changes;
  return rest;
}

export function reduceEventSheet(state: EventSheetState, event: EventSheetEvent): EventSheetState {
  switch (event.type) {
    case "open-new": {
      const target: EventSheetTarget = { kind: "new", day: event.day };
      const key = eventSheetKey(target);
      return {
        target,
        view: "form",
        // A kept draft is restored untouched, so only a day with none gets seeded.
        drafts: {
          ...state.drafts,
          [key]: state.drafts[key] ?? newEventDraft(event.day, event.nowSeconds),
        },
      };
    }
    case "open": {
      // A Google row is read-only and opens in Google: it can never open this sheet.
      if (!eventCapabilities(event.event.source).editable) return state;
      const target: EventSheetTarget = { kind: "edit", event: event.event };
      const key = eventSheetKey(target);
      return {
        target,
        view: "form",
        drafts: {
          ...state.drafts,
          [key]: state.drafts[key] ?? eventDraftFromEvent(event.event),
        },
      };
    }
    case "edit": {
      if (state.target === null) return state;
      const key = eventSheetKey(state.target);
      const draft = state.drafts[key];
      if (draft === undefined) return state;
      return {
        ...state,
        drafts: { ...state.drafts, [key]: { ...draft, ...withoutUnknownZone(event.changes) } },
      };
    }
    case "request-delete":
      // A new commitment has nothing to delete; the confirmation is asked once.
      if (state.target === null || state.target.kind !== "edit" || state.view !== "form") {
        return state;
      }
      return { ...state, view: "confirm" };
    case "cancel-delete":
      if (state.view !== "confirm") return state;
      return { ...state, view: "form" };
    case "close":
      if (state.target === null) return state;
      return { ...state, target: null, view: "form" };
    case "saved":
    case "deleted": {
      const hasDraft = Object.hasOwn(state.drafts, event.key);
      const isOpen = state.target !== null && eventSheetKey(state.target) === event.key;
      if (!hasDraft && !isOpen) return state;
      // A fresh `drafts` object via `Object.entries`, never a mutation of the old
      // one; every other draft keeps its exact reference.
      const drafts = Object.fromEntries(
        Object.entries(state.drafts).filter(([key]) => key !== event.key),
      );
      // Only the response of the OPEN commitment closes the sheet: one that arrives
      // after the owner moved on to another closes nothing.
      return isOpen ? { target: null, view: "form", drafts } : { ...state, drafts };
    }
  }
}
