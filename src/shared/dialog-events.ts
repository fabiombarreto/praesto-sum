/**
 * Which native events of a modal `<dialog>` `Sheet` reports to React as
 * `onOpenChange(false)`: the logic split out of an untestable component
 * (`docs/context/methodology.md`, "Browser-API work: split the logic out, then the glue
 * is exempt"). `Sheet` listens to both events and asks this function about each.
 *
 * A `cancel` event is a REQUEST to close (Esc, the Android back gesture). It fires while
 * the dialog is still open, and it is never stale, so it is always reported.
 *
 * A `close` event reports that the dialog HAS closed, and `dialog.close()` raises it as a
 * later task, not synchronously. When the owner reopens the sheet quickly, `showModal()`
 * can run before that task does, and the event arrives while the dialog is open again:
 * reporting it closed the sheet that had just been reopened (unit 14 phase-4 finding F2;
 * the roadmap Backlog has the trace). A real native close always runs with the dialog
 * closed, so a `close` event that finds it open is the stale event of an earlier close
 * and is ignored.
 *
 * Total and side-effect free: no DOM, no timer, no clock.
 */

export type DialogCloseEvent = "close" | "cancel";

/** Whether `Sheet` should call `onOpenChange(false)` for `event`, given `dialog.open` right now. */
export function shouldMirrorDialogClose(event: DialogCloseEvent, dialogOpen: boolean): boolean {
  return event === "cancel" || !dialogOpen;
}
