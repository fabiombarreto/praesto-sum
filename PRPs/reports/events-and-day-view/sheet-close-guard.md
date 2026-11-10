# UI/UX review checklist — the `Sheet` close guard (unit 14 follow-up, 2026-10-27)

What changed: `src/app/components/ui/Sheet.tsx` now asks `shouldMirrorDialogClose` (`src/shared/dialog-events.ts`) before it reports a
native `close` or `cancel` event of its `<dialog>` as `onOpenChange(false)`. No markup, class, token, copy, motion or target size
changed; the only behaviour that changes is that a stale `close` event, which arrives after a quick reopen, no longer closes the
sheet that was just reopened (finding F2 of `phase-4/live-browser-pass.md`). Every sheet shares the primitive: Task, Reminder,
Filter, Compromisso.

Evidence: the pure decision is pinned by `test/dialog-events.test.ts` (8 cases, red before the module existed); the whole suite and
`npm run check` pass; the browser pane then ran the sweep that had reproduced the defect (a reopen 0, 20, 60 and 120 ms after
*Cancelar*), 12 of 12 reopenings on the Compromisso sheet and 8 of 8 on the Task sheet, and a real `Escape` and the *Fechar* button
still closed the sheet with a reopen working after each. Nothing was measured or photographed on a device.

## Tier A — every interface change

1. ✔ — method: static inspection. No control was added or changed; the screen's one primary action is the same on every screen.
2. ✔ — method: static inspection. No target, spacing or size changed.
3. ✔ — method: static inspection. No state was added that colour alone could carry.
4. ✔ — method: static inspection. No copy was added or changed (ADR-0009 untouched).
5. ✔ — method: the live pass above. `Esc` (the `cancel` path) and the *Fechar* button still close the sheet, focus handling is the
   unchanged effect, and a reopen right after closing now works; the visible focus ring and the Android back gesture are not
   re-observed here and stay with the owner's device.
6. ✔ — method: static inspection. No label, role or accessible name changed.
7. ✔ — method: static inspection. No token, colour, motion or inline style was added.
8. ✔ — method: static inspection. No destructive action was added or changed.
9. ✔ — method: static inspection. No request, origin or script was added.

## Tier B — a changed screen

None of the five items applies: no screen, state table, layout, bundle-size-relevant dependency or screenshot-worthy change. The
module adds a few bytes to the first-load JavaScript.

Result: no ✘. Owed to the owner's device: whether the stale-event window exists at all on the phone, which the 12 of 12 sweep in the
browser pane cannot say (the pane may delay tasks); the guard is correct either way.
