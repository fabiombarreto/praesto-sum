/**
 * Parser for a `share_target` GET invocation's query string.
 *
 * Like `src/shared/api.ts`, this module is compiled into BOTH the browser
 * and the Worker projects, so it must stay environment-agnostic and free of
 * runtime dependencies and DOM globals (no `window`, no `document`) — the
 * detection/dispatch of the actual share-target invocation lives in
 * `src/app/main.tsx`, not here.
 */

/** Result of a successful share-target parse: a single usable title. */
export interface ShareTarget {
  title: string;
}

/**
 * Parses a `?title=...&text=...&url=...`-shaped query string (as delivered
 * by the manifest's `share_target` GET action) into a single usable title.
 *
 * Preference order is `text`, then `title`, then `url` — Android frequently
 * leaves `url` empty and puts the shared link in `text` instead (Chrome for
 * Developers). Returns `null` when all three are empty or whitespace-only
 * after trimming, so an all-empty share cannot produce a titled Task
 * (PRD AC-5).
 */
export function parseShareTarget(search: string): ShareTarget | null {
  const params = new URLSearchParams(search);
  const text = (params.get("text") ?? "").trim();
  if (text !== "") return { title: text };

  const title = (params.get("title") ?? "").trim();
  if (title !== "") return { title };

  const url = (params.get("url") ?? "").trim();
  if (url !== "") return { title: url };

  return null;
}
