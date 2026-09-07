# Phase 3 — Task 9 verification record

**Date:** 2026-09-05
**Performed by:** the assistant, in the embedded browser pane, at the owner's request
**Server:** worktree `.worktrees/data-export/` on `http://127.0.0.1:5174` (branch `feature/data-export`, phases 1–3 uncommitted)
**Reached the settings screen via** chore C17's dev-only token seeding (`import.meta.env.DEV` + `__DEV_API_TOKEN__`), which removed the TokenGate step that had blocked every prior automated attempt — the same barrier that has kept chore C15 open since 2026-08-31.
**Data:** five Tasks created through the API for this run — four dated, one undated — carrying accented pt-BR titles, a comma, a semicolon and a backslash.

## Scope — what this record does and does not cover

Covered: the browser half, at 375 px and 1280 px, on the Windows PC — recorded below from the live
DOM — **and the Android physical-device pass, performed by the owner on 2026-09-05** against the
deployed build (version `9e173429`, `https://praesto.fabiobarreto.workers.dev`).

**The owner's report, verbatim and in full: "Fiz os testes no meu celular. Tudo ok."**

It is quoted rather than paraphrased because that is exactly how much detail exists. He was asked
to check five things — a file reaching the phone's storage with the dated name, safe-area insets,
the back gesture leaving `/settings`, focus visibility under a keyboard, and importing the `.ics`
into Google Calendar — and reported a clean pass without itemising them. This record therefore
says the device pass happened and returned no defects; it does not claim a per-item result the
owner did not give. Anyone auditing a specific condition on Android should re-ask rather than read
one into the summary.

That report also closes the one link the browser tier could not reach: **a file actually landing
on the filesystem.** The embedded pane's sandbox blocks downloads, so on the PC the anchor's
`click()` was intercepted rather than executed, verifying everything up to the write — the blob,
its size, its MIME type and the exact `download` filename — but not the write itself. The phone
performed the real download.

## The five named conditions

| # | Condition | Result | Evidence |
|---|---|---|---|
| 1 | Two download controls, pt-BR copy | **PASS** | Region *Exportar dados* holds `Baixar meus dados` and `Baixar agenda (.ics)` |
| 2 | JSON download carries the dated name | **PASS** | `URL.createObjectURL` received a 2140-byte `application/json` blob; the anchor's `download` attribute read **`praesto-2026-09-05.json`** — the dated name, not the `praesto-export.json` fallback |
| 3 | `.ics` downloads, distinct extension | **PASS** | 1403-byte `text/calendar` blob; `download` attribute `praesto-2026-09-05.ics` |
| 4 | Failure is a persistent inline error, not a toast | **PASS** | With `fetch` stubbed to reject: a `role="alert"` element reading *"Não foi possível baixar seus dados agora. Tente novamente."* — **still present 7 s later**, where the shared toast auto-dismisses at 4 s. The 7-second re-check is what distinguishes the two; a snapshot taken immediately would not have |
| 5 | Offline does not disable the download controls | **PASS** | With `navigator.onLine` false and an `offline` event dispatched: the offline banner appears (*"Sem conexão. Dá para ler, mas não para salvar por enquanto."*), **both download buttons stay enabled**, and — the control that makes this meaningful — **`Conectar` becomes disabled**. A write respects `canWrite`; a read ignores it. Had both stayed enabled the result would have been indistinguishable from the card simply never consulting connectivity |

**Object-URL discipline, verified at runtime rather than by reading:** each download called
`URL.revokeObjectURL` exactly once. The code review had confirmed the call exists on every static
path; this confirms it actually runs.

## Guidelines review checklist — Tier A

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ Two controls, both the unit's stated deliverable; the second was the owner's explicit decision, and `ui-layout-standard.md` §6 was amended to match rather than left contradicting the screen |
| 2 | Tap targets ≥ 48 × 48 px, ≥ 8 px apart | ✔ 311 × 48 px at 375 px, 576 × 48 px at 1280 px; 74 px apart |
| 3 | No meaning carried by colour alone | ✔ The failure state is a text sentence with `role="alert"`, not a colour change |
| 4 | pt-BR, sentence case, infinitive buttons, "você" | ✔ *Baixar meus dados* / *Baixar agenda (.ics)*; error and offline copy in pt-BR; `lang="pt-BR"` |
| 5 | Tab / Enter / Esc; focus visible; focus returns to opener | **NOT MEASURED** — `:focus-visible` only matches after a real key press on the page, so a programmatic query returns an empty outline and would be a false negative (guidelines §12.6 says exactly this). Owed to the device pass |
| 6 | Icon-only controls have `aria-label`; inputs labelled; `lang` and `<title>` right | ✔ Both controls carry visible text labels; the region has an accessible name (*Exportar dados*); `<title>` reads *Configurações · Praesto Sum* |
| 7 | Tokens only; durations from the bands; reduced motion honoured | ✔ Code review confirmed only existing tokens (`rounded-card`, `bg-surface-1`, `text-overdue`, `font-text`, `text-t2`); no raw literals; this change introduces no animation |
| 8 | Destructive actions follow §8 | ✔ N/A — nothing here is destructive; an export is a read |
| 9 | No request to another origin | ✔ Both requests go to the app's own origin (`/api/export`, `/api/export.ics`) |

**Contrast measured** (item 10, Tier B, done here because the DOM was reachable): button label
**9.08:1**, inline error text **5.67:1**. Both clear WCAG AA (4.5:1); the buttons also clear AAA.

**Viewports** (item 12's first half): checked at 375 px and 1280 px. No horizontal overflow at
either; `main` caps at 640 px on the wide viewport. **The phone half — safe areas, keyboard
overlap, back gesture — is not done.**

**Screenshots** (item 14): none. The embedded pane composites no frames while it is not displayed,
so no screenshot exists, and §12.6 is explicit that a written reason may stand in for one but is
never to be claimed as one. This paragraph is that reason. Every result above was read from the
live DOM or from instrumented runtime values, not from an image.

## Outstanding

Nothing blocking for this phase. Two notes carried forward rather than closed:

1. **Item 5 (focus/keyboard) and item 12's phone half were covered by the owner's summary pass,
   not measured.** The PC tier could not measure focus at all — `:focus-visible` only matches after
   a real key press, so a programmatic query returns a false negative — and safe areas and the back
   gesture exist only on the device. They are reported clean; they are not on the record as
   numbers. If either ever needs a figure, it needs another device pass.
2. Chore **C15** — the four owed measurements on the *Google connection* card, a separate open item
   from unit 4 — was run on 2026-09-05 once C17 removed the token gate that had blocked it since
   2026-08-31. Three of its four items closed; see
   [`c15-measurements.md`](../../google-calendar-read/phase-5/c15-measurements.md). Its two
   device-dependent remnants (the empty-calendar-list state, which needs a live Google connection,
   and the phone half of its own item 12) stay open there, not here.

*Status: COMPLETE — browser half measured, Android device pass reported clean by the owner*
