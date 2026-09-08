export interface NotificationActionPayload {
  action: string;
  title: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  route?: string;
  actions?: readonly NotificationActionPayload[];
}

const FALLBACK_TITLE = "Praesto Sum";
const FALLBACK_BODY = "Você tem um lembrete.";
const FALLBACK_ICON = "/icons/icon-192.png";
const FALLBACK_BADGE = "/icons/badge-72.png";
const FALLBACK_ROUTE = "/";

/**
 * Normalizes an already-parsed push payload (the result of `event.data.json()`
 * in the caller) into the shape `src/sw.ts` renders. Reads the nested
 * `{data: {route}}` field `src/shared/push-payload.ts` emits — never the flat
 * `{url}` shape this module supersedes. Takes `unknown` because a real push
 * body is attacker-influenced network input, never assumed well-shaped: every
 * field is `typeof`-checked, not merely nullish-checked, because a wrong-type
 * non-nullish value (e.g. `title: 12345`) is a real network input, not a
 * hypothetical — a bare `??` would let it through unchanged.
 */
export function parsePushPayload(value: unknown): PushPayload {
  if (typeof value !== "object" || value === null) {
    return { title: FALLBACK_TITLE, body: FALLBACK_BODY };
  }
  const parsed = value as {
    title?: unknown;
    body?: unknown;
    icon?: unknown;
    badge?: unknown;
    tag?: unknown;
    data?: { route?: unknown };
    actions?: unknown;
  };
  const title = typeof parsed.title === "string" ? parsed.title : FALLBACK_TITLE;
  const body = typeof parsed.body === "string" ? parsed.body : FALLBACK_BODY;
  const icon = typeof parsed.icon === "string" ? parsed.icon : undefined;
  const badge = typeof parsed.badge === "string" ? parsed.badge : undefined;
  const tag = typeof parsed.tag === "string" ? parsed.tag : undefined;
  const route = typeof parsed.data?.route === "string" ? parsed.data.route : undefined;
  const actions = isValidActions(parsed.actions) ? parsed.actions : undefined;
  return {
    title,
    body,
    ...(icon === undefined ? {} : { icon }),
    ...(badge === undefined ? {} : { badge }),
    ...(tag === undefined ? {} : { tag }),
    ...(route === undefined ? {} : { route }),
    ...(actions === undefined ? {} : { actions }),
  };
}

/**
 * Guards the shape of an `actions` value from an already-parsed but
 * attacker-influenced push payload: must be an array where every entry is an
 * object carrying string `action` and `title` fields. Anything else
 * (non-array, wrong-typed entries, entries missing a field) is rejected
 * wholesale so a malformed `actions` never reaches `showNotification`.
 */
function isValidActions(value: unknown): value is readonly NotificationActionPayload[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (entry): entry is NotificationActionPayload =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { action?: unknown }).action === "string" &&
      typeof (entry as { title?: unknown }).title === "string",
  );
}

/** The malformed-or-data-less-push fallback, with an optional raw-text body
 * for the `event.data.text()` branch (the caller's `catch` block). */
export function fallbackPushPayload(bodyOverride?: string): PushPayload {
  return bodyOverride === undefined
    ? { title: FALLBACK_TITLE, body: FALLBACK_BODY }
    : { title: FALLBACK_TITLE, body: bodyOverride };
}

export interface ResolvedPushNotificationOptions {
  icon: string;
  badge: string;
  data: { route: string };
  tag?: string;
  actions?: readonly NotificationActionPayload[];
}

/**
 * Resolves EVERY remaining fallback decision (icon, badge, route) that a
 * `PushPayload` may still be missing, into a single object `src/sw.ts` can
 * spread directly into `showNotification`'s options with no `??`, no
 * conditional and no defaulting of its own — the entire decidable half of
 * "what does the browser call see" lives here, never in the exempt glue file.
 * `tag`/`actions` are carried through unresolved (still conditionally
 * present-or-absent) since `showNotification` treats a missing `tag` as "no
 * collapse key", which is already correct with no default needed.
 */
export function resolvePushNotificationOptions(
  payload: PushPayload,
): ResolvedPushNotificationOptions {
  return {
    icon: payload.icon ?? FALLBACK_ICON,
    badge: payload.badge ?? FALLBACK_BADGE,
    data: { route: payload.route ?? FALLBACK_ROUTE },
    ...(payload.tag === undefined ? {} : { tag: payload.tag }),
    ...(payload.actions === undefined ? {} : { actions: payload.actions }),
  };
}
