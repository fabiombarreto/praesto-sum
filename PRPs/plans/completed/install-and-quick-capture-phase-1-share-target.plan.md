# Feature: Share target (Phase 1 of install-and-quick-capture)

```
**Decision Gate**
- Active context: none (no `.context.md` file in the repository)
- Activated criteria: PWA manifest change (`public/manifest.webmanifest`);
  new SPA entry path (`src/app/main.tsx`); reuse of the Task creation wire
  contract (`CreateTaskInput`)
- Decisions found:
  - ADR-0003 — single canonical D1 store; `POST /api/tasks` already accepts
    a title-only body and is untouched by this phase; no offline write queue
  - ADR-0004 — one installable PWA is the sole interface; the manifest IS
    the app's identity surface, so `share_target` belongs in
    `public/manifest.webmanifest`, not a plugin config option
  - ADR-0005 — React 19 SPA, no meta-framework/SSR; types flow from the
    Drizzle schema through `src/shared/`, which must stay DOM-free
  - ADR-0001 — every artifact in English
- Applicable anti-patterns:
  - Offline write queue — FORBIDDEN; not implicated here (Phase 1 assumes a
    reachable server; the explicit unreachable-server state is Phase 4)
  - Hand-duplicated entity types — the share-target payload must become a
    `CreateTaskInput` and go through the existing `createTask()` wrapper,
    never a hand-written object literal
  - Meta-framework / SSR / RSC — not implicated; no router framework is
    introduced (see `## Notes`)
  - Glossary synonym drift — the captured entity is a Task, never a "todo"
    or "note"
  - Portuguese in artifacts
- Applicable architectural rules:
  - One Worker serves the SPA assets, `/api/*` and the cron — this phase is
    entirely client/manifest-side; `wrangler.jsonc`'s
    `not_found_handling: single-page-application` +
    `run_worker_first: ["/api/*"]` means a new client path needs no Worker
    route
  - The wire contract lives in `src/shared/api.ts`; `src/shared/` compiles
    into both the browser and the Worker, so it must stay DOM-free
  - Every `/api/*` route requires the bearer token — unaffected; capture
    still goes through the existing authenticated `createTask()` call
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/install-and-quick-capture.prd.md` — Implementation Phases row
  1: "Share target" — Goal: sharing text from another app creates the Task
  — Success signal: covers AC-1 and AC-5; payload parsing is pure logic in
  `src/shared`, the part `docs/context/methodology.md` scopes the
  test-first practice to.

## Summary

Register Praesto in Android's share sheet by adding a `share_target`
member to `public/manifest.webmanifest`, and add a small client-side
detection path in `src/app/main.tsx` that reads the shared `title`/`text`/
`url` via a new pure, DOM-free parser (`src/shared/share-target.ts`),
pre-fills the existing Task capture field in `src/app/App.tsx` with the
result, auto-focuses it, and shows a save confirmation. No Worker route
changes: `POST /api/tasks` already accepts a title-only body. An
all-empty share produces no pre-fill and, per the existing emptiness
guard already in `App.tsx`, cannot create a titleless Task.

## User Story

As the owner, I want to share text from any app on my phone directly into
Praesto, so that a thought I cannot afford to forget becomes a saved Task
in about two taps instead of being lost while I open the app and find the
input field myself.

## Problem Statement

Capture still costs opening the app and reaching the input — enough
friction that, in the moments capture actually matters (walking,
mid-task, while reading something on the phone), it does not happen. This
phase removes that friction for the "I'm in the middle of something else
and reading/seeing text I want to keep" case specifically: today there is
no way to hand text to Praesto from another app at all.

## Solution Statement

Add `share_target` to the manifest so Android's share sheet lists Praesto.
Add a pure parser in `src/shared/` that extracts usable text from the
share invocation's `title`/`text`/`url` params (handling the documented
Android quirk where `url` is often empty and the link lands in `text`
instead), returning `null` when nothing usable was shared. Wire that
result through `main.tsx` into `App.tsx`'s existing capture form as a
pre-filled, auto-focused value — reusing the existing `createTask()` /
`CreateTaskInput` path unchanged, and reusing the existing
"empty title → no create" guard for the all-empty case, rather than
adding new guard logic.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Small |
| Systems Affected | PWA manifest (`public/manifest.webmanifest`), SPA bootstrap (`src/app/main.tsx`), capture UI (`src/app/App.tsx`), new pure module (`src/shared/share-target.ts`) |
| Dependencies | None (PRD row 1 `Depends: -`) |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/install-and-quick-capture.prd.md:257-261` (Phase 1 — Share target) |
| phase_type | feature |

