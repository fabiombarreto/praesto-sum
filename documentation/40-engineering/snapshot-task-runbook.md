---
status: active
last_updated: 2026-09-06
review_trigger: "the token-storage decision changes, the schtasks command fails on the owner's machine, or the script's env-var contract changes"
---

# Snapshot Task Runbook

> **Purpose:** Register the weekly, unattended pull of `scripts/pull-export-snapshot.mjs`
> on the owner's own Windows PC — the FR-043 half of unit 5 `data-export`, phase 4
> "The unattended copy".
> **Update when:** the token-storage decision changes, the `schtasks` command fails on
> the owner's machine, or the script's env-var contract changes.

## 1. The token-storage decision

The script reads its bearer token from a plain-text file at
`%USERPROFILE%\.praesto\export-token.txt` (PowerShell: `$env:USERPROFILE\.praesto\export-token.txt`),
outside the git repo and never `.dev.vars`, restricted via `icacls` to the owner's own
Windows account.

This was chosen over two alternatives, both considered and rejected:

- **Windows Credential Manager** — no reliable pure-JS/Node read path exists without a
  native module or an external interpreter, and the available community wrappers'
  maintenance status is unverified. Adding an unverified dependency to read a credential
  is a worse trade than an ACL'd file.
- **A Task Scheduler-level environment variable** — Task Scheduler has no native
  per-task environment-variable feature; any wrapper still embeds the value in the
  Action's argument string, which sits in a human-readable XML file under
  `%SystemRoot%\System32\Tasks` with no better protection than an ACL'd file, while
  adding a wrapper script to maintain for no real gain.

**What this does NOT defend against, stated plainly:** a local Administrator account on
the same machine, and a screenshot — the exact channel chore C10 already leaked the API
token through once, on 2026-08-12. An ACL'd file only keeps *other* Windows
accounts/processes on the same single-user PC from reading it; it is not a defense
against the owner's own machine being fully compromised or against his own screen being
captured. No stronger option had a reliable, dependency-free Node read path available
for this phase.

This is not a new posture invented for this phase — it follows established practice
already in this project. `~/.praesto/` already holds a live credential: the Google
refresh token lives at `~/.praesto/google-oauth.json`, outside the repo, and is also the
Worker secret `GOOGLE_REFRESH_TOKEN` (roadmap chore C12, minted 2026-08-11 and still in
use). `export-token.txt` sits beside it in the same directory, whose permissions can be
reasoned about once.

## 2. Setup steps (PowerShell)

Create the directory:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.praesto"
```

Write the **PRODUCTION** Cloudflare Worker secret — never the local `.dev.vars`
value — into the file:

```powershell
Set-Content -Path "$env:USERPROFILE\.praesto\export-token.txt" -Value "<paste the production API_BEARER_TOKEN here>" -NoNewline
```

Restrict the file to the owner's own Windows account:

```powershell
icacls "$env:USERPROFILE\.praesto\export-token.txt" /inheritance:r /grant:r "$($env:USERNAME):R"
```

Applied and verified on 2026-09-07: `icacls` reports `DESKTOP-FABIO\Fabio:(R)` and nothing
else — no inherited entries, no `SYSTEM`, no `Administrators`. The script reads the file fine
under it, confirmed by a real run.

### Replacing the token later — read this before you are locked out

`:R` grants **read only, to you included**. That is correct for the script, which only reads,
but it means you cannot overwrite this file with `Set-Content` when the production token is
next rotated — and rotation is a live event here, not a hypothetical: chore C10 rotated this
project's token on 2026-08-12 after it was exposed in a screenshot. The failure looks like an
access-denied error on a file you own, which is confusing enough to waste an evening.

Either grant yourself write back, replace the value, and re-restrict:

```powershell
icacls "$env:USERPROFILE\.praesto\export-token.txt" /grant "$($env:USERNAME):W"
Set-Content -Path "$env:USERPROFILE\.praesto\export-token.txt" -Value "<the new token>" -NoNewline
icacls "$env:USERPROFILE\.praesto\export-token.txt" /inheritance:r /grant:r "$($env:USERNAME):R"
```

…or simply delete the file and repeat step 2 from the top, which is fewer moving parts and
leaves the same end state.

## 3. A manual test run

```powershell
node scripts\pull-export-snapshot.mjs
```

This should print a `PASS` line (`pull-export-snapshot: PASS`) and create two dated
files under `$env:USERPROFILE\praesto-snapshots\` — one `.json`, one `.ics`.

## 4. The Scheduled Task registration command

Run this yourself, on your own PC — this command is **not** run by any autonomous
agent. Registering persistent Windows machine configuration is past relay's Pillar 2
execution boundary, exactly like the API token itself: no agent enters the token or
registers the task on your behalf.

```powershell
schtasks /create /tn "Praesto Weekly Export Snapshot" /tr "node C:\repos\assistente-pessoal\scripts\pull-export-snapshot.mjs" /sc weekly /d SUN /st 09:00 /rl LIMITED
```
