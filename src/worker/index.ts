import { Hono } from "hono";
import { requireToken } from "./auth";
import { runCronHeartbeat } from "./cron";
import { exportRoutes } from "./routes/export";
import { icsRoutes } from "./routes/export-ics";
import { googleRoutes } from "./routes/google";
import { oauthCallbackRoutes } from "./routes/oauth-callback";
import { diagnosticsRoutes } from "./routes/diagnostics";
import { pushRoutes } from "./routes/push";
import { pushSpikeRoutes } from "./routes/push-spike";
import { reminderRoutes } from "./routes/reminders";
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
app.route("/api/reminders", reminderRoutes);
app.route("/api/google", googleRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/export.ics", icsRoutes);
app.route("/api/push-spike", pushSpikeRoutes);
app.route("/api/push", pushRoutes);
app.route("/api/diagnostics", diagnosticsRoutes);

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
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await runCronHeartbeat(env);
  },
} satisfies ExportedHandler<Env>;
