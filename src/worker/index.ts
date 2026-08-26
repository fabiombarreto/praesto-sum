import { Hono } from "hono";
import { requireToken } from "./auth";
import { googleRoutes } from "./routes/google";
import { oauthCallbackRoutes } from "./routes/oauth-callback";
import { taskRoutes } from "./routes/tasks";

/**
 * Praesto Sum — the single Worker (ADR-0003/0005).
 *
 * It serves three things from one deployment: the PWA's static assets (handled
 * by the assets binding before this code runs), the JSON API under `/api/*`,
 * and the cron `scheduled()` handler that fires Reminders.
 */
const app = new Hono<{ Bindings: Env }>();

// Every /api/* route is token-gated — including health, per ADR-0003.
app.use("/api/*", requireToken);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/google", googleRoutes);

// UNAUTHENTICATED BY DESIGN, and the only such route in the project (unit 4
// phase 2). It sits here, visibly below the `/api/*` middleware line and
// visibly outside its prefix, because that is the whole security argument:
// Google redirects a browser here with no bearer token to present, so the
// gate CANNOT apply — and the exemption is expressed as a different path
// rather than as a conditional inside `auth.ts`, which stays unconditional.
//
// What closes the route is the single-use `state` nonce, mintable only by an
// authenticated call to `/api/google/connect`. ADR-0003 safeguard 4 is
// therefore scoped here, deliberately, not broken — and `events.watch` stays
// rejected precisely because it offered no equivalent closing mechanism.
//
// Reachability also depends on `/oauth/*` being in `run_worker_first`
// (wrangler.jsonc): without it the SPA's asset router answers Google's
// redirect and this route never runs in production.
app.route("/oauth", oauthCallbackRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,

  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Phase 1 will run two jobs here (ADR-0006 + FR-041):
    //   1. Due-Reminder scan → Web Push dispatch.
    //   2. Recurrence sweep → mark superseded occurrences `missed`, materialize
    //      the next one, and repair any active series with no open occurrence.
    // Both are idempotent by design; the unique indexes in the schema are the
    // structural guard.
  },
} satisfies ExportedHandler<Env>;
