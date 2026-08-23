// The single elevated plane of the layout standard §2.9: the eyebrow IS the
// field's visible `<label for>` (WCAG 3.3.2), an in-flow grid row — never
// `position: fixed`, because `interactive-widget=resizes-content` shrinks
// the layout viewport and fixed elements drift.

import { LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import { Button } from "./ui/Button";

export function CaptureDeck({
  value,
  onChange,
  onSubmit,
  busy,
  canWrite,
  error,
  autoFocus,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  canWrite: boolean;
  error: string | null;
  autoFocus: boolean;
  inputRef: Ref<HTMLInputElement>;
}) {
  // No indicator flashes on a fast save (guidelines §8): the icon only
  // switches to the spinner once the request has been pending for 400 ms.
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShowPending(false);
      return;
    }
    const timer = setTimeout(() => setShowPending(true), 400);
    return () => clearTimeout(timer);
  }, [busy]);

  return (
    <section
      data-deck
      className="border-t border-line bg-surface-2 px-4 pt-3 shadow-deck [padding-bottom:calc(var(--space-4)+env(safe-area-inset-bottom,0px))]"
    >
      <label
        htmlFor="capture-title"
        className="m-0 mb-2 block font-data text-t1 font-semibold text-muted"
      >
        Nova tarefa
      </label>
      <form
        className="flex min-h-14 items-center rounded-control border border-line-strong bg-surface-1 pr-1 pl-4 shadow-field has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:[box-shadow:0_0_0_4px_var(--color-bg)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim() === "" || busy) return;
          onSubmit();
        }}
      >
        <input
          id="capture-title"
          ref={inputRef}
          type="text"
          enterKeyHint="done"
          placeholder="O que precisa ser feito?"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={!canWrite}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 min-w-0 flex-1 bg-transparent font-text text-t3 text-ink outline-none placeholder:text-muted disabled:opacity-55"
        />
        <Button
          type="submit"
          aria-label="Adicionar"
          className="size-12 px-0"
          disabled={busy || !canWrite}
        >
          {showPending ? (
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Plus className="size-5" aria-hidden="true" />
          )}
        </Button>
      </form>
      {!canWrite && (
        // The field goes disabled with no other signal, so the hint needs
        // its own announcement — the same idiom Banner.tsx uses for the
        // identical connectivity state.
        <p role="status" className="mt-2 font-text text-t1 text-muted">
          Captura indisponível sem conexão.
        </p>
      )}
      {error !== null && (
        <p role="alert" className="mt-2 font-text text-t2 text-overdue">
          {error}
        </p>
      )}
    </section>
  );
}
