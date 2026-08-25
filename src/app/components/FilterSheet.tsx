// The filter sheet (layout standard §3, PRD AC-15): Status, Prioridade and
// Período over the existing `Sheet`, light-dismissible — the one surface
// layout standard §3 allows that on. Every change applies IMMEDIATELY
// through `onChange` (there is no *Aplicar* button and no draft to lose),
// which is what makes light dismiss safe here, unlike the detail editor
// `TaskSheet`, which never passes `lightDismiss`. Every selected chip is
// derived straight from the current `TaskFilter` prop, mirroring
// `TaskSheet.tsx`'s own `ChipGroup` usage for the detail editor's date-mode
// and priority dimensions — this sheet and the chip row are two VIEWS of
// the one filter state `TodayScreen` owns, never a second copy of it.

import type { TaskPriority, TaskStatus } from "../../shared/api";
import { EMPTY_FILTER, type TaskFilter } from "../../shared/task-filter";
import { Button } from "./ui/Button";
import { Chip, ChipGroup } from "./ui/Chip";
import { Sheet } from "./ui/Sheet";

export function FilterSheet({
  open,
  onOpenChange,
  filter,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: TaskFilter;
  onChange: (next: TaskFilter) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Filtros" lightDismiss>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="m-0 font-data text-t1 font-semibold text-muted">Status</p>
          <ChipGroup
            multiple={false}
            label="Status"
            value={filter.status === null ? [] : [filter.status]}
            onValueChange={(next) =>
              onChange({ ...filter, status: (next[0] as TaskStatus | undefined) ?? null })
            }
          >
            <Chip value="open">Abertas</Chip>
            <Chip value="done">Concluídas</Chip>
            <Chip value="missed">Não concluídas</Chip>
          </ChipGroup>
        </div>

        <div className="flex flex-col gap-1">
          <p className="m-0 font-data text-t1 font-semibold text-muted">Prioridade</p>
          <ChipGroup
            multiple={false}
            label="Prioridade"
            value={filter.priority === null ? [] : [filter.priority]}
            onValueChange={(next) =>
              onChange({ ...filter, priority: (next[0] as TaskPriority | undefined) ?? null })
            }
          >
            <Chip value="high">Alta</Chip>
            <Chip value="normal">Normal</Chip>
            <Chip value="low">Baixa</Chip>
          </ChipGroup>
        </div>

        <div className="flex flex-col gap-1">
          <p className="m-0 font-data text-t1 font-semibold text-muted">Período</p>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="filter-sheet-from"
                className="m-0 font-data text-t1 font-semibold text-muted"
              >
                De
              </label>
              <input
                id="filter-sheet-from"
                type="date"
                value={filter.from ?? ""}
                onChange={(event) =>
                  onChange({
                    ...filter,
                    from: event.target.value === "" ? null : event.target.value,
                  })
                }
                className="min-h-12 w-full rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="filter-sheet-to"
                className="m-0 font-data text-t1 font-semibold text-muted"
              >
                Até
              </label>
              <input
                id="filter-sheet-to"
                type="date"
                value={filter.to ?? ""}
                onChange={(event) =>
                  onChange({ ...filter, to: event.target.value === "" ? null : event.target.value })
                }
                className="min-h-12 w-full rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
              />
            </div>
          </div>
        </div>

        <Button type="button" variant="secondary" onClick={() => onChange(EMPTY_FILTER)}>
          Limpar filtros
        </Button>
      </div>
    </Sheet>
  );
}
