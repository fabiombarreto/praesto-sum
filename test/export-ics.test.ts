// PRPs/prds/data-export.prd.md AC-7 the-ics-is-minimally-valid
// PRPs/prds/data-export.prd.md AC-8 dated-tasks-become-all-day-events-undated-ones-are-absent
// PRPs/prds/events-and-day-view.prd.md AC-20 Export `.ics` (the Event cases, appended at the end)
//
// Pure-module suite for `buildTasksIcs` (src/shared/ics.ts, plan Task 1 of
// data-export phase 2 — "The calendar file"). Route-level auth/headers
// assertions for `GET /api/export.ics` live in test/export-ics-route.test.ts;
// this file covers only the DB-free serializer: RFC 5545 minimums, the
// dated-vs-undated Task selection, and the §3.1 line-folding rule AC-7's own
// "CRLF line endings per RFC 5545" wording invokes.
//
// `buildTasksIcs` does not exist yet — this suite is authored test-first
// (docs/context/methodology.md: tdd: true) and is expected to fail to import
// until the Implementer creates src/shared/ics.ts per the APPROVED plan
// (PRPs/plans/data-export-phase-2-the-calendar-file.plan.md).

import { describe, expect, it } from "vitest";
import type { EventDto, TaskDto } from "../src/shared/api";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
import { buildTasksIcs } from "../src/shared/ics";

/** A local calendar day `offset` days from the server's today, as YYYY-MM-DD. */
function dayOffset(offset: number): string {
  const today = todayIn(new Date(), PRAESTO_TIMEZONE);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-default",
    title: "Comprar leite",
    description: null,
    status: "open",
    deadline: null,
    scheduledDate: null,
    priority: null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    detached: false,
    completedAt: null,
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * A timed Event as the wire carries it (unit 14 events-and-day-view, AC-20): by default
 * 2026-10-20 09:30-10:30 in America/Sao_Paulo, i.e. 12:30Z-13:30Z.
 */
function makeEvent(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id: "event-default",
    title: "Dentista",
    description: null,
    location: null,
    allDay: false,
    startAt: 1792499400,
    endAt: 1792503000,
    startDate: null,
    endDate: null,
    timezone: "America/Sao_Paulo",
    source: "local",
    contentHash: "0".repeat(64),
    createdAt: 1_790_000_000,
    updatedAt: 1_790_000_000,
    ...overrides,
  };
}

/** An all-day Event on 2026-10-26 and 2026-10-27; the stored end 2026-10-28 is EXCLUSIVE. */
function makeAllDayEvent(overrides: Partial<EventDto> = {}): EventDto {
  return makeEvent({
    id: "event-allday",
    title: "Feriado",
    allDay: true,
    startAt: null,
    endAt: null,
    startDate: "2026-10-26",
    endDate: "2026-10-28",
    ...overrides,
  });
}

