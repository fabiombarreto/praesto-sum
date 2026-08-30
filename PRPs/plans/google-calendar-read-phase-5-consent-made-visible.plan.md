# Feature: Consent, made visible (Phase 5 of google-calendar-read)

```
**Decision Gate**
- Active context: none
- Activated criteria: cross-cutting patterns (this phase creates the navigation seam five later units plug into); reuse or creation of components; impact on shared UI; separation of a consent surface (CON-005); domain rules (events)
- Decisions found:
  - ADR-0003 — thin client over a canonical store; the bearer token on every `/api/*` route; only the PWA shell unauthenticated. The `/oauth/*` prefix is the argued exception phase 2 landed, and this phase does not widen it.
  - ADR-0004 — one installable PWA is the sole interface; a settings surface is a screen in this app, never a second app or a terminal.
  - ADR-0005 — React 19 SPA, no meta-framework, exact version pins. This is what makes "add a router dependency" a decision rather than a detail.
  - ADR-0007 — Google integration is read-only in this unit; the mirror inventory is closed. Nothing this phase adds may widen either.
  - ADR-0008 — `tdd: true`. The decidable half of the screen must live in `src/shared/` so it can be RED before the component exists.
  - ADR-0009 — visible copy pt-BR; identifiers, comments and tests English. Applied below to the URL question, which the ADR does not name.
  - ADR-0010 / ADR-0011 — Arcade identity; owned components over Base UI + Tailwind v4. `Sheet`, `Button`, `ConfirmView`, `Banner` and `Skeleton` already exist and are reused, not re-derived.
  - 2026-08-29 — an APPROVED PRD's phase table may grow with a dated amendment note. This row is the one that decision created.
- Applicable anti-patterns:
  - Mirroring Tasks, Reminders or Life Areas to Google — the calendar picker sends calendar ids only; nothing local crosses.
  - Hand-duplicated entity types — `GoogleConnectionDto` and `GoogleCalendarDto` are imported from `src/shared/api.ts`, never re-declared in the screen.
  - Version ranges in dependencies — bears directly on the routing question below.
  - Portuguese in artifacts, with the ADR-0009 carve-out for visible copy.
  - Weakening tests to force green — the callback change is deliberately shaped so no existing assertion has to move (see Notes).
- Applicable architectural rules:
  - One Worker serves everything; `not_found_handling: "single-page-application"` already serves the SPA shell for any unmatched path, so a client-side route needs no server route (`wrangler.jsonc:12`).
  - `src/shared/` carries no DOM and no Worker globals — both new modules here are pure.
  - Layout standard §3: long flows (settings, diagnostics, export) are **routes with real history entries**, not sheets.
  - Guidelines §2.2: Android back is a close request; at the history root it leaves the app; **never** make a top-left arrow the only way out of a screen.
  - Guidelines §8: an irreversible destructive action takes one confirmation that repeats the verb, destructive button second, default focus on *Cancelar*.
  - CON-007 — verify on Android; the back gesture is the reason the history entry is load-bearing rather than cosmetic.
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/google-calendar-read.prd.md` — Implementation Phases row 5: "Consent, made visible" — Goal: *finish FR-030 and FR-027 as product, not as a terminal ritual* — Success signal: *the owner connects, changes which calendars feed the day, and disconnects — all from inside the app, never from a shell*.

## Summary

Phase 2 and phase 3 shipped every HTTP route this phase needs — connect, connection status, disconnect, calendar list, calendar selection — and **not one of the five has a client caller**. `src/app/api.ts` reaches Google exactly once, through `fetchGoogleEvents`, and that is a sixth route (`/events`) belonging to phase 3 — none of the five this phase needs. This phase builds the screen, and to do it must first create the thing the app has never had: a second destination. The layout standard already decided settings is a **route with a real history entry**, not a sheet, so the work splits in two: a navigation seam (a pure route module in `src/shared/`, a thin `history` adapter, a switch in `App.tsx`, an entry point in the header) and the settings screen itself (connection status, connect, the calendar picker, disconnect with an honest confirmation). It also closes the return leg of the OAuth round-trip, which the callback's own comment promised to phase 4 and phase 4 did not deliver.

## User Story

As the owner,
I want to connect my Google calendar, choose which calendars feed my day, and disconnect — from inside Praesto,
So that consent is something the product asks for and I can withdraw, rather than something I arrange with `curl` and a terminal.

## Problem Statement

Narrowed to this phase from the PRD: three MoSCoW **Must** capabilities — in-app connect, in-app disconnect, calendar selection — have working routes and no way for the owner to reach them. FR-030 says he "can connect and disconnect the external calendar with explicit consent"; today that sentence is true only of someone holding a bearer token and a shell. The PRD's Decisions Log explicitly rejected out-of-band OAuth *because* it "would leave FR-030 satisfied by the owner and a terminal rather than by the product" — and without this phase, that is exactly where the unit lands.

## Solution Statement

Give the app a second destination and put the consent surface on it. The route is `/settings`, entered from a 48 px icon button in the *Hoje* header (§2.1 allows up to three and one is used), backed by a real `history.pushState` entry so Android's back gesture returns to *Hoje* and, from *Hoje*, leaves the app. The screen reads `GET /api/google/connection` and renders one of four honest states; when connected it lists the owner's calendars from `GET /api/google/calendars` with the never-chosen default already resolved to `primary` server-side, and saves a selection with `PUT`. Disconnect takes a confirmation that repeats the verb, and reports what actually happened — the route already returns `revokedAtGoogle` precisely so the UI can distinguish a real revocation from a local-only one. Finally the OAuth callback stops rendering a dead-end page on success and redirects into `/settings`, closing the loop the User Flow describes in step 5.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | Medium-High — the screen is ordinary, the navigation seam is new and cross-cutting |
| Systems Affected | `src/shared/` (2 new pure modules), `src/app/` (new screen, new hook, header, App switch, API client), `src/worker/routes/oauth-callback.ts` (success leg only) |
| Dependencies | Phase 4 (`implemented`). All five routes exist since phases 2–3; no schema change, no migration, no new dependency |
| Estimated Tasks | 9 |
| Source PRD line ref | `PRPs/prds/google-calendar-read.prd.md:187` (Implementation Phases row 5); Phase Details at `:226-229` — note the PRD interleaves them, because row 5 was appended on 2026-08-29 and its block sits *before* phase 4's at `:233` |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `documentation/40-engineering/ui-layout-standard.md` | §1, §2.1, §3, §5, §6 | §3 is the rule that makes this a route and not a sheet; §2.1 authorises the header icon button; §6 routes unit 4's picker and disconnect to settings; §5 says settings stays a header icon on desktop, no rail |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | §2.2, §8, §9, §10 | §2.2 governs back; §8 is the state table the screen must satisfy (loading, empty, request error, offline, destructive-irreversible); §9 is the pt-BR copy mechanics; §10 is the Level A bar. The review checklist at the end is mandatory on this change |
| P0 | `src/worker/routes/google.ts` | 60-260 | The five routes this screen calls, and their exact contracts — including the two that refuse (`PUT` on an empty array; `PUT` on an id Google did not list) |
| P0 | `src/shared/api.ts` | 42-111 | `GoogleConnectionDto` and `GoogleCalendarDto` — imported, never re-declared |
| P0 | `src/app/api.ts` | 63-89, 158-163 | `request<T>()` is the only place the bearer token, the 401 route-to-gate and the `reason` unwrapping live; `fetchGoogleEvents` is the shape every new wrapper copies |
| P1 | `src/shared/task-sheet.ts` | 1-40 | The reducer pattern both new `src/shared/` modules follow, and its docstring stating the exempt-glue split verbatim |
| P1 | `src/app/components/TaskSheet.tsx` | 176-187 | The `ConfirmView` idiom the disconnect confirmation copies |
| P1 | `src/app/components/TodayScreen.tsx` | 92-128, 199 | The agenda's own state atoms and `refreshEvents()` — the connection vocabulary this screen must agree with, and the function a saved selection should re-trigger |
| P1 | `src/app/App.tsx` | 16-73 | The binary switch this phase turns into token-gate-then-route |
| P1 | `src/worker/routes/oauth-callback.ts` | 34-40, 115-129 | The refusal helper that must keep answering 400 (AC-2), and the success leg that becomes a redirect |
| P2 | `docs/context/methodology.md` | "Browser-API work" section | Why `history`/`popstate` glue is exempt only after the decidable half moves to `src/shared/` |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-sheet.ts:1-13
/**
 * The sheet's state machine (PRD AC-11, AC-12) — which Task the detail sheet
 * is editing, which view it shows, and one draft per Task kept for the
 * session. Total and side-effect free, like `src/shared/connectivity.ts` and
 * `src/shared/toast.ts`: it only reduces the events it is handed and never
 * touches the DOM, a timer or the network.
 *
 * The native `<dialog>`, the fields and the `updateTask` / `deleteTask`
 * requests are React glue in `src/app/components/TaskSheet.tsx` and
 * `src/app/components/TodayScreen.tsx` — the exempt half of
 * `docs/context/methodology.md`'s "Browser-API work" split. This module is
 * the decidable half, authored test-first (`test/task-sheet.test.ts`).
 */
