---
status: active
last_updated: 2026-08-23
review_trigger: "a convention proves useful or useless in practice, or the stack changes"
---

# Engineering Conventions

> **Purpose:** The code, git, repository and naming conventions that keep the codebase consistent once it exists.
> **Update when:** A convention proves useful or useless in practice, or the stack changes.

## Code conventions

Per [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md):

- **TypeScript everywhere** (app, worker, shared code, config), `strict: true` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. The gate is `tsc -b` (solution build) inside `npm run check` — with project references, a root `tsc --noEmit` checks nothing and exits 0.
- **Formatting:** Prettier, default config — no style debates.
- **Linting:** minimal ESLint flat config with the typescript-eslint recommended presets only. No plugin zoo.
- **Dependencies:** every version pinned exact (`save-exact`), lockfile committed. Upgrades are deliberate, changelog-in-hand events — never incidental.
- **Types flow from the schema:** entity types originate in `src/worker/db/schema.ts` (Drizzle). The wire contract in `src/shared/api.ts` cannot import it (that would bundle the ORM into the SPA), so `src/worker/dto.ts` is the single mapping point, written field by field — that is what turns schema drift into a compile error.
- **Domain enums are enforced twice:** as a TypeScript union in the schema *and* as a SQL `CHECK` constraint, so bad rows are impossible even outside the app.
- **Domain logic** (recurrence, dates, invariants) lives in pure functions in `src/shared/`, unit-tested with plain Vitest.
- **App/worker boundary:** per-target tsconfigs with project references — a violation of the boundary is a compile error, not a review comment.
- **UI code (ADR-0010/0011, guidelines §12):** two directories, one component per file, `PascalCase` — `src/app/components/ui/` holds the reusable primitives (`Button`, `Chip`, `CompleteControl`, `Sheet`, `ConfirmView`, `Toast`, `Banner`, `Skeleton`) and `src/app/components/` holds the screens and their parts (`TokenGate`, `TodayScreen`, `TodayHeader`, `TaskRow`, `InlineTitle`, `CaptureDeck`, `EmptyState`, `TaskSheet`, `DesignPlayground`). Styling is Tailwind classes over the tokens in `src/app/tokens.css` (mapped by `src/app/styles.css` — never a second scale or a raw literal); variants via `cva`, composition via `cn()`; Base UI data attributes are the state hooks; visible strings are pt-BR literals in the component (ADR-0009), no i18n layer. Every interface change runs the [UI/UX guidelines](ui-ux-guidelines.md) checklist.
- **No inline `style` objects.** A5 retired the last one; the only survivor is `DesignPlayground.tsx`, which binds `var(--token)` dynamically to render the token table itself. A `style={` anywhere else under `src/app/` fails the design pass's own structural gate — and reintroducing one reintroduces a second scale.
- **Decidable UI logic leaves the component.** Anything with a rule worth pinning — the request-failure wording, the header and row date phrases, the connectivity state machine, the toast rules, the sheet's draft/confirmation state — lives as a pure module in `src/shared/` and is authored test-first; the React glue that calls it is verified by hand ([methodology](../../docs/context/methodology.md), "Browser-API work"). A5 produced five such modules: `request-failure.ts`, `format.ts`, `connectivity.ts`, `toast.ts`, `task-sheet.ts`.
- **Sheets are native `<dialog>` elements** opened with `showModal()`, never a `div` with `role="dialog"`: the platform then gives back-gesture and `Esc` close requests, the top layer, the backdrop, page inertness and focus return for free ([layout standard §3](ui-layout-standard.md)). Mirror both the `close` and the `cancel` events into React state — a close request can close the dialog without firing `close`, which strands the component's own `open` flag (measured 2026-08-22).

## Git conventions

> Draft pending owner validation — in use since the first commit (2026-08-03).

- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) in English, e.g. `feat:`, `fix:`, `docs:`, `chore:`. Subject line in the imperative mood ("add reminder snooze", not "added" or "adds").
- **Branching:** a single `main` branch plus short-lived feature branches merged back promptly. No long-lived development branches — this is a solo project.
- **Traceability:** commits reference stable document IDs when applicable, e.g. `feat: add task recurrence (FR-012)` or `chore: pin runtime version per ADR-0003`. ID schemes are defined in the [documentation guidelines](../00-meta/documentation-guidelines.md).
- **Line endings:** `.gitattributes` enforces `* text=auto eol=lf` — LF in the repository regardless of the Windows working copy.

## Repository structure

Actual layout as of the 2026-08-03 scaffold ([ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md)):

```
praesto/
├── documentation/        # all project docs (see ../README.md) — authoritative
├── docs/                 # relay context system, derived from documentation/
├── migrations/           # numbered SQL generated by drizzle-kit, applied by wrangler
├── scripts/              # generate-icons.js (PNG set from the mark), fetch-fonts.mjs (one-off font download)
├── public/               # PWA manifest, icons, brand SVGs and the two self-hosted WOFF2 fonts (+ their OFL licences)
├── src/
│   ├── app/              # React SPA: App.tsx, api.ts (typed client), pwa.ts, main.tsx, toast-store.ts,
│   │                    #   tokens.css + styles.css, components/ (screens) + components/ui/ (primitives), hooks/
│   ├── sw.ts             # service worker: precache, push, notificationclick
│   ├── shared/           # environment-agnostic: wire contract + pure domain logic
│   └── worker/           # index.ts (fetch + scheduled), auth.ts, dto.ts, routes/, push/, db/
├── test/                 # Vitest suites running in workerd
├── drizzle.config.ts · vite.config.ts · vitest.config.ts · eslint.config.js
├── tsconfig*.json        # solution + app / sw / worker / node / test projects
├── wrangler.jsonc        # assets (SPA), D1 binding, cron trigger
└── package.json          # single package, no workspaces
```

Boundaries worth knowing:

- `src/shared/` is compiled into **every** target (app, worker, service worker, tests), so it must stay free of DOM and Worker globals and free of runtime dependencies.
- The app/worker boundary is enforced by TypeScript project references: crossing it is a compile error, not a review comment.
- `worker-configuration.d.ts` is generated by `npm run cf-typegen` and **committed** — `npm run check` fails if it drifts from `wrangler.jsonc`.
- Prettier owns code formatting; prose under `documentation/`, `docs/`, `PRPs/` and `CLAUDE.md` is excluded on purpose (see `.prettierignore`).

## Delivery discipline

Confirmed by the owner on 2026-08-03, when the roadmap was sliced into delivery units. Work is organized as **vertical slices** (each unit ships API and UI together), not as horizontal layers — but inside each unit the order is inverted:

- **API-first within every unit.** No unit starts at the screen. Routes, validation and their tests run green against a real D1 before any UI is written. Each unit is therefore a miniature backend-first project.
- **Unit 2 (`task-detail-and-dates`) is the contract-freeze point.** The Task wire contract has one consumer today and seven by the end of the [roadmap](../50-planning/roadmap.md#delivery-units); its PRD designs the final shape — fields, filters, paging — not merely what that screen needs. Reshaping the contract after unit 2 costs N times more.

The rationale for choosing vertical slices over a backend-first phase: with ~1 h/day (CON-003), a layer-first plan means weeks with nothing usable, no habit formed, and no feedback — while the owner's own principle 6 treats stale, unused data as project-level failure. The API-first rule above buys back most of the contract stability a layered plan would have offered.

## Naming

- All identifiers — variables, functions, types, files, database fields — are written in English, per [ADR-0001](../60-decisions/ADR-0001-write-all-artifacts-in-english.md).
- Domain concepts in code must use exactly the canonical names from the [glossary](../10-product/glossary.md): **Task**, **Event**, **Reminder**, **Life Area**. No synonyms, abbreviations or translations — if code needs a concept the glossary lacks, the glossary is updated first.
- Casing (TypeScript idiom): `camelCase` for variables/functions, `PascalCase` for types and React components (and their `.tsx` files), `kebab-case` for all other file names, `snake_case` for SQL tables/columns (mapped to `camelCase` properties by Drizzle).
