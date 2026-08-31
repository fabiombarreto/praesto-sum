// The settings screen's one card (plan Tasks 2 + 6) — connection status,
// connect, the calendar picker and disconnect, the three FR-030/FR-027
// Musts phase 5 exists to ship. Owns the requests and the DOM; every
// DECISION about what state comes next lives in
// `src/shared/google-settings.ts` (the exempt-glue half of
// `docs/context/methodology.md`'s "Browser-API work" split), mirroring how
// `TaskSheet.tsx` relates to `src/shared/task-sheet.ts`.

import { useEffect, useReducer, useState } from "react";
import type { GoogleConnectionDto } from "../../shared/api";
import { googleFailureMessage } from "../../shared/google-failure-copy";
import {
  canSaveSelection,
  INITIAL_GOOGLE_SETTINGS_STATE,
  reduceGoogleSettings,
} from "../../shared/google-settings";
import {
  ApiError,
  disconnectGoogle,
  fetchGoogleCalendars,
  fetchGoogleConnection,
  saveGoogleCalendars,
  startGoogleConnect,
} from "../api";
import { Button } from "./ui/Button";
import { ConfirmView } from "./ui/ConfirmView";

/** How each granted OAuth scope reads in one word, for the connected summary. */
const SCOPE_LABELS: Readonly<Record<string, string>> = {
  "https://www.googleapis.com/auth/calendar.events.readonly": "compromissos",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly": "lista de calendários",
};

function summarizeScope(scope: string): string {
  const labels = scope
    .split(" ")
    .map((value) => SCOPE_LABELS[value])
    .filter((label): label is string => label !== undefined);
  return labels.length > 0 ? `Leitura de ${labels.join(" e ")}.` : "Leitura de calendários.";
}

