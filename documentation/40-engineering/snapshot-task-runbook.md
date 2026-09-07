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
$node   = 'C:\Program Files\nodejs\node.exe'
$script = 'C:\repos\assistente-pessoal\scripts\pull-export-snapshot.mjs'

$action    = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"')
$trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "09:00"
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName 'Praesto Weekly Export Snapshot' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
```

### Why this is not the `schtasks` one-liner this runbook first carried

Both defects below were found by running the original command, on 2026-09-07, not by
reading it. Recorded so the next person does not rediscover them.

- **The absolute path to `node.exe` is load-bearing; a bare `node` is not safe here.**
  This machine has two Node installations, and the machine `PATH` lists the nvm
  directory ahead of `C:\Program Files\nodejs`. A Scheduled Task does not inherit an
  interactive shell's `PATH`, and nvm rewrites what `C:\Program Files\nodejs` points at.
  Both installs are currently v24 and both support the type-stripping the script needs
  to import `snapshot-outcome.ts` — but a future `nvm use 20` would silently point the
  task at a Node that cannot run it, and the job would fail every Sunday with nobody
  watching. That is precisely the failure mode this whole phase exists to prevent.
- **`schtasks /tr` could not express the path.** Its action is a single string, and the
  node path contains a space, so the executable and its argument cannot be quoted
  separately. Invoked through a shell it fails with `Argumento/opcao invalido`.
  `Register-ScheduledTask` takes `-Execute` and `-Argument` as distinct parameters and
  sidesteps the problem entirely.

Two settings the original command also lacked: `-StartWhenAvailable`, so a Sunday with
the PC switched off is caught up at the next opportunity rather than skipping the week
in silence, and a ten-minute execution limit.

**Registered and verified on 2026-09-07.** `Get-ScheduledTask` reports
`Execute: C:\Program Files\nodejs\node.exe`, the quoted script path as its argument,
Sunday 09:00, `UserId Fabio / Interactive / Limited`, `StartWhenAvailable True`,
`NextRunTime 13/09/2026 09:00`. `LastTaskResult 267011` (`0x41303`) at registration
means "has not yet run" — the expected value for a task that has never fired, not an
error.
