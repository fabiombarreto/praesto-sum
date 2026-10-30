// The flat, never-elevated header of the layout standard §2.1: the page
// title, the date in mono, the remaining count, and (phase 3,
// today-view-and-filters) the 48 px filter icon button — the first of the
// up to three icon buttons §2.1 allows on the right. Its accessible name
// states the active filter count in words, and the numeric badge beside it
// is real text, never a bare dot (guidelines §4.4), so the filtered state
// is never carried by colour alone. Since unit 14 phase 3 the date beside the
// title is a button that opens the day view (`/day/AAAA-MM-DD`).

import { Search, Settings, SlidersHorizontal } from "lucide-react";
import { formatHeaderDate, formatRemaining } from "../../shared/format";
import { Button } from "./ui/Button";

export function TodayHeader({
  now,
  remaining,
  activeFilterCount,
  onOpenFilters,
  onOpenSearch,
  onOpenSettings,
  onOpenDay,
}: {
  now: Date;
  remaining: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  /** Opens `/day/<today>`: the header date is the door to the day view. */
  onOpenDay: () => void;
}) {
  const { figure, label } = formatRemaining(remaining);
  // Singular at one, plural above it — the same agreement `formatRemaining`
  // already applies to "1 restante" / "N restantes" (guidelines §9.4). Zero
  // never reaches here: with no filter the name is the bare "Filtros".
  const filterLabel =
    activeFilterCount > 0
      ? `Filtros (${activeFilterCount} ${activeFilterCount === 1 ? "ativo" : "ativos"})`
      : "Filtros";

  return (
    <header className="flex items-end gap-3 px-4 pt-6 pb-2">
      <h1 className="m-0 font-text text-t4 font-bold text-ink">Hoje</h1>
      {/* The door to `/day` (unit 14 phase 3). It keeps the date's text, mono
          face and baseline: the 48 px hit area grows UPWARD only (`min-h-12`
          with `items-end` and the same `pb-0.5` the plain span had) and takes no
          horizontal padding, so the header's other items keep their footprint
          and the 12 px gap to the title stays. The underline is the cue that it
          is a control, without a new element or width. The visible date stays
          inside the accessible name (WCAG 2.5.3). */}
      <button
        type="button"
        onClick={onOpenDay}
        className="inline-flex min-h-12 items-end bg-transparent pb-0.5 font-data text-t1 font-medium text-muted tabular-nums underline underline-offset-4"
      >
        {formatHeaderDate(now)}
        <span className="sr-only"> — abrir o dia</span>
      </button>
      <span className="ml-auto flex items-baseline gap-1 pb-0.5">
        {figure !== null && (
          <span className="font-display text-t4 font-extrabold text-accent tabular-nums">
            {figure}
          </span>
        )}
        <span className="font-text text-t1 font-medium text-muted">{label}</span>
      </span>
      <span className="relative">
        <Button type="button" variant="icon" aria-label={filterLabel} onClick={onOpenFilters}>
          <SlidersHorizontal className="size-[22px]" aria-hidden="true" />
        </Button>
        {activeFilterCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-pill bg-accent px-1 font-data text-[11px] font-bold text-on-accent tabular-nums"
          >
            {activeFilterCount}
          </span>
        )}
      </span>
      <Button type="button" variant="icon" aria-label="Pesquisar" onClick={onOpenSearch}>
        <Search className="size-[22px]" aria-hidden="true" />
      </Button>
      <Button type="button" variant="icon" aria-label="Configurações" onClick={onOpenSettings}>
        <Settings className="size-[22px]" aria-hidden="true" />
      </Button>
    </header>
  );
}
