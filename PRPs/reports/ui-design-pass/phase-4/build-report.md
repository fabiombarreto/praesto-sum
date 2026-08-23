# Build report — ui-design-pass phase 4 (Device verification pass)

Source plan: `PRPs/plans/ui-design-pass-phase-4-device-verification-pass.plan.md`
(Task 5 — gates + budget probe; plan AC-A6, AC-A7, PRD AC-22).

## Gates (Task 5 / Validation Level 1–2)

All three green, no test weakened or skipped:

- `npm run check` (`wrangler types --check && tsc -b && eslint . && prettier --check .`) — **PASS**
- `npm test` (`vitest run`, both the `worker` and `docs` projects) — **PASS**, 14 test files / 313 tests — **unchanged from phase 3**, exactly as `PRPs/reports/ui-design-pass/phase-4/test-suite.diff`'s `EXISTING_COVERAGE_SUFFICIENT` verdict predicted: this phase adds no decidable logic (four ARIA/labelling fixes, three records), so the corpus stays at its phase-3 shape with zero files touched under `test/`.
- `npm run build` (`tsc -b && vite build`, then the PWA service-worker inject pass) — **PASS**

## `vite build` size table

```
dist/praesto/.dev.vars              0.15 kB
dist/praesto/.vite/manifest.json    0.15 kB │ gzip:  0.11 kB
dist/praesto/wrangler.json          1.53 kB │ gzip:  0.79 kB
dist/praesto/index.js             216.97 kB │ gzip: 50.75 kB

dist/client/.assetsignore                                 0.02 kB
dist/client/index.html                                    3.96 kB │ gzip:  1.46 kB
dist/client/assets/index-GY9pM1LF.css                    39.43 kB │ gzip:  7.84 kB
dist/client/assets/workbox-window.prod.es5-Bd17z0YL.js    5.65 kB │ gzip:  2.20 kB
dist/client/assets/index-d6dSAhoY.js                    285.53 kB │ gzip: 91.74 kB

dist/client/sw.mjs  17.37 kB │ gzip: 5.86 kB

PWA v1.3.0
mode      injectManifest
format:   es
precache  25 entries (415.81 KiB)
files generated
  dist/client/sw.js
```

Baseline before this phase (phase 3's report, build of the same branch on
2026-08-22): **JS 92,902 B gzip · CSS 7,756 B gzip** (precache 25 entries /
415.24 KiB). After this phase's four ARIA/labelling fixes — a removed
attribute on `Toast.tsx`, a renamed `aria-label` on `TaskSheet.tsx`, one added
`role` on `CaptureDeck.tsx`, and a new `aria-describedby` + visually-hidden
`<span className="sr-only">` on `InlineTitle.tsx` (no new CSS file, no new
token — `sr-only` is a built-in Tailwind v4 utility, confirmed compiled into
`node_modules/tailwindcss/dist/lib.js`/`lib.mjs` before it was used) — the
precise gzip probe (below) reads **JS 92,955 B gzip (+53 B, +0.06%)** and
**CSS 7,802 B gzip (+46 B, +0.6%)**. Both deltas are consistent with four
small, additive markup/attribute changes and nothing structural; the `/design`
route stays tree-shaken out of this bundle entirely (verified below); the PWA
precache grows from 25 entries / 415.24 KiB to 25 entries / 415.81 KiB (same
25 precached assets, larger only because the JS/CSS bundles themselves grew) —
still far inside the guidelines §11 ≤ 1 MB precache ceiling.

## §11 budget probe (Task 5 / Validation Level 3)

```
JS 92955 B gzip (budget 174080) · CSS 7802 B gzip (budget 30720)
PASS: inside the §11 budget
```

Both figures are comfortably inside
`documentation/40-engineering/ui-ux-guidelines.md` §11: **JS at 53.4% of
budget** (92,955 / 174,080), **CSS at 25.4%** (7,802 / 30,720) — both
essentially unchanged from phase 3's 53% / 25%, as expected for a phase that
adds no new component, no new dependency and no new asset. Fonts and precache
totals track phase 1's figures (70,084 B fonts, unchanged — no font added
this phase).

## Structural gate (Level 3)

