# Install and Quick Capture

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: cross-cutting artifact (a PRD downstream stages consume);
  touches Task domain rules; touches the client/API contract surface
- Decisions found:
  - ADR-0003 — single canonical copy in D1; token on every route; NO merge,
    sync or offline-write logic; thin clients
  - ADR-0004 — one installable PWA is the sole interface; no native app or
    wrapper in the MVP
  - ADR-0005 — React 19 SPA + Vite + Hono + Drizzle; types originate in the
    Drizzle schema and flow outward
  - ADR-0001 — every artifact in English
  - ADR-0008 — test-first methodology (tdd: true)
  - CON-007 — the owner's phone is Android; device assumptions are verified
    against Android, never inherited from iOS
- Applicable anti-patterns:
  - Offline write queue — FORBIDDEN. "Capture with near-zero friction" invites
    queueing writes while offline; this PRD explicitly excludes it and
    specifies explicit "server unreachable" UX instead
  - Hand-duplicated entity types — the share-target path must reuse
    CreateTaskInput from src/shared/api.ts
  - Meta-framework / SSR / RSC — the capture route stays inside the SPA
  - Glossary synonym drift — the captured entity is a Task, never a "todo"
  - Portuguese in artifacts
- Applicable architectural rules:
  - One Worker serves the SPA assets, /api/* and the cron
  - Every /api/* route requires the bearer token; only the PWA shell is
    unauthenticated
  - The wire contract lives in src/shared/api.ts and maps through
    src/worker/dto.ts
- Result: PROCEED
```

## Problem Statement

The owner forgets to record things he cannot afford to forget, and when he does
record them the note is lost or never revisited. Praesto Sum has been in
production since 2026-08-04 and the full Task round-trip works on both his
devices, but capture still costs opening the app and reaching the input — enough
friction that, in the moments capture actually matters (walking, mid-task, while
reading something on the phone), it does not happen.

This unit addresses **half** of the owner's stated pain, and the PRD says so
deliberately. Asked what the core problem was, the owner answered: *"the biggest
problem is the information I saved somewhere not coming to me when I need it."*
That is a delivery and retrieval problem, served by unit 3 (today view), units
6/7 (push and Reminders) and unit 8 (search). Frictionless capture is the
precondition for those — there must be something recorded before anything can be
delivered — but it does not, on its own, solve what the owner called his biggest
problem. Treating this unit as the whole answer would be the main way to
misread it.

## Evidence

- **Owner, 2026-08-04 (Foundation Q2):** "I often forget to write things down.
  Often I write them down but do not remember to look, or I even lose the note."
- **Owner, 2026-08-04 (Foundation Q3):** "The biggest problem is the information
  I saved somewhere not coming to me when I need it — whether a reminder, a note,
  or a longer text."
- **Owner, 2026-08-04 (Foundation Q1):** capture is needed in every situation;
  the stated north star is voice-level ease ("Ok Google, create event X on day
  D"), explicitly to be approached incrementally rather than built now.
- **Production baseline, 2026-08-04:** the PWA is installed on the owner's
  Android phone and Windows PC; create, complete, create, delete and reload were
  all verified against production (`documentation/40-engineering/dev-environment.md#deploy-runbook`).
  The bottleneck is no longer the stack.
- **The API is already capture-ready:** `POST /api/tasks` requires only `title`
  (`src/worker/routes/tasks.ts:47`). No server change is needed for capture
  itself.
- **The token is stored in an evictable place:** `src/app/api.ts:11` keeps it in
  `localStorage`, which `navigator.storage.persist()` does not protect.

## Proposed Solution

Four changes, all client- and manifest-side:

1. **Durable token.** Move the bearer token from `localStorage` to IndexedDB and
   request persistent storage, so the token prompt never returns after the
   one-time paste.
2. **Share target.** Register the PWA in Android's share sheet via the
   `share_target` manifest member, so text shared from any app lands in Praesto
   as a Task.
3. **Launcher shortcut.** Add a `shortcuts` manifest entry ("New Task") that
   deep-links to a focused, empty capture field.
4. **Honest network failure.** When the server is unreachable, show an explicit
   failure state and preserve what the owner typed — never an empty list that
   silently looks like "nothing to do".

## Key Hypothesis

We believe that **reducing capture to roughly two taps from any app** will make
the owner record things instead of forgetting them. We will know we are right
when **he captures in situations where he previously would have written nothing
down**.

The leap of faith is that friction is the cause. If forgetting comes instead from
not remembering that Praesto exists at that moment, no shortcut fixes it — only
the app reaching out to him does (units 6/7). This is recorded as the first
technical risk rather than assumed away.

## What We're NOT Building

- **Voice capture through Google Assistant.** Structurally out of reach for a
  PWA: App Actions require a native Android app with `shortcuts.xml` and the
  Google Shortcuts Integration Jetpack library. Building it would mean a native
  app, which ADR-0004 excludes. Android keyboard dictation into the capture field
  remains available and is not blocked by this.
- **Offline write queue.** Forbidden by `docs/anti-patterns.md` and ADR-0003;
  it silently rebuilds the sync engine the project exists without. Offline stays
  read-only, and failure is stated rather than absorbed.
- **Anything about delivery.** Today view, Reminders, push and search belong to
  units 3, 6, 7 and 8. See Problem Statement.
- **A magic link carrying the token in the URL.** Rejected: query strings leak
  into history, referrers and logs. Adopting it would need its own ADR.
- **Multi-user anything.** One user, one token (ADR-0003, CON-002).

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Taps from intent to saved Task | ≤ 3, starting from any app | Counted once during manual verification |
| Times the token is typed after install | 0 across 4 weeks | The token screen reappearing is the failure signal |
| New notes captured outside Praesto | none for 1 week | Owner's honest self-report at week's end |

The third metric is the only one that tests the hypothesis; the first two test
whether the tool works, not whether behaviour changed.

## Acceptance Criteria (test scenarios)

- **AC-1 share-creates-task:** Given Praesto is installed and authorized, when
  the owner shares text from another app and picks Praesto, then a Task is
  created with that text as its title and a confirmation is shown.
- **AC-2 token-never-reprompted:** Given the token was saved once, when the owner
  opens the app after a device restart and ordinary use, then the token screen
  does not appear.
- **AC-3 shortcut-opens-focused:** Given the icon is on the home screen, when the
  owner long-presses it and chooses "New Task", then the app opens with the
  capture field focused and empty.
- **AC-4 unreachable-server-is-explicit:** Given the server is unreachable, when
  the owner tries to save, then an explicit failure message is shown and the
  typed text is not lost.
- **AC-5 empty-share-creates-nothing:** Given a share target invocation carrying
  empty text, when the app opens, then it shows the focused empty field instead
  of creating a titleless Task.

## Open Questions

1. Auto-focusing the capture field may be unwelcome on desktop, where it raises
   the on-screen keyboard on touch laptops. To be validated in real use rather
   than decided now.
2. If `navigator.storage.persist()` is denied on the owner's device, do we accept
   today's behaviour as the floor, or escalate to another storage strategy?
3. `TBD - needs validation`: whether a share target that receives a URL (rather
   than plain text) should store the URL in `title` or in `description`. The
   wire contract supports both; the owner has not been asked.

---

## Users & Context

**Primary user.** The owner, and only the owner (CON-002). Devices: an Android
phone and a Windows PC (CON-007), with the PWA installed on both since
2026-08-04. Trigger: any moment something surfaces that must not be forgotten —
in motion, mid-task, or while reading on the phone. Success state: the thought
has left his head and is in Praesto.

**Job to Be Done.** When I remember something I cannot forget — in motion, in the
middle of something else, or while reading on my phone — I want to record it in
seconds without leaving what I am doing, so that it leaves my head without my
having to trust my memory.

**Non-users.** Everyone else. There are no accounts, no invitations and no
sharing; a single shared secret is the entire authorization model (ADR-0003).

## Solution Detail

### MoSCoW

- **Must** — durable token (IndexedDB + `persist()`); `share_target` receiving
  text; `shortcuts` entry for "New Task"; explicit unreachable-server state.
- **Should** — capture field auto-focused when opened through the shortcut.
- **Could** — success feedback that does not navigate away from the field.
- **Won't** — assistant voice capture; offline write queue; any delivery,
  reminder or retrieval capability; token in a URL.

### MVP Scope

Sharing text from any app creates the Task, and the token is never requested
again. That pair alone makes the hypothesis testable.

### User Flow

Any app → Share → Praesto → title pre-filled → Save. Two taps plus a
confirmation.

Second path: long-press the launcher icon → "New Task" → focused empty field →
type or dictate → Save.

## Technical Approach

### Feasibility

**HIGH.** The work is client-side and manifest-side. `POST /api/tasks` already
accepts a title-only body and does not change; the auth gate, the DTO mapping and
the schema are untouched.

### TDD Routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first
ordering — the test pair (test-writer/test-reviewer) produces the initial test
suite from the Acceptance Criteria above, before the Implementer runs.

Note the scope boundary `docs/context/methodology.md` itself draws: test-first
here does not mean React component tests. Acceptance criteria that are purely
visual or gesture-based (AC-3's focus behaviour, the share-sheet entry itself)
are verified manually, as `documentation/40-engineering/testing-strategy.md`
prescribes. The token-storage module and the share-target payload parsing are
ordinary units and are testable first.

### Architecture Notes

- The share target lands on a client route inside the SPA; it does not add a
  Worker route. `run_worker_first` in `wrangler.jsonc` already forces `/api/*` to
  the Worker while navigations are served the SPA shell from asset storage.
- The capture payload must be built from `CreateTaskInput` in
  `src/shared/api.ts` — never a hand-written object literal shaped like a Task
  (anti-pattern: hand-duplicated entity types).
- `src/app/api.ts:45` clears the token on any 401. That behaviour is correct and
  stays, but it becomes the one remaining path back to the token screen; the
  durable-storage work must not weaken it.
- Storage note: `navigator.storage.persist()` protects IndexedDB and Cache
  Storage. It does not protect `localStorage`, which is why the token moves
  rather than merely being re-requested.

### Technical Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Friction was not the cause — the owner does not think of Praesto in the moment | Medium | None within this unit; it is what units 6/7 exist for. Recorded so a disappointing result is read correctly rather than blamed on the implementation |
| Reinstalling the PWA clears storage and the token must be pasted again | Low | The token screen remains as the fallback path; this is recovery, not regression |
| `persist()` is denied by the browser | Low | Degrade to current behaviour without breaking; see Open Question 2 |

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|---|---|---|---|---|---|
| 1 | Durable token | The token survives storage pressure and a restart; the token screen does not reappear | pending | no | — | |
| 2 | Share target | Sharing text from another app creates the Task | pending | no | 1 | |
| 3 | Shortcut and focused capture | Long-pressing the icon opens directly on a focused, empty field | pending | yes | 2 | |
| 4 | Network honesty | An unreachable server produces an explicit state and loses no typed text | pending | yes | 2 | |

### Phase Details

**Phase 1 — Durable token.** Replace the `localStorage` accessors in
`src/app/api.ts` with an IndexedDB-backed store and request persistent storage at
startup. Covers AC-2. The 401-clears-token path is preserved.

**Phase 2 — Share target.** Add `share_target` to
`public/manifest.webmanifest` and a client route that reads the shared `title`
and `text` and pre-fills capture. Covers AC-1 and AC-5.

**Phase 3 — Shortcut and focused capture.** Add `shortcuts` to the manifest and
the deep-linked capture route with autofocus. Covers AC-3.

**Phase 4 — Network honesty.** Explicit unreachable state that preserves the
typed text. Covers AC-4. Deliberately last: it is the smallest change and the
easiest to verify once the other entry points exist.

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Token durability | Move to IndexedDB + `navigator.storage.persist()` | Keep `localStorage`; magic link carrying the token in a URL | `persist()` does not cover Web Storage, so `localStorage` can be evicted under pressure. The URL option leaks the secret into history, referrers and logs and would need its own ADR |
| Capture mechanisms | Ship both `share_target` and `shortcuts` | Only one of them | They serve different gestures: sharing covers "in the middle of something else", the shortcut covers "I want to add something now". Both are manifest-only. If budget forces a cut, `share_target` is the one to keep |
| Scope boundary | Capture only; no delivery capability | Pull part of the today view or reminders forward | The owner confirmed on 2026-08-04 that scope stays. Delivery is two units away and inflating this one would delay both |
| Voice capture | Excluded, with the reason recorded | Wrap the PWA in a native shell to reach App Actions | A native wrapper is excluded by ADR-0004. Recorded here so the north star is not silently dropped — keyboard dictation remains the partial substitute |
| Template conformance | Assembled from the Writer protocol's Step 7.4 section enumeration | Conform to `docs/context/prd-template.md` | The template file does not ship in the installed relay plugin (0.25.1 has no `docs/` directory). The section list in Step 7.4 specifies the same structure and was followed literally |

## Research Summary

Research was conducted inline by the main session rather than through the
`research-web` / `research-codebase` subagents: this session carries an explicit
instruction not to dispatch agents without the user asking. Sources are real and
cited; no finding below is inferred.

### Market Context

- The `share_target` manifest member registers an installed PWA in the system
  share sheet, receiving `title`, `text` and `url`. It requires the app to meet
  installability criteria and to have been added to the home screen — both true
  here since 2026-08-04.
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target),
  [Chrome for Developers](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target))
- The `shortcuts` manifest member exposes quick actions on long-press of the
  launcher icon on Android, and is supported for installed PWAs on Android,
  Windows and macOS.
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Expose_common_actions_as_shortcuts),
  [web.dev](https://web.dev/learn/pwa/enhancements))
- Google Assistant App Actions are documented exclusively for native Android
  apps, via `shortcuts.xml` capability tags and the Google Shortcuts Integration
  Jetpack library. No PWA path exists.
  ([Android Developers](https://developer.android.com/develop/devices/assistant/overview),
  [App Actions](https://developers.google.com/assistant/app))
- `navigator.storage.persist()` protects IndexedDB and Cache Storage from
  eviction; Web Storage (`localStorage`) is among the storage that may be evicted
  under pressure.
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist),
  [web.dev](https://web.dev/articles/persistent-storage))

### Technical Context

- `src/worker/routes/tasks.ts:42-81` — `POST /api/tasks` requires only a
  non-empty `title`; `deadline` and `scheduledDate` are optional and mutually
  exclusive. Capture needs no API change.
- `src/app/api.ts:11-23` — the token lives in `localStorage` under
  `praesto.token`. This is the artifact Phase 1 replaces.
- `src/app/api.ts:45-48` — a 401 clears the token and surfaces `ApiError`,
  which is what routes the app back to the token screen.
- `src/app/App.tsx:81-104` — `refresh()` runs on mount and after each local
  mutation; there is no polling and no revalidation on focus. Unrelated to this
  unit but recorded in the roadmap backlog on 2026-08-04.
- `public/manifest.webmanifest` — currently declares `id`, `name`,
  `short_name`, `lang`, `start_url`, `scope`, `display`, colours and three
  icons. Neither `share_target` nor `shortcuts` is present.
- `wrangler.jsonc:11-18` — `not_found_handling: single-page-application` plus
  `run_worker_first: ["/api/*"]` means a new client route needs no Worker change.

*Generated: 2026-08-04*
*Approved: 2026-08-04*
*Status: APPROVED*
