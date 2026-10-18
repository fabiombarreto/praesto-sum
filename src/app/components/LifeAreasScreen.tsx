// The `/settings/life-areas` route (life-areas phase 2, plan AC-A1..AC-A7),
// copying the shell of `AdherenceScreen`: the same 100dvh grid, header with
// *Voltar*, `Esc` -> `back()`, always-render-a-slot banner row and inline
// persistent failure. Unlike that read-only screen it also writes: add, rename
// in place and a counted delete confirmation.
//
// Every decidable thing lives in `src/shared`: the list and what each write does
// to it (`life-areas-list.ts`) and every sentence plus the failure mapping
// (`life-areas-view.ts`). What stays here is glue — the requests, the focus
// handling and the markup. Writes wait for the server: nothing is optimistic and
// nothing is queued while offline (ADR-0003); every failed write keeps what the
// owner typed.

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { LifeAreaSummaryDto } from "../../shared/api";
import { canWrite } from "../../shared/connectivity";
import {
  canCreateLifeArea,
  checkLifeAreaName,
  INITIAL_LIFE_AREAS_LIST_STATE,
  isLifeAreaRenameNoop,
  reduceLifeAreasList,
} from "../../shared/life-areas-list";
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
} from "../../shared/life-areas-view";
import { classifyRequestFailure } from "../../shared/request-failure";
import { ApiError, createLifeArea, deleteLifeArea, fetchLifeAreas, updateLifeArea } from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { ConfirmView } from "./ui/ConfirmView";
import { Skeleton } from "./ui/Skeleton";

/** At most one row is in a mode at a time; opening one closes the other. */
type RowMode =
  | { kind: "rename"; id: string; draft: string; error: string | null }
  | { kind: "delete"; id: string; error: string | null }
  | null;

// The bordered 48 px field of `TaskSheet`, with the disabled look `CaptureDeck`'s field has.
const FIELD_CLASS =
  "min-h-12 min-w-0 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field disabled:opacity-55";

/**
 * A row's rename form: a visible label, the field, and explicit *Cancelar* and
 * *Salvar* — never commit-on-blur, which would swallow the duplicate and failure
 * messages and race the *Cancelar* tap (guidelines §10, 3.2.2). `Enter` saves
 * (the form submit); `Esc` cancels the edit only and, because it is prevented,
 * does not also leave the screen.
 */
