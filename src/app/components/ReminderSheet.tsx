// The standalone-Reminder dialog (reminders phase 3, plan AC-A2): wraps
// `ReminderForm` (create/edit) and `ConfirmView` (delete confirmation)
// inside `Sheet`, the same shape `TaskSheet.tsx` already uses for its own
// two views. This component owns no requests and no reducer of its own —
// the caller (`TodayScreen`) owns the open/closed state, the draft and the
// requests, exactly the division of labour `TaskSheet.tsx`'s own header
// comment states.

import type { ReminderDto } from "../../shared/api";
import type { ReminderDraft } from "../../shared/reminder-edit";
import { ReminderForm } from "./ReminderForm";
import { ConfirmView } from "./ui/ConfirmView";
import { Sheet } from "./ui/Sheet";

export function ReminderSheet({
  open,
  reminder,
  draft,
  view,
  busy,
  error,
  onDraftChange,
  onClose,
  onSave,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  open: boolean;
  reminder: ReminderDto | null;
  draft: ReminderDraft | null;
  view: "form" | "confirm";
  busy: boolean;
  error: string | null;
  onDraftChange: (changes: Partial<ReminderDraft>) => void;
  onClose: () => void;
  onSave: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  if (draft === null) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={reminder === null ? "Novo lembrete" : "Editar lembrete"}
    >
      {view === "form" ? (
        <ReminderForm
          draft={draft}
          taskId={null}
          busy={busy}
          error={error}
          existing={reminder !== null}
          onDraftChange={onDraftChange}
          onSubmit={onSave}
          onCancel={onClose}
          onDeleteRequest={onDeleteRequest}
        />
      ) : (
        <ConfirmView
          title="Excluir este lembrete?"
          body="Não dá para desfazer."
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
          busy={busy}
          error={error}
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
        />
      )}
    </Sheet>
  );
}
