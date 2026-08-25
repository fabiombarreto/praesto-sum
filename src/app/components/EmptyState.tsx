// The list region's empty state (layout standard §2.7, guidelines §8): a
// positive title, one line of body, one CTA that focuses capture — no
// duplicate button, never a blank region. Phase 3 (today-view-and-filters)
// adds a second, explicit branch for a filtered-to-nothing result — its
// copy and its action (*Limpar filtros*) are different, so it is a visibly
// distinct branch here rather than a silent reuse of the first.

import { Button } from "./ui/Button";

export function EmptyState({
  filtered = false,
  onCapture,
  onClearFilters,
}: {
  filtered?: boolean;
  onCapture: () => void;
  onClearFilters?: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
        <p className="m-0 font-display text-t4 font-extrabold text-ink">
          Nenhuma tarefa com esse filtro.
        </p>
        {/* prettier-ignore */}
        <Button variant="secondary" onClick={onClearFilters}>Limpar filtros</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <p className="m-0 font-display text-t4 font-extrabold text-ink">Nada para hoje.</p>
      <p className="m-0 font-text text-t2 text-muted">Bora capturar a primeira?</p>
      {/* prettier-ignore */}
      <Button variant="secondary" onClick={onCapture}>Nova tarefa</Button>
    </div>
  );
}
