# Feature: Durable token (Phase 2 of install-and-quick-capture)

```
**Decision Gate**
- Active context: none (no `.context.md` file in the repository)
- Activated criteria: cross-cutting pattern (a storage port consumed by the
  SPA's only API client); new module under `src/shared/`; changes the
  signature of exports consumed by other files (`getToken`/`setToken` become
  async); impact on a reusable service (the typed API client); touches the
  auth surface (the 401-clears-token path)
- Decisions found:
  - ADR-0003 — the bearer token gates every `/api/*` route; single canonical
    copy in D1; thin clients; NO merge, sync or offline-write logic. A token
    that survives eviction is a client-local credential concern, not a data
    replica
  - ADR-0004 — one installable PWA is the sole interface; the storage fix
    must be reachable from the web platform, with no native wrapper
  - ADR-0005 — React 19 SPA + Vite; `src/shared/` is dual-compiled into the
    browser AND Worker targets, so it carries no DOM globals; exact pins
  - ADR-0008 — test-first (`tdd: true`); the suite is RED before any
    production code exists
  - PRD Open Question 4, RESOLVED 2026-08-11 by the owner — extract the
    logic to `src/shared` behind a port, test it first against an in-memory
    fake, exempt only the adapter. BINDING for this plan
  - `docs/context/methodology.md` §"Browser-API work: split the logic out,
    then the glue is exempt" (recorded 2026-08-11) — the exemption is for
    glue, never for logic; a phase that cannot be split raises it to the
    owner rather than proceeding silently
  - CON-007 — the owner's phone is Android; device behaviour is verified
    against Android, never inherited from iOS
- Applicable anti-patterns:
  - Weakening tests to force green — FORBIDDEN. No existing test may be
    deleted, skipped or loosened by this phase
  - Offline write queue — FORBIDDEN. Persisting a *credential* is not
    persisting a *write*; this plan introduces no queue, no retry, no
    pending-mutation store, and nothing that could grow into one
  - Hand-duplicated entity types — not implicated; the store handles an
    opaque `string`, never a Task/Event shape
  - Meta-framework / SSR / RSC — not implicated
  - Glossary synonym drift — not implicated; no new domain term
  - Portuguese in artifacts
- Applicable architectural rules:
  - `src/shared/` compiles into every target and carries no DOM/Worker
    globals — enforced structurally: `tsconfig.test.json:4` and
    `tsconfig.worker.json:4` both declare `lib: ["ES2022"]` with no `DOM`,
    so any real browser-global use in `src/shared/` is a compile error
  - `tsconfig.test.json:8` includes `test`, `src/worker`, `src/shared` — and
    deliberately NOT `src/app`. Logic that must be tested has to live in
    `src/shared/`
  - Every `/api/*` route requires the bearer token; only the PWA shell is
    unauthenticated. The 401-clears-token path (`src/app/api.ts:54-57`) is
    the one remaining route back to the token screen and must survive this
    phase intact
  - One Worker serves the SPA assets, `/api/*` and the cron — this phase is
    entirely client-side; no Worker route, DTO or schema change
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/install-and-quick-capture.prd.md` — Implementation Phases row 2:
  "Durable token" — Goal: the token survives storage pressure and a restart;
  the token screen does not reappear — Success signal: covers AC-2, with the
  401-clears-token path preserved
  (`PRPs/prds/install-and-quick-capture.prd.md:264, 276-305`).

## Summary

Today the bearer token lives in `window.localStorage`
(`src/app/api.ts:11-23`), which `navigator.storage.persist()` does not
protect — so under storage pressure the browser may evict it and the token
screen reappears in the middle of the owner's life. This phase moves the
token to IndexedDB (which `persist()` does protect) and requests persistent
storage at startup. Per the owner's binding resolution of PRD Open Question
4, the *decidable* part — read, save, clear, the 401-clears path, the
one-time migration of the token already sitting in `localStorage` on both
the owner's devices, and the degradation path when IndexedDB is unavailable
— moves into a new pure module `src/shared/token-store.ts` behind an
injected storage port and is tested first against an in-memory fake in the
existing workerd tier, exactly as Phase 4 did with
`src/shared/request-failure.ts`. Only a thin adapter
(`src/app/token-storage.ts`) actually touches `indexedDB` and
`navigator.storage.persist()`; it carries no branching worth asserting and
is verified on the owner's Android phone and Windows PC. Because IndexedDB
is asynchronous and `localStorage` is not, this phase also carries the
resulting ripple deliberately: the three token accessors become async, and
`App.tsx`'s token gate gains an explicit "still checking" state so the token
screen can never flash before the stored token has been read.

## User Story

As the owner, I want the token I pasted once to still be there after a
restart and after the browser reclaims storage, so that Praesto never
interrupts me by demanding a secret I have to go and look up — and I want
the token I already pasted on my phone and my PC to carry over on its own,
so that "making it durable" does not cost me two more paste operations.

## Problem Statement

The owner pastes the API token once per device and expects never to see the
token screen again. The token is kept in `window.localStorage`, and
`navigator.storage.persist()` — the only mechanism that protects an origin's
storage from eviction — does not cover Web Storage. Under storage pressure
the token can therefore be discarded without warning, and the app falls back
to the token screen at an arbitrary moment. There is a second, quieter half
to the problem: the owner *already has* a token stored in `localStorage` on
both devices, so a naive move to IndexedDB would silently strand it and
force exactly the two re-pastes the durability work exists to prevent.

## Solution Statement

Introduce a pure `src/shared/token-store.ts` that owns every decision about
the token — where it is read from, where it is written, what happens on a
401, and how an existing `localStorage` token is migrated exactly once — and
that reaches storage only through two injected ports it defines in plain
TypeScript (no DOM types, so the module still compiles into the Worker and
test projects). Test that module first against an in-memory fake covering
the durable path, the migration path, the clear path, and each degradation
path. Then add `src/app/token-storage.ts`: the exempt adapter that
implements the durable port over IndexedDB, the legacy port over
`window.localStorage`, and exposes a best-effort
`requestPersistentStorage()`. Rewire `src/app/api.ts` to the store, renaming
`getToken`/`setToken` to `readToken`/`saveToken` so that every call site
that fails to await the new async signature is a compile error rather than a
silent `Promise`-truthiness bug. Finally, make `App.tsx`'s token gate
three-valued — `checking` → `authorized` | `unauthorized` — so the token
screen renders only when the store has actually reported no token.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Medium |
| Systems Affected | New pure module (`src/shared/token-store.ts`), new browser adapter (`src/app/token-storage.ts`), API client token accessors (`src/app/api.ts`), token gate (`src/app/App.tsx`), startup (`src/app/main.tsx`) |
| Dependencies | None — PRD row 2 declares `Depends: -` (the share target needs a valid token, not a durable one) |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/install-and-quick-capture.prd.md:264, 276-305` (Phase 2 — Durable token) |
| phase_type | feature |

(`docs/context/methodology.md` declares `figma_track: false`, so no
`design_source` row is added. The source PRD has no `## Visual-First Mode`
section, so no `phase_scope` row is added either. `phase_type` is
deliberately `feature`, not `foundation`: this phase's acceptance criteria
are behavioural and fully reachable test-first against the in-memory fake,
so the TDD suite must NOT be skipped.)

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/app/api.ts` | 11-23 | The three `window.localStorage` accessors this phase replaces — the exact artifact PRD row 2 names |
| P0 | `src/app/api.ts` | 44-57 | `request()` and the 401 branch that clears the token and throws `ApiError(401)` — the behaviour that must survive, now awaited |
| P0 | `src/app/App.tsx` | 24-31 | `App`'s synchronous `useState(getToken() !== null)` — the exact line the async ripple breaks, and where the "still checking" state goes |
| P0 | `src/app/App.tsx` | 40-49 | `TokenGate`'s submit handler — `setToken(token)` becomes an awaited call before `onAuthorized()` |
| P0 | `src/shared/request-failure.ts` | 1-28 | The DOM-free, dual-compiled module-doc + interface convention this phase's new shared module must follow — the pattern the owner's resolution names by file |
| P0 | `tsconfig.test.json` | 1-9 | `lib: ["ES2022"]` (no `DOM`) and `include` without `src/app` — the two structural facts that force the port design and make DOM-freedom a compile error rather than a convention |
| P0 | `docs/context/methodology.md` | 37-61 | "Browser-API work: split the logic out, then the glue is exempt" — the binding rule for what may and may not skip a test here |
| P1 | `tsconfig.worker.json` | 1-9 | Confirms `src/shared` also compiles into the Worker target under `lib: ["ES2022"]`, so the ports must be plain TypeScript interfaces |
| P1 | `test/share-target.test.ts` | 1-26 | The header convention for a pure-`src/shared` suite in the workerd tier: PRD AC references, source-plan reference, and an explicit scope note naming what stays manual |
| P1 | `src/app/main.tsx` | 26-41 | Where startup side effects are registered after render — the call site for `requestPersistentStorage()` |
| P1 | `documentation/40-engineering/testing-strategy.md` | 26-38 | The row "Browser-storage / browser-API logic … **Yes, via extraction**" — the authoritative split this plan implements |
| P2 | `PRPs/plans/completed/install-and-quick-capture-phase-4-network-honesty.plan.md` | 273-350 | Precedent for the task shape of an extract-pure-logic-then-wire phase, including how the manual slice is stated rather than glossed |

## Patterns to Mirror

```
# SOURCE: src/shared/request-failure.ts:1-28
/**
 * Classifier for a caught request failure, turning it into one of two
 * discriminated, stable, honest messages instead of a raw, browser-specific
 * error string.
 *
 * Like `src/shared/api.ts` and `src/shared/share-target.ts`, this module is
 * compiled into BOTH the browser and the Worker projects, so it must stay
 * environment-agnostic and free of runtime dependencies and DOM globals (no
 * `window`, no `document`). It duck-types `ApiError`'s shape
 * (`src/app/api.ts:25-33`) rather than importing the class, because
 * `src/shared/` cannot import from `src/app/` (`tsconfig.test.json`'s test
 * project `include`s `test`, `src/worker` and `src/shared`, but not
 * `src/app`) ...
 */