function RenameForm({
  draft,
  error,
  online,
  busy,
  onDraftChange,
  onSave,
  onCancel,
}: {
  draft: string;
  error: string | null;
  online: boolean;
  busy: boolean;
  onDraftChange: (draft: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Programmatic focus after the pencil tap — not the `autofocus` attribute,
    // which guidelines §12.5 reserves for the capture field.
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <label htmlFor={fieldId} className="m-0 font-data text-t1 font-semibold text-muted">
        Nome da área
      </label>
      <input
        id={fieldId}
        ref={inputRef}
        type="text"
        enterKeyHint="done"
        autoComplete="off"
        value={draft}
        // `readOnly` while a request is in flight keeps focus where it is; a
        // `disabled` field would drop it and the failure would land elsewhere.
        readOnly={busy}
        disabled={!online}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        className={FIELD_CLASS}
      />
      {error !== null && (
        <p id={errorId} role="alert" className="m-0 font-text text-t2 text-overdue">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={!online || busy}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

export function LifeAreasScreen({
  onUnauthorized,
  back,
}: {
  onUnauthorized: () => void;
  back: () => void;
}) {
  const [state, dispatch] = useReducer(reduceLifeAreasList, INITIAL_LIFE_AREAS_LIST_STATE);

  // Only the newest read may write: a slow, older response landing last would
  // otherwise overwrite a fresher list. A successful write bumps it too, so a
  // read that started before the write cannot drop the new area.
  const latestRequest = useRef(0);

  async function load(): Promise<void> {
    const mine = ++latestRequest.current;
    try {
      const response = await fetchLifeAreas();
      if (mine !== latestRequest.current) return;
      dispatch({ type: "loaded", response });
    } catch (cause) {
      if (mine !== latestRequest.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      // Inline and persistent (guidelines §8). A list already on screen
      // survives a failed refresh: the reducer keeps it.
      dispatch({ type: "load-failed", message: classifyRequestFailure(cause).message });
    }
  }

  // Refetch on reconnect (guidelines §12.4); `report` is not fed, as on the
  // sibling route screens.
  const { state: connectivity } = useConnectivity({ onOnline: () => void load() });
  const online = canWrite(connectivity);

  const [addDraft, setAddDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [rowMode, setRowMode] = useState<RowMode>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The failure a row carried when it left the list underneath its own mode
  // (see the reset below). Unlike `notice`, which only the three write handlers
  // clear, it is also cleared when the owner opens another row's rename or
  // delete.
  const [vanishedError, setVanishedError] = useState<string | null>(null);
  const writable = online && !busy;

  const noticeRef = useRef<HTMLParagraphElement>(null);
  const focusAfterLeaving = useRef<string | null>(null);

  useEffect(() => {
    document.title = "Áreas · Praesto Sum";
  }, []);

  useEffect(() => {
    // Three ways out (guidelines §2.2): the back gesture, *Voltar* and `Esc`. An
    // `Esc` the rename field already handled is prevented, so it cancels the
    // edit and does not also leave the screen.
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void load();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    // After a delete the control that opened the confirmation no longer
    // exists, so the announcement takes focus instead.
    if (notice !== null) noticeRef.current?.focus();
  }, [notice]);

  useEffect(() => {
    // Focus returns to the control that opened the mode once the row has left
    // it and that control is back in the DOM.
    if (rowMode !== null) return;
    const target = focusAfterLeaving.current;
    if (target === null) return;
    focusAfterLeaving.current = null;
    document.getElementById(target)?.focus();
  }, [rowMode]);

  function leaveRowMode(openerId: string): void {
    focusAfterLeaving.current = openerId;
    setRowMode(null);
  }

  /** `null` when the failure was a 401 and the token gate took over; otherwise the sentence to show. */
  function messageForFailedWrite(cause: unknown): string | null {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return null;
    }
    const failure = lifeAreaWriteFailure(cause);
    // Another device changed the areas first: show the message, then make the
    // list match the server.
    if (failure.staleList) void load();
    return failure.message;
  }

  async function handleAdd(): Promise<void> {
    if (state.kind !== "ready" || !canCreateLifeArea(state) || !writable) return;
    setNotice(null);
    setVanishedError(null);
    const problem = checkLifeAreaName(addDraft, state.areas, null);
    if (problem !== null) {
      setAddError(lifeAreaNameProblemMessage(problem));
      return;
    }
    setBusy(true);
    setAddError(null);
    try {
      const lifeArea = await createLifeArea({ name: addDraft });
      latestRequest.current += 1;
      dispatch({ type: "created", lifeArea });
      setAddDraft("");
    } catch (cause) {
      const message = messageForFailedWrite(cause);
      if (message !== null) setAddError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameSave(area: LifeAreaSummaryDto): Promise<void> {
    if (state.kind !== "ready" || rowMode?.kind !== "rename" || rowMode.id !== area.id) return;
    if (!writable) return;
    const draft = rowMode.draft;
    if (isLifeAreaRenameNoop(draft, area.name)) {
      leaveRowMode(`rename-${area.id}`);
      return;
    }
    setNotice(null);
    setVanishedError(null);
    const problem = checkLifeAreaName(draft, state.areas, area.id);
    if (problem !== null) {
      setRowMode({
        kind: "rename",
        id: area.id,
        draft,
        error: lifeAreaNameProblemMessage(problem),
      });
      return;
    }
    setBusy(true);
    setRowMode({ kind: "rename", id: area.id, draft, error: null });
    try {
      const lifeArea = await updateLifeArea(area.id, { name: draft });
      latestRequest.current += 1;
      dispatch({ type: "renamed", lifeArea });
      leaveRowMode(`rename-${area.id}`);
    } catch (cause) {
      const message = messageForFailedWrite(cause);
      if (message !== null) setRowMode({ kind: "rename", id: area.id, draft, error: message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(area: LifeAreaSummaryDto): Promise<void> {
    if (!writable) return;
    setNotice(null);
    setVanishedError(null);
    setBusy(true);
    setRowMode({ kind: "delete", id: area.id, error: null });
    try {
      await deleteLifeArea(area.id);
      latestRequest.current += 1;
      dispatch({ type: "deleted", id: area.id });
      setRowMode(null);
      setNotice(formatLifeAreaDeletedNotice(area.name));
    } catch (cause) {
      const message = messageForFailedWrite(cause);
      if (message !== null) setRowMode({ kind: "delete", id: area.id, error: message });
    } finally {
      setBusy(false);
    }
  }

  function openRowMode(mode: NonNullable<RowMode>): void {
    // Opening a rename or delete ends a vanished row's failure message. The
    // `notice` is left alone here: only a write (add, save, confirm) clears it.
    setVanishedError(null);
    setRowMode(mode);
  }

  function cancelRowMode(openerId: string): void {
    // A request already in flight cannot be abandoned from here.
    if (busy) return;
    leaveRowMode(openerId);
  }

  // A row can leave the list underneath its own mode: a refetch removes it
  // (a 404 just said the area is gone, or another device deleted it) while
  // `rowMode` still names it. A mode must not outlive its row, because nothing
  // left on screen could end it: no *Salvar* would be rendered to take over as
  // the primary action, and its message would die with the row. So the mode is
  // reset in the very render that first sees the list without the row (React's
  // pattern for adjusting state from other state), which keeps every reader of
  // `rowMode` consistent, and a failure message it carried moves to the top as
  // `vanishedError`, which stays until a write starts or the owner opens
  // another row's rename or delete.
  if (
    state.kind === "ready" &&
    rowMode !== null &&
    !state.areas.some((area) => area.id === rowMode.id)
  ) {
    if (rowMode.error !== null) setVanishedError(rowMode.error);
    setRowMode(null);
  }

  function renderRow(area: LifeAreaSummaryDto) {
    const mode = rowMode !== null && rowMode.id === area.id ? rowMode : null;

    if (mode?.kind === "rename") {
      return (
        <li key={area.id} className="rounded-card bg-surface-1 p-4">
          <RenameForm
            draft={mode.draft}
            error={mode.error}
            online={online}
            busy={busy}
            onDraftChange={(draft) =>
              setRowMode({ kind: "rename", id: area.id, draft, error: null })
            }
            onSave={() => void handleRenameSave(area)}
            onCancel={() => cancelRowMode(`rename-${area.id}`)}
          />
        </li>
      );
    }

    if (mode?.kind === "delete") {
      return (
        <li key={area.id} className="rounded-card bg-surface-1 p-4">
          <ConfirmView
            title={formatLifeAreaDeleteTitle(area.name)}
            body={formatLifeAreaDeleteBody(area)}
            cancelLabel="Cancelar"
            confirmLabel="Excluir"
            busy={!writable}
            error={mode.error}
            onCancel={() => cancelRowMode(`delete-${area.id}`)}
            onConfirm={() => void handleDelete(area)}
          />
        </li>
      );
    }

    return (
      <li key={area.id} className="flex items-center gap-2 rounded-card bg-surface-1 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="m-0 min-w-0 font-text text-t3 font-semibold break-words text-ink">
            {area.name}
          </p>
          <p className="m-0 font-data text-t2 text-muted">
            {formatOpenTaskCount(area.openTaskCount)}
          </p>
        </div>
        <Button
          id={`rename-${area.id}`}
          type="button"
          variant="icon"
          aria-label={`Renomear ${area.name}`}
          disabled={!writable}
          onClick={() =>
            openRowMode({ kind: "rename", id: area.id, draft: area.name, error: null })
          }
        >
          <Pencil className="size-5" aria-hidden="true" />
        </Button>
        <Button
          id={`delete-${area.id}`}
          type="button"
          variant="icon"
          aria-label={`Excluir ${area.name}`}
          disabled={!writable}
          onClick={() => openRowMode({ kind: "delete", id: area.id, error: null })}
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </Button>
      </li>
    );
  }

  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr] overflow-clip bg-bg"
    >
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <img src="/brand/mark-flat.svg" alt="" className="size-5" />
          <span className="font-display text-t2 font-extrabold text-muted">praesto</span>
        </span>
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Áreas</h1>
      </header>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        {notice !== null && (
          <p ref={noticeRef} role="status" tabIndex={-1} className="m-0 font-text text-t2 text-ink">
            {notice}
          </p>
        )}

        {vanishedError !== null && (
          <p role="alert" className="m-0 font-text text-t2 text-overdue">
            {vanishedError}
          </p>
        )}

        {state.kind === "loading" && <Skeleton />}

        {state.kind === "failed" && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {state.message}
            </p>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            {state.areas.length === 0 && (
              <div className="flex flex-col gap-1">
                <p className="m-0 font-text text-t3 font-semibold text-ink">
                  {LIFE_AREAS_EMPTY_TITLE}
                </p>
                <p className="m-0 font-text text-t2 text-muted">{LIFE_AREAS_EMPTY_BODY}</p>
              </div>
            )}

            {canCreateLifeArea(state) ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAdd();
                }}
              >
                <label
                  htmlFor="life-area-name"
                  className="m-0 font-data text-t1 font-semibold text-muted"
                >
                  Nova área
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="life-area-name"
                    type="text"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={addDraft}
                    readOnly={busy}
                    disabled={!online}
                    aria-invalid={addError !== null}
                    aria-describedby={addError !== null ? "life-area-name-error" : undefined}
                    onChange={(event) => {
                      setAddDraft(event.target.value);
                      setAddError(null);
                    }}
                    className={`${FIELD_CLASS} flex-1`}
                  />
                  {/* One primary action on the screen (guidelines §3.1): while a
                      rename form is open, its *Salvar* is the primary one.
                      `rowMode` never names a row that has left the list (it is
                      reset above), so a rename mode here always has its form
                      rendered and *Adicionar* is never demoted with no
                      *Salvar* to take over. */}
                  <Button
                    type="submit"
                    variant={rowMode?.kind === "rename" ? "secondary" : "primary"}
                    disabled={!writable}
                  >
                    Adicionar
                  </Button>
                </div>
                {addError !== null && (
                  <p
                    id="life-area-name-error"
                    role="alert"
                    className="m-0 font-text text-t2 text-overdue"
                  >
                    {addError}
                  </p>
                )}
              </form>
            ) : (
              <p className="m-0 font-text text-t2 text-muted">{LIFE_AREA_LIMIT_NOTICE}</p>
            )}

            {state.areas.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {state.areas.map((area) => renderRow(area))}
              </ul>
            )}

            {/* Read-only by construction: a count of open Tasks that have no
                area, never a stored area (D-O), so it carries no control. */}
            <div className="flex items-center justify-between gap-3 rounded-card border border-line px-4 py-3">
              <span className="font-text text-t3 font-semibold text-ink">{NO_AREA_LABEL}</span>
              <span className="font-data text-t2 text-muted">
                {formatOpenTaskCount(state.noAreaOpenTaskCount)}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
