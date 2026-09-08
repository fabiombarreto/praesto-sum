/**
 * Classifier for a `sendPush()` result (PRD AC-3, AC-4; plan Task 2 of
 * push-channel-proven phase 2 subscription-lifecycle).
 *
 * Like `src/shared/request-failure.ts`, this module is compiled into BOTH
 * the browser and the Worker projects, so it stays environment-agnostic and
 * free of DOM globals and runtime dependencies. It classifies exactly
 * `sendPush()`'s own `{ ok, statusCode?, error? }` shape
 * (`src/worker/push/send.ts:24-56`) — never reshaping it, only interpreting
 * it.
 *
 * 404/410 classify as `gone` (industry-standard: a permanently expired
 * subscription — see web.dev's push-library guide and Pushpad's documented
 * status-code mapping). Everything else — 429, any 5xx, an unrecognized
 * status code, or no status code at all because the network call itself
 * failed — classifies as `retryable`, never `gone`: PRD AC-4's own
 * rationale is "a transient error never silently discards the owner's only
 * subscription".
 */

export type PushOutcome =
  | { kind: "delivered"; statusCode: number }
  | { kind: "gone" }
  | { kind: "retryable"; error: string; statusCode?: number };

const GONE_STATUS_CODES = new Set([404, 410]);
const DEFAULT_RETRYABLE_ERROR = "push dispatch failed with no status code";

export function classifyPushOutcome(result: {
  ok: boolean;
  statusCode?: number;
  error?: string;
}): PushOutcome {
  if (result.ok) {
    return { kind: "delivered", statusCode: result.statusCode ?? 200 };
  }

  if (result.statusCode !== undefined && GONE_STATUS_CODES.has(result.statusCode)) {
    return { kind: "gone" };
  }

  return {
    kind: "retryable",
    error: result.error ?? DEFAULT_RETRYABLE_ERROR,
    ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }),
  };
}
