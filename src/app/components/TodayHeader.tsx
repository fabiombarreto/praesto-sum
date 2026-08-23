// The flat, never-elevated header of the layout standard §2.1: the page
// title, the date in mono, and the remaining count. No icon buttons yet —
// nothing exists behind them in this phase.

import { formatHeaderDate, formatRemaining } from "../../shared/format";

export function TodayHeader({ now, remaining }: { now: Date; remaining: number }) {
  const { figure, label } = formatRemaining(remaining);

  return (
    <header className="flex items-end gap-3 px-4 pt-6 pb-2">
      <h1 className="m-0 font-text text-t4 font-bold text-ink">Hoje</h1>
      <span className="pb-0.5 font-data text-t1 font-medium text-muted tabular-nums">
        {formatHeaderDate(now)}
      </span>
      <span className="ml-auto flex items-baseline gap-1 pb-0.5">
        {figure !== null && (
          <span className="font-display text-t4 font-extrabold text-accent tabular-nums">
            {figure}
          </span>
        )}
        <span className="font-text text-t1 font-medium text-muted">{label}</span>
      </span>
    </header>
  );
}