```
Copied by **Task 1** (`src/shared/app-route.ts`) and **Task 2** (`src/shared/google-settings.ts`) — both are the decidable half of a surface whose glue is exempt, and both must say so in the same words so the split stays legible.

```ts
# SOURCE: src/shared/task-sheet.ts:29-40
export type SheetView = "detail" | "confirm";

export interface TaskSheetState {
  taskId: string | null;
  view: SheetView;
  drafts: Readonly<Record<string, TaskDraft>>;
}

export const INITIAL_TASK_SHEET_STATE: TaskSheetState = {
  taskId: null,
  view: "detail",
  drafts: {},
```
Copied by **Task 2** — a named state type, a `Readonly` draft slot, and an exported initial constant, so the reducer is callable from a test with no React at all.

```ts
# SOURCE: src/app/api.ts:63-72
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body != null) headers.set("Content-Type", "application/json");

  const token = await readToken();
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
```
Copied by **Task 4** — every new Google wrapper goes through `request<T>()` and adds nothing of its own, so the bearer token, the 401-clears-and-routes-to-the-gate behaviour and the `reason` unwrapping stay in exactly one place.

```ts
# SOURCE: src/app/api.ts:161-163
export async function fetchGoogleEvents(): Promise<GoogleEventsDto> {
  return request<GoogleEventsDto>("/api/google/events");
}
```
Copied by **Task 4** — the literal shape of the five wrappers this phase adds.

```tsx
# SOURCE: src/app/components/TodayHeader.tsx:48-50
        <Button type="button" variant="icon" aria-label={filterLabel} onClick={onOpenFilters}>
