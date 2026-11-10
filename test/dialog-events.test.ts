import { describe, expect, it } from "vitest";
import { shouldMirrorDialogClose } from "../src/shared/dialog-events";

// The decision `Sheet` (src/app/components/ui/Sheet.tsx) takes for every native `close` and
// `cancel` event of its <dialog>: report it to React as `onOpenChange(false)`, or ignore it.
// The component is exempt glue (docs/context/methodology.md); this is the logic split out of it.
//
// The defect it closes (unit 14 phase-4 finding F2, 2026-10-27): `dialog.close()` raises its
// `close` event as a LATER task. A quick re-open (`showModal()`) can run first, so the stale
// event arrives while the dialog is open again, and mirroring it closed the sheet that had
// just been reopened. Observed in the browser pane with stack traces: `close()` at 200 ms,
// `showModal()` at 319 ms, the `close` event at 371 ms, a second `close()` at 430 ms.

describe("shouldMirrorDialogClose - a close event", () => {
  it("is mirrored when the dialog is closed, which is what a real native close looks like", () => {
    expect(shouldMirrorDialogClose("close", false)).toBe(true);
  });

  it("is ignored when the dialog is open again, because it is the stale event of an earlier close", () => {
    expect(shouldMirrorDialogClose("close", true)).toBe(false);
  });
});

describe("shouldMirrorDialogClose - a cancel event", () => {
  it("is mirrored while the dialog is still open, which is the only time it fires (Esc, the back gesture)", () => {
    expect(shouldMirrorDialogClose("cancel", true)).toBe(true);
  });

  it("is mirrored whatever the dialog's state, because a request to close is never stale", () => {
    expect(shouldMirrorDialogClose("cancel", false)).toBe(true);
  });
});

describe("shouldMirrorDialogClose - the sequences the browser delivers", () => {
  /** What `Sheet` does with a list of [event, dialog.open at that moment]: the mirrored ones. */
  function mirrored(events: ReadonlyArray<readonly ["close" | "cancel", boolean]>): number {
    return events.filter(([type, open]) => shouldMirrorDialogClose(type, open)).length;
  }

  it("Esc: cancel while open, then the close of the dialog the browser shuts, both reported", () => {
    expect(
      mirrored([
        ["cancel", true],
        ["close", false],
      ]),
    ).toBe(2);
  });

  it("the close button: only the close of the dialog the effect shut is raised, and it is reported", () => {
    expect(mirrored([["close", false]])).toBe(1);
  });

  it("a quick re-open: the close event of the first close arrives after showModal() and is NOT reported", () => {
    // close() ... showModal() ... [stale] close event with the dialog open again.
    expect(mirrored([["close", true]])).toBe(0);
  });

  it("a close, a re-open and a second close: the stale event is dropped and the real one reported", () => {
    expect(
      mirrored([
        ["close", true],
        ["close", false],
      ]),
    ).toBe(1);
  });
});
