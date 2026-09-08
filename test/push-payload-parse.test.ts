// PRPs/prds/push-channel-proven.prd.md AC-10 (via plan AC-A4) — src/sw.ts must
// open the correct in-app route when a real push payload arrives.
//
// Source plan: PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 7 amendment — src/shared/push-payload-parse.ts: parsePushPayload; plan AC-A4)
//
// --- Why this file exists (test-reviewer R-AC-COVERAGE, 2026-09-07) -------
// The first draft of this suite classified AC-A4 as NO_TEST_REQUIRED on the
// theory that `src/sw.ts`'s `parsePush` is inextricable from top-level `self`
// calls. `test-reviewer` correctly rejected that: `parsePush`'s BODY is pure
// JSON-shape normalization with fallback defaults — a decision, not glue. Per
// `docs/context/methodology.md`'s "Browser-API work" rule, the exemption is
// for the literal browser-API calls only ("the exemption is for glue, never
// for logic"); PRD AC-10's own sanctioned no-automated-tier exemption is for
// the physical device pass, which is genuinely unfalsifiable — not for this
// function, whose only obstacle was being unexported and colocated with
// `self.*` calls in the same file. This suite is written against the
// extraction contract the plan is being amended to require: a pure function
// in `src/shared/push-payload-parse.ts` that takes an already-parsed JSON
// value (`unknown` — never a raw string, never `JSON.parse` internally) and
// returns the normalized payload shape with its fallback defaults. `src/sw.ts`
// keeps only the `event.data.json()`/`.text()` try-catch and the
// `self.addEventListener` wiring around it — that residual glue stays exempt,
// unchanged from the original outcome row's reasoning.
//
// Pure, DOM-free unit under test: no `self`, no `event`, no browser API.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/push-payload-parse.ts does not exist yet, so this file is RED
// for the right reason (module-not-found on the import below) until the
// amended plan's corresponding task lands.

import { describe, expect, it } from "vitest";
import { buildNotificationPayload } from "../src/shared/push-payload";
import { parsePushPayload, type PushPayload } from "../src/shared/push-payload-parse";

const FALLBACK_TITLE = "Praesto Sum";
const FALLBACK_BODY = "Você tem um lembrete.";

/**
 * Round-trips a value through JSON exactly once, the way a real push message
 * travels over the wire (`JSON.stringify` on the server, `event.data.json()`
 * in the browser) — so `undefined`-valued keys vanish and every value is a
 * JSON primitive, never a live JS reference shared with the builder's output.
 */
