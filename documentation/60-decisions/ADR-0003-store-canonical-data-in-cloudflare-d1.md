---
status: accepted
last_updated: 2026-08-03
review_trigger: "a new decision touches the same topic"
---

# ADR-0003: Store canonical data in Cloudflare D1 behind Cloudflare Workers

> **Purpose:** Record the resolution of pending decision 1 — the data storage and ownership posture — its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-03
- **Related:** [ADR-0002](ADR-0002-name-the-project-praesto-sum.md); QA-001..QA-004, CON-004, CON-005, CON-006, FR-041, FR-042, FR-043

## Context

This resolves decision 1 of the pending decisions queue. It was made in three steps, each narrowing the space:

1. **Storage engine.** A panel comparison settled that an embedded SQLite-class database beats plain text files as the canonical store: plain files force a hand-maintained persistence layer (atomic writes, parsing, custom indexes for FR-007/FR-040, schema evolution) that a solo developer carries forever, in tension with QA-004 and CON-006 — with documented precedent (Logseq migrated from canonical Markdown to SQLite). QA-001 measures **exportability**, not text-as-storage, so open export (JSON + iCalendar) as a day-1 Must (FR-042) preserves ownership.
2. **Multi-device.** The owner confirmed (2026-08-03) using both phone and PC with shared data — "a server somewhere" is accepted. A second comparison settled the server's role: a single canonical store with thin clients beats local replicas + synchronization, because a sync engine (change-log, tombstones, cursors, convergence) is the hardest class of code for a solo maintainer (same family as the already-rejected CRDTs), and the CalDAV-hub variant would lock the domain model into iCalendar and force installable apps on two platforms, pre-empting decision 2. One responsive web/PWA client covers both devices; the owner confirmed PWA-first.
3. **Hosting.** The owner set cost as the deciding factor — no upfront hardware and no recurring fee — and chose Cloudflare's free serverless platform over: a home mini-PC/Raspberry Pi (~R$550–700 one-time; the panel's original recommendation), a cheap VPS (~R$25/month), and Oracle Cloud Always Free (its idle-reclaim policy — 7-day p95 CPU below 20% — punishes exactly the four-weeks-untouched pattern of QA-002 unless the account is converted to Pay-As-You-Go, and the community reports unilateral terminations; same provider-can-read caveat with none of the zero-ops benefit).

**Tension record (CON-005).** The earlier cheap-filter reading of CON-005 eliminated managed backends that can read the data. This decision consciously relaxes that reading under the constraint's own "explicit, revocable consent" clause: Cloudflare can technically read D1 contents (no end-to-end encryption), but it never holds the only copy — safeguard 2 below makes an up-to-date local copy mandatory, and leaving is a redeploy, never a rescue. The owner arbitrated this privacy × cost × operations trade-off explicitly.

## Decision

We will hold the canonical copy of all data in **Cloudflare D1** (SQLite-class managed database), served by **Cloudflare Workers** — a single-user CRUD API plus a cron-triggered scheduler that fires Reminders (FR-041) — on the Cloudflare free plan. All devices use one responsive **web/PWA client**; notifications reach the phone via **Web Push** to the installed PWA. There is deliberately **no merge, sync, or offline-write logic** anywhere in the system.

Binding safeguards (part of this decision, not follow-ups):

1. **Day-1 export (FR-042):** an endpoint/command dumps 100% of the data as JSON + iCalendar at any moment.
2. **Automated off-provider snapshots (FR-043):** a scheduled job ships full export snapshots to the owner's PC on a regular cadence — Cloudflare never holds the only copy.
3. **No offline write queue** may be introduced without a superseding ADR — ad-hoc offline queues silently rebuild the sync engine this architecture avoids.
4. **Public endpoint, private access:** every API route requires an authentication token (single user); the only unauthenticated surface is the PWA shell. May be hardened later with Cloudflare Access without superseding this ADR.

## Alternatives considered

- **Plain text files as canonical store** — rejected: permanent hand-built persistence layer vs QA-004/CON-006; export from an open-format database preserves the real requirement (QA-001 exportability).
- **Local replicas + custom sync engine or CRDTs** — rejected: the sync engine would be larger than the app and is the worst code class for solo debugging; cr-sqlite abandoned.
- **Local replicas + CalDAV/Radicale hub** — rejected with respect: best offline behavior and notification path, but locks the domain model into iCalendar (future Life Areas bring entities that do not fit VEVENT/VTODO) and pre-empts decision 2 with two installable apps. **Declared revisit candidate** if offline capture proves painful in practice.
- **Owner-hosted home server (mini-PC/Pi + Tailscale, canonical SQLite file)** — the panel's original recommendation, strongest on QA-001/CON-005/QA-003; declined by the owner on upfront hardware cost. **Documented landing zone** if Cloudflare terms change: the safeguards guarantee the migration is a redeploy.
- **Cheap VPS (Hetzner-class, ~R$25/month)** — rejected: recurring cost against the QA-003 baseline with CON-004 still open, buying only independence from home infrastructure the owner does not need.
- **Oracle Cloud Always Free** — rejected: idle-reclaim policy collides with the QA-002 usage pattern unless converted to PAYG (international card + invoice vigilance); reports of unilateral termination; same readability caveat as any provider, without the zero-ops gain.
- **Managed BaaS that pauses or reads data without meaningful consent/exit (Supabase free, Firebase-class)** — elimination stands: inactivity pauses violate QA-002 literally; D1 is accepted only under the binding safeguards above.

## Consequences

- Positive: zero recurring and zero upfront cost (QA-003 at baseline, CON-004 untouched); nothing to operate — no OS, no patching, no hardware, the strongest QA-002/CON-006 posture available; the merge/conflict bug class is structurally absent; the Reminder scheduler is always awake without the owner owning an always-on machine; the whole system is one Workers API + one PWA codebase (QA-004, CON-002).
- Negative / accepted trade-offs:
  - **Cloudflare can read the data** (no E2EE) — accepted by explicit, revocable owner consent; mitigated by mandatory local snapshots and the guaranteed exit path; field-level encryption is a possible future ADR.
  - **Decision 3 is partially pre-resolved:** the backend runs on the Workers runtime (JavaScript/TypeScript/WASM). Remaining stack scope: PWA frontend and tooling.
  - **Vendor coupling:** Workers/D1 glue is proprietary, though the data layer speaks SQLite-flavored SQL; exit = redeploy the API on any host (home-server design is the documented landing zone).
  - **Free-plan dependence:** current limits (100k requests/day, 5 cron triggers, D1 storage) exceed one person's scale by orders of magnitude, but terms can change — accepted risk with a declared exit path.
  - **No offline capture:** without connectivity the PWA is read-only at best — accepted; if painful in real use, that is the declared trigger for a superseding ADR (leading candidate: replicas + hub).
  - **Web Push last mile:** reliable on Android; on iOS it requires the PWA installed on the home screen and is less dependable — fallback channels (e-mail-to-self, ntfy) may be added without superseding this ADR.
