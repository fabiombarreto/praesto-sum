// PRPs/prds/push-channel-proven.prd.md AC-1 payload-shape
//
// Unit suite for `buildNotificationPayload()` (`src/shared/push-payload.ts`,
// phase 2 subscription-lifecycle, plan Task 1 / plan AC-A1). Pure, DOM-free
// module — mirrors `test/request-failure.test.ts`'s shape: no D1 fixture, no
// bearer-token auth helper, exercised directly against the function.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// `src/shared/push-payload.ts` does not exist yet, so this file is RED for
// the right reason (module-not-found on the import below) until plan Task 1
// lands.

import { describe, expect, it } from "vitest";
import { buildNotificationPayload } from "../src/shared/push-payload";

const LONG_TITLE = "This title is deliberately much longer than thirty characters";
const BASE_INPUT = {
  title: "Short title",
  body: "Você tem um lembrete às 15h",
  route: "/tasks/42",
  tag: "reminder-42",
};

describe("buildNotificationPayload — AC-A1 (PRD AC-1): title truncation to 30 characters", () => {
  it("truncates a title longer than 30 characters to exactly its first 30 characters", () => {
    const result = buildNotificationPayload({ ...BASE_INPUT, title: LONG_TITLE });
    expect(result.title).toBe(LONG_TITLE.slice(0, 30));
    expect(result.title.length).toBe(30);
  });

  it("leaves a title of exactly 30 characters unchanged (boundary)", () => {
    const exact30 = "123456789012345678901234567890";
    expect(exact30.length).toBe(30);
    const result = buildNotificationPayload({ ...BASE_INPUT, title: exact30 });
    expect(result.title).toBe(exact30);
  });

  it("leaves a title shorter than 30 characters unchanged", () => {
    const result = buildNotificationPayload(BASE_INPUT);
    expect(result.title).toBe(BASE_INPUT.title);
  });
});

describe("buildNotificationPayload — AC-A1 (PRD AC-1): body, icon, badge, tag, route", () => {
  it("passes the body through verbatim — the caller decides the wording, not this module", () => {
    const result = buildNotificationPayload(BASE_INPUT);
    expect(result.body).toBe(BASE_INPUT.body);
  });

  it("hardcodes icon and badge to the exact paths src/sw.ts:76-77 already expects", () => {
    const result = buildNotificationPayload(BASE_INPUT);
    expect(result.icon).toBe("/icons/icon-192.png");
    expect(result.badge).toBe("/icons/badge-72.png");
  });

  it("carries the given tag verbatim", () => {
    const result = buildNotificationPayload({ ...BASE_INPUT, tag: "custom-tag" });
    expect(result.tag).toBe("custom-tag");
  });

  it("nests the target route under data.route", () => {
    const result = buildNotificationPayload({ ...BASE_INPUT, route: "/settings/notificacoes" });
    expect(result.data).toEqual({ route: "/settings/notificacoes" });
  });
});

describe("buildNotificationPayload — AC-A1 (PRD AC-1): at most 2 actions, never an empty key", () => {
  it("omits the actions key entirely when no actions are given", () => {
    const result = buildNotificationPayload(BASE_INPUT);
    expect("actions" in result).toBe(false);
  });

  it("omits the actions key when given an empty array — never an empty array on the wire (exactOptionalPropertyTypes)", () => {
    const result = buildNotificationPayload({ ...BASE_INPUT, actions: [] });
    expect("actions" in result).toBe(false);
  });

  it("keeps exactly 2 actions when given exactly 2, unchanged and in order", () => {
    const actions = [
      { action: "complete", title: "Concluir" },
      { action: "snooze", title: "Adiar" },
    ];
    const result = buildNotificationPayload({ ...BASE_INPUT, actions });
    expect(result.actions).toEqual(actions);
  });

  it("caps to the first 2 actions when given 3 — never more than 2", () => {
    const actions = [
      { action: "complete", title: "Concluir" },
      { action: "snooze", title: "Adiar" },
      { action: "dismiss", title: "Dispensar" },
    ];
    const result = buildNotificationPayload({ ...BASE_INPUT, actions });
    expect(result.actions).toHaveLength(2);
    expect(result.actions).toEqual(actions.slice(0, 2));
  });
});
