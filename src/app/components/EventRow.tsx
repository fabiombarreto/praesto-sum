// One Google Calendar event on the *Hoje* screen (unit 4 phase 4, layout
// standard §2.4).
//
// It sits beside `TaskRow` and must not be mistaken for one. Three cues carry
// that, never colour alone (guidelines §4.4): the absent completion control,
// the leading time column, and a dashed outline on a transparent ground
// instead of `TaskRow`'s filled `bg-surface-2`.
//
// What it must NOT use: the accent (reserved for what the owner can act on)
// and `--color-live` (reserved for live and overdue). An event is something
// another system already decided; the row says so by staying quiet.
//
// Read-only by construction (ADR-0007): no completion control, no edit, no
// delete. The one affordance is outward — opening the event in Google Calendar.

import { Calendar } from "lucide-react";
import type { CalendarEventDto } from "../../shared/api";
import { formatEventTime } from "../../shared/format";
import { cn } from "./ui/cn";

/** What an event with no title reads as. The owner's calendar contains one. */
const UNTITLED = "(sem título)";

/** Named so the destination is in the accessible name, per guidelines §10 (2.4.4 + 2.5.3). */
const DESTINATION = "Abrir no Google Calendar";

const ROW_CLASSNAME =
  // 64 px — `--row-min`, the project constant (§2.6), and the same height as
  // `TaskRow`. Found by the Tier A checklist: this was 56 px, which passes the
  // 48 px hit-area rule but puts two row kinds at different heights in one
  // list, where the mismatch reads as misalignment rather than as a distinction.
  "flex min-h-16 items-center gap-3 rounded-card border border-dashed border-line-strong px-3 py-2";

export function EventRow({ event }: { event: CalendarEventDto }) {
  const time = formatEventTime(event.start);

  const content = (
    <>
      {/* Fixed width and tabular so the times line up down the column, which is
          the whole reason §2.4 asks for a leading column rather than inline. */}
      <span className="w-14 flex-none font-data text-t1 text-muted tabular-nums">{time}</span>
      <Calendar className="size-4 flex-none text-faint" aria-hidden="true" />
      <span
        className={cn(
          "line-clamp-2 min-w-0 flex-1 font-text text-t2 text-ink",
          // Real DOM text, never a CSS pseudo-element: AC-8 requires the
          // fallback to be in the accessible name, and `::before` content is
          // not. Italic is a synthetic oblique — one Inter face ships
          // (guidelines §5.3's ≤ 100 KB budget) — accepted rather than adding
          // a second font file for one label.
          event.title === null && "text-muted italic",
        )}
      >
        {event.title ?? UNTITLED}
      </span>
    </>
  );

  // Google does not always supply `htmlLink`. A dead anchor would look
  // tappable and do nothing, which is worse than a row that never invited the
  // tap — so the same markup renders inert instead.
  if (event.htmlLink === null) {
    return (
      <li className={ROW_CLASSNAME}>
        {content}
        <span className="sr-only">Sem link para o Google Calendar.</span>
      </li>
    );
  }

  return (
    <li>
      <a
        href={event.htmlLink}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(ROW_CLASSNAME, "w-full no-underline")}
      >
        {content}
        {/* Appended to the accessible name rather than replacing it: a reader
            hears the event, then where the link goes. An `aria-label` here
            would silence the title. */}
        <span className="sr-only">— {DESTINATION}</span>
      </a>
    </li>
  );
}
