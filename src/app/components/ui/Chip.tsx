// Owned components (ADR-0011): filter chips over Base UI Toggle / ToggleGroup —
// 48 px hit areas, pill shape, on-state by fill + weight + a leading check (never
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
}: {
  value: string[];
  onValueChange: (next: string[]) => void;
  children: ReactNode;
  label: string;
  multiple?: boolean;
}) {
  return (
    <ToggleGroup
      multiple={multiple}
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      className="flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]"
    >
      {children}
    </ToggleGroup>
  );
}

export function Chip({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Toggle
      value={value}
      className="inline-flex min-h-12 flex-none items-center gap-1 rounded-pill border border-line bg-surface-2 px-3 font-text text-t2 font-medium whitespace-nowrap text-ink data-pressed:border-transparent data-pressed:bg-accent data-pressed:font-semibold data-pressed:text-on-accent"
    >
      <Check className="hidden size-4 in-data-pressed:block" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </Toggle>
  );
}