```
Copied by **Task 7** — `variant="icon"` and an `aria-label` carrying the destination in words, since an icon-only control must be named (guidelines §10, checklist item 6).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:176-187
        <ConfirmView
          title="Excluir esta tarefa?"
          body="Não dá para desfazer."
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
          busy={busy}
          error={error}
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
        />
```
Copied by **Task 6** — the disconnect confirmation is this component with different copy, never a new dialog. `ConfirmView` already auto-focuses *Cancelar* and refuses to colour-code the destructive button, which is guidelines §8 satisfied by reuse rather than by discipline.

```ts
# SOURCE: src/worker/routes/oauth-callback.ts:34-40
/** Refusals are 4xx and say nothing about why, beyond what the owner needs. */
function refuse(reason: string): Response {
  return new Response(`Não foi possível concluir a conexão com o Google: ${reason}`, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```
Read — not modified — by **Task 9**. It is quoted here because the task's hardest constraint is what it must NOT touch: PRD AC-2 requires the refusal path to answer 4xx, so only the success leg becomes a redirect.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/app-route.ts` | CREATE | The decidable half of navigation: path → route and route → path, pure, so the seam is tested before any `history` call exists |
| `src/shared/google-settings.ts` | CREATE | The settings screen's state machine — connection state, the calendar-selection draft, and the rule that an empty selection cannot be saved |
| `src/app/hooks/useRoute.ts` | CREATE | The exempt adapter: `pushState`, `popstate`, and `history.scrollRestoration = "manual"` (guidelines §12.4). No decisions live here |
| `src/app/api.ts` | UPDATE | Add the five missing Google wrappers; `fetchGoogleEvents` is currently the only one that exists |
| `src/app/components/SettingsScreen.tsx` | CREATE | The route's screen: header with a back affordance that is not the only way out, wordmark (§2.1), and the connection card |
| `src/app/components/GoogleConnectionCard.tsx` | CREATE | Connection status, connect, the calendar picker and disconnect — the three Musts, in one place |
| `src/app/components/TodayHeader.tsx` | UPDATE | Add the settings icon button, the second of the three §2.1 allows |
| `src/app/App.tsx` | UPDATE | Token gate first, then route — the switch stops being binary |
| `src/worker/routes/oauth-callback.ts` | UPDATE | The success leg redirects into `/settings` instead of rendering a dead-end page; the refusal leg is untouched |

