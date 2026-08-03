import { Hono } from "hono";
import { requireToken } from "./auth";
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
