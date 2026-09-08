/**
 * Freshness classifier for the cron's last recorded run (PRD AC-6; plan Task 3
 * of push-channel-proven phase 3 cron-heartbeat).
 *
 * Like `src/shared/push-outcome.ts`, this module is compiled into BOTH the
 * browser and the Worker projects, so it stays environment-agnostic and free
 * of DOM globals and runtime dependencies. It classifies a last-run instant
 * against a reference instant into exactly three states — `fresh`, `stale`,
 * `unknown` — and `stale` must never stand in for `unknown`: a `null`
 * `lastRunAt` means no run was EVER recorded, which is categorically
 * different from a very old one.
 */

export type CronFreshness = "fresh" | "stale" | "unknown";

/** The closed boundary is on the `stale` side: a gap of exactly this many ms is `stale`, not `fresh`. */
export const FRESHNESS_THRESHOLD_MS = 10 * 60 * 1000;

export function classifyCronFreshness(lastRunAt: Date | null, now: Date): CronFreshness {
  if (lastRunAt === null) return "unknown";

  const gapMs = now.getTime() - lastRunAt.getTime();
  return gapMs < FRESHNESS_THRESHOLD_MS ? "fresh" : "stale";
}
