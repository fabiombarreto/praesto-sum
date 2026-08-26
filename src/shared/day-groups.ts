/**
 * The range function (unit 4 `google-calendar-read`, phase 1).
 *
 * `collectDayItems` takes a LIST of sources — not one source, not a fixed pair
 * — and answers with the five buckets layout standard §2.5 specifies. That
 * signature is the unit's declared non-negotiable design condition: it is what
 * lets unit 14 add local Events as a third source instead of rewriting the
 * screen. There is deliberately no branch on `sources.length`; zero, one and
 * many run the same code.
 *
 * **It merges; it never sorts.** The Task source arrives already ordered by
 * the API (`src/worker/routes/tasks.ts`), and the frozen read contract
 * (`docs/api-reference.md`) makes that ordering the server's guarantee to
 * keep. Concatenating everything and sorting would re-derive it on the client
 * — the one place consumers cannot share. So each source's own relative order
 * is preserved, and only the interleaving between sources is decided here, by
 * `dueDate`, with ties broken by the source's position in `sources`.
 *
 * Like `task-groups.ts` and `day-item.ts`, this module compiles into BOTH the
 * browser and the Worker projects: no DOM globals, no runtime dependencies,
 * no clock. `today` is always an argument.
 */

import type { DayItem } from "./day-item";

/** The five buckets. Keys are English; the pt-BR group names live in `TaskGroup`. */
export interface DayItemGroups {
  overdue: DayItem[];
  today: DayItem[];
  upcoming: DayItem[];
  undated: DayItem[];
  closed: DayItem[];
}

/** One named stream of already-projected items. A delivery boundary, not a semantic one. */
export interface DayItemSource {
  id: string;
  items: readonly DayItem[];
}

type BucketKey = keyof DayItemGroups;

/**
 * Which bucket an item belongs to. `closed` is read first, mirroring the rule
 * `groupTasks` has encoded since unit 3; the date ladder then compares
 * `YYYY-MM-DD` strings, which are zero-padded, so lexicographic order is
 * chronological order.
 */
function bucketOf(item: DayItem, today: string): BucketKey {
  if (item.closed) return "closed";
  if (item.dueDate === null) return "undated";
  if (item.dueDate < today) return "overdue";
  if (item.dueDate === today) return "today";
  return "upcoming";
}

/**
 * A stable k-way merge over already-ordered streams.
 *
 * Each entry of `streams` keeps its own order; at every step the stream whose
 * head has the smallest `dueDate` wins, and an exact tie goes to the
 * lowest-indexed stream. With one stream this is the identity — which is what
 * makes the widening provably behaviour-preserving for a Task-only day.
 *
 * `null` dueDates never compete: a bucket is either entirely undated or
 * entirely dated, so within `undated` every comparison ties and the result is
 * plain source order.
 */
function mergeStable(streams: DayItem[][]): DayItem[] {
  const cursors = streams.map(() => 0);
  const total = streams.reduce((sum, stream) => sum + stream.length, 0);
  const merged: DayItem[] = [];

  while (merged.length < total) {
    let pick = -1;

    for (let i = 0; i < streams.length; i += 1) {
      const candidate = streams[i]?.[cursors[i] ?? 0];
      if (candidate === undefined) continue;

      const incumbent = pick === -1 ? undefined : streams[pick]?.[cursors[pick] ?? 0];
      // Strictly-less-than is what makes the merge stable: an equal key never
      // displaces the incumbent, so the earlier source keeps the slot.
      if (incumbent === undefined || isBefore(candidate, incumbent)) {
        pick = i;
      }
    }

    // Unreachable while `merged.length < total`, but a silent infinite loop is
    // the worse failure, so break loudly rather than spin.
    if (pick === -1) break;

    merged.push(streams[pick]![cursors[pick]!]!);
    cursors[pick] = (cursors[pick] ?? 0) + 1;
  }

  return merged;
}

/** Orders two items within a bucket. Undated items are mutually incomparable, so they tie. */
function isBefore(candidate: DayItem, incumbent: DayItem): boolean {
  if (candidate.dueDate === null || incumbent.dueDate === null) return false;
  return candidate.dueDate < incumbent.dueDate;
}

/**
 * Partitions every source's items into the five buckets, then merges the
 * sources within each bucket. One code path for any number of sources.
 */
export function collectDayItems(sources: readonly DayItemSource[], today: string): DayItemGroups {
  // Per bucket, one stream per source — built in `sources` order, which is
  // what the merge's tie-break rule refers to.
  const streams: Record<BucketKey, DayItem[][]> = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
    closed: [],
  };

  for (const source of sources) {
    const perBucket: Record<BucketKey, DayItem[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      undated: [],
      closed: [],
    };

    for (const item of source.items) {
      perBucket[bucketOf(item, today)].push(item);
    }

    for (const bucket of Object.keys(streams) as BucketKey[]) {
      streams[bucket].push(perBucket[bucket]);
    }
  }

  return {
    overdue: mergeStable(streams.overdue),
    today: mergeStable(streams.today),
    upcoming: mergeStable(streams.upcoming),
    undated: mergeStable(streams.undated),
    closed: mergeStable(streams.closed),
  };
}
