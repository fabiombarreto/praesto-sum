// PRPs/prds/events-and-day-view.prd.md AC-34 Documentation synced
// PRPs/prds/events-and-day-view.prd.md AC-33 Invariants (the record of the checks that were run)
// PRPs/prds/events-and-day-view.prd.md AC-30 UI/UX review checklist (the unit-level roll-up)
// PRPs/prds/events-and-day-view.prd.md AC-31 Device proof (the record, never the observation)
// PRPs/prds/events-and-day-view.prd.md AC-32 Restore drills (the runbook, never a drill)
//
// Source plan: PRPs/plans/events-and-day-view-phase-5-close-out.plan.md (AC-A2 and AC-A3 to AC-A9;
// Tasks 2 to 9 and the Notes entry "test/close-out-docs.test.ts"). The case titles start with the
// stems the plan's per-task VALIDATE commands filter on (`glossary:`, `domain-model:`,
// `events-area:`, `layout standard:`, `microcopy:`, `traceability:`, `architecture:`,
// `api reference:`, `derived context:` and `hand-off: <record>`); a title that contained another
// stem plus a colon would be picked up by the wrong task, so no describe title carries a colon.
//
// WHAT THIS SUITE IS. The deliverable of this phase IS documentation text, so the contract is the
// text: which facts a document must state and which stale statements it must no longer make. Each
// case reads one document and asserts one fact, scoped to the smallest unit that owns it (a
// numbered item, a section, a table row) so that a phrase a different place legitimately keeps —
// the layout standard's History row still says the local row was "inert until the Compromisso
// sheet ships" — cannot satisfy or break a case that is about another place.
//
// WHAT IT CANNOT PROVE. It proves that a fact is stated, not that it is true, well worded or
// complete: two prose documents cannot be compared for meaning (test/docs-consistency.test.ts
// says the same of itself). It does not run any command. The properties of the unit's diff against
// `main` (frozen files byte-identical, only `0007` new, no test deleted or skipped, `npm run
// check`, `npm test`, `npm run build`) are decided by the plan's own commands, not here: a test
// must not depend on git history. The owner-only criteria — the device proof (AC-31), the two
// restore drills on real snapshots (AC-32) and the release itself — have no test of any kind;
// this file pins only that their RECORDS exist, claim nothing and order the steps correctly.
//
// Every read happens inside a case, never while collecting, so a document that does not exist yet
// fails its own case with a message that names it instead of making the whole file fail to load.
//
// Runs in the `docs` vitest project (plain Node: it reads files off disk, which workerd cannot).
// It is registered in that project's `include` AND in the `worker` project's `exclude` in
// vitest.config.ts; one without the other makes the workerd copy fail to load with a file-level
// error whose tests never even get counted.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): none of the documents below has
// its final text yet and the four hand-off records do not exist, so the cases that name those are
// RED today. A few cases describe a state that already holds (a Status column left alone, a
// History row left in place, a unit not claimed shipped); they pass today and are regression
// guards against over-editing, each named as such where it sits.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const GLOSSARIES = ["documentation/10-product/glossary.md", "docs/domain/glossary.md"];
const DOMAIN_MODEL = "documentation/30-architecture/domain-model.md";
const EVENTS_AREA = "docs/domain/areas/events.md";
const LAYOUT_STANDARD = "documentation/40-engineering/ui-layout-standard.md";
const VISUAL_IDENTITY = "documentation/10-product/visual-identity.md";
const REQUIREMENTS = "documentation/20-requirements/functional-requirements.md";
const ROADMAP = "documentation/50-planning/roadmap.md";
const ARCHITECTURE_OVERVIEW = "documentation/30-architecture/architecture-overview.md";
const CONTEXT_ARCHITECTURE = "docs/context/architecture.md";
const API_REFERENCE = "docs/api-reference.md";
const KNOWLEDGE_BASE = "docs/KNOWLEDGE_BASE.md";
const INTEGRATIONS = "docs/context/integrations.md";
const CLAUDE = "CLAUDE.md";

const REPORTS = "PRPs/reports/events-and-day-view";
const DEVICE_PROOF = `${REPORTS}/device-proof.md`;
const RELEASE_RUNBOOK = `${REPORTS}/phase-5/release-runbook.md`;
const INVARIANTS = `${REPORTS}/phase-5/invariants.md`;
const UI_CHECKLIST = `${REPORTS}/phase-5/ui-checklist.md`;

// --- helpers (each takes text, so the self-checks at the end can feed them planted text) ----------

