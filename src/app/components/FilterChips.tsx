// The quick-filter chip row of layout standard §2.3: one horizontally
// scrolling `ChipGroup` holding the three quick chips — *Abertas*, *Para
// hoje*, *Alta prioridade*. Every chip's pressed state is derived from
// `isChipActive`, never held as local state: this row is a VIEW of the one
// `TaskFilter` `TodayScreen` owns, not a second copy of it
// (`src/shared/task-filter.ts`).
//
// The row holds toggles and nothing else. It carried a trailing *Filtros…*
// chip until 2026-08-24, when the owner cut it: the header's filter button
// already opens the same sheet and already carries the active-count badge,
// so the chip was a second door to one room (guidelines §1, principle 4 —
// every element pays rent). Removing it also removes the odd one out, a
// non-toggle sitting in a row of toggles.

import { isChipActive, type QuickChip, type TaskFilter } from "../../shared/task-filter";
import { Chip, ChipGroup } from "./ui/Chip";

const QUICK_CHIPS: readonly QuickChip[] = ["open", "today", "high"];

const CHIP_LABEL: Record<QuickChip, string> = {
  open: "Abertas",
  today: "Para hoje",
  high: "Alta prioridade",
};

export function FilterChips({
  filter,
  today,
  onToggleChip,
}: {
  filter: TaskFilter;
  today: string;
  onToggleChip: (chip: QuickChip) => void;
}) {
  const pressed = QUICK_CHIPS.filter((chip) => isChipActive(filter, chip, today));

  // The ToggleGroup reports the WHOLE next pressed-array on every tap; the
  // single chip that differs from `pressed` (derived straight from the
  // filter, never from local state) is the one that was tapped.
  function handleValueChange(next: string[]): void {
    const nextSet = new Set(next);
    const changed = QUICK_CHIPS.find((chip) => nextSet.has(chip) !== pressed.includes(chip));
    if (changed !== undefined) onToggleChip(changed);
  }

  return (
    <ChipGroup value={pressed} onValueChange={handleValueChange} label="Filtros rápidos">
      {QUICK_CHIPS.map((chip) => (
        <Chip key={chip} value={chip}>
          {CHIP_LABEL[chip]}
        </Chip>
      ))}
    </ChipGroup>
  );
}
