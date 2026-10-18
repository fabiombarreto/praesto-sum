// The small `/settings` card linking into `/settings/life-areas` (life-areas
// phase 2). Stateless, like `AdherenceEntryCard`: the behaviour it links to
// belongs to `LifeAreasScreen`. *Áreas* is reached only from here (layout
// standard §1, model B): no bottom bar and no header entry on *Hoje*.

import { Button } from "./ui/Button";

export function LifeAreasEntryCard({ onOpenLifeAreas }: { onOpenLifeAreas: () => void }) {
  return (
    <section aria-label="Áreas" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4">
      <p className="m-0 font-text text-t2 text-muted">
        Crie áreas da sua vida, como Casa ou Saúde, para agrupar suas tarefas.
      </p>
      <Button type="button" variant="primary" onClick={onOpenLifeAreas}>
        Abrir
      </Button>
    </section>
  );
}
