# Feature: The Áreas screen (Phase 2 of life-areas)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test and implement stages consume); reuse or creation of components (a new route screen, a stateless entry card and two new pure modules in `src/shared`); impact on shared UI (the settings screen, the route table and the route switch in `App.tsx`); business rules for life areas (`docs/domain/areas/life-areas.md`, ADR-0015); the UI/UX review checklist gate (CLAUDE.md, mandatory on every `src/app/` change)
- Decisions found:
  - ADR-0015 / [2026-10-11] Life Areas are owner-named, single-membership groupings; deleting one unassigns its items — name 1-40 characters, unique ignoring case and diacritics, at most 12, alphabetical pt-BR, no migration; the confirmation names how many items lose the area
  - life-areas PRD D-G (areas are managed only on *Configurações → Áreas*), D-H (name rules, 409 on a duplicate), D-I (at most 12, alphabetical, no manual order), D-J (a real delete; one confirmation that repeats the verb and names the counts; not undoable), D-O (*Sem área* is a read-only count row, never a stored area)
  - ADR-0008 / [2026-08-04] test-first, scoped to `src/shared` pure logic and the API; React components stay manually verified, and a purely visual criterion legitimately produces no test file
  - methodology "Browser-API work: split the logic out, then the glue is exempt" — the decidable half moves to `src/shared` first, the thin glue is the exempt half
  - ADR-0009 / [2026-08-18] visible UI copy is pt-BR (sentence case, infinitive buttons, "você"); identifiers, comments and tests stay English
  - ADR-0003 / [2026-08-03] thin client over D1, no offline write queue — offline means writes disabled behind a banner, never queued
  - ADR-0010 / ADR-0011 identity tokens and the owned `src/app/components/ui/` primitives; ui-layout-standard §1 (model B: single screen + sheets, no bottom bar), §3 (long flows are routes with real history entries) and §5 (`Esc` leaves the settings-level screens); ui-ux-guidelines §8 (states), §9 (copy), §10 (accessibility), §12.3 (a string a function chooses lives in `src/shared/*` and is tested in Portuguese)
- Applicable anti-patterns:
  - Offline write queue (writes are disabled while offline, never queued)
  - Hand-duplicated entity types (the list type derives from `LifeAreaSummaryDto` in `src/shared/api.ts`, never redeclared)
  - Glossary synonym drift (Life Area in code and docs, *área* to the owner; never category)
  - Portuguese in artifacts (identifiers, comments, tests and docs stay English; only the string values the owner reads are pt-BR)
  - Mirroring Tasks, Reminders or Life Areas to Google (not approached)
  - Editing accepted ADRs; Weakening tests to force green (this plan touches no test file)
  - Writing pipeline artifacts under `.claude/` (nothing is written there)
- Applicable architectural rules:
  - One Worker serves everything; this phase adds no endpoint, no table and no migration
  - `src/shared/` carries no DOM or Worker globals and compiles into every target; the two new modules import only `./api`, `./life-areas`, `./life-areas-list` and `./request-failure`
  - Types flow `src/worker/db/schema.ts` → `src/worker/dto.ts` → `src/shared/api.ts`; the screen consumes `LifeAreasResponse` and `LifeAreaDto` as they are
  - `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay byte-unchanged
  - Every `/api/*` call goes through `src/app/api.ts`'s `request<T>()` (bearer token, 401 clears it)
  - The UI/UX review checklist's ✔/✘ result is recorded in the phase report before the phase closes
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/life-areas.prd.md` — Implementation Phases row 2: "The Áreas screen" — Goal: the owner can create, rename and delete his areas on his phone — Success signal: AC-19 recorded; Esc and the back gesture verified; checklist ✔/✘ filed.

## Summary

Phase 1 put Life Areas on the wire (`/api/life-areas` and the pure rules in `src/shared/life-areas.ts`). This phase gives the owner the screen to manage them: a new route `/settings/life-areas` (the `life-areas` `AppRoute` member) reached from a stateless entry card on *Configurações*, where he sees his areas alphabetically with their open counts and a read-only *Sem área* row, adds an area, renames one in place with explicit *Salvar* / *Cancelar*, and deletes one behind a single confirmation that repeats the verb and says how many tarefas and séries lose the area. The decidable half lives in two new pure `src/shared` modules — a list reducer with the name check, and the pt-BR copy with the failure mapping — and is the test-first surface; the React screen, the entry card and the four thin wiring edits (`app-route.ts`, `api.ts`, `SettingsScreen.tsx`, `App.tsx`) are the manually verified half. The phase adds no endpoint, table or migration, and records the UI/UX review checklist's ✔/✘ for the new screen.

## User Story

As the owner of Praesto Sum
I want to create, rename and delete my own areas from *Configurações*, and see what each one holds before I delete it
So that the Task sheet and the *Hoje* filter of the next phases have my own areas to offer, and removing one never costs me a Task by surprise.

## Problem Statement

The API for Life Areas exists since phase 1, but the owner has no way to use it: there is no screen, so an area can only be created, renamed or deleted with a hand-written request. Without a place to manage them nothing in the unit can be assigned, shown or filtered, and the unit's exit signal (the owner filtered by an area *he* created) is unreachable.

## Solution Statement

Two pure modules decide everything decidable: `src/shared/life-areas-list.ts` (the list state machine, the create / rename / delete outcomes and the client-side name check built on the phase 1 rules) and `src/shared/life-areas-view.ts` (the count labels, the delete confirmation built from `taskCount` and `seriesCount`, the field messages and the request-failure mapping). `src/shared/app-route.ts` gains the `life-areas` route; `src/app/api.ts` gains four one-line wrappers. A new `LifeAreasScreen` copies `AdherenceScreen`'s shell, load pattern and failure idiom, then adds the add form, rename in place and the `ConfirmView` delete; a stateless `LifeAreasEntryCard` joins `SettingsScreen`; `App.tsx` routes to the screen. Writes wait for the server (no optimistic write, no offline queue), and every failed write keeps what the owner typed.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY (a new route screen over an existing API; no schema, endpoint or wire change) |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/` (two new pure modules, `app-route.ts`), `src/app/` (new `LifeAreasScreen` and `LifeAreasEntryCard`, `api.ts`, `SettingsScreen.tsx`, `App.tsx`), `PRPs/reports/life-areas/phase-2/` (the checklist record) |
| Dependencies | Phase 1 (`/api/life-areas`, `LifeAreasResponse`, `LifeAreaSummaryDto`, `LifeAreaDto`, `src/shared/life-areas.ts`) — present in this worktree; no new package, no migration |
| Estimated Tasks | 9 |
| Source PRD line ref | `PRPs/prds/life-areas.prd.md` Implementation Phases row 2 (line 355), Phase Details (367-371); AC-19 (175-180), AC-23 (193-197); D-G, D-H, D-I, D-J, D-O (398-401, 406) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/life-areas.prd.md` | 175-180, 193-197, 322-327, 331-333, 367-371, 398-401, 406 | AC-19 (the only AC of this row), AC-23's checklist clause, the UI architecture note and checklist bullet, the Phase 2 details and decisions D-G..D-J, D-O |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 75-103, 105-119, 136-168 | §8 states (empty, request error, offline, irreversible delete), §9 copy rules, §10 accessibility, §12 components, and the review checklist this phase must run and record |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 14-21, 39-43, 49-53 | §1 model B and the flip rule (no bottom bar), §3 long flows are routes, §5 `Esc` and `Enter` |
| P0 | `src/app/components/AdherenceScreen.tsx` | 25-28, 56-179 | The route-screen shell, load pattern, failure idiom and offline slot this screen copies |
| P0 | `src/app/components/SettingsScreen.tsx` | 23-31, 63-68, 70-130 | Where the entry card joins, the `navigate` prop and the `Esc` listener |
| P0 | `src/shared/google-settings.ts` | 36-112 | The reducer-driven state precedent (state union, event union, total `switch`, kind guards) |
| P0 | `src/shared/life-areas.ts` | 1-55 | The phase 1 rules both new modules build on (`validateLifeAreaName`, `lifeAreaNameKey`, `compareLifeAreaNames`, the two limits) |
| P0 | `src/shared/api.ts` | 77-126 | `LifeAreaDto`, `CreateLifeAreaInput`, `UpdateLifeAreaInput`, `LifeAreaSummaryDto`, `LifeAreasResponse` |
| P0 | `src/worker/routes/life-areas.ts` | 30-53, 64-110, 118-153, 161-198, 209-230 | The wire contract: statuses, error bodies, that POST and PATCH answer no counts, DELETE 204 |
| P1 | `src/app/api.ts` | 59-107, 178-201, 223-226 | `ApiError`, `request<T>()` (204 -> `undefined`) and the wrapper style to copy |
| P1 | `src/shared/app-route.ts` | 25-75 | The route union and both mapping directions |
| P1 | `src/app/hooks/useRoute.ts` | 34-93 | What `back()` does (pops our own entry, else replaces with `today`) |
| P1 | `src/app/App.tsx` | 76-98 | `onUnauthorized` and the route switch |
| P1 | `src/app/components/GoogleConnectionCard.tsx` | 58-116, 314-343 | `useReducer` wiring, the `ConfirmView` call shape and the failed block |
| P1 | `src/app/components/InlineTitle.tsx` | 9-69 | The only in-place editor: commit rule, `Enter` / `Escape` handling |
| P1 | `src/app/components/CaptureDeck.tsx` | 64-113 | The add-form idiom: `onSubmit`, input attributes, the `!canWrite` and error lines |
| P1 | `src/app/components/TaskSheet.tsx` | 194-204 | The visible-label + input idiom |
| P1 | `src/app/components/ui/ConfirmView.tsx` | 14-73 | Props (all required), default focus on *Cancelar*, destructive button second |
| P1 | `src/app/components/ui/Banner.tsx` and `src/app/components/ui/Button.tsx` | 15-36 and 9-30 | The offline banner and the button variants (`primary`, `secondary`, `icon`) |
| P1 | `src/shared/request-failure.ts` | 28-57 | `classifyRequestFailure`'s duck-typed `status` check the failure mapping extends |
| P1 | `src/shared/connectivity.ts` and `src/app/hooks/useConnectivity.ts` | 62-65 and 17-53 | `canWrite` and the hook (`onOnline` option) |
| P1 | `src/shared/adherence-view.ts` | 1-66 | The pure copy-module convention (zero special-cased, count never a ratio) |
| P2 | `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` | 1-67 | The record format Task 9 follows (✔ / ✘ / pending / owed vocabulary) |

## Patterns to Mirror

```ts
# SOURCE: src/shared/life-areas.ts:1-11
/**
 * The pure core of Life Areas (ADR-0015, life-areas PRD AC-12): the name limits,
 * the name validator, the duplicate key and the pt-BR comparator.
 *
 * The `/api/life-areas` route and, from phase 2, the *Áreas* screen both import
 * this module, so the two cannot drift on what a valid, a duplicate or an
 * ordered area name is. Like `search.ts` and `dates.ts` it is compiled into
 * every target, so it carries no DOM globals and no Worker globals.
 */

