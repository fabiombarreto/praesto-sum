# UI/UX review checklist — the *Não concluídas* group (unit 10, phase 3)

Run 2026-10-02 by the Implementer, **by reading the code and running the build and the
suite only**. No browser pane and no device were used: no screenshot was taken, and
nothing below claims a live pass. Items that need eyes on a rendered screen or the
owner's phone are marked `OWED to the owner`, not ✔.

Change under review: `TodayScreen` and `SearchScreen` each gain a *Não concluídas*
`TaskGroup` over the new `missed` bucket (collapsed by default, count in the header);
*Concluídas* now reads the `done` bucket. No new component, token, route or request.

## Tier A — every interface change

1. ✔ — method: code reading. The change adds one group of rows on a screen whose
   primary action is unchanged; no control, button or action is added.
2. ✔ — method: code reading, not measured in the DOM. The group header is the
   existing `TaskGroup` button (`min-h-12`, 48 px), unchanged; rows are the existing
   `TaskRow`. A measured 48 x 48 pass in a browser pane is OWED to the owner.
3. ✔ — method: code reading. The group carries its name and count as text; the missed
   row's *não concluída* meta line and disabled complete control already exist and are
   not changed.
4. ✔ — method: code reading. The only new visible string is *Não concluídas*: pt-BR,
   sentence case, the plural the *Filtros* status chip already writes, and the
   guidelines' term table maps missed to *não concluída*. Identifiers stay English.
5. ✔ — method: code reading, not exercised by keyboard. The header is a native
   `<button type="button" aria-expanded>`, so Tab/Enter/Space work by construction and
   focus stays on it after toggling (no remount: the group returns `null` only at count
   0). Visible focus ring and a real keyboard pass are OWED to the owner.
6. ✔ — method: code reading. The section carries `aria-label={name}`; no icon-only
   control is added (the chevron is `aria-hidden` inside a labelled button); `lang` and
   `<title>` are untouched.
7. ✔ — method: code reading. No raw colour, size or duration in the diff; the group
   reuses `TaskGroup`. No animation is added.
8. ✔ — method: code reading. No destructive action is added or changed; a `missed`
   row's complete control stays disabled (`TaskRow`), and there is no reopen path.
9. ✔ — method: code reading of the diff (no `fetch`, no new import). Not observed in
   DevTools Network.

## Tier B — a new group on already-shipped screens

10. ✔ — method: code reading. No new colour pair: the header uses the existing
    `text-ink` / `text-muted` classes of `TaskGroup`. Not re-measured.
11. ✔ — method: code reading. The empty state is "no group rendered" because
    `TaskGroup` returns `null` at count 0, so a screen with no missed Task is unchanged.
    On *Hoje*, with the *Não concluídas* status chip active every result sits in a
    collapsed group, but the count stays visible and one tap expands it (the plan's
    recorded risk). Simulated offline / throttled / failed-request states: not run.
12. OWED to the owner — 375 px and 1280 px layout, safe areas, keyboard overlap,
    overscroll and the back gesture were not checked: no browser pane and no device here.
    The group inherits the existing column and `TaskGroup` layout.
13. ✔ — method: `npx vite build`, 2026-10-02, read against §11:
    - First-load JavaScript: `index-DvFI-bB_.js` 355.92 kB, **108.70 kB gzip** (budget
      <= 170 KB gzip).
    - First-load CSS: `index-DSEljgxd.css` 26.35 kB, **6.25 kB gzip** (budget <= 30 KB gzip).
    - Precache: **25 entries, 471.78 KiB** (budget <= 1 MB).
    Lighthouse on the phone: OWED to the owner.
14. No screenshot was taken and none exists: no browser pane or device was available to
    the Implementer. Screenshots are OWED to the owner.

Result: no ✘. Items 12 and 14, the phone half of items 2 and 5, and the Lighthouse half
of 13 are OWED to the owner; the on-screen reading of AC-20 and the device proof of AC-21
are his as well.

## Documentation checks made in Task 5(d)

- `documentation/30-architecture/domain-model.md` — checked, no edit needed (lines 43 and
  98 already say `missed` is terminal and system-written when the next occurrence's date
  arrives, with a permanent record per skipped cycle; both are true).
- `documentation/30-architecture/architecture-overview.md` — checked, no edit needed
  (line 217 names only the recurrence model).
- `documentation/20-requirements/functional-requirements.md` — checked, no edit needed
  (FR-009, FR-011 and the traceability rows 116-117 state requirements, not where a
  missed Task is shown).
- Edited: `documentation/10-product/visual-identity.md`,
  `documentation/40-engineering/ui-layout-standard.md`,
  `documentation/50-planning/roadmap.md`, `docs/domain/areas/tasks.md`,
  `docs/context/architecture.md`, `CLAUDE.md`.
