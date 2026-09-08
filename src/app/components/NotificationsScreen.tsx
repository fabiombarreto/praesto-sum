// The `/settings/notifications` route shell (layout standard §3: "long
// flows [...] are ROUTES with real history entries, not sheets"), copying
// `SettingsScreen.tsx`'s grid, header, Esc-closes effect and offline-banner
// slot verbatim.

import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { canWrite } from "../../shared/connectivity";
import { useConnectivity } from "../hooks/useConnectivity";
import { NotificationsCard } from "./NotificationsCard";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";

export function NotificationsScreen({
  onUnauthorized,
  back,
  onOpenDiagnostics,
}: {
  onUnauthorized: () => void;
  back: () => void;
  onOpenDiagnostics: () => void;
}) {
  const { state: connectivity } = useConnectivity();

  useEffect(() => {
    document.title = "Notificações · Praesto Sum";
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back]);

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
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Notificações</h1>
      </header>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        <NotificationsCard onUnauthorized={onUnauthorized} canWrite={canWrite(connectivity)} />
        <Button type="button" variant="ghost" className="self-start" onClick={onOpenDiagnostics}>
          Ver diagnóstico
        </Button>
      </main>
    </div>
  );
}