import { normalizeSearchText } from "./search";
```
Copied by Tasks 1 and 2 (module header: purity statement, sibling-only imports).

```ts
# SOURCE: src/shared/life-areas.ts:27-32
export function validateLifeAreaName(raw: string): LifeAreaNameError | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "blank";
  if (trimmed.length > LIFE_AREA_NAME_MAX) return "too_long";
  return null;
}
```
Copied by Task 1 (an error code or `null` meaning valid — `checkLifeAreaName` calls it first and keeps its convention).

```ts
# SOURCE: src/shared/google-settings.ts:38-49
export type GoogleSettingsState =
  | { kind: "loading" }
  | { kind: "disconnected" }
  | {
      kind: "connected";
      calendars: readonly GoogleCalendarDto[];
      draft: ReadonlySet<string>;
      saving: boolean;
    }
  | { kind: "failed"; reason: string | null };

export const INITIAL_GOOGLE_SETTINGS_STATE: GoogleSettingsState = { kind: "loading" };
```
Copied by Task 1 (state union discriminated by `kind`, an exported initial constant).

```ts
# SOURCE: src/shared/google-settings.ts:71-80
export function reduceGoogleSettings(
  state: GoogleSettingsState,
  event: GoogleSettingsEvent,
): GoogleSettingsState {
  switch (event.type) {
    case "load-failed":
      return { kind: "failed", reason: event.reason };
    case "loaded-disconnected":
      return { kind: "disconnected" };
    case "loaded-connected":
```
Copied by Task 1 (a total `switch (event.type)` with no default).

```ts
# SOURCE: src/shared/google-settings.ts:87-89
    case "toggle-calendar": {
      if (state.kind !== "connected") return state;
      const draft = new Set(state.draft);
```
Copied by Task 1 (an event that does not apply to the current `kind` returns the state unchanged).

```ts
# SOURCE: src/shared/adherence-view.ts:40-49
/** `<done> de <closed> feitas`, with zero closed special-cased. */
export function formatDoneOfClosed(done: number, closed: number): string {
  if (closed === 0) return "Nenhuma ocorrência concluída ainda";
  return `${done} de ${closed} feitas`;
}

/** The current streak of completed occurrences. */
export function formatStreak(currentStreak: number): string {
  return currentStreak >= 1 ? `Sequência atual: ${currentStreak}` : "Sem sequência";
}
```
Copied by Task 2 (pt-BR formatters in `src/shared`, zero special-cased, counts never a ratio).

```ts
# SOURCE: src/shared/request-failure.ts:39-51
export function classifyRequestFailure(cause: unknown): RequestFailure {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    typeof (cause as { status: unknown }).status === "number"
  ) {
    const status = (cause as { status: number }).status;
    return {
      kind: "http-error",
      message: `O servidor recusou a operação (código ${status}). Tente de novo.`,
    };
  }
```
Copied by Task 2 (duck-typing `status` because `src/shared/` cannot import `ApiError`).

```ts
# SOURCE: src/shared/app-route.ts:25-32
export type AppRoute =
  | "today"
  | "settings"
  | "notifications"
  | "notifications-diagnostics"
  | "adherence"
  | "search"
  | `task/${string}`;
```
```ts
# SOURCE: src/shared/app-route.ts:59-64
  if (path === "/settings/notifications/diagnostics") return "notifications-diagnostics";
  if (path === "/settings/notifications") return "notifications";
  if (path === "/settings/adherence") return "adherence";
  if (path === "/settings") return "settings";
  if (path === "/search") return "search";
  return "today";
```
```ts
# SOURCE: src/shared/app-route.ts:67-75
export function pathOf(route: AppRoute): string {
  if (route.startsWith("task/")) return `/tasks/${taskIdFromRoute(route)}`;
  if (route === "notifications-diagnostics") return "/settings/notifications/diagnostics";
  if (route === "notifications") return "/settings/notifications";
  if (route === "adherence") return "/settings/adherence";
  if (route === "settings") return "/settings";
  if (route === "search") return "/search";
  return "/";
}
```
Copied by Task 3 (one union member, one `routeFromPath` line, one `pathOf` line; the specific `/settings/...` paths sit before `/settings`).

```ts
# SOURCE: src/app/api.ts:178-201
export async function listReminders(): Promise<ReminderDto[]> {
  const body = await request<{ reminders: ReminderDto[] }>("/api/reminders");
  return body.reminders;
}

export async function createReminder(input: CreateReminderInput): Promise<ReminderDto> {
  const body = await request<{ reminder: ReminderDto }>("/api/reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.reminder;
}

export async function updateReminder(id: string, input: UpdateReminderInput): Promise<ReminderDto> {
  const body = await request<{ reminder: ReminderDto }>(`/api/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.reminder;
}

export async function deleteReminder(id: string): Promise<void> {
  await request<void>(`/api/reminders/${id}`, { method: "DELETE" });
}
```
```ts
# SOURCE: src/app/api.ts:223-226
/** Reads every recurring Task's adherence record (adherence-mirror). */
export async function fetchAdherence(): Promise<AdherenceResponse> {
  return request<AdherenceResponse>("/api/series/adherence");
}
```
Copied by Task 4 (one-liner wrappers over `request<T>()`, no local types, no error re-mapping).

```tsx
# SOURCE: src/app/components/AdherenceScreen.tsx:63-76
  const { state: connectivity } = useConnectivity();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    document.title = "Aderência · Praesto Sum";
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back]);
```
Copied by Task 5 (connectivity hook, title effect, `Esc` -> `back()`; the copy adds a `defaultPrevented` early return).

```tsx
# SOURCE: src/app/components/AdherenceScreen.tsx:80-93
  const latestRequest = useRef(0);

  async function refresh(): Promise<void> {
    const mine = ++latestRequest.current;
    try {
      const response = await fetchAdherence();
      if (mine !== latestRequest.current) return;
      setLoad({ kind: "ready", response });
    } catch (cause) {
      if (mine !== latestRequest.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
```
Copied by Task 5 (the stale-response guard and the 401 route to the token gate).

```tsx
# SOURCE: src/app/components/AdherenceScreen.tsx:106-117
  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
```
Copied by Task 5 (load on mount and again when the app returns to the foreground).

```tsx
# SOURCE: src/app/components/AdherenceScreen.tsx:126-160
  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr] overflow-clip bg-bg"
    >
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <img src="/brand/mark-flat.svg" alt="" className="size-5" />
          <span className="font-display text-t2 font-extrabold text-muted">praesto</span>
        </span>
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Aderência</h1>
      </header>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        {load.kind === "loading" && <Skeleton />}

        {load.kind === "failed" && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {load.message}
            </p>
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              Tentar de novo
            </Button>
          </div>
        )}
```
Copied by Task 5 (the shell grid, header, always-render-a-slot banner row, skeleton and the inline persistent failure with *Tentar de novo*).

```tsx
# SOURCE: src/app/components/GoogleConnectionCard.tsx:58
  const [state, dispatch] = useReducer(reduceGoogleSettings, INITIAL_GOOGLE_SETTINGS_STATE);
```
Copied by Task 5 (the reducer wired with `useReducer` and its exported initial constant).

```tsx
# SOURCE: src/app/components/GoogleConnectionCard.tsx:314-325
          {confirmingDisconnect && (
            <ConfirmView
              title="Desconectar do Google?"
              body="Você vai precisar refazer a autorização do Google para conectar de novo."
              cancelLabel="Cancelar"
              confirmLabel="Desconectar"
              busy={disconnecting || !canWrite}
              error={disconnectError}
              onCancel={cancelDisconnect}
              onConfirm={() => void confirmDisconnect()}
            />
          )}
```
Copied by Task 6 (the in-place `ConfirmView` call shape; the delete repeats the verb *Excluir*).

```tsx
# SOURCE: src/app/components/InlineTitle.tsx:30-37
  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === task.title) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  }
```
```tsx
# SOURCE: src/app/components/InlineTitle.tsx:46-55
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
```
Copied by Task 6 (an unchanged draft is a cancel, not a request; `Escape` calls `preventDefault()` and cancels only the edit).

```tsx
# SOURCE: src/app/components/CaptureDeck.tsx:66-71
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim() === "" || busy) return;
          onSubmit();
        }}
      >
```
```tsx
# SOURCE: src/app/components/CaptureDeck.tsx:72-78
        <input
          id="capture-title"
          ref={inputRef}
          type="text"
          enterKeyHint="done"
          placeholder="O que precisa ser feito?"
          autoComplete="off"
```
Copied by Task 6 (the add form: a real `<form>` whose submit ignores a busy request, a text input with `enterKeyHint="done"` and `autoComplete="off"`).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:194-204
          <label htmlFor="sheet-title" className="m-0 font-data text-t1 font-semibold text-muted">
            Título
          </label>
          <input
            id="sheet-title"
            type="text"
            value={shownDraft.title}
            onChange={(event) => onDraftChange({ title: event.target.value })}
            disabled={busy}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
          />
```
Copied by Task 6 (a visible `<label htmlFor>` and the bordered 48 px input classes).

```tsx
# SOURCE: src/app/components/AdherenceEntryCard.tsx:7-18
export function AdherenceEntryCard({ onOpenAdherence }: { onOpenAdherence: () => void }) {
  return (
    <section aria-label="Aderência" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4">
      <p className="m-0 font-text text-t2 text-muted">
        Veja quais tarefas repetidas você não concluiu.
      </p>
      <Button type="button" variant="primary" onClick={onOpenAdherence}>
        Abrir
      </Button>
    </section>
  );
}
```
Copied by Task 7.

```tsx
# SOURCE: src/app/components/SettingsScreen.tsx:111-114
        <GoogleConnectionCard onUnauthorized={onUnauthorized} canWrite={canWrite(connectivity)} />
        <DataExportCard onUnauthorized={onUnauthorized} />
        <NotificationsEntryCard onOpenNotifications={() => navigate("notifications")} />
        <AdherenceEntryCard onOpenAdherence={() => navigate("adherence")} />
```
Copied by Task 7 (the card list the new entry card joins, one `navigate(...)` line per card).

```tsx
# SOURCE: src/app/App.tsx:96-98
  if (route === "adherence") {
    return <AdherenceScreen onUnauthorized={onUnauthorized} back={back} />;
  }
```
Copied by Task 8.

```md
# SOURCE: PRPs/reports/adherence-mirror/phase-3/ui-checklist.md:14-23
## Tier A — every interface change

1. ✔ — method: static inspection. The route screen is read-only with only *Voltar* and the
   failure retry; the entry card has one primary *Abrir*; the *Hoje* line is one plain
   button and adds no second action. Live look: pending live check (orchestrator browser pass).
2. pending live check (orchestrator browser pass) — by construction: the line is
   `min-h-12 w-full`, *Voltar* is the owned 48 px icon button, *Abrir* and *Tentar de novo*
   use the owned `Button` (`min-h-12`). Not measured in the DOM box model.
3. ✔ — method: static inspection. Every row carries text (counts, streak, dates); the
   failure line is text with `role="alert"`; no state is colour-only.
```
Copied by Task 9 (one numbered line per checklist item, each ending in a status the file's reader can act on).

## Files to Change

Paths are relative to the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/life-areas-list.ts` | CREATE | The pure list state machine, the create / rename / delete outcomes, `canCreateLifeArea`, `checkLifeAreaName` and `isLifeAreaRenameNoop` — the decidable half of the screen, built on the phase 1 rules (AC-A2..AC-A5) |
| `src/shared/life-areas-view.ts` | CREATE | The pt-BR count labels, empty and limit copy, the delete confirmation built from `taskCount` / `seriesCount`, the field messages and the request-failure mapping (AC-A2, AC-A3, AC-A5, AC-A6) |
| `src/shared/app-route.ts` | UPDATE | The `life-areas` route at `/settings/life-areas` in the union, `routeFromPath` and `pathOf` (AC-A1) |
| `src/app/api.ts` | UPDATE | `fetchLifeAreas`, `createLifeArea`, `updateLifeArea`, `deleteLifeArea` — the typed client wrappers |
| `src/app/components/LifeAreasScreen.tsx` | CREATE | The route screen: shell, load, list, *Sem área* row, add form, rename in place, counted delete confirmation and every state (AC-A1..AC-A7) |
| `src/app/components/LifeAreasEntryCard.tsx` | CREATE | The stateless *Configurações* entry into the screen (AC-A1) |
| `src/app/components/SettingsScreen.tsx` | UPDATE | Render the entry card after the *Aderência* card and navigate to `life-areas` (AC-A1) |
| `src/app/App.tsx` | UPDATE | The route branch that renders `LifeAreasScreen` (AC-A1) |
| `PRPs/reports/life-areas/phase-2/ui-checklist.md` | CREATE | The UI/UX review checklist's recorded ✔/✘ and the AC-19 walk, with the device-only items marked owed (AC-A8) |

## NOT Building (Scope Limits)

- The *Área* group in the Task sheet, `planSeriesOccurrenceSave` routing, capture inheritance, the area name on the row, the zero-areas line and *Hoje*'s degraded state when the areas request fails (phase 3: AC-14, AC-15, AC-16, AC-20, AC-22).
- `TaskFilter.lifeAreaId`, the *Área* group in the filter sheet and the applied chip (phase 4: AC-13, AC-21).
- Documentation sync: `ui-layout-standard.md` §2.6 and §6, the glossary, `domain-model.md`, FR-008, the area docs, the architecture listing and the roadmap are phase 4 (AC-25) or the post-merge docs update; this phase only records its own checklist result (the unit-level inspection of AC-23 is phase 4's).
- The restore drill on a snapshot with areas and the device proof (phase 4: AC-18, AC-24).
- A bottom bar, a primary-navigation destination or a header entry on *Hoje* for *Áreas* (layout standard §1, model B): the screen is reached only from *Configurações*.
- Creating an area from inside the Task sheet (D-G), colour, icon, description, archive, tags, sub-areas and manual ordering (PRD "What We're NOT Building").
- Undoing a delete (D-J: not undoable in the app; the confirmation says so) and any optimistic write or offline queue (ADR-0003, anti-patterns).
- Any endpoint, table, migration or export change; any change to `src/shared/recurrence.ts` or `src/shared/adherence.ts`.
- Authoring or editing any test file and any React component test (the test pair owns the suite; component verification stays manual per `docs/context/methodology.md`).
- Extracting the offline banner literal into a shared copy module (guidelines §12.3, third case): it would edit three unrelated screens; the new screen repeats the literal exactly as its siblings do.

## Step-by-Step Tasks

Every `VALIDATE` command runs from the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

### Task 1: CREATE src/shared/life-areas-list.ts

- **ACTION**: Create the pure list module behind the *Áreas* screen, delivering the decidable half of AC-A2, AC-A3, AC-A4 and AC-A5. Start from the module header of `src/shared/life-areas.ts` (a purity statement: no DOM globals, no Worker globals, no clock, no network; imports only same-directory siblings — `./api` for types and `./life-areas` for the rules). Export exactly: (1) `type LifeAreasListState = { kind: "loading" } | { kind: "ready"; areas: readonly LifeAreaSummaryDto[]; noAreaOpenTaskCount: number } | { kind: "failed"; message: string }` and `INITIAL_LIFE_AREAS_LIST_STATE: LifeAreasListState = { kind: "loading" }`; (2) `type LifeAreasListEvent = { type: "loaded"; response: LifeAreasResponse } | { type: "load-failed"; message: string } | { type: "created"; lifeArea: LifeAreaDto } | { type: "renamed"; lifeArea: LifeAreaDto } | { type: "deleted"; id: string }`; (3) `reduceLifeAreasList(state, event): LifeAreasListState`, a total `switch (event.type)` with no default: `loaded` -> `ready` from any state, `areas` being a COPY of `response.lifeAreas` sorted with `compareLifeAreaNames` on `name` (the server already sorts; sorting here keeps the order a property of this module) and `noAreaOpenTaskCount` taken from `response.noArea.openTaskCount`; `load-failed` -> `{ kind: "failed", message }` unless the state is already `ready`, which is returned untouched (a list on screen survives a failed refresh); `created` -> on `ready` only, and only when no area has that `id`, append `{ ...lifeArea, openTaskCount: 0, taskCount: 0, seriesCount: 0 }` and re-sort (POST answers no counts and a new area holds nothing); `renamed` -> on `ready` only, and only when an area has that `id`, replace that entry's `name`, `description`, `createdAt` and `updatedAt` from the event while KEEPING its three counts (PATCH answers no counts) and re-sort; `deleted` -> on `ready` only, and only when an area has that `id`, remove it and add its `openTaskCount` to `noAreaOpenTaskCount` (its open Tasks become *Sem área*); every other combination returns the state unchanged; (4) `canCreateLifeArea(state): boolean`, `true` only for `ready` with `areas.length < LIFE_AREA_LIMIT`; (5) `type LifeAreaNameProblem = "blank" | "too_long" | "duplicate"` and `checkLifeAreaName(raw: string, areas: readonly Pick<LifeAreaDto, "id" | "name">[], ownId: string | null): LifeAreaNameProblem | null`, which runs `validateLifeAreaName(raw)` first (`blank`, `too_long`) and then returns `"duplicate"` when an area whose `id` is not `ownId` has the same `lifeAreaNameKey` as `raw`, else `null` — so renaming `Casa` to `casa` (its own name in another case) is `null`, while the server stays authoritative and answers 409 on the same rule; (6) `isLifeAreaRenameNoop(draft: string, currentName: string): boolean`, `draft.trim() === currentName`, so only an exact no-op is skipped and a case-only change is still sent. Every export carries a short English doc comment naming the AC-A item it serves.
- **MIRROR**: `# SOURCE: src/shared/life-areas.ts:1-11`, `# SOURCE: src/shared/life-areas.ts:27-32`, `# SOURCE: src/shared/google-settings.ts:38-49`, `# SOURCE: src/shared/google-settings.ts:71-80` and `# SOURCE: src/shared/google-settings.ts:87-89`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/life-areas-list.ts; npx prettier --check src/shared/life-areas-list.ts; if grep -hoE 'from "[^"]+"' src/shared/life-areas-list.ts | grep -vE '^from "\./(api|life-areas)"$'; then echo "FAIL: life-areas-list.ts imports outside its siblings"; exit 1; else echo "PASS: only sibling imports"; fi` — `tsc -b` compiles the module into every target project, so a DOM or Worker global in `src/shared/` is a compile error; the behavioural proof is the pair's suite at Level 2.

### Task 2: CREATE src/shared/life-areas-view.ts

- **ACTION**: Create the pure copy and failure-mapping module, delivering AC-A2 (count labels), AC-A3 (field messages, limit and empty copy), AC-A5 (the delete confirmation) and AC-A6 (the failure mapping). Header as Task 1; imports only `./life-areas` (`LIFE_AREA_LIMIT`, `LIFE_AREA_NAME_MAX`), `./life-areas-list` (type `LifeAreaNameProblem`) and `./request-failure` (`classifyRequestFailure`). Export these, with exactly these pt-BR string values (the pair pins them and the screen renders them; ADR-0009; guidelines §12.3): `NO_AREA_LABEL = "Sem área"`; `formatOpenTaskCount(count: number): string` returning `Nenhuma tarefa aberta` for 0, `1 tarefa aberta` for 1 and `<count> tarefas abertas` otherwise (zero special-cased, a count and never a ratio); `LIFE_AREAS_EMPTY_TITLE = "Nenhuma área ainda."`; `LIFE_AREAS_EMPTY_BODY = "Crie a primeira, como Casa ou Saúde, e agrupe suas tarefas."`; `LIFE_AREA_LIMIT_NOTICE` built from the limit, reading `Você já tem 12 áreas. Exclua uma para criar outra.` when `LIFE_AREA_LIMIT` is 12; `formatLifeAreaDeleteTitle(name: string): string` returning `Excluir a área “<name>”?` with curved quotes (U+201C, U+201D); `formatLifeAreaDeleteBody(counts: { taskCount: number; seriesCount: number }): string` returning `Nenhuma tarefa ou série tem esta área. Não dá para desfazer.` when both are 0, and otherwise `<subject> <verb> sem área. Nenhuma é excluída. Não dá para desfazer.` where `<subject>` is `<n> tarefa` or `<n> tarefas` (only when `taskCount > 0`) and `<n> série` or `<n> séries` (only when `seriesCount > 0`), joined by ` e ` when both are present, and `<verb>` is `fica` only when `taskCount + seriesCount` is exactly 1 and `ficam` otherwise — so `{ taskCount: 3, seriesCount: 0 }` reads `3 tarefas ficam sem área. Nenhuma é excluída. Não dá para desfazer.`, `{ 1, 0 }` reads `1 tarefa fica sem área. Nenhuma é excluída. Não dá para desfazer.`, `{ 5, 1 }` reads `5 tarefas e 1 série ficam sem área. Nenhuma é excluída. Não dá para desfazer.` and `{ 0, 2 }` reads `2 séries ficam sem área. Nenhuma é excluída. Não dá para desfazer.`; `formatLifeAreaDeletedNotice(name: string): string` returning `Área “<name>” excluída.`; `lifeAreaNameProblemMessage(problem: LifeAreaNameProblem): string` returning `O nome está em branco. Escreva um nome para a área.` for `blank`, `O nome passa de 40 caracteres. Use um nome mais curto.` for `too_long` (the 40 taken from `LIFE_AREA_NAME_MAX`) and `Já existe uma área com esse nome. Escolha outro nome.` for `duplicate`; and `lifeAreaWriteFailure(cause: unknown): { message: string; staleList: boolean }`, which duck-types a numeric `status` exactly as `classifyRequestFailure` does (this module cannot import `ApiError`): status 400 -> `O nome não foi aceito. Confira o nome e tente de novo.` with `staleList: false`; 404 -> `Essa área não existe mais. A lista foi atualizada.` with `staleList: true`; 409 -> `Esse nome já existe ou o limite de 12 áreas foi atingido. A lista foi atualizada.` (the 12 from `LIFE_AREA_LIMIT`) with `staleList: true`; anything else, including no status at all (the network), -> `classifyRequestFailure(cause).message` with `staleList: false`. The server's own error text (it carries a field marker such as `(name)` meant for tools) is never shown, and a 401 never reaches this function — the screen routes it to the token gate first.
- **MIRROR**: `# SOURCE: src/shared/adherence-view.ts:40-49`, `# SOURCE: src/shared/request-failure.ts:39-51` and `# SOURCE: src/shared/life-areas.ts:1-11`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/life-areas-view.ts; npx prettier --check src/shared/life-areas-view.ts; if grep -hoE 'from "[^"]+"' src/shared/life-areas-view.ts | grep -vE '^from "\./(life-areas|life-areas-list|request-failure)"$'; then echo "FAIL: life-areas-view.ts imports outside its siblings"; exit 1; else echo "PASS: only sibling imports"; fi; grep -qF 'Nenhuma tarefa aberta' src/shared/life-areas-view.ts; grep -qF 'Nenhuma área ainda.' src/shared/life-areas-view.ts; grep -qF 'Nenhuma tarefa ou série tem esta área.' src/shared/life-areas-view.ts; grep -qF 'Nenhuma é excluída.' src/shared/life-areas-view.ts; grep -qF 'Não dá para desfazer.' src/shared/life-areas-view.ts; grep -qF 'O nome está em branco.' src/shared/life-areas-view.ts; grep -qF 'Já existe uma área com esse nome.' src/shared/life-areas-view.ts; grep -qF 'Essa área não existe mais.' src/shared/life-areas-view.ts; grep -qF 'A lista foi atualizada.' src/shared/life-areas-view.ts; if grep -niE 'categoria' src/shared/life-areas-list.ts src/shared/life-areas-view.ts; then echo "FAIL: glossary synonym (categoria) in a new module"; exit 1; else echo "PASS: vocabulary clean"; fi` — the text matches are acceptable here because the deliverable IS the pt-BR copy the screen and the pair's suite depend on.

### Task 3: UPDATE src/shared/app-route.ts

- **ACTION**: Add the `"life-areas"` member to `AppRoute`. In `routeFromPath` add the line `if (path === "/settings/life-areas") return "life-areas";` immediately before the `if (path === "/settings") return "settings";` line, and in `pathOf` add the line `if (route === "life-areas") return "/settings/life-areas";` immediately before the `if (route === "settings") return "/settings";` line (trailing slashes are already stripped by `withoutTrailingSlash`). The path stays English (the module header: ADR-0009 covers visible copy, not URLs). Touch no other behaviour. Delivers AC-A1 (the route is reachable by path and by `navigate`, round-trips, and does not capture `/settings` or an unknown nested path). Do not edit `test/app-route.test.ts`: the test pair adds the additive assertions.
- **MIRROR**: `# SOURCE: src/shared/app-route.ts:25-32`, `# SOURCE: src/shared/app-route.ts:59-64` and `# SOURCE: src/shared/app-route.ts:67-75`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/app-route.ts; npx prettier --check src/shared/app-route.ts; grep -qF 'if (path === "/settings/life-areas") return "life-areas";' src/shared/app-route.ts; grep -qF 'if (route === "life-areas") return "/settings/life-areas";' src/shared/app-route.ts` — `tsc -b` also proves every consumer of the `AppRoute` union still compiles with the new member.

### Task 4: UPDATE src/app/api.ts

- **ACTION**: Add `CreateLifeAreaInput`, `LifeAreaDto`, `LifeAreasResponse` and `UpdateLifeAreaInput` to the type import from `../shared/api`, keeping the list alphabetical. After `fetchAdherence`, add four one-liner wrappers over `request<T>()`, in the style of the reminder and adherence wrappers — no local types, no error re-mapping (a failure already arrives as `ApiError` carrying `status` and the server's message; `request<T>()` already returns `undefined` on a 204): `export async function fetchLifeAreas(): Promise<LifeAreasResponse> { return request<LifeAreasResponse>("/api/life-areas"); }` (returns the whole body because the screen needs `noArea`); `export async function createLifeArea(input: CreateLifeAreaInput): Promise<LifeAreaDto>` which POSTs `JSON.stringify(input)` to `/api/life-areas` and returns `body.lifeArea` from `request<{ lifeArea: LifeAreaDto }>`; `export async function updateLifeArea(id: string, input: UpdateLifeAreaInput): Promise<LifeAreaDto>` which PATCHes `/api/life-areas/${id}` and returns `body.lifeArea`; `export async function deleteLifeArea(id: string): Promise<void>` which sends DELETE to `/api/life-areas/${id}` through `request<void>`. A short English doc comment on the group names life-areas phase 2. Delivers no criterion alone — infrastructure: the client half consumed by Tasks 5 and 6 for AC-A2..AC-A5.
- **MIRROR**: `# SOURCE: src/app/api.ts:178-201` and `# SOURCE: src/app/api.ts:223-226`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/api.ts; npx prettier --check src/app/api.ts; grep -qF 'request<LifeAreasResponse>("/api/life-areas")' src/app/api.ts; grep -qF '/api/life-areas/${id}' src/app/api.ts; grep -qF 'export async function deleteLifeArea' src/app/api.ts`

### Task 5: CREATE src/app/components/LifeAreasScreen.tsx (shell, load, read-only list)

- **ACTION**: Create the route screen, delivering the read half of AC-A2 and AC-A6, the exits of AC-A1 and the layout of AC-A7. Props `{ onUnauthorized: () => void; back: () => void }`. Copy `AdherenceScreen`'s shell, effects and load pattern: `useConnectivity({ onOnline: () => void load() })` (refetch on reconnect, guidelines §12.4), `document.title = "Áreas · Praesto Sum";`, the `Esc` -> `back()` window listener with ONE addition — it returns early when `event.defaultPrevented` is true, so an `Esc` the rename field has already handled (Task 6) cancels the edit and does not also leave the screen — the `latestRequest` stale-response guard, and loads on mount and on `visibilitychange` to visible. State is `const [state, dispatch] = useReducer(reduceLifeAreasList, INITIAL_LIFE_AREAS_LIST_STATE)`. `load()` calls `fetchLifeAreas()` and dispatches `{ type: "loaded", response }`; a 401 `ApiError` calls `onUnauthorized()`; any other failure dispatches `{ type: "load-failed", message: classifyRequestFailure(cause).message }`. The shell is the `data-shell` 100dvh grid with `grid-rows-[auto_auto_1fr]`, a header with the 48 px *Voltar* icon button (`aria-label="Voltar"`), the flat wordmark and the one `<h1>` *Áreas*, the always-render-a-slot offline `Banner` (lead `Sem conexão.`, body `Dá para ler, mas não para salvar por enquanto.`) and a `<main>` with `flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4`. In `<main>`: `loading` renders `<Skeleton />`; `failed` renders the message in a `role="alert"` paragraph (`text-overdue`) with a secondary *Tentar de novo* button calling `load()` — inline and persistent, never a toast; `ready` renders, when `areas.length === 0`, the empty block (`LIFE_AREAS_EMPTY_TITLE` as a `font-semibold` paragraph and `LIFE_AREAS_EMPTY_BODY` muted) with no extra button, because the add form Task 6 places directly beneath it is the one invitation; then a `<ul>` of rows (`rounded-card bg-surface-1 p-4`, the name in `font-text text-t3 font-semibold text-ink` with `min-w-0 break-words`, and `formatOpenTaskCount(area.openTaskCount)` in `font-data text-t2 text-muted`), then the read-only *Sem área* row (`NO_AREA_LABEL` and `formatOpenTaskCount(state.noAreaOpenTaskCount)`, `rounded-card border border-line px-4 py-3`, no control of any kind). Every decidable string comes from `src/shared/life-areas-view.ts`, none re-typed here. No request goes to another origin and no literal colour, size or duration is introduced (tokens only).
- **MIRROR**: `# SOURCE: src/app/components/AdherenceScreen.tsx:63-76`, `# SOURCE: src/app/components/AdherenceScreen.tsx:80-93`, `# SOURCE: src/app/components/AdherenceScreen.tsx:106-117`, `# SOURCE: src/app/components/AdherenceScreen.tsx:126-160` and `# SOURCE: src/app/components/GoogleConnectionCard.tsx:58`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/LifeAreasScreen.tsx; npx prettier --check src/app/components/LifeAreasScreen.tsx; grep -qF 'document.title = "Áreas · Praesto Sum";' src/app/components/LifeAreasScreen.tsx; grep -qF 'event.defaultPrevented' src/app/components/LifeAreasScreen.tsx; grep -qF 'Tentar de novo' src/app/components/LifeAreasScreen.tsx; grep -qF 'reduceLifeAreasList' src/app/components/LifeAreasScreen.tsx; if grep -nE 'fetch\(|https?://' src/app/components/LifeAreasScreen.tsx; then echo "FAIL: a direct fetch or remote URL in the screen"; exit 1; else echo "PASS: requests go through src/app/api.ts only"; fi` — the rendered look is the manual level; `tsc -b` proves the screen's use of the reducer, the copy module and the wrappers type-checks.

### Task 6: UPDATE src/app/components/LifeAreasScreen.tsx (add, rename in place, delete)

- **ACTION**: Add the three write flows, delivering AC-A3, AC-A4, AC-A5 and the write-side states of AC-A6 and AC-A7. Keep the flow state local to the component, none of it in the reducer: `addDraft: string`, `addError: string | null`, `rowMode: { kind: "rename"; id: string; draft: string; error: string | null } | { kind: "delete"; id: string; error: string | null } | null`, `busy: boolean`, `notice: string | null`, and `const writable = canWrite(connectivity) && !busy`. At most one write is in flight and at most one row is in a mode at a time (opening one closes the other). *Add*: when the state is `ready`, `canCreateLifeArea(state)` renders, above the list, a `<form>` with a visible `<label htmlFor="life-area-name">Nova área</label>`, a text `<input id="life-area-name" type="text" enterKeyHint="done" autoComplete="off">` (no `autoFocus`, which guidelines §12.5 reserves for the capture field; no `maxLength`, so the 40-character rule is reported by `checkLifeAreaName` instead of silently truncating) and a primary `<Button type="submit">Adicionar</Button>`; otherwise `LIFE_AREA_LIMIT_NOTICE` renders in its place. Submit runs `checkLifeAreaName(addDraft, state.areas, null)`: a problem sets `addError = lifeAreaNameProblemMessage(problem)` and sends nothing; otherwise `createLifeArea({ name: addDraft })`, and on success bump `latestRequest.current` (so a read that started earlier cannot overwrite the new list), dispatch `{ type: "created", lifeArea }` and clear the draft and the error. *Rename in place*: each row gains two 48 px `variant="icon"` buttons with 8 px between them — `Renomear <name>` (`Pencil`, `id="rename-<id>"`) and `Excluir <name>` (`Trash2`, `id="delete-<id>"`), each with an `aria-label` of that text. *Renomear* sets `rowMode = { kind: "rename", id, draft: area.name, error: null }` and swaps that row's body for a `<form>` holding a visible `<label>` reading `Nome da área`, an `<input>` focused programmatically on entry, and a secondary *Cancelar* and a primary *Salvar* — explicit buttons, never commit-on-blur (guidelines §10 3.2.2: a blur commit would swallow the duplicate and failure messages and race the *Cancelar* tap); `Enter` saves (form submit); `Esc` in the field calls `event.preventDefault()` and cancels the edit only. Save: `isLifeAreaRenameNoop(draft, area.name)` leaves edit mode with no request; otherwise `checkLifeAreaName(draft, state.areas, area.id)` — a problem sets the row's `error` and sends nothing — and otherwise `updateLifeArea(area.id, { name: draft })`, and on success bump `latestRequest.current`, dispatch `{ type: "renamed", lifeArea }` and leave edit mode. *Delete*: *Excluir <name>* sets `rowMode = { kind: "delete", id, error: null }` and swaps the row's body for the shipped `ConfirmView` with `title={formatLifeAreaDeleteTitle(area.name)}`, `body={formatLifeAreaDeleteBody(area)}` (the area's own `taskCount` and `seriesCount`), `cancelLabel="Cancelar"`, `confirmLabel="Excluir"`, `busy={!writable}` and the row's `error`; `ConfirmView` already focuses *Cancelar*. Confirm: `deleteLifeArea(area.id)`, and on success bump `latestRequest.current`, dispatch `{ type: "deleted", id }`, leave the mode and set `notice = formatLifeAreaDeletedNotice(area.name)`, rendered as a `role="status"` paragraph with `tabIndex={-1}` at the top of `<main>` and focused, because the opener no longer exists; the notice clears on the next write attempt. *Failures*: a 401 on any write calls `onUnauthorized()`; any other failure shows `lifeAreaWriteFailure(cause).message` as a `role="alert"` line next to the action that failed (under the add field, under the rename field, inside the `ConfirmView`), keeps the typed text and leaves the action enabled for retry, and when `staleList` is true calls `load()` afterwards so the list matches the server. *Offline*: every add, rename and delete control is `disabled` while `!canWrite(connectivity)`; reads stay available and nothing is queued. *Focus*: after a rename is saved or cancelled focus returns to that row's `Renomear` button, and after a cancelled delete to its `Excluir` button. Icons are `Pencil` (as `TaskRow.tsx:5` imports it) and `Trash2` (as `ConfirmView.tsx` imports it). Do not call `report()`: the sibling route screens do not feed the connectivity reducer from their requests.
- **MIRROR**: `# SOURCE: src/app/components/GoogleConnectionCard.tsx:314-325`, `# SOURCE: src/app/components/InlineTitle.tsx:30-37`, `# SOURCE: src/app/components/InlineTitle.tsx:46-55`, `# SOURCE: src/app/components/CaptureDeck.tsx:66-71`, `# SOURCE: src/app/components/CaptureDeck.tsx:72-78` and `# SOURCE: src/app/components/TaskSheet.tsx:194-204`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/LifeAreasScreen.tsx; npx prettier --check src/app/components/LifeAreasScreen.tsx; grep -qF 'Nova área' src/app/components/LifeAreasScreen.tsx; grep -qF 'Nome da área' src/app/components/LifeAreasScreen.tsx; grep -qF 'Adicionar' src/app/components/LifeAreasScreen.tsx; grep -qF 'cancelLabel="Cancelar"' src/app/components/LifeAreasScreen.tsx; grep -qF 'confirmLabel="Excluir"' src/app/components/LifeAreasScreen.tsx; grep -qF 'checkLifeAreaName' src/app/components/LifeAreasScreen.tsx; grep -qF 'lifeAreaWriteFailure' src/app/components/LifeAreasScreen.tsx; grep -qF 'canWrite(' src/app/components/LifeAreasScreen.tsx; grep -qF 'type="submit"' src/app/components/LifeAreasScreen.tsx` — the interaction itself is the manual level; `tsc -b` proves the flows call the reducer events, the copy functions and the four wrappers with the right shapes.

### Task 7: CREATE src/app/components/LifeAreasEntryCard.tsx and UPDATE src/app/components/SettingsScreen.tsx

- **ACTION**: Create `LifeAreasEntryCard.tsx`, a stateless card copying `AdherenceEntryCard`: `export function LifeAreasEntryCard({ onOpenLifeAreas }: { onOpenLifeAreas: () => void })` rendering `<section aria-label="Áreas" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4">` with one muted paragraph (`m-0 font-text text-t2 text-muted`) reading `Crie áreas da sua vida, como Casa ou Saúde, para agrupar suas tarefas.` and a primary `<Button type="button" variant="primary" onClick={onOpenLifeAreas}>Abrir</Button>`. In `SettingsScreen.tsx` import it and render `<LifeAreasEntryCard onOpenLifeAreas={() => navigate("life-areas")} />` immediately after the `AdherenceEntryCard` line and before the build-stamp paragraph. Change nothing else on the screen (header, `Esc`, banner and the other cards stay as they are). Delivers AC-A1 (the settings entry) and, through the owned `Button` (`min-h-12`), AC-A7's 48 px target.
- **MIRROR**: `# SOURCE: src/app/components/AdherenceEntryCard.tsx:7-18` and `# SOURCE: src/app/components/SettingsScreen.tsx:111-114`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/components/LifeAreasEntryCard.tsx src/app/components/SettingsScreen.tsx; npx prettier --check src/app/components/LifeAreasEntryCard.tsx src/app/components/SettingsScreen.tsx; grep -qF 'navigate("life-areas")' src/app/components/SettingsScreen.tsx; grep -qF 'aria-label="Áreas"' src/app/components/LifeAreasEntryCard.tsx; grep -qF 'Crie áreas da sua vida, como Casa ou Saúde, para agrupar suas tarefas.' src/app/components/LifeAreasEntryCard.tsx` — `tsc -b` proves `"life-areas"` is a valid `AppRoute` for `navigate` (Task 3).

### Task 8: UPDATE src/app/App.tsx

- **ACTION**: Import `LifeAreasScreen` and add `if (route === "life-areas") { return <LifeAreasScreen onUnauthorized={onUnauthorized} back={back} />; }` beside the `adherence` branch, before the `search` branch and the `TodayScreen` fall-through. Touch nothing else. Delivers AC-A1 (the route renders the screen, so the card's `navigate("life-areas")`, a deep link to `/settings/life-areas` and the back gesture all resolve to it).
- **MIRROR**: `# SOURCE: src/app/App.tsx:96-98`.
- **VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/app/App.tsx; npx prettier --check src/app/App.tsx; grep -qF 'route === "life-areas"' src/app/App.tsx; npm run build` — the production build bundles the screen through this import, so a broken module graph fails here and not on the device; read the size report against guidelines §11 for the checklist's item 13.

### Task 9: CREATE PRPs/reports/life-areas/phase-2/ui-checklist.md

- **ACTION**: Create the record (the directory may not exist yet), delivering AC-A8 and the recording half of AC-A7. Read `documentation/40-engineering/ui-ux-guidelines.md`'s "Review checklist" and, after Tasks 1-8 are in place, run Tier A items 1-9 at 375 px dark in the browser pane on the *Áreas* screen and the new entry card (`npm run dev`; fixtures: no area, a few areas with a 40-character name, twelve areas, a delete confirmation for an area holding Tasks and a series, and the failed, slow and offline states), and Tier B items 10-14. Record each item on ONE line that starts with its number, a period and a space (`1. `, `2. `, … `14. `): `✔` with the method, `✘` with a one-line reason on the same line (and the word `exception` there when it is a recorded, conscious exception), `pending live check (orchestrator browser pass)` when no rendered pane was available to the Implementer, or `owed to the owner's device` for the device-only items named in Level 4. Never ✔ from imagination and never claim a screenshot that was not taken (guidelines §12.6). Then add a section headed exactly `## AC-19 walk` with one line per clause of PRD AC-19 (the alphabetical list with open counts, the read-only *Sem área* row, add, rename in place, the delete confirmation naming the counts, `Esc`, the back gesture, the empty state, the failed request, 48 px controls, pt-BR copy) in the same vocabulary — the back gesture is `owed to the owner's device`. Record the `npm run build` size numbers for item 13. One ✘ without a recorded conscious exception means the phase is not done.
- **MIRROR**: `# SOURCE: PRPs/reports/adherence-mirror/phase-3/ui-checklist.md:14-23`.
- **VALIDATE**: `set -euo pipefail; test -s PRPs/reports/life-areas/phase-2/ui-checklist.md; for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14; do grep -qE "^${i}\. " PRPs/reports/life-areas/phase-2/ui-checklist.md; done; grep -qF '## AC-19 walk' PRPs/reports/life-areas/phase-2/ui-checklist.md; if grep -E '^[0-9]+\. .*✘' PRPs/reports/life-areas/phase-2/ui-checklist.md | grep -viE 'exception|owed'; then echo "FAIL: an unexplained ✘ remains in the checklist"; exit 1; else echo "PASS: no unexplained ✘"; fi`

## Validation Commands

Run from the worktree root `C:/repos/assistente-pessoal/.worktrees/life-areas/`.

### Level 1 STATIC_ANALYSIS

```bash
set -euo pipefail
# wrangler types --check && tsc -b && eslint . && prettier --check .
# If the format gate reports a file, run `npx prettier --write <touched non-test files>` first.
npm run check
```

### Level 2 CONTENT_INVARIANTS and UNIT_TESTS

```bash
set -euo pipefail
# the pure modules ADR-0006 froze stay byte-identical to main (PRD AC-23, applied to this phase's diff)
git diff --quiet main -- src/shared/recurrence.ts src/shared/adherence.ts
# this unit adds no migration and changes none (PRD AC-23)
if [ -n "$(git status --porcelain -- migrations)" ] || ! git diff --quiet main -- migrations; then
  echo "FAIL: migrations/ changed — this unit adds none"; exit 1
else
  echo "PASS: migrations/ untouched"
fi
# nothing under .claude/ is part of the diff
test -z "$(git diff --name-only main -- .claude)"
# the two new shared modules import only their siblings
if grep -hoE 'from "[^"]+"' src/shared/life-areas-list.ts src/shared/life-areas-view.ts | grep -vE '^from "\./(api|life-areas|life-areas-list|request-failure)"$'; then
  echo "FAIL: a new shared module imports outside its siblings"; exit 1
else
  echo "PASS: sibling imports only"
fi
# no glossary synonym in the visible copy of the files this phase adds
if grep -niE 'categoria' src/shared/life-areas-list.ts src/shared/life-areas-view.ts src/app/components/LifeAreasScreen.tsx src/app/components/LifeAreasEntryCard.tsx; then
  echo "FAIL: glossary synonym (categoria)"; exit 1
else
  echo "PASS: vocabulary clean"
fi
# both vitest projects: `worker` (inside workerd) and `docs`, including the pair's suites for the new modules and app-route
npm test
```

### Level 3 INTEGRATION and DRY-RUN END-TO-END

```bash
set -euo pipefail
# the production bundle builds with the new screen reachable through App.tsx; read the size report against guidelines §11
npm run build
```

### Level 4 MANUAL (browser pane at 375 px dark, then the owner's device)

Not an exit-code gate: its recorded result is what Task 9's `VALIDATE` checks. Run `npm run dev` and walk the screen (guidelines §12.6: the pane can assert `getBoundingClientRect`, computed styles, the accessibility-relevant DOM, real key presses and the network panel; it cannot be trusted for screenshots or transitions).

| # | Tier | Item | Where it can be done |
|---|------|------|----------------------|
| 1 | A | One primary action on the screen (*Adicionar*); row actions are icon buttons, *Tentar de novo* and the confirm buttons are secondary | browser pane |
| 2 | A | Every tappable control at least 48 x 48 px and at least 8 px from its neighbours: *Voltar*, the field, *Adicionar*, each row's *Renomear* / *Excluir*, *Salvar* / *Cancelar*, the `ConfirmView` buttons, *Tentar de novo*, the entry card's *Abrir* | browser pane |
| 3 | A | No meaning by colour alone (errors are text; the *Sem área* row is read-only by having no control) | browser pane |
| 4 | A | Copy is pt-BR, sentence case, infinitive buttons, zero special-cased (`Nenhuma tarefa aberta`), the delete repeats the verb | browser pane |
| 5 | A | Tab / Enter / Esc: `Enter` adds and saves a rename; `Esc` in the rename field cancels without leaving; `Esc` elsewhere returns to *Configurações*; focus is visible and returns to *Renomear* / *Excluir* | browser pane (real key presses) |
| 6 | A | Icon-only buttons have `aria-label` naming the area; both inputs have visible labels; `<title>` is `Áreas · Praesto Sum`; one `<h1>` | browser pane |
| 7 | A | Tokens only, no literal colour, size or duration; reduced motion honoured | browser pane |
| 8 | A | The irreversible delete is one confirmation that repeats the verb, *Cancelar* focused by default | browser pane |
| 9 | A | Only same-origin `/api/life-areas` requests | browser pane (network panel) |
| 10 | B | Contrast of the five pairs of §4.3 | **owner's device** for the real rendering (no new colour pair is introduced; the pane may compute from tokens) |
| 11 | B | States simulated: empty fixture, failed list request, failed write (keeps the text), offline (banner, writes disabled), slow, twelve areas (limit notice), 404 on delete and 409 on add from a second tab | browser pane (DevTools Network) |
| 12 | B | 375 px and 1280 px column cap | browser pane; **safe areas, keyboard overlap on the add and rename fields, overscroll and the Android back gesture are the owner's device only** |
| 13 | B | `vite build` size report read against §11 | `npm run build`; **Lighthouse on the phone is the owner's device only** |
| 14 | B | Screenshots filed under `PRPs/reports/life-areas/phase-2/` or the reason none exists | **owner's device photos** when the pane cannot render; never claim one that was not taken |

## Acceptance Criteria

- **AC-A1 (PRD AC-19):** Given *Configurações*, when the owner taps *Abrir* on the *Áreas* card, then the app shows the *Áreas* screen at `/settings/life-areas` as a real history entry; `/settings/life-areas` and the `life-areas` route round-trip through `routeFromPath` / `pathOf`, `/settings` still resolves to `settings` and an unknown nested path still resolves to `today`; `Esc`, the header *Voltar* and the back gesture return to *Configurações*; neither the card nor the route adds a bottom bar or a header entry on *Hoje*.
- **AC-A2 (PRD AC-19):** Given the areas request succeeds, then the screen lists his areas alphabetically in pt-BR, each with its open count (`Nenhuma tarefa aberta`, `1 tarefa aberta`, `N tarefas abertas`), followed by a read-only *Sem área* row carrying `noArea.openTaskCount` with no control on it; the resulting list and counts after a create (zero counts, alphabetical position), a rename (counts kept) and a delete (the area gone, its open count added to *Sem área*) are the pure `reduceLifeAreasList`.
- **AC-A3 (PRD AC-19):** Given the owner adds an area, then a blank name, a name over 40 characters or a name equal to an existing one ignoring case and diacritics is refused before any request with a field message next to the field; a valid name appears in its alphabetical position with a zero count; and at 12 areas the form is replaced by `Você já tem 12 áreas. Exclua uma para criar outra.`.
- **AC-A4 (PRD AC-19):** Given the owner renames an area in place, then the row shows a labelled field with explicit *Salvar* and *Cancelar*; `Enter` saves, `Esc` cancels without leaving the screen, an unchanged name sends no request, `Casa` to `casa` is accepted, a duplicate of another area is refused, and the area keeps its open count.
- **AC-A5 (PRD AC-19):** Given the owner deletes an area, then one confirmation asks `Excluir a área “<name>”?`, says how many tarefas and séries lose the area from the area's `taskCount` and `seriesCount` and that none is excluded, repeats the verb on its *Excluir* button, defaults focus to *Cancelar*, and says it cannot be undone; on confirm the area disappears, `Área “<name>” excluída.` is announced and the *Sem área* count grows by the area's open count.
- **AC-A6 (PRD AC-19):** Given the screen is in a non-happy state, then with no area the empty state (`Nenhuma área ainda.` and one cue) invites the first one with the add form directly beneath it; a failed list request is an inline persistent error with *Tentar de novo* (never a toast or a blank screen); a failed write keeps the typed text and shows its message next to the action; and while the device is offline the shared banner shows and every write control is disabled while reads stay.
- **AC-A7 (PRD AC-19):** Given any control on the screen or the entry card, then it is at least 48 px with at least 8 px between neighbours, every icon-only button has an `aria-label` naming its area, every input has a visible label, the copy is pt-BR in sentence case with infinitive buttons, and focus returns to the opener after a rename or a cancelled delete.
- **AC-A8 (PRD AC-23):** Given this phase's diff, then the UI/UX review checklist's ✔/✘ is recorded in `PRPs/reports/life-areas/phase-2/ui-checklist.md` with the device-only items marked owed, `src/shared/recurrence.ts` and `src/shared/adherence.ts` are byte-identical to `main`, no file was added under `migrations/`, no test was removed, skipped or loosened, and `npm run check` and `npm test` pass.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `Esc` inside the rename field also leaves the screen, because the route screens listen on `window` with no `defaultPrevented` check | M | M | The screen's listener returns early on `event.defaultPrevented` and the field's handler calls `preventDefault()` (Tasks 5 and 6); checklist item 5 exercises it with a real key press |
| A read that started before a write lands after it and drops the new area from the list | L | M | Every successful write bumps `latestRequest.current` so the older response is ignored; `created` is idempotent by id (Tasks 1 and 6) |
| POST and PATCH answer no counts, so a naive replace would show zero counts after a rename | M | L | `renamed` keeps the entry's counts and `created` supplies zeros (Task 1) |
| The delete confirmation's counts startle: `taskCount` includes the closed occurrences of a series | M | L | The count is the true number of rows that lose the area (D-J) and the copy says `Nenhuma é excluída.` (Task 2) |
| This device's list is stale after an edit on another device (404 on rename or delete, 409 on add) | L | M | `lifeAreaWriteFailure` marks 404 and 409 `staleList`, the screen refetches after showing the message, and the list also refetches on `visibilitychange` and on reconnect (Tasks 2, 5, 6) |
| Twelve areas with 40-character names overflow a row at 375 px | M | M | Names wrap (`min-w-0 break-words`), rows live in the scroll region, and checklist items 2 and 12 use a twelve-area, 40-character fixture (Tasks 5 and 9; PRD Technical Risks) |
| The pair writes no suite for the new pure modules because the only PRD AC of this row is manual | M | M | Notes pin the names and behaviours and AC-A2..AC-A5 cite AC-19's decidable clauses; Level 2 runs the whole suite and `tsc -b` still guards every signature |
| The back gesture, keyboard overlap and safe areas cannot be verified in the browser pane | H | L | Recorded `owed to the owner's device`; the whole unit's device proof is AC-24 in phase 4 |
| *Renomear* and *Excluir* sit side by side and a mis-tap deletes | L | M | Each is a 48 px target with an 8 px gap, and the delete is gated by a confirmation that defaults focus to *Cancelar* |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework.
- **Where the framework does run:** Level 2's `npm test` is the one framework invocation and the regression guard; it also runs whatever suites the pair authors for the new modules and for `app-route`. The per-task `VALIDATE` commands use `tsc -b`, ESLint, Prettier and literal checks only.
- **For the test pair, names and behaviours this plan pins** (PRD AC-19 is manual and its TDD routing names no pure function for this row, so these modules are this plan's own application of the methodology's "split the logic out" rule): `src/shared/life-areas-list.ts` exports `INITIAL_LIFE_AREAS_LIST_STATE`, `reduceLifeAreasList`, `canCreateLifeArea`, `checkLifeAreaName`, `isLifeAreaRenameNoop` and the types `LifeAreasListState`, `LifeAreasListEvent`, `LifeAreaNameProblem`; `src/shared/life-areas-view.ts` exports `NO_AREA_LABEL`, `formatOpenTaskCount`, `LIFE_AREAS_EMPTY_TITLE`, `LIFE_AREAS_EMPTY_BODY`, `LIFE_AREA_LIMIT_NOTICE`, `formatLifeAreaDeleteTitle`, `formatLifeAreaDeleteBody`, `formatLifeAreaDeletedNotice`, `lifeAreaNameProblemMessage` and `lifeAreaWriteFailure`; `src/app/api.ts` exports `fetchLifeAreas`, `createLifeArea`, `updateLifeArea`, `deleteLifeArea` (untestable glue, `src/app` is outside the test project). Cases worth pinning: the reducer's `loaded` order (`Casa`, `Ética`, `Trabalho`, not bytewise) and its idempotent `created`; `renamed` keeping counts; `deleted` adding `openTaskCount` to `noAreaOpenTaskCount`; `load-failed` keeping a `ready` list; `checkLifeAreaName` for `blank`, 41 characters, `saude` against `Saúde`, and `casa` against its own `Casa` (null); `isLifeAreaRenameNoop` true for an exact match and false for a case change; `formatOpenTaskCount` 0 / 1 / 2; the four `formatLifeAreaDeleteBody` examples in Task 2 plus `{1,1}` (`ficam`) and `{0,0}`; and `lifeAreaWriteFailure` for 400, 404, 409, another status and a status-less cause. Additive `app-route` assertions: `/settings/life-areas` and its trailing-slash form map to `life-areas`, `pathOf("life-areas")` is `/settings/life-areas`, `/settings` still maps to `settings`, `/settings/life-areas/unknown` maps to `today`.
- **PRD-AC mapping (R8).** PRD AC-19 is the only AC of this row, and AC-A1..AC-A7 are its clauses split by observable behaviour; AC-A8 cites PRD AC-23 for the invariants and the "checklist ✔/✘ recorded in the phase report" clause, which that criterion states and the PRD's Technical Approach applies to each phase (its complete-diff inspection stays phase 4's). Two statements are not literal clauses of AC-19 and are disclosed rather than hidden: the offline banner with disabled writes (AC-A6's last clause) comes from the PRD's Phase 2 Scope line ("loading, empty, error, offline") and guidelines §8's mandatory-on-every-screen rule, and the limit notice at 12 areas (AC-A3) comes from AC-3 and D-I applied to the screen. No PRD AC was invented and no plan AC cites a criterion that does not exist; Task 4 is annotated as infrastructure.
- **Decisions left to the plan, with their reasons.** (1) Rename uses explicit *Salvar* / *Cancelar*, not commit-on-blur: the one inline editor shipped (`InlineTitle`) commits on blur, but its field has no server-side name rules to report, and blur-commit here would dismiss a duplicate or failure message the owner never saw and race the *Cancelar* tap (guidelines §10 3.2.2). (2) Write failures map by status to fixed pt-BR sentences and never show the server's text, which carries a field marker such as `(name)`; the client-side check makes 400 and 409 reachable only through a stale list or a race, so 404 and 409 also trigger a refetch. (3) At 12 areas the add form is replaced by a one-line notice instead of a disabled field: a dead control is an element that pays no rent. (4) *Sem área* is shown whenever the list is `ready`, including with zero areas, because AC-19 asks for the row and the count is informative even then. (5) The add form sits above the list so its position does not move as the list grows, and the empty state needs no second button. (6) After a delete the opener is gone, so focus moves to the `role="status"` notice.
- **Slug.** Step 1.4 drops every character outside `[a-z0-9-]` after lowercasing, so "The Áreas screen" becomes `the-reas-screen`; the file name is deterministic, not a typo.
- **Research grounding.** `research-codebase` found no text-input primitive under `src/app/components/ui/` (fields are raw `<input>` with the shared Tailwind classes, copied here), no screen that shows `ApiError.message` for a 400 or 409 (hence decision 2), no reducer-backed list with create / rename / delete (the state and event unions are new design on the `google-settings.ts` shape), and no code that merges a count-less `LifeAreaDto` into a `LifeAreaSummaryDto` list (hence the reducer rules). `research-web` returned Primer's confirmation guidance (a specific question as the title, name the affected items, action-specific button labels, danger styling), the APG modal-dialog advice to focus the least destructive action first, and Iterable Aurora's inline-edit pattern (Enter saves, Esc reverts); its gaps are that no fetched source recommends stating a numeric count of affected items in a destructive confirmation, that Material 3 and Atlassian inline-edit pages were not retrievable, and that no mobile-specific evidence for inline rename versus a sheet exists — the count in the confirmation is the PRD's own decision (D-J), not an externally evidenced practice.
- **Offline banner literal.** The new screen repeats the banner text exactly as `SettingsScreen` and `AdherenceScreen` do; hoisting it into one shared module is guidelines §12.3's third case and is deliberately left out of this phase's scope.
- **Docs and status.** No `docs/` or `documentation/` file is edited here: the architecture listing, the area docs and the roadmap are the post-merge docs update, and the layout standard, glossary, `domain-model.md`, FR-008 and the roadmap row are phase 4 (AC-25). Unit 13 stays `in-progress` after this phase; AC-19's back-gesture clause is owed to the owner's device and the unit's own device proof is AC-24.
- The CLAUDE.md UI/UX gate applies: the Implementer reads `documentation/40-engineering/ui-ux-guidelines.md` and `documentation/40-engineering/ui-layout-standard.md` before touching `src/app/`, and Task 9 records the checklist result.

*Generated: 2026-10-11*
*Approved: 2026-10-12*
*Implemented: 2026-10-12*
*Status: IMPLEMENTED*
