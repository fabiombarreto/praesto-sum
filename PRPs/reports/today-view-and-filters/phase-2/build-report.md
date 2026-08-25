# Phase 2 build report — grouping and the grouped list

Date: 2026-08-24 · Plan: `PRPs/plans/completed/today-view-and-filters-phase-2-grouping-and-the-grouped-list.plan.md` · PRD: `PRPs/prds/today-view-and-filters.prd.md` AC-8, AC-9, AC-10, AC-17.

This is the browser-pane pass the plan's `## Notes` promised, run against the real
app on `npm run dev` with real rows in the local D1. It is the step
`/relay-execute` has no place for — the reason the owner's original brief
excluded the orchestrator for the UI phases — inserted by hand between implement
and test.

## Where it ran, and why not in the embedded pane

**In the owner's own Chrome**, driven through the `claude-in-chrome` tools, not
in the embedded browser pane. The pane keeps its own per-origin storage, so it
sits at the token gate, and pasting an API token into a field is something this
assistant does not do under any framing. The owner had already unlocked the app
in his own Chrome, so the existing session was used rather than a credential
being handled. No token value was read, printed, or typed at any point.

**A screenshot exists — the first in this project's UI verification history.**
Every `ui-design-pass` phase recorded "no screenshot exists because the pane
never composited frames" (guidelines §12.6). Real Chrome composites, so two
captures were taken and are in the session transcript. They could not be written
to disk: the tool's `save_to_disk` call timed out against the renderer
(`Page.captureScreenshot` after 30 s). Recorded as what it is rather than filed
as a path that does not exist.

## Fixture

Eight rows seeded straight into the local D1 (`wrangler d1 execute --local`),
bypassing the API and therefore the token entirely — two overdue (one 9 days
late, one 2), two due today, one upcoming, two undated, one done. The first
attempt was rejected by `tasks_completed_at_chk`, which requires `completed_at`
on a `done` row: the database defending its own invariant, exactly as designed.

The upcoming row was deleted mid-pass, on purpose, to test AC-10.

## Tier A — every interface change

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ | The deck's *Adicionar* is the only primary; the group headers are navigation, not actions |
| 2 | Tappables ≥ 48 × 48 px, ≥ 8 px apart | ✔ | Smallest tap target height measured: **48 px**. Group headers 48 px; rows 80 px (project floor is 64) |
| 3 | No meaning by colour alone | ✔ | Overdue rows carry the **word** *atrasada* beside the colour; priority carries a glyph **and** the word *alta* |
| 4 | pt-BR, sentence case, infinitive buttons, `Intl` dates | ✔ | Header *Hoje · seg., 24/08 · 7 restantes*; groups *Atrasadas · Hoje · Próximas · Sem data · Concluídas*; meta *atrasada · venceu sáb., 15/08 · alta*, *até hoje* |
| 5 | Tab / Enter / Esc, focus visible, focus returns | ✔ (see note) | `:focus-visible` matched after a **real** Tab, resolving to `outline: solid 2px rgb(245,165,36)` + `box-shadow 0 0 0 4px #161012` |
| 6 | Icon-only controls have `aria-label`; `lang`, `<title>` | ✔ | `aria-label="Concluir Pagar o condomínio"`, `"Editar título de …"`; `lang="pt-BR"`; `<title>Hoje · Praesto Sum</title>`; one `<h1>` |
| 7 | Tokens only; durations from the bands | ✔ | Every measured colour is a token value (see contrast table); no literal introduced (plan Task 3 VALIDATE greps for it) |
| 8 | Destructive actions per §8 | ✔ (n/a) | This phase adds no destructive action; complete/reopen and delete are untouched |
| 9 | No request to another origin | ✔ | `performance.getEntriesByType('resource')` filtered to foreign origins: **`[]`** |

**Note on item 5.** A first reading looked like a defect: the focused element
reported `outline-style: none`. It is not. Base UI's Checkbox renders a hidden
1 × 1 `<input>` that takes focus, and that input carries its own `outline: none`;
the control the user sees and targets is the sibling
`<span role="checkbox" aria-label="Concluir …">` at 48 × 48. Focusing the
document body — which has no such override — showed the global rule resolving
correctly (`solid 2px #f5a524`, offset 2 px, plus the 4 px dark outer ring). The
same 1 × 1 inputs also produced a false positive in the "icon-only control
without a label" scan for the same reason. Both are pre-existing A5 structure,
not introduced here.

## Phase-specific DOM claims (AC-8, AC-9, AC-10)

Measured, not inferred. All values read from the live DOM.

