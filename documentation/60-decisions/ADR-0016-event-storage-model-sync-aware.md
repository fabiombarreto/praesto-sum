---
status: accepted
last_updated: 2026-10-19
review_trigger: "unit 15 `google-calendar-write` finds the link columns insufficient, a field is added to the Event (hash version bump), or Google's handling of a wall-clock time in a DST gap is measured"
---

# ADR-0016: The Event is stored as instants plus a zone, with its content hash on the row and its sync link in a table that outlives it

> **Purpose:** Record how the Event entity is shaped so that unit 15 (writing to Google) needs no migration over the owner's real commitments — time model, content hash, link table, provenance and the contract of the range function.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-10-19
- **Related:** [ADR-0007](ADR-0007-google-calendar-bidirectional-sync.md) (the Event must be born sync-aware; limits L1–L3; derived dirty state); [ADR-0006](ADR-0006-recurrence-model.md) (recurrence is unit 17 and expands in local time); [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md) (export binds every new table); [ADR-0009](ADR-0009-ui-copy-in-brazilian-portuguese.md) (*Compromisso* is pt-BR copy); [ADR-0008](ADR-0008-adopt-test-first-methodology.md); `PRPs/prds/events-and-day-view.prd.md` (unit 14, decisions D-E to D-L)

## Context

ADR-0007 requires the Event entity to be "born sync-aware — provenance, `all_day`, IANA timezone and a content hash from day one, plus a separate `event_sync_links` table", because retrofitting it later would be a migration over the owner's real life. It does not say how time is stored, where the hash lives, what the link table holds or what happens to the link when the Event is deleted. The domain model placed the hashes in the link table, which sits empty until unit 15 and would therefore leave every commitment the owner enters in unit 14 without a hash. Research for the PRD (2026-10-18) also found that Google's `end` is exclusive and that `timeZone` has no meaning on an all-day event, that the project's instants are epoch **seconds** while the shipped Google DTO carries **milliseconds**, and that nothing yet defines a range function that unit 16's week view can call.

## Decision

1. **Time.** A timed Event stores two UTC instants (`start_at`, `end_at`, epoch seconds) and the IANA zone it was meant in (`timezone`, never null; the owner's zone `America/Sao_Paulo` by default). An all-day Event stores local days (`start_date`, `end_date`) with an **exclusive** end, exactly as Google does; the screen shows the inclusive end. `end` is mandatory in storage; the owner may leave it empty and the form — or, for any other caller, the API through the same shared helper — fills it (start + 1 h, or the next day for all-day), so FR-020's "end optional" holds for the owner. Wall-clock to instant goes through one pure helper that follows RFC 5545: a time in a DST gap uses the offset before the gap, a time in an overlap is its first occurrence. A SQL `CHECK` makes the two shapes mutually exclusive.
2. **Content hash.** `computeEventContentHash()` (pure, `src/shared`, SHA-256 through Web Crypto) hashes title, description, location, `all_day`, start, end and timezone in a fixed order, trimmed, `""` ≡ `null`, behind a version prefix (`v1`). The hash is stored in `events.content_hash` and written by **one** repository function — no API route computes or sets it — so every commitment has a correct hash from its first write. The sync baseline (`synced_content_hash`) lives in `event_sync_links`; an Event is dirty when it has no link or its hash differs from the baseline (ADR-0007, derived state). This amends the domain model's wording that the hashes live in the link table.
3. **The link outlives the Event.** `event_sync_links.event_id` is nullable with `ON DELETE SET NULL`. Deleting a linked Event leaves an orphan link, and an orphan link **is** the pending deletion in Google — derived state, no tombstone table, no outbox (L2, L3). The pair (`calendar_id`, `external_event_id`) is unique (domain invariant 6) and `event_id` is unique. The table is empty and unused in unit 14, no API route writes it, and it is dumped by the export so a restore cannot orphan links once unit 15 fills it.
4. **Provenance is a column and a pure function.** `events.source` is `local | google` (TypeScript union plus SQL `CHECK`). Unit 14 creates only `local`; `eventCapabilities(source)` says what the UI may offer and the API refuses to edit or delete a `google` row. Google events keep being read live in unit 14 and are not stored.
5. **Wire.** `EventDto` carries epoch **seconds**, like every other instant in the project. The shipped `CalendarEventDto` (milliseconds) is wire-frozen and is not touched; one adapter normalises both into the day items.
6. **The range function.** `itemsInRange(sources, { from, to })` is the single pure function that turns a list of sources — local Events, Google Events, dated Tasks — into items grouped by local day, with no branch on the number of sources. The day route and *Hoje*'s *Agenda* call it now; unit 16's week view and unit 17's recurring occurrences call it with other ranges and other sources.

## Consequences

- Unit 15 adds code, not a migration over real data: identity, provenance, hash and baseline already exist on every row. The link table's columns beyond identity and baseline are provisional, and altering an empty table costs nothing.
- Adding a synced field later changes the hash input: the version prefix lets unit 15 recompute hashes with one script instead of guessing which rows used which scheme.
- A hard delete of an unlinked Event is final inside the app; the weekly snapshot (FR-043) is the recovery path. A linked Event's deletion survives as an orphan link until unit 15 consumes it.
- Zero-duration commitments are allowed (`end_at >= start_at`); an all-day Event spans at least one day (`end_date > start_date`).
- A timed Event crossing midnight is listed on every local day it overlaps.
- Google's behaviour for a wall-clock time inside a DST gap is not documented; the RFC rule is the project's choice, tested on a zone with DST (`America/Sao_Paulo` has had none since 2019).
- When unit 15 writes to Google it must use `events.patch`, never a full replace, because Praesto does not model colour, visibility, busy/free, conference data or attachments and a replace would erase them in Google.
- Rejected: wall-clock plus zone for single Events (every consumer must convert, and gaps and overlaps become ambiguity in the data rather than in one helper); an inclusive all-day end (an off-by-one at every boundary with Google and `.ics`); the hash only in the link table (a backfill over real commitments — the retrofit ADR-0007 exists to avoid); `ON DELETE CASCADE` on the link (loses the fact that something must be deleted in Google); a tombstone table (forbidden by L2); `updated_at` as the dirty flag (forbidden by ADR-0007); milliseconds on the new DTO (two units in one codebase).
