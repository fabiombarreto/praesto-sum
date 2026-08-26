/**
 * Wire contract between the PWA and the Worker API.
 *
 * This module is compiled into BOTH the browser and the Worker projects, so it
 * must stay environment-agnostic and free of runtime dependencies — importing
 * the Drizzle schema here would pull the ORM into the SPA bundle. Drift is still
 * a compile error, not a convention: `src/worker/dto.ts` builds every DTO field
 * by field from the schema row type, so renaming a column breaks the build
 * (docs/anti-patterns.md — "hand-duplicated entity types").
 *
 * Instants cross the wire as epoch SECONDS (the unit D1 stores). Calendar days
 * cross as `YYYY-MM-DD` strings: they are local days, not instants.
 */

export type TaskStatus = "open" | "done" | "missed";

/**
 * The three levels a Task's priority may carry (FR-006, owner-validated
 * 2026-08-12). Enforced twice, like every other domain enum: this union, and a
 * `tasks_priority_chk` CHECK in the schema.
 */
export type TaskPriority = "high" | "normal" | "low";

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** Local day to complete BY. Mutually exclusive with `scheduledDate`. */
  deadline: string | null;
  /** Local day to do it ON. Mutually exclusive with `deadline`. */
  scheduledDate: string | null;
  /** `null` means "not set"; an unset priority sorts as `normal`. */
  priority: TaskPriority | null;
  lifeAreaId: string | null;
  seriesId: string | null;
  occurrenceDate: string | null;
  completedAt: number | null;
  createdAt: number;
}

/**
 * The Google connection's STATUS — never its credential.
 *
 * There is no `refreshToken` field and there must never be one: the token
 * exists only inside the Worker and inside D1 (unit 4 phase 2, ADR-0007). If a
 * future field ever needs to carry it, that is a new decision, not an edit.
 */
export interface GoogleConnectionDto {
  connected: true;
  /** Epoch seconds. */
  connectedAt: number;
  /** The scopes Google actually granted, space-joined, as it reported them. */
  scope: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: TaskPriority | null;
  lifeAreaId?: string | null;
}

/**
 * Partial update of an existing Task.
 *
 * Declared separately from `CreateTaskInput` on purpose: the two mean opposite
 * things by an absent field. On create, absent and cleared are the same thing.
 * On update they are not — an ABSENT key leaves the field exactly as it was,
 * while an explicit `null` clears it. TypeScript cannot express that
 * difference (`{ deadline?: string | null }` is identical either way), so the
 * route enforces it by inspecting the parsed body's own keys; this type
 * describes the contract, it does not police it.
 *
 * `title` is the only field with no `| null`: a Task must always carry one.
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: TaskPriority | null;
}

/**
 * The closed set of keys `PATCH /api/tasks/:id` accepts. Anything else — the
 * server-owned fields (`id`, `status`, `createdAt`, `completedAt`, `seriesId`,
 * `occurrenceDate`, `detached`), `lifeAreaId` (unit 13 owns it), or a typo — is
 * rejected with 400 rather than silently ignored.
 */
export const EDITABLE_TASK_FIELDS: readonly string[] = [
  "title",
  "description",
  "deadline",
  "scheduledDate",
  "priority",
];

/**
 * The hard ceiling on how many Tasks one list response may carry. Enforced
 * whether or not `?limit=` is supplied, so a caller can never receive an
 * unbounded page. It is also the number the paging revisit trigger is expressed
 * against: the first list response over ~500 Tasks (or over 100 KB) is when a
 * cursor stops being premature — see the frozen read contract in
 * `docs/api-reference.md`.
 */
export const MAX_TASK_LIMIT = 500;

export interface ApiErrorBody {
  error: string;
}

export const TASK_STATUSES: readonly TaskStatus[] = ["open", "done", "missed"];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

export const TASK_PRIORITIES: readonly TaskPriority[] = ["high", "normal", "low"];

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (TASK_PRIORITIES as readonly string[]).includes(value);
}

/** `YYYY-MM-DD`, and a real date on the calendar (rejects 2026-02-31). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
