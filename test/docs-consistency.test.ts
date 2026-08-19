// Guards the CLAUDE.md rule that `documentation/` is authoritative and `docs/`
// is derived from it — "on any conflict, `documentation/` wins".
//
// That rule is enforced by convention today, and convention lost three times in
// a row: on 2026-08-11 the derived tree was found still calling Google Calendar
// "NOT integrated (pending decision 4)" seven days after ADR-0007 resolved it,
// still telling agents "do not build against it" in the events domain area —
// the opposite of what ADR-0007 requires of unit 14 — and still reporting
// `tdd: false` after ADR-0008 flipped it. Each drift entered the same way: a
// change landed in `documentation/` and nothing forced the derived files to
// follow.
//
// WHAT THIS SUITE CANNOT DO, stated plainly so it is not mistaken for more:
// it does NOT verify that `docs/` says the same thing as `documentation/`.
// Two prose documents cannot be mechanically compared for meaning, and a test
// claiming otherwise would be worse than none — it would put a green tick
// under exactly the drift it missed. What it checks is the narrow set of
// factual states that can only be one way, chosen because each is how a real
// drift actually started. Reviewing the derived docs by hand is still
// required; this only catches the failures that are cheap to catch.
//
// This suite runs in the `docs` project (plain Node) rather than the `worker`
// one, because workerd has no `node:fs`. See vitest.config.ts.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = "docs";
const DOCUMENTATION = "documentation";
const ADR_DIR = posix.join(DOCUMENTATION, "60-decisions");

function read(relativePath: string): string {
  return readFileSync(relativePath, "utf8");
}

/** Every `.md` under `root`, repo-relative and posix-separated, recursively. */
function markdownFilesUnder(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => posix.join(entry.parentPath.split(sep).join(posix.sep), entry.name));
}

/**
 * Parses the simple `key: value` frontmatter these documents use. Not a YAML
 * parser — it deliberately handles only the scalar shape the project writes,
 * and ignores anything else rather than guessing.
 */
function frontmatter(text: string): Map<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const fields = new Map<string, string>();
  if (!match?.[1]) return fields;
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (field?.[1] !== undefined && field[2] !== undefined) fields.set(field[1], field[2].trim());
  }
  return fields;
}

/** Every line of `text` as `{ number, content }`, for actionable failure messages. */
function lines(text: string): { number: number; content: string }[] {
  return text.split(/\r?\n/).map((content, index) => ({ number: index + 1, content }));
}

const adrFiles = readdirSync(ADR_DIR)
  .filter((name) => name.startsWith("ADR-") && name.endsWith(".md"))
  .sort();

const docsMarkdown = markdownFilesUnder(DOCS);

describe("every accepted ADR reaches the derived decisions index", () => {
  // The entry point of all three 2026-08-11 drifts: a decision is recorded in
  // `documentation/60-decisions/` and the derived tree never learns of it.
  // `docs/decisions.md` states its own contract — "the relay-facing index of
  // them" — so an accepted ADR missing from it is a broken promise, not taste.
  const accepted = adrFiles.filter(
    (name) => frontmatter(read(posix.join(ADR_DIR, name))).get("status") === "accepted",
  );

  it("finds accepted ADRs to check (guards against the scan silently matching nothing)", () => {
    expect(accepted.length).toBeGreaterThan(0);
  });

  it.each(accepted)("%s is cited in docs/decisions.md", (adrFileName) => {
    const derived = read(posix.join(DOCS, "decisions.md"));

    expect(
      derived.includes(adrFileName),
      `${adrFileName} is accepted in documentation/60-decisions/ but is not cited anywhere in ` +
        `docs/decisions.md. docs/decisions.md calls itself "the relay-facing index of them", so ` +
        `every accepted ADR needs an entry there citing its source path. Add the entry — do not ` +
        `edit the ADR, which is append-only.`,
    ).toBe(true);
  });
});

