// Owned component (ADR-0011): the Task completion control — a 48 px hit area
// around a 26 px ring that becomes an accent disc with a halo when checked
// (layout standard §2.6; the signature completion moment is added in A5).

import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "./cn";

export function CompleteControl({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible name, e.g. "Concluir Pagar aluguel" — the visible title is in the row, not here. */
  label: string;
  /** A terminal (`missed`) Task or a busy row (TaskRow, A5). */
  disabled?: boolean;
}) {
  return (
    <Checkbox.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="group flex size-12 flex-none items-center justify-center rounded-control bg-transparent disabled:opacity-55"
    >
      <span
        className={cn(
          "praesto-ring",
          "flex size-[26px] items-center justify-center rounded-full border-2 border-faint transition-transform duration-150 group-active:scale-90 group-data-checked:border-accent group-data-checked:bg-accent group-data-checked:shadow-halo-done",
        )}
      >
        <Checkbox.Indicator>
          <Check className="size-4 text-on-accent" strokeWidth={2.5} aria-hidden="true" />
        </Checkbox.Indicator>
      </span>
    </Checkbox.Root>
  );
}
