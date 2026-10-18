// The 64 px row of the layout standard §2.6: the completion control, a
// two-line title, the meta line, and the row's single trailing element (the
// pencil, open Tasks only — never a chevron, never a delete).

import { ChevronDown, ChevronUp, Pencil, Repeat } from "lucide-react";
import { useState } from "react";
import type { TaskDto } from "../../shared/api";
import { taskMetaParts } from "../../shared/format";
import { InlineTitle } from "./InlineTitle";
import { Button } from "./ui/Button";
import { cn } from "./ui/cn";
import { CompleteControl } from "./ui/CompleteControl";

export function TaskRow({
  task,
  today,
  busy,
  editing,
  areaName = null,
  onToggle,
  onOpen,
  onEdit,
  onCommitTitle,
  onCancelEdit,
}: {
  task: TaskDto;
  today: string;
  busy: boolean;
  editing: boolean;
  /**
   * The name of the Task's Life Area, resolved by the parent from its areas atom
   * (`lifeAreaNameOf`), or `null` when the Task has none or the areas are unknown.
   * Optional so a caller that does not know about areas shows none; a closed row
   * ignores it (`taskMetaParts`).
   */
  areaName?: string | null;
  onToggle: (next: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
  onCommitTitle: (title: string) => void;
  onCancelEdit: () => void;
}) {
  // The signature completion moment (ADR-0010): checking an open Task plays
  // the ring + row-leave animations (Task 7) before the optimistic status
  // change fires, so the row survives on screen until its own animation
  // ends. Reopening (next === false) is immediate — there is no moment to
  // stage there.
  const [completing, setCompleting] = useState(false);
  const isOpen = task.status === "open";
  // Structured parts, never a string to be taken apart: the priority glyph sits
  // beside its own word whatever the area is called, even an area named `alta`.
  const parts = taskMetaParts(task, today, areaName);
  // Whether anything sits before the area name inside the meta span, so the
  // separator is drawn only between two things.
  const nameFollowsSomething =
    task.seriesId !== null ||
    (parts !== null && (parts.phrase !== null || parts.priorityWord !== null));

  return (
    <li
      data-completing={completing || undefined}
      onAnimationEnd={(event) => {
        // `--duration-complete` (the ring) always outlasts `--duration-medium`
        // (this row's own leave animation) — reduced motion shortens both
        // but keeps that ordering (tokens.css). The ring's keyframes bubble
        // up from CompleteControl's inner span; filtering by name is what
        // makes the optimistic change land "after the ring fired" instead
        // of firing twice (once per animation) or racing the row's own
        // shorter leave animation.
        if (event.animationName !== "praesto-complete") return;
        setCompleting(false);
        onToggle(true);
      }}
      className="flex min-h-16 items-center gap-2 rounded-card bg-surface-2 py-2 pr-2 pl-2 shadow-row [content-visibility:auto] [contain-intrinsic-size:auto_64px]"
    >
      <CompleteControl
        checked={!isOpen}
        onCheckedChange={(next) => {
          if (isOpen && next) {
            setCompleting(true);
            return;
          }
          onToggle(next);
        }}
        label={isOpen ? `Concluir ${task.title}` : `Reabrir ${task.title}`}
        disabled={task.status === "missed" || busy}
      />

      {editing ? (
        <InlineTitle task={task} onCommit={onCommitTitle} onCancel={onCancelEdit} />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center rounded-control bg-transparent text-left"
        >
          <span
            className={cn(
              "line-clamp-2 w-full font-text text-t3 font-medium text-ink",
              task.status === "done" && "text-muted line-through",
            )}
          >
            {task.title}
          </span>
          {parts !== null && (
            <span
              className={cn(
                "font-data text-t1 font-medium text-muted tabular-nums",
                parts.overdue && "text-overdue",
                // A name can be one unbroken token up to 40 characters, wider than
                // the text column at 375 px; only a row that shows one pays for this.
                parts.areaName !== null && "break-words",
              )}
            >
              {task.seriesId !== null && (
                <>
                  <Repeat className="inline size-3" aria-hidden="true" /> Repete{" "}
                </>
              )}
              {parts.phrase}
              {parts.phrase !== null && parts.priorityWord !== null && " · "}
              {parts.priorityWord === "alta" && (
                <ChevronUp className="inline size-3" aria-hidden="true" />
              )}
              {parts.priorityWord === "baixa" && (
                <ChevronDown className="inline size-3" aria-hidden="true" />
              )}
              {parts.priorityWord !== null && ` ${parts.priorityWord}`}
              {parts.areaName !== null && `${nameFollowsSomething ? " · " : ""}${parts.areaName}`}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <Button
          type="button"
          variant="icon"
          aria-label={`Editar título de ${task.title}`}
          onClick={onEdit}
          disabled={busy}
        >
          <Pencil className="size-5" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}
