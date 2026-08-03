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

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** Local day to complete BY. Mutually exclusive with `scheduledDate`. */
  deadline: string | null;
  /** Local day to do it ON. Mutually exclusive with `deadline`. */
  scheduledDate: string | null;
  priority: number | null;
  lifeAreaId: string | null;
  seriesId: string | null;
  occurrenceDate: string | null;
  completedAt: number | null;
  createdAt: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: number | null;
  lifeAreaId?: string | null;
}

export interface ApiErrorBody {
  error: string;
}

export const TASK_STATUSES: readonly TaskStatus[] = ["open", "done", "missed"];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

/** `YYYY-MM-DD`, and a real date on the calendar (rejects 2026-02-31). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
