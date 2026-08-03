import { defineConfig } from "drizzle-kit";

/**
 * Praesto Sum — drizzle-kit configuration (Cloudflare D1).
 *
 * Migrations are ALWAYS generated here and ALWAYS applied with
 * `wrangler d1 migrations apply`. NEVER run `drizzle-kit migrate` or
 * `drizzle-kit push`: wrangler owns the `d1_migrations` ledger, drizzle-kit
 * keeps its own `__drizzle_migrations`, and mixing the two produces two
 * independent ledgers over the same database.
 *
 * `generate` needs no database connection at all — dialect + schema + out is
 * the complete required set.
 */

const SCHEMA = "./src/worker/db/schema.ts";
const OUT = "./migrations";

// Guard for a future `db:studio:remote` script. Studio/pull additionally require
// installing @libsql/client (local) or driver "d1-http" credentials (remote);
// neither is needed by `generate`, so no such dependency is pinned yet.
if (process.env.DRIZZLE_REMOTE === "1") {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error(
      "DRIZZLE_REMOTE=1 requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID and CLOUDFLARE_D1_TOKEN.",
    );
  }
}

export default defineConfig({
  dialect: "sqlite",
  schema: SCHEMA,
  out: OUT,
});
