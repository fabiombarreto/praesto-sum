// The settings screen's second card (data-export phase 3, "The button") —
// two independent downloads, JSON and .ics, each mirroring
// `GoogleConnectionCard`'s local-state/delayed-busy/inline-error idiom.
//
// Both controls are disabled ONLY by their own `busy` flag — neither reads
// nor accepts `canWrite`. This is deliberate, not an oversight:
// `GoogleConnectionCard.tsx`'s own doc comment already establishes the
// precedent — "Reads stay enabled — *Tentar de novo* is a GET, and 'dá para
// ler' is the half of the promise that still holds." A file download is a
// read, so a genuinely offline attempt simply reaches the same inline-error
// path below that a flaky connection would, rather than being preemptively
// disabled with a second, redundant offline message beyond the screen's
// existing persistent banner.

import { useEffect, useState } from "react";
import { ApiError, fetchExportFile } from "../api";
import { triggerBrowserDownload } from "../download";
import { showToast } from "../toast-store";
import { Button } from "./ui/Button";

type ExportKind = "json" | "ics";

const LABELS: Readonly<Record<ExportKind, string>> = {
  json: "Baixar meus dados",
  ics: "Baixar agenda (.ics)",
};

const SUCCESS_TEXT: Readonly<Record<ExportKind, string>> = {
  json: "Dados exportados.",
  ics: "Agenda exportada.",
};

const ERROR_TEXT: Readonly<Record<ExportKind, string>> = {
  json: "Não foi possível baixar seus dados agora. Tente novamente.",
  ics: "Não foi possível baixar a agenda agora. Tente novamente.",
};

/** One download control's own local state, kept independent of its sibling. */
function useExportControl(
  kind: ExportKind,
  onUnauthorized: () => void,
): {
  busy: boolean;
  showBusy: boolean;
  error: string | null;
  trigger: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [showBusy, setShowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) {
      setShowBusy(false);
      return;
    }
    // Guidelines §8, "Pending request": an indicator only after a 300–500 ms
    // delay, so a fast download never flashes a busy label the owner cannot
    // read.
    const timer = setTimeout(() => setShowBusy(true), 400);
    return () => clearTimeout(timer);
  }, [busy]);

  async function handleDownload(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const { blob, filename } = await fetchExportFile(
        kind === "json" ? "/api/export" : "/api/export.ics",
      );
      triggerBrowserDownload(blob, filename);
      showToast({ key: `export-${kind}`, text: SUCCESS_TEXT[kind], tone: "info" });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setError(ERROR_TEXT[kind]);
    } finally {
      setBusy(false);
    }
  }

  return { busy, showBusy, error, trigger: () => void handleDownload() };
}

export function DataExportCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const json = useExportControl("json", onUnauthorized);
  const ics = useExportControl("ics", onUnauthorized);

  return (
    <section
      aria-label="Exportar dados"
      className="flex flex-col gap-4 rounded-card bg-surface-1 p-4"
    >
      <Button type="button" variant="primary" onClick={json.trigger} disabled={json.busy}>
        {json.showBusy ? "Baixando…" : LABELS.json}
      </Button>
      {json.error !== null && (
        <p role="alert" className="m-0 font-text text-t2 text-overdue">
          {json.error}
        </p>
      )}

      <Button type="button" variant="primary" onClick={ics.trigger} disabled={ics.busy}>
        {ics.showBusy ? "Baixando…" : LABELS.ics}
      </Button>
      {ics.error !== null && (
        <p role="alert" className="m-0 font-text text-t2 text-overdue">
          {ics.error}
        </p>
      )}
    </section>
  );
}
