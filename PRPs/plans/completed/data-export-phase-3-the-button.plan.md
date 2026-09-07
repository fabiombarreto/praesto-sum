# Feature: The button (Phase 3 of data-export)

```
**Decision Gate**
- Active context: none
- Activated criteria: interface change under `src/app/` (mandatory UI/UX guidelines + review checklist per CLAUDE.md); credential handling on the client (the bearer token must reach the export routes without leaking into a URL, history or logs); an APPROVED PRD's phase table gaining a documentation-amendment obligation (`docs/decisions.md` 2026-08-29 entry: an APPROVED artifact's own downstream doc may need a dated correction when building it finds the written rule wrong)
- Decisions found:
  - ADR-0003 — binding safeguard "day-1 JSON+iCalendar export"; this phase is the "one click" clause of that safeguard, not the data itself (phases 1-2 already shipped the routes)
  - ADR-0009 — visible UI copy is pt-BR ("Baixar meus dados", "Baixar agenda (.ics)"); identifiers, comments and tests stay English
  - ADR-0011 — owned shadcn-style components under `src/app/components/ui/`; the new card reuses `Button` and the existing `role="alert"` inline-error idiom rather than a bespoke control
  - `docs/decisions.md` 2026-08-29 — an APPROVED PRD's phase table may gain a dated amendment row when a downstream doc is found wrong mid-unit; the same discipline extends here to `ui-layout-standard.md` itself, whose own frontmatter and `documentation/README.md`'s maintenance map require exactly this: amend in place, dated, with a History row, never leaving the built screen and the written rule disagreeing
  - `documentation/README.md` maintenance map, row "A screen does not fit the layout anatomy..." — amending `ui-layout-standard.md` also earns a History line in `documentation/50-planning/ui-ux-plan.md`
  - `documentation/40-engineering/ui-layout-standard.md` History, 2026-08-24 — the precedent for correcting a written rule in place, dated, with the retired wording named so a later reader can find it (used here for the same discipline, not re-litigated)
- Applicable anti-patterns:
  - Portuguese in artifacts (`docs/anti-patterns.md:105-112`) — the button labels and toast/error copy are pt-BR by the ADR-0009 carve-out; every identifier, comment and test name around them stays English
  - Weakening tests to force green (`docs/anti-patterns.md:121`) — not directly exercised (this phase's only automated test target is the new pure parser), but the parser's sanitization behavior (rejecting `.`/`..`/empty results) is exactly the kind of guard a later "simplification" could quietly drop
  - Hand-duplicated entity types (`docs/anti-patterns.md:91-97`) — not applicable to this phase's scope (no new entity), noted for completeness
- Applicable architectural rules:
  - `app.use("/api/*", requireToken)` already gates `/api/export` and `/api/export.ics` (`src/worker/index.ts:19,24-25`) — this phase's only job is getting the bearer token onto the request as a header, never as a query string
  - `src/shared/` carries no DOM and no Worker globals and reads no clock — the new Content-Disposition parser lives there, pure and import-free like `src/shared/dates.ts`
  - `docs/context/methodology.md`'s "Browser-API work" split — the decidable filename-parsing logic is extracted to `src/shared/` and tested first; the click/object-URL glue and the React card are the exempt, manually-verified half
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/data-export.prd.md` — Implementation Phases row 3: "The button" — Goal: The export stops requiring a terminal. — Success signal: AC-9 passes, verified on both the Windows PC and the Android phone, with the checklist result recorded.

## Summary

This phase adds one card, `DataExportCard`, to the existing `/settings` route, with two independent controls — *Baixar meus dados* (the JSON dump) and *Baixar agenda (.ics)* (the calendar file) — per the owner's explicit decision to keep the two exports as two separate taps rather than one combined action. Because both routes require an `Authorization: Bearer` header that a plain `<a href download>` anchor cannot send, each control fetches the file as a `Blob`, derives the save-dialog filename from the response's `Content-Disposition` header (never a second, hand-maintained naming convention on the client), and triggers the browser's download via a short-lived `URL.createObjectURL` anchor that is revoked immediately after the click. The decidable part of that — parsing the filename out of the header — is a new pure module in `src/shared/`, authored test-first; the fetch-and-click glue and the card's JSX are manually verified, per the project's standing "Browser-API work" split. A failed download surfaces as a persistent inline error next to the control that failed (guidelines §8's *Request error* rule), never a transient toast, because a failed backup silently disappearing after four seconds could let the owner believe it worked; a successful download still confirms with a toast, since the browser's own download indicator already carries the file itself. Because the owner's two-button decision and the inline-persistent-failure decision both contradict `ui-layout-standard.md` §6's current one-line description of this unit ("A settings route with one action; result as a toast"), this phase also carries the dated in-place correction of that row plus the History rows both `ui-layout-standard.md` and `ui-ux-plan.md` require for it.

## User Story

```
As the owner
I want to download my complete data and my calendar file with one tap each, from Settings
So that the export stops requiring a terminal and curl
```

## Problem Statement

