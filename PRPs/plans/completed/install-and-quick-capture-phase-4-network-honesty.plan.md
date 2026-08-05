# Feature: Network honesty (Phase 4 of install-and-quick-capture)

```
**Decision Gate**
- Active context: none (no `.context.md` file in the repository)
- Activated criteria: client-side error-handling change (`src/app/App.tsx`);
  new pure module under `src/shared/` (`src/shared/request-failure.ts`);
  explicit anti-offline-write-queue boundary
- Decisions found:
  - ADR-0003 — single canonical D1 store; "explicit server-unreachable UX"
    is the binding safeguard named alongside "no offline write queue";
    `POST /api/tasks` is unaffected by this phase
  - ADR-0005 — React 19 SPA, no meta-framework/SSR; `src/shared/` stays
    DOM-free and is dual-compiled into both the browser and Worker targets
  - ADR-0001 — every artifact in English
  - ADR-0008 — test-first methodology (`tdd: true`); the PRD's own TDD
    Routing note scopes test-first to pure `src/shared` logic, which this
    phase's classifier is
- Applicable anti-patterns:
  - Offline write queue — FORBIDDEN and directly implicated: this phase's
    entire purpose is the explicit-failure alternative to queuing; no
    retry, no local persistence, no silent replay is introduced anywhere
    in this plan
  - Hand-duplicated entity types — not implicated; no new entity/payload
    shape is introduced
  - Meta-framework / SSR / RSC — not implicated
  - Glossary synonym drift — not implicated; no new domain term
  - Portuguese in artifacts
- Applicable architectural rules:
  - One Worker serves the SPA assets, `/api/*` and the cron — this phase
    is entirely client-side; no Worker route changes
  - The wire contract lives in `src/shared/api.ts`; `src/shared/` compiles
    into both the browser and the Worker, so the new classifier module
    must stay DOM-free (confirmed by `tsconfig.test.json`'s `include`
    list, which does not include `src/app`)
  - Every `/api/*` route requires the bearer token; the existing
    401-clears-token path (`src/app/api.ts:45-48`) is preserved untouched
    by this phase
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/install-and-quick-capture.prd.md` — Implementation Phases row
  4: "Network honesty" — Goal: an unreachable server produces an explicit
  state and loses no typed text — Success signal: covers AC-4
  (`PRPs/prds/install-and-quick-capture.prd.md:263, 290-292`).

## Summary

This phase closes the gap between "the server responded with an error"
and "the server could not be reached at all," which today collapse into
the same undifferentiated `error` state carrying whatever raw,
browser-specific message the failure happened to produce. It adds one
pure, DOM-free classifier (`src/shared/request-failure.ts`) that
structurally distinguishes an HTTP-level failure (a numeric `status`
field — the exact shape `ApiError` already carries) from a network-level
failure (a raw `fetch()` rejection, which per MDN never carries a status
because no response was ever received), wires it into `App.tsx`'s
existing single failure sink (`handleFailure`), and locks in — via an
explicit doc comment, not new logic — the pre-existing control-flow fact
that the capture form's `setTitle("")` only runs after a successful save,
so a failed save of any kind never clears what the owner typed. No
offline write queue, no retry, no local persistence is introduced
anywhere: failure is reported, once, honestly, and immediately.

## User Story

As the owner, I want an unmistakable, honest message when Praesto cannot
reach the server — distinct from a message saying the server rejected my
request — and I want to see my typed task exactly as I left it, so that I
can trust the app is telling me the truth and never forces me to retype
something I already wrote.

## Problem Statement

Today, any failed request — whether the server never responded at all or
responded with an error status — collapses into the same generic `error`
state carrying whatever raw message the failure happened to produce (a
browser-specific `fetch()` `TypeError` for network failures, or a
server-derived message for HTTP errors). Nothing tells the owner
explicitly that the server is unreachable versus that his request was
rejected, and nothing in the codebase currently asserts, as a tested
contract, that a failed save leaves his typed text intact — it does
today, but only as an accident of statement ordering, with no test or
comment protecting it from regressing.

## Solution Statement

Add a pure classifier that turns any caught request failure into one of
two discriminated, stable, honest messages — "server unreachable" or
"the server rejected the request (status N)" — using structural typing (a
numeric `status` field) rather than an `instanceof ApiError` check,
because `src/shared/` cannot import from `src/app/` (`tsconfig.test.json`'s
test project excludes `src/app`, and `src/shared` is dual-compiled into
the Worker target, where no `ApiError` class exists at all). Wire the
classifier into `App.tsx`'s `handleFailure`, the single sink every
mutating action and the initial `refresh()` already route through, so one
edit covers every failure path uniformly. Leave the capture form's
save/clear sequencing untouched — it already preserves typed text on
failure — and instead lock that fact in explicitly with a code comment,
exactly as Phase 3 did for the pre-existing autofocus behavior.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Small |
| Systems Affected | Client error handling (`src/app/App.tsx`), new pure module (`src/shared/request-failure.ts`), documentation cross-reference (`src/app/api.ts`) |
| Dependencies | Phase 1 (PRD row 4 `Depends: 1`) — `complete` |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/install-and-quick-capture.prd.md:263, 290-292` (Phase 4 — Network honesty) |
| phase_type | feature |

(`docs/context/methodology.md` declares `figma_track: false`, so no
`design_source` row is added — this table is unchanged from the
pre-Figma-track shape. The source PRD has no `## Visual-First Mode`
section, so no `phase_scope` row is added either.)

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/app/api.ts` | 25-33 | `ApiError`'s exact shape (`status: number`) — the structural signature the new classifier duck-types against instead of importing the class |
| P0 | `src/app/api.ts` | 35-60 | `request()` — confirms the only two failure shapes it can produce: a thrown `ApiError` (a response was received) or a propagated raw `fetch()` rejection (no response was ever received) |
| P0 | `src/app/App.tsx` | 78-87 | `handleFailure` — the exact function this phase extends; the existing 401 short-circuit must stay untouched |
| P0 | `src/app/App.tsx` | 102-112 | `run()` — confirms `handleFailure` is the single sink for every mutating action and for `refresh()`, so one edit covers every failure path |
| P0 | `src/app/App.tsx` | 121-134 | The capture form's submit handler — `setTitle("")` is sequenced strictly after the awaited `createTask(...)` call, which is why typed text already survives a failed save today |
| P0 | `src/shared/share-target.ts` | 1-14 | The established DOM-free, dual-compiled module-doc convention this phase's new classifier module must follow |
| P0 | `tsconfig.test.json` | 1-9 | `include` lists `test`, `src/worker`, `src/shared` — NOT `src/app` — the concrete reason the classifier cannot import `ApiError` and must use structural typing instead |
| P1 | `test/share-target.test.ts` | 1-53 | Precedent test-file shape for a pure `src/shared` module under the workerd-only Vitest tier — the pattern test-writer is expected to follow for the new classifier's suite |
| P1 | `docs/context/testing.md` | 51-77 | Confirms the only automated test tier is Vitest inside workerd, with no browser/DOM tier — this phase's DOM-visible behavior (message rendering, typed-text preservation) is verified manually |
| P1 | `docs/anti-patterns.md` | 12-17 | "Offline write queue" — FORBIDDEN; the binding constraint this entire phase exists to honor instead of violate |
| P2 | `PRPs/plans/completed/install-and-quick-capture-phase-3-shortcut-and-focused-capture.plan.md` | 293-320 | Precedent for locking a pre-existing, unmodified behavior in place with an explicit code comment rather than new logic (Phase 3's Task 3, mirrored here by this phase's Task 3) |

## Patterns to Mirror

```
# SOURCE: src/shared/share-target.ts:1-14
/**
 * Parser for a `share_target` GET invocation's query string.
 *
 * Like `src/shared/api.ts`, this module is compiled into BOTH the browser
 * and the Worker projects, so it must stay environment-agnostic and free of
 * runtime dependencies and DOM globals (no `window`, no `document`) — the
 * detection/dispatch of the actual share-target invocation lives in
 * `src/app/main.tsx`, not here.
 */

