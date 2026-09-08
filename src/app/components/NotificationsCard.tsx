// The *Notificações* screen's one card (PRD AC-9 via plan AC-A1, PRD AC-8
// via plan AC-A2) — the two-step permission flow, the subscribe/unsubscribe
// toggle and the manual test-push control. Owns the requests and the DOM;
// every DECISION about what state comes next lives in
// `src/shared/notifications-settings.ts` (the exempt-glue half of
// `docs/context/methodology.md`'s "Browser-API work" split), mirroring how
// `GoogleConnectionCard.tsx` relates to `src/shared/google-settings.ts`.

import { useEffect, useReducer, useState } from "react";
import { pushOutcomeLabel } from "../../shared/diagnostics-copy";
import { loadNotificationsSettings } from "../../shared/notifications-load";
import {
  INITIAL_NOTIFICATIONS_SETTINGS_STATE,
  reduceNotificationsSettings,
} from "../../shared/notifications-settings";
import {
  ApiError,
  fetchVapidPublicKey,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "../api";
import {
  ensureServiceWorkerReady,
  getCurrentDeviceEndpoint,
  subscribeDevice,
  unsubscribeDevice,
} from "../push-subscribe";
import { Button } from "./ui/Button";

export function NotificationsCard({
  onUnauthorized,
  canWrite,
}: {
  onUnauthorized: () => void;
  canWrite: boolean;
}) {
  const [state, dispatch] = useReducer(
    reduceNotificationsSettings,
    INITIAL_NOTIFICATIONS_SETTINGS_STATE,
  );
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showSlowLoadingHint, setShowSlowLoadingHint] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function load(): Promise<void> {
    await loadNotificationsSettings(
      Notification.permission,
      () => getCurrentDeviceEndpoint().then((endpoint) => endpoint !== null),
      dispatch,
    );
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

  useEffect(() => {
    if (state.kind !== "loading") {
      setShowSlowLoadingHint(false);
      return;
    }
    // Guidelines §8: after ~10 s the skeleton adds one line ("Ainda
    // carregando…") — an honest admission the wait is taking longer than
    // usual, rather than a silent indefinite skeleton.
    const timer = setTimeout(() => setShowSlowLoadingHint(true), 10_000);
    return () => clearTimeout(timer);
  }, [state.kind]);

  useEffect(() => {
    // Guidelines §8's explicit ask that the screen stay honest when
    // permission changes outside the app — reuses
    // `classifyNotificationPermissionView` (via the reducer) so this never
    // grows a second vocabulary for the same three states.
    let status: PermissionStatus | undefined;
    function handleChange(): void {
      void (async () => {
        const permission = Notification.permission;
        const subscribed = (await getCurrentDeviceEndpoint()) !== null;
        dispatch({ type: "permission-changed", permission, subscribed });
      })();
    }
    void navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((result) => {
        status = result;
        status.addEventListener("change", handleChange);
      })
      .catch(() => {
        // Not every browser supports querying the "notifications"
        // permission (e.g. Safari) — the explicit request flow below still
        // works without it.
      });
    return () => status?.removeEventListener("change", handleChange);
  }, []);

  async function retry(): Promise<void> {
    setRetrying(true);
    await load();
    setRetrying(false);
  }

  async function performSubscribe(): Promise<void> {
    dispatch({ type: "toggle-start" });
    try {
      const registration = await ensureServiceWorkerReady();
      const { publicKey } = await fetchVapidPublicKey();
      const input = await subscribeDevice(registration, publicKey);
      await subscribeToPush(input);
      dispatch({ type: "toggle-succeeded", subscribed: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      dispatch({
        type: "toggle-failed",
        message: "Não foi possível ativar as notificações agora. Tente novamente.",
      });
    }
  }

  async function handleRequestPermission(): Promise<void> {
    // `Notification.requestPermission()` MUST be the first `await` in this
    // handler, with no unrelated `await` ahead of it — some browsers silently
    // resolve `"default"` instead of showing the prompt otherwise.
    dispatch({ type: "request-start" });
    const permission = await Notification.requestPermission();
    dispatch({ type: "permission-changed", permission });
    if (permission !== "granted") return;
    await performSubscribe();
  }

  async function handleUnsubscribe(): Promise<void> {
    dispatch({ type: "toggle-start" });
    try {
      const endpoint = await unsubscribeDevice();
      if (endpoint !== null) await unsubscribeFromPush(endpoint);
      dispatch({ type: "toggle-succeeded", subscribed: false });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      dispatch({
        type: "toggle-failed",
        message: "Não foi possível desativar as notificações agora. Tente novamente.",
      });
    }
  }

  async function handleSendTest(): Promise<void> {
    dispatch({ type: "test-start" });
    try {
      const response = await sendTestPush();
      if (response.results.length === 0) {
        dispatch({ type: "test-failed", message: "Nenhuma inscrição salva." });
        return;
      }
      const message = response.results.map((result) => pushOutcomeLabel(result.outcome)).join(", ");
      dispatch({ type: "test-succeeded", message });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      dispatch({
        type: "test-failed",
        message: "Não foi possível enviar a notificação de teste agora. Tente novamente.",
      });
    }
  }

  return (
    <section
      aria-label="Notificações"
      className="flex flex-col gap-4 rounded-card bg-surface-1 p-4"
    >
      {state.kind === "loading" && showSkeleton && (
        <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Carregando">
          <div className="h-5 w-2/3 rounded-control bg-surface-2" aria-hidden="true" />
          <div className="h-12 rounded-control bg-surface-2" aria-hidden="true" />
          {showSlowLoadingHint && (
            <p className="m-0 font-text text-t2 text-muted">Ainda carregando…</p>
          )}
        </div>
      )}

      {state.kind === "explainer" && (
        <>
          <p className="m-0 font-text text-t3 text-muted">
            Ative para receber um aviso quando algo vencer, mesmo com o app fechado.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleRequestPermission()}
            disabled={state.requesting || !canWrite}
          >
            Ativar notificações
          </Button>
        </>
      )}

      {state.kind === "blocked" && (
        <>
          <p className="m-0 font-text text-t3 text-muted">
            Notificações bloqueadas neste navegador.
          </p>
          <p className="m-0 font-text text-t2 text-muted">
            Toque no cadeado ao lado do endereço e permita notificações, ou ajuste nas configurações
            do site.
          </p>
        </>
      )}

      {state.kind === "enabled" && (
        <>
          {!state.subscribed && (
            <Button
              type="button"
              variant="primary"
              onClick={() => void performSubscribe()}
              disabled={state.togglingSubscription || !canWrite}
            >
              Ativar neste dispositivo
            </Button>
          )}

          {state.subscribed && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleUnsubscribe()}
                disabled={state.togglingSubscription || !canWrite}
              >
                Desativar notificações
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleSendTest()}
                disabled={state.sendingTest || !canWrite}
              >
                {state.sendingTest ? "Enviando…" : "Enviar notificação de teste"}
              </Button>
            </>
          )}

          {state.subscriptionError !== null && (
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {state.subscriptionError}
            </p>
          )}

          {state.testResult !== null && (
            <p
              role={state.testResult.ok ? "status" : "alert"}
              className={`m-0 font-text text-t2 ${state.testResult.ok ? "text-ink" : "text-overdue"}`}
            >
              {state.testResult.message}
            </p>
          )}
        </>
      )}

      {state.kind === "failed" && (
        <>
          <p role="alert" className="m-0 font-text text-t2 text-overdue">
            Não foi possível carregar o estado das notificações agora.
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
