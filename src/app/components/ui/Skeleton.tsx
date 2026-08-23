// Owned component (ADR-0011): the loading skeleton mirroring the
// `index.html` shell silhouette (header band, rows, deck) so the hand-over
// from the critical CSS to React does not jump. No animation — stillness by
// default (guidelines §7.2); after ~10 s the caller passes `slow` and one
// line is added.

export function Skeleton({ slow = false }: { slow?: boolean }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando" className="flex flex-1 flex-col">
      <div className="h-16 bg-surface-1" aria-hidden="true" />
      <div className="flex flex-col gap-2 px-4 pt-4">
        <div className="h-16 rounded-card bg-surface-1" aria-hidden="true" />
        <div className="h-16 rounded-card bg-surface-1" aria-hidden="true" />
        <div className="h-16 rounded-card bg-surface-1" aria-hidden="true" />
      </div>
      <div className="h-24 rounded-t-card bg-surface-2" aria-hidden="true" />
      {slow && <p className="px-4 font-text text-t2 text-muted">Ainda carregando…</p>}
    </div>
  );
}
