---
status: active
last_updated: 2026-08-20
review_trigger: "a screen is added that the anatomy does not fit, a navigation destination of equal weight appears, or a platform behaviour a rule relies on changes"
---

# UI Layout Standard

> **Purpose:** The skeleton every Praesto screen shares — navigation model, screen anatomy, the anchor screens, state placements and desktop adaptation — so units build *on* a standard instead of inventing one per screen.
> **Update when:** A new screen does not fit the anatomy (fix the standard or record the exception here), a third destination of equal daily weight appears (the navigation rule flips), or a platform behaviour a rule relies on changes. Record each change in the [UI/UX plan](../50-planning/ui-ux-plan.md) History while the plan is open.

Derived from UI/UX-plan activity A3 (research evidence: `PRPs/reports/layout-standard/01-research-evidence.md`; sketches: `PRPs/reports/layout-standard/sketches.html`). It implements the [guidelines](ui-ux-guidelines.md) (§2, §3, §8, §12) and the [identity](../10-product/visual-identity.md) (ADR-0010); values come from `src/app/tokens.css`. Active since 2026-08-20, when the owner chose the navigation model from the sketches.

## 1. Navigation model

**Decided (owner, 2026-08-20, from the sketches): model B — single screen + sheets.** Recorded here with the rejected alternative so the choice is not re-litigated:

- **(B) single screen + sheets — chosen.** *Hoje* is the only destination; *Pesquisar* (unit 8) and *Configurações* are icon buttons in the header; detail and filters open as native `<dialog>` sheets; there is no bottom bar. Evidence: Material 3 says not to use a navigation bar for fewer than three destinations and that settings are not a top-level destination; the single-user apps the owner admires (Things, Reminders, Google Tasks, Microsoft To Do) run without a bar; a bar would stack ~64 px of chrome under the 56 px capture field. Cost: whatever is not on *Hoje* is one tap behind an icon.
- **(A) bottom bar of three** (*Hoje · Pesquisar · Configurações*) above the deck — rejected for now: two bottom planes competing in the thumb zone, unequal destinations today, and the bar would have to hide while the capture field has focus.

**Flip rule (binding either way):** the moment Praesto has **three destinations of equal daily weight** (plausibly *Hoje · Agenda · Áreas* after units 4 and 13), the bottom bar enters on compact widths and the rail from 600 dp — never before, and never padded with unequal items. Tabs are not a bridge: *Hoje*'s groups are sections of one list, not peers.

## 2. Screen anatomy — phone (compact, < 600 dp)

Top to bottom, every screen that lists Tasks:

1. **Header (flat, never elevated):** page title as the `<h1>` (*Hoje*), the date in mono beside it (`qua., 20/08`), a remaining count as text (*4 restantes* — never a ratio or a progress bar: progress shown before the effort increases drop-off; the honest mirror lives in the group counts), and on the right up to three 48 px icon buttons: filters (with a numeric badge when any filter is active), then — in model B — search and settings. No wordmark in the header (it lives on the splash, the settings screen and the desktop rail).
2. **Offline / unreachable banner** (when applicable): directly under the header, one line, icon + action language, persistent while the condition holds, not dismissible (§8).
3. **Quick-filter chip row:** one horizontally scrolling row of 3–5 toggles (*Abertas*, *Alta prioridade*, *Com hora*) plus a trailing *Filtros…* chip that opens the filter sheet; applied filters stay visible as selected chips with a *Limpar filtros* chip; chips are 48 px hit areas with 8 px gaps. Default state: nothing selected; a narrowing filter never survives a cold start silently.
4. **Agenda stack (unit 4 hook):** today's Google events as **one** group at the top of the list, collapsed to the next event + count (*Agenda · 2*), expanding to rows with **no checkbox**, a leading time column, a calendar glyph and a dashed outline treatment — never interleaved with Tasks, never in the accent colour; tap opens Google Calendar (read-only).
5. **Groups, in this order,** each with a 40 px header carrying name + count (counts stay visible when collapsed — the "my tasks vanished" trap): **Atrasadas** first (collapsible; header action *Reagendar para hoje*; rows also show the overdue date inline in the live/overdue colour, so lateness is visible away from the header) → **Hoje** (never collapsible; sorted by time, then priority) → **Próximas** (collapsed by default) → **Sem data** (collapsed by default — no major app shows undated items on Today; here it is a deliberate "pick something" drawer). Collapse state persists per group.
6. **Row anatomy:** 64 px minimum (the project constant), leading 48 px completion control (every task app leads with it), title on one line with ellipsis, a second metadata line in mono (*até 18:00* · *venceu seg., 18/08* in the overdue colour · priority glyph + word · area dot later), at most **one** trailing element, never a chevron. Tapping the row opens the detail; swipe actions, if ever added, are shortcuts to visible controls (guidelines §12.4), never the only way.
7. **Empty state:** inside the list region, centred between header and deck: *Nada para hoje.* + one cue pointing at the deck (*Escreva abaixo para capturar a primeira.*); no duplicate button. Filter-induced empties read *Nenhuma tarefa com esse filtro.* + *Limpar filtros*. Per-group empties collapse to one line or are omitted.
8. **Toast:** above the deck, one at a time (§8); rendered inside an open `<dialog>` subtree with `popover="manual"` when a sheet is open, or it is inert.
9. **Capture deck:** bottom-anchored, the one elevated plane; eyebrow *Nova tarefa* in mono, 56 px field with the icon-only 48 px submit (*Adicionar*); `autofocus` here and only here when the app opens on *Hoje* (guidelines §12.5); disabled with an inline hint while offline.
10. **No bottom bar** (model B). If the flip rule of §1 ever fires, the bar sits below the deck and hides (`translate` + `inert`) while the capture field has focus.

