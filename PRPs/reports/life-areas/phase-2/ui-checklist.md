# UI/UX review checklist — the *Áreas* route and its entry card (unit 13, phase 2)

Run 2026-10-12 by the Implementer, **by reading the code and running the check, the suite
and the build only**. No browser pane, no dev server and no device were used: no screenshot
was taken and nothing below claims a live pass. Items that need a rendered DOM are marked
`pending live check (orchestrator browser pass)`; items that need the owner's phone are marked
`owed to the owner's device`. No item is ✔ from imagination.

> **Addendum, 2026-10-12 (the body below is unchanged and is what phase 2 knew).** The orchestrator's
> browser-pane pass of phase 4 (`PRPs/reports/life-areas/phase-4/live-browser-pass.md`) then
> exercised this screen at 375 px: its 25 controls are none under 48 x 48, it has no horizontal
> overflow, `<title>` reads `Áreas · Praesto Sum`, the add form is replaced by the notice at 12
> areas, and `Esc` in the rename field closes the form without leaving the screen and returns focus
> to *Renomear*. The device items (the back gesture, safe areas, keyboard overlap) stay owed to the
> owner's phone, and the items that pass did not record stay unobserved.

Change under review: new `LifeAreasScreen` (`/settings/life-areas`: list, read-only *Sem área*
row, add form, rename in place, counted delete confirmation and every non-happy state), new
stateless `LifeAreasEntryCard` on *Configurações*, and the route wiring in `app-route.ts`,
`App.tsx` and `api.ts`. No new token, primitive, origin, endpoint, table or migration.

Where a ✔ rests on the pure modules, the method names the suite that pins it
(`test/life-areas-list.test.ts`, `test/life-areas-view.test.ts`, `test/app-route.test.ts`;
130 tests passing when run on their own on 2026-10-12).

## Tier A — every interface change

1. ✔ — method: static inspection. The one primary action is *Adicionar*; the row actions are
   icon buttons; *Tentar de novo*, *Cancelar* and the `ConfirmView` buttons are `secondary`.
   *Salvar* is `primary` inside an open rename form, and while a rename form is open
   *Adicionar* is demoted to `secondary` (`variant={rowMode?.kind === "rename" ? ...}`), so at
   most one `primary` button is on the screen at a time. `rowMode` never names a row that has
   left the list: the render that first sees the list without the row (a 404 refetch, or
   another device deleting the area) resets it, so a rename mode always has its form
   rendered and *Adicionar* is never left demoted with no *Salvar* on screen. The entry card
   adds one *Abrir* to *Configurações*, the same per-card convention `AdherenceEntryCard`
   follows. Live look: pending live check (orchestrator browser pass).
2. pending live check (orchestrator browser pass) — by construction: every button is the owned
   `Button` (`min-h-12`; `variant="icon"` is `size-12`), both inputs are `min-h-12`, and
   neighbours sit `gap-2` (8 px) apart (*Renomear* / *Excluir*, field / *Adicionar*,
   *Cancelar* / *Salvar*, the two `ConfirmView` buttons). Not measured in the DOM box model.
3. ✔ — method: static inspection. Every error is text in a `role="alert"` line; counts are
   words (`Nenhuma tarefa aberta`, `3 tarefas abertas`); the *Sem área* row is read-only by
   having no control, not by a colour; the offline state is the banner's text plus disabled
   controls. No state is colour-only.
4. ✔ — method: static inspection plus `test/life-areas-view.test.ts`. Visible strings are
   pt-BR and sentence case; buttons are infinitive (*Adicionar*, *Salvar*, *Cancelar*,
   *Excluir*, *Tentar de novo*, *Abrir*, *Voltar*); "você" in the limit notice; zero is
   special-cased (`Nenhuma tarefa aberta`, `Nenhuma tarefa ou série tem esta área.`); the
   delete repeats the verb (title `Excluir a área “<name>”?`, button *Excluir*); no
   `categoria`. The icon buttons' accessible name uses *Renomear*, a verb outside §9.1's
   canonical list; it is the plan's pinned label and is never shown as visible text.
5. pending live check (orchestrator browser pass) — by construction: native `<button>`s and two
   real `<form>`s, so Tab / Space work and `Enter` submits the add and the rename form;
   `Esc` in the rename field calls `preventDefault()` and cancels the edit only, and the
   screen's `window` listener returns early on `defaultPrevented`; focus returns to the row's
   *Renomear* / *Excluir* through an effect and to the `role="status"` notice after a delete.
   Focus ring is the global `:focus-visible` rule. None of it exercised with real key presses.
6. ✔ — method: static inspection. *Voltar* and both row buttons carry `aria-label`
   (`Renomear <name>`, `Excluir <name>`); the add field has a visible `<label htmlFor>`
   *Nova área* and the rename field *Nome da área*; one `<h1>` *Áreas*; `<title>` is
   `Áreas · Praesto Sum`; `lang` untouched. The `ConfirmView` title is its existing `<h3>`
   under the `<h1>`, as on *Configurações*.
7. ✔ — method: static inspection. Only token classes (`bg-surface-1`, `border-line`,
   `border-line-strong`, `text-ink`, `text-muted`, `text-overdue`, `rounded-card`,
   `rounded-control`, `shadow-field`, `text-t1`..`t4`, `font-text`, `font-data`); no inline
   `style`, literal colour or duration, and no animation added. The only arbitrary values are
   the shell grid and the `size-[22px]` back icon, copied verbatim from `AdherenceScreen`.
   Reduced motion: nothing new moves.
