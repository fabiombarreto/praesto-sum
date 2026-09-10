// The bell-glyph row for a standalone Reminder on *Hoje* (reminders phase 3,
// plan AC-A2 display) — layout standard §6: "standalone Reminders as rows
// with a bell glyph in *Hoje*". Adapts `EventRow`'s leading-glyph-plus-title
// row shape with `Bell` and, unlike a read-only Google event, a filled
// `bg-surface-2` background — a Reminder is the owner's own item.
//
// No completion control (a Reminder has no open/done state) and no trailing
// edit icon (unlike `TaskRow`'s pencil): tapping the row opens `ReminderSheet`
// directly, since a Reminder's only fields are exactly what that sheet edits.

import { Bell } from "lucide-react";
import type { ReminderDto } from "../../shared/api";
import { instantToLocalParts, todayIn } from "../../shared/dates";

export function ReminderRow({ reminder, onOpen }: { reminder: ReminderDto; onOpen: () => void }) {
  const { day, time } = instantToLocalParts(reminder.fireAt);
  const today = todayIn(new Date());
  const meta = day === today ? time : `${day} ${time}`;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-center gap-3 rounded-card bg-surface-2 px-3 py-2 text-left shadow-row"
      >
        <Bell className="size-4 flex-none text-faint" aria-hidden="true" />
        <span className="line-clamp-2 min-w-0 flex-1 font-text text-t2 text-ink">
          {reminder.label}
        </span>
        <span className="flex-none font-data text-t1 text-muted tabular-nums">{meta}</span>
      </button>
    </li>
  );
}
