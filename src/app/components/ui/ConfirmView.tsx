// Owned component (ADR-0011): the in-place confirmation guidelines §8 asks
// for on an irreversible delete — one confirmation repeating the verb,
// *Cancelar* focused by default, the destructive control second with an
// icon (never colour alone: the live/overdue colour is reserved for those
// states, ADR-0010, guidelines §4.2, so the destructive button stays a
// neutral `secondary`, never `text-overdue` or `bg-live`). The strings are
// passed in by the screen that owns the flow (pt-BR literals live there,
// guidelines §12.3) — this component carries no copy of its own.

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./Button";

export function ConfirmView({
  title,
  body,
  cancelLabel,
  confirmLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Programmatic focus, not `autofocus` — guidelines §8's default-to-Cancelar rule.
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-4 py-2">
      <h3 className="m-0 font-text text-t4 font-semibold text-ink">{title}</h3>
      <p className="m-0 font-text text-t3 text-muted">{body}</p>
      {error !== null && (
        <p role="alert" className="m-0 font-text text-t2 text-overdue">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onConfirm}
          disabled={busy}
        >
          <Trash2 className="size-5" aria-hidden="true" />
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