/** UTC basic-format YYYYMMDDTHHMMSSZ, matching RFC 5545 §3.3.4's DATE-TIME form. */
function utcBasic(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** The single VEVENT block whose UID is derived from `taskId`, unsliced. */
function extractVevent(ics: string, taskId: string): string {
  const marker = `UID:${taskId}@praesto.local`;
  const uidIndex = ics.indexOf(marker);
  expect(uidIndex).toBeGreaterThan(-1);
  const beginIndex = ics.lastIndexOf("BEGIN:VEVENT", uidIndex);
  const endIndex = ics.indexOf("END:VEVENT", uidIndex);
  return ics.slice(beginIndex, endIndex);
}

/**
 * Reconstructs RFC 5545 §3.1 LOGICAL content lines from the physical
 * (possibly folded) ones: a physical line starting with a single space is a
 * continuation of the previous logical line, joined after stripping that one
 * leading space. Used to verify fold round-trip fidelity without assuming
 * where any particular implementation chooses to place its fold points.
 */
function unfoldContentLines(ics: string): string[] {
  const physical = ics.split("\r\n");
  if (physical[physical.length - 1] === "") physical.pop();
  const logical: string[] = [];
  for (const line of physical) {
    if (line.startsWith(" ") && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}

/**
 * Reverses the RFC 5545 §3.3.11 TEXT escaping `buildTasksIcs` is expected to
 * apply to SUMMARY values — the inverse of whatever internal escaping
 * routine the implementation uses, which this test never imports or names.
 * Used only to prove the emitted value round-trips back to the ORIGINAL
 * title, rather than merely containing the right escape shapes in isolation.
 */
function unescapeIcsText(value: string): string {
  return value.replace(/\\(.)/g, (_match, escaped: string) =>
    escaped === "n" || escaped === "N" ? "\n" : escaped,
  );
}

describe("buildTasksIcs — AC-7 minimal RFC 5545 validity", () => {
  it("opens with BEGIN:VCALENDAR, carries VERSION:2.0 and a PRODID, and closes with END:VCALENDAR — every line CRLF-terminated", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const task = makeTask({ id: "task-1", title: "Levar o carro", deadline: dayOffset(1) });

    const ics = buildTasksIcs(now, [task]);

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toMatch(/PRODID:\S.*\r\n/);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);

    // Every line break in the produced STRING must be a real CRLF, never a
    // bare LF. These `\r\n` are escape sequences that produce actual CR+LF
    // byte pairs at runtime regardless of THIS test file's own on-disk line
    // endings — `.gitattributes`'s `* text=auto eol=lf` normalizes source
    // files on disk, not string-literal escape sequences evaluated inside
    // them, so this assertion is not made vacuous by that normalization.
    const withoutCrlf = ics.replace(/\r\n/g, "");
    expect(withoutCrlf).not.toContain("\n");
    expect(withoutCrlf).not.toContain("\r");
  });

  it("gives the VEVENT component a UID derived from the Task's own id and a DTSTAMP of the given instant, never the real clock", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const task = makeTask({ id: "task-1", deadline: dayOffset(1) });

    const ics = buildTasksIcs(now, [task]);
    const vevent = extractVevent(ics, "task-1");

    expect(vevent).toContain("UID:task-1@praesto.local\r\n");
    // Asserts the EXACT formatted instant, not just "some timestamp shape" —
    // a builder that secretly read Date.now() instead of using the `now`
    // parameter could not reproduce this fixed value on a fixed `now`.
    expect(vevent).toContain(`DTSTAMP:${utcBasic(now)}\r\n`);
  });

  it("escapes RFC 5545 TEXT-reserved characters in SUMMARY — comma, semicolon and backslash — and round-trips back to the original title", () => {
    // Kept deliberately short: the title's raw UTF-8 byte length is 48
    // octets (the "ã" and "é" are 2 octets each), and escaping the comma,
    // semicolon and backslash below each adds one octet, for 51 escaped
    // octets. Plus the 8-octet "SUMMARY:" prefix, that totals 59 octets —
    // well under the 75-octet fold boundary the sibling "line folding" test
    // exercises. If this title is ever lengthened, re-check it still does
    // NOT fold (see the explicit no-fold assertion below too), or this test
    // would silently stop proving escaping in isolation from folding.
    const title = "Comprar pão, leite e café; salvar em C:\\backup";
    const now = new Date("2026-09-04T12:00:00.000Z");
    const task = makeTask({ id: "task-escape", title, deadline: dayOffset(1) });

    const ics = buildTasksIcs(now, [task]);

    const physicalLines = ics.split("\r\n");
    const summaryLineIndex = physicalLines.findIndex((line) => line.startsWith("SUMMARY:"));
    expect(summaryLineIndex).toBeGreaterThanOrEqual(0);

    // Explicit no-fold guard: if escaping ever pushed this line past 75
    // octets, the fixture comment above would be lying and the next
    // physical line would be a continuation (start with a single space).
    // This test only claims to cover escaping, not folding — so it must
    // fail loudly here rather than silently exercising a different, unasserted
    // behaviour if the fixture's size assumption ever goes stale.
    expect(new TextEncoder().encode(physicalLines[summaryLineIndex]).length).toBeLessThanOrEqual(
      75,
    );
    expect(physicalLines[summaryLineIndex + 1]?.startsWith(" ")).toBe(false);

    const logicalLines = unfoldContentLines(ics);
    const summaryLogical = logicalLines.find((line) => line.startsWith("SUMMARY:"));
    expect(summaryLogical).toBeDefined();
    const summaryValue = summaryLogical?.slice("SUMMARY:".length) ?? "";

    // Each RFC 5545 §3.3.11 TEXT-reserved character is backslash-escaped —
    // an unescaped comma or semicolon here would let a parser read this
    // ONE SUMMARY value as several fields.
    expect(summaryValue).toContain("\\,");
    expect(summaryValue).toContain("\\;");
    expect(summaryValue).toContain("\\\\");

    // Round trip: unescaping the emitted value must reproduce the ORIGINAL
    // title exactly — accents, spacing and all — the same fidelity standard
    // the folding test holds itself to, rather than trusting escaped shape
    // alone (which a naive implementation could satisfy while still
    // corrupting adjacent text).
    expect(unescapeIcsText(summaryValue)).toBe(title);
  });
});

