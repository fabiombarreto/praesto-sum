# Reminders

**Primary responsibility:** making sure the owner never depends on memory — notifications that fire at chosen moments. Phase 1 scope (the owner uses the assistant daily and expects proactive notifications throughout the day).

**Entities:** Reminder (see `docs/domain/glossary.md`).

## Business rules (owner-validated 2026-08-03)

- A Reminder points to at most ONE Task or ONE Event — never both — or to **nothing at all** (standalone Reminders confirmed, e.g. "drink water at 3pm", FR-044 Must).
- A Reminder carries no work of its own and no calendar slot — it only directs attention.
- Trigger time is absolute, or relative to the target's start (Event) / deadline (Task) (FR-025).
- A due Reminder MUST produce a notification the owner actually perceives (FR-041 Must): fired by the server-side cron scheduler, delivered as Web Push to the installed PWA — never dependent on the app being open.

## Delivery architecture (ADR-0003/0005)

Workers cron trigger scans due Reminders → `web-push` under `nodejs_compat` → installed PWA (`src/sw.ts` handles push + notificationclick). Push failure is SILENT — the dedicated VAPID integration test is mandatory, and a manual test-push route is recommended.

## Resolved 2026-08-03

- No snooze and no re-fire in the MVP: the notification opens the app on the item; re-scheduling is manual. Notification-action snooze is a declared revisit trigger if the pain shows up in real use.

## Open Questions

- Fallback channel (e-mail-to-self, ntfy) if Web Push proves unreliable in practice — allowed without a new ADR (ADR-0003). The owner's phone is **Android**, where Chrome delivers push without requiring the PWA to be installed, so the iOS-specific worry recorded in ADR-0004 does not apply here; the trigger is unlikely to fire for that reason.
