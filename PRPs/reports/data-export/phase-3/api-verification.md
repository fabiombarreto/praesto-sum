# Phase 3 — API-level verification (NOT the Task 9 device pass)

**Date:** 2026-09-05
**Performed by:** the assistant, at the owner's request ("pode fazer os testes para mim")
**Server:** `npm run dev` from the worktree `.worktrees/data-export/` on `http://127.0.0.1:5174`, branch `feature/data-export`, phases 1–3 uncommitted
**Data:** five Tasks created through `POST /api/tasks` for this run — four dated, one undated — with accented pt-BR titles and RFC 5545 TEXT-reserved characters

> **This file is NOT the Task 9 device-verification report and must not be mistaken for one.**
> Task 9 requires a manual browser pass on the Windows PC and the Android phone plus the
> guidelines' Tier A checklist. It has NOT been performed. Everything below is API-surface
> verification, which covers AC-1 and AC-5 through AC-8 but says nothing about AC-9 — the two
> download controls, the success toast, the persistent inline error, or a file actually landing
> on disk. Those live behind the `TokenGate`, and entering an API token into a field is not
> something the assistant does; that is the same barrier that has kept chore C15 open since
> 2026-08-31.

## What was verified, and how

| Check | Result | Evidence |
|---|---|---|
| **AC-1** — both routes reject an unauthenticated request | PASS | `GET /api/export` → 401, `GET /api/export.ics` → 401, no body content |
| **AC-6** — JSON download names itself by date | PASS | `content-disposition: attachment; filename="praesto-2026-09-05.json"`, `content-type: application/json` |
| **AC-6 (ics)** — the calendar file likewise | PASS | `content-disposition: attachment; filename="praesto-2026-09-05.ics"`, `content-type: text/calendar; charset=utf-8` |
| **AC-2** — the five data-bearing tables are present | PASS | `life_areas`, `recurrence_series`, `tasks`, `reminders`, `google_calendar_selections` all keyed in `tables` |
| **AC-3** — no excluded table appears | PASS | `google_connections`, `push_subscriptions`, `oauth_states` all absent from `tables` |
| **AC-5** — the document describes itself | PASS | `formatVersion: 1`, `generatedAt` (epoch seconds), `timezone: America/Sao_Paulo`, and `excludedTables` carrying a written reason per table |
| **AC-7** — minimal RFC 5545 validity | PASS | `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID`, `CALSCALE`, `END:VCALENDAR`; every component carries `UID` (`<task id>@praesto.local`) and `DTSTAMP`; **30 CRLF, zero lone LF** |
| **AC-7** — line folding at 75 octets | PASS | no physical line exceeds 75 octets (longest is exactly 75); continuation lines all begin with exactly one space |
| **AC-7** — TEXT escaping (§3.3.11) | PASS | for a title holding a real backslash, a comma and a semicolon: all three emitted escaped, and **unfolding + unescaping reproduces the stored title byte-for-byte** |
| **AC-8** — dated Tasks become all-day events | PASS | 4 dated Tasks → 4 `VEVENT`s, each `DTSTART;VALUE=DATE:<yyyymmdd>`, no `TZID`, no timestamp |
| **AC-8** — undated Tasks appear nowhere | PASS | the one undated Task's id appears in no `UID` |
| **No `VTODO`** (PRD Decisions Log) | PASS | the string `VTODO` does not occur in the file |

## AC-9 — NOT VERIFIED

The settings screen, the two download controls, the success toast, the persistent inline error,
the offline behaviour and a file reaching the filesystem are all unverified. They require an
authenticated browser session. Nothing in this file should be read as covering them.

## Two findings

### 1. Control characters pass through into the `.ics`, making it technically invalid

RFC 5545 §3.3.11 excludes control characters from `TEXT` values (HTAB is the only exception).
The serializer escapes `\`, `,` and `;` correctly, but passes a raw control character through
unchanged. This run produced an `.ics` containing a literal `U+0008` inside a `SUMMARY`, so the
file is technically invalid and a strict parser may reject the whole calendar rather than one
event.

How it got there is worth recording, because it is not exotic: the title was created through
`POST /api/tasks`, whose JSON body carried `\b` — a valid JSON escape for backspace. Nothing in
the task-creation path rejects or strips control characters, so any client that sends one stores
one, and the export faithfully carries it into a file whose entire purpose is to be read by
another program.

Severity is genuinely low — it needs a control character in a title, which the owner is unlikely
to type — but the failure is silent and file-wide, not per-event. Two candidate homes for the
fix, neither of which belongs to phase 3 as scoped: strip or escape CTLs in the `.ics`
serializer, or reject them at the task-creation boundary the way `deadline` and `priority` are
already rejected there. Recorded rather than fixed, because AC-7 does not name it and the input
validation question belongs to the Tasks unit, not to the export.

### 2. The first run of this verification contained a vacuous assertion

Worth recording as a caution about this report's own method. The first attempt tested backslash
escaping with a title that, because of shell and JSON escaping in the request, contained no
backslash at all — only the `U+0008` above. The check "no bare backslash in the output" passed
because there was nothing to escape. It was rerun with the payload written to a file rather than
inlined in a shell command, and only then did the backslash case genuinely exercise
`escapeIcsText`. A test that passes because its fixture is empty is the same pathology the test
pair spent this unit hunting; it appeared here in the manual tier.

## Environment notes

- The Docker container the owner had running mounts the **main** repository (`- .:/app` in
  `compose.yaml`), which is at `90ea2d3` and contains none of phases 1–3. It cannot exercise this
  unit at all; a separate dev server was started from the worktree on port 5174 for this run.
- The worktree's local D1 had no schema — `.wrangler/state` is per-worktree and
  `scripts/worktree-bootstrap.sh` copies `.dev.vars` and runs `npm ci` but never applies
  migrations, so a fresh worktree serves 500s on the first screen with no hint that the bootstrap
  is the cause. `npm run db:migrate` fixed it. A one-line addition to the bootstrap script would
  stop the next worktree paying the same cost.

*Status: INFORMATIONAL — does not satisfy Task 9*