describe("buildTasksIcs — AC-8 dated Tasks become all-day events; undated ones vanish", () => {
  it("emits exactly two VEVENTs for the two dated Tasks, each dated correctly, and omits the undated Task entirely", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const deadlineDate = dayOffset(3);
    const scheduledDate = dayOffset(10);
    const withDeadline = makeTask({
      id: "task-deadline",
      title: "Tarefa com prazo",
      deadline: deadlineDate,
    });
    const withScheduled = makeTask({
      id: "task-scheduled",
      title: "Tarefa agendada",
      scheduledDate,
    });
    const undated = makeTask({ id: "task-undated", title: "Tarefa sem data nenhuma" });

    const ics = buildTasksIcs(now, [withDeadline, withScheduled, undated]);

    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(2);
    expect(ics).not.toContain("task-undated");
    expect(ics).not.toContain("Tarefa sem data nenhuma");

    const deadlineEvent = extractVevent(ics, "task-deadline");
    expect(deadlineEvent).toContain(`DTSTART;VALUE=DATE:${deadlineDate.replace(/-/g, "")}`);

    const scheduledEvent = extractVevent(ics, "task-scheduled");
    expect(scheduledEvent).toContain(`DTSTART;VALUE=DATE:${scheduledDate.replace(/-/g, "")}`);
  });

  it("prefers `deadline` over `scheduledDate` when a Task carries both — the same `deadline ?? scheduledDate` rule dayItemFromTask already uses", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const deadlineDate = dayOffset(2);
    const scheduledDate = dayOffset(20);
    const task = makeTask({ id: "task-both", deadline: deadlineDate, scheduledDate });

    const ics = buildTasksIcs(now, [task]);
    const vevent = extractVevent(ics, "task-both");

    expect(vevent).toContain(`DTSTART;VALUE=DATE:${deadlineDate.replace(/-/g, "")}`);
    expect(vevent).not.toContain(scheduledDate.replace(/-/g, ""));
  });
});

