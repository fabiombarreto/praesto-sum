#!/usr/bin/env node
/**
 * The unattended half of FR-043 (data-export PRD phase 4 "The unattended
 * copy"): pulls both export routes from the deployed Worker and writes dated
 * snapshot files to the owner's own PC, writing nothing and exiting non-zero
 * on any failure (AC-10), and never overwriting a file already present from
 * the same day (AC-11).
 *
 * Registered by the owner himself as a weekly Windows Scheduled Task — see
 * `documentation/40-engineering/snapshot-task-runbook.md` for the token setup
 * and the exact `schtasks` command. This script never registers that task and
 * never calls a live production URL during this repo's own validation; Level
 * 3 of the phase 4 plan exercises it against `scripts/mock-export-server.mjs`.
 *
 * All I/O (reading the token, fetching, listing the directory, writing files)
 * lives here. The write/skip/fail decision logic is IMPORTED — never
 * duplicated — from the pure module `../src/shared/snapshot-outcome.ts`
 * (Task 1, covered by `test/snapshot-outcome.test.ts`), so the code this
 * weekly job actually runs is the exact code the test suite pins.
 *
 * The imports below use an explicit `.ts` extension and rely on Node 24's
 * built-in type-stripping for erasable-syntax TypeScript (both
 * `snapshot-outcome.ts` and `content-disposition.ts` use only type
 * annotations — no enums/namespaces/parameter properties). This is
 * load-bearing: `tsconfig.base.json`'s `allowImportingTsExtensions: true`
 * (legal only because `noEmit: true` is already set there) is what lets
 * `tsc -b` accept the same extensioned specifier Node's ESM resolver
 * requires. Do not "tidy" this import back to an extensionless form — Node's
 * loader, unlike Vitest's, does not resolve extensionless relative
 * specifiers at all, and the script would silently stop working.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { deriveSnapshotDecision, shouldWriteFile } from "../src/shared/snapshot-outcome.ts";

const BASE_URL = process.env.PRAESTO_EXPORT_BASE_URL ?? "https://praesto.fabiobarreto.workers.dev";
const TOKEN_FILE =
  process.env.PRAESTO_TOKEN_FILE ?? join(homedir(), ".praesto", "export-token.txt");
const SNAPSHOT_DIR = process.env.PRAESTO_SNAPSHOT_DIR ?? join(homedir(), "praesto-snapshots");

function readToken() {
  try {
    const raw = readFileSync(TOKEN_FILE, "utf8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

async function fetchOutcome(url, token) {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const contentDispositionHeader = response.headers.get("content-disposition");
    const body = await response.text();
    return { ok: true, status: response.status, contentDispositionHeader, body };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function main() {
  const token = readToken();
  if (!token) {
    console.error(
      `pull-export-snapshot: FAIL — no usable token at ${TOKEN_FILE}. Writing no file.`,
    );
    process.exit(1);
    return;
  }

  const [jsonOutcome, icsOutcome] = await Promise.all([
    fetchOutcome(`${BASE_URL}/api/export`, token),
    fetchOutcome(`${BASE_URL}/api/export.ics`, token),
  ]);

  const decision = deriveSnapshotDecision(jsonOutcome, icsOutcome);

  if (decision.action === "fail") {
    console.error(`pull-export-snapshot: FAIL — ${decision.reason}. Writing no file.`);
    process.exit(1);
    return;
  }

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const existing = readdirSync(SNAPSHOT_DIR);

  for (const { filename, body } of [decision.json, decision.ics]) {
    if (shouldWriteFile(existing, filename)) {
      writeFileSync(join(SNAPSHOT_DIR, filename), body, "utf8");
      console.log(`pull-export-snapshot: wrote ${filename}`);
    } else {
      console.log(`pull-export-snapshot: ${filename} already exists, skipping (same-day rerun)`);
    }
  }

  console.log("pull-export-snapshot: PASS");
}

await main();
