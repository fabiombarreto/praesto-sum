// PRPs/prds/repeated-miss-nudge.prd.md AC-9 Payload and deep link (pure copy half)
//
// Source plan: PRPs/plans/repeated-miss-nudge-phase-3-the-cron-step.plan.md
// (Task 1, plan AC-A3).
//
// Authored test-first (per `tdd: true`), before `src/shared/nudge-copy.ts`
// exists. The only seam used is the plan's declared contract:
//   buildNudgeNotification({ seriesId, seriesTitle, streak, openOccurrenceId })
//     -> { title, body, route, tag }
// The cron half of AC-9 (what actually reaches `sendPush`, and "no open
// occurrence => not nudged") lives in test/repeated-miss-nudge-cron.test.ts.

import { describe, expect, it } from "vitest";
import { pathOf, taskRouteOf } from "../src/shared/app-route";
import { buildNudgeNotification } from "../src/shared/nudge-copy";

const SERIES_ID = "series-0001";
const OPEN_ID = "task-open-0001";

function build(overrides: Partial<Parameters<typeof buildNudgeNotification>[0]> = {}) {
  return buildNudgeNotification({
    seriesId: SERIES_ID,
    seriesTitle: "Tomar remedio",
    streak: 3,
    openOccurrenceId: OPEN_ID,
    ...overrides,
  });
}

const FORBIDDEN = /falha|falhando|pulada/i;

describe("buildNudgeNotification — AC-9 (PRD AC-9): the title fits the notification header", () => {
  it("keeps a short series title as the title", () => {
    expect(build({ seriesTitle: "Tomar remedio" }).title).toBe("Tomar remedio");
  });

  it("never exceeds 30 characters, however long the series title is", () => {
    const long = "Revisar o planejamento financeiro mensal da familia inteira";
    expect(long.length).toBeGreaterThan(30);
    expect(build({ seriesTitle: long }).title.length).toBeLessThanOrEqual(30);
  });

  it("stays within 30 characters for a title of exactly 31 characters", () => {
    const title = "a".repeat(31);
    expect(build({ seriesTitle: title }).title.length).toBeLessThanOrEqual(30);
  });

  it.each([null, "", "   "])("falls back to a non-empty title when the series title is %j", (t) => {
    const { title } = build({ seriesTitle: t });
    expect(title.trim().length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(30);
  });
});

describe("buildNudgeNotification — AC-9 (PRD AC-9): the tag is per series", () => {
  it("is the same for the same series whatever the streak, so a repeat replaces instead of stacking", () => {
    expect(build({ streak: 3 }).tag).toBe(build({ streak: 7 }).tag);
  });

  it("differs between two series", () => {
    expect(build({ seriesId: "series-A" }).tag).not.toBe(build({ seriesId: "series-B" }).tag);
  });

  it("is nudge-<seriesId>", () => {
    expect(build().tag).toBe(`nudge-${SERIES_ID}`);
  });
});

describe("buildNudgeNotification — AC-9 (PRD AC-9): the deep link is the open occurrence's Task path", () => {
  it("is /tasks/<open occurrence id>", () => {
    const { route } = build();
    expect(route).toBe(`/tasks/${OPEN_ID}`);
    expect(route).toBe(pathOf(taskRouteOf(OPEN_ID)));
  });

  it("does not depend on the series id", () => {
    expect(build({ seriesId: "another-series" }).route).toBe(`/tasks/${OPEN_ID}`);
  });
});

describe("buildNudgeNotification — AC-9 (PRD AC-9): the copy is pt-BR, names the count and avoids banned words", () => {
  it.each([3, 4, 12])("names the count %i in the body", (streak) => {
    expect(build({ streak }).body).toContain(String(streak));
  });

  it("uses the glossary vocabulary não concluída", () => {
    expect(build().body).toMatch(/n[ãa]o conclu[ií]d/i);
  });

  it("names the series in the notification text when its title fits", () => {
    const { title, body } = build({ seriesTitle: "Tomar remedio" });
    expect(`${title} ${body}`).toContain("Tomar remedio");
  });

  it.each([
    ["a normal title", "Tomar remedio"],
    ["a long title", "Revisar o planejamento financeiro mensal da familia inteira"],
    ["no title", null],
  ])("never contains falha, falhando or pulada (%s)", (_label, seriesTitle) => {
    for (const streak of [3, 4, 10]) {
      const { title, body } = build({ seriesTitle, streak });
      expect(title).not.toMatch(FORBIDDEN);
      expect(body).not.toMatch(FORBIDDEN);
    }
  });
});
