// The small `/settings` card linking into `/settings/adherence` (adherence-mirror
// phase 3). Stateless, like `NotificationsEntryCard`: the behaviour it links to
// belongs to `AdherenceScreen`.

import { Button } from "./ui/Button";

export function AdherenceEntryCard({ onOpenAdherence }: { onOpenAdherence: () => void }) {
  return (
    <section aria-label="Aderência" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4">
      <p className="m-0 font-text text-t2 text-muted">
        Veja quais tarefas repetidas você não concluiu.
      </p>
      <Button type="button" variant="primary" onClick={onOpenAdherence}>
        Abrir
      </Button>
    </section>
  );
}
