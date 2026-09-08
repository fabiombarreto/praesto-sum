---
status: accepted
last_updated: 2026-09-07
review_trigger: "a new decision touches the same topic"
---

# ADR-0013: Swap `web-push` for `@block65/webcrypto-web-push` — supersedes ADR-0005's naming of `web-push`

> **Purpose:** Record why the send library named in [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md) was replaced before any other phase of `push-channel-proven` depended on it, and the evidence that settled it.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-09-07
- **Related:** [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md) (superseded, in its naming of `web-push` only); [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md); `PRPs/prds/push-channel-proven.prd.md` phase 1 (push-send-spike), AC-11

## Context

ADR-0005 named `web-push` under `nodejs_compat` as the Web Push send library, following Cloudflare's own guide. `web-push`'s own issue tracker ([web-push#718](https://github.com/web-push-libs/web-push/issues/718)) documents `https.request` and `crypto.createECDH` as missing under `nodejs_compat`, yet the guide still recommends the package and this project's `compatibility_date` (`2026-08-01`) is far newer than the issue — the evidence was genuinely conflicting, which is why `push-channel-proven` phase 1 was scoped as a spike to decide by running the library rather than by reading about it.

## Decision

We **supersede ADR-0005's naming of `web-push`** and adopt **`@block65/webcrypto-web-push@2.0.0`**, pinned exact, as the sole Web Push send library.

The spike (`src/worker/push/send.ts`, exercised by `test/push-send-adapter.test.ts` against an RFC 2606 `.invalid` endpoint so the library's real signing/encryption path runs inside workerd) found that `web-push@3.6.7`'s `sendNotification()` neither resolved nor rejected: it hung past every timeout and the Workers runtime eventually killed the request as hung, rather than throwing a clean, actionable error. That is a decisive "does not work" verdict — worse than the documented throw, because a caller cannot even catch it. `@block65/webcrypto-web-push` builds the encrypted request (headers + body) using only Web Crypto and returns it for the caller's own `fetch`, so the network call is the platform's native `fetch` rather than Node's `https` module; against the same `.invalid` endpoint it completed (with an explicit network failure) well inside the test timeout.

`web-push` and `@types/web-push` are removed from `package.json` entirely — exactly one send library remains declared, per PRD AC-11.

## Alternatives considered

- **Keep `web-push` and add a workaround** (e.g. a custom `https.request` shim) — rejected: the failure is a hang with no visible cause, not a missing symbol that could be polyfilled; there is nothing to catch and patch.
- **`@pushforge/builder`** (named as an "edge-native alternative" in ADR-0005's own research) — not evaluated in this spike; `@block65/webcrypto-web-push` was the PRD's own named candidate (Technical Risks table) and its GitHub example matched the `buildPushPayload` + `fetch` shape this adapter needed, so it was tried first and it worked.

## Consequences

- Positive: the send path no longer depends on Node's `https`/`crypto.createECDH` compatibility under `nodejs_compat` — it depends only on Web Crypto and `fetch`, both first-class in workerd. `sendPush()`'s exported signature (from `push-send-spike`'s Task 1) is unchanged.
- Negative / accepted trade-offs:
  - `@block65/webcrypto-web-push` is a smaller, less battle-tested library (fewer downloads, fewer maintainers) than `web-push`. Mitigated by the same exact-pin-and-deliberate-upgrade discipline ADR-0005 already established.
  - Removing `web-push` from `package.json` made `scripts/generate-vapid.mjs`'s `import { generateVAPIDKeys } from "web-push"` unresolvable, so key generation moved to Node's built-in `webcrypto` (`node:crypto`). The output shape is unchanged: a 65-byte raw uncompressed P-256 public key and, for the private key, the JWK `d` component — already the 32-byte private scalar — both base64url-encoded exactly as `web-push` produced them (43 base64url characters for the private key). The script still never echoes the private key to stdout, only its length; that property is the reason the script exists (chore C10, after a secret was exposed in a screenshot) and it survives this change unchanged.
  - The blast radius is therefore not limited to the send path: `src/worker/push/send.ts`, `package.json`/`package-lock.json`, `scripts/generate-vapid.mjs`, and the derived docs (`docs/context/architecture.md`, `docs/decisions.md`) all changed in this session.
  - `documentation/`/`docs/context/architecture.md`'s "Notifications:" line and the PRD's Decisions Log "Send library" row are updated in the same change that adopts this ADR, so no derived document goes stale the session the decision changed.
