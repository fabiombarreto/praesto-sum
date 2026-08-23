// The detail editor inside `Sheet` (A5 phase 3, replacing the old full-screen editor):
// title / description fields, the date chips + native date input, the
// priority chips, *Cancelar / Salvar*, the distant *Excluir*, and the
// in-place delete confirmation, in the layout standard §3 field order. The
// parent (`TodayScreen.tsx` / `DesignPlayground.tsx`) owns the draft and the
// requests — this component is glue: it renders the current draft and calls
// back on every change, it never holds state of its own beyond what it last
// saw. While the sheet's exit transition plays, `task` and `draft` both become
// `null` (the reducer already closed) before the animation finishes, so the
// last Task AND its last draft are each kept in a ref and rendered through the
// fade — instead of popping empty, or reverting the fields to the Task's
// pre-edit values, for ~300 ms.

import { Trash2 } from "lucide-react";
import { useRef } from "react";
import type { ReactNode } from "react";
import type { TaskDto, TaskPriority } from "../../shared/api";
import type { TaskDateMode, TaskDraft } from "../../shared/task-edit";
import { draftFromTask, type SheetView } from "../../shared/task-sheet";
import { Button } from "./ui/Button";
import { Chip, ChipGroup } from "./ui/Chip";
import { ConfirmView } from "./ui/ConfirmView";
import { Sheet } from "./ui/Sheet";

export function TaskSheet({
  task,
  open,
  view,
  draft,
  busy,
  error,
  toastSlot,
  onDraftChange,
  onClose,
  onSave,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  task: TaskDto | null;
  open: boolean;
  view: SheetView;
  draft: TaskDraft | null;
  busy: boolean;
  error: string | null;
  toastSlot: ReactNode;
  onDraftChange: (changes: Partial<TaskDraft>) => void;
  onClose: () => void;
  onSave: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  const lastTask = useRef<TaskDto | null>(null);
  if (task !== null) lastTask.current = task;
  const lastDraft = useRef<TaskDraft | null>(null);
  if (draft !== null) lastDraft.current = draft;
  const shown = task ?? lastTask.current;
  const shownDraft = draft ?? lastDraft.current ?? (shown === null ? null : draftFromTask(shown));
  if (shown === null || shownDraft === null) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={shown.title}
    >
      {view === "detail" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label htmlFor="sheet-title" className="m-0 font-data text-t1 font-semibold text-muted">
            Título
          </label>
          <input
            id="sheet-title"
            type="text"
            value={shownDraft.title}
            onChange={(event) => onDraftChange({ title: event.target.value })}
            disabled={busy}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
          />

          <label
            htmlFor="sheet-description"
            className="m-0 font-data text-t1 font-semibold text-muted"
          >
            Descrição
          </label>
          <textarea
            id="sheet-description"
            rows={3}
            value={shownDraft.description}
            onChange={(event) => onDraftChange({ description: event.target.value })}
            disabled={busy}
            className="min-h-24 rounded-control border border-line-strong bg-surface-1 px-4 py-3 font-text text-t3 text-ink shadow-field"
          />

          <p id="sheet-date-label" className="m-0 font-data text-t1 font-semibold text-muted">
            Data
          </p>
          <ChipGroup
            multiple={false}
            label="Data"
            value={[shownDraft.dateMode]}
            onValueChange={(next) =>
              onDraftChange({ dateMode: (next[0] as TaskDateMode | undefined) ?? "none" })
            }
          >
            <Chip value="none">Sem data</Chip>
            <Chip value="deadline">Concluir até</Chip>
            <Chip value="scheduled">Fazer em</Chip>
          </ChipGroup>
          <input
            id="sheet-date"
            type="date"
            aria-label="Data — dia"
            value={shownDraft.date}
            disabled={busy || shownDraft.dateMode === "none"}
            onChange={(event) => onDraftChange({ date: event.target.value })}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field disabled:opacity-55"
          />

          <p className="m-0 font-data text-t1 font-semibold text-muted">Prioridade</p>
          <ChipGroup
            multiple={false}
            label="Prioridade"
            value={shownDraft.priority === null ? [] : [shownDraft.priority]}
            onValueChange={(next) =>
              onDraftChange({ priority: (next[0] as TaskPriority | undefined) ?? null })
            }
          >
            <Chip value="high">Alta</Chip>
            <Chip value="normal">Normal</Chip>
            <Chip value="low">Baixa</Chip>
          </ChipGroup>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
              Salvar
            </Button>
          </div>

          {error !== null && (
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {error}
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            className="mt-4 self-start text-muted"
            onClick={onDeleteRequest}
            disabled={busy}
          >
            <Trash2 className="size-5" aria-hidden="true" />
            Excluir
          </Button>
        </form>
      ) : (
        <ConfirmView
          title="Excluir esta tarefa?"
          body="Não dá para desfazer."
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
          busy={busy}
          error={error}
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
        />
      )}
      <div className="mt-4 empty:hidden">{toastSlot}</div>
    </Sheet>
  );
}
