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

import { Bell, Trash2 } from "lucide-react";
import { useRef } from "react";
import type { ReactNode } from "react";
import type { ReminderDto, TaskDto, TaskPriority } from "../../shared/api";
import { instantToLocalParts } from "../../shared/dates";
import { draftFromReminder, type ReminderDraft } from "../../shared/reminder-edit";
import {
  recurrenceDraftError,
  reminderWillCarryOver,
  type RecurrenceDraft,
  type RecurrenceEndOption,
  type RecurrenceFreq,
} from "../../shared/series-edit";
import type { TaskDateMode, TaskDraft } from "../../shared/task-edit";
import { draftFromTask, type SheetView } from "../../shared/task-sheet";
import { ReminderForm } from "./ReminderForm";
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
  reminder,
  reminderDraft,
  onOpenReminder,
  onCloseReminder,
  onReminderDraftChange,
  onReminderSave,
  onReminderDeleteRequest,
  onReminderDeleteCancel,
  onReminderDeleteConfirm,
  recurrenceDraft,
  onRecurrenceDraftChange,
  onSaveWithRecurrence,
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
  /** The Task's own linked Reminder, if any (reminders phase 3, plan AC-A3). */
  reminder: ReminderDto | null;
  reminderDraft: ReminderDraft | null;
  onOpenReminder: () => void;
  onCloseReminder: () => void;
  onReminderDraftChange: (changes: Partial<ReminderDraft>) => void;
  onReminderSave: () => void;
  onReminderDeleteRequest: () => void;
  onReminderDeleteCancel: () => void;
  onReminderDeleteConfirm: () => void;
  /** The Repetir control's draft — owned by the parent, like `reminderDraft` above (recurring-tasks phase 4, plan AC-A2). */
  recurrenceDraft: RecurrenceDraft;
  onRecurrenceDraftChange: (changes: Partial<RecurrenceDraft>) => void;
  /** Fired instead of `onSave` when `recurrenceDraft.freq !== "none"`. */
  onSaveWithRecurrence: () => void;
}) {
  const lastTask = useRef<TaskDto | null>(null);
  if (task !== null) lastTask.current = task;
  const lastDraft = useRef<TaskDraft | null>(null);
  if (draft !== null) lastDraft.current = draft;
  const shown = task ?? lastTask.current;
  const shownDraft = draft ?? lastDraft.current ?? (shown === null ? null : draftFromTask(shown));
  if (shown === null || shownDraft === null) return null;

  // The Repetir control only ever applies to a Task not already part of a
  // series (PRD D11 — a series' rule is fixed at creation, never edited
  // afterward): converting one is create-then-delete, not a rule edit.
  const canRepeat = shown.seriesId === null;
  const recurrenceError = canRepeat ? recurrenceDraftError(shownDraft, recurrenceDraft) : null;
  // Derived from the Task's own linked Reminder — never from `reminderDraft`
  // above, which only holds a value while the Reminder editor view is open.
  const existingReminderDraft = reminder === null ? null : draftFromReminder(reminder);

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
            if (canRepeat && recurrenceDraft.freq !== "none") {
              if (recurrenceError !== null) return;
              onSaveWithRecurrence();
              return;
            }
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

          {canRepeat && (
            <>
              <p className="m-0 font-data text-t1 font-semibold text-muted">Repetir</p>
              <ChipGroup
                multiple={false}
                label="Repetir"
                value={[recurrenceDraft.freq]}
                onValueChange={(next) =>
                  onRecurrenceDraftChange({
                    freq: (next[0] as RecurrenceFreq | undefined) ?? "none",
                  })
                }
              >
                <Chip value="none">Não repete</Chip>
                <Chip value="daily">Diariamente</Chip>
                <Chip value="weekly">Semanalmente</Chip>
                <Chip value="monthly">Mensalmente</Chip>
                <Chip value="yearly">Anualmente</Chip>
              </ChipGroup>

              {recurrenceDraft.freq !== "none" && (
                <>
                  <p className="m-0 font-data text-t1 font-semibold text-muted">Até quando?</p>
                  <ChipGroup
                    multiple={false}
                    label="Até quando?"
                    value={[recurrenceDraft.endOption]}
                    onValueChange={(next) =>
                      onRecurrenceDraftChange({
                        endOption: (next[0] as RecurrenceEndOption | undefined) ?? "never",
                      })
                    }
                  >
                    <Chip value="never">Nunca</Chip>
                    <Chip value="until">Até uma data</Chip>
                    <Chip value="count">Depois de N vezes</Chip>
                  </ChipGroup>

                  {recurrenceDraft.endOption === "until" && (
                    <input
                      id="sheet-recurrence-until"
                      type="date"
                      aria-label="Repetir até"
                      value={recurrenceDraft.untilDate}
                      disabled={busy}
                      onChange={(event) =>
                        onRecurrenceDraftChange({ untilDate: event.target.value })
                      }
                      className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
                    />
                  )}

                  {recurrenceDraft.endOption === "count" && (
                    <input
                      id="sheet-recurrence-count"
                      type="number"
                      min={1}
                      step={1}
                      aria-label="Número de repetições"
                      value={recurrenceDraft.maxCount}
                      disabled={busy}
                      onChange={(event) =>
                        onRecurrenceDraftChange({ maxCount: event.target.value })
                      }
                      className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
                    />
                  )}

                  {existingReminderDraft !== null &&
                    !reminderWillCarryOver(existingReminderDraft) && (
                      <p className="m-0 font-text text-t1 text-muted">
                        O lembrete atual não será copiado para a série; adicione um novo lembrete
                        relativo depois de salvar.
                      </p>
                    )}

                  {recurrenceError !== null && (
                    <p role="alert" className="m-0 font-text text-t2 text-overdue">
                      {recurrenceError}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          <p className="m-0 font-data text-t1 font-semibold text-muted">Lembrete</p>
          {reminder === null ? (
            <Button
              type="button"
              variant="ghost"
              className="self-start text-muted"
              onClick={onOpenReminder}
              disabled={busy}
            >
              <Bell className="size-5" aria-hidden="true" />
              Adicionar lembrete
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-text text-t2 text-ink">
                {instantToLocalParts(reminder.fireAt).day}{" "}
                {instantToLocalParts(reminder.fireAt).time}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-muted"
                onClick={onOpenReminder}
                disabled={busy}
              >
                Editar
              </Button>
            </div>
          )}

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
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={busy || recurrenceError !== null}
            >
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
      ) : view === "reminder" ? (
        reminderDraft === null ? null : (
          <ReminderForm
            draft={reminderDraft}
            taskId={shown.id}
            busy={busy}
            error={error}
            existing={reminder !== null}
            onDraftChange={onReminderDraftChange}
            onSubmit={onReminderSave}
            onCancel={onCloseReminder}
            onDeleteRequest={onReminderDeleteRequest}
          />
        )
      ) : view === "confirm-reminder" ? (
        <ConfirmView
          title="Excluir este lembrete?"
          body="Não dá para desfazer."
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
          busy={busy}
          error={error}
          onCancel={onReminderDeleteCancel}
          onConfirm={onReminderDeleteConfirm}
        />
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
