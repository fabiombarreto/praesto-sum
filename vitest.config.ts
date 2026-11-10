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
                //
                // The GOOGLE_* trio is test-only too and deliberately fake. The
                // suite never reaches Google — every outbound call is faked — so
                // these exist purely to get the routes past their fail-closed
                // "is the integration configured?" guard. The owner's real values
                // live in `.dev.vars` (local) and Worker secrets (production), and
                // must never be needed to run the tests.
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  API_BEARER_TOKEN: "test-token",
                  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
                  GOOGLE_CLIENT_SECRET: "test-client-secret",
                  GOOGLE_REDIRECT_URI: "https://example.com/oauth/callback",
                },
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
            // Both node-project suites need `node:fs`, which workerd does not
            // have. Adding a suite to the `docs` project's include is only half
            // the job — without excluding it here it runs in BOTH, and the
            // workerd copy fails to load with `readdir '/bundle/src'`. That
            // failure is a FILE-level load error, so its tests never run and
            // never appear in the "Tests N passed" line, which is how it was
            // reported green twice before review caught it.
            exclude: [
              "test/docs-consistency.test.ts",
              "test/source-invariants.test.ts",
              "test/push-send-library-verdict.test.ts",
              "test/event-migration-additive.test.ts",
              "test/event-api-inspection.test.ts",
              "test/mirror-inventory.test.ts",
              "test/close-out-docs.test.ts",
            ],
            // Coverage note: @vitest/coverage-v8 does NOT work inside workerd
            // (node:inspector is unavailable). Only @vitest/coverage-istanbul works,
            // and it must be pinned to the exact vitest version.
          },
        },
        {
          test: {
            name: "docs",
            environment: "node",
            // Every suite here reads files off disk to assert something about
            // the repository itself, which workerd cannot do (no node:fs).
            // `source-invariants` covers PRD AC-13's universal negative —
            // "no Calendar mutation exists ANYWHERE" — which no per-call
            // assertion can reach. `event-migration-additive` (unit 14
            // events-and-day-view, AC-8) reads migrations/ to prove 0007 is
            // CREATE-only and 0000-0006 are untouched. `event-api-inspection`
            // (phase 2, AC-16 and the api-reference part of AC-34) reads src/ to
            // prove only the repository writes `events` and no route touches the
            // hash or the link table, and reads docs/api-reference.md.
            // `mirror-inventory` (phase 5, AC-33) spawns scripts/check-mirror-inventory.mjs
            // against planted trees and the real repository, so `npm test` runs the
            // ADR-0007 tripwire on every run. `close-out-docs` (phase 5, AC-34 and the
            // owner hand-off records) reads documentation/, docs/, CLAUDE.md and
            // PRPs/reports/ to pin the facts the close-out documents must state.
            include: [
              "test/docs-consistency.test.ts",
              "test/source-invariants.test.ts",
              "test/push-send-library-verdict.test.ts",
              "test/event-migration-additive.test.ts",
              "test/event-api-inspection.test.ts",
              "test/mirror-inventory.test.ts",
              "test/close-out-docs.test.ts",
            ],
          },
        },
      ],
    },
  };
});
