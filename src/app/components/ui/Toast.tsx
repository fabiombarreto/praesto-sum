// Owned component (ADR-0011): the one toast slot the app shares (guidelines
// §8) — text + icon, an optional secondary and action button, and a close
// control only when the toast persists (has an action). Token utilities and
// `cn()`, in the Button.tsx idiom.

import { Info, TriangleAlert, Undo2, X } from "lucide-react";
import type { ToastSpec } from "../../../shared/toast";
import { Button } from "./Button";
import { cn } from "./cn";

export function Toast({
  toast,
  onAction,
  onSecondary,
  onDismiss,
}: {
  toast: ToastSpec;
  onAction: () => void;
  onSecondary: () => void;
  onDismiss: () => void;
}) {
  const isError = toast.tone === "error";
  const Icon = isError ? TriangleAlert : toast.action?.label === "Desfazer" ? Undo2 : Info;

  return (
    <div
      // The role alone carries the politeness: `alert` implies assertive,
      // `status` implies polite — an explicit live-region override here
      // would undo that implicit value, which is why an error used to
      // announce no more urgently than a confirmation.
      role={isError ? "alert" : "status"}
      className="flex min-h-12 items-center gap-3 rounded-control border border-line bg-surface-2 px-4 py-2 text-t2 text-ink shadow-row"
    >
      <Icon
        className={cn("size-5 flex-none", isError ? "text-overdue" : "text-muted")}
        aria-hidden="true"
      />
      <span className="flex-1">{toast.text}</span>
      {toast.secondary && (
        <Button type="button" variant="ghost" onClick={onSecondary}>
          {toast.secondary.label}
        </Button>
      )}
      {toast.action && (
        <Button type="button" variant="ghost" onClick={onAction}>
          {toast.action.label}
        </Button>
      )}
      {toast.action && (
        <Button type="button" variant="icon" aria-label="Fechar aviso" onClick={onDismiss}>
          <X className="size-5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
