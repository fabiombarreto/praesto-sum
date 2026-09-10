# Reminders

**Primary responsibility:** making sure the owner never depends on memory — notifications that fire at chosen moments. Phase 1 scope (the owner uses the assistant daily and expects proactive notifications throughout the day).

**Entities:** Reminder (see `docs/domain/glossary.md`).

## Business rules (owner-validated 2026-08-03)

- A Reminder points to at most ONE Task or ONE Event — never both — or to **nothing at all** (standalone Reminders confirmed, e.g. "drink water at 3pm", FR-044 Must). Standalone and Task-linked Reminders both ship end to end (`/api/reminders`, reminders unit, phases 1–3).
- A Reminder carries no work of its own and no calendar slot — it only directs attention.
- Trigger time is absolute, or relative to the target's start (Event) / deadline (Task) (FR-025). For a Task, "relative" means an offset in minutes before end-of-day local (`America/Sao_Paulo`, 23:59) — a Task carries only a calendar day, never a time of day — resolved by the pure, clock-free `offsetToInstant` helper in `src/shared/dates.ts` (reminders unit, phase 1, PRD AC-3/AC-14).
- A due Reminder MUST produce a notification the owner actually perceives (FR-041 Must): fired by the server-side cron scheduler, delivered as Web Push to the installed PWA — never dependent on the app being open.
- When a Task-linked Reminder's Task has its `deadline` edited, a relative (`originOffsetMinutes` non-null), unsent (`sentAt` null) Reminder has its `fireAt` recomputed against the new deadline and the new time is shown on screen; an absolute Reminder and any already-sent Reminder are left untouched — an edit never resurrects or silently re-times a past notification (reminders unit, phase 4, PRD AC-11/AC-12).
- A Reminder attached to a Task whose status is `done` or `missed` is not delivered when it comes due; the sweep still marks it `sent` so it is not reconsidered on every subsequent tick (reminders unit, phase 2, PRD AC-9).

## Delivery architecture (ADR-0003/0005/0013)

The Workers cron trigger (`runScheduledJob`, `src/worker/cron.ts`) claims each due Reminder with a conditional `UPDATE ... WHERE sent_at IS NULL AND fire_at <= now`, then dispatches through the same `sendPush` / `classifyPushOutcome` / `buildNotificationPayload` path `/api/push/test` uses, sending via `@block65/webcrypto-web-push` (Web Crypto + native `fetch`) to the installed PWA (`src/sw.ts` handles push + notificationclick). The claim is released (`sent_at` reset to null) only when the outcome is retryable, so a transient failure gets another tick without ever double-sending; a `gone` subscription is pruned from `push_subscriptions` without suppressing delivery to a still-live one. A Task-linked Reminder's payload deep-links to that Task (`task/${string}` `AppRoute` variant, `/tasks/:id`), not to the home screen. A reminder whose `fireAt` came due while the scheduler was down still fires exactly once — the predicate has no lower bound on `fireAt`. (Reminders unit, phases 1–4, PRD AC-5..AC-10.)

## Resolved 2026-08-03

- No snooze and no re-fire in the MVP: the notification opens the app on the item; re-scheduling is manual. Notification-action snooze is a declared revisit trigger if the pain shows up in real use.

## Open Questions

- Fallback channel (e-mail-to-self, ntfy) if Web Push proves unreliable in practice — allowed without a new ADR (ADR-0003). The owner's phone is **Android**, where Chrome delivers push without requiring the PWA to be installed, so the iOS-specific worry recorded in ADR-0004 does not apply here; the trigger is unlikely to fire for that reason.
