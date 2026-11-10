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

/**
 * The leading time column of layout standard §2.4, shared with `LocalEventRow`
 * so the two row kinds cannot drift apart.
 *
 * Fixed width and tabular so the times line up down the column, which is the
 * whole reason §2.4 asks for a leading column rather than inline. The default is
 * the 56 px column of unit 4, byte for byte. The day screen's `HH:mm–HH:mm`
 * (11 characters, about 79 px at 12 px mono) does not fit in it and would break
 * at the dash, so `wide` raises the column to 80 px, never lets the label wrap,
 * and still grows if a wider fallback monospace face asks for it.
 *
 * PLAN DEVIATION (reviewed, additive): plan Task 8 describes only an optional
 * `timeLabel` and the fixed `w-14` column. `wide`, the `wideTime` props below
 * and the `min-w-20` class go beyond that text on purpose, because the plan
 * reviewer's advisory R-COH-OTHER-INTERNAL-CONTRADICTION (the second one, at plan
 * line 475) asked for the column to widen for range labels. The default markup
 * is unchanged: with `wide` false this returns the unit-4 class string exactly,
 * so *Hoje*'s Google-only Agenda renders as it did before. Recorded in
 * `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md`, "Plan deviations".
 */
export function timeColumnClassName(wide: boolean): string {
  return wide
    ? "min-w-20 flex-none whitespace-nowrap font-data text-t1 text-muted tabular-nums"
    : "w-14 flex-none font-data text-t1 text-muted tabular-nums";
}

export function EventRow({
  event,
  timeLabel,
  wideTime = false,
}: {
  event: CalendarEventDto;
  /**
   * What the time column reads. Absent means today's text exactly
   * (`formatEventTime(event.start)`); the day screen and *Hoje*'s Agenda pass
   * the label `formatDayItemTime` chose for the day being shown.
   */
  timeLabel?: string;
  /**
   * The wider column for a `HH:mm–HH:mm` label (the day screen). Absent means the
   * unit-4 column and today's markup exactly. A reviewed addition beyond plan
   * Task 8's text, driven by plan-review advisory R-COH-OTHER-INTERNAL-CONTRADICTION
   * #2; see `timeColumnClassName`.
   */
  wideTime?: boolean;
}) {
  const time = timeLabel ?? formatEventTime(event.start);

  const content = (
    <>
      <span className={timeColumnClassName(wideTime)}>{time}</span>
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