## NOT Building (Scope Limits)

- **A router dependency.** `react-router` and friends are not added. Two destinations do not justify a runtime dependency under ADR-0005's exact-pin discipline; if a third and fourth destination arrive (units 5, 6, 8 all want settings routes), revisiting it is a decision with an ADR, not a silent import. Recorded in Notes with the reasoning, so the next phase inherits an argument rather than an accident.
- **Any other settings content.** Export (unit 5), notifications (unit 6), diagnostics (unit 6) and adherence (units 9–12) all route to settings per layout standard §6. This phase builds the screen and puts *one* card on it. It does not invent an information architecture for content that does not exist.
- **Changing what `/api/google/*` does.** Every route is shipped and code-reviewed. This phase writes callers, not routes. The single Worker change is the callback's success status.
- **Widening the OAuth scope set or the mirror inventory.** Unchanged from phase 2.
- **Anything written to Google.** Unit 15.
- **Deep-linking, query-param routing, or more than one route.** `/settings` and `/` — nothing else. `?google=connected` is read once on arrival and cleared, not a routing mechanism.
- **A light theme, a rail, or a bottom bar.** The §1 flip rule has not fired: settings is not a destination of equal daily weight.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/app-route.ts`

**ACTION**: Write the pure route module. Export `type AppRoute = "today" | "settings"`, `routeFromPath(pathname: string): AppRoute` and `pathOf(route: AppRoute): string`, with `"/"` ↔ `today` and `"/settings"` ↔ `settings`. Any unrecognised path resolves to `today` rather than throwing — `not_found_handling: "single-page-application"` means the SPA shell is served for *every* unmatched path, so an unknown path is a real, reachable input, not an error case. Accept a trailing slash. Open the file with the docstring shape of `task-sheet.ts`, naming this the decidable half and `src/app/hooks/useRoute.ts` the exempt glue. **The path stays English (`/settings`, not `/configuracoes`):** ADR-0009's carve-out covers "the string values the owner reads on screen (labels, buttons, placeholders, states, notifications, manifest text)" and does not name URLs, so ADR-0001 governs and the existing dev-only `/design` route is the in-repo precedent. Record that reasoning in the docstring so it is not re-litigated. Serves **AC-A6**.

**MIRROR**: `# SOURCE: src/shared/task-sheet.ts:1-13`

**VALIDATE**: `npx tsc -b && npx vitest run --project worker test/app-route.test.ts`

### Task 2: CREATE `src/shared/google-settings.ts`

**ACTION**: Write the settings screen's state machine, pure and total. Model the connection as a named union of exactly four kinds — `loading`, `disconnected`, `connected`, `failed` — where **`failed` carries a `reason`**, mirroring `AgendaState` in `TodayScreen.tsx:92-98` character for character in shape. "Needs reconnection" is a **`reason` on `failed`, never a fifth kind**: the shipped screen already separates "connect" from "reconnect" from "try later" by that field alone, and adding a sibling state here would create the second vocabulary AC-A7 exists to forbid. `disconnected` is a steady state, not a failure — it is what `GET /connection` returning `{ connection: null }` means. Hold the calendar list plus a selection draft (`Readonly<Set<string>>` or a readonly id array) alongside it. Export `INITIAL_GOOGLE_SETTINGS_STATE`, a `reduceGoogleSettings(state, event)` reducer, and the two derived predicates the screen needs: `canSaveSelection(state)` (false while the draft is empty, false while it equals what is stored, false while a save is in flight) and `selectionChanged(state)`. **The empty-draft rule is not cosmetic:** `PUT /api/google/calendars` answers 400 on an empty array on purpose, because zero stored rows is how "never chosen" is encoded and saving nothing would silently re-enable `primary` — the opposite of what the owner asked. The screen must therefore make the empty state unsaveable rather than discover it through a failed request. Use the connection vocabulary `TodayScreen` already renders so the two screens cannot contradict each other. Serves **AC-A4**, **AC-A5**, **AC-A7**.

**MIRROR**: `# SOURCE: src/shared/task-sheet.ts:29-40`

**VALIDATE**: `npx tsc -b && npx vitest run --project worker test/google-settings.test.ts`

