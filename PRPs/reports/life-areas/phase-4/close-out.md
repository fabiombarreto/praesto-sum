# Close-out — unit 13 `life-areas`, phase 4 (the filter and the close-out)

Recorded 2026-10-12 by the Implementer and revised the same day after the orchestrator's live
browser pass (attempt 2; `PRPs/reports/life-areas/phase-4/live-browser-pass.md`). This is PRD
AC-23's invariants inspection and the unit's per-AC status for the phase-4 criteria. The commands
below are the ones Level 2 of the phase plan runs; each was run in this worktree
(`C:/repos/assistente-pessoal/.worktrees/life-areas`, branch `feature/life-areas`) and its outcome
is quoted, not remembered. Attempt 2 re-ran all of them after its edit. **Attempt 3** changed
records and documentation only (no source, test, migration or dependency file) to make them agree
with the completed chip measurement and the second look; it re-ran Level 1 to 3 and the counts
quoted below are unchanged by it.

## Invariants inspection (PRD AC-23)

- **Base commit.** `git merge-base main HEAD` is `f06d56f608ecb4083fbf6ef9c59d9f2f4ef6eca9`
  (`main` and `HEAD` are the same commit: the whole unit, phases 1 to 4, is uncommitted work in this
  worktree, so every diff below is the unit's complete diff against `main`).
- **`src/shared/recurrence.ts` and `src/shared/adherence.ts`:**
  `git diff --quiet f06d56f -- src/shared/recurrence.ts src/shared/adherence.ts` exits 0 —
  byte-identical to `main`.
- **`migrations/`:** `git diff --name-only f06d56f -- migrations` is empty and
  `git ls-files --others --exclude-standard -- migrations` is empty — no file added or changed.
  The seven existing migrations (`0000` to `0006`) are the ones the drill replayed.
- **`package.json` and `package-lock.json`:** `git diff --quiet f06d56f -- package.json
  package-lock.json` exits 0 — byte-identical. Nothing was installed or upgraded; `npm run build`
  and `npm run check` do not rewrite either file.
- **Nothing under `.claude/`:** `git diff --name-only f06d56f -- .claude` is empty. (A
  pre-existing untracked `.claude/settings.json` dated 2026-10-11 sits in the worktree; it is not
  part of the diff and this phase did not write under `.claude/`.)
- **Tests:** `git diff --diff-filter=D --name-only f06d56f -- test` is empty (no test file
  deleted) and the added-line scan for `.skip(`, `.only(`, `.todo(`, `xit(` and `xdescribe(` finds
  nothing. Neither attempt of this phase authored or edited a test file:
  `git diff --name-only 4d4735890fbf08c7469f25338601c4aedc90d00b -- test` (the phase-4 base tree)
  is empty, and the only test changes of the phase are the approved pair's
  (`test/task-filter.test.ts`, `test/life-area-assign.test.ts`).
- **`test/task-update.test.ts`'s old pinned 400 for `lifeAreaId`** was replaced by AC-9's
  behaviour in phase 1, not removed: the file's own comment records that the
  `["lifeAreaId", { lifeAreaId: "area-x" }]` row moved to the `lifeAreaId` describe block, and that
  what it asserted is preserved (an id that matches no area is still answered 400 and still writes
  nothing, now naming the field).
- **ADR files untouched:** `git diff --quiet f06d56f -- documentation/60-decisions` exits 0 —
  ADR-0015 included.
- **`Chip.tsx`:** byte-identical to the phase-4 base tree (`git diff --quiet
  4d4735890fbf08c7469f25338601c4aedc90d00b -- src/app/components/ui/Chip.tsx` exits 0), consistent with the recorded
  `Decision: keep Chip as is`; the Level 2 guard (no `max-w-full` in `Chip.tsx` without a recorded
  `Decision: change Chip`) and the two `ChipGroup` class-string literals pass.
- **Seam and filter wiring:** `captureAreaFields(filter.lifeAreaId)` is in `TodayScreen.tsx` and
  `const activeAreaFilter` is gone; `refreshRef.current` is in the foreground effect;
  `useState<TaskFilter>(EMPTY_FILTER)` is intact; no `localStorage`, `sessionStorage` or
  `indexedDB` in `task-filter.ts`, `FilterSheet.tsx` or `FilterChips.tsx`; `SearchScreen.tsx` does
  not mention `FilterSheet` or `FilterChips` and keeps `{ ...EMPTY_FILTER, q }`; `FilterSheet.tsx`
  contains neither `areaChoiceValue` nor `lifeAreaIdFromChoice`; `FilterChips.tsx` carries no
  *Limpar filtros* outside comments; no `categoria` in the four files edited for copy.
- **`npm run check` exits 0:** `wrangler types --check` up to date, `tsc -b`, `eslint .` and
  `prettier --check .` all clean (re-run after attempt 2).
- **`npm test` exits 0:** 1719 tests in 89 files, 0 failed (the floor is the 1693 tests in 89 files
  the phase-3 checklist recorded; the suite grew by 26 cases and no test file was deleted; the same
  count after attempt 2, which changes markup only).
- **`npm run build` exits 0:** `check-dev-token-absent` passed; sizes are in the checklist's item 13
  (CSS 26.67 kB / 6.33 kB gzip with the two utilities `max-w-40` and `truncate`; JS 379.37 kB /
  114.35 kB gzip; precache 25 entries, 494.99 KiB).

## Per-AC status (the criteria of this phase's row)

| AC | Status | Evidence |
|---|---|---|
| AC-13 filter dimension | **green** | `test/task-filter.test.ts` (the dimension in `EMPTY_FILTER`, `toQuery`'s parameter and its last position, `activeCount`'s count, `toggleChip` carrying it) passes in the 1719-test run |
| AC-14 observable half | wired; **area-filter capture observed in the pane**, the other two bodies not recorded by either pass | `captureAreaFields(filter.lifeAreaId)`; pure half pinned in phase 3; the pass observed `POST /api/tasks {"title":"…","lifeAreaId":"<Casa id>"}` and the Task appearing with the area's name (`live-browser-pass.md`, "AC-14 observable half" in `ui-checklist.md`). The *Sem área* and no-filter bodies were not recorded by either pass |
| AC-18 restore drill | **synthetic fixture PASS, real snapshot OWED** | `PRPs/reports/life-areas/c6-restore-drill.md`, `PRPs/reports/life-areas/c6-drill-output.txt` (exit 0, `restore-drill: PASS`). AC-18 as the PRD words it — a production snapshot — is NOT met |
| AC-21 filter sheet | **recorded; pane observations in, device items owed** | `ui-checklist.md` "AC-21 walk": the decidable half of every clause is pinned; the pane observed the group's 13 chips, the badge, the leading chip, the foreground refetch carrying the filter and the deleted-area empty state with *Limpar filtros*; not recorded by either pass: the group under zero areas and under a failed request in the filter sheet (the Task sheet's was), the pick's own request. The cold start is owed to the owner's device |
| AC-23 invariants | **this record** | the section above; `npm run check` and `npm test` exit 0; the UI/UX checklist in `ui-checklist.md` has no ✘ (item 12's exception was retired by measurement) |
| AC-24 device proof | **OWED** | `PRPs/reports/life-areas/device-proof.md`, `Status: OWED`; unit 13 is not deployed |
| AC-25 documentation synced | **synced; last clause NOT met** | FR-008, the glossary and `domain-model.md` (as proposed, awaiting the owner), `ui-layout-standard.md` §2.3 / §2.6 / §6 with a History row, the roadmap, and the derived `docs/` files and `CLAUDE.md` agree; `docs/api-reference.md` already documented `/api/life-areas` and `lifeAreaId` (no edit needed). AC-25's final clause — "the roadmap row records `shipped` or `dropped`" — waits for AC-24: the row records `in-progress` |

AC-24: OWED

## What the live pass changed, and what it left open

- **Two findings, both fixed at the call site in `FilterChips.tsx` in attempt 2** (neither needed a
  test: glue and a CSS cap, no decidable logic):
  1. *Focus lost after clearing the applied chip* — focus now moves to the first quick chip before
     the area is cleared. **Re-observed fixed in the second look** (keyboard and pointer: focus on
     *Abertas*, no stray ring after a tap).
  2. *A long applied name pushed the quick chips off-screen at 375 px* — the label is capped at
     10 rem with an ellipsis; the full name stays as the chip's DOM text (its accessible name),
     as `title`, and whole in the filter sheet. **Re-measured in the second look:** the chip is
     206 px and 48 px high; *Abertas* is fully on screen, *Para hoje* straddles the edge.
- **Chip overflow:** measured, not pending — `Decision: keep Chip as is`
  (`PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md`, measured by the orchestrator in
  the browser pane); `Chip.tsx` unchanged. The 40-character chip is never clipped and nothing
  scrolls; at exactly that length the pressed chip leaves the sheet's 16 px gutter by 10 to 14 px,
  a limit case the record leaves to the owner, whose own device has not rendered it. The filter
  sheet's 15 px region overflow (390 against 375) is the *Período* "Até" date input's, predates this
  unit and is left for whoever next touches that sheet.

## Open items the phase leaves, with their owners

- **Still to look at in the pane** (recorded by neither pass): the zero-areas and failed-request
  cases of the filter sheet's own group, the *Sem área* and no-filter capture bodies, one `GET` per
  pick, Tab traversal, offline, and the rest of checklist item 6's rendered DOM attributes
  (`aria-pressed` on the applied chip and the group's `aria-label`; the second look did read the
  capped label's full text and its `title`).
- **Device items** (10, the phone half of 12, 14, Lighthouse, the cold start, the back gesture): the
  owner's device.
- **Awaiting the owner:** the pt-BR copy (the neutral *Área* of the applied chip included), the
  glossary and domain-model wording, whether he wants a *Limpar filtros* chip back in the quick row,
  the 12-area limit, and whether the 10 to 14 px gutter breach of a 40-character name at 375 px is
  acceptable or the limit should come down (all in `device-proof.md`).

## Not claimed

Nothing in this phase's records says, and nothing should be read as saying:

- that the restore drill ran on a **production** snapshot — it ran on a synthetic fixture built
  through the real routes of a local worker, and PRD AC-18 is not met;
- that the **device proof** was performed — `device-proof.md` is an OWED skeleton and records no
  observation;
- that the owner has used the filter for **a week**, or on any day — the exit signal is unobserved;
- that unit 13 is **`shipped`** — the roadmap row, `CLAUDE.md` and the docs all say `in-progress`;
- that anything was observed **on the owner's phone** — the live pass was a Chromium pane emulating
  375 and 1280 px against a local worker; contrast on a real panel, safe areas, keyboard overlap,
  the Android back gesture, Lighthouse and screenshots are owed, and no screenshot exists;
- that the **two fixes of attempt 2 were seen working on a phone** — the orchestrator saw both in the
  pane's 375 px emulation (`live-browser-pass.md`, "Second look"); nobody has seen them on the device;
- that a **40-character name looks right on the owner's device** — the measurement is the pane's
  emulation, and the 10 to 14 px gutter breach at that length is a limit case left to him;
- that every state was exercised in the pane — the items the pass did not record are listed in
  `ui-checklist.md` and above, and are pending, not ✔.
