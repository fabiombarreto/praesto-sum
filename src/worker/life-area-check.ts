import { eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { lifeAreas } from "./db/schema";

/**
 * The outcome of `checkLifeAreaId`: the id to store (`null` meaning "no area"),
 * or the 400 message naming `lifeAreaId` for the caller to answer with.
 */
export type LifeAreaIdCheck =
  { ok: true; lifeAreaId: string | null } | { ok: false; error: string };

/**
 * The one existence check shared by the four write paths that accept a
 * `lifeAreaId` (`POST` and `PATCH /api/tasks`, `POST` and `PATCH /api/series`),
 * so an unknown id is refused with a 400 naming the field instead of reaching
 * the foreign key and answering 500 (life-areas PRD AC-8, AC-9, AC-10).
 *
 * Only an absent key or `null` means "no area". A string is looked up as is —
 * an empty string matches no area and is refused, never silently read as
 * "none". The helper never writes.
 *
 * Both messages are pt-BR with the field in parentheses (ADR-0009).
 */
export async function checkLifeAreaId(db: Db, value: unknown): Promise<LifeAreaIdCheck> {
  if (value === undefined || value === null) return { ok: true, lifeAreaId: null };

  if (typeof value !== "string") {
    return { ok: false, error: "A área da vida deve ser texto ou nula (lifeAreaId)" };
  }

  const [found] = await db
    .select({ id: lifeAreas.id })
    .from(lifeAreas)
    .where(eq(lifeAreas.id, value))
    .limit(1);
  if (found === undefined) {
    return { ok: false, error: "A área da vida informada não existe (lifeAreaId)" };
  }

  return { ok: true, lifeAreaId: value };
}