(`docs/context/methodology.md` declares `figma_track: false`, so no
`design_source` row is added — this table is unchanged from the
pre-Figma-track shape. The source PRD has no `## Visual-First Mode`
section, so no `phase_scope` row is added either.)

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `public/manifest.webmanifest` | 1-21 | Current manifest shape; `share_target` is added here, scoped under the existing `start_url`/`scope: "/"` |
| P0 | `src/shared/api.ts` | 1-41 | `CreateTaskInput` — the only allowed shape for the create-Task payload; the module doc comment states the DOM-free, dual-compiled constraint the new parser module must also satisfy |
| P0 | `src/app/api.ts` | 62-78 | `createTask()` — the existing typed POST wrapper (auth header, error handling) the share-target flow must call, never a hand-written `fetch` |
| P0 | `src/app/App.tsx` | 22-29, 64-136 | `App()`'s TokenGate/TaskBoard split, and the existing capture `<form>` this phase pre-fills; the `if (!trimmed \|\| busy) return` guard at line 118 is the pattern AC-5 relies on, not new logic |
| P1 | `src/app/main.tsx` | 1-24 | Bootstrap entry point — where a share-target invocation must be detected, before/around `createRoot(...).render(...)` |
| P1 | `vite.config.ts` | 15-41 | `VitePWA({ manifest: false, ... })` confirms `public/manifest.webmanifest` is the single source of truth to edit, not a plugin config option |
| P1 | `wrangler.jsonc` | 11-18 | `not_found_handling: single-page-application` + `run_worker_first: ["/api/*"]` — confirms a new client path needs no Worker change |
| P2 | `test/tasks.test.ts` | 1-37 | Closest existing Vitest pattern (imports, `describe`/`it` shape) for the sibling test file test-writer will add for the new pure parser — adapted to drop the `cloudflare:workers`/D1 fixture, since the parser under test has no Worker dependency |
| P2 | `docs/context/testing.md` | 51-77 | Confirms integration tests run only inside workerd via `npm test`; there is no browser/DOM test tier, so the DOM-touching route wiring in `main.tsx`/`App.tsx` is verified manually while the pure parser is the testable unit |

## Patterns to Mirror

```
# SOURCE: src/shared/api.ts:1-13
/**
 * Wire contract between the PWA and the Worker API.
 *
 * This module is compiled into BOTH the browser and the Worker projects, so it
 * must stay environment-agnostic and free of runtime dependencies — importing
 * the Drizzle schema here would pull the ORM into the SPA bundle. ...
 */
```
Copied by: Task 1 (`src/shared/share-target.ts`'s own module doc comment
states the same DOM-free constraint).

```
# SOURCE: src/shared/api.ts:34-41
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: number | null;
  lifeAreaId?: string | null;
}
```
Copied by: Task 4 (the share-derived title must flow into exactly this
shape, never a hand-written literal).

```
# SOURCE: src/app/api.ts:72-78
export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  const body = await request<{ task: TaskDto }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.task;
}
```
Copied by: Task 4/5 (the share-originated save calls this exact wrapper,
unchanged — no second fetch, no duplicated auth/error logic).

```
# SOURCE: src/app/App.tsx:113-136
<form
  style={styles.row}
  onSubmit={(event) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    void run(async () => {
      await createTask({ title: trimmed });
      setTitle("");
    });
  }}
>
  <input
    style={styles.input}
    value={title}
    onChange={(event) => setTitle(event.target.value)}
    placeholder="What needs doing?"
    aria-label="Task title"
    autoFocus
  />
  ...
```
Copied by: Task 4 (seeding `title` from `initialShare?.title ?? ""` reuses
this exact form/guard; AC-5 is satisfied by this pre-existing guard, not
new logic) and Task 5 (the `run()` call this confirmation hooks into).

```
# SOURCE: public/manifest.webmanifest:1-21
{
  "id": "/",
  "name": "Praesto Sum",
  ...
  "start_url": "/",
  "scope": "/",
  ...
}
```
Copied by: Task 2 (the `share_target` member is added as a new top-level
key in this exact file, scoped under the existing `"scope": "/"`).

```
# SOURCE: vite.config.ts:23-27
// The web app manifest is a static file at public/manifest.webmanifest and
// is linked manually from index.html. Setting this to false prevents the
// plugin from emitting a second manifest.webmanifest that would collide
// with the public/ copy in dist/client.
manifest: false,
```
Copied by: Task 2 (confirms there is no `VitePWA({ manifest: {...} })`
option to use instead — the static file is the only edit point).