### Task 3: CREATE `src/app/hooks/useRoute.ts`

**ACTION**: Write the thin `history` adapter — and nothing else. It returns the current `AppRoute` (from `routeFromPath(window.location.pathname)`), a `navigate(route)` that calls `history.pushState` with `pathOf(route)`, and a `popstate` listener that re-derives the route on back/forward. Set `history.scrollRestoration = "manual"` once, per guidelines §12.4. No decision may live in this file: every branch belongs in `src/shared/app-route.ts`, which is what makes this glue exempt under `docs/context/methodology.md`'s "Browser-API work" rule rather than untested logic. Remove the listener on unmount. Serves **AC-A6**.

**MIRROR**: `# SOURCE: src/shared/task-sheet.ts:1-13` (the exempt-glue half of the same split)

**VALIDATE**: `npx tsc -b && npx eslint src/app/hooks/useRoute.ts`

### Task 4: UPDATE `src/app/api.ts`

**ACTION**: Add the five missing Google wrappers, each a one-liner over `request<T>()` exactly like `fetchGoogleEvents`: `startGoogleConnect(): Promise<{ consentUrl: string }>` (POST `/api/google/connect`), `fetchGoogleConnection(): Promise<{ connection: GoogleConnectionDto | null }>` (GET `/api/google/connection`), `disconnectGoogle(): Promise<{ disconnected: boolean; revokedAtGoogle: boolean }>` (DELETE `/api/google/connection`), `fetchGoogleCalendars(): Promise<{ calendars: GoogleCalendarDto[] }>` (GET `/api/google/calendars`), and `saveGoogleCalendars(calendarIds: string[]): Promise<{ calendarIds: string[] }>` (PUT `/api/google/calendars`, JSON body). Import the DTOs from `src/shared/api.ts`; declare no local types. Do not catch or re-map errors — `request<T>()` already turns a body's `reason` into `ApiError.reason`, which is what lets the screen tell "not connected" from "reconnect" from "try later". Serves **AC-A1**, **AC-A3**, **AC-A4**.

**MIRROR**: `# SOURCE: src/app/api.ts:161-163`

**VALIDATE**: `npx tsc -b && npx eslint src/app/api.ts`

### Task 5: CREATE `src/app/components/SettingsScreen.tsx`

**ACTION**: Build the route's shell: the same `100dvh` grid as *Hoje* (header / scrolling content), an `<h1>` reading *Configurações*, the flat wordmark in the header (§2.1 puts it on the splash, the settings screen and the desktop rail), and a back affordance that navigates to `today`. Per guidelines §2.2 the arrow must **not** be the only way out — Android back and `Esc` must also return, which they do because Task 3 pushed a real history entry; say so in a comment so a later refactor does not quietly remove the entry and leave the arrow load-bearing. Render the offline banner on this screen too (§8 makes it mandatory on every screen) and render `GoogleConnectionCard` as the only content. Copy is pt-BR, sentence case, `você` (§9).

**Also own the return leg's client half, which no other task can.** On mount, read `?google=connected` from `window.location.search`; when present, show an explicit confirmation that the connection succeeded — per the OAuth guidance that a user redirected back into an app has no other signal that it worked — and then clear the parameter with `history.replaceState` so a reload does not re-announce a connection that happened minutes ago. Task 9 changes what the Worker *sends*; this task is the only one whose scope includes the screen that *receives* it, so the behaviour is written here rather than described in a task that cannot implement it. Serves **AC-A2**, **AC-A6**.

**MIRROR**: `# SOURCE: src/app/components/TodayHeader.tsx:48-50`

**VALIDATE**: `npx tsc -b && npx eslint src/app/components/SettingsScreen.tsx`

### Task 6: CREATE `src/app/components/GoogleConnectionCard.tsx`