function overWire(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

describe("parsePushPayload — agrees with the real builder's output (PRD AC-10 via AC-A4)", () => {
  it("reads the nested {data: {route}} shape buildNotificationPayload emits, over the wire", () => {
    const built = buildNotificationPayload({
      title: "Lembrete",
      body: "Você tem um lembrete às 15h",
      route: "/tasks/42",
      tag: "reminder-42",
    });
    const result = parsePushPayload(overWire(built));
    expect(result.title).toBe("Lembrete");
    expect(result.body).toBe("Você tem um lembrete às 15h");
    expect(result.route).toBe("/tasks/42");
    expect(result.tag).toBe("reminder-42");
    expect(result.icon).toBe("/icons/icon-192.png");
    expect(result.badge).toBe("/icons/badge-72.png");
  });

  it("reads a builder payload with actions, preserving order and content", () => {
    const built = buildNotificationPayload({
      title: "Lembrete",
      body: "Corpo",
      route: "/tasks/7",
      tag: "reminder-7",
      actions: [
        { action: "complete", title: "Concluir" },
        { action: "snooze", title: "Adiar" },
      ],
    });
    const result = parsePushPayload(overWire(built));
    expect(result.actions).toEqual([
      { action: "complete", title: "Concluir" },
      { action: "snooze", title: "Adiar" },
    ]);
  });

  it("omits actions when the builder omitted them — never an empty array", () => {
    const built = buildNotificationPayload({
      title: "Lembrete",
      body: "Corpo",
      route: "/tasks/7",
      tag: "reminder-7",
    });
    const result = parsePushPayload(overWire(built));
    expect("actions" in result).toBe(false);
  });

  it("round-trips a title longer than 30 characters unchanged — the builder already truncated it", () => {
    const longTitle = "This title is deliberately much longer than thirty characters";
    const built = buildNotificationPayload({
      title: longTitle,
      body: "Corpo",
      route: "/tasks/1",
      tag: "reminder-1",
    });
    const result = parsePushPayload(overWire(built));
    expect(result.title).toBe(longTitle.slice(0, 30));
  });
});

describe("parsePushPayload — malformed or missing input falls back per field (PRD AC-10 via AC-A4)", () => {
  const validEnvelope = {
    title: "Lembrete",
    body: "Corpo",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: "reminder-1",
    data: { route: "/tasks/1" },
  };

  it("falls back entirely for a non-object value: a string", () => {
    const result: PushPayload = parsePushPayload("not-an-object");
    expect(result.title).toBe(FALLBACK_TITLE);
    expect(result.body).toBe(FALLBACK_BODY);
    expect("route" in result).toBe(false);
  });

  it("falls back entirely for a non-object value: a number", () => {
    const result = parsePushPayload(42);
    expect(result.title).toBe(FALLBACK_TITLE);
    expect(result.body).toBe(FALLBACK_BODY);
  });

  it("falls back entirely for null", () => {
    const result = parsePushPayload(null);
    expect(result.title).toBe(FALLBACK_TITLE);
    expect(result.body).toBe(FALLBACK_BODY);
  });

  it("falls back entirely for an array — never mistakes it for a keyed object", () => {
    const result = parsePushPayload(["title", "body"]);
    expect(result.title).toBe(FALLBACK_TITLE);
    expect(result.body).toBe(FALLBACK_BODY);
    expect("route" in result).toBe(false);
  });

  it("falls back the title only when title is missing, keeping every other field", () => {
    const { title: _title, ...withoutTitle } = validEnvelope;
    const result = parsePushPayload(withoutTitle);
    expect(result.title).toBe(FALLBACK_TITLE);
    expect(result.body).toBe("Corpo");
    expect(result.route).toBe("/tasks/1");
  });

  it("falls back the body only when body is missing, keeping every other field", () => {
    const { body: _body, ...withoutBody } = validEnvelope;
    const result = parsePushPayload(withoutBody);
    expect(result.body).toBe(FALLBACK_BODY);
    expect(result.title).toBe("Lembrete");
    expect(result.route).toBe("/tasks/1");
  });

  it("omits route (never sets it to undefined) when data is missing entirely", () => {
    const { data: _data, ...withoutData } = validEnvelope;
    const result = parsePushPayload(withoutData);
    expect("route" in result).toBe(false);
    expect(result.title).toBe("Lembrete");
  });

  it("omits route when data is present but its route key is missing", () => {
    const result = parsePushPayload({ ...validEnvelope, data: {} });
    expect("route" in result).toBe(false);
  });

  it("falls back the title when it is the wrong type (a number, not a string)", () => {
    const result = parsePushPayload({ ...validEnvelope, title: 12345 });
    expect(result.title).toBe(FALLBACK_TITLE);
  });

  it("falls back the body when it is the wrong type (an object, not a string)", () => {
    const result = parsePushPayload({ ...validEnvelope, body: { nested: true } });
    expect(result.body).toBe(FALLBACK_BODY);
  });

  it("omits route when data.route is the wrong type (a number, not a string)", () => {
    const result = parsePushPayload({ ...validEnvelope, data: { route: 42 } });
    expect("route" in result).toBe(false);
  });

  it("omits tag (never sets it to undefined) when tag is missing", () => {
    const { tag: _tag, ...withoutTag } = validEnvelope;
    const result = parsePushPayload(withoutTag);
    expect("tag" in result).toBe(false);
  });
});

describe("parsePushPayload — the legacy flat {url} shape is never mistaken for a route (PRD AC-10 via AC-A4)", () => {
  it("does not surface a route when the payload only carries the old flat url field", () => {
    const legacyFlatPayload = {
      title: "Lembrete antigo",
      body: "Corpo antigo",
      url: "/tasks/99",
    };
    const result = parsePushPayload(legacyFlatPayload);
    expect("route" in result).toBe(false);
  });

  it("ignores a sibling flat url even when a valid nested data.route is also present", () => {
    const mixedPayload = {
      title: "Lembrete",
      body: "Corpo",
      url: "/tasks/wrong",
      data: { route: "/tasks/correct" },
    };
    const result = parsePushPayload(mixedPayload);
    expect(result.route).toBe("/tasks/correct");
  });
});