describe("no derived doc calls a decision open that documentation records as resolved", () => {
  // Catches the two worst 2026-08-11 drifts verbatim:
  //   docs/KNOWLEDGE_BASE.md   "Google Calendar NOT integrated (pending decision 4)"
  //   docs/domain/areas/events.md  "is NOT decided — pending decision 4; do not build against it"
  // and deliberately does NOT catch the legitimate historical mention in
  // docs/decisions.md ("The owner arbitrated pending decision 4, asking to
  // read, create, edit and delete..."), which names the decision by its old
  // label while describing its resolution. The discriminator is the presence of
  // a still-open claim on the same line, not the phrase "pending decision".
  //
  // Relaxed on 2026-08-18, exactly as the original failure message prescribed:
  // the UI/UX plan opened decisions 5–7, so the queue is no longer empty. The
  // rule now reads the numbers the index itself lists as open (the numeric
  // first cell of each queue-table row) and only flags a derived line that
  // calls a decision open when the index does NOT list that number.
  const indexText = read(posix.join(ADR_DIR, "index.md"));
  const queueIsEmpty = indexText.includes("The queue is empty");
  const openDecisions = new Set(
    [...indexText.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((match) => Number(match[1])),
  );

  const STILL_OPEN =
    /\bnot decided\b|\bnot integrated\b|\bundecided\b|do not build against|\bstill pending\b/i;
  const NAMES_A_DECISION = /pending decision\s+(\d+)/i;

  it("documentation either declares the queue empty or lists the open decisions by number (the precondition this rule reads)", () => {
    expect(
      queueIsEmpty || openDecisions.size > 0,
      "documentation/60-decisions/index.md neither says 'The queue is empty' nor has a queue-table " +
        "row whose first cell is a decision number. Either restore the sentence or list the open " +
        "decisions as numbered rows — this rule reads those numbers.",
    ).toBe(true);
  });

  it.each(docsMarkdown)("%s describes no resolved decision as still open", (file) => {
    const offenders = lines(read(file)).filter((line) => {
      const named = NAMES_A_DECISION.exec(line.content);
      if (!named?.[1] || !STILL_OPEN.test(line.content)) return false;
      return !openDecisions.has(Number(named[1]));
    });

    expect(
      offenders.map((line) => `${file}:${line.number}: ${line.content.trim()}`),
      `documentation/60-decisions/index.md does not list this decision as open (open: ` +
        `${[...openDecisions].join(", ") || "none"}), but this derived file still describes it as ` +
        `unresolved. Correct the derived file to match documentation/ — never the other way ` +
        `round, and never by editing an accepted ADR.`,
    ).toEqual([]);
  });
});

describe("the knowledge-base index does not contradict the frontmatter it summarizes", () => {
  // Catches the third 2026-08-11 drift: KNOWLEDGE_BASE.md advertised
  // `tdd: false` while docs/context/methodology.md's frontmatter had said
  // `tdd: true` since ADR-0008 on 2026-08-04. KNOWLEDGE_BASE.md is loaded into
  // agent context every session, so a false value there is the most expensive
  // kind of staleness in the repository.
  const indexText = read(posix.join(DOCS, "KNOWLEDGE_BASE.md"));
  const methodology = frontmatter(read(posix.join(DOCS, "context", "methodology.md")));
  const keys = [...methodology.keys()];

  it("reads a non-empty methodology frontmatter (guards against matching nothing)", () => {
    expect(keys).toContain("tdd");
  });

  it.each(keys)("any `%s: ...` quoted in KNOWLEDGE_BASE.md matches the real value", (key) => {
    const truth = methodology.get(key);
    const quoted = [...indexText.matchAll(new RegExp("`" + key + ":\\s*([^`]*)`", "g"))].map(
      (match) => (match[1] ?? "").trim(),
    );

    for (const value of quoted) {
      expect(
        value,
        `docs/KNOWLEDGE_BASE.md quotes \`${key}: ${value}\`, but docs/context/methodology.md's ` +
          `frontmatter says \`${key}: ${truth}\`. The index is loaded into agent context every ` +
          `session; update the index to match the file it points at.`,
      ).toBe(truth);
    }
  });
});

describe("every documentation path cited from the derived docs resolves", () => {
  // A rename or move on the authoritative side leaves the derived side pointing
  // at nothing, which reads as "this rule no longer exists" to anyone — human or
  // agent — who follows the link.
  const CITED_PATH =
    /(?:\.\.\/)*((?:documentation|docs)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.md)/g;

  it.each(docsMarkdown)("%s cites only paths that exist", (file) => {
    const cited = [...read(file).matchAll(CITED_PATH)]
      .map((match) => match[1])
      .filter((path): path is string => path !== undefined);
    const broken = [...new Set(cited)].filter(
      (path) => !existsSync(join(...path.split(posix.sep))),
    );

    expect(
      broken,
      `these paths are cited in ${file} but do not exist on disk. A moved or renamed ` +
        `authoritative document leaves the derived tree pointing at nothing.`,
    ).toEqual([]);
  });
});
