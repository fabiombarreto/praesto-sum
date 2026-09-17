#!/usr/bin/env node
/**
 * Refuse to deploy a version nobody tagged.
 *
 * `package.json`'s `version` is the number the settings screen shows and the
 * roadmap cites. A number that exists only in a file is a claim; the git tag is
 * what makes it checkable afterwards — "what is `0.8.0`?" has to be answerable
 * six months from now, by `git show v0.8.0`, without anyone remembering.
 *
 * So this runs inside `npm run deploy`, between the build and `wrangler deploy`,
 * and fails when the commit about to be deployed does not carry the matching
 * tag. It is the same discipline as `check-dev-token-absent.mjs`: inspect the
 * real artifact rather than trust the intent.
 *
 * It does NOT create the tag. Tagging is a decision — this only refuses to let
 * the decision be skipped silently.
 *
 * Escape hatch, for a deploy that deliberately is not a release (a hotfix being
 * proved in production, say): PRAESTO_SKIP_VERSION_TAG=1 npm run deploy. It
 * prints what it let through, so the exception stays visible in the terminal
 * rather than becoming the habit.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (typeof version !== "string" || version.length === 0) {
  console.error(
    "check-version-tag: FAIL — package.json has no `version`. The deploy cannot say what it is deploying.",
  );
  process.exit(1);
}

const expected = `v${version}`;

if (process.env.PRAESTO_SKIP_VERSION_TAG === "1") {
  console.warn(
    `check-version-tag: SKIPPED by PRAESTO_SKIP_VERSION_TAG=1 — deploying ${version} without requiring ${expected}.`,
  );
  process.exit(0);
}

let head;
let tagsAtHead;
try {
  head = git(["rev-parse", "--short", "HEAD"]);
  tagsAtHead = git(["tag", "--points-at", "HEAD"]).split("\n").filter(Boolean);
} catch {
  console.error(
    "check-version-tag: FAIL — git is not reachable here, so the tag cannot be verified.\n" +
      "  Deploy from a real checkout, or set PRAESTO_SKIP_VERSION_TAG=1 knowingly.",
  );
  process.exit(1);
}

if (tagsAtHead.includes(expected)) {
  console.log(`check-version-tag: PASS — ${expected} points at ${head}.`);
  process.exit(0);
}

const dirty = (() => {
  try {
    return git(["status", "--porcelain"]).length > 0;
  } catch {
    return false;
  }
})();

console.error(
  `check-version-tag: FAIL — package.json says ${version}, but no tag ${expected} points at HEAD (${head}).\n` +
    (tagsAtHead.length > 0 ? `  Tags at HEAD: ${tagsAtHead.join(", ")}\n` : "") +
    (dirty
      ? "  The working tree is also dirty — commit first, or the tag will name a commit that is not what you are deploying.\n"
      : "") +
    "  Either bump package.json and tag this commit:\n" +
    `      git tag ${expected} && git push origin ${expected}\n` +
    "  or, if this deploy is deliberately not a release:\n" +
    "      PRAESTO_SKIP_VERSION_TAG=1 npm run deploy",
);
process.exit(1);
