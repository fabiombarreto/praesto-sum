import type { CreateTaskInput, TaskDto, TaskStatus, UpdateTaskInput } from "../shared/api";
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

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
    const message =
      body !== null && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
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
export async function listTasks(status?: TaskStatus, limit?: number): Promise<TaskDto[]> {
  const params = new URLSearchParams();
  if (status !== undefined) params.set("status", status);
  if (limit !== undefined) params.set("limit", String(limit));
  const query = params.size === 0 ? "" : `?${params.toString()}`;

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
