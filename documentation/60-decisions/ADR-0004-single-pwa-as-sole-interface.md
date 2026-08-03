---
status: accepted
last_updated: 2026-08-03
review_trigger: "a new decision touches the same topic"
---

# ADR-0004: Adopt a single installable PWA as the sole interface

> **Purpose:** Record the resolution of pending decision 2 — the interface type — its context and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-03
- **Related:** [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md); QA-002, QA-004, CON-001, CON-002, FR-041

## Context

This resolves decision 2 of the pending decisions queue. Much of it was shaped while resolving decision 1: [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md) already fixed a thin-client architecture with one responsive web client served by the same Cloudflare deployment as the API, and Web Push as the Reminder delivery channel — and explicitly rejected the replicas-plus-installable-apps path because building for two native platforms is the wrong cost profile for a solo maintainer (QA-004, CON-002). The owner confirmed the direction explicitly ("we can do a PWA initially", 2026-08-03). The remaining scope of this decision is to formalize the interface posture and its boundaries: what the PWA must include, and what would trigger revisiting.

## Decision

We will build a **single responsive web application, installable as a PWA**, as the **sole interface of the MVP** — one codebase serving both the phone and the PC, delivered by the same Cloudflare deployment as the API (ADR-0003). It includes from the start:

- A web app manifest and service worker providing installability on both devices (home screen on the phone, window on the PC).
- A Web Push subscription flow for Reminder notifications (FR-041), including the iOS requirement that the PWA be installed to the home screen.
- Explicit "server unreachable" UX on every screen — the client is network-dependent by design (ADR-0003); the service worker may cache the shell and last-viewed data for read-only display, and nothing more (no offline write queue, ADR-0003 safeguard 3).

Native apps, store distribution, or wrapper shells (Capacitor/Tauri-class) are out of the MVP; adopting any of them is a new ADR. Declared revisit triggers: Web Push on iOS proving too unreliable for FR-041 in real use, or a needed device capability that PWAs cannot reach.

## Alternatives considered

- **Native mobile apps (one per platform)** — rejected: two extra codebases and toolchains against QA-004/CON-002, store friction for a single user, already rejected structurally in ADR-0003.
- **Cross-platform native (React Native / Flutter-class)** — rejected for the MVP: single codebase but a heavier toolchain and build pipeline than the product needs, weak desktop story, store or sideloading friction — all to gain capabilities (deep OS integration) the MVP does not require.
- **Desktop-first app + separate mobile solution** — rejected: doubles the interface surface and contradicts the one-codebase rationale.
- **CLI/TUI as primary interface** — rejected as primary: unusable on the phone, which is a confirmed requirement. A CLI may still appear later as a secondary client of the same API (`praesto` short form, ADR-0002) without superseding this ADR.
- **Wrapper shell now (Capacitor/Tauri)** — rejected: adds a build pipeline before any PWA limitation has actually been hit; kept as the documented escape hatch if a revisit trigger fires.

## Consequences

- Positive: one codebase and one deploy for every device (QA-004, CON-002); no app store, instant updates; same origin as the API simplifies auth and push; installability gives an app-like daily experience at zero marginal cost; Windows-friendly toolchain (CON-001).
- Negative / accepted trade-offs:
  - **iOS constraints:** Web Push requires the PWA installed to the home screen and is less dependable than native push; Safari may evict PWA storage after long disuse — acceptable because the canonical data lives server-side (ADR-0003) and the shell just re-syncs.
  - **No deep OS integration:** no native share targets, widgets, or OS calendar hooks in the MVP — deferred until a real need fires a revisit trigger.
  - **Offline remains read-only at best** — inherited from ADR-0003 and unchanged by this decision.
  - The frontend framework and tooling for this PWA are decision 3 in the [pending decisions queue](index.md).