describe("buildTasksIcs — AC-7 line folding (RFC 5545 §3.1)", () => {
  it("folds a long pt-BR SUMMARY at a UTF-8 code-point boundary — even when the mandatory 75-octet cut falls INSIDE a multi-byte character — without corrupting the title", () => {
    // Deterministically constructed so the 75th octet of the
    // "SUMMARY:<title>" content line (the 8-octet "SUMMARY:" prefix plus the
    // title's own UTF-8 bytes) falls in the middle of the "ã" in
    // "suspensão" — the exact case a naive `slice(0, 75)` corrupts, since it
    // would split that character's two UTF-8 bytes across the fold: the
    // 66-byte ASCII prefix below is followed immediately by "ã" (2 octets,
    // occupying content-line octets 74-75), then "o" and the rest.
    const title =
      "Revisao completa do carro e troca de oleo e verificacao da suspensão antes da longa viagem de férias amanha";

    // Self-check on the FIXTURE (not the SUT): confirm the 75th octet really
    // does land on a UTF-8 continuation byte before trusting the round-trip
    // assertion below to be exercising the intended defect.
    const titleBytes = new TextEncoder().encode(title);
    const prefixOctets = new TextEncoder().encode("SUMMARY:").length; // 8
    const boundaryTitleIndex = 75 - prefixOctets; // 67
    const boundaryByte = titleBytes[boundaryTitleIndex];
    if (boundaryByte === undefined || (boundaryByte & 0xc0) !== 0x80) {
      throw new Error(
        "Fixture invariant broken: the 75-octet fold boundary no longer lands mid-character " +
          "in this title — adjust the fixture before trusting this test.",
      );
    }

    const now = new Date("2026-09-04T12:00:00.000Z");
    const task = makeTask({ id: "task-fold", title, deadline: dayOffset(1) });

    const ics = buildTasksIcs(now, [task]);

    // 1. No physical line may exceed 75 octets — necessary, but NOT
    // sufficient on its own (see checks 2-4).
    for (const physicalLine of ics.split("\r\n")) {
      expect(new TextEncoder().encode(physicalLine).length).toBeLessThanOrEqual(75);
    }

    const physicalLines = ics.split("\r\n");
    const summaryLineIndex = physicalLines.findIndex((line) => line.startsWith("SUMMARY:"));
    expect(summaryLineIndex).toBeGreaterThanOrEqual(0);

    // 2. Folding must actually have happened for this line — a suite that
    // only checked "no line exceeds 75 octets" would pass vacuously on a
    // builder that never folds at all (e.g. one that measures UTF-16
    // `.length` and never realizes an accented line is long).
    const continuationLines: string[] = [];
    for (let i = summaryLineIndex + 1; i < physicalLines.length; i += 1) {
      // `i < physicalLines.length` above guarantees an element exists here —
      // this is not a defensive fallback for a genuinely absent line, only a
      // narrowing of the `T | undefined` `noUncheckedIndexedAccess` forces on
      // every indexed read, so a missing entry fails loudly instead of
      // silently coercing to "" and passing the "starts with space" check.
      const physicalLine = physicalLines[i];
      if (physicalLine === undefined) {
        throw new Error(
          `Expected physical line at index ${i} to exist (physicalLines has ` +
            `${physicalLines.length} entries) — array.split() should never produce a hole.`,
        );
      }
      if (!physicalLine.startsWith(" ")) break;
      continuationLines.push(physicalLine);
    }
    expect(continuationLines.length).toBeGreaterThan(0);

    // 3. Every continuation physical line begins with exactly one space.
    for (const line of continuationLines) {
      expect(line.startsWith(" ")).toBe(true);
      expect(line.startsWith("  ")).toBe(false);
    }

    // 4. The round trip: reconstructing the logical SUMMARY line from its
    // physical (possibly folded) parts — stripping the CRLF and the single
    // leading space of each continuation — must reproduce the ORIGINAL title
    // exactly, accents intact. A fold that landed mid-character would split
    // "ã" into a lone lead byte and a lone continuation byte on separate
    // physical lines; re-joining those raw string halves does not reproduce
    // "ã" (each half decodes as its own separate, wrong character), so this
    // assertion is exactly what a mid-character corruption fails.
    const logicalLines = unfoldContentLines(ics);
    const summaryLogical = logicalLines.find((line) => line.startsWith("SUMMARY:"));
    expect(summaryLogical).toBeDefined();
    expect(summaryLogical?.slice("SUMMARY:".length)).toBe(title);
  });
});

// ---------------------------------------------------------------------------------------------
// Unit 14 events-and-day-view, phase 2 — PRD AC-20 (plan AC-A12, Task 13). Everything above is
// the shipped Task contract and is untouched; everything below is ADDED and is expected to be
// RED until `buildTasksIcs` accepts its optional third argument (today a third argument is
// ignored, so no Event VEVENT is emitted).
//
// The expected lines are literals derived from the PRD, not from the serializer: a timed Event
// 2026-10-20 09:30-10:30 in America/Sao_Paulo (UTC-3) is 12:30Z-13:30Z, so DTSTART is
// `20261020T123000Z` and DTEND `20261020T133000Z`, in UTC with the `Z` suffix and no TZID (so
// no VTIMEZONE is needed); an all-day Event keeps its stored EXCLUSIVE end as DTEND.
// ---------------------------------------------------------------------------------------------

const NOW = new Date("2026-09-04T12:00:00.000Z");