/** Result of classifying a caught request failure. */
export interface RequestFailure {
  kind: "server-unreachable" | "http-error";
  message: string;
}
```
Copied by: Task 1 (`src/shared/token-store.ts` opens with the same
dual-compile/DOM-free module doc, and declares its ports as plain exported
interfaces in the same shape — this is the file the owner's resolution and
`docs/context/methodology.md` both name as the pattern to repeat).

```
# SOURCE: src/app/api.ts:11-23
const TOKEN_KEY = "praesto.token";

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
```
Copied by: Task 2 (the adapter's legacy port implements exactly these three
`window.localStorage` operations against the same `"praesto.token"` key, so
the migration reads the key the owner's devices actually hold) and Task 3
(these three exports are replaced by async delegations to the store).

```
# SOURCE: src/app/api.ts:44-57
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body != null) headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });

  if (response.status === 401) {
    clearToken();
    throw new ApiError(401, "Invalid or missing token");
  }
```
Copied by: Task 3 (`request()` already being `async` is what makes the
ripple containable: `const token = await readToken()` and `await
clearToken()` replace the two synchronous calls, and the 401 branch keeps
its exact shape and its `ApiError(401, "Invalid or missing token")` throw).

```
# SOURCE: src/app/App.tsx:24-31
export function App({ initialShare }: { initialShare: ShareTarget | null }) {
  const [authorized, setAuthorized] = useState<boolean>(getToken() !== null);

  if (!authorized) {
    return <TokenGate onAuthorized={() => setAuthorized(true)} />;
  }
  return <TaskBoard onUnauthorized={() => setAuthorized(false)} initialShare={initialShare} />;
}
```
Copied by: Task 4 (this exact component becomes three-valued: the initial
state is `null` = still checking, an effect resolves `readToken()`, and
`TokenGate` renders only on an explicit `false` — never while the answer is
still pending).

```
# SOURCE: src/app/App.tsx:40-49
      <form
        style={styles.row}
        onSubmit={(event) => {
          event.preventDefault();
          const token = value.trim();
          if (!token) return;
          setToken(token);
          onAuthorized();
        }}
      >
