// The route's shell (layout standard §3: "long flows [...] are ROUTES with
// real history entries, not sheets") — the same 100dvh grid as *Hoje*
// (header / scrolling content), the flat wordmark before the page title
// (§2.1: "no wordmark in the [Hoje] header [...] it lives on the splash,
// the settings screen and the desktop rail"; §5 describes the same
// wordmark-before-title arrangement on the desktop list pane), and the one
// card this phase puts on it (`## NOT Building` — no other settings content
// yet).

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useConnectivity } from "../hooks/useConnectivity";
import { GoogleConnectionCard } from "./GoogleConnectionCard";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";

export function SettingsScreen({
  onUnauthorized,
  back,
}: {
  onUnauthorized: () => void;
  back: () => void;
}) {
  const { state: connectivity } = useConnectivity();
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    document.title = "Configurações · Praesto Sum";
  }, []);

  useEffect(() => {
    // The client half of the OAuth return leg — Task 9 changes only what
    // the Worker SENDS (a redirect into `/settings?google=connected`); this
    // is the only task whose scope includes the screen that RECEIVES it. A
    // redirected owner has no other signal the round-trip worked, so the
    // param earns an explicit confirmation, then `replaceState` clears it
    // so a reload does not re-announce a connection that happened minutes
    // ago.
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setJustConnected(true);
      window.history.replaceState(null, "", "/settings");
    }
  }, []);

  useEffect(() => {
    // Guidelines §2.2 and plan AC-A6 name three ways out of this screen, and
    // the Android back gesture is only one of them: `Esc` is what a desktop
    // owner reaches for, and CON-007 has this app verified on Windows too.
    // A history entry does NOT give `Esc` any behaviour of its own — this
    // screen is a route shell, not a `<dialog>`, so nothing here is native.
    // (An open disconnect confirmation is abandoned along with the screen,
    // which is safe: `ConfirmView` destroys nothing until *Desconectar* is
    // actually pressed.)
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
        {/* Never the only way out (guidelines §2.2): the Android back gesture
            returns here because `useRoute` (Task 3) pushed a real `history`
            entry, and `Esc` returns because the effect above listens for it.
            Those are two separate mechanisms — a history entry gives `Esc`
            nothing on its own, since this is a route shell and not a
            `<dialog>`. The first checklist run on this phase found exactly
            that gap, so it is written down rather than left to be
            rediscovered. All three exits call `back()`, which POPS the
            pushed entry instead of pushing another one; a refactor that
            turns it back into a push would re-open the AC-A6 trap. */}
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <img src="/brand/mark-flat.svg" alt="" className="size-5" />
          <span className="font-display text-t2 font-extrabold text-muted">praesto</span>
        </span>
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Configurações</h1>
      </header>

      {/* Mandatory on every screen (guidelines §8) — the same banner *Hoje*
          uses, and the same always-render-a-slot discipline so the grid's
          explicit row template does not shift when the condition clears. */}
      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        {justConnected && (
          <p role="status" className="m-0 font-text text-t2 text-ink">
            Conta do Google conectada.
          </p>
        )}
        <GoogleConnectionCard onUnauthorized={onUnauthorized} />
      </main>
    </div>
  );
}
