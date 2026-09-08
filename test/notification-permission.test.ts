// PRPs/prds/push-channel-proven.prd.md AC-9 Permission flow is a two-step
// state machine.
//
// Source plan: PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 1 — src/shared/notification-permission.ts: NotificationPermissionView,
// classifyNotificationPermissionView; plan AC-A1)
//
// This is the decidable half of AC-9's two-step flow: the browser's raw
// three-value `NotificationPermission` collapses to exactly one of three
// screen-facing views. The prompt itself (`Notification.requestPermission()`),
// the "bloqueadas" copy, and the subscribe/unsubscribe toggle are React glue
// in `src/app/components/NotificationsCard.tsx` — the exempt half of
// `docs/context/methodology.md`'s "Browser-API work" split, verified on the
// device. What is decidable and tested here is the classification itself:
// given a permission value, exactly one view comes back, and the mapping
// never changes shape (three inputs, three distinct outputs, total).
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/notification-permission.ts does not exist yet, so this file is
// RED for the right reason (module-not-found on the import below) until plan
// Task 1 lands. Arguments are passed as plain string literals rather than
// through the ambient DOM `NotificationPermission` type, so this suite does
// not itself depend on whichever `lib` the implementation module resolves
// that type against.

import { describe, expect, it } from "vitest";
import { classifyNotificationPermissionView } from "../src/shared/notification-permission";

describe("classifyNotificationPermissionView (PRD AC-9)", () => {
  it("classifies 'default' as the explainer view — no prompt has fired yet", () => {
    expect(classifyNotificationPermissionView("default")).toBe("explainer");
  });

  it("classifies 'denied' as the blocked view — the 'bloqueadas' state", () => {
    expect(classifyNotificationPermissionView("denied")).toBe("blocked");
  });

  it("classifies 'granted' as the enabled view", () => {
    expect(classifyNotificationPermissionView("granted")).toBe("enabled");
  });

  it("never throws for any of the three real browser permission values", () => {
    for (const permission of ["default", "denied", "granted"] as const) {
      expect(() => classifyNotificationPermissionView(permission)).not.toThrow();
    }
  });

  it("maps every input to a distinct view — three inputs, three outputs, never a shared one", () => {
    const views = new Set(
      (["default", "denied", "granted"] as const).map((permission) =>
        classifyNotificationPermissionView(permission),
      ),
    );
    expect(views.size).toBe(3);
  });
});
