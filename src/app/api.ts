import type { CreateTaskInput, TaskDto, TaskStatus } from "../shared/api";

/**
 * Typed client for the Worker API.
 *
 * The bearer token (ADR-0003) lives in localStorage: with exactly one user and
 * no accounts, the owner pastes it once per device. A 401 clears it so the app
 * falls back to the token prompt instead of failing silently.
 */

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

  const token = getToken();
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });

  if (response.status === 401) {
    clearToken();
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

export async function listTasks(status?: TaskStatus): Promise<TaskDto[]> {
  const query = status === undefined ? "" : `?status=${status}`;
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
