// Rebuilt on the tokens (A5 phase 3): the identity's flat mark + `praesto`
// wordmark as the screen's <h1>, the 401 reason `App.tsx` passes, a visible
// *Token da API* label and *Salvar*. The submit path and its two invariants —
// the store's failure message surfaces verbatim, the typed value survives a
// failure (FR-045) — are unchanged from the transitional version this
// replaces; only the copy, the markup and the tokens are new.

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { saveToken } from "../api";
import { Button } from "./ui/Button";

export type TokenGateReason = "unauthorized" | null;

export function TokenGate({
  onAuthorized,
  reason,
}: {
  onAuthorized: () => void;
  reason: TokenGateReason;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The only screen whose <title> is *Praesto Sum* — `TodayScreen` may have
    // set *Hoje · Praesto Sum* before a 401 sent the owner back here.
    document.title = "Praesto Sum";
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center gap-6 bg-bg px-4 py-8 text-ink">
      <div className="flex items-center gap-3">
        <img src="/brand/mark-flat.svg" alt="" className="size-10" />
        <h1 className="m-0 font-display text-t5 font-extrabold">praesto</h1>
      </div>

      {reason === "unauthorized" && (
        <p className="m-0 flex items-center gap-2 font-text text-t2 text-ink">
          <KeyRound className="size-5 flex-none text-muted" aria-hidden="true" />
          Este dispositivo precisa do token de novo.
        </p>
      )}

      {/* prettier-ignore */}
      <p className="m-0 font-text text-t3 text-muted">Cole o token da API deste dispositivo.</p>

      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const token = value.trim();
          if (!token) return;
          setBusy(true);
          try {
            await saveToken(token);
          } catch (cause) {
            // `saveToken` rejects in exactly one case: the token reached
            // NEITHER store (`src/shared/token-store.ts`). That message is
            // written for the owner and pinned by a test, so surface it as-is
            // instead of restating it here. `value` is deliberately not
            // cleared — the same "never lose what was typed" invariant the
            // capture form keeps (FR-045).
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível guardar o token neste dispositivo.",
            );
            return;
          } finally {
            setBusy(false);
          }
          setError(null);
          onAuthorized();
        }}
      >
        {/* prettier-ignore */}
        <label htmlFor="api-token" className="m-0 font-data text-t1 font-semibold text-muted">Token da API</label>
        <input
          id="api-token"
          type="password"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
          className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
        />
        <Button type="submit" variant="primary" disabled={busy}>
          Salvar
        </Button>
      </form>

      {error !== null && (
        <p role="alert" className="m-0 font-text text-t2 text-overdue">
          {error}
        </p>
      )}
    </main>
  );
}
