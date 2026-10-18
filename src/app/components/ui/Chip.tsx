// Owned components (ADR-0011): filter chips over Base UI Toggle / ToggleGroup —
// 48 × 48 px minimum hit areas (width too, so a short label never drops a chip
// below the rule), pill shape, on-state by fill + weight + a leading check (never
// colour alone, guidelines §4.4).

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function ChipGroup({
  value,
  onValueChange,
  children,
  label,
  multiple = true,
  wrap = false,
}: {
  value: string[];
  onValueChange: (next: string[]) => void;
  children: ReactNode;
  label: string;
  multiple?: boolean;
  /**
   * Opt-in: lay the chips out on as many rows as they need instead of one
   * horizontally scrolling row. For groups whose length is the owner's own (his
   * areas), which could otherwise hide chips off to the side. Off by default, so
   * every existing group renders exactly as before.
   */
  wrap?: boolean;
}) {
  return (
    <ToggleGroup
      multiple={multiple}
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      className={
        wrap
          ? "flex flex-wrap gap-2 px-4 py-1"
          : "flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]"
      }
    >
      {children}
    </ToggleGroup>
  );
}

export function Chip({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Toggle
      value={value}
      className="inline-flex min-h-12 min-w-12 flex-none items-center justify-center gap-1 rounded-pill border border-line bg-surface-2 px-3 font-text text-t2 font-medium whitespace-nowrap text-ink data-pressed:border-transparent data-pressed:bg-accent data-pressed:font-semibold data-pressed:text-on-accent"
    >
      <Check className="hidden size-4 in-data-pressed:block" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </Toggle>
  );
}
