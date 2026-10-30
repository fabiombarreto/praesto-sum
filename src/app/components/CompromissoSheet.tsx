// The Compromisso sheet (unit 14 `events-and-day-view` phase 4, PRD AC-27 to AC-30):
// create, change and delete one commitment (an Event) inside `Sheet`, in the Task
// sheet's pattern. Fields in the PRD's order — *Título*, *Dia inteiro*, *Início*,
// *Fim*, *Fuso horário*, *Local*, *Descrição* — then *Cancelar* / *Salvar* and, for
// an existing commitment only, the distant *Excluir* behind the irreversible
// confirmation (layout standard §3, guidelines §8).
//
// Controlled glue, like `TaskSheet`: the parent (`useEventSheet`) owns the draft and
// the requests; this component renders the current draft and calls back, holding no
// form state of its own beyond whether *Salvar* has been pressed since the sheet
// opened (so a field's reason is not shown before the first press — guidelines §8,
// field error; only the end-before-start reason shows live). The decisions about
// the draft live in `src/shared` and are tested there: `event-edit.ts` (the draft,
// its errors, the end the owner has not typed yet), `event-sheet.ts` (which draft is
// kept) and `event-view.ts` (the sentences).
//
// While the sheet's exit transition plays, `draft`, `title` and `mode` all become
// `null` (the reducer already closed) before the animation finishes, so the last of
// each is kept in a ref and rendered through the fade, instead of popping empty.
//
// A native `showModal()` makes the page behind inert, so the sheet carries its own
// offline notice. Offline disables every WRITE (*Salvar*, *Excluir*, the
// confirmation's *Excluir*); *Cancelar*, *Fechar* and reading stay available.

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  draftEndPreview,
  eventDraftErrors,
  type EventDraft,
  type EventDraftError,
} from "../../shared/event-edit";
import type { EventSheetView } from "../../shared/event-sheet";
import { eventDraftErrorMessage, formatDraftEnd } from "../../shared/event-view";
import { EVENT_DESCRIPTION_MAX, EVENT_LOCATION_MAX, EVENT_TITLE_MAX } from "../../shared/events";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Chip, ChipGroup } from "./ui/Chip";
import { ConfirmView } from "./ui/ConfirmView";
import { Sheet } from "./ui/Sheet";

export interface CompromissoSheetProps {
  open: boolean;
  /** The sheet's heading: `NEW_EVENT_LABEL` for a new commitment, the commitment's own title for an edit. */
  title: string | null;
  mode: "new" | "edit" | null;
  view: EventSheetView;
  draft: EventDraft | null;
  /** The options of *Fuso horário*, already ordered (`timeZoneChoices`). */
  timeZones: readonly string[];
  busy: boolean;
  /** False while offline: every write control is disabled, reading and *Cancelar* stay. */
  writable: boolean;
  /**
   * The reason the last request failed, shown inline and kept until the sheet moves on
   * (the next request's outcome, a reopen, or a switch to or from the confirmation);
   * no toast replaces it.
   */
  error: string | null;
  onDraftChange: (changes: Partial<EventDraft>) => void;
  onClose: () => void;
  onSave: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}

const LABEL_CLASSNAME = "m-0 font-data text-t1 font-semibold text-muted";
const SUBLABEL_CLASSNAME = "m-0 font-text text-t1 text-muted";
const FIELD_CLASSNAME =
  "min-h-12 min-w-0 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field";

/** One field's reason, as an alert right after the field it is about. */
function FieldError({ id, error }: { id: string; error: EventDraftError | undefined }) {
  if (error === undefined) return null;
  return (
    <p id={id} role="alert" className="m-0 font-text text-t2 text-overdue">
      {eventDraftErrorMessage(error)}
    </p>
  );
}

