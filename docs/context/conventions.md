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
- UI code: components under `src/app/components/ui/` (PascalCase, one per file), Tailwind classes over `src/app/tokens.css` only (no raw literals, no second scale), `cva` variants + `cn()`, Base UI data attributes; pt-BR string literals in components (ADR-0009). Run the UI/UX guidelines checklist on every interface change (docs/context/ui-guidelines.md).

## Dependencies

- npm, single package, no workspaces. ALL versions pinned exact (`save-exact`), lockfile committed, `npm ci` on return.
- Upgrades are deliberate changelog-in-hand events (~one weekend/year budget, ADR-0005). Never incidental.

## Git

- Conventional Commits in English (`feat:`, `fix:`, `docs:`, `chore:`), imperative mood.
- Single `main` + short-lived feature branches. Commits reference doc IDs when applicable (`feat: add task recurrence (FR-009)`).
- `.gitattributes` enforces LF in the repository.

## Error handling & logging

To be established at scaffold — record here once the first real patterns land.
