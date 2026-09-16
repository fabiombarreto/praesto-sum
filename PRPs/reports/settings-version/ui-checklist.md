# UI/UX review checklist — the build stamp on the settings screen (chore C18)

Change: `vite.config.ts` injects `__APP_VERSION__`; `src/shared/app-version.ts` formats it;
`SettingsScreen.tsx` renders one line in the corner of the scrolling content.
Branch `chore/settings-version`, worktree `.worktrees/settings-version`, base `main@85f109b`.
Run 2026-09-16 in the browser pane against this worktree's own dev server.

## Tier A — every interface change

1. **One primary action on the screen; nothing added "just in case".** ✔ — the line is reference
   text, not a control: no button, no link, nothing tappable. The screen's actions are unchanged.
2. **Every tappable control ≥ 48 × 48 px and ≥ 8 px from its neighbours.** ✔ — not applicable by
   construction; nothing tappable was added. The existing controls were not moved (the line sits
   after the last card, pushed to the bottom of the same scroll area).
3. **No meaning carried by colour alone.** ✔ — the meaning is the words themselves.
4. **Copy is pt-BR, sentence case, "você", `Intl` dates.** ✔ — *versão 2026-09-16 · 85f109b*,
   *versão de desenvolvimento*, *versão desconhecida*. The date is the build's own ISO stamp, not
   a rendered date, so `Intl` does not apply; it is a build identifier, not a date the owner reads
   as a date.
5. **Tab / Enter / Esc work, focus is visible, focus returns to the opener on close.** ✔ —
   unchanged: a `<p>` takes no focus and adds no tab stop. `Esc` still leaves the route.
6. **Icon-only controls have `aria-label`; inputs have visible labels; `lang` and `<title>` right.**
   ✔ — no control added; the screen's `<title>` is unchanged.
7. **Tokens only; durations from the bands; reduced motion honoured.** ✔ — `text-t1`,
   `text-muted`, `font-data`, measured in the pane as 12 px / `rgb(160,160,168)` / `ui-monospace`.
   No animation added.
8. **Destructive actions follow §8.** ✔ — not applicable; nothing destructive.
9. **No request to another origin.** ✔ — the value is a build-time constant; rendering it issues
   no request at all.

## Tier B — the items this change can carry

10. **Contrast measured and recorded.** ✔ — 7.24:1 against `--color-bg` (`#161012`), measured in
    the pane from the computed styles. AA needs 4.5:1 for this size; AAA needs 7:1.
11. **The §8 states the screen can reach were simulated and read.** ✔ (partial, stated rather than
    glossed) — the line has no loading, empty or error state of its own; its three cases are
    covered by `test/app-version.test.ts` instead. The offline banner above it was not re-simulated
    because this change does not touch it.
12. **Checked at 375 px and at 1280 px / the column cap.** ✔ — 375 × 812 and the pane's desktop
    width both checked: the line stays right-aligned in the corner, on one line, with no
    horizontal overflow. The phone's own safe areas and keyboard overlap were NOT checked — that
    needs the owner's device, and nothing here can overlap a keyboard (the screen has no input).
13. **`vite build` size report read against §11; Lighthouse when the screen is new.** ✔ (partial) —
    `npm run build` ran clean; the added payload is one short string plus a five-line pure
    function. Lighthouse not re-run: the screen is not new and the change cannot move a metric.
14. **Screenshots filed under `PRPs/reports/<activity>/` — or the reason none exists.** ✘ — no
    screenshot file is committed. The pane's captures were read in-session at both widths and the
    measurements above come from the live DOM; §12.6 permits a written reason in place of a file,
    and this is it.

**Result: 13 ✔, 1 ✘ (item 14, screenshots — the written reason above stands in for the file).**
Owed to the owner: the phone pass (item 12's device half), which is the same thing every other
unit records as his own step.
