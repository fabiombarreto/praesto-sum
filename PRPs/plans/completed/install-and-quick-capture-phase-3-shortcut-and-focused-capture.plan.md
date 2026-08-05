# Feature: Shortcut and focused capture (Phase 3 of install-and-quick-capture)

```
**Decision Gate**
- Active context: none (no `.context.md` file in the repository)
- Activated criteria: PWA manifest change (`public/manifest.webmanifest`);
  new client-side route detection in the SPA bootstrap
  (`src/app/main.tsx`); no new dependency; reuse of the existing capture
  form (`src/app/App.tsx`)
- Decisions found:
  - ADR-0004 — one installable PWA is the sole interface; the manifest IS
    the app's identity surface, so a second `shortcuts` member belongs in
    `public/manifest.webmanifest`, exactly where `share_target` already
    lives (Phase 1)
  - ADR-0005 — React 19 SPA, no meta-framework/SSR, minimal-stack
    preference; `src/shared/` stays DOM-free
  - ADR-0001 — every artifact in English
  - ADR-0008 — test-first methodology (`tdd: true`); the PRD's own TDD
    Routing note names AC-3's focus behaviour as one of the two examples
    of a purely visual/gesture-based criterion verified manually, not
    test-first
- Applicable anti-patterns:
  - Meta-framework / SSR / RSC — not implicated; this phase extends the
    existing no-router `window.location` check in `main.tsx` (the same
    pattern Phase 1 flagged for reuse), never adds a routing dependency
  - Hand-duplicated entity types — not implicated; this phase adds no new
    `createTask` call site, and the existing capture form it reuses
    already goes through `CreateTaskInput` / `createTask()` unchanged
  - Glossary synonym drift — the captured entity stays "Task"
  - Portuguese in artifacts
- Applicable architectural rules:
  - One Worker serves the SPA assets, `/api/*` and the cron — this phase
    is entirely client/manifest-side; `wrangler.jsonc`'s
    `not_found_handling: single-page-application` +
    `run_worker_first: ["/api/*"]` means the new `/new-task` client path
    needs no Worker route, exactly as `/share-target` needed none
  - The wire contract lives in `src/shared/api.ts` — unaffected; no new
    API surface
  - Every `/api/*` route requires the bearer token — unaffected; the
    shortcut route only reaches `TaskBoard` once `authorized` is true
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/install-and-quick-capture.prd.md` — Implementation Phases row
  3: "Shortcut and focused capture" — Goal: add `shortcuts` to the
  manifest and the deep-linked capture route with autofocus — Success
  signal: covers AC-3 (`PRPs/prds/install-and-quick-capture.prd.md:262,
  287-288`).

## Summary

Register a "New Task" entry in the PWA's launcher long-press menu by
adding a `shortcuts` member to `public/manifest.webmanifest`, pointing at
a new `/new-task` deep link. Extend the existing no-router
`window.location`-based detection in `src/app/main.tsx` (the same pattern
Phase 1 used for `/share-target`) to recognize `/new-task` and strip it
back to `/` via `history.replaceState` — no query parsing is needed since
the shortcut carries no payload, only intent. The capture field opening
"focused and empty" (AC-3) is already the existing, unconditional
behaviour of `TaskBoard`'s `<input autoFocus>` in `src/app/App.tsx` when
`initialShare` is `null`, which it is by default on this route; this
phase records — explicitly, in code and in this plan — the deliberate
decision not to gate that `autoFocus` by device/pointer type, rather than
silently leaving the PRD's Open Question 1 unaddressed.

## User Story

As the owner, I want long-pressing Praesto's home-screen icon and
choosing "New Task" to open the app straight on an empty, focused
capture field, so that starting a capture takes one gesture instead of
opening the app and finding the input myself.

## Problem Statement

Capture still costs opening the app and reaching the input — enough
friction that, in the moments capture actually matters, it does not
happen. Phase 1 removed that friction for the "sharing text from another
app" case. This phase removes it for the second stated gesture: "I want
to add something now," with no text to share yet — today there is no
faster path to an empty capture field than opening the app and tapping
into the input that is already there.

## Solution Statement

Add a `shortcuts` member to the manifest exposing one entry, "New Task",
whose `url` is `/new-task` — reusing the existing icon assets, never
adding new ones. Extend `main.tsx`'s existing `/share-target` detection
with a sibling branch for `/new-task` that strips the path via
`history.replaceState`, exactly mirroring the established pattern rather
than introducing a second idiom or a routing library. Because
`TaskBoard`'s capture `<input>` already carries an unconditional
`autoFocus` and seeds `title` from `initialShare?.title ?? ""` (`null` on
this route), no functional change to `App.tsx` is required for AC-3
itself — this phase instead records, as a discrete code comment plus a
content-invariant validation, the deliberate decision to leave that
`autoFocus` ungated by device/pointer type, addressing the PRD's Open
Question 1 explicitly rather than by omission.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Small |
| Systems Affected | PWA manifest (`public/manifest.webmanifest`), SPA bootstrap (`src/app/main.tsx`), capture UI doc comment (`src/app/App.tsx`) |
| Dependencies | Phase 1 (PRD row 3 `Depends: 1`) — `complete` |
| Estimated Tasks | 3 |
| Source PRD line ref | `PRPs/prds/install-and-quick-capture.prd.md:262, 287-288` (Phase 3 — Shortcut and focused capture) |
| phase_type | feature |

(`docs/context/methodology.md` declares `figma_track: false`, so no
`design_source` row is added — this table is unchanged from the
pre-Figma-track shape. The source PRD has no `## Visual-First Mode`
section, so no `phase_scope` row is added either.)

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/app/main.tsx` | 1-35 | The exact `/share-target` detection + `history.replaceState` pattern this phase extends with a `/new-task` sibling branch — the established idiom, not a new one |
| P0 | `public/manifest.webmanifest` | 1-26 | Current manifest shape, including the `share_target` member Phase 1 added; `shortcuts` is added as a second top-level key |
| P0 | `src/app/App.tsx` | 15-30, 65-76, 121-149 | `App()`/`TaskBoard()` split; the `initialShare?.title ?? ""` seeding and the capture `<input>`'s pre-existing, unconditional `autoFocus` (line 144) — the behaviour AC-3 already relies on and this phase must not silently change |
| P1 | `src/shared/api.ts` | 34-41 | `CreateTaskInput` — confirms no new payload shape is introduced; the shortcut-opened field still saves through the unchanged `createTask()` path |
| P1 | `docs/context/testing.md` | 51-77 | Confirms the only test tier is Vitest inside workerd, with no browser/DOM tier — this phase's gesture- and visual-based work (manifest shortcut, autofocus) is verified manually, consistent with the PRD's own TDD Routing note naming AC-3 explicitly |
| P1 | `wrangler.jsonc` | 11-18 | `not_found_handling: single-page-application` + `run_worker_first: ["/api/*"]` — confirms the new `/new-task` client path needs no Worker route, exactly as `/share-target` needed none |
| P2 | `vite.config.ts` | 23-27 | `VitePWA({ manifest: false, ... })` — confirms `public/manifest.webmanifest` remains the single source of truth to edit |
| P2 | `PRPs/plans/completed/install-and-quick-capture-phase-1-share-target.plan.md` | 298-304, 434-439 | Phase 1's own `## Notes` explicitly flags: "Phase 3 (shortcut deep-link) is expected to reuse the same `window.location` check in `main.tsx`, not a new dependency — flagged here so Phase 3's plan does not redesign this independently" |

## Patterns to Mirror

```
# SOURCE: src/app/main.tsx:14-18
if (window.location.pathname === "/share-target") {
  initialShare = parseShareTarget(window.location.search);
  window.history.replaceState(null, "", "/");
}
```
Copied by: Task 2 (`/new-task` becomes a sibling `else if` branch of this
exact detect-then-strip shape; no parsing call is needed since the
shortcut carries no query payload).

```
# SOURCE: public/manifest.webmanifest:21-25
"share_target": {
  "action": "/share-target",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```
Copied by: Task 1 (the new `shortcuts` member is added as a second
top-level key in this exact file, alongside `share_target`, using the
existing `icons` entries rather than new assets).

```
# SOURCE (research-web, MDN): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts
Each entry in the `shortcuts` array is an object with `name` (required),
`short_name`, `description`, `url` (must resolve within the manifest's
declared `scope`), and an `icons` array shaped like the top-level `icons`
member.
```
Copied by: Task 1 (the "New Task" entry's field set — `name`,
`short_name`, `description`, `url: "/new-task"`, `icons`).

```
# SOURCE: src/app/App.tsx:65-76
const [tasks, setTasks] = useState<TaskDto[] | null>(null);
const [error, setError] = useState<string | null>(null);
const [title, setTitle] = useState(initialShare?.title ?? "");
```
Copied by: Task 3's comment (documents that `/new-task` needs no new
seeding logic — `initialShare` stays `null` on this route by construction
of Task 2's detection, so `title` already starts `""`).

```
# SOURCE: src/app/App.tsx:135-145
<input
  style={styles.input}
  value={title}
  onChange={(event) => {
    setTitle(event.target.value);
    setJustSaved(false);
  }}
  placeholder="What needs doing?"
  aria-label="Task title"
  autoFocus
/>
```
Copied by: Task 3 (the doc comment recording the no-device-gating
decision is placed directly above this `autoFocus` attribute, the exact
line the decision concerns).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `public/manifest.webmanifest` | UPDATE | Add the `shortcuts` member exposing "New Task", pointing at `/new-task`, reusing the existing icon assets (AC-3) |
| `src/app/main.tsx` | UPDATE | Detect the `/new-task` path on bootstrap and strip it via `history.replaceState`, mirroring the `/share-target` pattern Phase 1 established and its own `## Notes` flagged for reuse; no query parsing needed (AC-3) |
| `src/app/App.tsx` | UPDATE | Add a doc comment directly above the capture `<input>`'s `autoFocus` attribute recording the Phase 3 decision to leave it unconditional (not gated by device/pointer type), addressing the PRD's Open Question 1 explicitly; no functional change (AC-3) |

## NOT Building (Scope Limits)

- **Device-conditional autofocus gating.** The PRD's Open Question 1
  explicitly defers this ("to be validated in real use rather than
  decided now"); no `matchMedia`/pointer-type detection is added — see
  `## Notes` for the recorded decision and `## Risks and Mitigations`.
- **Voice capture through Google Assistant.** Structurally out of reach
  for a PWA (ADR-0004); unaffected by this phase either way.
- **Offline write queue / explicit unreachable-server UX.** Forbidden
  globally and explicitly Phase 4's concern.
- **Durable token storage.** Phase 2 (currently `blocked` by owner
  decision). The shortcut route still requires an already-valid token —
  `TaskBoard` is only reachable once `authorized` is true — but this
  phase does not change how or where the token is stored.
- **The `share_target` manifest member and its client route.** Phase 1,
  already shipped and `complete`.
- **Anything about delivery.** Today view, reminders, push, search
  belong to other roadmap units.
- **A magic link carrying the token in the URL.** Rejected PRD-wide.
- **Multi-user anything.** One user, one token (ADR-0003, CON-002).
- **A client-side routing library.** No router exists in the repo
  (confirmed by `research-codebase`); this phase adds one more branch to
  the existing `window.location` check in `main.tsx`, not a dependency.

## Step-by-Step Tasks

### Task 1: UPDATE public/manifest.webmanifest

**ACTION** (serves AC-A1): Add a top-level `"shortcuts"` array with one
entry:
```json
"shortcuts": [
  {
    "name": "New Task",
    "short_name": "New Task",
    "description": "Open Praesto with an empty capture field",
    "url": "/new-task",
    "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }]
  }
]
```
`url` stays inside the manifest's existing `"scope": "/"`, so no scope
change is needed. Reuse the existing `/icons/icon-192.png` asset —
research-web (web.dev) documents per-platform display caps (Android
Chrome: 3 shortcuts, Windows Chrome/Edge: 10) that this single entry is
well under, so no additional icon generation or entry pruning is needed.

**MIRROR**: `# SOURCE: public/manifest.webmanifest:21-25` and the MDN
research-web finding on the `shortcuts` object shape.

**VALIDATE**:
```bash
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const shortcuts = m.shortcuts;
if (!Array.isArray(shortcuts) || shortcuts.length < 1) {
  console.error('FAIL: shortcuts member missing or empty');
  process.exit(1);
}
const nt = shortcuts.find((s) => s.url === '/new-task');
if (!nt || nt.name !== 'New Task' || !Array.isArray(nt.icons) || nt.icons.length < 1) {
  console.error('FAIL: New Task shortcut entry missing or malformed');
  process.exit(1);
}
console.log('PASS: shortcuts member present and well-formed');
"
```

### Task 2: UPDATE src/app/main.tsx

**ACTION** (serves AC-A2, AC-A3 — routing plumbing that makes the
already-empty, already-focused field reachable via the shortcut): Extend
the existing `if (window.location.pathname === "/share-target") { ... }`
block with a sibling `else if (window.location.pathname === "/new-task")
{ window.history.replaceState(null, "", "/"); }`. No parsing call is
needed — the shortcut carries no query payload, only intent — so
`initialShare` stays at its default `null`, which is exactly what makes
`TaskBoard`'s `title` state seed to `""` (Task 3's `## Patterns to
Mirror` citation on `App.tsx:65-76`). Stripping the path back to `/`
mirrors the `/share-target` handling exactly, so a reload does not
re-trigger it and the URL bar (invisible in `standalone` display mode,
but relevant for the dev-server dry-run in `## Validation Commands`)
settles back to `/`.

**MIRROR**: `# SOURCE: src/app/main.tsx:14-18`

**VALIDATE**: `npm run check` (`tsc -b` + ESLint + Prettier; exits
non-zero on any type/lint/format violation, including an unreachable or
malformed `else if` branch)

### Task 3: UPDATE src/app/App.tsx (record the autofocus decision)

**ACTION** (serves AC-A4 — the explicit judgment call the PRD's Open
Question 1 raises and defers): Directly above the capture `<input>`'s
`autoFocus` attribute (`src/app/App.tsx:144`), add a doc comment stating
that this phase deliberately keeps `autoFocus` unconditional — not gated
by device or pointer type — because (a) no device/pointer-type detection
exists anywhere in the codebase today (`research-codebase` confirmed
this gap) and adding one would be new complexity against an unvalidated
problem, and (b) the PRD's Open Question 1 itself defers the decision
("to be validated in real use rather than decided now") rather than
mandating gating now. Reference PRD Open Question 1 by name in the
comment. This is a documentation-only change — the `autoFocus` attribute
and every surrounding line stay byte-identical, so AC-3's "focused and
empty" is satisfied by pre-existing, unmodified behaviour, not new logic
this task introduces.

**MIRROR**: `# SOURCE: src/app/App.tsx:135-145`

**VALIDATE**:
```bash
if grep -q "Open Question 1" src/app/App.tsx; then
  echo "PASS: autofocus decision comment present"
else
  echo "FAIL: autofocus decision comment missing above the capture input"
  exit 1
fi
```
Chained with `npm run check` to confirm the comment addition introduces
no type/lint/format violation:
```bash
npm run check
```

## Validation Commands

**Level 1 — STATIC_ANALYSIS**
```bash
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` —
real exit code, fails on any type/lint/format violation.)

**Level 2 — CONTENT_INVARIANTS**
```bash
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const shortcuts = m.shortcuts;
if (!Array.isArray(shortcuts) || shortcuts.length < 1) {
  console.error('FAIL: shortcuts member missing or empty');
  process.exit(1);
}
const nt = shortcuts.find((s) => s.url === '/new-task');
if (!nt || nt.name !== 'New Task' || !Array.isArray(nt.icons) || nt.icons.length < 1) {
  console.error('FAIL: New Task shortcut entry missing or malformed');
  process.exit(1);
}
console.log('PASS: shortcuts member present and well-formed');
"
```
(Manifest JSON-shape invariant — not covered by Vitest since the
manifest is a static asset, not application code.)

```bash
if grep -q '"/new-task"' src/app/main.tsx && grep -q "Open Question 1" src/app/App.tsx; then
  echo "PASS: /new-task detection and autofocus decision comment both present"
else
  echo "FAIL: /new-task detection or autofocus decision comment missing"
  exit 1
fi
```
(Real exit-code content-invariant check for both source edits — fails
if either Task 2's route branch or Task 3's decision comment is absent.)

**Level 3 — INTEGRATION (dry-run, partially manual)**

Automatable part — confirms `/new-task` actually resolves through the
SPA shell (per `wrangler.jsonc`'s `not_found_handling:
single-page-application`), with a real exit code:
```bash
npm run dev &
DEV_PID=$!
sleep 3
if curl -sf "http://127.0.0.1:5173/new-task" -o /dev/null; then
  echo "PASS: /new-task resolves via the SPA shell"
  kill "$DEV_PID" 2>/dev/null
else
  echo "FAIL: /new-task did not resolve (200) via the dev server"
  kill "$DEV_PID" 2>/dev/null
  exit 1
fi
```
(Adjust the port if `npm run dev` prints a different one than the Vite
default 5173.)

MANUAL (no browser/e2e tier exists per `docs/context/testing.md`; both
behaviors below are UI-visual and gesture-based, consistent with the
PRD's own TDD Routing note naming AC-3 explicitly):
1. On the owner's Android phone, install/confirm Praesto is installed,
   long-press the home-screen icon, choose "New Task": confirm the app
   opens directly on the capture field, that the field is empty, and
   that the on-screen keyboard is already up (focused) without an extra
   tap.
2. On the owner's Windows PC, open Praesto and navigate to `/new-task`
   directly (or via the shortcut if the OS exposes one for installed
   PWAs): confirm the field opens empty and focused, and note whether
   the unconditional `autoFocus` (Task 3's recorded decision) causes any
   unwanted on-screen-keyboard behaviour if the PC is a touch device —
   feeding PRD Open Question 1's real-use validation.

## Acceptance Criteria

- **AC-A1 (PRD AC-3):** The `shortcuts` manifest member correctly
  registers a single "New Task" entry pointing at `/new-task`, reusing
  the existing icon assets, requiring no Worker route change and no new
  scope.
- **AC-A2 (PRD AC-3):** Given the icon is on the home screen, when the
  owner long-presses it and chooses "New Task", then `main.tsx` detects
  the `/new-task` path, strips it via `history.replaceState`, and passes
  a `null` `initialShare` into `App`, exactly mirroring the `/share-target`
  detection pattern.
- **AC-A3 (PRD AC-3):** The capture field opens focused and empty on the
  `/new-task` route — via the pre-existing, unmodified
  `initialShare?.title ?? ""` seeding and the capture `<input>`'s
  pre-existing, unconditional `autoFocus`, with no new focus-management
  logic introduced.
- **AC-A4 (PRD AC-3):** The plan and the code both explicitly record the
  decision not to gate `autoFocus` by device/pointer type, addressing
  the PRD's Open Question 1 rather than leaving it implicit or silently
  autofocusing everywhere without acknowledgment.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The `shortcuts` manifest member is non-Baseline (research-web/MDN) with per-platform display caps (Android Chrome: 3, Windows Chrome/Edge: 10) | Low | Low | Only one entry is added, well under every documented cap; on an unsupported browser the long-press menu simply lacks the entry, degrading gracefully with no broken functionality |
| Unconditional `autoFocus` may raise an unwanted on-screen keyboard on a touch-capable Windows PC (research-web/MDN's own accessibility warning; PRD Open Question 1) | Medium | Low | No device/pointer-type detection exists anywhere in the codebase (`research-codebase` gap); adding one now would be new complexity against a problem the PRD itself defers ("to be validated in real use rather than decided now"). This plan records the non-gating decision explicitly (Task 3) instead of leaving it implicit, and the manual Level 3 step 2 feeds the real-use validation the PRD asks for |
| If the installed PWA is already running (warm launch) when the shortcut is activated, the browser's launch-handling behaviour may focus the existing window instead of navigating it to `/new-task`, so the field would not re-empty/re-focus | Low | Low | Out of scope for MVP — the same unverified edge case was already accepted for Phase 1's `/share-target` (see its own plan's Risks table); the manual Level 3 step 1 verifies the primary cold-launch path on the owner's Android device |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of
`tdd` in `docs/context/methodology.md`: **true**. Test-first ordering —
the test pair (test-writer/test-reviewer) produces the initial test
suite from the Acceptance Criteria above, before the Implementer runs.

- Scope boundary this plan follows: the PRD's own TDD Routing note names
  "AC-3's focus behaviour" and "the share-sheet entry itself" as the two
  worked examples of criteria that are purely visual/gesture-based and
  verified manually, not test-first. This phase's entire scope — a
  manifest shortcut, a `window.location` route branch with no parsing
  logic, and a doc comment — has no pure `src/shared`-testable unit the
  way Phase 1's `parseShareTarget` did (research-codebase confirmed no
  such candidate exists here). This is the `EXISTING_COVERAGE_SUFFICIENT`
  / no-test-required path for the whole phase, not a violation.
- **Decision recorded (per explicit instruction, not left implicit):**
  the capture field's `autoFocus` stays unconditional across devices for
  Phase 3. The PRD's Open Question 1 raises, but explicitly defers,
  whether auto-focusing is unwelcome on desktop/touch-laptop hardware.
  Given (a) no device/pointer-type detection exists anywhere in the
  repository today, (b) the owner's two confirmed devices (CON-007:
  Android phone, and a Windows PC of unconfirmed touch capability) have
  already used the identical unconditional `autoFocus` since Phase 1's
  production deploy with no reported issue, and (c) the PRD itself asks
  for real-use validation rather than a decision now, this plan does
  NOT add gating logic. Task 3 makes this decision visible in the code
  itself (a comment citing "Open Question 1") rather than relying on
  this Notes section alone. If real use on the Windows PC surfaces
  friction, revisiting with a `matchMedia("(any-pointer: coarse)")`
  check (or similar) is the natural next step — flagged here so a future
  phase does not have to rediscover the option space.
- No routing library is introduced. `research-codebase` confirmed no
  router exists anywhere in `src/app`; this phase adds one more branch
  to the existing `window.location` check in `main.tsx`, exactly the
  reuse Phase 1's own `## Notes` anticipated ("Phase 3 ... is expected
  to reuse the same `window.location` check in `main.tsx`, not a new
  dependency").
- `research-web` (web.dev) documents that the `shortcuts` member is
  capped per platform (Android Chrome: 3 visible entries, Windows
  Chrome/Edge: 10); with only one entry added here, this phase is far
  from any cap and no pruning logic is needed.
- `research-web` (MDN, Adam Silver) documents general concerns with
  autofocus-on-load beyond the desktop-keyboard case named in Open
  Question 1 (disrupted screen-reader announcement, broken
  arrow-key/back-button scrolling) — none of these are new to this
  phase, since the `autoFocus` attribute already exists unconditionally
  on this exact `<input>` since Phase 1; recorded here for completeness,
  not as a new risk this phase introduces.

*Generated: 2026-08-05*
*Approved: 2026-08-05*
*Status: IMPLEMENTED*
