// The in-place title editor a Task row swaps in for its body while
// `editing`. Mirrors the exact commit rule of the App.tsx InlineTitle this
// phase retires (trimmed; empty or unchanged → no request, just leave edit
// mode) — only the trigger changed (the pencil, not the title itself).

import { useEffect, useId, useRef, useState } from "react";
import type { TaskDto } from "../../shared/api";

export function InlineTitle({
  task,
  onCommit,
  onCancel,
}: {
  task: TaskDto;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  // Sheet.tsx's idiom: a stable, collision-free id for the programmatic
  // description below (guidelines §10 3.3.2).
  const descriptionId = useId();

  useEffect(() => {
    // Programmatic focus after the pencil tap — not the `autofocus`
    // attribute, which guidelines §12.5 reserves for the capture field.
    inputRef.current?.focus();
  }, []);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === task.title) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  }

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        aria-label={`Editar título de ${task.title}`}
        aria-describedby={descriptionId}
        className="min-h-12 min-w-0 flex-1 rounded-control border border-line-strong bg-surface-1 px-3 font-text text-t3 text-ink"
      />
      {/* The row's own visible title is this editor's visible label
          (guidelines §10 3.3.2 ruling, recorded in full in the phase-4
          Level A walk); this instruction has no visible equivalent to
          reuse, so it is programmatic only. */}
      <span id={descriptionId} className="sr-only">
        Enter salva, Esc cancela.
      </span>
    </>
  );
}
