# Conventions

> Derived from `documentation/40-engineering/engineering-conventions.md` (authoritative). Update both together.

## Language & naming

- Everything in English — code, comments, commits, identifiers (ADR-0001).
- Domain concepts use EXACTLY the canonical glossary names: **Task**, **Event**, **Reminder**, **Life Area** (`docs/domain/glossary.md`). If code needs a concept the glossary lacks, update the glossary first.
- Casing: `camelCase` variables/functions · `PascalCase` types and React components (and their `.tsx` files) · `kebab-case` other files · `snake_case` SQL tables/columns (mapped to camelCase by Drizzle).

## Code

- TypeScript everywhere, `strict: true`; `tsc --noEmit` is a mandatory gate in `npm run check`.
- Formatting: Prettier, default config. Linting: minimal ESLint flat config (typescript-eslint recommended only).
- Entity types originate in `src/worker/db/schema.ts` (Drizzle) and flow through `src/shared/` — never hand-duplicated.
- Domain logic (recurrence, dates, invariants) lives in pure functions in `src/shared/`, unit-tested.
- UI code: `src/app/components/ui/` holds the owned primitives (`Button`, `Chip`, `CompleteControl`, `Sheet`, `Banner`, `Skeleton`, `Toast`, `ConfirmView`); `src/app/components/` holds screens and their parts (e.g. `TodayScreen`, `TodayHeader`, `TaskRow`, `InlineTitle`, `CaptureDeck`, `EmptyState`, `TaskSheet`) — both PascalCase, one component per file, Tailwind classes over `src/app/tokens.css` only (no raw literals, no second scale), `cva` variants + `cn()`, Base UI data attributes; pt-BR string literals in components (ADR-0009) — copy two screens must say identically moves out of both components: to a small app-layer module (`src/app/<topic>-copy.ts`) when nothing selects among the strings, and to `src/shared/*` behind a tested function as soon as a reason or state picks between them (guidelines §12.3). Run the UI/UX guidelines checklist on every interface change (docs/context/ui-guidelines.md).
- Owner-facing pt-BR messages that need stable, test-pinned wording (e.g. request-classification or storage-failure messages) are literals inside the `src/shared` module that owns the logic — never hard-coded in a component — so the wording is pinned by that module's test (`src/shared/request-failure.ts`, `src/shared/token-store.ts`; ADR-0009).
- Fonts are self-hosted, committed WOFF2 files under `public/fonts/` (with their OFL licence texts beside them), fetched once by a zero-dependency script (`scripts/fetch-fonts.mjs`) and re-run only on a deliberate upgrade — never a CDN or runtime font dependency (ADR-0010).

## Dependencies

- npm, single package, no workspaces. ALL versions pinned exact (`save-exact`), lockfile committed, `npm ci` on return.
- Upgrades are deliberate changelog-in-hand events (~one weekend/year budget, ADR-0005). Never incidental.

## Git

- Conventional Commits in English (`feat:`, `fix:`, `docs:`, `chore:`), imperative mood.
- Single `main` + short-lived feature branches. Commits reference doc IDs when applicable (`feat: add task recurrence (FR-009)`).
- `.gitattributes` enforces LF in the repository.

## Error handling & logging

To be established at scaffold — record here once the first real patterns land.
