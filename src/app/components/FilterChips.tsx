// The quick-filter chip row of layout standard §2.3: one horizontally
// scrolling `ChipGroup` holding the three quick chips — *Abertas*, *Para
// hoje*, *Alta prioridade* — and, only while the owner has narrowed by Life
// Area, ONE applied toggle at the head of the row (life-areas PRD AC-21).
// Every quick chip's pressed state is derived from `isChipActive`, never held
// as local state: this row is a VIEW of the one `TaskFilter` `TodayScreen`
// owns, not a second copy of it (`src/shared/task-filter.ts`).
//
// The applied area chip is a toggle like its neighbours, so the row still
// holds toggles and nothing else. It leads the row rather than trailing it:
// at 375 px three quick chips already fill the row, and a chip appended after
// them would sit at or past the edge, hiding an applied narrowing filter
// until the owner scrolls. It is never hidden while the filter is set — an
// area the loaded list does not hold reads as the neutral *Área*
// (`decideAreaFilterChip`) — and tapping it clears only the area, through
// `onClearArea`; the quick chips and the sheet's other dimensions are
// untouched.
//
// Its visible label is capped (`APPLIED_LABEL_CLASS`): an area name may run to
// 40 characters, which as a chip is 341 px at 375 px and pushes all three
// quick chips to or past the edge (live pass, 2026-10-12). Only the visible
// text is cut; the full name stays in the chip's DOM text, so it is still its
// accessible name, and it is shown whole in the filter sheet. The cap is
// applied here, at the call site, and not in `Chip`, which stays as measured
// (`PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md`).
//
// The row carries no *Limpar filtros* control. It carried a trailing
// *Filtros…* chip until 2026-08-24, when the owner cut it: the header's
// filter button already opens the same sheet and already carries the
// active-count badge, so the chip was a second door to one room (guidelines
// §1, principle 4 — every element pays rent). Removing it also removed the
// odd one out, a non-toggle sitting in a row of toggles; *Limpar filtros*
// lives in the sheet and in the filtered-empty state.

import { useRef } from "react";
import {
  decideAreaFilterChip,
  type AreaFilterChipView,
  type AreaOption,
} from "../../shared/life-area-assign";
import { NO_AREA_LABEL } from "../../shared/life-areas-view";
import { isChipActive, type QuickChip, type TaskFilter } from "../../shared/task-filter";
import { Chip, ChipGroup } from "./ui/Chip";

const QUICK_CHIPS: readonly QuickChip[] = ["open", "today", "high"];

const CHIP_LABEL: Record<QuickChip, string> = {
  open: "Abertas",
  today: "Para hoje",
  high: "Alta prioridade",
};

/** The value of the applied area chip inside the group; never one of `QUICK_CHIPS`. */
const AREA_CHIP_VALUE = "area";

/** What the applied chip says for an area filter the loaded list does not hold. */
const UNKNOWN_AREA_LABEL = "Área";

/**
 * The applied chip's label: one line, at most 10 rem wide (about 20 characters
 * of the chip's text size), the rest an ellipsis. A flex item of the chip's
 * inline-flex `Toggle`, so `max-w` and `truncate` apply to it directly; the
 * chip keeps its 48 px height.
 */
const APPLIED_LABEL_CLASS = "max-w-40 truncate";

/** The applied chip's text, or `null` when there is no area filter and so no chip. */
function areaChipLabel(view: AreaFilterChipView): string | null {
  switch (view.kind) {
    case "absent":
      return null;
    case "no-area":
      return NO_AREA_LABEL;
    case "area":
      return view.name;
    case "unknown":
      return UNKNOWN_AREA_LABEL;
  }
}

export function FilterChips({
  filter,
  today,
  onToggleChip,
  areas,
  onClearArea,
}: {
  filter: TaskFilter;
  today: string;
  onToggleChip: (chip: QuickChip) => void;
  /**
   * The owner's areas as `useLifeAreas` holds them, used only to name the applied
   * chip. `null` or absent means unknown or failed. Optional so any other caller
   * compiles unchanged.
   */
  areas?: readonly AreaOption[] | null;
  /** Called when the applied area chip is tapped off; clears only the area dimension. */
  onClearArea?: () => void;
}) {
  const pressed = QUICK_CHIPS.filter((chip) => isChipActive(filter, chip, today));
  const areaLabel = areaChipLabel(decideAreaFilterChip(filter.lifeAreaId, areas ?? null));
  const areaLabelRef = useRef<HTMLSpanElement>(null);

  // The ToggleGroup reports the WHOLE next pressed-array on every tap; the
  // single chip that differs from `pressed` (derived straight from the
  // filter, never from local state) is the one that was tapped. The applied
  // area chip is checked first: when it is on screen and `next` no longer
  // holds it, it was the tap, and the quick-chip diff below must not run
  // (it ignores the area value anyway).
  function handleValueChange(next: string[]): void {
    const nextSet = new Set(next);
    if (areaLabel !== null && !nextSet.has(AREA_CHIP_VALUE)) {
      // The chip being toggled off is about to leave the DOM, and a keyboard
      // user is standing on it: left alone, focus falls to <body> and he loses
      // his place. Hand it to the chip right after it — the first quick chip,
      // which stays mounted — because that keeps him in the very row he was
      // operating, where the header's filter button would send him out of it.
      // Done before the clear so the element still exists. A pointer tap gets
      // no new ring: `:focus-visible` does not match a script focus that
      // follows a pointer focus.
      const following = areaLabelRef.current?.closest("button")?.nextElementSibling;
      if (following instanceof HTMLElement) following.focus();
      onClearArea?.();
      return;
    }
    const changed = QUICK_CHIPS.find((chip) => nextSet.has(chip) !== pressed.includes(chip));
    if (changed !== undefined) onToggleChip(changed);
  }

  return (
    <ChipGroup
      value={areaLabel === null ? pressed : [AREA_CHIP_VALUE, ...pressed]}
      onValueChange={handleValueChange}
      label="Filtros rápidos"
    >
      {areaLabel !== null && (
        <Chip value={AREA_CHIP_VALUE}>
          <span ref={areaLabelRef} title={areaLabel} className={APPLIED_LABEL_CLASS}>
            {areaLabel}
          </span>
        </Chip>
      )}
      {QUICK_CHIPS.map((chip) => (
        <Chip key={chip} value={chip}>
          {CHIP_LABEL[chip]}
        </Chip>
      ))}
    </ChipGroup>
  );
}