**ACTION**: Render **all four** of Task 2's kinds — one branch each, none omitted — plus the three Musts. **Loading:** a skeleton mirroring the card's final shape while `GET /connection` is in flight, per guidelines §8 (indicator only after 300–500 ms, no flash on a fast answer). **Disconnected:** one sentence saying what connecting does and a *Conectar* button that calls `startGoogleConnect()` then sets `window.location.href` to the returned `consentUrl` — warn in the copy, before the tap, that Google will show an unverified-app screen, because that warning is permanent for this app and an unprepared owner reads it as a failure. **Connected:** the account's scope summary from `GoogleConnectionDto`, the calendar list as toggles, and a *Salvar* button disabled unless `canSaveSelection(state)`; when the draft is empty, say *Escolha ao menos um calendário. Para não ver nada do Google, desconecte.* rather than letting the server's 400 arrive. On a successful save, re-trigger the day's events so the change is visible where it matters. **Failed:** one branch, three readings taken from `reason` exactly as *Hoje* does — reuse its `AGENDA.notConnected`, `AGENDA.reconnect` and `AGENDA.failed` strings rather than writing new ones, since those are owner approvals of 2026-08-28 and a second phrasing for one condition is precisely what AC-A7 forbids. The §8 request-error shape applies, action still enabled for retry. **Disconnect** opens `ConfirmView` with *Desconectar do Google?* / *Cancelar* / *Desconectar* — §8's irreversible rule, because reconnecting costs the whole consent round-trip including that interstitial. Afterwards, report what actually happened: `revokedAtGoogle: true` reads as revoked at Google; `false` must say the local credential was removed but Google may still list the grant, and point at Google's account permissions page. That distinction is not optional — PRD AC-5 makes the `false` branch a real, reachable outcome, and the route returns the flag for exactly this purpose. Serves **AC-A1**, **AC-A3**, **AC-A4**, **AC-A5**, **AC-A7**.

**MIRROR**: `# SOURCE: src/app/components/TaskSheet.tsx:176-187`

**VALIDATE**: `npx tsc -b && npx eslint src/app/components/GoogleConnectionCard.tsx`

### Task 7: UPDATE `src/app/components/TodayHeader.tsx`

**ACTION**: Add a second 48 px icon button to the right cluster — a `Settings` glyph from `lucide-react`, `variant="icon"`, `aria-label="Configurações"` — calling a new `onOpenSettings` prop. It sits after the filter button, per §2.1's ordering (filters, then search, then settings; search is unit 8 and absent). Keep the existing button byte-unchanged. The glyph is decorative and takes `aria-hidden="true"`, with the name carried by the label. Serves **AC-A6**.

**MIRROR**: `# SOURCE: src/app/components/TodayHeader.tsx:48-50`

**VALIDATE**: `npx tsc -b && npx eslint src/app/components/TodayHeader.tsx`

### Task 8: UPDATE `src/app/App.tsx`

**ACTION**: Turn the binary switch into token-gate-then-route. The `authorized === null` skeleton and the `TokenGate` branch stay exactly as they are and stay **first** — an unauthenticated visitor to `/settings` must reach the token gate, not the settings screen. Below them, call `useRoute()` and render `TodayScreen` or `SettingsScreen`. Thread `navigate` down so the header button and the back affordance can move between them. Keep `onUnauthorized` working from both screens. Serves **AC-A6**.

**MIRROR**: `# SOURCE: src/shared/task-sheet.ts:1-13` (the same glue/decision split — `App.tsx` renders, `app-route.ts` decides)

**VALIDATE**: `npx tsc -b && npx eslint src/app/App.tsx`

### Task 9: UPDATE `src/worker/routes/oauth-callback.ts`

**ACTION**: Replace the success response only. Where the route currently returns `Pode fechar esta aba e voltar ao Praesto.` as `text/plain`, return a redirect to `/settings?google=connected` instead, so the owner lands back in the app rather than on a dead end — the file's own comment already promised this ("Phase 4 replaces this with a redirect into the app"), and phase 4's scope never included it. This also stops the authorization code from surviving in the address bar, which is what Google's web-server OAuth guidance asks for. **Do not touch `refuse()`**: PRD AC-2 requires the refusal path to answer 4xx and makes it the property that admits an unauthenticated route at all; turning refusals into redirects would break it. Rewrite the comment above the success response so it describes what the code now does instead of what a future phase will do. The client half of this round-trip — reading `?google=connected`, confirming, and clearing it — belongs to **Task 5**, which owns `SettingsScreen.tsx`; this task changes only what the Worker sends. Serves **AC-A2**.

**MIRROR**: `# SOURCE: src/worker/routes/oauth-callback.ts:34-40` (quoted for what must NOT change)

**VALIDATE**: `npx vitest run --project worker test/oauth-callback.test.ts`

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

**Level 2 — UNIT_TESTS**

```bash
set -euo pipefail
npm test
```

**Level 3 — INTEGRATION / CONTENT_INVARIANTS**

