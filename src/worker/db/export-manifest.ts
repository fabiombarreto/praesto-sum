/**
 * The single source of the exported-table list and the reasoned exclusion
 * list (FR-042, data-export PRD AC-3/AC-4).
 *
 * Both `src/worker/routes/export.ts` (what it queries and what it never
 * imports) and `test/export-completeness.test.ts` (the schema-enumerating
 * guard) read from this module and only this module, so the two can never
 * independently drift — the guard's entire premise (AC-4).
 *
 * Deliberately standalone: no Drizzle import, so this file stays trivially
 * inspectable by anyone auditing what leaves the Worker in an export.
 */

/** The five data-bearing tables, dumped in full, every row. */
export const EXPORTED_TABLE_NAMES: readonly string[] = [
  "life_areas",
  "recurrence_series",
  "tasks",
  "reminders",
  "google_calendar_selections",
] as const;

/**
 * Every schema table NOT dumped, each with a non-empty written reason.
 * `docs/anti-patterns.md:121` ("weakening tests to force green") is exactly
 * what an empty or false reason here would be — AC-4 fails a whitespace-only
 * reason precisely to keep that honest.
 */
export const EXCLUDED_TABLES: ReadonlyArray<{ readonly name: string; readonly reason: string }> = [
  {
    // Reason adapted verbatim from src/worker/db/schema.ts:328-333.
    name: "google_connections",
    reason:
      "excluded from the FR-042 export; an export carrying a live credential would make every backup file a credential",
  },
  {
    name: "push_subscriptions",
    reason: "holds a device's push delivery credentials (p256dh/auth), not portable owner data",
  },
  {
    // Reason adapted from the table's own doc comment, schema.ts:301-303.
    name: "oauth_states",
    reason: "single-use nonces, worthless once consumed or expired, carrying no user data",
  },
  {
    // cron_runs (unit 6 push-channel-proven, phase 3).
    name: "cron_runs",
    reason:
      "records when the scheduler itself fired and whether that tick succeeded, not anything the owner authored; it is operational telemetry about this Worker's own execution, outside the FR-042 promise about the owner's data",
  },
  {
    // push_dispatch_attempts (unit 6 push-channel-proven, phase 3).
    name: "push_dispatch_attempts",
    reason:
      "records the outcome of the last push-notification dispatch attempt, i.e. whether the system's own delivery succeeded, not content the owner would recognize or want to carry to another tool; it stays out of the FR-042 export for the same reason cron_runs does",
  },
];
