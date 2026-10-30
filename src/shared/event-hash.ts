/**
 * The content hash of an Event (ADR-0016 decision 2, events-and-day-view PRD AC-4):
 * a digest of exactly the fields the owner authored, stored on the row and compared
 * by unit 15 against the baseline last synced to Google. Dirty is
 * `content_hash <> synced_content_hash`; `updated_at` is never read for it.
 *
 * Pure and import-free. It uses only Web Crypto and `TextEncoder`, which exist in the
 * browser, in workerd and in Node alike, so it needs no Node `crypto` import and is
 * compiled into every target.
 *
 * The canonicalization, byte for byte. The hashed bytes are the UTF-8 encoding of
 *
 *   "v1\n" + JSON.stringify([
 *     title.trim(),
 *     (description ?? "").trim(),
 *     (location ?? "").trim(),
 *     allDay,
 *     allDay ? startDate : startAt,
 *     allDay ? endDate : endAt,
 *     timezone,
 *   ])
 *
 * and the digest is the lowercase hex, exactly 64 characters, of its SHA-256. Epoch
 * seconds are plain numbers (a caller holding a `Date` converts first). Only these
 * seven fields are read, so `id`, `source`, `createdAt`, `updatedAt`, a stored hash
 * and any other key on the object are ignored, and the order of the object's keys is
 * irrelevant. An empty, a null and a missing description (or location) hash alike.
 *
 * The fixed example
 *
 *   { title: "Dentista", description: null, location: "Clínica Sorriso", allDay: false,
 *     startAt: 1792499400, endAt: 1792503000, startDate: null, endDate: null,
 *     timezone: "America/Sao_Paulo" }
 *
 * has the canonical string `v1`, a newline, then
 * `["Dentista","","Clínica Sorriso",false,1792499400,1792503000,"America/Sao_Paulo"]`.
 * The test suite computes its SHA-256 independently and pins it, so a change of
 * canonicalization is a visible, versioned event: bump the `v1` prefix whenever a
 * hashed field is added.
 */

/** The seven authored fields the hash covers; structurally the same as `ResolvedEvent`. */
export interface EventHashInput {
  title: string;
  description: string | null | undefined;
  location: string | null | undefined;
  allDay: boolean;
  startAt: number | null;
  endAt: number | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

/**
 * The content hash of `input`: a 64-character lowercase hex SHA-256 over the
 * canonical form described in this module's header. Equal for inputs that differ
 * only in unhashed keys, key order, surrounding whitespace or `""` versus `null`.
 */
export async function computeEventContentHash(input: EventHashInput): Promise<string> {
  const { allDay } = input;
  const canonical =
    "v1\n" +
    JSON.stringify([
      input.title.trim(),
      (input.description ?? "").trim(),
      (input.location ?? "").trim(),
      allDay,
      allDay ? input.startDate : input.startAt,
      allDay ? input.endDate : input.endAt,
      input.timezone,
    ]);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
