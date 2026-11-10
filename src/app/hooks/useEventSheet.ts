import { useCallback, useMemo, useReducer, useState } from "react";
import type { EventDto } from "../../shared/api";
import {
  buildCreateEventInput,
  buildEventPatch,
  eventDraftErrors,
  timeZoneChoices,
} from "../../shared/event-edit";
import {
  currentEventDraft,
  eventSheetKey,
  INITIAL_EVENT_SHEET_STATE,
  reduceEventSheet,
} from "../../shared/event-sheet";
import { eventWriteFailure, NEW_EVENT_LABEL } from "../../shared/event-view";
import { EVENT_DEFAULT_TIMEZONE } from "../../shared/events";
import { ApiError, createEvent, deleteEvent, updateEvent } from "../api";
import type { CompromissoSheetProps } from "../components/CompromissoSheet";

/**
 * The zones the runtime lists, read once (`Intl.supportedValuesOf("timeZone")`, about
 * 400 entries; it names canonical zones, so a valid zone such as `UTC` can be missing).
 * It is Baseline since 2022; where it is missing the list is empty and the sheet offers
 * only the owner's zone and the commitment's own (`timeZoneChoices`).
 */
let supportedZonesCache: readonly string[] | null = null;
function supportedTimeZones(): readonly string[] {
  supportedZonesCache ??=
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return supportedZonesCache;
}

/**
 * The glue of the Compromisso sheet (unit 14 `events-and-day-view` phase 4), shared
 * by *Hoje*, the day screen and search so the three sheets cannot drift — the reason
 * `useSeriesSheet` exists for the Task sheet. It holds the reducer
 * (`src/shared/event-sheet.ts`), the request state and the three requests; the
 * DECISIONS about content (what a draft is, what a save sends, what a failure says)
 * live in `src/shared` and are tested there (`docs/context/methodology.md`, "split the
 * logic out, then the glue is exempt").
 *
 * Server-first, nothing optimistic (ADR-0003): a save or delete waits for the server,
 * and once it succeeds the sheet closes and `onChanged` refetches the screen's list (a
 * save with nothing changed sends nothing and just closes). A failure stays IN the
 * sheet — it stays open, the draft intact, the reason persistent under *Salvar* or the
 * confirmation — and is never a toast; only a failure that says the list is stale (the
 * commitment is gone) also refetches. The hook also never reports to the connectivity
 * reducer: a failed commitments write must not disable capture app-wide, the
 * isolation the screens' commitment loaders already keep.
 *
 * `onChanged` must not reject (the screens' loaders catch their own failures); it is
 * awaited OUTSIDE the request's `try`, so a failing refetch can never be reported as
 * a failed save.
 */
export function useEventSheet(options: {
  onUnauthorized: () => void;
  /** False while offline: every write is disabled and the sheet says so. */
  writable: boolean;
  /** Refetches the screen's commitments after an accepted write (or a stale-list failure). */
  onChanged: () => void | Promise<void>;
}): {
  isOpen: boolean;
  /** Opens the sheet on a new commitment for `day` (`YYYY-MM-DD`). */
  openNew: (day: string) => void;
  /** Opens the sheet on `event`; a Google row never opens it (the reducer refuses). */
  openEvent: (event: EventDto) => void;
  close: () => void;
  sheetProps: CompromissoSheetProps;
} {
  const { onUnauthorized, writable, onChanged } = options;
  const [state, dispatch] = useReducer(reduceEventSheet, INITIAL_EVENT_SHEET_STATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => dispatch({ type: "close" }), []);

  function openNew(day: string): void {
    setError(null);
    // The clock is read here, in the glue: the reducer takes "now" as an argument.
    dispatch({ type: "open-new", day, nowSeconds: Math.floor(Date.now() / 1000) });
  }

  function openEvent(event: EventDto): void {
    setError(null);
    dispatch({ type: "open", event });
  }

  /** Runs one request: busy while it runs, the reason inline if it fails, a refetch if it works. */
  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    let succeeded = false;
    try {
      await action();
      succeeded = true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      const failure = eventWriteFailure(cause);
      setError(failure.message);
      // Another device changed the list first: show the reason, then refetch.
      if (failure.staleList) await onChanged();
    } finally {
      setBusy(false);
    }
    if (succeeded) {
      setError(null);
      await onChanged();
    }
  }

  function save(): void {
    if (!writable || busy) return;
    const target = state.target;
    const draft = currentEventDraft(state);
    // An invalid draft is the sheet's to explain; nothing is sent for it.
    if (target === null || draft === null || eventDraftErrors(draft).length > 0) return;
    const key = eventSheetKey(target);

    if (target.kind === "new") {
      const input = buildCreateEventInput(draft);
      if (input === null) return;
      void run(async () => {
        await createEvent(input);
        dispatch({ type: "saved", key });
      });
      return;
    }

    const snapshot = target.event;
    const patch = buildEventPatch(snapshot, draft);
    // A PATCH with an empty body is a 400 by design, and there is nothing to save.
    if (Object.keys(patch).length === 0) {
      dispatch({ type: "close" });
      return;
    }
    void run(async () => {
      await updateEvent(snapshot.id, patch);
      dispatch({ type: "saved", key });
    });
  }

  function confirmDelete(): void {
    if (!writable || busy) return;
    const target = state.target;
    if (target === null || target.kind !== "edit") return;
    const id = target.event.id;
    void run(async () => {
      await deleteEvent(id);
      dispatch({ type: "deleted", key: id });
    });
  }

  const target = state.target;
  const draft = currentEventDraft(state);
  const zone = draft?.timezone ?? EVENT_DEFAULT_TIMEZONE;
  const timeZones = useMemo(() => timeZoneChoices(supportedTimeZones(), zone), [zone]);

  return {
    isOpen: target !== null,
    openNew,
    openEvent,
    close,
    sheetProps: {
      open: target !== null,
      title: target === null ? null : target.kind === "new" ? NEW_EVENT_LABEL : target.event.title,
      mode: target === null ? null : target.kind,
      view: state.view,
      draft,
      timeZones,
      busy,
      writable,
      error,
      onDraftChange: (changes) => dispatch({ type: "edit", changes }),
      onClose: close,
      onSave: save,
      onDeleteRequest: () => {
        setError(null);
        dispatch({ type: "request-delete" });
      },
      onDeleteCancel: () => {
        setError(null);
        dispatch({ type: "cancel-delete" });
      },
      onDeleteConfirm: confirmDelete,
    },
  };
}
