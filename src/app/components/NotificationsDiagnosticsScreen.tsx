// The `/settings/notifications/diagnostics` route shell (PRD AC-7 via plan
// AC-A3), copying the same grid/header/Esc-effect/banner shape as
// `NotificationsScreen.tsx`.

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { DiagnosticsDto } from "../../shared/api";
import {
  deviceSubscriptionLabel,
  formatAbsoluteInstant,
  formatRelativeInstant,
  pushOutcomeLabel,
} from "../../shared/diagnostics-copy";
import { ApiError, fetchDiagnostics } from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { getCurrentDeviceEndpoint } from "../push-subscribe";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";

export function NotificationsDiagnosticsScreen({
  onUnauthorized,
  back,
}: {
  onUnauthorized: () => void;
  back: () => void;
}) {
  const { state: connectivity } = useConnectivity();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsDto | null>(null);
  const [deviceEndpoint, setDeviceEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Diagnóstico · Praesto Sum";
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back]);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [loadedDiagnostics, endpoint] = await Promise.all([
          fetchDiagnostics(),
          getCurrentDeviceEndpoint(),
        ]);
        setDiagnostics(loadedDiagnostics);
        setDeviceEndpoint(endpoint);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          onUnauthorized();
          return;
        }
        setError("Não foi possível carregar o diagnóstico agora. Tente novamente.");
      }
    }
    // Mount only, mirroring the rest of this screen family — a reload is
    // the only refresh mechanism, exactly like `GoogleConnectionCard`'s own
    // load effect.
    void load();
  }, []);

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
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Diagnóstico</h1>
      </header>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        {error !== null && (
          <p role="alert" className="m-0 font-text text-t2 text-overdue">
            {error}
          </p>
        )}

        {diagnostics !== null && (
          <>
            <section className="flex flex-col gap-1">
              <h2 className="m-0 font-text text-t3 font-semibold text-ink">Última execução</h2>
              {diagnostics.lastRun === null ? (
                <p className="m-0 font-text text-t2 text-muted">
                  Nenhuma execução registrada ainda.
                </p>
              ) : (
                <p className="m-0 font-text text-t2 text-ink">
                  {formatAbsoluteInstant(diagnostics.lastRun.instant)} ·{" "}
                  {formatRelativeInstant(diagnostics.lastRun.instant, new Date())}
                </p>
              )}
              {diagnostics.freshness === "stale" && (
                <p role="alert" className="m-0 font-text text-t2 text-overdue">
                  O cron não roda há mais de 10 minutos.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-1">
              <h2 className="m-0 font-text text-t3 font-semibold text-ink">Inscrições</h2>
              <p className="m-0 font-text text-t2 text-ink">
                {diagnostics.subscriptionCount}{" "}
                {diagnostics.subscriptionCount === 1 ? "inscrição salva" : "inscrições salvas"}.{" "}
                {deviceSubscriptionLabel(deviceEndpoint !== null)}
              </p>
            </section>

            <section className="flex flex-col gap-1">
              <h2 className="m-0 font-text text-t3 font-semibold text-ink">Último teste</h2>
              {diagnostics.lastDispatch === null ? (
                <p className="m-0 font-text text-t2 text-muted">Nenhum teste enviado ainda.</p>
              ) : (
                <>
                  <p className="m-0 font-text text-t2 text-ink">
                    {formatAbsoluteInstant(diagnostics.lastDispatch.instant)}
                  </p>
                  {diagnostics.lastDispatch.results.map((result) => (
                    <p key={result.endpoint} className="m-0 font-text text-t2 text-muted">
                      {result.endpoint} — {pushOutcomeLabel(result.outcome)}
                    </p>
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