Phases 1 and 2 shipped `GET /api/export` and `GET /api/export.ics`, both reachable only with a `curl -H "Authorization: Bearer <token>"` invocation. `documentation/50-planning/roadmap.md`'s own MoSCoW table names "A download control on `/settings`" a Must — "'One click' is the unit's stated outcome" — and it does not exist yet: `SettingsScreen.tsx` renders exactly one card (`GoogleConnectionCard`) today, and no code anywhere in `src/app/` fetches a `Blob`, builds an object URL, or reads `Content-Disposition`.

## Solution Statement

A new pure module, `src/shared/content-disposition.ts`, exports `parseFilenameFromContentDisposition(header: string | null): string | null`, which extracts the RFC 6266 `filename*` (preferred, percent-decoded) or `filename` parameter from a raw header value and sanitizes the result to its last path segment, returning `null` for an empty, `.` or `..` result rather than trusting the header as a literal path. The same module also exports `exportFilename(header: string | null, kind: "json" | "ics"): string`, a thin wrapper that returns the parser's result when non-`null` and otherwise the one hardcoded fallback literal, `praesto-export.<ext>` — the sole definition of that literal anywhere in the codebase, reachable by the same test tier that already covers the parser (defensive; AC-6 already guarantees the Worker always sends a header, so this path is unreachable in normal operation, but a mistyped literal here would previously have gone uncaught by both the automated suite and the manual device pass). `src/app/api.ts` gains `fetchExportFile(path)`, mirroring the existing `request<T>()` helper's token/401 handling but reading `response.blob()` instead of `response.json()` and calling `exportFilename` for the filename — `api.ts` holds no filename literal of its own. A new `src/app/download.ts` exports `triggerBrowserDownload(blob, filename)` — the `URL.createObjectURL` / programmatic-anchor-click / `URL.revokeObjectURL` sequence, exempt glue verified manually. `DataExportCard.tsx` wires two independent controls to these two helpers, mirroring `GoogleConnectionCard`'s local-state, delayed-busy-indicator and inline-`role="alert"`-error idiom exactly, and is mounted into `SettingsScreen.tsx` alongside the existing card. Both controls stay enabled regardless of `canWrite` — a download is a read, like `GoogleConnectionCard`'s own *Tentar de novo* precedent — so an offline attempt simply fails through the normal request-error path rather than being preemptively disabled. Finally, `ui-layout-standard.md` §6 and `ui-ux-plan.md`'s History both receive the dated correction this contradiction requires.

## Metadata

| Key | Value |
|-----|-------|
| Type | Feature |
| Complexity | Small |
| Systems Affected | `src/shared/` (new pure module), `src/app/` (new card + `api.ts`/`download.ts` additions + `SettingsScreen.tsx` mount), `documentation/40-engineering/ui-layout-standard.md`, `documentation/50-planning/ui-ux-plan.md` |
| Dependencies | Phase 2 (`The calendar file`) — `complete`; reuses `/api/export` and `/api/export.ics`'s `Content-Disposition` shape, `readToken`/`clearToken`/`ApiError`/`request<T>` from `src/app/api.ts`, `useConnectivity`/`canWrite` from `src/shared/connectivity.ts`, `showToast` from `src/app/toast-store.ts`, `Button` from `src/app/components/ui/Button.tsx` |
| Estimated Tasks | 9 |
| Source PRD line ref | `PRPs/prds/data-export.prd.md` lines 172, 191-194 |
| phase_type | feature |

`phase_type: feature`, not `foundation`: every seam this phase needs (`request<T>`'s token/401 pattern, `canWrite`, `showToast`, the `Content-Disposition` shape both routes already emit) exists from phases 1-2, and AC-9 is directly verifiable against the shipped routes.

`design_source` and `phase_scope` are both omitted from this table: `docs/context/methodology.md` declares `figma_track: false`, and the source PRD carries no `## Visual-First Mode` section — neither conditional key applies, and the table stays at its unconditional shape.

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `src/app/components/GoogleConnectionCard.tsx` | 42-56, 100-133, 240-346 | The idiom this phase's `DataExportCard` mirrors directly: local `useState` per async action, a `canWrite`-doc-comment reasoning about which actions stay enabled offline, the 400 ms delayed-busy-indicator pattern, and the inline `role="alert"` error + retry-stays-enabled shape |
| P0 | `src/app/components/SettingsScreen.tsx` | 1-108 | The mount point — exactly one card renders today; this phase adds a second inside the same `<main>`, receiving the same `onUnauthorized` prop `GoogleConnectionCard` already receives |
| P0 | `src/app/api.ts` | 39-96 | `ApiError`, `readToken`/`clearToken`, and `request<T>()`'s token-attach/401-handling shape this phase's new `fetchExportFile` mirrors, substituting `response.blob()` for `response.json()` |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 75-92, 146-168 | §8's states table (the *Pending request* and *Request error* rows this phase's failure/busy states must satisfy) and the mandatory review checklist this phase must run and record |
| P1 | `src/worker/routes/export.ts` | 30-64 | The exact `Content-Disposition: attachment; filename="praesto-<date>.json"` shape the new parser must handle and `fetchExportFile`'s fallback filename must match in form |
| P1 | `src/worker/routes/export-ics.ts` | 17-34 | Same header shape for the `.ics` route (`.ics` extension) |
| P1 | `src/shared/connectivity.ts` | 33-65 | `canWrite(state)` and the reducer's own reasoning for why a GET-shaped read stays enabled offline while a write does not |
| P1 | `src/shared/dates.ts` | 1-22 | The no-imports, environment-agnostic module style the new `content-disposition.ts` mirrors |
| P1 | `documentation/40-engineering/ui-layout-standard.md` | 55-66, 68-76 | §6's unit-5 plug-in row this phase amends, and the History table's existing dated-correction convention (the 2026-08-24 rows) this phase's own correction mirrors |
| P2 | `documentation/50-planning/ui-ux-plan.md` | 169-197 | The `## History` table (newest-first, `| Date | What changed |`) this phase appends one row to, per `documentation/README.md`'s maintenance map |
| P2 | `src/app/toast-store.ts` | 40-58 | `showToast(spec)` — the success-only toast path this phase uses (`tone: "info"`, no `action`, so it auto-dismisses at 4 s) |

