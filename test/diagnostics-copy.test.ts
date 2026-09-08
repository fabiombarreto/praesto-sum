// PRPs/prds/push-channel-proven.prd.md AC-7 Diagnostics endpoint is
// bearer-gated and complete (via plan AC-A3), and AC-8 Manual test push
// reports its outcome (via plan AC-A2) — the pt-BR formatting slice of both
// that is decidable and reachable outside the diagnostics/settings screens.
//
// Source plan: PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 3 — src/shared/diagnostics-copy.ts: formatAbsoluteInstant,
// formatRelativeInstant, deviceSubscriptionLabel, pushOutcomeLabel; plan
// AC-A3, and — for pushOutcomeLabel specifically — AC-A2)
//
// `GET /api/diagnostics` and `POST /api/push/test` are already covered
// server-side (test/diagnostics-route.test.ts, test/push-test-route.test.ts,
// phases 2-3). What phase 4 adds is the CLIENT-SIDE pt-BR rendering of that
// same data — the diagnostics sub-page's absolute/relative time, stale
// notice, subscription-count label, and per-endpoint outcome word; and the
// *Notificações* card's own per-endpoint test-push result line. The screens
// themselves (`NotificationsDiagnosticsScreen.tsx`, `NotificationsCard.tsx`)
// are React glue, exempt and manually verified per
// `docs/context/methodology.md`; this module is the decidable half.
//
// Determinism: `now` is always an argument here, never read from the clock
// internally, mirroring `src/shared/format.ts`'s own discipline. The suite
// runs inside the `worker` vitest project (`@cloudflare/vitest-pool-workers`),
// whose runtime clock is fixed UTC — the same assumption
// `test/format.test.ts`'s `formatEventTime` cases already rely on — so a
// UTC-based instant is used throughout rather than pinning a `timeZone`
// argument the plan's own reference implementation does not accept.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/diagnostics-copy.ts does not exist yet, so this file is RED for
// the right reason (module-not-found on the import below) until plan Task 3
// lands.

import { describe, expect, it } from "vitest";
import type { PushOutcome } from "../src/shared/push-outcome";
import {
  deviceSubscriptionLabel,
  formatAbsoluteInstant,
  formatRelativeInstant,
  pushOutcomeLabel,
} from "../src/shared/diagnostics-copy";

describe("formatAbsoluteInstant (PRD AC-7)", () => {
  it("renders an epoch-seconds instant as pt-BR day/month/year, hour:minute", () => {
    const epochSeconds = Date.UTC(2026, 8, 12, 14, 5, 0) / 1000;
    expect(formatAbsoluteInstant(epochSeconds)).toBe("12/09/2026, 14:05");
  });

  it("zero-pads a single-digit day, month, hour and minute", () => {
    const epochSeconds = Date.UTC(2026, 0, 5, 3, 7, 0) / 1000;
    expect(formatAbsoluteInstant(epochSeconds)).toBe("05/01/2026, 03:07");
  });

  it("is deterministic — the same instant always renders the same string", () => {
    const epochSeconds = Date.UTC(2026, 8, 12, 14, 5, 0) / 1000;
    expect(formatAbsoluteInstant(epochSeconds)).toBe(formatAbsoluteInstant(epochSeconds));
  });
});

describe("formatRelativeInstant (PRD AC-7)", () => {
  it("special-cases a zero gap as 'agora' rather than 'há 0 minutos'", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 14, 5, 0));
    const epochSeconds = now.getTime() / 1000;
    expect(formatRelativeInstant(epochSeconds, now)).toBe("agora");
  });

  it("special-cases an instant at or after 'now' (never a negative gap) as 'agora'", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 14, 5, 0));
    const future = now.getTime() / 1000 + 60;
    expect(formatRelativeInstant(future, now)).toBe("agora");
  });

  it("uses the singular for a one-minute gap", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 14, 6, 0));
    const epochSeconds = Date.UTC(2026, 8, 12, 14, 5, 0) / 1000;
    expect(formatRelativeInstant(epochSeconds, now)).toBe("há 1 minuto");
  });

  it("uses the plural for a multi-minute gap under an hour", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 14, 8, 0));
    const epochSeconds = Date.UTC(2026, 8, 12, 14, 5, 0) / 1000;
    expect(formatRelativeInstant(epochSeconds, now)).toBe("há 3 minutos");
  });

  it("switches to hours at exactly a 60-minute gap — the boundary belongs to hours, not minutes", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 15, 5, 0));
    const epochSeconds = Date.UTC(2026, 8, 12, 14, 5, 0) / 1000;
    expect(formatRelativeInstant(epochSeconds, now)).toBe("há 1 hora");
  });

  it("uses the plural for a multi-hour gap", () => {
    const now = new Date(Date.UTC(2026, 8, 12, 16, 10, 0));
    const epochSeconds = Date.UTC(2026, 8, 12, 14, 5, 0) / 1000;
    expect(formatRelativeInstant(epochSeconds, now)).toBe("há 2 horas");
  });
});

describe("deviceSubscriptionLabel (PRD AC-7)", () => {
  it("names this device as subscribed when true", () => {
    expect(deviceSubscriptionLabel(true)).toBe("Este dispositivo está inscrito.");
  });

  it("names this device as NOT subscribed when false — never a bare omission", () => {
    expect(deviceSubscriptionLabel(false)).toBe("Este dispositivo não está inscrito.");
  });
});

describe("pushOutcomeLabel (PRD AC-7 diagnostics render, PRD AC-8 test-push result)", () => {
  it("labels a delivered outcome", () => {
    const outcome: PushOutcome = { kind: "delivered", statusCode: 201 };
    expect(pushOutcomeLabel(outcome)).toBe("Entregue");
  });

  it("labels a gone outcome as an expired subscription, distinct from delivered", () => {
    const outcome: PushOutcome = { kind: "gone" };
    expect(pushOutcomeLabel(outcome)).toBe("Inscrição expirada");
  });

  it("labels a retryable outcome as a temporary failure, distinct from the other two", () => {
    const outcome: PushOutcome = { kind: "retryable", error: "503", statusCode: 503 };
    expect(pushOutcomeLabel(outcome)).toBe("Falha temporária");
  });

  it("maps every PushOutcome kind to a distinct label — no two kinds share a word", () => {
    const outcomes: PushOutcome[] = [
      { kind: "delivered", statusCode: 200 },
      { kind: "gone" },
      { kind: "retryable", error: "x" },
    ];
    const labels = new Set(outcomes.map(pushOutcomeLabel));
    expect(labels.size).toBe(3);
  });
});
