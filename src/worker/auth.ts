import { createMiddleware } from "hono/factory";

/**
 * Bearer-token gate for every `/api/*` route (ADR-0003: the only unauthenticated
 * surface is the PWA shell). There is exactly one user, so there are no
 * accounts, sessions or roles — a single shared secret is the whole model.
 *
 * The comparison is length-safe and constant-time-ish: it avoids leaking the
 * token length through early exit, which is cheap insurance for a public URL.
 */
export const requireToken = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const expected = c.env.API_BEARER_TOKEN;
  if (!expected) {
    // Fail closed: an unconfigured secret must never mean "open to the world".
    return c.json({ error: "Server misconfigured: API_BEARER_TOKEN is not set" }, 500);
  }

  const header = c.req.header("Authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!presented || !timingSafeEqual(presented, expected)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
  return;
});

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  // Different lengths can never match; still walk a fixed number of bytes.
  let mismatch = left.length === right.length ? 0 : 1;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return mismatch === 0;
}