export function GoogleConnectionCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [state, dispatch] = useReducer(reduceGoogleSettings, INITIAL_GOOGLE_SETTINGS_STATE);
  // The connection's own display data lives here, deliberately outside the
  // reducer — see the module doc comment in `google-settings.ts`.
  const [connection, setConnection] = useState<GoogleConnectionDto | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [disconnectResult, setDisconnectResult] = useState<{ revokedAtGoogle: boolean } | null>(
    null,
  );
  const [retrying, setRetrying] = useState(false);

  async function load(): Promise<void> {
    try {
      const { connection: loaded } = await fetchGoogleConnection();
      if (loaded === null) {
        setConnection(null);
        dispatch({ type: "loaded-disconnected" });
        return;
      }
      const { calendars } = await fetchGoogleCalendars();
      setConnection(loaded);
      dispatch({ type: "loaded-connected", calendars });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      dispatch({ type: "load-failed", reason: cause instanceof ApiError ? cause.reason : null });
    }
  }

  // Mount only — a retry is an explicit tap (`retry` below), never an
  // implicit re-run.
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (state.kind !== "loading") {
      setShowSkeleton(false);
      return;
    }
    // Guidelines §8, "Pending request": an indicator only after a 300–500 ms
    // delay, so a fast answer never flashes a skeleton the owner cannot
    // read.
    const timer = setTimeout(() => setShowSkeleton(true), 400);
    return () => clearTimeout(timer);
  }, [state.kind]);

  async function retry(): Promise<void> {
    setRetrying(true);
    await load();
    setRetrying(false);
  }

  async function handleConnect(): Promise<void> {
    setConnectError(null);
    setConnecting(true);
    try {
      const { consentUrl } = await startGoogleConnect();
      window.location.href = consentUrl;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setConnectError("Não foi possível iniciar a conexão com o Google. Tente novamente.");
    } finally {
      setConnecting(false);
    }
  }

  function handleToggle(calendarId: string): void {
    dispatch({ type: "toggle-calendar", calendarId });
  }

  async function handleSave(): Promise<void> {
    if (state.kind !== "connected") return;
    setSaveError(null);
    dispatch({ type: "save-start" });
    try {
      const { calendarIds } = await saveGoogleCalendars([...state.draft]);
      dispatch({ type: "save-succeeded", calendarIds });
      // The change becomes visible "where it matters" (PRD AC-15) the
      // moment the owner returns to Hoje: App.tsx renders TodayScreen and
      // SettingsScreen as ALTERNATIVES, never both, so navigating back
      // unmounts this screen and mounts a fresh TodayScreen — whose own
      // mount effect already calls `refreshEvents()`. No explicit re-fetch
      // belongs here: there is no shared events store to write into while
      // this screen is showing, and calling fetchGoogleEvents() here would
      // fetch data nothing on this screen renders.
    } catch (cause) {
      dispatch({ type: "save-failed" });
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setSaveError("Não foi possível salvar a seleção agora. Tente novamente.");
    }
  }

  function requestDisconnect(): void {
    setDisconnectError(null);
    setConfirmingDisconnect(true);
  }

  function cancelDisconnect(): void {
    setDisconnectError(null);
    setConfirmingDisconnect(false);
  }

  async function confirmDisconnect(): Promise<void> {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const { revokedAtGoogle } = await disconnectGoogle();
      setConnection(null);
      setDisconnectResult({ revokedAtGoogle });
      setConfirmingDisconnect(false);
      dispatch({ type: "loaded-disconnected" });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setDisconnectError("Não foi possível desconectar agora. Tente novamente.");
    } finally {
      setDisconnecting(false);
    }
  }

  // The same call `TodayScreen`'s `agendaNotice` makes, which is now what
  // makes AC-A7's "one condition, one vocabulary" structural rather than a
  // coincidence two files had to keep by hand.
  const failedMessage = state.kind === "failed" ? googleFailureMessage(state.reason) : null;

  return (
    <section
      aria-label="Conexão com o Google"
      className="flex flex-col gap-4 rounded-card bg-surface-1 p-4"
    >
      {state.kind === "loading" && showSkeleton && (
        <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Carregando">
          <div className="h-5 w-2/3 rounded-control bg-surface-2" aria-hidden="true" />
          <div className="h-12 rounded-control bg-surface-2" aria-hidden="true" />
          <div className="h-12 rounded-control bg-surface-2" aria-hidden="true" />
        </div>
      )}

      {state.kind === "disconnected" && (
        <>
          {disconnectResult !== null &&
            (disconnectResult.revokedAtGoogle ? (
              <p role="status" className="m-0 font-text text-t2 text-ink">
                Conexão revogada no Google e removida daqui.
              </p>
            ) : (
              <p role="status" className="m-0 font-text text-t2 text-ink">
                Conexão removida daqui. O Google pode continuar mostrando esse acesso — revise em{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  sua Conta Google
                </a>
                .
              </p>
            ))}
          <p className="m-0 font-text text-t3 text-muted">
            Conecte sua conta do Google para ver seus compromissos junto com suas tarefas.
          </p>
          <p className="m-0 font-text text-t2 text-muted">
            O Google vai avisar que o app não é verificado — isso é esperado. Toque em “Avançado” e
            continue mesmo assim.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleConnect()}
            disabled={connecting}
          >
            Conectar
          </Button>
          {connectError !== null && (
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {connectError}
            </p>
          )}
        </>
      )}

      {state.kind === "connected" && (
        <>
          {connection !== null && (
            <p className="m-0 font-text text-t2 text-muted">{summarizeScope(connection.scope)}</p>
          )}

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {state.calendars.map((calendar) => (
              <li key={calendar.id}>
                <label className="flex min-h-12 items-center gap-3 rounded-control border border-line bg-surface-2 px-4 font-text text-t2 text-ink">
                  <input
                    type="checkbox"
                    checked={state.draft.has(calendar.id)}
                    onChange={() => handleToggle(calendar.id)}
                    disabled={state.saving}
                    className="size-5"
                  />
                  {calendar.summary}
                  {calendar.primary && (
                    <span className="ml-auto font-data text-t1 text-muted">Principal</span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSave()}
            disabled={!canSaveSelection(state)}
          >
            Salvar
          </Button>

          {state.draft.size === 0 && (
            <p className="m-0 font-text text-t2 text-muted">
              Escolha ao menos um calendário. Para não ver nada do Google, desconecte.
            </p>
          )}

          {saveError !== null && (
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {saveError}
            </p>
          )}

          {!confirmingDisconnect && (
            <Button
              type="button"
              variant="ghost"
              className="self-start text-muted"
              onClick={requestDisconnect}
            >
              Desconectar do Google
            </Button>
          )}

          {confirmingDisconnect && (
            <ConfirmView
              title="Desconectar do Google?"
              body="Você vai precisar refazer a autorização do Google para conectar de novo."
              cancelLabel="Cancelar"
              confirmLabel="Desconectar"
              busy={disconnecting}
              error={disconnectError}
              onCancel={cancelDisconnect}
              onConfirm={() => void confirmDisconnect()}
            />
          )}
        </>
      )}

      {failedMessage !== null && (
        <>
          <p role="alert" className="m-0 font-text text-t2 text-overdue">
            {failedMessage}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void retry()}
            disabled={retrying}
          >
            Tentar de novo
          </Button>
        </>
      )}
    </section>
  );
}