/** Result of a successful share-target parse: a single usable title. */
export interface ShareTarget {
  title: string;
}
```
Copied by: Task 1 (`src/shared/request-failure.ts`'s own module doc comment
states the same DOM-free, dual-compile constraint, plus explains why it
structurally types rather than importing `ApiError`).

```
# SOURCE: src/app/api.ts:25-33
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
```
Copied by: Task 1 (the classifier's structural check for a numeric `status`
field duck-types this exact shape without importing the class) and Task 4
(the doc comment cross-references this class directly).

```
# SOURCE: src/app/App.tsx:78-87
const handleFailure = useCallback(
  (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return;
    }
    setError(cause instanceof Error ? cause.message : "Unexpected error");
  },
  [onUnauthorized],
);
```
Copied by: Task 2 (this exact function's non-401 fallback branch is
replaced with a call to `classifyRequestFailure(cause).message`; the 401
short-circuit above it stays byte-identical).

```
# SOURCE: src/app/App.tsx:102-112
async function run(action: () => Promise<unknown>) {
  setBusy(true);
  try {
    await action();
    await refresh();
  } catch (cause) {
    handleFailure(cause);
  } finally {
    setBusy(false);
  }
}
```
Copied by: Task 2 (confirms `handleFailure` is the single choke point for
both create/mutate actions and `refresh()`, so wiring the classifier there
covers every failure path uniformly — AC-A5).

```
# SOURCE: src/app/App.tsx:121-134
<form
  style={styles.row}
  onSubmit={(event) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    void run(async () => {
      await createTask({ title: trimmed });
      setTitle("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    });
  }}
>
```
Copied by: Task 3 (the doc comment locking in the typed-text-preserved
invariant is placed directly above the `setTitle("")` line inside this
exact handler; no functional change).

```
# SOURCE (research-web, MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
"A fetch() promise only rejects when the request fails, for example,
because of a badly-formed request URL or a network error. A fetch()
promise does not reject if the server responds with HTTP status codes
that indicate errors (404, 504, etc.)."
```
Copied by: Task 1 (this is the exact boundary the classifier's structural
check relies on — a network failure never produces a `status`, because no
`Response` was ever received to read one from).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/request-failure.ts` | CREATE | Pure, DOM-free classifier distinguishing a fetch-level network failure ("server unreachable") from a received HTTP-level error response, producing a stable, honest, user-facing message for each — this phase's test-first unit. Must live under `src/shared/` rather than `src/app/` because `tsconfig.test.json`'s test project excludes `src/app` (AC-A1, AC-A2) |
| `src/app/App.tsx` | UPDATE | Wire the classifier into `handleFailure`'s non-401 branch (AC-A1, AC-A2, AC-A3, AC-A5), and add a doc comment locking in the pre-existing "typed text preserved on failure" invariant next to the submit handler's `setTitle("")` sequencing (AC-A4) |
| `src/app/api.ts` | UPDATE | Documentation-only: cross-reference `classifyRequestFailure` on `ApiError`'s doc comment so a future change to `ApiError`'s shape does not silently desynchronize from the classifier's structural check (infrastructure) |

## NOT Building (Scope Limits)

- **Offline write queue.** Forbidden PRD-wide (`docs/anti-patterns.md`,
  ADR-0003); this phase's job is the honest alternative — report failure
  immediately, never queue, silently retry, or persist a pending write
  locally.
- **Durable token storage.** Phase 2, `blocked` by owner decision (Open
  Question 4); unrelated — the 401 short-circuit this phase leaves
  untouched already routes back to the token screen.
- **The `share_target` and `shortcuts` manifest entry points.** Phases 1
  and 3, already shipped and `complete`.
- **Voice capture through Google Assistant.** Structurally out of reach
  for a PWA (ADR-0004); unaffected either way.
- **Anything about delivery.** Today view, reminders, push, search belong
  to other roadmap units.
- **A magic link carrying the token in the URL.** Rejected PRD-wide.
- **Multi-user anything.** One user, one token (ADR-0003, CON-002).
- **A generic global error-boundary or toast library.** No such
  dependency exists in the repo today (ADR-0005 minimal-stack
  preference); this phase reuses the existing `error` state and
  `<p style={styles.error}>` rendering in `App.tsx`, unchanged.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/request-failure.ts

**ACTION** (serves AC-A1, AC-A2): Add a pure, DOM-free
`classifyRequestFailure(cause: unknown): { kind: "server-unreachable" | "http-error"; message: string }`.
Structurally check whether `cause` is an object carrying a numeric
`status` field (the shape `ApiError` has — duck-typed rather than
imported, since `src/shared/` cannot import from `src/app/`:
`tsconfig.test.json`'s test project `include`s `test`, `src/worker` and
`src/shared` but not `src/app`). When it does, classify as `"http-error"`
with a message naming the status (e.g. "The server rejected the request
(status 500)."). When it does not (a raw `fetch()` rejection — per MDN,
`fetch()` only rejects on a genuine network failure and never produces a
`status`, since no `Response` was ever received), classify as
`"server-unreachable"` with a message stating the server could not be
reached and nothing was lost. No DOM globals (`window`, `document`) may
appear in this file, matching the constraint stated at the top of
`src/shared/share-target.ts`.

**MIRROR**: `# SOURCE: src/shared/share-target.ts:1-14` and
`# SOURCE: src/app/api.ts:25-33`

**VALIDATE**: `npm test` (runs the test-first suite test-writer authors
for this file inside Vitest/workerd; exits non-zero on any failing
assertion)

### Task 2: UPDATE src/app/App.tsx (wire classifier into handleFailure)

**ACTION** (serves AC-A1, AC-A2, AC-A3, AC-A5): Import
`classifyRequestFailure` from `../shared/request-failure` and, inside
`handleFailure`, after the existing
`cause instanceof ApiError && cause.status === 401` short-circuit
(unchanged, still calling `onUnauthorized()`), replace the generic
`setError(cause instanceof Error ? cause.message : "Unexpected error")`
fallback with `setError(classifyRequestFailure(cause).message)`. Because
`handleFailure` is the single sink both `run()` (create/complete/delete/
reopen) and `refresh()` route every failure through, this one edit covers
every failure path uniformly (AC-A5): a network-unreachable failure
during the initial `refresh()` on mount also gets the explicit message,
and `tasks` stays `null` so the existing
`{tasks === null && error === null && ...}` Loading guard does not
silently render as an empty list.

**MIRROR**: `# SOURCE: src/app/App.tsx:78-87` and
`# SOURCE: src/app/App.tsx:102-112`

**VALIDATE**: `npm test && npm run check`

### Task 3: UPDATE src/app/App.tsx (lock in the typed-text-preserved invariant)

**ACTION** (serves AC-A4): Directly above the submit handler's
`setTitle("")` call (`src/app/App.tsx`, inside the capture `<form>`'s
`onSubmit`), add a doc comment stating explicitly that `setTitle("")` is
deliberately sequenced AFTER the awaited `createTask(...)` call — never
before or unconditionally — so that a thrown failure (network-unreachable
or HTTP-level, both now surfaced by Task 2's classifier) exits before
this line runs and the owner's typed text remains in the input's
`value={title}` binding. The comment must contain the literal phrase
"typed text is not lost", satisfied by PRD AC-4's wording, so it is
mechanically checkable. This is a documentation-only change locking in
pre-existing, byte-identical control flow — mirrors Phase 3's Task 3
pattern of recording an existing invariant explicitly in code rather than
leaving it implicit.

**MIRROR**: `# SOURCE: src/app/App.tsx:121-134`

**VALIDATE**:
```bash
if grep -q "typed text is not lost" src/app/App.tsx; then
  echo "PASS: typed-text-preserved invariant comment present"
else
  echo "FAIL: typed-text-preserved invariant comment missing above setTitle(\"\")"
  exit 1
fi
```
Chained with `npm run check` to confirm the comment addition introduces
no type/lint/format violation:
```bash
npm run check
```

### Task 4: UPDATE src/app/api.ts (cross-reference doc comment)

**ACTION** (infrastructure — locks the structural coupling
`classifyRequestFailure` relies on; introduces no new user-facing
behavior): Add a doc comment directly above the `ApiError` class stating
that `src/shared/request-failure.ts`'s `classifyRequestFailure`
distinguishes an HTTP-level failure from a network-unreachable one purely
by the presence of a numeric `status` field (duck-typing, since
`src/shared/` cannot import `ApiError` — see Task 1), so any future
change to `ApiError`'s shape must preserve `status: number` or update the
classifier in lockstep. The comment must contain the literal identifier
`classifyRequestFailure`, matching the name Task 1 exports and Task 2
imports.

**MIRROR**: `# SOURCE: src/app/api.ts:25-33`

**VALIDATE**:
```bash
if grep -q "classifyRequestFailure" src/app/api.ts; then
  echo "PASS: ApiError doc comment cross-references classifyRequestFailure"
else
  echo "FAIL: ApiError doc comment missing cross-reference to classifyRequestFailure"
  exit 1
fi
```
Chained with `npm run check`.

## Validation Commands

**Level 1 — STATIC_ANALYSIS**
```bash
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` —
real exit code, fails on any type/lint/format violation, including a
cross-boundary import of `src/app` into `src/shared`.)

**Level 2 — CONTENT_INVARIANTS / UNIT_TESTS**
```bash
npm test
```
(Vitest inside workerd; includes the test-first suite for
`src/shared/request-failure.ts`. Real exit code — `vitest run` exits
non-zero on any failing test.)

```bash
if grep -q "classifyRequestFailure" src/app/App.tsx \
   && grep -q "typed text is not lost" src/app/App.tsx \
   && grep -q "classifyRequestFailure" src/app/api.ts; then
  echo "PASS: handleFailure wiring, typed-text invariant comment, and ApiError cross-reference all present"
else
  echo "FAIL: one or more of the required wiring/comment markers is missing"
  exit 1
fi
```
(Content-invariant check grounded in the literal identifiers/phrases
Tasks 2-4's own `**ACTION**` prose names — not a guessed pattern.)

**Level 3 — INTEGRATION (dry-run, partially manual)**

Automatable part — confirms this environment's `fetch()` actually rejects
(with no numeric `status`) against an unreachable server, the exact
assumption `classifyRequestFailure` depends on (MDN finding above), with
a real exit code:
```bash
node -e "
fetch('http://127.0.0.1:1', { signal: AbortSignal.timeout(2000) })
  .then(() => { console.error('FAIL: expected fetch() to reject against an unreachable port'); process.exit(1); })
  .catch((err) => {
    if (err instanceof TypeError || err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      console.log('PASS: fetch() rejects with no numeric status against an unreachable server');
      process.exit(0);
    }
    console.error('FAIL: unexpected rejection shape:', err);
    process.exit(1);
  });
"
```

MANUAL (no browser/e2e tier exists per `docs/context/testing.md`; these
behaviors are DOM-rendered/device-dependent and are verified by hand on
the owner's devices, consistent with the PRD's own TDD Routing note):
1. On the owner's Android phone, with Praesto open, enable airplane mode,
   type text into the capture field, tap Save: confirm the explicit
   "server unreachable" message appears and the typed text remains in
   the field (AC-A1, AC-A4). Disable airplane mode and tap Save again
   with the same, still-present text: confirm it now saves successfully.
2. Temporarily provoke a real HTTP error response (e.g. a deliberately
   wrong path, or a Worker-side 500) and confirm the resulting message
   names the status and is visibly distinct from the "server unreachable"
   message from step 1 (AC-A2).
3. Confirm the 401 case (an invalid/cleared token) still returns to the
   token screen exactly as before this phase (AC-A3) — unaffected by
   Task 2's edit.

## Acceptance Criteria

- **AC-A1 (PRD AC-4):** Given `createTask` (or any mutating call, or the
  initial `refresh()`) fails because `fetch()` itself rejects (the server
  is unreachable — per MDN, `fetch()` only rejects on a genuine network
  failure, never on an HTTP error status), `classifyRequestFailure`
  classifies the cause as `"server-unreachable"` and returns a message
  stating the server could not be reached; `handleFailure` sets it into
  `error` state and it renders.
- **AC-A2 (PRD AC-4):** Given the same call instead fails with a received
  non-401 HTTP error response (an `ApiError`-shaped cause carrying a
  numeric `status`), `classifyRequestFailure` classifies it as
  `"http-error"` and returns a message naming the status — visibly
  distinct from the "server unreachable" message, so the owner is told
  the server responded, just not successfully.
- **AC-A3 (PRD AC-4):** The existing 401 special case
  (`cause instanceof ApiError && cause.status === 401` → `onUnauthorized()`)
  still runs before the classifier and is unaffected — this phase changes
  only the non-401 fallback branch of `handleFailure`.
- **AC-A4 (PRD AC-4):** When any save attempt fails for any reason, the
  owner's typed title is not cleared — `setTitle("")` in the capture
  form's submit handler stays sequenced strictly after the awaited
  `createTask(...)` call, so a thrown failure exits before it runs and
  the typed text remains in the input; this pre-existing invariant is
  locked in with an explicit code comment.
- **AC-A5 (PRD AC-4):** The same explicit, honest failure handling
  applies uniformly to `refresh()` failures (loading the list), not only
  to saves — since both routes share `handleFailure`, an unreachable
  server on initial load shows the explicit message rather than a false
  empty list (`tasks` stays `null`; the existing
  `{tasks === null && error === null && ...}` Loading guard does not fire
  when `error` is set).

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Browser-specific `fetch()` `TypeError` message text varies (Chrome "Failed to fetch" vs Firefox "NetworkError when attempting to fetch resource.") | Low | Low | The classifier ignores the raw browser message entirely and substitutes its own stable text, so this variance never reaches the UI (research-web finding) |
| The structural `status`-field duck-type could misclassify an unrelated thrown value that happens to carry a numeric `status` property (e.g. a future third-party error shape) | Low | Low | Today's `request()` only ever throws `ApiError` (numeric `status`) or lets a raw `fetch()` failure propagate (no `status`); Task 4's cross-reference comment flags this coupling so it is not silently reused for a different error family later |
| The owner may not promptly exercise the airplane-mode manual verification, leaving AC-4 unverified in practice | Low | Medium | The manual steps are named explicitly in Level 3; per the PRD's own Phase 4 rationale ("smallest change... easiest to verify once the other entry points exist"), this risk is lower here than for earlier phases |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of
`tdd` in `docs/context/methodology.md`: **true**. Test-first ordering —
the test pair (test-writer/test-reviewer) produces the initial test
suite from the Acceptance Criteria above, before the Implementer runs.

- **The judgment this plan had to make honestly:** whether a pure,
  discriminative unit exists here worth isolating into `src/shared/`, the
  way Phase 1's `parseShareTarget` did — or whether, like Phase 3, this
  phase is irreducibly DOM-bound with nothing to test-first.
  `research-codebase` confirmed the answer is genuinely the former this
  time: classifying a caught failure into "server unreachable" vs "the
  server responded with an error" is pure input→output logic with no DOM
  dependency, mirroring `parseShareTarget`'s shape exactly (a pure
  function under `src/shared/`, tested via `test/*.test.ts`). What is
  DOM-bound and stays manual is only the rendering of the resulting
  message and the visible persistence of typed text — not the
  classification decision itself.
- Scope boundary this plan follows: test-first here targets Task 1's pure
  `src/shared/request-failure.ts` classifier only. Tasks 2-4 (wiring,
  doc comments) are DOM-rendered/documentation and are verified manually
  or by content-invariant grep, per `docs/context/testing.md` and the
  PRD's own TDD Routing note — this is the `EXISTING_COVERAGE_SUFFICIENT`
  / no-test-required path for those tasks, not a violation.
- The classifier deliberately uses structural typing (a numeric `status`
  field) instead of `cause instanceof ApiError`, because `src/shared/` is
  compiled into both the browser and Worker targets and cannot depend on
  `src/app/api.ts` — confirmed non-heuristically by `tsconfig.test.json`'s
  `include` list, which omits `src/app` entirely. This is the same
  boundary `docs/context/architecture.md`'s "per-target tsconfigs ...
  make an app/worker boundary violation a compile error" describes.
- `research-web` surfaced React 19's `useOptimistic`/`useActionState` as
  a built-in alternative for this class of problem, but its documented
  use cases center on Server Actions/RSC, which ADR-0005 and
  `docs/anti-patterns.md` ("Meta-framework / SSR / RSC") explicitly
  exclude for this project; not adopted here — flagged so a future
  session does not silently reach for it against a client-only SPA.
- `research-web` also surfaced offline-UX literature (e.g. Expensify's
  OFFLINE.md) built around greyed-out pending items and local
  save-without-submit — both assume some form of local persistence of an
  unsent write, which this project's "no offline write queue" rule
  (ADR-0003, `docs/anti-patterns.md`) forecloses; not adopted. This
  phase's "report immediately, preserve the input, never queue" approach
  is the intentionally narrower alternative.
- No PWA-specific precedent combining "honest unreachable-server
  messaging" with "explicitly no write queue" was found by `research-web`
  (most sources assume queuing); this gap is expected given the project's
  own binding constraint is unusual in that literature, not a defect in
  the research pass.

*Generated: 2026-08-05*
*Approved: 2026-08-05*
*Status: IMPLEMENTED*
