import type {
  CreateTaskInput,
  GoogleCalendarDto,
  GoogleConnectionDto,
  GoogleEventsDto,
  TaskDto,
  UpdateTaskInput,
} from "../shared/api";
import { EMPTY_FILTER, toQuery, type TaskFilter } from "../shared/task-filter";
import { createTokenStore } from "../shared/token-store";
import { durableTokenStorage, legacyTokenStorage } from "./token-storage";

/**
 * Typed client for the Worker API.
 *
 * The bearer token (ADR-0003) lives in IndexedDB behind
 * `src/shared/token-store.ts`, which `navigator.storage.persist()`
 * (requested once at startup, `src/app/main.tsx`) can protect from
 * storage-pressure eviction — unlike the `localStorage` this file used
 * before. With exactly one user and no accounts, the owner pastes it once
 * per device. A 401 still clears it so the app falls back to the token
 * prompt instead of failing silently.
 */

const tokenStore = createTokenStore({ durable: durableTokenStorage, legacy: legacyTokenStorage });

export async function readToken(): Promise<string | null> {
  return tokenStore.read();
}

export async function saveToken(token: string): Promise<void> {
  await tokenStore.save(token);
}

export async function clearToken(): Promise<void> {
  await tokenStore.clear();
}

/**
 * `src/shared/request-failure.ts`'s `classifyRequestFailure` distinguishes
 * an HTTP-level failure from a network-unreachable one purely by the
 * presence of a numeric `status` field on the caught cause — duck-typed
 * rather than an `instanceof ApiError` check, since `src/shared/` cannot
 * import this class (see that module's doc comment for why). Any future
 * change to this class's shape MUST preserve `status: number`, or the
 * classifier must be updated in lockstep.
 */
export class ApiError extends Error {
  readonly status: number;
  /**
   * The server's machine-readable discriminator, when it sent one.
   *
   * Added by unit 4 phase 4. `/api/google/*` answers `{ error, reason }` where
   * `reason` separates `not_connected` from `invalid_grant` from a transport
   * failure — three conditions the owner acts on differently ("conecte",
   * "reconecte", "tente mais tarde"). Without carrying it, every one of them
   * arrives as the single word `unavailable` and the screen cannot choose the
   * right sentence.
   */
  readonly reason: string | null;

  constructor(status: number, message: string, reason: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
  }
}

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
  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const shape =
      body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      "error" in shape ? String(shape.error) : `Request failed with status ${response.status}`;
    const reason = typeof shape.reason === "string" ? shape.reason : null;
    throw new ApiError(response.status, message, reason);
  }
  return body as T;
}

export async function checkHealth(): Promise<void> {
  await request<{ ok: boolean }>("/api/health");
}

/**
 * FR-007 — read Tasks in the API's urgency order: overdue, then today, then
 * future ascending, then undated last.
 *
 * The returned array is NOT re-sorted here, deliberately. The order is the
 * frozen read contract's guarantee, and re-deriving it client-side would put
 * the one thing every consumer must agree on in the one place they cannot
 * share (`docs/api-reference.md`, "Task read contract").
 */
export async function listTasks(
  filter: TaskFilter = EMPTY_FILTER,
  limit?: number,
): Promise<TaskDto[]> {
  const base = toQuery(filter);
  const query =
    limit === undefined ? base : `${base}${base === "" ? "?" : "&"}limit=${String(limit)}`;

  const body = await request<{ tasks: TaskDto[] }>(`/api/tasks${query}`);
  return body.tasks;
}

export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  const body = await request<{ task: TaskDto }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.task;
}

/**
 * FR-002 — edit a Task. An omitted key leaves the field unchanged; an explicit
 * `null` clears it. `JSON.stringify` preserves that distinction as long as the
 * caller omits keys rather than passing `undefined`.
 */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDto> {
  const body = await request<{ task: TaskDto }>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.task;
}

export async function completeTask(id: string): Promise<TaskDto> {
  const body = await request<{ task: TaskDto }>(`/api/tasks/${id}/complete`, { method: "POST" });
  return body.task;
}

export async function reopenTask(id: string): Promise<TaskDto> {
  const body = await request<{ task: TaskDto }>(`/api/tasks/${id}/reopen`, { method: "POST" });
  return body.task;
}

export async function deleteTask(id: string): Promise<void> {
  await request<void>(`/api/tasks/${id}`, { method: "DELETE" });
}

/**
 * FR-027 — the owner's Google commitments for the API's window.
 *
 * Returns the whole window; narrowing it to today is the screen's job
 * (`agendaForToday`), because the window is also what unit 16's week view will
 * consume and the API should not have two shapes.
 *
 * Failures arrive as `ApiError` carrying `reason`, which is what lets the
 * screen distinguish "not connected" from "reconnect" from "try later".
 */
export async function fetchGoogleEvents(): Promise<GoogleEventsDto> {
  return request<GoogleEventsDto>("/api/google/events");
}

/**
 * FR-030 / FR-027 — the five Google connection & calendar wrappers phase 5
 * needs. Each is a one-liner over `request<T>()`, exactly like
 * `fetchGoogleEvents` above: no local types, no error re-mapping — a
 * failure already arrives as `ApiError` carrying `reason`, which is what
 * lets the settings screen tell "not connected" from "reconnect" from "try
 * later" apart.
 */
export async function startGoogleConnect(): Promise<{ consentUrl: string }> {
  return request<{ consentUrl: string }>("/api/google/connect", { method: "POST" });
}

export async function fetchGoogleConnection(): Promise<{ connection: GoogleConnectionDto | null }> {
  return request<{ connection: GoogleConnectionDto | null }>("/api/google/connection");
}

export async function disconnectGoogle(): Promise<{
  disconnected: boolean;
  revokedAtGoogle: boolean;
}> {
  return request<{ disconnected: boolean; revokedAtGoogle: boolean }>("/api/google/connection", {
    method: "DELETE",
  });
}

export async function fetchGoogleCalendars(): Promise<{ calendars: GoogleCalendarDto[] }> {
  return request<{ calendars: GoogleCalendarDto[] }>("/api/google/calendars");
}

export async function saveGoogleCalendars(
  calendarIds: string[],
): Promise<{ calendarIds: string[] }> {
  return request<{ calendarIds: string[] }>("/api/google/calendars", {
    method: "PUT",
    body: JSON.stringify({ calendarIds }),
  });
}
