/**
 * Web Push notification payload builder (PRD AC-1, plan Task 1 of
 * push-channel-proven phase 2 subscription-lifecycle).
 *
 * Like `src/shared/request-failure.ts`, this module is compiled into BOTH the
 * browser and the Worker projects, so it stays environment-agnostic and free
 * of DOM globals and runtime dependencies. This phase only calls it from the
 * Worker (`src/worker/routes/push.ts`), but the module itself makes no
 * assumption about that.
 *
 * `icon`/`badge` are hardcoded to the exact paths `src/sw.ts:76-77` already
 * expects, so the two halves of the channel agree on the asset without
 * either importing the other. Title is truncated to 30 visible characters
 * per `documentation/40-engineering/ui-ux-guidelines.md` §8; `actions` is
 * capped at 2 and, respecting `exactOptionalPropertyTypes`, is present on
 * the returned object only when non-empty.
 */

export interface NotificationActionPayload {
  action: string;
  title: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  data: { route: string };
  actions?: readonly NotificationActionPayload[];
}

const TITLE_MAX_LENGTH = 30;
const MAX_ACTIONS = 2;

/**
 * Builds the exact notification shape `src/sw.ts` parses. `body` passes
 * through unchanged — the caller decides "when and what is due" wording,
 * not this module.
 */
export function buildNotificationPayload(input: {
  title: string;
  body: string;
  route: string;
  tag: string;
  actions?: readonly NotificationActionPayload[];
}): NotificationPayload {
  const cappedActions = (input.actions ?? []).slice(0, MAX_ACTIONS);

  return {
    title: input.title.slice(0, TITLE_MAX_LENGTH),
    body: input.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: input.tag,
    data: { route: input.route },
    ...(cappedActions.length > 0 ? { actions: cappedActions } : {}),
  };
}