```
# SOURCE (research-web, MDN): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
"share_target": {
  "action": "/share-target/",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```
Copied by: Task 2 (current `action`+`params` shape; the older
`url_template` form is superseded). Also informs Task 1: research-web
(Chrome for Developers) documents that on Android the `url` param often
arrives empty and the shared link lands in `text` instead — the parser
must check `text` before falling back to `url`.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/share-target.ts` | CREATE | Pure, DOM-free parser: extracts usable text from a share-target GET query string, handling the Android `url`-often-empty quirk. This is the phase's test-first unit (`docs/context/methodology.md` scopes test-first to pure `src/shared` logic) |
| `public/manifest.webmanifest` | UPDATE | Add the `share_target` member so Android's share sheet lists Praesto (AC-1) |
| `src/app/main.tsx` | UPDATE | Detect a share-target invocation on bootstrap (path/query), parse it via Task 1's function, strip the URL via `history.replaceState`, and pass the parsed result into `<App>` |
| `src/app/App.tsx` | UPDATE | Accept the parsed share result, seed/auto-focus the existing capture field with it, and show a save confirmation (AC-1); the existing emptiness guard already satisfies AC-5 for a `null` result |

## NOT Building (Scope Limits)

- **Voice capture through Google Assistant.** Structurally out of reach
  for a PWA (ADR-0004); unaffected by this phase either way.
- **Offline write queue / explicit unreachable-server UX.** Forbidden
  globally and explicitly Phase 4's concern — this phase relies on
  `TaskBoard`'s existing generic `error`/`handleFailure` state, unchanged.
- **Durable token storage.** Phase 2. The share flow requires an
  already-valid token (AC-1's precondition is "installed and
  authorized") but does not change how or where the token is stored.
- **The `shortcuts` manifest entry and its autofocus deep-link.** Phase 3.
- **Anything about delivery** — today view, reminders, push, search
  belong to other roadmap units, not this PRD.
- **A magic link carrying the token in the URL.** Rejected PRD-wide.
- **Multi-user anything.** One user, one token (ADR-0003, CON-002).
- **A client-side routing library.** No router exists in the repo today
  (confirmed by research-codebase); this phase adds one `window.location`
  check in `main.tsx` rather than a new dependency (see `## Notes`).

## Step-by-Step Tasks

### Task 1: CREATE src/shared/share-target.ts

**ACTION**: Add a pure, DOM-free `parseShareTarget(search: string): { title: string } | null`. It parses `search` (a `?title=...&text=...&url=...`-shaped query string) via `URLSearchParams`, and, per the Android caveat research-web documents (Chrome for Developers: `url` is frequently empty on Android and the shared link lands in `text` instead), prefers `text` when non-empty after trim, else `title`, else `url`. Returns `null` when all three are empty/whitespace after trim — this `null` is exactly what Task 4 needs to satisfy AC-5. No DOM globals (`window`, `document`) may appear in this file — it must stay usable from both the browser and Worker compile targets, matching the constraint stated at the top of `src/shared/api.ts`.

**MIRROR**: `# SOURCE: src/shared/api.ts:1-13` (DOM-free module doc constraint)

**VALIDATE**: `npm test` (runs the test-first suite test-writer authors for this file inside Vitest/workerd; exits non-zero on any failing assertion)

### Task 2: UPDATE public/manifest.webmanifest

**ACTION** (serves AC-A2): Add a top-level `"share_target"` member:
```json
"share_target": {
  "action": "/share-target",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```
Deliberately omit `enctype` — GET's spec default (`application/x-www-form-urlencoded`) is exactly what `URLSearchParams` on the resulting query string already assumes (Task 1). `action` stays inside the manifest's existing `"scope": "/"`, so no scope change is needed.

**MIRROR**: `# SOURCE: public/manifest.webmanifest:1-21` and `# SOURCE: vite.config.ts:23-27`

**VALIDATE**:
```bash
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const st = m.share_target;
if (!st || st.method !== 'GET' || st.action !== '/share-target' ||
    !st.params || st.params.title !== 'title' || st.params.text !== 'text') {
  console.error('FAIL: share_target member missing or malformed');
  process.exit(1);
}
console.log('PASS: share_target member present and well-formed');
"
```

### Task 3: UPDATE src/app/main.tsx

