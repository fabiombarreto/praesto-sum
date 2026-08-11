/**
 * Owns every decision about the bearer token's storage: where it is read
 * from, where it is written, what a 401 clears, and how a token already
 * sitting in the legacy store (`window.localStorage`) is migrated into the
 * durable store (IndexedDB) exactly once. It never touches storage
 * directly — it reaches storage only through the two ports below, which
 * `src/app/token-storage.ts` implements.
 *
 * Like `src/shared/request-failure.ts` and `src/shared/share-target.ts`,
 * this module is compiled into BOTH the browser and the Worker projects
 * (`tsconfig.test.json` and `tsconfig.worker.json` both include
 * `src/shared` under `lib: ["ES2022"]`, with no `DOM`), so it must stay
 * environment-agnostic and free of runtime dependencies and DOM globals —
 * no `window`, `document`, `navigator`, `indexedDB` or `localStorage` as
 * values anywhere in this file. `tsconfig.test.json`'s test project also
 * does not include `src/app`, so this module cannot import from there
 * either; it only ever sees storage through the ports declared below.
 */

/** Durable storage port: the IndexedDB-backed store `persist()` protects. */
export interface DurableTokenStorage {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** Legacy storage port: today's `window.localStorage`, which `persist()` does not protect. */
export interface LegacyTokenStorage {
  read(): string | null;
  write(token: string): void;
  clear(): void;
}

/** The store the rest of the app talks to — always async, storage-agnostic. */
export interface TokenStore {
  read(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * True when `value` is a real, non-blank token. A value that is empty or
 * whitespace-only is not a token (Task 1 rule 7). A type predicate, not a
 * plain boolean, so the migration branch below narrows `legacyValue` from
 * `string | null` to `string` without a redundant runtime check.
 */
function hasToken(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

/**
 * Thrown by `save()` when the token reached NEITHER store. This is the one
 * failure the owner has to be told about: a Save that persisted nothing and
 * said nothing is the silent absorption FR-045 and vision principle 6 (honest
 * mirror) exist to rule out. The message lives here, in the tested module,
 * rather than in the untested UI, so its wording is pinned by a test.
 */
const TOKEN_NOT_STORED =
  "Praesto could not store the API token on this device. Both IndexedDB and " +
  "local storage refused — check whether this browser is blocking site data " +
  "for this site.";

/**
 * Builds a `TokenStore` over the given ports. Implements the seven
 * numbered behaviour rules from this plan's Task 1
 * (`PRPs/plans/install-and-quick-capture-phase-2-durable-token.plan.md`):
 * durable-first reads, exactly-once migration that never destroys the
 * only copy, durable-first saves that degrade to legacy on failure, a
 * clear that always touches both stores and never rejects, and blank
 * values treated as absent in either store.
 */
export function createTokenStore(ports: {
  durable: DurableTokenStorage;
  legacy: LegacyTokenStorage;
}): TokenStore {
  const { durable, legacy } = ports;

  return {
    async read(): Promise<string | null> {
      // Rule 1: prefer the durable store; do not touch legacy if it answers.
      let durableValue: string | null;
      try {
        durableValue = await durable.read();
      } catch {
        // Rule 2: a rejecting durable read falls through to legacy exactly
        // like an empty durable store does.
        durableValue = null;
      }
      if (hasToken(durableValue)) {
        return durableValue;
      }

      // Rule 2: durable holds nothing (or rejected) — fall back to legacy.
      // Guarded for the same reason the durable read is: a browser set to
      // block site data raises on ANY `window.localStorage` access, and
      // `read()` must never reject. Its caller — src/app/App.tsx's mount
      // effect — has nowhere to route a rejection except the permanent
      // "Loading…" placeholder, so a throw there would strand the app short
      // of the token screen, which is the recovery path.
      let legacyValue: string | null;
      try {
        legacyValue = legacy.read();
      } catch {
        legacyValue = null;
      }
      if (!hasToken(legacyValue)) {
        return null;
      }

      // Migrate: copy into durable, then clear the legacy copy so a later
      // read is served by the durable store alone.
      try {
        await durable.write(legacyValue);
      } catch {
        // Rule 3: migration never destroys the only copy. Leave the
        // legacy value in place; the migration retries on the next read.
        return legacyValue;
      }

      // The durable copy now exists, so the migration has succeeded. Dropping
      // the stale legacy copy is hygiene on top of that — deliberately in its
      // OWN try, because failing at it is not a failed migration and must not
      // be reported as one. A copy left behind cannot shadow anything: rule 1
      // prefers the durable store, and `clear()` wipes both.
      try {
        legacy.clear();
      } catch {
        // ignored — the token is durably stored either way
      }
      return legacyValue;
    },

    async save(token: string): Promise<void> {
      try {
        await durable.write(token);
      } catch {
        // Rule 5: durable unavailable (IndexedDB blocked or missing) —
        // degrade to the legacy store rather than losing the token.
        // Today's behaviour is the declared floor.
        try {
          legacy.write(token);
        } catch {
          // Neither store took it. The token is nowhere, and the owner is
          // looking at a Save button that would otherwise appear to have
          // done nothing.
          throw new Error(TOKEN_NOT_STORED);
        }
        return;
      }

      // Rule 4: the durable write succeeded, so the token IS stored. Dropping
      // any stale legacy copy is hygiene on top of that, in its OWN try: when
      // this throws, reporting a failed save would be a lie that sends the
      // owner back to re-paste a token that already saved. A copy left behind
      // cannot shadow the new one — rule 1 prefers the durable store.
      try {
        legacy.clear();
      } catch {
        // ignored — the token is durably stored either way
      }
    },

    async clear(): Promise<void> {
      // Rule 6: clear BOTH stores and never reject, even if one throws.
      // Clearing only the durable copy would let rule 2's migration
      // resurrect a stale legacy token on the next read, looping the app
      // back into the same 401 — and rejecting here would break the
      // 401 path's only route back to the token screen.
      try {
        await durable.clear();
      } catch {
        // ignored — legacy must still be cleared below
      }
      try {
        legacy.clear();
      } catch {
        // ignored — clear() must never reject
      }
    },
  };
}