## Patterns to Mirror

```
# SOURCE: src/shared/dates.ts:1-22
/**
 * Date reasoning shared by both compile targets.
 * ...
 * This module carries no imports so it stays usable from the browser bundle
 * and the Worker alike, matching the constraint stated at the top of
 * `src/shared/api.ts`.
 */

export const PRAESTO_TIMEZONE = "America/Sao_Paulo";
```
Copied by Task 1's `src/shared/content-disposition.ts` — no imports, pure, environment-agnostic module doc comment style.

```
# SOURCE: src/app/api.ts:70-96
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body != null) headers.set("Content-Type", "application/json");

  const token = await readToken();
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });

  if (response.status === 401) {
    await clearToken();
    throw new ApiError(401, "Invalid or missing token");
  }
  ...
}
```
Copied by Task 3's `fetchExportFile` — same token-read/`Authorization`-header/401-clear sequence, diverging only where `request<T>` calls `response.json()`: `fetchExportFile` calls `response.blob()` and reads `Content-Disposition` instead.

```
# SOURCE: src/worker/routes/export.ts:57-63
const filename = `praesto-${todayIn(now)}.json`;
return new Response(JSON.stringify(envelope), {
  headers: {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```
Referenced by Task 1 (the exact header shape the parser must handle: a simple quoted ASCII `filename=`) and Task 2 (the fallback filename's naming convention, `praesto-export.<ext>`, kept in the same family and defined exactly once, inside `exportFilename`).

```
# SOURCE: src/app/components/GoogleConnectionCard.tsx:100-116
useEffect(() => {
  if (state.kind !== "loading") {
    setShowSkeleton(false);
    return;
  }
  // Guidelines §8, "Pending request": an indicator only after a 300–500 ms
  // delay, so a fast answer never flashes a skeleton the owner cannot
  // read.
  const timer = setTimeout(() => setShowSkeleton(true), 400);
  return () => clearTimeout(timer);
}, [state.kind]);
```
Copied by Task 5's `DataExportCard` for each control's own delayed-busy-label timer (400 ms), so a fast download never flashes a "Baixando…" label the owner cannot read.

```
# SOURCE: src/app/components/GoogleConnectionCard.tsx:240-252
<Button
  type="button"
  variant="primary"
  onClick={() => void handleConnect()}
  disabled={connecting || !canWrite}
>
  Conectar
</Button>
{connectError !== null && (
  <p role="alert" className="m-0 font-text text-t2 text-overdue">
    {connectError}
  </p>
)}
```
Copied by Task 5 for each of the two controls: a `Button` disabled only while its own request is in flight (never gated on `canWrite`, per this phase's read-stays-enabled decision), and a persistent inline `role="alert"` paragraph on failure — never a toast for the failure path.

```
# SOURCE: src/app/components/SettingsScreen.tsx:98-105
<main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
  {justConnected && ( ... )}
  <GoogleConnectionCard onUnauthorized={onUnauthorized} canWrite={canWrite(connectivity)} />
</main>
```
Copied by Task 6 — `DataExportCard` is added as a second child of the same `<main>`, receiving `onUnauthorized` the same way.

```
# EXTERNAL SOURCE: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
"To release an object URL, call revokeObjectURL()." — the browser holds a
strong reference to the Blob for as long as the object URL lives, which
would otherwise leak memory.
```
Grounds Task 4's `triggerBrowserDownload`: `URL.revokeObjectURL(url)` is called synchronously, immediately after the anchor's `click()`, with no in-repo precedent to copy from (this is the first blob-download code in the project).

```
# EXTERNAL SOURCE: https://www.rfc-editor.org/rfc/rfc6266
"Recipients SHOULD pick 'filename*' and ignore 'filename'" when both are
present; implementers should not trust the filename parameter as a literal
path — strip to the last path segment, reject ".", "..", and empty results.
```
Grounds Task 1's parser: prefer `filename*` (percent-decoded) over `filename`, and sanitize any parsed value to its last path segment, rejecting `.`/`..`/empty results rather than returning them.

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `src/shared/content-disposition.ts` | CREATE | Pure, DB-free, DOM-free filename parser plus `exportFilename`'s fallback-name decision — both decidable, so authored test-first per `docs/context/methodology.md`; the fallback literal lives here and nowhere else |
| `src/app/api.ts` | UPDATE | Add `fetchExportFile(path)` — the blob-returning sibling of `request<T>()` |
| `src/app/download.ts` | CREATE | `triggerBrowserDownload(blob, filename)` — the object-URL/anchor-click/revoke sequence; browser-API glue, manually verified |
| `src/app/components/DataExportCard.tsx` | CREATE | The settings card with the two download controls |
| `src/app/components/SettingsScreen.tsx` | UPDATE | Mount `DataExportCard` alongside `GoogleConnectionCard` |
| `documentation/40-engineering/ui-layout-standard.md` | UPDATE | §6's unit-5 row corrected in place (two actions, split success/failure feedback) + dated History row |
| `documentation/50-planning/ui-ux-plan.md` | UPDATE | History row recording the same amendment, per `documentation/README.md`'s maintenance map |

## NOT Building (Scope Limits)

- The unattended pull script and Windows Scheduled Task — phase 4 (AC-10, AC-11).
- Any change to what `/api/export` or `/api/export.ics` return, or to their headers — phases 1-2 already shipped that; this phase only consumes it.
- Combining both downloads into one action — the owner explicitly chose two separate controls over a single combined download.
- A general-purpose, published Content-Disposition parsing library — the parser is scoped to what this project's own two export routes emit (a simple quoted-ASCII `filename=`, with `filename*` support as defensive-but-untested-against-a-real-server-emission robustness).
- Encryption, import/restore, a second export format, filtering/paging — already out of scope PRD-wide (see the PRD's own "What We're NOT Building").

## Step-by-Step Tasks

### Task 1: CREATE src/shared/content-disposition.ts

- **ACTION**: Create a pure, import-free module exporting `parseFilenameFromContentDisposition(header: string | null): string | null`. Behavior: return `null` immediately if `header` is `null`. Otherwise, try the RFC 6266 extended form first — a case-insensitive regex matching `filename*=UTF-8''<value>` — and if found, percent-decode `<value>` with `decodeURIComponent` inside a `try`/`catch` (a `catch` returns `null` for that branch, falling through to the plain form rather than throwing). If no extended form matched (or its decode failed), try a quoted plain form (`filename="<value>"`, case-insensitive) and then an unquoted form (`filename=<value up to the next ; or end>`, case-insensitive, trimmed). Whatever value survives extraction is passed through a private `sanitizeFilename(value: string): string | null` helper that: splits on `/` and `\` and keeps only the last segment, trims it, and returns `null` if the trimmed result is empty, `"."`, or `".."` — never returning an unsanitized value. Return `null` if none of the three forms match. No import from `src/app/` or any DOM type (`Headers`, `Response`); the function's only parameter is a plain `string | null`.
- **MIRROR**: `# SOURCE: src/shared/dates.ts:1-22` (no-imports, environment-agnostic module style) and the two `# EXTERNAL SOURCE` RFC 6266 entries above (extended-form precedence, path-traversal sanitization)
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/content-disposition.test.ts
  ```

Serves **AC-A5 (PRD AC-9)** — this is the module that makes the browser's save-dialog filename match the Worker's dated name rather than a second, potentially drifting client-side convention.

### Task 2: UPDATE src/shared/content-disposition.ts

- **ACTION**: In the same file created by Task 1, add `export function exportFilename(header: string | null, kind: "json" | "ics"): string` that calls `parseFilenameFromContentDisposition(header)` and returns its result unchanged when it is non-`null`; when the parse returns `null`, returns the fallback `` `praesto-export.${kind}` `` — the ONLY place this literal is defined anywhere in the codebase. `kind` is a plain parameter, never sniffed from the environment, so the function stays as pure and import-free as `parseFilenameFromContentDisposition` itself. Add a doc comment on `exportFilename` stating explicitly that the fallback name deliberately carries no date, unlike every real name the Worker emits (`praesto-<date>.<ext>`), so that a server-side `Content-Disposition` regression produces a visually distinct, obviously-wrong filename instead of quietly blending in as a plausible dated one.
- **MIRROR**: `# SOURCE: src/shared/dates.ts:1-22` (no-imports, environment-agnostic module style, same file) and `# SOURCE: src/worker/routes/export.ts:57-63` (the fallback filename's naming convention, kept in the same `praesto-*` family)
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/content-disposition.test.ts
  ```

Serves **AC-A6 (PRD AC-9)** — this is the extraction that moves the fallback-name decision out of `src/app/api.ts` and into the pure module the automated test tier already reaches, closing the gap the test-reviewer found: previously the literal was untested by anything, because the parser's suite correctly scoped itself to `parseFilenameFromContentDisposition`'s own `null`-vs-not behavior, and Task 9's manual conditions never exercise a missing or malformed header.

### Task 3: UPDATE src/app/api.ts

- **ACTION**: Import `exportFilename` from `../shared/content-disposition` — not `parseFilenameFromContentDisposition` directly; the fallback decision now lives entirely inside `exportFilename`, so `api.ts` must hold no filename literal of its own. Add `export async function fetchExportFile(path: "/api/export" | "/api/export.ics"): Promise<{ blob: Blob; filename: string }>` that: reads the token via the existing `readToken()`; builds a `Headers` object setting `Authorization: Bearer <token>` only if a token is present (no `Accept`/`Content-Type` — this is a `GET` with no body); calls `fetch(path, { headers })`; on `response.status === 401`, calls `clearToken()` and throws `new ApiError(401, "Invalid or missing token")`, exactly like `request<T>`; on any other non-`ok` status, throws `new ApiError(response.status, \`Request failed with status ${response.status}\`)`; otherwise reads `response.headers.get("Content-Disposition")` and calls `exportFilename(header, path.endsWith(".ics") ? "ics" : "json")` to get the filename; finally awaits `response.blob()` and returns `{ blob, filename }`. Do not route this through the existing `request<T>()` helper — it always calls `response.json()`, which would consume the body before `.blob()` could read it.
- **MIRROR**: `# SOURCE: src/app/api.ts:70-96` (token-attach/401-handling shape)
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx eslint src/app/api.ts
  ```

Serves **AC-A1, AC-A2 (PRD AC-9)** and **AC-A5 (PRD AC-9)** — this is the function that actually reaches the two authenticated routes with the header in place (never a query-string token) and wires `exportFilename` to the real response, without duplicating its fallback decision.

### Task 4: CREATE src/app/download.ts

- **ACTION**: Create `export function triggerBrowserDownload(blob: Blob, filename: string): void` that: calls `const url = URL.createObjectURL(blob)`; creates a detached `<a>` element via `document.createElement("a")`, sets `anchor.href = url` and `anchor.download = filename`; appends it to `document.body`, calls `anchor.click()`, then removes it from `document.body`; and finally calls `URL.revokeObjectURL(url)` synchronously, immediately after the click — never deferred to a timeout or left for garbage collection. Add a module doc comment stating this is exempt glue (`docs/context/methodology.md`, "Browser-API work") verified manually, and explaining why a plain `<a href download>` cannot be used here (the export routes require an `Authorization` header an anchor cannot send).
- **MIRROR**: the `# EXTERNAL SOURCE` MDN `createObjectURL`/`revokeObjectURL` entry above — no in-repo precedent exists for this sequence
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx eslint src/app/download.ts
  ```

Serves **AC-A1, AC-A2 (PRD AC-9)** — this is the step that actually makes the browser receive the file as a download rather than an in-memory response the owner never sees.

### Task 5: CREATE src/app/components/DataExportCard.tsx

- **ACTION**: Create a card component `DataExportCard({ onUnauthorized }: { onUnauthorized: () => void })` structured as a `<section aria-label="Exportar dados" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4">`, mirroring `GoogleConnectionCard`'s section shell. Inside, two independent controls, each with its own `useState` triplet (`busy: boolean`, `showBusy: boolean`, `error: string | null`) and its own `useEffect` arming a 400 ms `setTimeout` to flip `showBusy` true only while `busy` stays true past that delay (mirrored from `GoogleConnectionCard`'s skeleton timer), clearing the timer on unmount/state change:
  1. **JSON control** — `<Button type="button" variant="primary" onClick={() => void handleDownload("json")} disabled={jsonBusy}>{jsonShowBusy ? "Baixando…" : "Baixar meus dados"}</Button>`, followed by `{jsonError !== null && <p role="alert" className="m-0 font-text text-t2 text-overdue">{jsonError}</p>}`.
  2. **`.ics` control** — same shape, label `"Baixar agenda (.ics)"` / busy label `"Baixando…"`, its own `icsError`.
  A shared `async function handleDownload(kind: "json" | "ics"): Promise<void>` sets that kind's `busy` true and `error` null, calls `fetchExportFile(kind === "json" ? "/api/export" : "/api/export.ics")`, then `triggerBrowserDownload(blob, filename)`, then `showToast({ key: \`export-${kind}\`, text: kind === "json" ? "Dados exportados." : "Agenda exportada.", tone: "info" })`; in `catch`, if `cause instanceof ApiError && cause.status === 401` calls `onUnauthorized()` and returns, otherwise sets that kind's `error` to the two-sentence pt-BR message (`"Não foi possível baixar seus dados agora. Tente novamente."` for JSON, `"Não foi possível baixar a agenda agora. Tente novamente."` for `.ics`) — never a toast for the failure path, and never a bare status code, per guidelines §8's *Request error* row; `finally` sets `busy` false. **Both controls are disabled only by their own `busy` flag — neither reads `canWrite` or takes it as a prop.** Add a comment at the top of the component explaining this deliberately, citing `GoogleConnectionCard`'s own *Tentar de novo*-is-a-GET reasoning: a download is a read, so it stays available exactly like the offline banner's own promise ("Dá para ler...") already implies; a genuinely offline attempt simply reaches the `catch` branch above and shows the same inline error a flaky connection would.
- **MIRROR**: `# SOURCE: src/app/components/GoogleConnectionCard.tsx:100-133, 240-252` (delayed-busy pattern, async handler shape, inline-error idiom)
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx eslint src/app/components/DataExportCard.tsx
  ```

Serves **AC-A1, AC-A2, AC-A3 (PRD AC-9)** — this is where the success/failure/busy states this phase's AC-9 ("the screen shows no error state" on success; a failure must still be honest) are actually decided.

### Task 6: UPDATE src/app/components/SettingsScreen.tsx

- **ACTION**: Import `DataExportCard` from `./DataExportCard`. Add `<DataExportCard onUnauthorized={onUnauthorized} />` as a second child of the existing `<main>...</main>`, immediately after `<GoogleConnectionCard ... />`, with no other change to the file.
- **MIRROR**: `# SOURCE: src/app/components/SettingsScreen.tsx:98-105`
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx eslint src/app/components/SettingsScreen.tsx
  ```

Serves **AC-A1, AC-A2 (PRD AC-9)** — this is what makes the control reachable from `/settings` at all.

### Task 7: UPDATE documentation/40-engineering/ui-layout-standard.md

- **ACTION**: In the `## 6. What the upcoming units plug into` table, replace the row `| 5 data-export | A settings route with one action; result as a toast |` with `| 5 data-export | A settings route with two download actions — *Baixar meus dados* (JSON) and *Baixar agenda (.ics)*; success as a toast, a failed download inline and persistent per guidelines §8 |`. Then, in the `## History` table (immediately below its `|---|---|` separator, as the new first/newest row — the table is newest-first), insert:
  `| 2026-09-05 | **data-export phase 3, owner's call.** §6's unit-5 row amended: a single combined download action becomes two — *Baixar meus dados* (JSON) and *Baixar agenda (.ics)* — because the owner chose two explicit controls over one action covering both files. The row's "result as a toast" wording covered only success; a failed export is not a transient nicety (ADR-0003's binding safeguard), so failure is now inline and persistent per guidelines §8's *Request error* rule, matching this repo's existing \`GoogleConnectionCard\` retry idiom. See \`PRPs/plans/data-export-phase-3-the-button.plan.md\` |`
  Update the frontmatter `last_updated` to today's date.
- **MIRROR**: `# SOURCE` is this same file's own 2026-08-24 History rows (the *Com hora* → *Para hoje* correction) — the discipline of amending in place, dated, with the retired wording named, applied here to the same document's own §6
- **VALIDATE**:
  ```
  set -euo pipefail
  grep -q "two download actions" documentation/40-engineering/ui-layout-standard.md
  grep -q "2026-09-05" documentation/40-engineering/ui-layout-standard.md
  ```

Serves **AC-A4 (PRD AC-9)** — closing the gap between the built screen (two buttons, split feedback) and the written standard, per this document's own review trigger.

### Task 8: UPDATE documentation/50-planning/ui-ux-plan.md

- **ACTION**: In the `## History` table (newest-first, header at line 173-174), insert one new row immediately below the `|---|---|` separator:
  `| 2026-09-05 | **data-export phase 3.** \`ui-layout-standard.md\` §6's unit-5 plug-in row amended from a single combined download action to two explicit ones, with failure feedback moved from toast to an inline persistent error per guidelines §8 — the owner's two-button decision. See \`ui-layout-standard.md\` History, 2026-09-05, and \`PRPs/plans/data-export-phase-3-the-button.plan.md\` |`
  Update the frontmatter `last_updated` to today's date. Do not change the file's `status: deprecated`.
- **MIRROR**: this file's own existing History rows (e.g. the 2026-08-24/2026-08-23 entries already read during grounding) — same one-row-per-change, newest-first convention
- **VALIDATE**:
  ```
  set -euo pipefail
  grep -q "2026-09-05" documentation/50-planning/ui-ux-plan.md
  ```

Serves **AC-A4 (PRD AC-9)** — the `documentation/README.md` maintenance map requires this second History line whenever `ui-layout-standard.md`'s screen anatomy plug-in table is amended.

### Task 9: VERIFY on the device, and run the mandated guidelines checklist

- **ACTION**: Manual verification, because `docs/context/methodology.md` keeps React component verification manual and this phase's acceptance (AC-9) is behavioral/visual. On the Windows PC and the Android phone, check and record ALL of the following named conditions — never a generic "verified in the browser": (1) tapping *Baixar meus dados* on a valid token produces a real file download named `praesto-<today's date>.json`, and the screen shows no error state; (2) tapping *Baixar agenda (.ics)* likewise downloads `praesto-<today's date>.ics`; (3) with DevTools Network set to Offline (or airplane mode on the phone), tapping either control produces a persistent inline error next to that control, and the control stays enabled for an immediate retry — never a bare status code; (4) once connectivity returns, retrying the same control succeeds and shows the success toast, which auto-dismisses at 4 s; (5) a revoked/cleared token routes to the token gate (`onUnauthorized`) rather than showing a raw error. Then run the guidelines' review checklist (Tier A, all 9 items) item by item against this change. Write every result — the five named conditions above and the 9 checklist items, each ✔/✘ with a one-line reason for any ✘ — to `PRPs/reports/data-export/phase-3/device-verification.md`.
- **MIRROR**: `documentation/40-engineering/ui-ux-guidelines.md` — the review checklist (lines 150-160), run rather than referenced; `PRPs/plans/completed/google-calendar-read-phase-4-the-day-whole.plan.md`'s own Task 8 — the precedent for folding a named-conditions device pass and the mandated checklist into one task with an attestation-style VALIDATE
- **VALIDATE**:
  ```
  set -euo pipefail
  npm run check
  test -f PRPs/reports/data-export/phase-3/device-verification.md
  grep -qi "android" PRPs/reports/data-export/phase-3/device-verification.md
  grep -qi "offline" PRPs/reports/data-export/phase-3/device-verification.md
  grep -qi "praesto-" PRPs/reports/data-export/phase-3/device-verification.md
  grep -qi "checklist" PRPs/reports/data-export/phase-3/device-verification.md
  ```
  *(This attests that the record exists and names the required conditions — it cannot prove the owner actually looked, exactly as the mirrored precedent's own VALIDATE parenthetical says; it fails when nobody wrote the record down, or when the record omits a named condition.)*

Serves **AC-A1, AC-A2, AC-A3 (PRD AC-9) (manual)** and **AC-A4 (PRD AC-9)** — this is the task where AC-9's "verified on both the Windows PC and the Android phone, with the checklist result recorded" success signal is actually discharged.

## Validation Commands

**Level 1 STATIC_ANALYSIS**
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` — exits non-zero on any type, lint or format violation.)

**Level 2 UNIT_TESTS**
```
set -euo pipefail
npx vitest run test/content-disposition.test.ts
grep -q "two download actions" documentation/40-engineering/ui-layout-standard.md
grep -q "2026-09-05" documentation/50-planning/ui-ux-plan.md
```
(The only automated test target this phase introduces is the pure parser; the two `grep` checks confirm the documentation amendments landed — each command's own non-zero exit on a miss propagates under `set -e`, never masked by an `echo`.)

**Level 3 DRY-RUN END-TO-END**
```
npx wrangler deploy --dry-run --outdir dist-dry-run
```
(Builds and bundles the whole Worker and SPA — including the new component, `api.ts`/`download.ts` additions and their imports — without publishing; exits non-zero on any build/bundling failure.)

## Acceptance Criteria

- **AC-A1 (PRD AC-9):** Given the owner is on `/settings` with a valid token, when he activates *Baixar meus dados*, then the browser receives `praesto-<date>.json` as a file download and the screen shows no error state.
- **AC-A2 (PRD AC-9):** Given the owner is on `/settings` with a valid token, when he activates *Baixar agenda (.ics)*, then the browser receives `praesto-<date>.ics` as a file download and the screen shows no error state.
- **AC-A3 (PRD AC-9) (manual):** Given a download request that fails (offline, unreachable, or a server error), when the failure occurs, then a persistent inline error appears next to the control that failed, the control stays enabled for retry, and no bare status code is shown to the owner.
- **AC-A4 (PRD AC-9):** Given this interface change, when the mandated UI/UX guidelines review checklist is run, then its ✔/✘ result is recorded in the implementation record, and `ui-layout-standard.md` §6 plus `ui-ux-plan.md`'s History accurately describe the shipped two-control, split-feedback design rather than the prior one-action/toast-only description.
- **AC-A5 (PRD AC-9):** Given a `Content-Disposition` header of the exact shape the Worker emits (`attachment; filename="praesto-<date>.<ext>"`), when `parseFilenameFromContentDisposition` reads it, then the returned filename matches the Worker's dated name exactly, with no second, independently-computed client-side name ever used unless the header is missing or unparseable.
- **AC-A6 (PRD AC-9):** Given a missing or unparseable `Content-Disposition` header, when `exportFilename` computes the fallback name, then it returns `praesto-export.<ext>` — the one and only definition of that literal anywhere in the codebase — never a dated-looking name, so a server-side header regression stays visually obvious rather than silently masked, and the decision is exercised by the same automated test tier that covers the parser.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `URL.revokeObjectURL` is skipped or deferred, leaking the blob's memory for the rest of the page's lifetime across repeated downloads | L | M | Task 4 calls it synchronously, immediately after `click()`, per the MDN finding cited in Patterns to Mirror; manually checked in Task 9 via DevTools' Memory panel is not required by AC-9 but may be spot-checked as a bonus |
| A future change "simplifies" a download control back into a plain `<a href={"/api/export"} download>` anchor, silently reintroducing the forbidden query-string-token pattern or simply breaking (no `Authorization` header reaches the request) | M | H | This plan's `## Solution Statement` and Task 4's module doc comment both state the reason explicitly; the forbidden alternative (a token in the URL) is named here so a later reader searching for "why not a plain link" finds the answer, mirroring how `docs/anti-patterns.md` records forbidden patterns with their reason |
| `parseFilenameFromContentDisposition`'s regex-based extraction diverges from real browser/server Content-Disposition edge cases (backslash escaping, percent-encoding) that RFC 6266 itself flags as inconsistently implemented across clients | L | L | Scoped deliberately to what this project's own two routes emit today (simple quoted ASCII, no `filename*`); the fallback filename covers any header shape the parser cannot handle, so a parse miss degrades to the deliberately UNDATED `praesto-export.<ext>` fallback rather than a broken download — undated on purpose (Task 2, AC-A6), so a server-side regression is visually obvious instead of blending in with a plausible dated name. Corrected 2026-09-05: this row previously read "a still-correctly-dated-family name", written before Task 2 existed and contradicting the binding design |
| The manual device-verification record (Task 9) is filled in perfunctorily or skipped, and nothing automated can prove the owner actually looked | M | M | Task 9's VALIDATE is an attestation check, not a substitute for the pass itself — it fails outright if the record file is missing or omits any of the five named conditions, mirroring the accepted precedent in `google-calendar-read-phase-4-the-day-whole.plan.md`'s own Task 8 |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands invoke the test framework's own runner (`npx vitest run test/content-disposition.test.ts`) directly against the suite the test pair will have already written, rather than the Implementer authoring or editing any spec.

**The decidable/manual split, stated explicitly (per this phase's brief):** `src/shared/content-disposition.ts` is the ONLY part of this phase authored test-first — it is the one place a silent, unnoticed bug is possible (a parser that returns a wrong or unsafe filename with no visible symptom). Everything downstream of it — the fetch-and-click glue (`src/app/download.ts`, `fetchExportFile`) and the card's JSX (`DataExportCard.tsx`) — is browser-API glue or React presentation, verified manually per `docs/context/methodology.md`, exactly as every other screen in this project has been.

**Why the controls ignore `canWrite` (a deliberate decision, not an oversight):** `GoogleConnectionCard.tsx`'s own doc comment on its `canWrite` prop already establishes the precedent this phase follows: "Reads stay enabled — *Tentar de novo* is a GET, and 'dá para ler' is the half of the promise that still holds." A file download is a read, not a write, so both controls in `DataExportCard` stay enabled regardless of connectivity state; a genuinely offline attempt simply reaches the same inline-error path a flaky connection would, rather than being preemptively disabled with a second, redundant offline message beyond the screen's existing persistent banner.

**Why the fallback moved into `src/shared/content-disposition.ts` (closing a test-reviewer-found gap):** the hardcoded `praesto-export.<ext>` name was previously a literal inside `src/app/api.ts`'s glue code, reachable by neither the parser's automated suite (correctly scoped to when `parseFilenameFromContentDisposition` returns `null`, not to what replaces it) nor Task 9's manual pass (both real routes always send a header per AC-6, so the fallback path never triggers in a device check). Task 2's `exportFilename` extracts that decision into the same pure, test-first module as the parser it wraps, so a mistyped literal now fails Task 2's own automated `VALIDATE` instead of shipping unnoticed. The severity is genuinely low — the path is unreachable in normal operation and guarded upstream by phase 1's AC-6 test — but the fix costs one small wrapper function and closes a real automated-coverage gap, so the owner chose to close it rather than record it as an accepted risk. This wrapper is deliberate, not redundant: a later reader tempted to inline it back into `api.ts` should read this note first.

**Test file naming convention (informational, not binding on test-writer):** this plan's Task 1 and Task 2 VALIDATE commands both assume the test pair names its suite `test/content-disposition.test.ts` — one file covering both `parseFilenameFromContentDisposition` and `exportFilename`, mirroring the `src/shared/<module>.ts` → `test/<module>.test.ts` convention already used by `test/export-ics.test.ts` and `test/google-failure-copy.test.ts`. If the test pair chooses a different name, both VALIDATE commands must be updated to match before code review; the Level 2 command's `grep` checks are unaffected either way.

**No deploy, no push, no live network call to production in any task above** — every `**VALIDATE**` runs locally (`tsc`, `eslint`, `prettier`, `vitest`, `grep`, and a `wrangler deploy --dry-run` that never publishes). Task 9's device pass runs against the local dev server (`npm run dev`), never against the production Worker.

*Generated: 2026-09-05*
*Approved: 2026-09-05*
*Status: IMPLEMENTED*