## 3. Surfaces: detail, filters, dialogs

- **Detail and filters are native `<dialog>` sheets** (`showModal()`): bottom-docked on compact (rounded top corners, a 32 × 4 px handle, `max-height: 90dvh`, internal scroll with `overscroll-behavior: contain`), centred at max 560 px from 600 dp. Android back and `Esc` close them (Chrome ≥ 126 close requests); focus returns to the opener natively; `html:has(dialog[open]) { overflow: hidden }` locks the page. **Never stack sheets.** Light dismiss (`closedby="any"`) only on the filter sheet — never on an editor with unsaved changes; the detail keeps its draft in memory on close (§8).
- **Detail content order:** title (editable), date as three chips (*Sem data · Concluir até · Fazer em*) + date input, priority chips (*Alta · Normal · Baixa*), description, then *Cancelar* / *Salvar*; *Excluir* is a secondary button that opens the irreversible confirmation (§8). Long flows (settings, diagnostics, export) are **routes** with real history entries, not sheets.
- **Notification priming** (unit 7): a `<dialog>` sheet at the moment the first Reminder is saved or push is toggled in settings — never on launch; the real prompt fires inside the tap handler.

## 4. Keyboard (Android) — decided

`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">`. The layout viewport shrinks like Android's `adjustResize`, so the deck rides above the keyboard with no script (Chrome 108+; the startup-height bug is fixed in Chrome 139). Required hygiene: the shell is a `100dvh` grid (header / scrolling list / deck) with `overflow: clip`; the list is its own scroll container; no height-based media queries; drop `safe-area-inset-bottom` from the deck while a field has focus (`:root:has(input:focus-visible, textarea:focus-visible)`), because the inset does not update under the keyboard. Accepted trade-off: the relayout snaps rather than slides. Rejected: `VisualViewport` repositioning (script on every event, glitchy during the keyboard animation) and the VirtualKeyboard API (Chromium-only, documented geometry bugs in 2026). This resolves guidelines §2.6.

## 5. Desktop and Windows

- **600–839 dp:** one pane, the list column capped at ~640 px and centred; detail as a side sheet from the right; the deck stays bottom-anchored inside the column; search and settings stay as header icons (no rail until the flip rule fires).
- **≥ 840 dp (a half-snapped 1920 px window lands here):** list + detail. Left: a **fixed 420 px list pane** (a small wordmark sits before the page title in its header; no rail) with the same header, chip row, agenda and groups, and the deck at its bottom. Right: a **flat** detail pane (no elevation — the deck stays the single elevated plane) with an empty placeholder when nothing is selected; `Esc` clears the selection; shrinking below 840 keeps the detail and hides the list, back returns to the list.
- **Keyboard:** rows are one tab stop with roving focus — `↑/↓` or `J/K` move, `Home/End` jump, `Enter` opens, `E` completes, `T` opens the date, `1–3` set priority, `N` focuses capture, `/` focuses search, `Esc` closes; shortcuts appear in tooltips and a help sheet and never override OS shortcuts (guidelines §2.7). Windows below 640 px are treated as compact.
- Window Controls Overlay is optional polish, deferred until the layout is stable.

## 6. What the upcoming units plug into

| Unit | Where it lives |
|---|---|
| 3 today-view-and-filters | This anatomy as is: groups, chip row, filter sheet |
| 4 google-calendar-read | The agenda stack (step 4); calendar picker and disconnect in settings |
| 5 data-export | A settings route with one action; result as a toast |
| 6 push-channel-proven | A settings route (*Notificações*) with the toggle, priming sheet and a diagnostics sub-page |
| 7 reminders | Reminder fields inside the detail sheet; standalone Reminders as rows with a bell glyph in *Hoje*; the live toast when one fires |
| 8 text-search | The header search icon opens a search route with the field at the top |
| 9–12 recurrence, misses, adherence, nudge | Series glyph in the row metadata; adherence as a settings-level route, surfaced on *Hoje* only by counts and plain text |
| 13 life-areas | Area dot in the row metadata and an area filter chip; if areas become a daily destination, the flip rule of §1 applies |

## History

| Date | What changed |
|---|---|
| 2026-08-20 | **Owner chose model B (single screen + sheets) → `active`.** Model A kept in §1 as the rejected alternative with the flip rule |
| 2026-08-20 | Written as draft from the A3 research (three lenses, verified) and the sketches; Q4 pending the owner's choice; keyboard decision taken |
