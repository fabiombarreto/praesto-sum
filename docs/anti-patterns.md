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

**Carve-out (ADR-0007, 2026-08-04).** This rule is about replicating Praesto's *own* store across the owner's devices. Integrating with Google Calendar — a system a third party already operates — is a different problem and is permitted, bounded by three limits: **L1** only Events cross (closed mirror inventory); **L2** only the provider's own mechanisms are used (Google's `syncToken`, `etag`, `status: cancelled`) — building our own change-log, tombstone table, cursor protocol, vector clock or divergent-version merge stays forbidden; **L3** no queue of our own — the push set is derived state (`content_hash <> synced_content_hash`), self-healing and logless. **Tripwire:** if a change needs to invent one of the mechanisms in L2, the anti-pattern is returning — stop and open a new decision.

## Field-level merge of Events

**What it is:** Reconciling a sync conflict field by field ("keep their title, my time").
**Why it's forbidden:** It requires per-field timestamps — literally the CRDT vocabulary this project rejected (ADR-0007).
**What to do instead:** Last-writer-wins per item, with the three hard exceptions: deletion beats edit; a technical tie (<60 s, both dirty) keeps local and asks; the loser is stored and surfaced with a restore action, never silently discarded.
**Areas affected:** events

## Treating absence in a full re-sync as a deletion

**What it is:** Deleting local Events that did not appear in a full re-sync after a `410 GONE`.
**Why it's forbidden:** A stale sync token would erase the owner's agenda. Only an explicit provider cancellation deletes (ADR-0007, domain invariant 7).
**What to do instead:** Full re-sync is an upsert with zero deletions.
**Areas affected:** events

## Using `updated_at` as the sync dirty flag

**What it is:** Deciding what to push to Google from the `$onUpdate` timestamp.
**Why it's forbidden:** `updated_at` also fires when a *remote* change is applied, so every pull marks rows dirty and pushes them back — an infinite echo rewriting the owner's agenda every 5 minutes and spamming his phone with Google notifications.
**What to do instead:** Dirty is `content_hash <> synced_content_hash`; the remote-apply path writes both hashes in the same statement, through repository functions no API route can reach.
**Areas affected:** events

## Mirroring Tasks, Reminders or Life Areas to Google

**What it is:** Pushing anything beyond Events to the external calendar.
**Why it's forbidden:** The ADR-0007 mirror inventory is closed and is the CON-005 consent boundary. Widening it needs its own ADR (the owner wants Tasks/Reminders eventually — it is in the roadmap backlog).
**What to do instead:** Keep the mapper structurally incapable of serializing them.
**Areas affected:** tasks, reminders, life-areas, events

## Re-serializing a recurrence rule Praesto cannot express

**What it is:** Reading a Google RRULE with `BYSETPOS`, `BYMONTH`, `WKST` or multiple `RDATE`/`EXDATE`, flattening it into Praesto's vocabulary, and writing it back.
**Why it's forbidden:** It destroys the owner's real agenda silently and permanently.
**What to do instead:** Store the rule verbatim, flag it unsupported, mark the series read-only in the UI with the reason shown.
**Areas affected:** events

## Mirroring Google's own reminders, or third-party attendees

**What it is:** Letting pushed Events keep Google's default reminders, or copying attendee lists into D1.
**Why it's forbidden:** Google reminders would double every notification — the exact "duplicated entries between tools" pain in the problem statement. Attendees are other people's PII and would land in the FR-042 export.
**What to do instead:** Push with `reminders: { useDefault: false, overrides: [] }`; keep only a `has_guests` flag and a link to open in Google.
**Areas affected:** events, reminders

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

**Carve-out (ADR-0009, 2026-08-18).** The *visible UI copy* — the string **values** the owner reads on screen (labels, buttons, placeholders, states, notifications, manifest text) — is written in **pt-BR**. Everything around those values stays English: identifiers, string keys, comments, tests, commits, docs. A Portuguese identifier or comment is still this anti-pattern; an English button label in the app is now the opposite drift.

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
