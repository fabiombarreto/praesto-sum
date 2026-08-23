// The 64 px row of the layout standard §2.6: the completion control, a
// two-line title, the meta line, and the row's single trailing element (the
// pencil, open Tasks only — never a chevron, never a delete).

import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useState } from "react";
import type { TaskDto, TaskPriority } from "../../shared/api";
import { taskMetaLine } from "../../shared/format";
import { InlineTitle } from "./InlineTitle";
import { Button } from "./ui/Button";
import { cn } from "./ui/cn";
import { CompleteControl } from "./ui/CompleteControl";

/**
 * Splits a formatted meta line into its prefix and the trailing priority
 * word, so the priority glyph can be inserted right before that word
 * without re-deriving it from `task.priority` and `taskMetaLine` twice.
 */
function splitMeta(
  meta: { text: string; overdue: boolean },
  priority: TaskPriority | null,
): { prefix: string; priorityWord: "alta" | "baixa" | null } {
  if (priority === "high" && meta.text.endsWith("alta")) {
    return { prefix: meta.text.slice(0, meta.text.length - "alta".length), priorityWord: "alta" };
  }
  if (priority === "low" && meta.text.endsWith("baixa")) {
    return { prefix: meta.text.slice(0, meta.text.length - "baixa".length), priorityWord: "baixa" };
  }
  return { prefix: meta.text, priorityWord: null };
}

export function TaskRow({
  task,
  today,
  busy,
  editing,
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
  const meta = taskMetaLine(task, today);
  const metaSplit = meta === null ? null : splitMeta(meta, task.priority);

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
          {meta !== null && metaSplit !== null && (
            <span
              className={cn(
                "font-data text-t1 font-medium text-muted tabular-nums",
                meta.overdue && "text-overdue",
              )}
            >
              {metaSplit.prefix}
              {metaSplit.priorityWord === "alta" && (
                <ChevronUp className="inline size-3" aria-hidden="true" />
              )}
              {metaSplit.priorityWord === "baixa" && (
                <ChevronDown className="inline size-3" aria-hidden="true" />
              )}
              {metaSplit.priorityWord !== null && ` ${metaSplit.priorityWord}`}
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