describe("buildTasksIcs — AC-20 a timed Event becomes a UTC VEVENT", () => {
  it("emits DTSTART and DTEND in UTC, a UTC DTSTAMP of the given instant, the UID and the SUMMARY", () => {
    const ics = buildTasksIcs(NOW, [], [makeEvent({ id: "event-1" })]);
    const vevent = extractVevent(ics, "event-1");

    expect(vevent).toContain("UID:event-1@praesto.local\r\n");
    expect(vevent).toContain(`DTSTAMP:${utcBasic(NOW)}\r\n`);
    expect(vevent).toContain("DTSTART:20261020T123000Z\r\n");
    expect(vevent).toContain("DTEND:20261020T133000Z\r\n");
    expect(vevent).toContain("SUMMARY:Dentista\r\n");
  });

  it("is a UTC date-time with no TZID, no VTIMEZONE, no date-only value and no to-do comment", () => {
    const ics = buildTasksIcs(NOW, [], [makeEvent({ id: "event-1" })]);
    const vevent = extractVevent(ics, "event-1");

    expect(vevent).not.toContain("TZID");
    expect(vevent).not.toContain("VALUE=DATE");
    expect(vevent).not.toContain("COMMENT");
    expect(ics).not.toContain("VTIMEZONE");
  });

  it("writes the same UTC lines for an Event authored in another zone", () => {
    // The instant is what is stored; the zone it was authored in does not change it.
    const ics = buildTasksIcs(
      NOW,
      [],
      [makeEvent({ id: "event-ny", timezone: "America/New_York" })],
    );
    const vevent = extractVevent(ics, "event-ny");

    expect(vevent).toContain("DTSTART:20261020T123000Z\r\n");
    expect(vevent).toContain("DTEND:20261020T133000Z\r\n");
    expect(vevent).not.toContain("TZID");
  });

  it("emits no DESCRIPTION and no LOCATION when the Event has none", () => {
    const ics = buildTasksIcs(NOW, [], [makeEvent({ id: "event-1" })]);
    const vevent = extractVevent(ics, "event-1");

    expect(vevent).not.toContain("DESCRIPTION");
    expect(vevent).not.toContain("LOCATION");
  });

  it("emits the DESCRIPTION and the LOCATION when present, with RFC 5545 TEXT escaping, and they round-trip", () => {
    const event = makeEvent({
      id: "event-text",
      title: "Retorno, exames; sala 2",
      description: "Levar exames, laudo e C:\\pasta;\nPerguntar do aparelho",
      location: "Clínica Sorriso, sala 4",
    });

    const ics = buildTasksIcs(NOW, [], [event]);
    const logical = unfoldContentLines(ics);
    const valueOf = (name: string): string =>
      logical.find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1) ?? "";

    // A literal newline in a value must never reach the file as a bare line break.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(valueOf("SUMMARY")).toContain("\\,");
    expect(valueOf("SUMMARY")).toContain("\\;");
    expect(valueOf("DESCRIPTION")).toContain("\\n");
    expect(unescapeIcsText(valueOf("SUMMARY"))).toBe(event.title);
    expect(unescapeIcsText(valueOf("DESCRIPTION"))).toBe(event.description);
    expect(unescapeIcsText(valueOf("LOCATION"))).toBe(event.location);
  });

  it("omits DTEND for a zero-duration Event, because RFC 5545 needs DTEND to be later than DTSTART", () => {
    const ics = buildTasksIcs(NOW, [], [makeEvent({ id: "event-zero", endAt: 1792499400 })]);
    const vevent = extractVevent(ics, "event-zero");

    expect(vevent).toContain("DTSTART:20261020T123000Z\r\n");
    expect(vevent).not.toContain("DTEND");
  });

  it("folds a long DESCRIPTION at 75 octets without cutting an accented character, and it unfolds back", () => {
    const description =
      "Levar os exames de sangue e de urina, o laudo da última consulta, a carteirinha do convênio e a receita nova do médico, " +
      "e perguntar sobre a suspensão do tratamento antes das férias";
    const ics = buildTasksIcs(NOW, [], [makeEvent({ id: "event-long", description })]);

    for (const physicalLine of ics.split("\r\n")) {
      expect(new TextEncoder().encode(physicalLine).length).toBeLessThanOrEqual(75);
    }
    const physical = ics.split("\r\n");
    const start = physical.findIndex((line) => line.startsWith("DESCRIPTION:"));
    expect(start).toBeGreaterThanOrEqual(0);
    expect(physical[start + 1]?.startsWith(" ")).toBe(true);

    const logical = unfoldContentLines(ics).find((line) => line.startsWith("DESCRIPTION:"));
    expect(unescapeIcsText(logical?.slice("DESCRIPTION:".length) ?? "")).toBe(description);
  });
});

