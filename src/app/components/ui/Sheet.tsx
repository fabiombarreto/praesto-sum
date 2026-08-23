// Owned component (ADR-0011): a native <dialog> opened with showModal() — a
// bottom sheet with a handle on compact widths, a centred 560 px dialog from
// 640 px (Tailwind's existing `sm` breakpoint; layout standard §3's "from
// 600 dp" rounds to it rather than adding a second one). The `close` event
// remains the ONE contract per the HTML spec: Esc, the close button and the
// Android back gesture are all meant to raise it, and a native listener below
// mirrors it into `onOpenChange(false)`. A second native listener mirrors the
// `cancel` event the same way — a measured guard, not a second contract:
// `requestClose()` (the exact path Esc and the back gesture take) can close
// the dialog natively without ever firing `close`, observed in the
// verification browser even on a bare, React-free <dialog>; without the
// guard that leaves `open` stuck at `true` in React state forever, since no
// event would call `onOpenChange(false)` again and the sheet could never be
// reopened short of a reload. `closedby` is left at its `showModal()` default
// of `closerequest`, so there is no light dismiss on this editor. `showModal()`
// itself makes the page behind inert and scroll-locked
// (`html:has(dialog[open])` in styles.css) and returns focus to the opener
// natively on close. The `history.pushState` fallback of PRD risk row 400 is
// NOT built here — it is specified in the phase-3 plan's `## Notes` and wired
// only if the owner's device check finds the Android back gesture does not
// close this dialog.

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // A ref, not a dependency, mirrors useConnectivity.ts: `onOpenChange` is
  // typically a fresh arrow function on every render (TaskSheet.tsx,
  // DesignPlayground.tsx), so depending on it directly in the effect below
  // would tear the native listeners down and rebuild them every render. The
  // ref always reads the latest callback without that churn.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus lands on the dialog itself (`tabIndex={-1}` below), not a
      // field — so no input pops the phone's keyboard on open. This is
      // focus management by effect, the InlineTitle.tsx idiom, never the
      // `autofocus` attribute; Tab still reaches the close button first.
      dialog.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Mirrors both `close` (the one contract per the HTML spec) and `cancel`
    // (the measured guard the header comment explains) into React state.
    // `event.preventDefault()` is never called here — the platform still
    // closes the dialog either way; this only reports the request. A
    // `cancel`-then-`close` pair for the same gesture is harmless noise:
    // `reduceTaskSheet`'s `close` event is idempotent (AC-A8), so a
    // duplicate `onOpenChange(false)` never double-acts.
    const handleClose = () => onOpenChangeRef.current(false);
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleClose);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      data-sheet
      tabIndex={-1}
      aria-labelledby={titleId}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[24px] border-0 bg-surface-1 p-0 px-4 pt-2 pb-4 text-ink shadow-deck outline-none sm:inset-0 sm:m-auto sm:h-fit sm:w-[560px] sm:max-w-[calc(100vw-2rem)] sm:rounded-card"
    >
      <div
        className="mx-auto mb-3 h-1 w-8 rounded-full bg-line-strong sm:hidden"
        aria-hidden="true"
      />
      <div className="flex items-center gap-2">
        <h2 id={titleId} className="m-0 flex-1 font-text text-t4 font-semibold">
          {title}
        </h2>
        <Button
          type="button"
          variant="icon"
          aria-label="Fechar"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-[22px]" aria-hidden="true" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
