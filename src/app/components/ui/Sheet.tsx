// Owned component (ADR-0011): a bottom sheet on compact widths, a centred 560 px
// dialog from 600 px, over Base UI Dialog. The layout standard (§3) prefers native
// <dialog> for Android back = close; this component stays only if Base UI Dialog
// is verified on the device to honour close requests — otherwise A5 swaps the
// primitive and keeps the API.

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[24px] bg-surface-1 px-4 pt-2 pb-4 shadow-deck transition-transform duration-300 ease-out outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:data-ending-style:translate-y-[-45%] sm:data-starting-style:translate-y-[-45%]">
          <div
            className="mx-auto mb-3 h-1 w-8 rounded-full bg-line-strong sm:hidden"
            aria-hidden="true"
          />
          <div className="flex items-center gap-2">
            <Dialog.Title className="m-0 flex-1 font-text text-t4 font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="flex size-12 items-center justify-center rounded-control"
            >
              <X className="size-[22px]" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