| Claim | Result |
|---|---|
| Group order in DOM order | `["Atrasadas", "Hoje", "Próximas", "Sem data", "Concluídas"]` ✔ |
| Header height | 48 px on every group (≥ 40 px required) ✔ |
| Name + count on every header | ✔ — `Atrasadas 2`, `Hoje 2`, `Próximas 1`, `Sem data 2`, `Concluídas 1` |
| **Count survives the collapsed state** | ✔ — *Próximas* rendered `1` and *Sem data* rendered `2` while rendering **0** rows. This is §2.5's "my tasks vanished" trap, and it is the single most load-bearing detail of the component |
| *Hoje* has no collapse control | ✔ — `headerIsButton: false`, `aria-expanded: null`, and it is **absent from the tab order**. Structural, not a disabled control |
| Collapse defaults | ✔ — *Atrasadas* `aria-expanded="true"` with rows; *Próximas* and *Sem data* `"false"` with zero rows |
| Nothing focusable inside a collapsed group | ✔ — the rows leave the DOM rather than being hidden, so a keyboard user never tabs into invisible content |
| Collapse persists across a reload | ✔ — expanding *Próximas* wrote `praesto.today.collapsed.upcoming: "0"`; after a full reload it was still expanded while *Sem data* kept its collapsed default |
| Only the touched key is written | ✔ — `localStorage` held exactly one `praesto.*` key after one toggle. This is precisely why `readCollapsed` had to distinguish an absent key from a stored `"0"` |
| Empty group renders no header | ✔ — deleting the only upcoming row removed the entire *Próximas* `<section>` from the DOM (four sections remained), and the header count fell from 7 to 6 |
| Header count means every open Task | ✔ — `7 restantes` with 2 + 2 + 1 + 2 open; `6` after the deletion. Not narrowed to *Hoje* |
| Row anatomy unchanged | ✔ — `-webkit-line-clamp: 2` still on the title; rows 80 px; one trailing pencil, no chevron |
| Whole-list empty state | ✔ — with zero rows the region reads *Nada para hoje. / Bora capturar a primeira?* with the *Nova tarefa* CTA |

## Tier B — once per shipped screen

**10 · Contrast, measured (guidelines §4.3).** Computed from the live computed
styles, WCAG relative-luminance formula:

| Pair | Ratio | Target | |
|---|---|---|---|
| body text on row surface (`#f2f2f4` / `#2a211e`) | **14.07:1** | 4.5:1 | ✔ |
| muted text on row surface (`#a0a0a8` / `#2a211e`) | **6.06:1** | 4.5:1 | ✔ |
| accent on base surface (`#f5a524` / `#161012`) | **9.21:1** | 3:1 | ✔ |
| focus ring on row surface (`#f5a524` / `#2a211e`) | **7.71:1** | 3:1 | ✔ |
| overdue meta on row surface (`#ff5c1f` / `#2a211e`) | **5.10:1** | 4.5:1 | ✔ |
| on-accent text on the submit (`#1a1206` / `#f5a524`) | **9.08:1** | 4.5:1 | ✔ |

**11 · States simulated.** Empty list (whole-screen empty state), populated list
across all five buckets, a group collapsed, a group emptied to nothing, and a
reload. Offline and failed-request were **not** re-simulated: this phase changes
no request path — `listTasks()` is called exactly as before — and both were
covered by the A5 Tier B pass for this screen.

**12 · Widths.** The 1920 px case is real and clean: the column caps at 640 px
and centres; zero horizontal overflow. **The 375 px case is a forced-width
proxy, not a real viewport** — `resize_window` reported success but
`window.innerWidth` stayed 1920, the same class of failure the owner's brief
already recorded for the pane's `desktop` preset. With the shell forced to
375 px: **zero elements overflowed the column**, rows stayed 80 px, headers 48 px,
smallest tap target 48 px, and every group header still showed its name and
count. What this proxy cannot cover is viewport-dependent behaviour — `dvh`, the
keyboard inset, safe areas. Those remain for a device check.

**13 · Build against §11.** JS ~94.3 KB gzip (budget 170), CSS 5.98 KB gzip
(budget 30), precache 402.81 KiB (budget 1 MB). Read from `npm run build` during
the implement stage.

**14 · Screenshots.** Two captured, described above; not filed as files because
the save call timed out. Contents: (a) all five groups with *Próximas* and *Sem
data* collapsed showing their counts, and *Hoje* visibly the only group without a
chevron; (b) the same screen after the upcoming row was deleted, with *Próximas*
gone entirely and the header reading 6.

## Not verified here, and why

- **The phone.** No device pass was run. Safe areas, the keyboard inset, the back
  gesture and `overscroll-behavior` under a real touch scroll are device-only
  (Tier B item 12) and belong to the owner's own check before deploy.
- **A real 375 px viewport** — see item 12.
- **`localStorage` denial.** The guarded `try/catch` degradation is verified by
  source and by the code-reviewer, not at runtime: revoking storage on a live
  page after the module has loaded is not reachable with these tools. Stated
  rather than implied.
- **`prefers-reduced-motion`.** This phase adds no animation; the chevron's
  existing `transition-transform` is A5's and unchanged.

## Local data left behind

Seven seeded rows remain in the **local** D1 (`.wrangler/state/v3/d1`) so the
owner can look at the screen himself. They touch nothing remote. To clear them:

```bash
npx wrangler d1 execute praesto-db --local --command "DELETE FROM tasks WHERE id LIKE 'v-%';"
```

## Verdict

Every AC-8, AC-9 and AC-10 claim the plan routed to a manual check is confirmed
against the live DOM, with the two false positives investigated to their cause
rather than recorded as defects. Nothing in this pass asks for a code change.
