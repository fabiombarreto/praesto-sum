import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup files run OUTSIDE per-test-file storage isolation and may run multiple
// times. applyD1Migrations() only applies migrations not yet recorded in the
// `d1_migrations` table, so this is idempotent.
//
// NOTE: `env` comes from "cloudflare:workers" — the `env` and `SELF` exports of
// "cloudflare:test" are deprecated in 0.20.1.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