```
Copied by: Task 4 (the handler becomes async: the trim-and-reject guard is
unchanged, `setToken(token)` becomes `await saveToken(token)`, and
`onAuthorized()` runs only after the save resolves).

```
# SOURCE: test/share-target.test.ts:1-26
// PRPs/prds/install-and-quick-capture.prd.md AC-1 share-creates-task
// PRPs/prds/install-and-quick-capture.prd.md AC-5 empty-share-creates-nothing
//
// Source plan: PRPs/plans/install-and-quick-capture-phase-1-share-target.plan.md
//
// This is a pure, DOM-free unit under test (src/shared/share-target.ts carries
// no Worker or browser globals), so it needs neither the D1 fixture nor the
// bearer-token auth helpers that test/tasks.test.ts uses ...
//
// Scope note ...: this file covers only the observable, pure-logic slice ...
// The DOM-rendered slice of both ACs ... is unreachable from the workerd-only
// Vitest tier ... and is verified manually per the plan's Level 3 MANUAL steps.

import { describe, expect, it } from "vitest";
import { parseShareTarget } from "../src/shared/share-target";
```
Copied by: the test pair (`/relay-write-test`) when authoring
`test/token-store.test.ts` — same header convention, same fixture-free
import shape, and the same explicit scope note naming what remains manual
(the real IndexedDB adapter and `persist()`).

```
# SOURCE: src/app/main.tsx:26-41
createRoot(container).render(
  <StrictMode>
    <App initialShare={initialShare} />
  </StrictMode>,
);

