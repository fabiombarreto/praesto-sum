import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** Drizzle client bound to the request's D1 database. */
export function createDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof createDb>;