- No inline `style={}` prop, `CSSProperties` import or `const styles` object
  survives anywhere under `src/app/` outside `DesignPlayground.tsx`'s dynamic
  `var(--token)` swatches (PRD AC-2, unaffected by this phase's fixes) —
  confirmed by grep.
- `src/app/components/ui/Toast.tsx` carries no `aria-live` attribute anywhere
  in the file — `role={isError ? "alert" : "status"}` alone now carries the
  toast's politeness — confirmed by grep.
- `src/app/components/CaptureDeck.tsx` carries `role="status"` on the offline
  hint, byte-identical copy (`Captura indisponível sem conexão.`) and the
  pre-existing `role="alert"` on the request error two lines below —
  confirmed by grep.
- `src/app/components/TaskSheet.tsx` carries `aria-label="Data — dia"` on the
  native date input and `label="Data"` unchanged on the date-mode
  `ChipGroup` — zero remaining controls share the bare name `"Data"` —
  confirmed by grep (count = 0).
- `src/app/components/InlineTitle.tsx` carries `aria-describedby` pointing at
  a new `<span className="sr-only">Enter salva, Esc cancela.</span>`, and its
  pre-existing `aria-label={\`Editar título de ${task.title}\`}` is untouched
  — confirmed by grep.
- `grep -rlF 'tokens e estados' dist/client` finds nothing — the `/design`
  playground is still absent from the production bundle after the
  dynamic-import + `import.meta.env.DEV` tree-shake.
- The three phase-4 records exist:
  `PRPs/reports/ui-design-pass/phase-4/level-a-walk.md`,
  `PRPs/reports/ui-design-pass/phase-4/build-report.md` (this file),
  `PRPs/reports/ui-design-pass/phase-4/owner-runbook.md`.
- No script under `scripts/` calls `wrangler deploy` — confirmed by grep; the
  deploy stays the owner's, per the PRD's own Phase Details and this plan's
  `## NOT Building`.

## Not part of this report

The browser-pane Tier B check (guidelines checklist items 10–14: contrast,
the §8 states simulated, **375 px and 1280 px** — the first time this feature
measures the wide width, keyboard/safe-area behaviour, screenshots or the
written reason none exist) is performed by the main session after this
Implementer run, per the plan's `## Notes` "Manual verification script" — not
part of the Implementer's contract (Levels 1–3 only). The device pass itself
(the Android phone, the Windows PC, the deploy, the owner's verdict) is the
owner's, recorded through `owner-runbook.md`.

*Generated by the Implementer agent, attempt 1, 2026-08-22.*

## Deploy to production — done 2026-08-22

The owner authorised the deploy in-session ("pode fazer o deploy") and the main
session ran it, following `documentation/40-engineering/dev-environment.md:70-77`:

| Step | Command | Result |
|---|---|---|
| 5 | `npm run check` + `npm test` | green — 14 files / 313 tests, gate clean |
| 6-7 | `npx wrangler d1 migrations list praesto-db --remote` | **"No migrations to apply!"** — this feature adds no migration, as the runbook predicted; `db:migrate:remote` was therefore a no-op and production's schema is untouched |
| 8 | `npm run deploy` | **Success.** 17 new or modified static assets uploaded (the two WOFF2 fonts, the five icons, the three brand SVGs, the favicon, the manifest, `index.html`, `sw.js`, and the new JS/CSS bundles); total upload 211.89 KiB / 49.32 KiB gzip; Worker startup 8 ms; `https://praesto.fabiobarreto.workers.dev`, `schedule: */5 * * * *`; **Version ID `decae1a2-75f9-46e9-a05a-77992243b222`** |

**Note on provenance:** the deployed build comes from the **uncommitted**
working tree of `feature/ui-design-pass` (the owner has not authorised a
commit yet, and Pillar 2 never commits). The branch content and the deployed
Version ID above are the same bytes; a later commit must not change them
without a redeploy.

### Post-deploy smoke test (`dev-environment.md:106-119`)

| Check | Result |
|---|---|
| Closed gate — `GET /api/health` with no token | ✔ `401 {"error":"Unauthorized"}` |
| SPA served — `GET /` | ✔ `200 text/html`, 3 967 B |
| PWA installable | ✔ `manifest.webmanifest` 946 B, `icon-192` 2 710 B, `icon-512` 7 527 B, `maskable-512` 5 204 B, `apple-touch-icon-180` 1 869 B, `favicon.svg` 728 B — all `200` |
| Fonts served from the same origin | ✔ `inter-latin-var.woff2` 48 256 B and `unbounded-latin-800.woff2` 21 828 B, both `200` — the measured sizes of phase 1, unchanged in production |
| Service worker | ✔ `/sw.js` `200`, 19 245 B |
| The A5 chrome, in the HTML production actually serves | ✔ `<meta name="color-scheme" content="dark">`, `<meta name="theme-color" content="#161012">` and `interactive-widget=resizes-content` all present |
| Manifest content | ✔ `name` *Praesto Sum*, `short_name` *Praesto*, `theme_color` and `background_color` `#161012`, shortcut *Nova tarefa* |
| Schema really applied | ✔ `life_areas`, `push_subscriptions`, `recurrence_series`, `reminders`, `tasks`, `d1_migrations` (plus `_cf_KV` and `sqlite_sequence`) |
| Open gate — `GET /api/health` with a token | **owed to the owner**: the token in `.dev.vars` is the local one and production answered `401` to it, as it should. The authenticated round trip (`POST /api/tasks` then `GET /api/tasks`) is the owner's, with the production token — it is step 3 of `owner-runbook.md` |

The last line of the smoke test has no `curl` equivalent by design — *install
the PWA and actually use it* — and that is exactly steps 4 and 5 of the
owner's runbook, now against the deployed build.

### Smoke test, second pass (2026-08-23, after the merge into `main`)

Re-run in full once the work was committed (`b28e15b`) and fast-forwarded onto
`main`, to prove that what is deployed is that commit and nothing else:

| Check | Result |
|---|---|
| **The live bundle is this commit** | ✔ rebuilding `main` produces `index-d6dSAhoY.js` and `index-GY9pM1LF.css`, and those are exactly the filenames `GET /` references in production — same content hashes, so the deployed bytes are `b28e15b` |
| The dev-only playground did not leak | ✔ `grep 'tokens e estados'` over the **served** JS bundle → 0 occurrences; `/design` returns the SPA shell (200) and mounts nothing, because the route is behind `import.meta.env.DEV` |
| Every API route is closed without a token | ✔ `/api/health`, `/api/tasks`, `/api/tasks?status=open` and `POST /api/tasks` all `401`; an unknown route (`/api/nope`) also answers `401 {"error":"Unauthorized"}` rather than `404`, because the bearer gate runs before routing and does not leak which routes exist |
| SPA fallback | ✔ `/share-target`, `/new-task` and an arbitrary path all return `200 text/html` — the manifest's shortcut and share target resolve |
| Service-worker precache | ✔ 25 entries, including both WOFF2 files and all five icons |
| Content types | ✔ `text/html`, `text/javascript`, `text/css`, `font/woff2`, `application/manifest+json` |
| No cross-origin reference | ✔ the served HTML contains no absolute URL to another host (guidelines §5.3) |
| Deployment identity | ✔ `wrangler deployments list` shows the newest deployment as Version `decae1a2-75f9-46e9-a05a-77992243b222`, created 2026-08-23T01:46:29Z by the owner's account, at 100 % |
| **Authenticated round trip** | **still owed to the owner.** The token in `.dev.vars` is the local one (`dev-…`, 15 chars) and production correctly answers `401` to it. `POST /api/tasks` → `GET /api/tasks` with the production secret is step 3 of `owner-runbook.md` — the main session neither holds that secret nor should |


### Owner-reported defect, fixed 2026-08-23 — the capture field's focus ring was misframed

The owner opened the deployed app and reported, with a screenshot, that the
text field's outline sits wrong when it takes focus. Reproduced in the pane and
measured; it was **two** defects in the phase-2 focus fix, both in the deck's
`<form>` box:

1. **The ring floated 2 px outside the box.** `outline-offset-2` put the amber
   contour 2 px beyond the border, leaving only 7 px between it and the submit
   button's own amber fill — two concentric amber rounded corners, which reads
   as a misaligned frame rather than a focus ring. Fixed with
   `outline-offset-0`, so the amber lands exactly on the box's own border
   (measured: `outlineOffset: 0`, ring flush with the border box).
2. **The field lost its recess exactly when focused.** The focus style set an
   arbitrary `box-shadow`, and `box-shadow` is a single property — so the
   focus halo *replaced* `shadow-field` (`--inset-field`) instead of adding to
   it. Measured before: `rgb(22,16,18) 0 0 0 4px` alone, no `inset`. Fixed by
   repeating the token in the focus value; measured after:
   `rgba(0,0,0,0.35) 0 2px 4px inset, rgb(22,16,18) 0 0 0 4px` — recess kept,
   dark outer halo kept, so guidelines §4.5's two-tone requirement still holds.

Blur restores the resting state exactly (`outline: none`, inset shadow present).
Gates green after the fix (313 tests, `npm run check` clean); JS 92,958 B and
CSS 7,881 B gzip, still 53 % / 26 % of the §11 budget.

**Why the pane never caught it:** every check in phases 2–4 asserted the ring's
*presence and colour* (`outline-style`, `outline-color`, the halo) — never its
*offset relative to a neighbouring control of the same colour*. A measurement
can only fail a question it asks. The owner's eye asked the better question;
the A6 retro should add "the ring is framed on the element that reads as the
field, and no same-coloured control sits within ~8 px of it" to the Tier A
focus item.

**Note on the other fields:** the token gate, the sheet's title/description and
the inline editor keep `outline-offset: 2px`, which is the conventional
standalone-field look the guidelines bless. Only the deck frames a *container*
with a control inside it, which is why only it needed offset 0.


## Browser-pane Tier B check — main session

Run on 2026-08-22 (23:55–00:10 UTC) by the main session against the running
`npm run dev` server (port 5173), following the plan's `## Notes` "Manual
verification script". This is the first run in the whole feature that measured
**1280 px**: the `desktop` preset had silently not applied in phases 1–3, and
an explicit `resize_window {width: 1280, height: 800}` does apply. The pane is
still not displayed (`visibilityState === "hidden"`, no frames composited), so
no screenshot exists and no CSS transition ever advances — every figure below
is a `getBoundingClientRect` / `getComputedStyle` read.

### The four fixes, re-read live

| Fix | Verified |
|---|---|
| Toast politeness (Task 1) | ✔ the five live regions on `/design` read `role="status"` ×4 and `role="alert"` ×1 (the request-error toast) and **none carries an `aria-live` attribute** — each role now supplies its own politeness, so the error announces assertively and the confirmations politely |
| The sheet's two date controls (Task 2) | ✔ the accessible names inside the open dialog are *Fechar*, *Data* (the chip group), *Data — dia* (the native date input) and *Prioridade* — no two controls share a name |
| The deck's offline hint (Task 3) | pinned by source and by the Level 3 grep (`role="status"` in `CaptureDeck.tsx`); **not renderable on the playground**, whose deck is mounted with `canWrite={true}`, so the live read is owed to the pane run with a token or to the phone |
| The inline editor's description (Task 4) | ✔ the editing row's input carries `aria-label="Editar título de …"` **and** `aria-describedby` pointing at a 1 × 1 `sr-only` span reading *Enter salva, Esc cancela.*; `sr-only` is Tailwind's own utility, so no CSS was added |

### 1280 × 800 — the wide layout, measured for the first time

| What | Measured |
|---|---|
| Horizontal overflow | none on either screen (`scrollWidth` 1265 with the scrollbar on `/design`, 1280 on `/`) |
| Token gate column | 560 × 800, centred (left 360 of a 1280 px layout width), `max-width: 560px`, `min-height: 100dvh`; the field and *Salvar* are 528 × 48 each |
| Playground / list column | 560 wide, centred (left 353 of 1265), `max-width: 560px`; a Task row inside it is 528 × 80 |
| **Detail sheet** | ✔ a **centred 560 × 720 card** — `left: 360`, `top: 40`, centred on both axes, `border-radius: 18px` (`rounded-card`, not the bottom-sheet's 24 px top corners), the drag handle `display: none`, `max-height: 720px` (90 dvh) — exactly the layout standard §3 rule "centred at max 560 px from 600 dp", here at Tailwind's `sm` breakpoint (640 px) |
| Inline styles rendered | 0 on `/` (PRD AC-2 holds at this width too) |

### 375 × 812 — unchanged from phase 3

Re-checked after the four fixes: the sheet is still a bottom-docked
375 × 731 panel with the handle visible and 24 px top corners, every control
still ≥ 48 px, the focus ring still lands on all 13 focusables inside the
sheet. Nothing in this phase touched geometry, copy, colour or motion, and the
build confirms it: CSS moved by +46 B gzip (7 756 → 7 802 B) purely from the
`sr-only` utility, JS by +53 B (92 902 → 92 955 B).

### Contrast

Not re-measured: this phase changed no colour, no surface and no token, and
the pairs of §4.3 are recorded per screen in the phase-1, phase-2 and phase-3
build reports (ink/bg 16.82:1, muted/bg 7.24:1, accent/surface-2 7.71:1, focus
ring 9.21:1, icon 14.07:1; the sheet's own pairs 15.65 / 6.74 / 9.08:1). The
`level-a-walk.md` cites those measurements rather than re-deriving them.

### Screenshots

**None — the Browser pane was not displayed** in any phase of this feature
(`computer{action:"screenshot"}` fails with "the page is not compositing
frames"). This is the fourth time the reason is recorded rather than a
screenshot filed, and it is the reason the owner's own phone screenshots are
what guidelines §12.6 item 14 will be satisfied by — his runbook asks for
them.

### What this run could not do

- Anything needing a stored API token: the *Hoje* shell at 1280 px (its
  `max-w-[640px]` cap is static-only for now), the deck's offline hint live,
  the save / delete round trips, the 401 reason.
- The completion and slide animations (no frames composited).
- Lighthouse (no tooling in the repo, by decision — guidelines §11 and
  `testing-strategy.md:37`); the owner's runbook covers it as optional.
- Every device check: they are the owner's, in `owner-runbook.md`.

### Verdict for this phase

Tier B: the wide width is finally measured and the sheet behaves as the
standard says at both widths; the four accessibility fixes are confirmed live
except the deck's offline hint, which is pinned statically and owed a live
read. No further change requested from the pane.