// Registered after render so it does not compete with first paint.
setupPwa({
```
Copied by: Task 5 (`requestPersistentStorage()` is invoked in this same
after-render startup block, alongside `setupPwa`, for the same reason — it
must not compete with first paint, and it must never block the token read).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/token-store.ts` | CREATE | The phase's decidable logic behind a storage port: read, save, clear, the 401-clears path, the one-time `localStorage` migration and every degradation path. Must live under `src/shared/` because `tsconfig.test.json:8` excludes `src/app` — logic placed in `src/app/` would be structurally untestable (AC-A1..AC-A6) |
| `src/app/token-storage.ts` | CREATE | The exempt adapter: the durable port over `indexedDB`, the legacy port over `window.localStorage`, and a best-effort `requestPersistentStorage()`. Thin by construction — no branching worth asserting; verified on device (AC-A7) |
| `src/app/api.ts` | UPDATE | Replace the three `window.localStorage` accessors with async delegations to the store (`readToken`/`saveToken`/`clearToken`), and await both of them inside `request()` so the 401 clear completes before the caller reacts (AC-A5, AC-A6) |
| `src/app/App.tsx` | UPDATE | Carry the async ripple deliberately: a three-valued token gate that never shows the token screen while the read is still pending, and an awaited save in `TokenGate` (AC-A6, AC-A8) |
| `src/app/main.tsx` | UPDATE | Call `requestPersistentStorage()` once at startup, after render, so IndexedDB is protected from eviction (AC-A7) |

The test suite (`test/token-store.test.ts`) is authored by the test pair via
`/relay-write-test` before implementation, per `tdd: true`; it is
deliberately not an Implementer task and is therefore not listed above.

## NOT Building (Scope Limits)

- **A browser test tier (Vitest browser mode or Playwright).** Decided
  against on 2026-08-11 for exactly this phase; recorded in the roadmap
  backlog with its trigger set at unit 6 `push-channel-proven`, where
  failure is silent by nature. Buying it here is out of scope.
- **A blanket methodology exception for browser APIs.** The owner rejected
  that path. Only the thin adapter is exempt, and only because the logic was
  moved out first.
- **A test asserting that `navigator.storage.persist()` was called.** A
  trivial assertion over a mock with no discriminative content; the test
  reviewer would rightly flag it as `R-TRIVIAL-ASSERT`. The `persist()` call
  is verified on the device.
- **Offline write queue.** Forbidden PRD-wide (`docs/anti-patterns.md`,
  ADR-0003). Storing a credential is not storing a pending write; this phase
  adds no queue, no retry and no replay.
- **A magic link carrying the token in the URL.** Rejected PRD-wide — query
  strings leak into history, referrers and logs.
- **Token rotation, expiry or refresh.** Chore C10 owns rotation; ADR-0003's
  model is one user, one long-lived shared secret.
- **Encrypting the token at rest.** Same-origin storage on the owner's own
  devices; encryption would need a key stored in the same place. Not a
  decision this phase is authorized to take.
- **Changing anything server-side.** No Worker route, DTO, schema or
  migration is touched; the auth gate is unchanged.
- **Units 2 and beyond.** Task detail, dates, today view and everything
  downstream are other units.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/token-store.ts

**ACTION** (serves AC-A1, AC-A2, AC-A3, AC-A4, AC-A5): Create the pure,
DOM-free module that owns every token decision, reaching storage only
through injected ports. It must export:

- `interface DurableTokenStorage { read(): Promise<string | null>; write(token: string): Promise<void>; clear(): Promise<void>; }`
- `interface LegacyTokenStorage { read(): string | null; write(token: string): void; clear(): void; }`
- `interface TokenStore { read(): Promise<string | null>; save(token: string): Promise<void>; clear(): Promise<void>; }`
- `function createTokenStore(ports: { durable: DurableTokenStorage; legacy: LegacyTokenStorage }): TokenStore`

Behaviour the store implements:

1. **`read()` prefers the durable store.** If `durable.read()` resolves to a
   non-blank value, return it and do not touch the legacy store.
2. **`read()` migrates exactly once.** If the durable store holds nothing —
   or if `durable.read()` rejects — fall back to `legacy.read()`. When the
   legacy store holds a non-blank value, copy it into the durable store and
   then clear the legacy copy, so a later read goes straight to the durable
   store. Return the value either way.
3. **Migration never destroys the only copy.** If `durable.write()` rejects
   during the migration, the legacy copy is left in place and the value is
   still returned; the migration retries on the next read.
4. **`save()` writes durably and drops any stale legacy copy**, so a value
   left behind in the legacy store can never later shadow the token the
   owner just pasted.
5. **`save()` degrades instead of losing the token.** If `durable.write()`
   rejects (IndexedDB unavailable or blocked), fall back to
   `legacy.write()` — today's behaviour is the declared floor, per the PRD's
   `persist()`-denied risk row, and a save that silently persists nothing
   would reproduce the exact "token screen returns" failure this phase
   exists to remove.
6. **`clear()` clears BOTH stores and never rejects.** Both are attempted
   even if the first throws. Clearing both is load-bearing, not defensive
   tidiness: if a 401 cleared only the durable copy, rule 2's migration
   would resurrect the stale legacy token on the next read and the app would
   loop back into the same 401. Never rejecting is equally load-bearing: the
   401 path is the app's recovery route, and turning it into an unhandled
   rejection would break the only way back to the token screen.
7. **A blank stored value is not a token.** A value that is empty or
   whitespace-only in either store is treated as absent, so a corrupted or
   empty entry produces the token screen rather than an
   `Authorization: Bearer ` header. Save-side validation is deliberately not
   added — the caller already rejects a blank paste, and inventing an error
   path here would be speculative.

The module must not reference `window`, `document`, `navigator`,
`indexedDB` or `localStorage` as values. This is enforced structurally, not
by convention: `tsconfig.test.json:4` and `tsconfig.worker.json:4` both
declare `lib: ["ES2022"]` with no `DOM`, so any such reference fails
`tsc -b`.

**MIRROR**: `# SOURCE: src/shared/request-failure.ts:1-28`

**VALIDATE**: `npm test` (runs the test-first suite the test pair authored
for this module against its in-memory fake; `vitest run` exits non-zero on
any failing assertion)

### Task 2: CREATE src/app/token-storage.ts

**ACTION** (serves AC-A7 — the exempt adapter; no branching worth
asserting): Implement the two ports Task 1 declared, plus the persistence
request:

- `durableTokenStorage: DurableTokenStorage` — an IndexedDB-backed
  implementation: open (or create) database `praesto` with a single object
  store, and promise-wrap the `get` / `put` / `delete` requests for the key
  `"praesto.token"`. Reject on the request's `error`, resolve on its
  `success`; no retry, no fallback logic (that belongs to the store).
- `legacyTokenStorage: LegacyTokenStorage` — `window.localStorage`
  `getItem` / `setItem` / `removeItem` against the **same** existing key
  `"praesto.token"` that `src/app/api.ts:11` uses today. This exact key is
  what makes Task 1's migration find the token already stored on the owner's
  Android phone and Windows PC; changing it would silently strand both.
- `requestPersistentStorage(): Promise<void>` — call
  `navigator.storage.persist()` when available, ignore the outcome, and
  never throw. `persist()` protects IndexedDB and Cache Storage from
  eviction; it does not protect Web Storage, which is the whole reason the
  token moves. A denial degrades to unprotected IndexedDB, which is still no
  worse than today.

The module doc must state, in one sentence, that this file is the exempt
adapter under `docs/context/methodology.md`'s browser-API rule and is
verified on the device.

**MIRROR**: `# SOURCE: src/app/api.ts:11-23`

**VALIDATE**:
```bash
set -euo pipefail
grep -q "indexedDB" src/app/token-storage.ts
grep -q "navigator.storage" src/app/token-storage.ts
grep -q '"praesto.token"' src/app/token-storage.ts
npm run check
```
(Positive-presence checks on the three literals this ACTION names verbatim;
`set -euo pipefail` makes any single miss fail the block, and `npm run check`
type-checks the adapter against the DOM lib of `tsconfig.app.json:4`.)

### Task 3: UPDATE src/app/api.ts (delegate to the store, await the 401 clear)

**ACTION** (serves AC-A5, AC-A6): Delete the three `window.localStorage`
accessors. Import `createTokenStore` from `../shared/token-store` and both
ports plus `requestPersistentStorage` from `./token-storage`, instantiate
the store once at module scope, and export three async delegations:
`readToken()`, `saveToken(token)`, `clearToken()`. `getToken` and `setToken`
are **renamed**, not merely made async, on purpose: `getToken() !== null`
would keep compiling against a `Promise` and be silently always-true, so
renaming turns every un-migrated call site into a compile error. Inside
`request()`, replace `const token = getToken()` with
`const token = await readToken()`, and — in the 401 branch, whose shape is
otherwise unchanged — replace `clearToken()` with `await clearToken()` so
the clear completes before `ApiError(401, "Invalid or missing token")` is
thrown and the app reacts to it. Update the file's header doc comment: the
token now lives in IndexedDB behind `src/shared/token-store.ts`, and a 401
still clears it so the app falls back to the token prompt instead of failing
silently. Leave the `ApiError` class, its `classifyRequestFailure`
cross-reference comment, and every task/health function untouched.

**MIRROR**: `# SOURCE: src/app/api.ts:44-57` and
`# SOURCE: src/app/api.ts:11-23`

**VALIDATE**:
```bash
set -euo pipefail
grep -q "await clearToken()" src/app/api.ts
grep -q "await readToken()" src/app/api.ts
if grep -nE "localStorage\.(getItem|setItem|removeItem)" src/app/api.ts; then
  echo "FAIL: src/app/api.ts still reaches Web Storage directly"; exit 1
else
  echo "PASS: no direct Web Storage access remains in src/app/api.ts"
fi
npm run check
```
(The two positive greps are the literals this ACTION prescribes
byte-for-byte. The negative grep targets the three unambiguous *code* forms
of Web Storage access — never the bare word `localStorage`, which the file's
own doc comment legitimately mentions in prose.)

### Task 4: UPDATE src/app/App.tsx (three-valued token gate, awaited save)

**ACTION** (serves AC-A6, AC-A8): Carry the sync→async ripple in the one
component that consumed the synchronous accessor. Change `App`'s state to
`useState<boolean | null>(null)`, where `null` means "still checking", and
resolve it in a mount effect that calls `readToken()` and sets
`token !== null`. While the state is `null`, render a neutral placeholder —
**not** `TokenGate`; showing the token screen before the store has answered
would make the token screen flash on every cold start, which is the exact
failure AC-2 forbids. Render `TokenGate` only on an explicit `false`, and
`TaskBoard` on `true`. In `TokenGate`, make the submit handler async: keep
the `value.trim()` / `if (!token) return` guard byte-identical, then `await
saveToken(token)` before calling `onAuthorized()`. `TaskBoard` and its
`handleFailure` 401 short-circuit (`cause instanceof ApiError &&
cause.status === 401` → `onUnauthorized()`) are unchanged — that path is
what returns the app to the gate and this phase must not weaken it.

**MIRROR**: `# SOURCE: src/app/App.tsx:24-31` and
`# SOURCE: src/app/App.tsx:40-49`

**VALIDATE**:
```bash
set -euo pipefail
grep -q "readToken" src/app/App.tsx
grep -q "saveToken" src/app/App.tsx
grep -q "onUnauthorized()" src/app/App.tsx
npm run check
```
(`npm run check` is the real gate here: `tsc -b` fails on any remaining
synchronous use of the renamed accessors, and ESLint's rules catch a
floating promise in the effect. The greps confirm the three identifiers this
ACTION names are present, including the preserved 401 exit.)

### Task 5: UPDATE src/app/main.tsx (request persistent storage at startup)

**ACTION** (serves AC-A7): Import `requestPersistentStorage` from
`./token-storage` and call it in the existing after-render startup block,
next to `setupPwa`, with a comment stating that it is best-effort and that
its denial degrades to unprotected IndexedDB rather than breaking anything.
It must not be awaited before render and must not gate the token read — a
slow or denied `persist()` must never delay the first paint. The
share-target and `/new-task` pathname handling above it is untouched.

**MIRROR**: `# SOURCE: src/app/main.tsx:26-41`

**VALIDATE**:
```bash
set -euo pipefail
grep -q "requestPersistentStorage" src/app/main.tsx
npm run check
npm run build
```
(`npm run build` is the end-to-end compile gate for the browser target: it
runs `tsc -b` across every project and then bundles the real app, so an
adapter that does not type-check against the DOM lib, or a shared module
that accidentally references a browser global, fails here with a non-zero
exit.)

## Validation Commands

**Level 1 — STATIC_ANALYSIS**
```bash
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` — real
exit code. This is also the structural DOM-freedom gate for
`src/shared/token-store.ts`: `tsconfig.test.json:4` and
`tsconfig.worker.json:4` compile `src/shared` under `lib: ["ES2022"]` with
no `DOM`, so a browser global in the shared module is a type error, not a
style opinion.)

**Level 2 — UNIT_TESTS / CONTENT_INVARIANTS**
```bash
npm test
```
(Vitest inside workerd. Must report strictly more than the 31 tests across 4
files that were green before this phase, and no pre-existing test file may
have been weakened. `vitest run` exits non-zero on any failing test.)

```bash
set -euo pipefail
grep -q "await clearToken()" src/app/api.ts
grep -q "await readToken()" src/app/api.ts
grep -q "requestPersistentStorage" src/app/main.tsx
grep -q "createTokenStore" src/shared/token-store.ts
if grep -rnE "localStorage\.(getItem|setItem|removeItem)" src/app/api.ts src/app/App.tsx src/shared/; then
  echo "FAIL: Web Storage is still reached outside the adapter"; exit 1
else
  echo "PASS: Web Storage is reached only from src/app/token-storage.ts"
fi
```
(Every literal above is prescribed byte-for-byte by Tasks 1, 3 and 5's own
`**ACTION**` prose — none is a guessed pattern. The negative check pins the
architectural claim this phase makes: after it, exactly one file touches Web
Storage, and it is the adapter.)

**Level 3 — INTEGRATION**
```bash
npm run build
```
(Full browser-target compile + bundle: `tsc -b` across all project
references, then Vite. Non-zero on any type error in the adapter or any
cross-boundary import.)

MANUAL (the exempt slice — no browser/e2e tier exists per
`docs/context/testing.md`, and per `docs/context/methodology.md` the adapter
is verified on the device and the verification is recorded in the roadmap's
delivery-history entry). On the owner's **Android phone** and **Windows PC**,
after deploying:

1. **Migration, on a device that already holds a token** (the real starting
   state on both): open the updated app. Confirm the token screen does NOT
   appear and the Task list loads — the `localStorage` token was migrated,
   not stranded (AC-A2, AC-A8). In DevTools, confirm the IndexedDB entry now
   exists and the `localStorage` `praesto.token` key is gone.
2. **Restart survival:** fully close the installed PWA and reopen it.
   Confirm the token screen does not appear (PRD AC-2).
3. **Persistence granted:** in DevTools, evaluate
   `navigator.storage.persisted()` and record whether it returns `true`.
   A `false` is not a failure of this phase — it is the PRD's documented
   `persist()`-denied degradation, and it is recorded rather than hidden
   (Open Question 2).
4. **Storage pressure, if reachable:** use the browser's "Clear site data"
   / storage-eviction controls to force eviction, and record what actually
   happened. If the browser offers no way to simulate eviction without
   wiping everything, record that the check could not be performed rather
   than claiming it passed.
5. **401 still returns to the gate:** invalidate the token (rotate the
   Worker secret, or edit the stored value) and trigger any request.
   Confirm the app returns to the token screen, and that pasting the correct
   token once restores normal use without a second prompt (AC-A5, AC-A6).
6. **Fresh install:** confirm a device with no stored token still shows the
   token screen and accepts a paste — the recovery path is unchanged.

## Acceptance Criteria

- **AC-A1 (PRD AC-2):** Given the durable store holds a token, when the
  store's `read()` is called, then that token is returned and the legacy
  store is not consulted.
- **AC-A2 (PRD AC-2):** Given a token exists only in the legacy store (the
  real state of the owner's phone and PC today), when `read()` is called,
  then the token is returned, copied into the durable store, and removed
  from the legacy store — and a second `read()` is served by the durable
  store alone.
- **AC-A3 (PRD AC-2):** Given the durable write fails during that migration,
  when `read()` is called, then the token is still returned and the legacy
  copy is left intact, so the only stored copy is never destroyed by a
  failed migration.
- **AC-A4 (PRD AC-2):** Given the durable store is unavailable (its
  operations reject), when `save()` is called, then the token is written to
  the legacy store instead, so the owner is not re-prompted on the next
  launch — today's behaviour is the floor this phase must not fall below.
- **AC-A5 (PRD AC-2):** Given a 401 clears the token, when `clear()` runs,
  then BOTH stores are cleared and the call never rejects — so the next
  `read()` cannot resurrect a stale legacy token via the migration path, and
  the app's route back to the token screen cannot be broken by a storage
  error.
- **AC-A6 (PRD AC-2):** Given the token accessors are now asynchronous, when
  `request()` builds a call, then it awaits the stored token before sending
  and awaits the clear before throwing `ApiError(401)`; the existing
  401-clears-token-and-return-to-the-gate behaviour is preserved exactly, not
  weakened.
- **AC-A7 (PRD AC-2):** Given the app starts, when startup completes, then
  persistent storage has been requested once via
  `navigator.storage.persist()` and the token is stored in IndexedDB — the
  storage class `persist()` actually protects, unlike Web Storage. Verified
  on the device (manual steps 2-4), not by asserting that a mock was called.
- **AC-A8 (PRD AC-2):** Given the stored-token check is now asynchronous,
  when the app is opened, then the token screen is never rendered while that
  check is still pending — it appears only after the store has explicitly
  reported no token.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The one-time migration silently strands the token already on the owner's two devices, costing the exact re-pastes this phase exists to prevent | Medium | High | The legacy port reads the same `"praesto.token"` key `src/app/api.ts:11` uses today (Task 2), the migration is AC-A2 and AC-A3 in the test-first suite, and manual step 1 verifies it on a device that really holds the old token before anything is declared done |
| `navigator.storage.persist()` is denied by the browser (PRD Technical Risks) | Low | Low | Degrades to unprotected IndexedDB — still strictly better than `localStorage`, which `persist()` never protected. Manual step 3 records the actual answer instead of assuming it; PRD Open Question 2 stays open with real data |
| IndexedDB is unavailable or blocked, so the token cannot be stored durably at all | Low | Medium | The store falls back to the legacy write (AC-A4) rather than silently persisting nothing; today's behaviour is the floor |
| The sync→async ripple leaves a call site un-awaited, producing an always-truthy `Promise` check that silently authorizes | Low | High | `getToken`/`setToken` are renamed to `readToken`/`saveToken` (Task 3), so every un-migrated call site is a compile error rather than a silent bug; `npm run check` and `npm run build` are the gates |
| The token screen flashes on every cold start while the async read resolves | Medium | Medium | AC-A8 and Task 4's three-valued gate: the token screen renders only on an explicit `false`, never while the read is pending. Manual steps 1-2 confirm it on device |
| Reinstalling the PWA clears storage and the token must be pasted again (PRD Technical Risks) | Low | Low | Accepted as recovery, not regression — the token screen remains the fallback path (manual step 6) |
| The adapter is exempt from automated tests, so a defect in it reaches the device | Medium | Medium | The adapter is deliberately branch-free — every decision lives in the tested store — and the manual device protocol above is specific, per-step and reported honestly (including steps that could not be performed), per `docs/context/testing.md` |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd`
in `docs/context/methodology.md`: **true**. Test-first ordering — the test
pair (test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

- **This phase's split is the whole point of it.** It was `blocked` from
  2026-08-05 to 2026-08-11 precisely because browser-storage work has no
  honest test-first path in a workerd-only tier. The owner's resolution —
  extract the logic behind a port, test it against an in-memory fake, exempt
  only the adapter — is binding, and this plan implements it literally:
  AC-A1 through AC-A5 are all reachable from `test/token-store.test.ts` with
  no browser present, and AC-A7 is the only criterion routed to manual
  device verification.
- **Where the line falls, stated explicitly so it can be checked:**
  everything that decides *what happens* (preference order, migration,
  clear-both, degradation, blank handling) is in `src/shared/token-store.ts`
  and is tested. Everything that decides *how bytes reach storage* (the
  IndexedDB request plumbing, `window.localStorage` calls,
  `navigator.storage.persist()`) is in `src/app/token-storage.ts` and is
  not. If the test pair reports `AMBIGUOUS` because a criterion needs a
  browser API, the correct response is to move more logic into the store —
  not to widen the exemption.
- **No test asserts that `persist()` was called.** That is a trivial
  assertion over a mock with no discriminative content, and the PRD names it
  as something the test reviewer would rightly flag (`R-TRIVIAL-ASSERT`).
  The `persist()` call is a device-verified fact.
- **The clear-both rule is not tidiness.** It is the one place where the
  migration feature and the 401 feature can actively fight: clearing only
  the durable copy would let the next read migrate the stale legacy token
  straight back in, producing a 401 loop the owner would experience as "the
  token screen keeps coming back" — the very symptom AC-2 is written
  against. It is called out here so a future simplification does not remove
  it as redundant.
- **No in-memory token cache was added.** `request()` reads from IndexedDB
  on every call rather than caching the token in a module variable. A cache
  would need invalidation on the 401 path and would add state the tests
  would have to cover; an IndexedDB point read is sub-millisecond and the
  app makes few requests. Recorded so the omission reads as a decision, not
  an oversight.
- **Research grounding was done inline by the main session** rather than
  through the `research-codebase` / `research-web` subagents, following the
  same explicit instruction and the same precedent recorded in the source
  PRD's own Research Summary. Every `# SOURCE:` anchor above is a real
  file:line read in this session, and the two external facts this plan
  leans on (`persist()` covers IndexedDB and Cache Storage but not Web
  Storage; `share_target`/storage behaviour on Android) are already cited
  with their MDN and web.dev sources in the source PRD's Market Context
  section rather than re-derived here.

*Generated: 2026-08-11*
*Approved: 2026-08-11*
*Implemented: 2026-08-11*
*Status: IMPLEMENTED*
