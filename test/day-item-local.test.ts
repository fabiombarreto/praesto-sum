// PRPs/prds/events-and-day-view.prd.md AC-22 One range function, three sources
// (the projection half: a local Event enters the day as a `local` day item)
//
// Source plan: PRPs/plans/events-and-day-view-phase-3-the-range-function-and-the-day.plan.md
// (Task 1 — src/shared/day-item.ts: `DaySource` gains `local`, `LocalDayItem`,
// `dayItemFromLocalEvent`; plan AC-A2, the projection clause).
//
// Mirrors test/day-item-event.test.ts, which pins the same contract for the Google variant.
// The two rules that carry the weight are the ones that decide which DAY an Event lands on:
//
//   - an all-day Event's `startDate` is used VERBATIM (it carries no zone; converting it is how
//     such an Event lands a day off), and
//   - a timed Event's day is the day of `startAt` in the OWNER's zone (`America/Sao_Paulo`),
//     where `startAt` is epoch SECONDS. 22:00 in São Paulo is 01:00 UTC tomorrow, so a UTC-derived
//     day would push every late commitment to the next day, and a startAt read as milliseconds
//     is a day in January 1970. Plan decision D3-1: the Event's own `timezone` field never moves
//     it to another day.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): `dayItemFromLocalEvent`
// does not exist in src/shared/day-item.ts yet, so every case is RED until plan Task 1 lands.

import { describe, expect, it } from "vitest";
import type { EventDto } from "../src/shared/api";
import { dayItemFromLocalEvent } from "../src/shared/day-item";
import { localAllDay, localTimed, spSeconds } from "./day-fixtures";

/** A one-hour timed Event starting at the epoch-seconds instant `startAt`. */
function startingAt(startAt: number, overrides: Partial<EventDto> = {}): EventDto {
  return localTimed("evt", startAt, startAt + 3600, overrides);
}

/** A one-hour timed Event starting at a São Paulo wall-clock moment. */
function timedOn(day: string, time: string, overrides: Partial<EventDto> = {}): EventDto {
  return startingAt(spSeconds(day, time), overrides);
}

describe("dayItemFromLocalEvent — the projection", () => {
  it("tags the item as coming from the local source", () => {
    expect(dayItemFromLocalEvent(timedOn("2026-10-20", "09:30")).source).toBe("local");
  });

  it("carries the Event's own id", () => {
    const event = timedOn("2026-10-20", "09:30", { id: "evt-42" });

    expect(dayItemFromLocalEvent(event).id).toBe("evt-42");
  });

  it("keeps the whole Event reachable, without copying its fields", () => {
    const event = timedOn("2026-10-20", "09:30");

    const item = dayItemFromLocalEvent(event);

    // Identity, not equality: a copy would be a second truth about the same Event — the
    // hand-duplicated-entity-type anti-pattern arriving through the back door.
    expect(item.event).toBe(event);
    expect(Object.keys(item).sort()).toEqual(["closed", "dueDate", "event", "id", "source"]);
  });

  it("is never closed — an Event has no completion state", () => {
    // `docs/domain/areas/events.md`: an Event occurs or is cancelled, never "done". A `true`
    // here would file the owner's commitments under *Concluídas*.
    expect(dayItemFromLocalEvent(timedOn("2026-10-20", "09:30")).closed).toBe(false);
    expect(dayItemFromLocalEvent(localAllDay("a", "2026-10-20", "2026-10-21")).closed).toBe(false);
  });
});

describe("dayItemFromLocalEvent — the due day of an all-day Event", () => {
  it("uses the Event's start date verbatim", () => {
    const event = localAllDay("a", "2026-10-26", "2026-10-28");

    expect(dayItemFromLocalEvent(event).dueDate).toBe("2026-10-26");
  });

  it("uses the start date of a single-day Event, not its exclusive end", () => {
    // A single day D is stored as (D, D + 1): reading the end would land it a day late.
    const event = localAllDay("a", "2026-10-20", "2026-10-21");

    expect(dayItemFromLocalEvent(event).dueDate).toBe("2026-10-20");
  });

  it("does not run the date through the Event's own zone", () => {
    // Auckland is 16 hours ahead of São Paulo: any zone conversion of "2026-10-20" would move it.
    const event = localAllDay("a", "2026-10-20", "2026-10-21", { timezone: "Pacific/Auckland" });

    expect(dayItemFromLocalEvent(event).dueDate).toBe("2026-10-20");
  });
});

describe("dayItemFromLocalEvent — the due day of a timed Event", () => {
  it("derives the day in the owner's zone from an instant in epoch seconds", () => {
    expect(dayItemFromLocalEvent(timedOn("2026-10-20", "09:30")).dueDate).toBe("2026-10-20");
  });

  it("puts a late-evening Event on its LOCAL day, not on the UTC one", () => {
    // 22:00 in São Paulo is 01:00 UTC the next day.
    expect(dayItemFromLocalEvent(timedOn("2026-10-20", "22:00")).dueDate).toBe("2026-10-20");
    expect(dayItemFromLocalEvent(timedOn("2026-10-20", "23:59")).dueDate).toBe("2026-10-20");
  });

  it("keeps an early-UTC instant that is still yesterday locally on yesterday", () => {
    // 2026-10-21T00:30Z is 21:30 on the 20th in São Paulo — the mirror of the case above.
    const instant = Date.UTC(2026, 9, 21, 0, 30) / 1000;

    expect(dayItemFromLocalEvent(startingAt(instant)).dueDate).toBe("2026-10-20");
  });

  it("moves to the next day exactly at local midnight, not a second before", () => {
    const midnight = spSeconds("2026-10-21", "00:00");

    expect(dayItemFromLocalEvent(startingAt(midnight)).dueDate).toBe("2026-10-21");
    expect(dayItemFromLocalEvent(startingAt(midnight - 1)).dueDate).toBe("2026-10-20");
  });

  it("uses the owner's day even when the Event was authored in a zone where it is another day", () => {
    // 2026-10-21T03:30Z is 00:30 on the 21st in São Paulo but 23:30 on the 20th in New York
    // (EDT). The Event belongs to the OWNER's 21st (plan decision D3-1).
    const instant = Date.UTC(2026, 9, 21, 3, 30) / 1000;
    const event = startingAt(instant, { timezone: "America/New_York" });

    expect(dayItemFromLocalEvent(event).dueDate).toBe("2026-10-21");
  });
});

describe("dayItemFromLocalEvent — a DTO missing the start its kind needs", () => {
  // The schema CHECK makes this unreachable from the database, but the type allows it, and the
  // projection's contract (plan Task 1) is `null` rather than a throw or an invented day.
  it("is null for an all-day Event with no start date", () => {
    const broken = localAllDay("a", "2026-10-20", "2026-10-21", { startDate: null });

    expect(dayItemFromLocalEvent(broken).dueDate).toBeNull();
  });

  it("is null for a timed Event with no start instant", () => {
    const broken = timedOn("2026-10-20", "09:30", { startAt: null });

    expect(dayItemFromLocalEvent(broken).dueDate).toBeNull();
  });
});

describe("dayItemFromLocalEvent — purity", () => {
  it("does not mutate the Event it projects", () => {
    const event = timedOn("2026-10-20", "09:30");
    const snapshot = { ...event };

    dayItemFromLocalEvent(event);

    expect(event).toEqual(snapshot);
  });

  it("is deterministic — the same Event projects to the same values every time", () => {
    const event = localAllDay("a", "2026-10-20", "2026-10-22");

    expect(dayItemFromLocalEvent(event)).toEqual(dayItemFromLocalEvent(event));
  });
});
