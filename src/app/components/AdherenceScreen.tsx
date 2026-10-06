// The `/settings/adherence` route (adherence-mirror phase 3, plan AC-A3/A4/A5),
// copying the shell of `SettingsScreen`: the same 100dvh grid, header with
// *Voltar*, `Esc` -> `back()` and always-render-a-slot banner row. Read-only.
// Every decidable string (the sections, counts, streak, miss dates) comes from
// `src/shared/adherence-view.ts`; the component only renders it.

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { seriesDisplayTitle } from "../../shared/adherence-line";
import {
  adherenceSections,
  formatDoneOfClosed,
  formatMissDates,
  formatStreak,
} from "../../shared/adherence-view";
import type { AdherenceResponse, SeriesAdherenceDto } from "../../shared/api";
import { classifyRequestFailure } from "../../shared/request-failure";
import { ApiError, fetchAdherence } from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; response: AdherenceResponse }
  | { kind: "failed"; message: string };

function SeriesSection({ label, series }: { label: string; series: SeriesAdherenceDto[] }) {
  if (series.length === 0) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="m-0 font-text text-t3 font-semibold text-ink">{label}</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {series.map((s) => (
          <li key={s.seriesId} className="flex flex-col gap-1 rounded-card bg-surface-1 p-4">
            <p className="m-0 font-text text-t3 font-semibold text-ink">{seriesDisplayTitle(s)}</p>
            <p className="m-0 font-data text-t2 text-ink">
              {formatDoneOfClosed(s.done, s.closed)} · {formatStreak(s.currentStreak)}
            </p>
            <p className="m-0 font-data text-t2 text-muted">{formatMissDates(s.recentMisses)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdherenceScreen({
  onUnauthorized,
  back,
}: {
  onUnauthorized: () => void;
  back: () => void;
}) {
  const { state: connectivity } = useConnectivity();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    document.title = "Aderência · Praesto Sum";
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back]);

  // Only the newest request may write: a slow, older response landing last
  // would otherwise overwrite fresher data.
  const latestRequest = useRef(0);

  async function refresh(): Promise<void> {
    const mine = ++latestRequest.current;
    try {
      const response = await fetchAdherence();
      if (mine !== latestRequest.current) return;
      setLoad({ kind: "ready", response });
    } catch (cause) {
      if (mine !== latestRequest.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      // Inline and persistent (guidelines §8): the screen never blanks and the
      // next visit to the foreground re-reads on its own. A list already on
      // screen survives a failed background refresh — it is still true, just
      // not the newest.
      setLoad((previous) =>
        previous.kind === "ready"
          ? previous
          : { kind: "failed", message: classifyRequestFailure(cause).message },
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const sections = load.kind === "ready" ? adherenceSections(load.response) : null;
  const isEmpty =
    sections !== null &&
    sections.missed.length === 0 &&
    sections.otherActive.length === 0 &&
    sections.ended.length === 0;

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
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Aderência</h1>
      </header>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        {load.kind === "loading" && <Skeleton />}

        {load.kind === "failed" && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {load.message}
            </p>
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {isEmpty && (
          <p className="m-0 font-text text-t2 text-muted">Nenhuma tarefa repetida ainda.</p>
        )}

        {sections !== null && !isEmpty && (
          <>
            <SeriesSection
              label="Com não concluídas nos últimos 30 dias"
              series={sections.missed}
            />
            <SeriesSection label="Outras séries ativas" series={sections.otherActive} />
            <SeriesSection label="Séries encerradas" series={sections.ended} />
          </>
        )}
      </main>
    </div>
  );
}
