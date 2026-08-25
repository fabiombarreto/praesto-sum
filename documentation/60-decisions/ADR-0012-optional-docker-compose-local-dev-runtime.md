---
status: accepted
last_updated: 2026-08-24
review_trigger: "a new decision touches the same topic"
---

# ADR-0012: Offer Docker Compose as an optional second way to run the local dev server

> **Purpose:** Record why the project gained a container definition for local development, what it deliberately does *not* change, and the two costs measured before accepting it.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-24
- **Related:** [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md), [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md); CON-001, CON-002, CON-003, CON-004, CON-006, QA-002, QA-004

## Context

`npm run dev` is a **foreground** process. That is the whole problem, and it has three faces the owner named:

- It dies on reboot, and nothing brings it back.
- There is no "is it up?" — the answer is "look for the window".
- There is no "bring it down" other than finding that window and pressing Ctrl-C.

For a project budgeted at ~1 h/day (CON-003) and explicitly required to be resumable after four untouched weeks in ≤ 1 action (QA-002), "find the window" is the wrong interface. QA-004 asks the same of a returning developer.

Nothing about the *runtime* is in question. [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md)'s one-Worker shape and [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md)'s stack are untouched: the container runs the same `vite dev`, the same real workerd, the same local D1. What is being decided is only **how that process is supervised on the owner's machine**.

The honest tension is that workerd is already a sandbox, so this puts one sandbox inside another. That is not free, and the two prices were measured rather than guessed — see Consequences.

## Decision

We will ship a `Dockerfile` + `compose.yaml` as an **optional second door** to the local dev server, and keep `npm run dev` on the host as the documented default.

Five properties are load-bearing and must survive any future edit:

1. **The host workflow is unchanged.** `npm run dev` binds `127.0.0.1` and watches with inotify exactly as before. The only change to `vite.config.ts` is a branch gated on `PRAESTO_WATCH_POLLING`, which only `compose.yaml` ever sets.
2. **The container never sees the host `node_modules`.** The host tree carries `@cloudflare/workerd-windows-64`; Linux needs `@cloudflare/workerd-linux-64`. A named volume shadows `/app/node_modules` with the image's own install, and the entrypoint refuses to start if the Linux binary is not the one present.
3. **Local D1 state lives on the host disk.** miniflare persists under `.wrangler/state/v3/`, which is inside the project bind mount. `down` does not touch it, and the host's own `npm run dev` reads the same database — the two doors open onto one room, never two.
4. **`.dev.vars` is mounted, never baked.** It stays git-ignored and is never copied into a layer; `.dockerignore` excludes it from the build context outright. The entrypoint fails loudly when it is missing, because `src/worker/auth.ts` is fail-closed and an unconfigured app otherwise looks like a broken one.
5. **The base image tag is exact** (`node:24.15.0-bookworm-slim`), like every version in `package.json`. It is also the owner's own host Node version. Debian, never Alpine: workerd is glibc-linked.

## Alternatives considered

- **A detached background process plus up/down/status scripts** (a Windows Scheduled Task, `pm2`, or a small PowerShell wrapper) — the lighter answer, and it solves the literal complaint with no container at all. Rejected as the *primary* answer because the owner asked for the compose stack; recorded here because it remains the better fit if the polling cost below ever becomes annoying, and chore C5 already commits this project to a Windows Scheduled Task for snapshots, so the machinery would not be novel. Superseding this ADR to switch would be cheap: nothing in `src/` depends on either choice.
- **Bind-mounting the host `node_modules` into the container** — rejected on measurement, not principle: the host tree holds the Windows workerd build, which cannot execute in a Linux container.
- **A named volume for `.wrangler/` instead of a bind mount** — rejected: it would give the container a *second*, private local database, so a Task created through Docker would be invisible to `npm run dev` and vice versa. Property 3 above is worth more than the small filesystem-performance gain.
- **Alpine base** — rejected: musl. workerd does not start, and the loader error names neither libc nor the real cause.
- **Replacing `npm run dev` with the container** — rejected: it makes a working, fast, well-understood path depend on Docker Desktop being up, and buys nothing. CON-001 wants Windows first-class, and the host path *is* the Windows-first-class path.

## Consequences

- Positive:
  - `npm run docker:up` / `docker:down` / `docker:status` are one command each, and `restart: unless-stopped` brings the server back after a reboot without the owner doing anything — which is what QA-002's "resume in ≤ 1 action" asks for.
  - The container's Linux `npm ci` is a standing check that the project still installs cleanly on a platform that is not the owner's, at no extra effort.
  - `npm run dev` keeps working, so the container is never a single point of failure for developing the project.
- Negative / accepted trade-offs:
  - **HMR needs polling, and polling costs CPU.** Measured 2026-08-24: with the watcher event-driven, an edit inside the bind mount produced **no HMR event at all** — not in the vite log, not in the browser. `CHOKIDAR_USEPOLLING` does not help, because vite does not read it; only `server.watch.usePolling` does. With polling on, idle CPU went from **0.00 %** to **~47 %** of a core; scoping the watch away from `PRPs/`, `docs/`, `documentation/`, `dist/`, `coverage/`, `.worktrees/` and `.wrangler/` brought that to **~10–15 %**, with HMR arriving ~1.25 s after a save. Paid only inside the container.
  - **Cold start is slower**: ~7–15 s to a first response versus ~9 s for the host, and ~90 s for the very first build. Irrelevant for a server that now stays up.
  - **A second thing to keep current.** The base image tag and `package-lock.json` can drift apart; the entrypoint detects that and reinstalls rather than running against stale dependencies, but the pin itself is one more line to bump on a Node upgrade.
  - **Reboot survival depends on a Docker Desktop setting** the project cannot set for the owner ("Start Docker Desktop when you sign in"). Recorded in [dev-environment](../40-engineering/dev-environment.md) as a one-time step rather than assumed.
  - **Docker Desktop's own licence is a live constraint.** It is free for personal use, which is what this is (CON-004). A change in that licence, or use in a context that is not personal, reopens this decision.