export function CompromissoSheet({
  open,
  title,
  mode,
  view,
  draft,
  timeZones,
  busy,
  writable,
  error,
  onDraftChange,
  onClose,
  onSave,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: CompromissoSheetProps) {
  // Whether *Salvar* has been pressed since the sheet opened, with a valid draft or
  // not (set on every submit, cleared when the sheet closes): until then only the
  // end-before-start reason is shown, and afterwards every reason shows as it holds.
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    if (!open) setAttempted(false);
  }, [open]);

  const lastDraft = useRef<EventDraft | null>(null);
  if (draft !== null) lastDraft.current = draft;
  const lastTitle = useRef<string | null>(null);
  if (title !== null) lastTitle.current = title;
  const lastMode = useRef<"new" | "edit" | null>(null);
  if (mode !== null) lastMode.current = mode;

  const shownDraft = draft ?? lastDraft.current;
  const shownTitle = title ?? lastTitle.current;
  const shownMode = mode ?? lastMode.current;
  if (shownDraft === null || shownTitle === null) return null;

  // The end-before-start reason shows live, the moment it holds (AC-28); every
  // other reason waits for a *Salvar* attempt.
  const errors = eventDraftErrors(shownDraft).filter(
    (candidate) => attempted || candidate.field === "end",
  );
  const errorOf = (field: EventDraftError["field"]) =>
    errors.find((candidate) => candidate.field === field);
  const endPreview = draftEndPreview(shownDraft);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={shownTitle}
    >
      {!writable && (
        <div className="-mx-4 mb-2">
          <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
        </div>
      )}

      {view === "form" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setAttempted(true);
            if (eventDraftErrors(shownDraft).length === 0) onSave();
          }}
        >
          <label htmlFor="event-sheet-title" className={LABEL_CLASSNAME}>
            Título
          </label>
          <input
            id="event-sheet-title"
            type="text"
            maxLength={EVENT_TITLE_MAX}
            value={shownDraft.title}
            onChange={(event) => onDraftChange({ title: event.target.value })}
            disabled={busy}
            aria-invalid={errorOf("title") !== undefined}
            aria-describedby={
              errorOf("title") === undefined ? undefined : "event-sheet-title-error"
            }
            className={FIELD_CLASSNAME}
          />
          <FieldError id="event-sheet-title-error" error={errorOf("title")} />

          <ChipGroup
            label="Dia inteiro"
            value={shownDraft.allDay ? ["allDay"] : []}
            onValueChange={(next) => onDraftChange({ allDay: next.includes("allDay") })}
          >
            <Chip value="allDay">Dia inteiro</Chip>
          </ChipGroup>

          <fieldset
            className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
            aria-describedby={
              errorOf("start") === undefined ? undefined : "event-sheet-start-error"
            }
          >
            <legend className={`${LABEL_CLASSNAME} mb-2 p-0`}>Início</legend>
            <div className="flex min-w-0 gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="event-sheet-start-day" className={SUBLABEL_CLASSNAME}>
                  Dia
                </label>
                <input
                  id="event-sheet-start-day"
                  type="date"
                  value={shownDraft.startDay}
                  onChange={(event) => onDraftChange({ startDay: event.target.value })}
                  disabled={busy}
                  className={FIELD_CLASSNAME}
                />
              </div>
              {!shownDraft.allDay && (
                <div className="flex w-32 flex-none flex-col gap-1">
                  <label htmlFor="event-sheet-start-time" className={SUBLABEL_CLASSNAME}>
                    Hora
                  </label>
                  <input
                    id="event-sheet-start-time"
                    type="time"
                    value={shownDraft.startTime}
                    onChange={(event) => onDraftChange({ startTime: event.target.value })}
                    disabled={busy}
                    className={`${FIELD_CLASSNAME} px-3`}
                  />
                </div>
              )}
            </div>
          </fieldset>
          <FieldError id="event-sheet-start-error" error={errorOf("start")} />

          <fieldset
            className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
            aria-describedby={errorOf("end") === undefined ? undefined : "event-sheet-end-error"}
          >
            <legend className={`${LABEL_CLASSNAME} mb-2 p-0`}>Fim</legend>
            <div className="flex min-w-0 gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="event-sheet-end-day" className={SUBLABEL_CLASSNAME}>
                  Dia
                </label>
                <input
                  id="event-sheet-end-day"
                  type="date"
                  value={shownDraft.endDay}
                  onChange={(event) => onDraftChange({ endDay: event.target.value })}
                  disabled={busy}
                  className={FIELD_CLASSNAME}
                />
              </div>
              {!shownDraft.allDay && (
                <div className="flex w-32 flex-none flex-col gap-1">
                  <label htmlFor="event-sheet-end-time" className={SUBLABEL_CLASSNAME}>
                    Hora
                  </label>
                  <input
                    id="event-sheet-end-time"
                    type="time"
                    value={shownDraft.endTime}
                    onChange={(event) => onDraftChange({ endTime: event.target.value })}
                    disabled={busy}
                    className={`${FIELD_CLASSNAME} px-3`}
                  />
                </div>
              )}
            </div>
          </fieldset>
          <FieldError id="event-sheet-end-error" error={errorOf("end")} />
          {endPreview !== null && (
            <p role="status" className="m-0 font-text text-t2 text-muted">
              {formatDraftEnd(endPreview)}
            </p>
          )}

          <label htmlFor="event-sheet-zone" className={LABEL_CLASSNAME}>
            Fuso horário
          </label>
          <select
            id="event-sheet-zone"
            value={shownDraft.timezone}
            onChange={(event) => onDraftChange({ timezone: event.target.value })}
            disabled={busy}
            className={FIELD_CLASSNAME}
          >
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>

          <label htmlFor="event-sheet-location" className={LABEL_CLASSNAME}>
            Local
          </label>
          <input
            id="event-sheet-location"
            type="text"
            maxLength={EVENT_LOCATION_MAX}
            value={shownDraft.location}
            onChange={(event) => onDraftChange({ location: event.target.value })}
            disabled={busy}
            aria-invalid={errorOf("location") !== undefined}
            aria-describedby={
              errorOf("location") === undefined ? undefined : "event-sheet-location-error"
            }
            className={FIELD_CLASSNAME}
          />
          <FieldError id="event-sheet-location-error" error={errorOf("location")} />

          <label htmlFor="event-sheet-description" className={LABEL_CLASSNAME}>
            Descrição
          </label>
          <textarea
            id="event-sheet-description"
            rows={3}
            maxLength={EVENT_DESCRIPTION_MAX}
            value={shownDraft.description}
            onChange={(event) => onDraftChange({ description: event.target.value })}
            disabled={busy}
            aria-invalid={errorOf("description") !== undefined}
            aria-describedby={
              errorOf("description") === undefined ? undefined : "event-sheet-description-error"
            }
            className={`${FIELD_CLASSNAME} min-h-24 py-3`}
          />
          <FieldError id="event-sheet-description-error" error={errorOf("description")} />

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
            <Button type="submit" variant="primary" className="flex-1" disabled={busy || !writable}>
              Salvar
            </Button>
          </div>

          {error !== null && (
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {error}
            </p>
          )}

          {shownMode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              className="mt-4 self-start text-muted"
              onClick={onDeleteRequest}
              disabled={busy || !writable}
            >
              <Trash2 className="size-5" aria-hidden="true" />
              Excluir
            </Button>
          )}
        </form>
      ) : (
        <ConfirmView
          title="Excluir este compromisso?"
          body="Não dá para desfazer."
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
          busy={busy}
          confirmDisabled={!writable}
          error={error}
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
        />
      )}
    </Sheet>
  );
}