```bash
set -euo pipefail

# The build must produce a bundle, not just type-check.
npm run build

# The callback returns the owner to the app on success...
grep -q '/settings?google=connected' src/worker/routes/oauth-callback.ts

# ...and PRD AC-2 is not collateral damage: refusals still answer 4xx.
grep -q 'status: 400' src/worker/routes/oauth-callback.ts

# The dead-end page is gone.
if grep -q 'Pode fechar esta aba' src/worker/routes/oauth-callback.ts; then
  echo "FAIL: the callback still renders the dead-end page"; exit 1
fi

# Both greps below must run against files that exist, or a missing file would
# make grep exit 2, the `if` read false, and the gate pass while checking
# nothing. Assert existence first so the gates can actually fail.
test -f src/app/hooks/useRoute.ts
test -f src/shared/app-route.ts

# The route decision lives in the pure module, never in the React glue:
# a path literal in the hook would mean the seam is untestable again.
if grep -n "/settings" src/app/hooks/useRoute.ts; then
  echo "FAIL: a path literal escaped into the exempt glue"; exit 1
fi

# The DTOs are imported, never re-declared (anti-pattern: hand-duplicated
# types). `-r` is required: grep on a bare directory exits 2, which would make
# this gate pass by erroring rather than by finding nothing.
if grep -rnE 'interface (GoogleConnectionDto|GoogleCalendarDto)' src/app/; then
  echo "FAIL: a wire DTO was re-declared in the app layer"; exit 1
fi

echo "PASS: callback closes the loop, AC-2 intact, route decisions stay in src/shared"
```

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** Given the owner is on `/settings` and not connected, when he taps *Conectar*, then the app calls `POST /api/google/connect` and sends the browser to the returned `consentUrl` — and the copy warned him about the unverified-app screen before he got there.
- **AC-A2 (PRD AC-3):** Given a valid OAuth callback, when it completes, then it answers a redirect into `/settings?google=connected` rather than a plain-text page, the owner sees an explicit confirmation, and the query parameter is cleared from the URL. Refusals still answer 4xx (PRD AC-2 unchanged).
- **AC-A3 (PRD AC-4):** Given a stored connection, when the owner taps *Desconectar* and confirms in a dialog that repeats the verb, then `DELETE /api/google/connection` runs and the screen reports which of the two outcomes occurred — revoked at Google, or removed locally with the grant possibly still listed there — never one phrasing for both.
- **AC-A4 (PRD AC-15):** Given a connection and no selection ever made, when the settings screen loads the calendar list, then `primary` shows as selected (the server resolves the never-chosen default), and toggling a calendar and saving persists through `PUT /api/google/calendars` and is reflected in the day's events.
- **AC-A5 (PRD AC-15):** Given the owner has deselected every calendar, when he looks at *Salvar*, then it is disabled and the screen says to pick at least one or to disconnect — the request that would answer 400 is never sent.
- **AC-A6 (PRD AC-1, AC-4, AC-15):** Given the owner opens settings from the *Hoje* header, when he presses Android back (or `Esc`, or the header's back affordance), then he returns to *Hoje*; and pressing back again from *Hoje* leaves the app rather than being trapped. `/settings` is a real history entry, not a sheet.
- **AC-A7 (PRD AC-11):** Given the refresh token is dead, when the owner sees the state on *Hoje* and on the settings screen, then both name the condition with the same words and offer the same next step — one condition, one vocabulary. This is a consistency guard on a criterion phase 4 already shipped, not new scope: AC-11 is the reason *Hoje* has that state at all, and a settings screen that phrased it differently would make one condition read as two.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The navigation seam is bigger than "a settings screen" and is the real cost of this phase — five later units plug into it | H | M | It is built as a pure module plus ~20 lines of glue, so it is testable before the screen exists and replaceable later without touching any screen. The alternative (a router dependency) is recorded in Notes with its reasoning rather than left as an open question |
| Turning the callback's success into a redirect breaks a shipped acceptance criterion | M | H | Verified before planning: `test/oauth-callback.test.ts:164` asserts `status < 400` on success, which a 302 satisfies. **One assertion does read the body** — `:202-208` checks the response never echoes the refresh token — and it survives, because a redirect's body is empty and an empty body contains no token. That is the reason it holds, not an absence of body assertions. AC-2's refusal path is explicitly out of Task 9's scope, and Level 3 greps for the 400 to keep it that way |
| An unauthenticated visit to `/settings` renders the settings screen | M | H | Task 8 keeps the token gate strictly ahead of the route switch, and the routes are bearer-gated server-side regardless — the screen would show request errors, not data. Stated as a task constraint rather than assumed |
| The disconnect copy claims a revocation that did not happen | M | M | AC-5 makes `revokedAtGoogle: false` a real branch and the route already returns the flag for this purpose; AC-A3 makes reporting both branches a criterion, not a nicety |
| The screen invents a second vocabulary for "token expired", contradicting *Hoje* | M | M | AC-A7 makes agreement a criterion. Task 2 cannot *import* `AgendaState` — it is unexported at `TodayScreen.tsx:92` — so it defines its own union **mirroring that shape** and, more importantly, reuses the `AGENDA.*` copy constants verbatim. Agreement is enforced at the strings the owner reads, which is where a divergence would actually show |
| No design precedent exists for the calendar-picker sub-screen | M | L | Recorded, not filled with invention: web grounding returned connect/disconnect patterns only and found nothing for a personal-calendar checklist. The answer comes from the layout standard and the identity, as the PRD's own Open Question already anticipated |
| React component behaviour is not covered by any automated tier | H | M | Structural, not accidental: `docs/context/methodology.md` keeps component verification manual. The decidable halves are in `src/shared/` precisely so the untested surface is as small as possible, and the phase closes with a device pass on Android and Windows plus the mandatory guidelines checklist |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, which is what makes that claim verifiable rather than self-asserted. Where a task's `**VALIDATE**` names a suite (Tasks 1, 2 and 9) it *invokes* the suite the pair will have authored; it never creates or edits one. The remaining tasks validate through `tsc -b` and `eslint`, because React component behaviour has no automated tier here (`docs/context/methodology.md`).

- **Why no router dependency, argued rather than assumed.** The app has exactly two destinations. A router is a runtime dependency under ADR-0005's exact-pin discipline, and ADR-0011's whole posture is components we own over libraries we bend. `history.pushState` + `popstate` is ~20 lines and the decision half is a pure function this project already writes five times over (`connectivity.ts`, `toast.ts`, `task-sheet.ts`, `task-filter.ts`, `day-groups.ts`). The recorded revisit trigger: when a third and fourth route arrive with nested or parameterised paths — units 5, 6, 8 and 9–12 all route to settings per layout standard §6 — reconsider, as an ADR with a measured bundle cost, never as an incidental import. **This is the largest judgement call in the phase and the owner may overrule it before implementation.**

- **Why the URL is English.** ADR-0009's carve-out names "labels, buttons, placeholders, states, notifications, manifest text" — not URLs — so ADR-0001 governs and the path is `/settings`. The dev-only `/design` route is the existing precedent. Recorded because the address bar *is* visible to the owner, which makes this a real question rather than an obvious one.

- **What phase 4 left behind, and this phase collects.** `src/worker/routes/oauth-callback.ts:124` says "Phase 4 replaces this with a redirect into the app". Phase 4's scope was rows, the failure state, copy and filters; the return leg was never in it. The comment outlived the phase it named, which is how a promise becomes a stale claim. Task 9 makes it true and the comment is rewritten to describe what the code does rather than what a future phase will do.

- **The web grounding's honest gap.** Research found connect/disconnect precedent only in multi-tenant B2B integration platforms (WorkOS, Apaleo) and Google's own revoke flow; it found **nothing** for a single-owner personal app, and nothing at all for a "choose which of your own calendars to sync" checklist. That matches the Open Question the PRD already recorded on 2026-08-25. The design comes from `ui-layout-standard` and `visual-identity`, as that question predicted — recorded as a gap rather than papered over with an invented precedent.

- **The guidelines review checklist is mandatory on this change** and must be run item by item, with the ✔/✘ result pasted into the phase record. It has now found a real defect on each of its last two runs (a 56 px row in phase 4; a stale font budget in §11 the same day), which is the argument for running it rather than declaring it.

- **Device verification closes this phase**, on Android and Windows both, per CON-007 and the phase-4 precedent. Specifically: the back gesture returning from `/settings` to *Hoje*, and then leaving the app from *Hoje* rather than being trapped — the one behaviour no automated tier here can reach.

*Generated: 2026-08-30*
*Approved: 2026-08-30*
*Status: APPROVED*
