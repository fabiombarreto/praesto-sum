# Docs Update — ui-design-pass

**PR:** N/A (pre-PR — see "Merged at")
**Merged at:** N/A — not merged. This run is the docs-sync sub-phase of `/relay-implement` Phase A.3.5 for **Phase 1** ("Chrome, fonts and foundation") of the `ui-design-pass` PRD, reading `PRPs/reports/ui-design-pass/phase-1/attempts/1/diff.implementer.patch` directly (`diff_source: patch`) rather than a merged PR.
**Source PRD:** PRPs/prds/ui-design-pass.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Grounding: `PRPs/prds/ui-design-pass.prd.md` (Phase 1 row + AC-1/AC-4–AC-7/AC-18–AC-20), `PRPs/plans/ui-design-pass-phase-1-chrome-fonts-and-foundation.plan.md`, and the implementer-only patch above. `documentation/10-product/visual-identity.md` was already updated earlier this session (per the dispatching agent's context notes) and is out of scope for this docs-updater run; `docs/` is derived from it and never contradicts it. After making the edits below, `npx vitest run --project docs` (`test/docs-consistency.test.ts`) was run and is green: 1 file, 62 tests passed — no cited path is broken, no derived doc calls a resolved decision open, and no `docs/KNOWLEDGE_BASE.md` frontmatter quote drifted.

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The Phase 1 patch makes four repository-layout facts concretely true that the "Repository layout" table did not yet reflect: `src/app/main.tsx` now imports `styles.css` and gates a dev-only `/design` route (a dynamic import of the new `src/app/components/DesignPlayground.tsx`, reached only under `import.meta.env.DEV`); `src/shared/format.ts` and `src/shared/connectivity.ts` are new DOM-free pure modules alongside the existing `dates.ts`; `public/` now also holds two self-hosted WOFF2 fonts and their OFL licence texts (`public/fonts/`); and `scripts/fetch-fonts.mjs` is a new zero-dependency script alongside the pre-existing `scripts/generate-icons.js`, which had no row in this table at all. Extended the `src/app/`, `src/shared/` and `public/` rows and added one new `scripts/` row — every existing cell's original wording is preserved verbatim; nothing was removed or reworded.

---

### `docs/context/conventions.md`

**Change type:** additive
**Rationale:** The patch translates the two existing owner-facing messages in `src/shared/request-failure.ts` and `src/shared/token-store.ts` from English to test-pinned pt-BR strings (PRD AC-4), establishing a convention this file did not yet record: an owner-facing pt-BR message that needs stable, testable wording lives as a literal inside the `src/shared` module that owns the logic — not hard-coded in a component — so a test can pin it (ADR-0009's carve-out extended to a second, non-component surface). The patch also ships the project's first self-hosted font assets (`public/fonts/*.woff2`, fetched once by the new zero-dependency `scripts/fetch-fonts.mjs`, ADR-0010), which is a dependency-discipline convention (no CDN/runtime font dependency) this file's existing "no incidental dependency" spirit did not yet name for fonts specifically. Added two new bullets to the end of the `## Code` section; every existing bullet is unchanged.

---

## Candidate Decisions (for operator review)

None. Every architectural/product decision touched by this patch — pt-BR
visible copy (ADR-0009), the token/colour/font system on `#161012`
(ADR-0010), the owned-component UI library and native-`<dialog>`-first
posture (ADR-0011) — is already an accepted, indexed entry in
`docs/decisions.md`. The implementation-level choices specific to this
phase (self-hosting the fonts from the Google Fonts CSS2 API with a
Chrome `User-Agent`, zero special-cased in `formatRemaining` instead of
`Intl.PluralRules`, UTC-noon day arithmetic, the `/design` dynamic-import
gate) are all stated explicitly and concretely in the source PRD's
Architecture Notes / Decisions Log and in the Phase 1 plan's own
Decisions Log — none of them needed to be inferred from the diff, so
none is a candidate for a new `docs/decisions.md` entry.

## Deferred Questions

None. Reconciling this patch against `docs/` produced no case meeting the
Interactivity Clause's bar for a docs decision "genuinely ambiguous" —
i.e. no point where the merged diff could plausibly be recorded in
`decisions.md` (or elsewhere) in two or more materially different ways
with the source PRD silent on which. Every fact recorded above is
concrete and directly traceable to one diff hunk. `non_interactive: true`
was in effect for this run; had a genuine ambiguity arisen, it would have
been recorded here instead of asked, per the ALWAYS-defer rule.

## Files Scanned — No Edit Required

Source files touched by the merged patch, and why no `docs/` edit followed:

- `documentation/10-product/visual-identity.md` — already updated earlier this session by the main session (microcopy rows + History row); `documentation/` is authoritative and out of this agent's write scope on every run, and doubly out of scope this run per the dispatching agent's explicit instruction.
- `index.html` — chrome-level changes (`color-scheme`, critical CSS, shell skeleton, font preloads/`@font-face`, `interactive-widget=resizes-content`, `theme-color #161012`) are all consequences of ADR-0010, already indexed in `docs/decisions.md`; no new architectural fact beyond what the `docs/context/architecture.md` edit above already captures (fonts, `styles.css` import).
- `public/favicon.svg` — background literal `#161012`; an already-governed exempt-literal-carrier under ADR-0010, not a new fact.
- `public/fonts/OFL-Inter.txt`, `public/fonts/OFL-Unbounded.txt` — licence texts; covered by the new `docs/context/conventions.md` fonts bullet and the `docs/context/architecture.md` `public/` row ("+ their OFL licence texts").
- `public/fonts/inter-latin-var.woff2`, `public/fonts/unbounded-latin-800.woff2` — the two binary font files; same coverage as above.
- `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon-180.png` — regenerated on `#161012`; covered by the new `scripts/` row's `generate-icons.js` mention in `docs/context/architecture.md`.
- `public/manifest.webmanifest` — colour + pt-BR shortcut text; both already governed by ADR-0009 and ADR-0010, already indexed in `docs/decisions.md`.
- `scripts/fetch-fonts.mjs` — covered by the new `scripts/` row in `docs/context/architecture.md` and the fonts bullet in `docs/context/conventions.md`.
- `scripts/generate-icons.js` — `BACKGROUND` constant change; covered by the same new `scripts/` row (the file itself was previously undocumented in this table).
- `src/app/components/DesignPlayground.tsx` — covered by the `src/app/` row edit in `docs/context/architecture.md`.
- `src/app/main.tsx` — `styles.css` import + `/design` gate; covered by the same `src/app/` row edit.
- `src/shared/connectivity.ts` — covered by the `src/shared/` row edit in `docs/context/architecture.md`.
- `src/shared/format.ts` — covered by the same `src/shared/` row edit.
- `src/shared/request-failure.ts` — pt-BR message translation; covered by the new pt-BR-messages bullet in `docs/context/conventions.md`.
- `src/shared/token-store.ts` — same coverage as above.
- `vite.config.ts` — `includeAssets` gains `fonts/*.woff2`; a precache-config detail implied by "self-hosted fonts, precached" and not independently documented anywhere in the derived tree today (no derived doc discusses `vite.config.ts` internals), so no new line was warranted for this alone.

`docs/` files read and found unaffected by this patch:

- `docs/decisions.md`, `docs/anti-patterns.md` — no new or contradicted decision/forbidden-pattern; every decision this patch applies (ADR-0009/0010/0011) is already an indexed entry, and no new ADR was created by this patch.
- `docs/context/methodology.md` — frontmatter (`tdd: true`, `docs_sync: true`, `figma_track: false`) unchanged by this patch; `figma_track: false` means the Step 3.5 component-map upgrade does not apply to this run.
- `docs/context/constraints.md`, `docs/context/testing.md`, `docs/context/ui-guidelines.md` — no constraint, test-tier, or guideline-pointer fact changed by this patch.
- `docs/domain/areas/tasks.md`, `docs/domain/glossary.md` — `taskMetaLine`'s phrasing (`atrasada · venceu <day>`, etc.) is presentation microcopy of already-settled domain facts (deadline vs. scheduled date, FR-005), not a new business rule; its home is `documentation/10-product/visual-identity.md` (already updated), not the domain area docs.
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file was added by this run (only two existing files were edited), so the file's own write-scope trigger ("update index entries when a new `docs/` file is added") does not fire; its quoted `tdd`/`docs_sync`/`figma_track` values still match `docs/context/methodology.md`'s frontmatter (verified by the green consistency run above).
- `docs/api-reference.md` — no API surface change in this patch.

---
*Generated: 2026-08-21*
*Approved: 2026-08-21*
*Status: APPROVED*
