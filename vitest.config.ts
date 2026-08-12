import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// NOTE: `defineWorkersConfig` / `defineWorkersProject` and the
// "@cloudflare/vitest-pool-workers/config" subpath NO LONGER EXIST in 0.20.1
// (verified: package exports are only ".", "./types", "./codemods/...").
// The pool is a Vite plugin now. Every older tutorial is wrong.
//
// Use `import.meta.dirname`, not `__dirname`: Vite 8 warns that __dirname is
// unsupported by the native config loader.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    test: {
      // Two projects, because they need different runtimes and one of them
      // structurally cannot be workerd:
      //
      // - `worker` is every suite that exercises the real Worker, its Hono
      //   routes, the auth gate and Drizzle against an ephemeral D1. It runs
      //   inside workerd via the pool plugin below.
      // - `docs` reads files off disk to check that `docs/` has not drifted
      //   from the authoritative `documentation/`. workerd has no `node:fs`,
      //   so this one cannot run in the pool at all — it runs in plain Node.
      //
      // Adding a project is not the browser tier the roadmap backlog tracks;
      // that trigger is still unit 6. This one needs no browser, no dependency
      // and no service.
      projects: [
        {
          plugins: [
            cloudflareTest({
              // Bindings, compatibility_date and compatibility_flags come from here.
              // `main` is inferred from wrangler.jsonc.
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                // Test-only bindings: the migrations carried into the workerd isolate,
                // and the API token the auth middleware checks (ADR-0003).
                bindings: { TEST_MIGRATIONS: migrations, API_BEARER_TOKEN: "test-token" },
                // Test-only and experimental: required for `exports.default.scheduled()`.
                // NEVER put this flag in wrangler.jsonc — it cannot be enabled in production.
                compatibilityFlags: ["service_binding_extra_handlers"],
              },
            }),
          ],
          test: {
            name: "worker",
            setupFiles: ["./test/apply-migrations.ts"],
            include: ["test/**/*.test.ts"],
            // The docs suite needs `node:fs`, which workerd does not have.
            exclude: ["test/docs-consistency.test.ts"],
            // Coverage note: @vitest/coverage-v8 does NOT work inside workerd
            // (node:inspector is unavailable). Only @vitest/coverage-istanbul works,
            // and it must be pinned to the exact vitest version.
          },
        },
        {
          test: {
            name: "docs",
            environment: "node",
            include: ["test/docs-consistency.test.ts"],
          },
        },
      ],
    },
  };
});
