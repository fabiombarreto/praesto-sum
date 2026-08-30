// PRPs/prds/google-calendar-read.prd.md AC-15 (the calendar selection is
// honoured, with a documented default) and AC-11 (Google failure never
// renders as a free day — manual at the PRD level; this module's `failed`
// kind is the decidable half that makes the manual check meaningful).
//
// Phase 5 does not change either AC's server-side contract (already covered
// — see test/google-calendar-routes.test.ts for AC-15's `primary` default and
// PUT persistence). What this phase adds is a CLIENT-SIDE delta neither AC's
// existing coverage reaches:
//   - AC-15 (via plan AC-A5): a selection DRAFT that must be unsaveable while
//     empty, unsaveable while unchanged, and unsaveable mid-save — so the
//     `PUT /api/google/calendars` request that would answer 400 on an empty
//     array is never built in the first place, rather than discovered from a
//     failed request.
//   - AC-11 (via plan AC-A7): "needs reconnection" is a `reason` ON `failed`,
//     never a fifth top-level kind — mirroring `AgendaState` in
//     `TodayScreen.tsx:92-98` character for character in shape, which is the
//     property that keeps *Hoje* and the settings screen naming a dead
//     credential with the same vocabulary. (The full cross-screen check —
//     that the rendered COPY is literally identical — is a component
//     concern and stays on the manual/device-verified side of
//     `docs/context/methodology.md`'s split; what is decidable and tested
//     here is that the state machine itself never grows a second `kind` for
//     the same condition.)
//
// Source plan: PRPs/plans/google-calendar-read-phase-5-consent-made-visible.plan.md
// (Task 2 — src/shared/google-settings.ts: INITIAL_GOOGLE_SETTINGS_STATE,
// reduceGoogleSettings, canSaveSelection, selectionChanged; plan AC-A4, AC-A5, AC-A7)
//
// Pure, DOM-free unit under test, mirroring `src/shared/task-sheet.ts`'s
// split: the reducer and its two derived predicates are the decidable half;
// the checkbox markup, the `PUT` request and the *Salvar* button are React
// glue in `src/app/components/GoogleConnectionCard.tsx` — exempt, verified
// on the device.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/google-settings.ts does not exist yet, so this file is RED for
// the right reason (module-not-found on the import below) until plan Task 2
// lands. The exact field names on the `connected` state below (`calendars`,
// `draft`, `saving`) and the `load-failed` event are this suite's OWN
// prescription of the contract — the plan names the four kinds and the two
// predicates' rules in prose but not a literal shape, so authoring that shape
// here (grounded in the plan's own words: "the calendar list plus a
// selection draft", "false while it equals what is stored", "false while a
// save is in flight") is what test-first means: Task 2 conforms to this,
// not the other way around.

import { describe, expect, it } from "vitest";
import type { GoogleCalendarDto } from "../src/shared/api";
import {
  INITIAL_GOOGLE_SETTINGS_STATE,
  canSaveSelection,
  reduceGoogleSettings,
  selectionChanged,
} from "../src/shared/google-settings";

function calendar(overrides: Partial<GoogleCalendarDto> = {}): GoogleCalendarDto {
  return { id: "primary", summary: "Fabio", primary: true, selected: true, ...overrides };
}

/** A `connected` state whose draft defaults to exactly what `calendars` reports as stored. */
function connected(
  overrides: { calendars?: GoogleCalendarDto[]; draft?: Set<string>; saving?: boolean } = {},
) {
  const calendars = overrides.calendars ?? [calendar()];
  const stored = new Set(calendars.filter((c) => c.selected).map((c) => c.id));
  return {
    kind: "connected" as const,
    calendars,
    draft: overrides.draft ?? stored,
    saving: overrides.saving ?? false,
  };
}

describe("INITIAL_GOOGLE_SETTINGS_STATE", () => {
  it("starts loading — the screen has not yet heard back from GET /connection", () => {
    expect(INITIAL_GOOGLE_SETTINGS_STATE.kind).toBe("loading");
  });
});

describe("canSaveSelection — the empty-draft rule (plan AC-A5, PRD AC-15)", () => {
  it("is false when the draft is empty, so the 400-triggering request is never built", () => {
    expect(canSaveSelection(connected({ draft: new Set() }))).toBe(false);
  });

  it("is false when the draft equals what is already stored — nothing changed to save", () => {
    const state = connected({
      calendars: [
        calendar({ id: "primary", selected: true }),
        calendar({ id: "work@example.com", summary: "Trabalho", primary: false, selected: false }),
      ],
    });
    expect(canSaveSelection(state)).toBe(false);
  });

  it("is false while a save is already in flight, even with a genuine pending change", () => {
    const state = connected({ draft: new Set(["work@example.com"]), saving: true });
    expect(canSaveSelection(state)).toBe(false);
  });

  it("is true for a non-empty draft that differs from storage and is not mid-save", () => {
    const state = connected({
      calendars: [calendar({ id: "primary", selected: true })],
      draft: new Set(["primary", "work@example.com"]),
    });
    expect(canSaveSelection(state)).toBe(true);
  });

  it("is false, and never throws, before any connection exists", () => {
    expect(() => canSaveSelection(INITIAL_GOOGLE_SETTINGS_STATE)).not.toThrow();
    expect(canSaveSelection(INITIAL_GOOGLE_SETTINGS_STATE)).toBe(false);
  });
});

describe("selectionChanged (PRD AC-15)", () => {
  it("is false when the draft matches storage", () => {
    expect(selectionChanged(connected())).toBe(false);
  });

  it("is true the moment the draft diverges from storage", () => {
    expect(selectionChanged(connected({ draft: new Set(["work@example.com"]) }))).toBe(true);
  });

  it("is false, and never throws, before any connection exists", () => {
    expect(() => selectionChanged(INITIAL_GOOGLE_SETTINGS_STATE)).not.toThrow();
    expect(selectionChanged(INITIAL_GOOGLE_SETTINGS_STATE)).toBe(false);
  });
});

describe("reduceGoogleSettings — a dead credential is `failed`, never a fifth kind (plan AC-A7, PRD AC-11)", () => {
  it("a load failure carrying a reconnect-worthy reason lands on kind: failed", () => {
    const next = reduceGoogleSettings(INITIAL_GOOGLE_SETTINGS_STATE, {
      type: "load-failed",
      reason: "invalid_grant",
    });
    expect(next.kind).toBe("failed");
  });

  it("a load failure carrying a DIFFERENT reason ALSO lands on kind: failed — one vocabulary, not two", () => {
    // If "needs reconnection" were its own fifth kind, this case and the one
    // above would produce two different `kind` values. TodayScreen's own
    // AgendaState has no such fifth kind — `reason` alone tells "connect"
    // from "reconnect" from "try later" — and AC-A7 forbids the settings
    // screen inventing a second vocabulary for the same condition.
    const next = reduceGoogleSettings(INITIAL_GOOGLE_SETTINGS_STATE, {
      type: "load-failed",
      reason: null,
    });
    expect(next.kind).toBe("failed");
  });

  it("carries the reason through unchanged, so the screen can choose the right sentence", () => {
    const next = reduceGoogleSettings(INITIAL_GOOGLE_SETTINGS_STATE, {
      type: "load-failed",
      reason: "invalid_grant",
    });
    expect(next).toMatchObject({ kind: "failed", reason: "invalid_grant" });
  });
});