8. ✔ — method: static inspection. The only destructive action is irreversible, so it is one
   `ConfirmView`: the title repeats the verb, *Cancelar* takes default focus (the primitive
   focuses it programmatically), the destructive button is second, the body says it cannot be
   undone, and there is no *Sim* / *Não*. Nothing reversible exists on the screen.
9. ✔ — method: static inspection. Every request goes through the four new wrappers in
   `src/app/api.ts` to same-origin `/api/life-areas`; the screen file contains no `fetch(` and
   no URL, and its only `<img>` is the same-origin `/brand/mark-flat.svg` the siblings use.
   Not observed in DevTools Network (pending live check).

## Tier B — a new route

10. owed to the owner's device — contrast was not re-measured; no new colour pair is
    introduced (`text-muted` / `text-ink` / `text-overdue` on `bg-surface-1` and `bg-bg`
    already ship).
11. pending live check (orchestrator browser pass) — states to simulate: empty fixture (empty
    state with the add form beneath it), failed list request (inline `role="alert"` +
    *Tentar de novo*), failed write (text kept, message beside the action), offline (banner,
    every write control disabled, reads stay), slow load (skeleton), twelve areas (limit
    notice replaces the form), a 404 on delete and a 409 on add from a second tab. By
    construction each is wired: `load-failed` keeps a ready list; a write failure calls
    `lifeAreaWriteFailure`, keeps the draft and refetches when `staleList`; a failure that
    makes the row vanish resets the row's mode and moves its message to a `role="alert"` line
    at the top, which lasts until the owner starts another action (add, save, confirm, or
    opening a rename or delete), so it is neither lost with the row nor left on screen for good.
12. owed to the owner's device — safe areas, keyboard overlap on the add and rename fields,
    overscroll and the Android back gesture. The 375 px and 1280 px layout in the pane is also
    pending the orchestrator's browser pass (names wrap with `min-w-0 break-words`; rows live
    in the scroll region).
13. ✔ — method: `npm run build`, 2026-10-12, read against §11:
    - First-load JavaScript: `index-yHb-rirM.js` 375.54 kB, **113.18 kB gzip** (budget
      <= 170 KB gzip).
    - First-load CSS: `index-CsL4MAHQ.css` 26.56 kB, **6.30 kB gzip** (budget <= 30 KB gzip).
    - Precache: **25 entries, 491.13 KiB** (budget <= 1 MB).
    Lighthouse on the phone: owed to the owner's device.
14. owed to the owner's device — no screenshot was taken and none exists: no browser pane or
    device was available to the Implementer.

Result: no ✘. Pending (orchestrator browser pass): items 2, 5, 11 and the live half of 1, 9 and
12. Owed to the owner's device: 10, 12 (phone half), 14, Lighthouse, and the back gesture.

## AC-19 walk

One line per clause of PRD AC-19 (`PRPs/prds/life-areas.prd.md`, lines 175-180). "Decidable
half" means the pure module the clause depends on is pinned by a passing test; the rendered
half is never ✔ here.

- **Lists his areas alphabetically with their open counts** — decidable half ✔ (method:
  `reduceLifeAreasList` `loaded` pt-BR order, `formatOpenTaskCount` 0 / 1 / n, both suites
  pass). Rendered half: pending live check (orchestrator browser pass).
- **A read-only *Sem área* row with its count** — decidable half ✔ (method: `loaded` takes
  `noArea.openTaskCount`, `deleted` adds the area's open count, suite passes; the row is a plain
  `<div>` with no control, by static inspection). Rendered half: pending live check
  (orchestrator browser pass).
- **He can add one** — decidable half ✔ (method: `canCreateLifeArea`, `checkLifeAreaName`
  blank / too_long / duplicate, `created` zero counts and alphabetical position, suite passes).
  The form, field message and request: pending live check (orchestrator browser pass).
- **Rename one in place** — decidable half ✔ (method: `isLifeAreaRenameNoop`, own-name rename
  accepted, `renamed` keeps counts, suite passes). The labelled field, *Salvar* / *Cancelar*,
  `Enter` and `Esc`: pending live check (orchestrator browser pass).
- **Delete one; delete asks once, repeats the verb and says how many Tarefas and séries lose
  the area** — decidable half ✔ (method: `formatLifeAreaDeleteTitle` / `formatLifeAreaDeleteBody`
  / `formatLifeAreaDeletedNotice`, suite passes; `ConfirmView` call shape by static
  inspection). The confirmation as rendered and its default focus: pending live check
  (orchestrator browser pass).
- **Esc returns to *Configurações*** — by construction: `Esc` -> `back()` on the `window`
  listener, with the rename field's own `Esc` prevented. pending live check (orchestrator
  browser pass).
- **The back gesture returns to *Configurações*** — owed to the owner's device. Route
  round-trip is ✔ (method: `test/app-route.test.ts` passes); the gesture is a phone behaviour.
- **With no area the empty state invites the first one** — decidable half ✔ (method:
  `LIFE_AREAS_EMPTY_TITLE` / `LIFE_AREAS_EMPTY_BODY` pinned, suite passes). Rendered, with the
  add form directly beneath: pending live check (orchestrator browser pass).
- **A failed request is an inline persistent error with *Tentar de novo*** — decidable half ✔
  (method: `load-failed` keeps a ready list and carries the message, `lifeAreaWriteFailure`
  mapping, suite passes). Rendered: pending live check (orchestrator browser pass).
- **Every control is at least 48 px** — by construction (owned `Button` `min-h-12` /
  `size-12`, inputs `min-h-12`). Not measured: pending live check (orchestrator browser pass).
- **The copy is pt-BR** — ✔ (method: every string the owner reads is pinned in
  `test/life-areas-view.test.ts` or is a literal in the component or entry card, read by
  static inspection; `categoria` grep is clean).
