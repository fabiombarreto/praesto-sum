// One group section — the 40 px header (name + count + an optional collapse
// toggle) plus the row list, generalized from the shipped *Concluídas*
// markup (layout standard §2.5) so the section shape exists once and is
// reused four times for the groups plus a fifth time for *Concluídas*.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./ui/cn";

const HEADER_CLASSNAME = "flex min-h-12 w-full items-center gap-2 rounded-control text-left";

export function TaskGroup({
  name,
  count,
  collapsed,
  onToggle,
  children,
}: {
  name: string;
  count: number;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  // A defensive early return: the caller decides which groups to render, but
  // an empty section must never reach the DOM (layout standard §2.7).
  if (count === 0) return null;

  // The count renders in BOTH branches below, whether or not the group is
  // collapsed — the "my tasks vanished" trap §2.5 names, and the single
  // most load-bearing detail of this component.
  const headerContent = (
    <>
      {/* prettier-ignore */}
      <h2 className="m-0 font-text text-t2 font-semibold text-ink">{name}</h2>
      <span className="font-data text-t1 font-semibold text-muted tabular-nums">{count}</span>
      {onToggle !== undefined && (
        <ChevronDown
          className={cn("ml-auto size-4 transition-transform", !collapsed && "rotate-180")}
          aria-hidden="true"
        />
      )}
    </>
  );

  // *Hoje* is never collapsible (layout standard §2.5): with no `onToggle`
  // supplied, the header presents no control that would do nothing — no
  // button, no chevron, no `aria-expanded` — and its rows always show.
  const showChildren = onToggle === undefined || !collapsed;

  return (
    <section aria-label={name}>
      {onToggle === undefined ? (
        <div className={HEADER_CLASSNAME}>{headerContent}</div>
      ) : (
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className={HEADER_CLASSNAME}
        >
          {headerContent}
        </button>
      )}
      {showChildren && children}
    </section>
  );
}