/** The file's text with CRLF normalized; fails the case, naming the file, when it is missing. */
function mustRead(path: string): string {
  expect(existsSync(path), `${path} does not exist`).toBe(true);
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

/** The text with every run of whitespace collapsed, for phrases a document may wrap. */
function flat(text: string): string {
  return text.replace(/\s+/g, " ");
}

/**
 * The text from the line that `from` matches up to (not including) the next `to` after it, or to
 * the end. A missing start throws: a section that is not found must never read as an empty one,
 * or every "does not say" check on it would pass for the wrong reason.
 */
function section(text: string, from: RegExp, to?: RegExp): string {
  const head = from.exec(text);
  if (head === null) throw new Error(`no section starts at ${String(from)}`);
  const afterHead = head.index + head[0].length;
  const stop = to === undefined ? -1 : text.slice(afterHead).search(to);
  return text.slice(head.index, stop === -1 ? text.length : afterHead + stop);
}

/** The first line `pattern` matches; throws when there is none. */
function lineMatching(text: string, pattern: RegExp): string {
  const found = text.split("\n").find((line) => pattern.test(line));
  if (found === undefined) throw new Error(`no line matches ${String(pattern)}`);
  return found;
}

/** The cells of a Markdown table row, without the pipes that frame the row. */
function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** The `---` frontmatter value of `key`, or undefined. */
function frontmatterValue(text: string, key: string): string | undefined {
  const block = /^---\n([\s\S]*?)\n---/.exec(text);
  if (block?.[1] === undefined) return undefined;
  for (const line of block[1].split("\n")) {
    const field = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (field?.[1] === key) return field[2]?.trim();
  }
  return undefined;
}

/** A numbered item of the layout standard's §2 (`3`, `3.5`, `11`), up to the next numbered item. */
function itemBlock(anatomy: string, item: string): string {
  return section(
    anatomy,
    new RegExp(`^${item.replace(".", "\\.")}\\. `, "m"),
    /\n\d+(?:\.\d+)?\. /,
  );
}

/** The data rows of the layout standard's History table, newest first. */
function historyRows(text: string): string[] {
  const rows = section(text, /^## History\s*$/m)
    .split("\n")
    .filter((line) => line.startsWith("|"));
  return rows.slice(2); // the header row and the separator
}

function layoutSection(text: string, number: number): string {
  const next = number === 6 ? /^## History\s*$/m : new RegExp(`^## ${number + 1}\\. `, "m");
  return section(text, new RegExp(`^## ${number}\\. `, "m"), next);
}

// --- AC-34: the glossary, the domain model and the Events area -------------------------------------

describe("AC-34 — the glossary, the domain model and the Events area agree with ADR-0016", () => {
  it.each(GLOSSARIES)(
    "glossary: the Event row of %s names Compromisso as the pt-BR copy and keeps its avoided synonyms",
    (path) => {
      const row = lineMatching(mustRead(path), /^\|\s*\*\*Event\*\*\s*\|/);
      const [, definition, synonyms] = cells(row);

      expect(definition).toContain("*Compromisso*");
      expect(definition).toContain("pt-BR");
      // `Compromisso` is the screen word, never a synonym to avoid: the avoided cell stays as it was.
      expect(synonyms).toBe("appointment, meeting, calendar entry");
    },
  );

  it("domain-model: the entity diagram draws no edge between Life Area and Event", () => {
    const diagram = /```mermaid\n([\s\S]*?)```/.exec(mustRead(DOMAIN_MODEL))?.[1] ?? "";
    const edges = diagram
      .split("\n")
      .filter((line) => /\bLIFE_AREA\b/.test(line) && /\bEVENT\b/.test(line));

    // Guards against matching nothing: the diagram must still be there and still draw Life Area to Task.
    expect(diagram).toContain("LIFE_AREA ||--o{ TASK");
    expect(edges).toEqual([]);
  });

  it("domain-model: the Event section names Compromisso as the pt-BR copy", () => {
    const eventSection = section(mustRead(DOMAIN_MODEL), /^### Event\s*$/m, /^### Reminder\s*$/m);

    expect(eventSection).toContain("Compromisso");
  });

  it("events-area: the end is described as filled for the owner rather than merely optional (FR-020, ADR-0016)", () => {
    const text = mustRead(EVENTS_AREA);
    const businessRules = section(text, /^## Business rules/m, /^## Phase 2 FR set/m);

    expect(text).not.toContain("start required, end optional");
    expect(businessRules).toContain("ADR-0016");
    expect(businessRules).toMatch(/fill/i);
  });

  it("events-area: Life Areas no longer group Events, and the deferral is attributed to ADR-0015", () => {
    const text = mustRead(EVENTS_AREA);
    const relationships = section(text, /^## Relationships/m, /^## Storage model/m);

    expect(text).not.toContain("**Life Areas** group Events");
    expect(relationships).toContain("ADR-0015");
  });

  it("events-area: the Google read is no longer called absent and unit 14 is no longer told to be born sync-aware", () => {
    const text = mustRead(EVENTS_AREA);
    const relationships = section(text, /^## Relationships/m, /^## Storage model/m);

    expect(text).not.toContain("no integration code exists yet");
    expect(text).not.toContain("must be **born sync-aware**");
    // The migration itself, not the ADR-0007 the bullet already cites.
    expect(relationships).toMatch(/(?<!ADR-)\b0007\b/);
    expect(relationships).toMatch(/shipped/i);
  });
});

// --- AC-34: the layout standard and the microcopy table --------------------------------------------

describe("AC-34 — the layout standard carries the dated amendment and the microcopy table the approved strings", () => {
  it("layout standard: §2 item 3 carries the dated note that Com hora stays withdrawn", () => {
    const item3 = itemBlock(layoutSection(mustRead(LAYOUT_STANDARD), 2), "3");

    expect(item3).toContain("*Com hora* stays withdrawn");
    expect(item3).toMatch(/Amended \d{4}-\d{2}-\d{2}, unit 14/);
    // The old sentence is qualified, not deleted.
    expect(item3).toContain("It returns as an option only when Event ships in unit 14");
  });

  it("layout standard: §2 item 4 says a local row opens the Compromisso sheet and no longer calls it inert", () => {
    // Scoped to the item: the History row of phase 3 legitimately keeps the old clause.
    const item4 = itemBlock(layoutSection(mustRead(LAYOUT_STANDARD), 2), "4");

    expect(item4).not.toContain("inert until the Compromisso sheet ships");
    expect(item4).toContain("opens the Compromisso sheet");
  });

  it("layout standard: §2 item 11 names *Novo compromisso* as the way into the Compromisso sheet", () => {
    const item11 = itemBlock(layoutSection(mustRead(LAYOUT_STANDARD), 2), "11");

    expect(item11).toContain("*Novo compromisso*");
    expect(item11).toContain("Compromisso sheet");
  });

  it("layout standard: §3 describes the Compromisso sheet and its irreversible confirmation", () => {
    const surfaces = layoutSection(mustRead(LAYOUT_STANDARD), 3);

    expect(surfaces).toContain("Compromisso sheet");
    expect(surfaces).toContain("Excluir este compromisso?");
  });

  it.each([
    "*Título*",
    "*Dia inteiro*",
    "*Início*",
    "*Fim*",
    "*Hora*",
    "*Fuso horário*",
    "*Local*",
    "*Descrição*",
  ])("layout standard: §3 lists the field label %s of the Compromisso sheet", (label) => {
    expect(layoutSection(mustRead(LAYOUT_STANDARD), 3)).toContain(label);
  });

  it("layout standard: §5 records that Esc closes the Compromisso sheet and that / ignores a focused select", () => {
    const desktop = layoutSection(mustRead(LAYOUT_STANDARD), 5);

    expect(desktop).toContain("Compromisso sheet");
    // A word-bounded match: the rejected two-pane specification kept in §5 says "selection".
    expect(desktop).toMatch(/\bselect\b/);
  });

  it("layout standard: the §6 unit-14 row describes the sheet and the Compromissos group instead of deferring them", () => {
    const row = lineMatching(
      layoutSection(mustRead(LAYOUT_STANDARD), 6),
      /^\|\s*14 events-and-day-view\s*\|/,
    );

    expect(row).not.toContain("not described here yet");
    expect(row).toContain("Compromisso sheet");
    expect(row).toContain("Compromissos");
    expect(row).toContain("§3");
  });

  it("layout standard: History opens with a row for events-and-day-view phase 4 that cites its checklist", () => {
    const rows = historyRows(mustRead(LAYOUT_STANDARD));
    const newest = rows[0] ?? "";

    expect(newest).toMatch(/^\| 20\d\d-\d\d-\d\d \| \*\*events-and-day-view phase 4\.\*\*/);
    expect(newest).toContain("`PRPs/reports/events-and-day-view/phase-4/ui-checklist.md`");
    for (const sectionMark of ["§3", "§5", "§6"]) expect(newest).toContain(sectionMark);
    // Newest first: the phase-3 row is still in the table, below it.
    expect(
      rows.findIndex((row) => row.includes("**events-and-day-view phase 3.**")),
    ).toBeGreaterThan(0);
  });

  it("layout standard: last_updated moves to the date of that History row", () => {
    const text = mustRead(LAYOUT_STANDARD);
    const lastUpdated = frontmatterValue(text, "last_updated");
    const rowDate = /^\| (\d{4}-\d{2}-\d{2}) \|/.exec(historyRows(text)[0] ?? "")?.[1];

    expect(lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(lastUpdated) > "2026-10-19", `last_updated is still ${lastUpdated}`).toBe(true);
    expect(lastUpdated).toBe(rowDate);
  });

  it("layout standard: the phase-3 History row keeps its original wording (regression guard, green today)", () => {
    const row = historyRows(mustRead(LAYOUT_STANDARD)).find((line) =>
      line.includes("**events-and-day-view phase 3.**"),
    );

    expect(row).toBeDefined();
    // History records what was true then; amending item 4 must not rewrite it.
    expect(row).toContain("inert until the Compromisso sheet ships");
  });

  it.each([
    "Dia anterior",
    "Próximo dia",
    "Navegar entre dias",
    "Dia inteiro",
    "Compromissos",
    "Tarefas",
  ])(
    'microcopy: the table of visual-identity.md lists the owner-approved string "%s"',
    (wanted) => {
      const table = section(
        mustRead(VISUAL_IDENTITY),
        /^Microcopy table/m,
        /^Approved by the owner on 2026-08-20/m,
      );
      const rows = table.split("\n").filter((line) => line.startsWith("|"));

      expect(rows.some((row) => row.includes(wanted))).toBe(true);
    },
  );

  // The owner approved the phase-4 strings on 2026-10-27 (PRD D-W): they moved from "must not be
  // listed" to "must be listed". Updated at that decision, not loosened.
  it.each([
    "Novo compromisso",
    "Fuso horário",
    "Termina em dd/MM/aaaa às HH:mm.",
    "Termina em dd/MM/aaaa.",
    "Informe o título.",
    "Use no máximo N caracteres.",
    "Informe o dia de início.",
    "Informe a hora de início.",
    "O fim não pode ser antes do início.",
    "Excluir este compromisso?",
    "Não dá para desfazer.",
    "Este compromisso não existe mais. A lista foi atualizada.",
    "dd/MM/aaaa · HH:mm",
  ])(
    'microcopy: the table lists the phase-4 string the owner approved on 2026-10-27 "%s"',
    (wanted) => {
      const table = section(
        mustRead(VISUAL_IDENTITY),
        /^Microcopy table/m,
        /^Approved by the owner on 2026-08-20/m,
      );
      expect(table).toContain(wanted);
    },
  );

  it("microcopy: the table lists the new field label Hora", () => {
    const table = section(
      mustRead(VISUAL_IDENTITY),
      /^Microcopy table/m,
      /^Approved by the owner on 2026-08-20/m,
    );
    expect(table).toMatch(/· Dia · Hora ·/);
  });

  it("microcopy: the table lists none of the search-copy proposals the owner has not approved (regression guard)", () => {
    const table = section(
      mustRead(VISUAL_IDENTITY),
      /^Microcopy table/m,
      /^Approved by the owner on 2026-08-20/m,
    );
    const unapproved = ["Pesquisar tarefas e compromissos", "Nada encontrado para"];

    expect(unapproved.filter((text) => table.includes(text))).toEqual([]);
  });
});

// --- AC-34: requirement traceability and the roadmap -------------------------------------------------

describe("AC-34 — traceability and the roadmap say what is true about unit 14", () => {
  /** The last cell of the traceability row whose first cells match `pattern`. */
  function lastTraceCell(pattern: RegExp): string {
    const data = cells(lineMatching(mustRead(REQUIREMENTS), pattern));
    return data[data.length - 1] ?? "";
  }

  it("traceability: the FR-042 row names unit 14 `events-and-day-view` as extending the export to Events", () => {
    const cell = lastTraceCell(/^\|\s*FR-042,\s*FR-043\s*\|/);

    expect(cell).toContain("14 `events-and-day-view`");
    expect(cell).toContain("extended to Events");
  });

  it("traceability: the FR-040 row names unit 14 `events-and-day-view` as extending search to Events", () => {
    const cell = lastTraceCell(/^\|\s*FR-040\s*\|\s*Phase 1\s*\|/);

    expect(cell).toContain("14 `events-and-day-view`");
    expect(cell).toContain("extended to Events");
  });

  it("traceability: the FR-020 to FR-023 row names unit 14 `events-and-day-view` as in-progress", () => {
    const cell = lastTraceCell(/^\|\s*FR-020\s*…\s*FR-023\s*\|/);

    expect(cell).toContain("14 `events-and-day-view`");
    expect(cell).toContain("in-progress");
  });

  it("traceability: the requirement rows keep their Status column (regression guard, green today)", () => {
    const text = mustRead(REQUIREMENTS);
    const statuses = ["FR-020", "FR-021", "FR-022", "FR-023", "FR-040", "FR-042"].map((id) => {
      const data = cells(lineMatching(text, new RegExp(`^\\|\\s*${id}\\s*\\|\\s*The owner`)));
      return `${id} ${data[data.length - 1]}`;
    });

    expect(statuses).toEqual([
      "FR-020 accepted",
      "FR-021 accepted",
      "FR-022 accepted",
      "FR-023 accepted",
      "FR-040 accepted",
      "FR-042 accepted",
    ]);
  });

  // Updated at facts, not loosened: PR #13 was merged on 2026-11-10 (merge commit 2b693b9), and the unit was
  // deployed as v0.14.0 on 2026-11-11, so the row's pinned state moved from "not yet merged or deployed" to
  // "merged, not yet deployed" to "merged and deployed as v0.14.0". It still must stay in-progress.
  it("traceability: the roadmap's unit-14 row says it is merged and deployed as v0.14.0, and stays in-progress", () => {
    const row = lineMatching(mustRead(ROADMAP), /^\|\s*14\s*\|\s*`events-and-day-view`\s*\|/);

    expect(row).toContain("merge commit `2b693b9`");
    expect(row).toContain("deployed as `v0.14.0`");
    expect(row).not.toContain("not yet deployed");
    expect(row).not.toContain("not yet merged");
    expect(row).not.toContain("nothing is built");
    expect(row).not.toContain("All five phases `pending`");
    expect(row).toMatch(/\|\s*\*\*in-progress\*\*/);
    // The unit becomes shipped only on the owner's decision after the device proof.
    expect(row).not.toContain("**shipped**");
  });

  it("traceability: the roadmap's Now block no longer says all five phases are pending", () => {
    const now = lineMatching(mustRead(ROADMAP), /^- \*\*Now:\*\*/);

    expect(now).not.toContain("five phases all `pending`");
  });

  it("traceability: the roadmap's Now block says unit 14 is merged and deployed as v0.14.0", () => {
    const now = lineMatching(mustRead(ROADMAP), /^- \*\*Now:\*\*/);

    expect(now).not.toContain("implemented on the unit's feature branch");
    expect(now).toContain(
      "all five phases are implemented, merged (PR #13, 2026-11-10) and deployed as `v0.14.0` on 2026-11-11",
    );
  });
});

// --- AC-34: the architecture, the API reference and the derived context -----------------------------

describe("AC-34 — the architecture documents, the API reference and the derived context are current", () => {
  it("architecture: the overview describes the Event tables, the range function and the day route", () => {
    const text = flat(mustRead(ARCHITECTURE_OVERVIEW));

    expect(text).toContain("event_sync_links");
    expect(text).toContain("itemsInRange");
    expect(text).toContain("/day/");
  });

  it("architecture: the overview no longer says there is no router", () => {
    expect(flat(mustRead(ARCHITECTURE_OVERVIEW))).not.toContain("There is no router");
  });

  it("architecture: the overview no longer carries its two other false statements (313 tests, no version field)", () => {
    const text = flat(mustRead(ARCHITECTURE_OVERVIEW));

    expect(text).not.toContain("313 tests");
    expect(text).not.toMatch(/carries no `version` field/);
  });

  it("architecture: docs/context/architecture.md no longer calls the layout standard unamended, AC-32 owed to phase 5 or the close-out pending", () => {
    const text = flat(mustRead(CONTEXT_ARCHITECTURE));

    expect(text).not.toContain("is not yet amended for the sheet");
    expect(text).not.toContain("still owed to phase 5");
    expect(text).not.toContain("the device proof) is pending");
  });

  it("architecture: docs/context/architecture.md says the Google read shipped instead of that no code exists", () => {
    const text = mustRead(CONTEXT_ARCHITECTURE);
    const google = lineMatching(text, /^- \*\*Google Calendar\*\*/);

    expect(text).not.toContain("no integration code exists yet");
    expect(google).toMatch(/shipped/i);
  });

  it("api reference: the unit 14 to 18 row of the Not built yet table no longer says the day and the sheet are still to come", () => {
    const row = lineMatching(mustRead(API_REFERENCE), /^\|\s*14–18 \(Phase 2\)\s*\|/);

    expect(row).not.toContain("are still to come");
    // The rest of the row is left alone.
    expect(row).toContain("/api/events");
    expect(row).toContain("Units 15–18");
    expect(row).toContain("FR-020..026, FR-010");
  });

  it("api reference: the legacy-numbered rows and the note about them are left untouched (regression guard, green today)", () => {
    const text = mustRead(API_REFERENCE);

    for (const legacy of ["4 `data-export`", "5 `push-channel-proven`", "6 `reminders`"]) {
      expect(text).toContain(`| ${legacy} |`);
    }
    expect(flat(text)).toContain(
      "keep the legacy numbers 4/5/6 above rather than their current roadmap numbers 5/6/7",
    );
  });

  it("derived context: the knowledge base cites ADR-0001..0016 and no longer the old range", () => {
    const text = mustRead(KNOWLEDGE_BASE);

    expect(text).toContain("ADR-0001..0016");
    expect(text).not.toContain("ADR-0001..0012");
  });

  it("derived context: the knowledge base describes the API reference as the implemented contract, not a plan", () => {
    const text = mustRead(KNOWLEDGE_BASE);
    const entry = lineMatching(text, /^\*\*API reference\*\*/);

    expect(text).not.toContain("planned `/api/*` surface");
    expect(entry).toMatch(/implemented/i);
  });

  it("derived context: the knowledge base no longer says no integration code exists, and the layout summary names the Day route and the Compromisso sheet", () => {
    const text = mustRead(KNOWLEDGE_BASE);
    const layout = lineMatching(text, /^\*\*UI layout standard/);

    expect(text).not.toContain("no integration code exists yet");
    expect(layout).toContain("Day route");
    expect(layout).toContain("Compromisso sheet");
  });

  it("derived context: docs/context/integrations.md says the Google read shipped instead of that no code exists", () => {
    const text = mustRead(INTEGRATIONS);
    const google = section(text, /^## Google Calendar/m);

    expect(text).not.toContain("no integration code exists yet");
    expect(google).toMatch(/shipped/i);
  });

  it("derived context: CLAUDE.md no longer carries the three stale statements", () => {
    const text = mustRead(CLAUDE);

    expect(text).not.toContain("1174 tests / 72 files");
    expect(text).not.toContain("phase 5 (the close-out) is `pending`");
    expect(text).not.toContain("PR #11, not yet merged or deployed");
  });

  it("derived context: CLAUDE.md states the suite's current figures, at or above the phase-4 gate", () => {
    const text = mustRead(CLAUDE);
    const counted = (unit: string): number[] =>
      [...text.matchAll(new RegExp(`(\\d[\\d.,]*)\\s+${unit}\\b`, "g"))].map((match) =>
        Number((match[1] ?? "0").replace(/[.,]/g, "")),
      );

    // 2755 tests in 116 files at the phase-4 gate; the suite only grows (no test is ever removed).
    expect(Math.max(0, ...counted("tests"))).toBeGreaterThanOrEqual(2755);
    expect(Math.max(0, ...counted("files"))).toBeGreaterThanOrEqual(116);
  });

  it("derived context: CLAUDE.md still says unit 14 is in-progress, never shipped (regression guard, green today)", () => {
    const text = mustRead(CLAUDE);

    expect(text).toContain("Unit 14 `events-and-day-view` is `in-progress`");
    expect(text).not.toContain("Unit 14 `events-and-day-view` is `shipped`");
  });
});

// --- the owner hand-off records -----------------------------------------------------------------------

describe("AC-31 — the device-proof record is a template that claims nothing", () => {
  const OBSERVATION =
    "Empty until the owner records it. Nothing has been observed and nothing is claimed.";

  it("hand-off: device proof — line 3 is exactly Status: OWED and no other status line exists", () => {
    const lines = mustRead(DEVICE_PROOF).split("\n");

    expect(lines[2]).toBe("Status: OWED");
    expect(lines.filter((line) => line.startsWith("Status:"))).toEqual(["Status: OWED"]);
  });

  it("hand-off: device proof — the three sections exist, in order", () => {
    const text = mustRead(DEVICE_PROOF);
    const at = (heading: string): number => text.search(new RegExp(`^${heading}\\s*$`, "m"));
    const positions = [
      at("## Procedure"),
      at("## Decisions awaiting the owner"),
      at("## Observation \\(owner\\)"),
    ];

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("hand-off: device proof — the observation section holds only the empty-observation sentence", () => {
    const observation = section(mustRead(DEVICE_PROOF), /^## Observation \(owner\)\s*$/m)
      .split("\n")
      .slice(1)
      .join("\n");

    expect(observation.trim()).toBe(OBSERVATION);
  });

  it("hand-off: device proof — the procedure is numbered, opens with Novo compromisso and ends with the runbook's drill", () => {
    const procedure = section(mustRead(DEVICE_PROOF), /^## Procedure\s*$/m, /\n## /);
    const steps = procedure.split("\n").filter((line) => /^\d+\. /.test(line));

    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(procedure).toContain("Novo compromisso");
    expect(procedure).toContain("Step 8");
  });

  it("hand-off: device proof — the decisions section lists what awaits the owner (D4-3, D4-4, D4-8, F1, F2)", () => {
    const decisions = section(
      mustRead(DEVICE_PROOF),
      /^## Decisions awaiting the owner\s*$/m,
      /\n## /,
    );

    for (const awaiting of ["D4-3", "D4-4", "D4-8", "F1", "F2"]) {
      expect(decisions, `the decisions section does not name ${awaiting}`).toContain(awaiting);
    }
  });
});

describe("AC-32 — the release runbook orders the owner's steps so the data is safe", () => {
  const STEP_TITLES = [
    "Commit and pull request",
    "Merge",
    "Chore C6 on the latest real snapshot, before the migration",
    "Remote migration 0007",
    "Version bump and tag v0.14.0",
    "Deploy",
    "Device proof (AC-31)",
    "Chore C6 on a real snapshot holding an event (AC-32)",
    "Record and decide",
  ];

  /** The body of one step: its heading to the next step heading or the next `##` heading. */
  function stepSection(text: string, step: number): string {
    return section(text, new RegExp(`^### Step ${step}:`, "m"), /\n(?:### Step \d+:|## )/);
  }

  it("hand-off: release runbook — exactly nine steps, headed Step 1 to Step 9, in order, with the planned titles", () => {
    const headings = mustRead(RELEASE_RUNBOOK)
      .split("\n")
      .filter((line) => /^### Step \d+:/.test(line))
      .map((line) => line.trim());

    // The order carries AC-32: the drill before the migration, the migration before the tag and
    // the deploy, and the drill on a real snapshot with an event after the device proof.
    expect(headings).toEqual(STEP_TITLES.map((title, index) => `### Step ${index + 1}: ${title}`));
  });

  it("hand-off: release runbook — every step has a body of its own", () => {
    const text = mustRead(RELEASE_RUNBOOK);
    const empty = STEP_TITLES.map((_title, index) => index + 1).filter(
      (step) => stepSection(text, step).split("\n").slice(1).join("\n").trim() === "",
    );

    expect(empty).toEqual([]);
  });

  it.each<[number, string[]]>([
    [3, ["scripts/pull-export-snapshot.mjs", "scripts/restore-drill.mjs", "restore-drill: PASS"]],
    [4, ["time-travel", "documentation/40-engineering/dev-environment.md", "event_sync_links"]],
    [5, ["package.json", "package-lock.json", "git tag v0.14.0", "scripts/check-version-tag.mjs"]],
    [6, ["npm run deploy"]],
    [7, [`${REPORTS}/device-proof.md`]],
    [8, ["scripts/restore-drill.mjs", "content_hash", "all_day"]],
  ])("hand-off: release runbook — Step %i names its defining commands and files", (step, terms) => {
    const body = stepSection(mustRead(RELEASE_RUNBOOK), step);

    expect(terms.filter((term) => !body.includes(term))).toEqual([]);
  });

  it("hand-off: release runbook — the opening paragraph says whose steps they are and why the order is what it is", () => {
    const text = mustRead(RELEASE_RUNBOOK);
    const opening = text.slice(0, text.search(/^### Step 1:/m));

    expect(opening).toMatch(/owner/i);
    expect(opening).toContain("0007");
    expect(opening).toContain("npm run deploy");
  });

  it("hand-off: release runbook — it ends with how to roll back", () => {
    const text = mustRead(RELEASE_RUNBOOK);

    expect(text).toContain("Rollback");
    expect(text).toContain("wrangler rollback");
  });

  it("hand-off: release runbook — every script and document it cites exists, and it cites the four it must", () => {
    const text = mustRead(RELEASE_RUNBOOK);
    const cited = [
      ...new Set(
        [...text.matchAll(/(?<![\w./-])((?:scripts|documentation|docs)\/[\w./-]*\w\.\w+)/g)].map(
          (match) => match[1] ?? "",
        ),
      ),
    ];

    expect(cited.filter((path) => !existsSync(path))).toEqual([]);
    expect(cited).toEqual(
      expect.arrayContaining([
        "scripts/check-version-tag.mjs",
        "scripts/restore-drill.mjs",
        "scripts/pull-export-snapshot.mjs",
        "documentation/40-engineering/dev-environment.md",
      ]),
    );
  });
});

describe("AC-30 — the unit-level UI checklist rolls up every screen the unit touched", () => {
  it("hand-off: ui checklist — it cites both phase checklists and names what stays owed to the owner's device", () => {
    const text = mustRead(UI_CHECKLIST);

    for (const cited of ["phase-3/ui-checklist.md", "phase-4/ui-checklist.md"]) {
      expect(text, `the roll-up does not cite ${cited}`).toContain(cited);
      expect(existsSync(`${REPORTS}/${cited}`), `${cited} does not exist`).toBe(true);
    }
    expect(text).toContain("owed to the owner's device");
  });

  it("hand-off: ui checklist — one table row per screen or surface the unit touched", () => {
    const rows = mustRead(UI_CHECKLIST)
      .split("\n")
      .filter((line) => line.startsWith("|"));
    const surfaces = [
      "DayScreen",
      "LocalEventRow",
      "Agenda",
      "CompromissoSheet",
      "ConfirmView",
      "SearchScreen",
    ];

    expect(surfaces.filter((name) => !rows.some((row) => row.includes(name)))).toEqual([]);
  });

  it("hand-off: ui checklist — it says this phase touched no src/app file and closes with a Result line", () => {
    const text = mustRead(UI_CHECKLIST);

    expect(text).toMatch(
      /\b(?:no|not|nothing|without)\b[^\n.]*src\/app\b|src\/app\b[^\n.]*\b(?:untouched|unchanged)\b/i,
    );
    expect(text).toMatch(/^Result:/m);
  });

  it("hand-off: ui checklist — it names the item that stays unresolved and the findings the owner decides", () => {
    const text = mustRead(UI_CHECKLIST);

    expect(text).toContain("item 8");
    expect(text).toContain("F1");
    expect(text).toContain("F2");
  });
});

describe("AC-33 — the invariants record carries what was run and why the tripwire was fixed as it was", () => {
  it("hand-off: invariants record — it names the tripwire, the mirror inventory and unit 15", () => {
    const text = mustRead(INVARIANTS);

    expect(text).toContain("check-mirror-inventory");
    expect(text).toMatch(/Mirror inventory/i);
    expect(text).toMatch(/unit 15/i);
  });

  it("hand-off: invariants record — it records the commands that were run and the files held byte-identical", () => {
    const text = mustRead(INVARIANTS);
    const missing = [
      "npm run check",
      "npm test",
      "npm run build",
      "src/shared/recurrence.ts",
      "src/shared/adherence.ts",
    ].filter((term) => !text.includes(term));

    expect(missing).toEqual([]);
  });

  it("hand-off: invariants record — it maps every need of unit 15 to a column, without a column change", () => {
    const text = mustRead(INVARIANTS);
    const missing = [
      "calendar_id",
      "external_event_id",
      "synced_content_hash",
      "etag",
      "synced_at",
    ].filter((column) => !text.includes(column));

    expect(missing).toEqual([]);
    expect(text).toMatch(/events\.source|`source`/);
    // The Event's own hash column, which `synced_content_hash` (the baseline) does not stand in for.
    expect(text).toMatch(/(?<!synced_)content_hash/);
  });

  it("hand-off: invariants record — it names the permanent guard of the tripwire", () => {
    expect(mustRead(INVARIANTS)).toContain("test/mirror-inventory.test.ts");
  });
});

// --- self-checks of the helpers (planted text, no document read) ----------------------------------------

describe("the helpers behind these cases read planted text the way the cases assume", () => {
  const document = ["intro", "## A", "a1", "## B", "b1", "## C", "c1"].join("\n");

  it("section() starts at its own heading and stops before the next one", () => {
    expect(section(document, /^## B/m, /\n## /)).toBe("## B\nb1");
    expect(section(document, /^## C/m)).toBe("## C\nc1");
  });

  it("section() throws on a missing start, so a section that is not found never reads as empty", () => {
    expect(() => section(document, /^## Z/m)).toThrow();
  });

  it("itemBlock() ends before the next item and does not run into item 3.5", () => {
    const anatomy = "3. three\nthree continues\n3.5. half\n4. four\n11. eleven";

    expect(itemBlock(anatomy, "3")).toBe("3. three\nthree continues");
    expect(itemBlock(anatomy, "3.5")).toBe("3.5. half");
    expect(itemBlock(anatomy, "11")).toBe("11. eleven");
  });

  it("cells() drops the pipes that frame a row and trims each cell", () => {
    expect(cells("| **Event** | Something | appointment, meeting |")).toEqual([
      "**Event**",
      "Something",
      "appointment, meeting",
    ]);
  });

  it("historyRows() skips the header and the separator and keeps the order of the table", () => {
    const text =
      "## History\n\n| Date | What |\n|---|---|\n| 2026-10-21 | new |\n| 2026-10-19 | old |\n";

    expect(historyRows(text)).toEqual(["| 2026-10-21 | new |", "| 2026-10-19 | old |"]);
  });

  it("frontmatterValue() reads a key of the leading block only", () => {
    const text = "---\nstatus: active\nlast_updated: 2026-10-19\n---\n\nlast_updated: 1999-01-01\n";

    expect(frontmatterValue(text, "last_updated")).toBe("2026-10-19");
    expect(frontmatterValue(text, "missing")).toBeUndefined();
  });
});
