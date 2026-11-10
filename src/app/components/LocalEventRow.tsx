// One local commitment (*Compromisso*) beside Google's on the *Hoje* Agenda, on the
// day screen and in search (unit 14 `events-and-day-view` phases 3 and 4, layout
// standard §2.4).
//
// It matches `EventRow`'s geometry — 64 px, the leading time column, a 16 px
// glyph, a two-line title — but is SOLID: a solid outline on a filled ground,
// where the Google row is dashed on a transparent one. Three cues carry the
// difference, never colour alone (guidelines §4.4): the outline style, the
// ground, and the glyph (`CalendarDays` here, `Calendar` on the Google row). Like
// `EventRow` it never uses the accent or `--color-live`, and it has no
// completion control: an Event occurs, it is never "done".
//
// The row opens the Compromisso sheet through `onOpen` (phase 4). It is a real
// `<button>` inside the `li` carrying the row classes, so the whole 64 px row is
// the hit area, and it has no `aria-label`: the visible time and title ARE its
// accessible name, and a label would silence them. Google rows stay read-only
// and open in Google. This closes plan decision D3-5 of phase 3, which kept the
// row inert on purpose until its sheet existed; nothing here adds hover or
// pressed styling beyond what `TaskRow`'s open button has (none). The title is
// real DOM text, never a pseudo-element.

import { CalendarDays } from "lucide-react";
import type { EventDto } from "../../shared/api";
import { timeColumnClassName } from "./EventRow";
import { cn } from "./ui/cn";

const ROW_CLASSNAME =
  "flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface-1 px-3 py-2";

export function LocalEventRow({
  event,
  timeLabel,
  wideTime = false,
  onOpen,
}: {
  event: EventDto;
  /** What the time column reads, chosen by `formatDayItemTime` for the day being shown (or `formatEventSearchWhen` in search). */
  timeLabel: string;
  /**
   * The wider column for a `HH:mm–HH:mm` label (the day screen) or a `dd/MM/aaaa · HH:mm`
   * label (search). A reviewed addition beyond phase 3's plan Task 8 text, driven by
   * plan-review advisory R-COH-OTHER-INTERNAL-CONTRADICTION #2; absent means the fixed
   * `w-14` column, the same as `EventRow`'s default. See `timeColumnClassName` in
   * `EventRow.tsx`.
   */
  wideTime?: boolean;
  /** Opens the Compromisso sheet on this commitment. */
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn(ROW_CLASSNAME, "w-full text-left")}>
        <span className={timeColumnClassName(wideTime)}>{timeLabel}</span>
        <CalendarDays className="size-4 flex-none text-faint" aria-hidden="true" />
        <span className="line-clamp-2 min-w-0 flex-1 font-text text-t2 text-ink">
          {event.title}
        </span>
      </button>
    </li>
  );
}
