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
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ReminderDto, SeriesDto, TaskDto, TaskPriority } from "../../shared/api";
import { instantToLocalParts } from "../../shared/dates";
import { draftFromReminder, type ReminderDraft } from "../../shared/reminder-edit";
import {
  recurrenceDraftError,
  reminderWillCarryOver,
  seriesRuleDraftError,
  type ApplyTo,
  type RecurrenceDraft,
  type RecurrenceEndOption,
  type RecurrenceFreq,
  type SeriesFreq,
  type SeriesRuleDraft,
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
  series,
  seriesError,
  seriesRuleDraft,
  onSeriesRuleDraftChange,
  applyTo,
  onApplyToChange,
  onSaveSeriesOccurrence,
  onEndSeries,
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
  /**
   * The series an occurrence belongs to, loaded by the parent (`null` for a one-off,
   * or while loading). Editable since 2026-09-29 (PRD D11 amended, option (a)).
   */
  series: SeriesDto | null;
  /** Why the series could not be loaded, shown in place of the rule controls. */
  seriesError: string | null;
  seriesRuleDraft: SeriesRuleDraft | null;
  onSeriesRuleDraftChange: (changes: Partial<SeriesRuleDraft>) => void;
  /** Where title, description and priority go when a series occurrence is saved. */
  applyTo: ApplyTo;
  onApplyToChange: (next: ApplyTo) => void;
  /** Fired instead of `onSave` for a series occurrence. */
  onSaveSeriesOccurrence: () => void;
  onEndSeries: () => void;
}) {
  // Ending a series cannot be undone (there is no way back to "active"), so it
  // asks once more in place — the same rule the checklist applies to deletion.
  const [confirmEnd, setConfirmEnd] = useState(false);
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
  /**
   * When a repetition is chosen, the Data group stops describing a one-off date and
   * starts describing the FIRST occurrence — the rule's anchor, which is also where
   * the day of the cycle comes from (the server derives `byMonthday`/`byWeekday` from
   * `dtstart`). Labelling it "Data" beside a second date picker for the end condition
   * read as two competing deadlines; the owner said so after using it (2026-09-25).
   */
  const repeats = canRepeat && recurrenceDraft.freq !== "none";
  /** An occurrence of an existing series: its sheet edits the series too. */
  const isOccurrence = !canRepeat;
  const seriesRuleError =
    isOccurrence && seriesRuleDraft !== null && series?.status === "active"
      ? seriesRuleDraftError(seriesRuleDraft)
      : null;
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
            if (isOccurrence) {
              if (seriesRuleError !== null) return;
              onSaveSeriesOccurrence();
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
            {repeats ? "Primeira vez em" : isOccurrence ? "Data desta ocorrência" : "Data"}
          </p>
          <ChipGroup
            multiple={false}
            label={repeats ? "Primeira vez em" : isOccurrence ? "Data desta ocorrência" : "Data"}
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
            aria-label={repeats ? "Primeira vez em — dia" : "Data — dia"}
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
                  <p className="m-0 font-data text-t1 font-semibold text-muted">
                    Repetir até quando?
                  </p>
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

          {isOccurrence && (
            <>
              {shown.detached && (
                <p role="note" className="m-0 font-text text-t2 text-ink">
                  Esta ocorrência foi editada à parte e não segue mais as mudanças feitas na série.
                </p>
              )}

              <p className="m-0 font-data text-t1 font-semibold text-muted">
                Aplicar título, descrição e prioridade a
              </p>
              <ChipGroup
                multiple={false}
                label="Aplicar título, descrição e prioridade a"
                value={[applyTo]}
                onValueChange={(next) =>
                  onApplyToChange((next[0] as ApplyTo | undefined) ?? applyTo)
                }
              >
                <Chip value="series">Toda a série</Chip>
                <Chip value="occurrence">Só esta ocorrência</Chip>
              </ChipGroup>

              <p className="m-0 font-data text-t1 font-semibold text-muted">Repetição</p>
              {seriesError !== null ? (
                <p role="alert" className="m-0 font-text text-t2 text-overdue">
                  {seriesError}
                </p>
              ) : series === null || seriesRuleDraft === null ? (
                <p className="m-0 font-text text-t2 text-muted">Carregando repetição…</p>
              ) : series.status === "ended" ? (
                <p className="m-0 font-text text-t2 text-muted">
                  Repetição encerrada — nenhuma nova ocorrência será criada.
                </p>
              ) : (
                <>
                  <ChipGroup
                    multiple={false}
                    label="Repetição"
                    value={[seriesRuleDraft.freq]}
                    onValueChange={(next) =>
                      onSeriesRuleDraftChange({
                        freq: (next[0] as SeriesFreq | undefined) ?? seriesRuleDraft.freq,
                      })
                    }
                  >
                    <Chip value="daily">Diariamente</Chip>
                    <Chip value="weekly">Semanalmente</Chip>
                    <Chip value="monthly">Mensalmente</Chip>
                    <Chip value="yearly">Anualmente</Chip>
                  </ChipGroup>

                  {seriesRuleDraft.freq === "monthly" && (
                    <>
                      <label
                        htmlFor="sheet-series-monthday"
                        className="m-0 font-data text-t1 font-semibold text-muted"
                      >
                        Dia do mês
                      </label>
                      <input
                        id="sheet-series-monthday"
                        type="number"
                        min={1}
                        max={31}
                        step={1}
                        value={seriesRuleDraft.dayOfMonth}
                        disabled={busy}
                        onChange={(event) =>
                          onSeriesRuleDraftChange({ dayOfMonth: event.target.value })
                        }
                        className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
                      />
                    </>
                  )}

                  {seriesRuleDraft.freq === "weekly" && (
                    <ChipGroup
                      label="Dias da semana"
                      value={seriesRuleDraft.weekdays.map(String)}
                      onValueChange={(next) =>
                        onSeriesRuleDraftChange({
                          weekdays: next.map(Number).sort((a, b) => a - b),
                        })
                      }
                    >
                      <Chip value="1">Seg</Chip>
                      <Chip value="2">Ter</Chip>
                      <Chip value="3">Qua</Chip>
                      <Chip value="4">Qui</Chip>
                      <Chip value="5">Sex</Chip>
                      <Chip value="6">Sáb</Chip>
                      <Chip value="7">Dom</Chip>
                    </ChipGroup>
                  )}

                  <p className="m-0 font-data text-t1 font-semibold text-muted">
                    Repetir até quando?
                  </p>
                  <ChipGroup
                    multiple={false}
                    label="Repetir até quando?"
                    value={[seriesRuleDraft.endOption]}
                    onValueChange={(next) =>
                      onSeriesRuleDraftChange({
                        endOption: (next[0] as RecurrenceEndOption | undefined) ?? "never",
                      })
                    }
                  >
                    <Chip value="never">Nunca</Chip>
                    <Chip value="until">Até uma data</Chip>
                    <Chip value="count">Depois de N vezes</Chip>
                  </ChipGroup>

                  {seriesRuleDraft.endOption === "until" && (
                    <input
                      id="sheet-series-until"
                      type="date"
                      aria-label="Repetir até"
                      value={seriesRuleDraft.untilDate}
                      disabled={busy}
                      onChange={(event) =>
                        onSeriesRuleDraftChange({ untilDate: event.target.value })
                      }
                      className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
                    />
                  )}

                  {seriesRuleDraft.endOption === "count" && (
                    <input
                      id="sheet-series-count"
                      type="number"
                      min={1}
                      step={1}
                      aria-label="Número de repetições"
                      value={seriesRuleDraft.maxCount}
                      disabled={busy}
                      onChange={(event) =>
                        onSeriesRuleDraftChange({ maxCount: event.target.value })
                      }
                      className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
                    />
                  )}

                  <p className="m-0 font-text text-t1 text-muted">
                    Mudanças na repetição valem a partir da próxima ocorrência. Esta continua na
                    data atual.
                  </p>

                  {seriesRuleError !== null && (
                    <p role="alert" className="m-0 font-text text-t2 text-overdue">
                      {seriesRuleError}
                    </p>
                  )}

                  {confirmEnd ? (
                    <div className="flex flex-col gap-2">
                      <p className="m-0 font-text text-t2 text-ink">
                        Encerrar a repetição? Esta ocorrência continua; nenhuma nova será criada, e
                        não há como desfazer.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => setConfirmEnd(false)}
                        >
                          Manter repetição
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setConfirmEnd(false);
                            onEndSeries();
                          }}
                        >
                          Encerrar repetição
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setConfirmEnd(true)}
                    >
                      Encerrar repetição
                    </Button>
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
