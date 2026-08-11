import type { DurableTokenStorage, LegacyTokenStorage } from "../shared/token-store";

/**
 * The exempt adapter under `docs/context/methodology.md`'s "Browser-API
 * work: split the logic out, then the glue is exempt" rule: every decision
 * lives in the tested `src/shared/token-store.ts`; this file only calls
 * the browser APIs the store's two ports abstract over, carries no
 * branching worth asserting, and is verified on the owner's Android phone
 * and Windows PC rather than by an automated test.
 */

const DB_NAME = "praesto";
const STORE_NAME = "token";
const TOKEN_KEY = "praesto.token";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readFromDurableStore(): Promise<string | null> {
  const db = await openDatabase();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(TOKEN_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return typeof value === "string" ? value : null;
  } finally {
    db.close();
  }
}

async function writeToDurableStore(token: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put(token, TOKEN_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function clearDurableStore(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(TOKEN_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** IndexedDB-backed durable store — the one `navigator.storage.persist()` protects. */
export const durableTokenStorage: DurableTokenStorage = {
  read: readFromDurableStore,
  write: writeToDurableStore,
  clear: clearDurableStore,
};

/**
 * `window.localStorage`-backed legacy store — today's mechanism
 * (`src/app/api.ts:11-23` before this phase), kept as the migration
 * source and the `save()` fallback. Reads and writes the same
 * `"praesto.token"` key so the migration finds the token already stored
 * on the owner's devices.
 */
export const legacyTokenStorage: LegacyTokenStorage = {
  read(): string | null {
    return window.localStorage.getItem(TOKEN_KEY);
  },
  write(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

/**
 * Best-effort request for persistent storage. `persist()` protects
 * IndexedDB and Cache Storage from eviction; it does not protect Web
 * Storage, which is the whole reason the token moved. A denial degrades
 * to unprotected IndexedDB — still no worse than today — so the outcome
 * is ignored and this never throws.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === "function") {
      await navigator.storage.persist();
    }
  } catch {
    // Best-effort — a denial or a missing API must never break startup.
  }
}
