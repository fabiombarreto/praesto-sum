// The dialog-agnostic pt-BR Reminder create/edit form (reminders phase 3,
// plan AC-A2/AC-A3/AC-A4) — shared by both entry points: inline inside the
// already-open `TaskSheet` (Task-linked) and inside its own `ReminderSheet`
// (standalone). Mirrors `TaskSheet.tsx`'s own form block: field order,
// `Cancelar`/`Salvar` footer, inline error, delete affordance.
//
// This component owns no requests and no draft of its own — the caller
// (`TodayScreen`, `TaskSheet`) owns the draft and the requests, exactly the
// division of labour `TaskSheet.tsx`'s own header comment states.

import { Trash2 } from "lucide-react";
import type { ReminderTimeMode, ReminderDraft } from "../../shared/reminder-edit";
import { Button } from "./ui/Button";
import { Chip, ChipGroup } from "./ui/Chip";

export function ReminderForm({
  draft,
  taskId,
  busy,
  error,
  existing,
  onDraftChange,
  onSubmit,
  onCancel,
  onDeleteRequest,
}: {
  draft: ReminderDraft;
  taskId: string | null;
  busy: boolean;
  error: string | null;
  existing: boolean;
  onDraftChange: (changes: Partial<ReminderDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDeleteRequest?: () => void;
}) {
  // A standalone Reminder MUST name what it is about (AC-2/AC-A4's
  // client-side mirror); a Task-linked one already has the Task as context.
  const saveDisabled = taskId === null && draft.label.trim() === "";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="reminder-label" className="m-0 font-data text-t1 font-semibold text-muted">
        Lembrete de quê?
      </label>
      <input
        id="reminder-label"
        type="text"
        value={draft.label}
        onChange={(event) => onDraftChange({ label: event.target.value })}
        disabled={busy}
        className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
      />

      {taskId !== null && (
        <ChipGroup
          multiple={false}
          label="Quando"
          value={[draft.timeMode]}
          onValueChange={(next) =>
            onDraftChange({ timeMode: (next[0] as ReminderTimeMode | undefined) ?? "absolute" })
          }
        >
          <Chip value="absolute">Hora exata</Chip>
          <Chip value="offset">Antes do prazo</Chip>
        </ChipGroup>
      )}

      {taskId !== null && draft.timeMode === "offset" ? (
        <>
          <label
            htmlFor="reminder-offset"
            className="m-0 font-data text-t1 font-semibold text-muted"
          >
            Minutos antes do prazo
          </label>
          <input
            id="reminder-offset"
            type="number"
            min={1}
            value={draft.offsetMinutes}
            onChange={(event) => onDraftChange({ offsetMinutes: Number(event.target.value) })}
            disabled={busy}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
          />
        </>
      ) : (
        <>
          <label htmlFor="reminder-day" className="m-0 font-data text-t1 font-semibold text-muted">
            Data
          </label>
          <input
            id="reminder-day"
            type="date"
            value={draft.absoluteDay}
            onChange={(event) => onDraftChange({ absoluteDay: event.target.value })}
            disabled={busy}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
          />
          <label htmlFor="reminder-time" className="m-0 font-data text-t1 font-semibold text-muted">
            Hora
          </label>
          <input
            id="reminder-time"
            type="time"
            value={draft.absoluteTime}
            onChange={(event) => onDraftChange({ absoluteTime: event.target.value })}
            disabled={busy}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
          />
        </>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={busy || saveDisabled}>
          Salvar
        </Button>
      </div>

      {error !== null && (
        <p role="alert" className="m-0 font-text text-t2 text-overdue">
          {error}
        </p>
      )}

      {existing && onDeleteRequest !== undefined && (
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
      )}
    </form>
  );
}