describe("buildTasksIcs — AC-20 an all-day Event becomes a date-only VEVENT with its exclusive end", () => {
  it("emits DTSTART and DTEND as DATE values, the stored end verbatim, with no comment", () => {
    const ics = buildTasksIcs(NOW, [], [makeAllDayEvent()]);
    const vevent = extractVevent(ics, "event-allday");

    expect(vevent).toContain("UID:event-allday@praesto.local\r\n");
    expect(vevent).toContain(`DTSTAMP:${utcBasic(NOW)}\r\n`);
    expect(vevent).toContain("DTSTART;VALUE=DATE:20261026\r\n");
    expect(vevent).toContain("DTEND;VALUE=DATE:20261028\r\n");
    expect(vevent).toContain("SUMMARY:Feriado\r\n");
    expect(vevent).not.toContain("COMMENT");
  });

  it("does not turn the days into instants: no date-time DTSTART or DTEND, no Z", () => {
    const ics = buildTasksIcs(NOW, [], [makeAllDayEvent()]);
    const vevent = extractVevent(ics, "event-allday");

    // The DTSTAMP is legitimately a UTC date-time; strip it before looking for any other.
    const withoutStamp = vevent.replace(/DTSTAMP:\S+/, "");

    expect(vevent).not.toMatch(/DTSTART:/);
    expect(vevent).not.toMatch(/DTEND:/);
    expect(withoutStamp).not.toMatch(/T\d{6}Z/);
  });

  it("writes a one-day Event as 20261020 to 20261021", () => {
    const ics = buildTasksIcs(
      NOW,
      [],
      [makeAllDayEvent({ id: "event-one", startDate: "2026-10-20", endDate: "2026-10-21" })],
    );
    const vevent = extractVevent(ics, "event-one");

    expect(vevent).toContain("DTSTART;VALUE=DATE:20261020\r\n");
    expect(vevent).toContain("DTEND;VALUE=DATE:20261021\r\n");
  });

  it("writes an Event ending at a year boundary with a DTEND in the new year", () => {
    const ics = buildTasksIcs(
      NOW,
      [],
      [makeAllDayEvent({ id: "event-nye", startDate: "2026-12-31", endDate: "2027-01-01" })],
    );
    const vevent = extractVevent(ics, "event-nye");

    expect(vevent).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(vevent).toContain("DTEND;VALUE=DATE:20270101\r\n");
  });
});

describe("buildTasksIcs — AC-20 Tasks and Events together; the dated Tasks are unchanged", () => {
  const tasks = [
    makeTask({ id: "task-1", title: "Comprar leite", deadline: "2026-10-22" }),
    makeTask({ id: "task-2", title: "Lavar o carro", scheduledDate: "2026-10-24" }),
    makeTask({ id: "task-undated", title: "Sem data" }),
  ];
  const events = [makeEvent({ id: "event-1" }), makeAllDayEvent()];

  it("keeps every Task VEVENT exactly as the Task-only file writes it", () => {
    const taskOnly = buildTasksIcs(NOW, tasks);
    const both = buildTasksIcs(NOW, tasks, events);

    expect(extractVevent(both, "task-1")).toBe(extractVevent(taskOnly, "task-1"));
    expect(extractVevent(both, "task-2")).toBe(extractVevent(taskOnly, "task-2"));
  });

  it("adds one VEVENT per Event next to the dated Tasks and still omits the undated Task", () => {
    const ics = buildTasksIcs(NOW, tasks, events);

    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(4);
    expect(ics).not.toContain("task-undated");
    expect(ics).toContain("UID:event-1@praesto.local");
    expect(ics).toContain("UID:event-allday@praesto.local");
  });

  it("keeps the to-do comment on the Task VEVENTs only", () => {
    const ics = buildTasksIcs(NOW, tasks, events);

    expect(extractVevent(ics, "task-1")).toContain("COMMENT:");
    expect(extractVevent(ics, "event-1")).not.toContain("COMMENT");
    expect(extractVevent(ics, "event-allday")).not.toContain("COMMENT");
  });

  it("writes the same file whether the Events are an empty list or left out", () => {
    expect(buildTasksIcs(NOW, tasks, [])).toBe(buildTasksIcs(NOW, tasks));
  });

  it("writes a valid calendar of Events alone: CRLF only, opened and closed", () => {
    const ics = buildTasksIcs(NOW, [], events);

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
