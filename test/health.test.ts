import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Proves the Hono app is reachable through the real Worker running in workerd,
// with all bindings attached, AND that the token gate of ADR-0003 covers every
// /api/* route — health included.
//
// `exports.default.fetch()` replaces the deprecated `SELF.fetch()`.
//
// Storage isolation is per TEST FILE, not per test. For a clean DB per test use
//   beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
// reset() wipes every binding INCLUDING the schema, so migrations must be
// re-applied immediately after it.
describe("GET /api/health", () => {
  it("rejects a request with no token", async () => {
    const res = await exports.default.fetch("https://example.com/api/health");
    expect(res.status).toBe(401);
  });

  it("rejects a wrong token", async () => {
    const res = await exports.default.fetch("https://example.com/api/health", {
      headers: { Authorization: "Bearer not-the-token" },
    });
    expect(res.status).toBe(401);
  });

  it("answers a request carrying the token", async () => {
    const res = await exports.default.fetch("https://example.com/api/health", {
      headers: { Authorization: `Bearer ${env.API_BEARER_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