**ACTION** (serves AC-A1, AC-A3 — routing plumbing only; the create/confirm behavior itself is Tasks 4-5): Before `createRoot(container).render(...)`, check `window.location.pathname === "/share-target"`. When true, call `parseShareTarget(window.location.search)` (Task 1) and hold the result; then call `window.history.replaceState(null, "", "/")` to strip the share-target path/query immediately, so a page reload does not re-trigger the pre-fill or resubmit stale params. Pass the (possibly `null`) parsed result into `<App initialShare={parsed} />`. When the pathname does not match, render `<App initialShare={null} />` exactly as today's `<App />`. This detection/parsing step is what makes AC-A1's pre-fill and AC-A3's empty-safe path reachable at all — without it `initialShare` would never be populated (or nulled) from a real share invocation.

**MIRROR**: `# SOURCE: src/app/main.tsx:1-24`

**VALIDATE**: `npm run check` (`tsc -b` catches a mismatched `initialShare` prop type; exits non-zero on any type/lint/format violation)

### Task 4: UPDATE src/app/App.tsx (accept and thread `initialShare`)

**ACTION**: Add an `initialShare: { title: string } | null` prop to `App`, forwarded from `main.tsx` (Task 3). Thread it into `TaskBoard` (only reachable once `authorized` is true, matching AC-1's "installed and authorized" precondition). Seed `TaskBoard`'s `title` state from `initialShare?.title ?? ""` on mount, and keep the existing `autoFocus` on the capture `<input>` so the field opens focused whether pre-filled or empty. When `initialShare` is `null` (Task 1's all-empty case), the field opens exactly as it does today — empty and focused — and the existing `if (!trimmed || busy) return` guard already refuses to call `createTask` on an empty/whitespace title, so AC-5 requires no new guard logic, only correct seeding.

**MIRROR**: `# SOURCE: src/app/App.tsx:113-136`

**VALIDATE**: `npm test && npm run check`

### Task 5: UPDATE src/app/App.tsx (save confirmation)

**ACTION**: Add a lightweight post-save confirmation to `TaskBoard`'s submit handler: after a successful `createTask` call inside `run(...)`, set a `justSaved` (or similarly named) boolean, render a brief confirmation message while it is `true` (e.g. "Saved"), and clear it after a short timeout (~2s) or on the next interaction. This applies to every successful save, not only share-originated ones, and is what satisfies AC-1's "a confirmation is shown" for the share flow specifically. The payload sent to `createTask` stays exactly `{ title: trimmed }`, unchanged from today — still a `CreateTaskInput`, never a hand-written literal shaped like a `TaskDto`.

**MIRROR**: `# SOURCE: src/app/App.tsx:113-136`; `# SOURCE: src/app/api.ts:72-78`

**VALIDATE**: `npm test && npm run check`

## Validation Commands

**Level 1 — STATIC_ANALYSIS**
```bash
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` — real exit code, fails on any type/lint/format violation.)

**Level 2 — CONTENT_INVARIANTS / UNIT_TESTS**
```bash
npm test
```
(Vitest inside workerd; includes the test-first suite for
`src/shared/share-target.ts`. Real exit code — `vitest run` exits
non-zero on any failing test.)

```bash
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const st = m.share_target;
if (!st || st.method !== 'GET' || st.action !== '/share-target' ||
    !st.params || st.params.title !== 'title' || st.params.text !== 'text') {
  console.error('FAIL: share_target member missing or malformed');
  process.exit(1);
}
console.log('PASS: share_target member present and well-formed');
"
```
(Manifest JSON-shape invariant — not covered by Vitest since the manifest
is a static asset, not application code.)

**Level 3 — INTEGRATION (dry-run, partially manual)**

Automatable part — confirms the share-target path actually resolves
through the SPA shell (per `wrangler.jsonc`'s
`not_found_handling: single-page-application`), with a real exit code:
```bash
npm run dev &
DEV_PID=$!
sleep 3
if curl -sf "http://127.0.0.1:5173/share-target?title=Test&text=hello" -o /dev/null; then
  echo "PASS: /share-target resolves via the SPA shell"
  kill "$DEV_PID" 2>/dev/null
else
  echo "FAIL: /share-target did not resolve (200) via the dev server"
  kill "$DEV_PID" 2>/dev/null
  exit 1
fi
```
(Adjust the port if `npm run dev` prints a different one than the Vite
default 5173.)

MANUAL (no browser/e2e tier exists per `docs/context/testing.md`; these
two behaviors are UI-visual and gesture-based and are verified by hand on
the owner's Android device, consistent with the PRD's own TDD Routing
note):
1. Share non-empty text from another installed app, pick Praesto: confirm
   the capture field opens pre-filled with that text, and after tapping
   Save a Task is created with it as the title and a confirmation
   message appears (AC-1).
2. Repeat with empty/whitespace-only shared text: confirm the field opens
   focused and empty, and no Task is created (AC-5).

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** Given Praesto is installed and authorized, when
  the owner shares non-empty text from another app and picks Praesto,
  then `parseShareTarget` extracts that text, the capture field opens
  pre-filled with it, and after Save a Task is created with that text as
  its title and a confirmation is shown.
- **AC-A2 (PRD AC-1):** The `share_target` manifest member correctly
  registers Praesto in Android's share sheet using GET + `params`
  (`title`/`text`/`url`), scoped under the existing `"scope": "/"`,
  requiring no Worker route change.
- **AC-A3 (PRD AC-5):** Given a share-target invocation whose
  `title`/`text`/`url` are all empty or whitespace-only, when the app
  opens, then `parseShareTarget` returns `null`, the capture field opens
  focused and empty, and no Task is created — via the existing
  `if (!trimmed || busy) return` guard, with no new guard logic added.
- **AC-A4 (PRD AC-1):** The created Task's payload is built strictly as a
  `CreateTaskInput` and sent through the existing `createTask()` wrapper
  — never a hand-written object literal shaped like a `TaskDto`
  (`docs/anti-patterns.md` — hand-duplicated entity types).
- **AC-A5 (PRD AC-1):** When a share carries an empty `url` but a
  non-empty `text` (the documented Android quirk where shared links land
  in `text`), `parseShareTarget` still produces a usable title instead of
  an empty capture field.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `share_target` is an experimental, non-Baseline manifest feature (research-web/MDN); behavior can vary across Chrome versions on Android | Low | Medium | Owner's phone is confirmed Android/Chrome (CON-007); the manual Level 3 step catches a non-functional share-sheet entry before this phase is considered done |
| Untrusted shared text lands in the capture `<input>`'s `value` — React escapes it by default there, but a future change that renders it as `href` or via `dangerouslySetInnerHTML` would reopen the layered-encoding gap research-web flagged (OWASP XSS cheat sheet) | Low | Medium | Task 1's parser returns a plain string only, never markup; Task 4 keeps it inside a controlled `<input value=...>`, never an anchor or raw-HTML sink — stated explicitly here so it is not silently reintroduced later |
| No client-side router exists in the repo (research-codebase gap); this phase detects the share-target invocation with a one-off `window.location` check in `main.tsx` rather than adding a routing dependency | Medium | Low | Consistent with ADR-0005's minimal-stack preference; if Phase 3's shortcut deep-link needs the same detection shape, `main.tsx`'s pattern is the one to extend, not a new router |
| If the owner shares to Praesto while NOT yet authorized (token missing), `initialShare` is not preserved through the `TokenGate` flow | Low | Low | Out of scope: AC-1's own precondition is "installed and authorized", and both the owner's devices have been authorized since the 2026-08-04 production deploy |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of
`tdd` in `docs/context/methodology.md`: **true**. Test-first ordering —
the test pair (test-writer/test-reviewer) produces the initial test
suite from the Acceptance Criteria above, before the Implementer runs.

- Scope boundary this plan follows: test-first here targets Task 1's
  pure `src/shared/share-target.ts` parser only. Tasks 2–5 (manifest
  shape, DOM wiring, visual pre-fill/focus/confirmation) are UI-visual
  or gesture-based and are verified manually per
  `docs/context/testing.md` and the PRD's own TDD Routing note — this is
  the `EXISTING_COVERAGE_SUFFICIENT` / no-test-required path for those
  tasks, not a violation.
- No routing library is introduced. `research-codebase` confirmed no
  router exists anywhere in `src/app` today; adding one for a single
  detection point would be scope creep against ADR-0005's minimal-stack
  preference. Phase 3 (shortcut deep-link) is expected to reuse the same
  `window.location` check in `main.tsx`, not a new dependency — flagged
  here so Phase 3's plan does not redesign this independently.
- The new test file test-writer authors for `src/shared/share-target.ts`
  is expected at a flat path under `test/` (e.g.
  `test/share-target.test.ts`), consistent with `vitest.config.ts`'s
  `include: ["test/**/*.test.ts"]` and the fact that no test currently
  lives colocated with its source.
- `research-web` flagged that `share_target`'s `action`/`params` shape
  (used in Task 2) has effectively superseded the older `url_template`
  substitution syntax in current MDN/Chrome documentation; no source
  found explains why, but no current PWA authoring guide referenced
  `url_template`, so this plan does not use it.

*Generated: 2026-08-04*
*Approved: 2026-08-05*
*Status: IMPLEMENTED*
