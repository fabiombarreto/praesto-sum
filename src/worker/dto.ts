import type { TaskDto } from "../shared/api";
import type { Task } from "./db/schema";

/**
 * The single mapping point between database rows and the wire contract.
 *
 * Every field is written out explicitly on purpose: this is what makes schema
 * drift a compile error instead of a runtime surprise (see src/shared/api.ts).
 */
export function toTaskDto(row: Task): TaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    scheduledDate: row.scheduledDate,
    priority: row.priority,
    lifeAreaId: row.lifeAreaId,
    seriesId: row.seriesId,
    occurrenceDate: row.occurrenceDate,
    completedAt: toEpochSeconds(row.completedAt),
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
  };
}

function toEpochSeconds(value: Date | null): number | null {
  return value === null ? null : Math.floor(value.getTime() / 1000);
}
