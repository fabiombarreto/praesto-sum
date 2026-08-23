// The list region's empty state (layout standard §2.7, guidelines §8): a
// positive title, one line of body, one CTA that focuses capture — no
// duplicate button, never a blank region.

import { Button } from "./ui/Button";

export function EmptyState({ onCapture }: { onCapture: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <p className="m-0 font-display text-t4 font-extrabold text-ink">Nada para hoje.</p>
      <p className="m-0 font-text text-t2 text-muted">Bora capturar a primeira?</p>
      {/* prettier-ignore */}
      <Button variant="secondary" onClick={onCapture}>Nova tarefa</Button>
    </div>
  );
}
