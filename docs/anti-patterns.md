# Anti-Patterns

Padrões proibidos, features desabilitadas e restrições intencionais.
A IA NÃO deve implementar nada listado aqui, mesmo que pareça correto.
Atualizado pelo Docs Updater após cada aprovação de implementação.

> Nothing here is inferred — every entry comes from an owner-approved ADR or
> validated convention in `documentation/`.

---

## Offline write queue

**What it is:** Queuing writes locally while offline to replay later.
**Why it's forbidden:** Ad-hoc offline queues silently rebuild the sync engine ADR-0003 exists to avoid. Binding safeguard: requires a superseding ADR.
**What to do instead:** Explicit "server unreachable" UX; offline is read-only at best (PWA shell cache).
**Areas affected:** all

## Syncing the live database file

**What it is:** Replicating the live D1/SQLite file (or naive file copies of it) via OneDrive/Syncthing/Dropbox, or as backup.
**Why it's forbidden:** Documented corruption mechanism (sqlite.org/howtocorrupt.html); naive copies under WAL are silently corrupt (ADR-0003).
**What to do instead:** Consistent snapshots only (export command / scheduled snapshot job shipping to the owner's PC).
**Areas affected:** all

## Meta-framework / SSR / RSC on the PWA

**What it is:** Adopting Next.js, React Router framework mode, SvelteKit, SSR or React Server Components.
**Why it's forbidden:** SPA + Vite is a recorded FINAL position (ADR-0005) — SSR has zero payoff for a token-gated single-user app; ecosystem social pressure is an explicitly named behavioral risk.
**What to do instead:** React 19 SPA + Vite + `@cloudflare/vite-plugin`.
**Areas affected:** all

## CRDT or custom sync engines

**What it is:** CRDT libraries (cr-sqlite class) or hand-built bidirectional sync (change-logs, tombstones, cursors).
**Why it's forbidden:** Distributed-systems complexity with zero collaborators; worst solo-maintainability class (ADR-0003/0005 rejections).
**What to do instead:** Single canonical store, thin clients. If offline capture proves painful, a superseding ADR (replicas + CalDAV hub is the declared candidate).
**Areas affected:** all

## Editing accepted ADRs

**What it is:** Modifying the content of an accepted decision record.
**Why it's forbidden:** ADRs are append-only (`documentation/00-meta/documentation-guidelines.md`); history of reasoning must survive.
**What to do instead:** A new ADR that marks the old one `superseded`.
**Areas affected:** all

## Hand-duplicated entity types

**What it is:** Declaring Task/Event/Reminder/Life Area types by hand in the app or shared code.
**Why it's forbidden:** Types must originate in `src/worker/db/schema.ts` (Drizzle) and flow outward — duplication turns schema drift into silent runtime bugs instead of compile errors (ADR-0005).
**What to do instead:** Import/derive from the Drizzle schema through `src/shared/`.
**Areas affected:** tasks, events, reminders, life-areas

## Version ranges in dependencies

**What it is:** `^`/`~` ranges in package.json.
**Why it's forbidden:** All versions pinned exact (`save-exact`, ADR-0005); "nothing changed by itself" is the #1 defense of return-after-months.
**What to do instead:** Exact pins; deliberate changelog-in-hand upgrades.
**Areas affected:** all

## Portuguese in artifacts

**What it is:** Portuguese in code, comments, commits, identifiers or docs.
**Why it's forbidden:** ADR-0001 — single language across artifacts. (Conversation with the owner remains Portuguese; conversation is not an artifact.)
**What to do instead:** English everywhere in the repo.
**Areas affected:** all

## Glossary synonym drift

**What it is:** Using "todo", "appointment", "alert", "category" etc. for domain concepts.
**Why it's forbidden:** Canonical names are fixed and owner-validated (`docs/domain/glossary.md`); synonyms fragment search and AI context.
**What to do instead:** Task, Event, Reminder, Life Area — exactly. New concept? Update the glossary first.
**Areas affected:** tasks, events, reminders, life-areas

## Weakening tests to force green

**What it is:** Deleting, skipping, commenting out or loosening a failing test to make a run pass.
**Why it's forbidden:** The test guardrail (`docs/context/testing.md`) requires tests to be updated to the intended behavior, never silenced.
**What to do instead:** Update the test to assert the new intended behavior, or fix the code.
**Areas affected:** all

---

<!-- Template for future entries:

## [pattern name]

**What it is:** Brief description.
**Why it's forbidden:** The reason this was explicitly prohibited.
**What to do instead:** The approved alternative.
**Areas affected:** [list domain areas]

-->
