/**
 * The settings screen's state machine (PRD AC-15 via plan AC-A4/AC-A5; PRD
 * AC-11 via plan AC-A7) — the Google connection's status, its calendar
 * list, and one selection draft kept for the session. Total and
 * side-effect free, like `src/shared/connectivity.ts` and
 * `src/shared/toast.ts`: it only reduces the events it is handed and never
 * touches the DOM, a timer or the network.
 *
 * The `GET`/`PUT` requests, the checkbox markup and the *Salvar* button are
 * React glue in `src/app/components/GoogleConnectionCard.tsx` — the exempt
 * half of `docs/context/methodology.md`'s "Browser-API work" split. This
 * module is the decidable half, authored test-first
 * (`test/google-settings.test.ts`).
 *
 * Exactly four `kind`s, mirroring `AgendaState` in `TodayScreen.tsx:92-98`
 * shape for shape. "Needs reconnection" is a `reason` ON `failed`, never a
 * fifth kind: *Hoje* already separates "connect" from "reconnect" from "try
 * later" by that one field, and a sibling state here would be the second
 * vocabulary AC-A7 forbids. `disconnected` is a steady state, not a
 * failure — it is what `GET /connection` answering `{ connection: null }`
 * means.
 *
 * **The empty-draft rule is not cosmetic.** `PUT /api/google/calendars`
 * answers 400 on an empty array on purpose: zero stored rows is how "never
 * chosen" is encoded, so saving nothing would silently re-enable `primary`
 * — the opposite of what the owner asked. `canSaveSelection` is what makes
 * the empty state unsaveable here, before a request is ever built, rather
 * than discovered through a failed one.
 *
 * The connection's own display data (`GoogleConnectionDto`'s `scope` and
 * `connectedAt`) is deliberately NOT folded in here — it lives in its own
 * atom in `GoogleConnectionCard.tsx`, the same separation `TodayScreen.tsx`
 * already keeps between `tasks` and `events`.
 */

import type { GoogleCalendarDto } from "./api";

export type GoogleSettingsState =
  | { kind: "loading" }
  | { kind: "disconnected" }
  | {
      kind: "connected";
      calendars: readonly GoogleCalendarDto[];
      draft: ReadonlySet<string>;
      saving: boolean;
    }
  | { kind: "failed"; reason: string | null };

export const INITIAL_GOOGLE_SETTINGS_STATE: GoogleSettingsState = { kind: "loading" };

export type GoogleSettingsEvent =
  | { type: "load-failed"; reason: string | null }
  | { type: "loaded-disconnected" }
  | { type: "loaded-connected"; calendars: readonly GoogleCalendarDto[] }
  | { type: "toggle-calendar"; calendarId: string }
  | { type: "save-start" }
  | { type: "save-succeeded"; calendarIds: readonly string[] }
  | { type: "save-failed" };

/** The ids `calendars` reports as already selected — what a fresh draft seeds from, and what a draft is compared against. */
function storedSelection(calendars: readonly GoogleCalendarDto[]): ReadonlySet<string> {
  return new Set(calendars.filter((calendar) => calendar.selected).map((calendar) => calendar.id));
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function reduceGoogleSettings(
  state: GoogleSettingsState,
  event: GoogleSettingsEvent,
): GoogleSettingsState {
  switch (event.type) {
    case "load-failed":
      return { kind: "failed", reason: event.reason };
    case "loaded-disconnected":
      return { kind: "disconnected" };
    case "loaded-connected":
      return {
        kind: "connected",
        calendars: event.calendars,
        draft: storedSelection(event.calendars),
        saving: false,
      };
    case "toggle-calendar": {
      if (state.kind !== "connected") return state;
      const draft = new Set(state.draft);
      if (draft.has(event.calendarId)) draft.delete(event.calendarId);
      else draft.add(event.calendarId);
      return { ...state, draft };
    }
    case "save-start":
      return state.kind === "connected" ? { ...state, saving: true } : state;
    case "save-succeeded": {
      if (state.kind !== "connected") return state;
      const selected = new Set(event.calendarIds);
      return {
        ...state,
        calendars: state.calendars.map((calendar) => ({
          ...calendar,
          selected: selected.has(calendar.id),
        })),
        draft: selected,
        saving: false,
      };
    }
    case "save-failed":
      return state.kind === "connected" ? { ...state, saving: false } : state;
  }
}

/**
 * `true` only for a non-empty, changed, not-mid-save draft (plan AC-A5, PRD
 * AC-15) — the guard that keeps the 400-triggering empty `PUT` from ever
 * being built.
 */
export function canSaveSelection(state: GoogleSettingsState): boolean {
  if (state.kind !== "connected") return false;
  if (state.draft.size === 0) return false;
  if (state.saving) return false;
  return selectionChanged(state);
}

/** `true` the moment the draft diverges from what is stored (PRD AC-15). */
export function selectionChanged(state: GoogleSettingsState): boolean {
  if (state.kind !== "connected") return false;
  return !setsEqual(state.draft, storedSelection(state.calendars));
}
