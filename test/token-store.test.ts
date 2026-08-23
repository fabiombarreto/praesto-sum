// PRPs/prds/install-and-quick-capture.prd.md AC-2 token-never-reprompted
//
// Source plan: PRPs/plans/install-and-quick-capture-phase-2-durable-token.plan.md
// (Task 1 — createTokenStore(ports: { durable: DurableTokenStorage; legacy: LegacyTokenStorage })
// => TokenStore, and its seven numbered behaviour rules).
//
// This is a pure, DOM-free unit under test (src/shared/token-store.ts must stay
// environment-agnostic and dual-compiled into both the browser and Worker targets —
// tsconfig.test.json's `include` lists `test`, `src/worker`, `src/shared` but NOT
// `src/app`, and neither tsconfig declares the DOM lib). It needs neither the D1
// fixture nor the bearer-token auth helpers that test/tasks.test.ts uses, mirroring
// test/share-target.test.ts's and test/request-failure.test.ts's shape.
//
// Both storage ports are faked in-memory below (FakeDurableStorage, FakeLegacyStorage).
// Real `indexedDB` and `window.localStorage` access lives only in the exempt adapter
// (src/app/token-storage.ts, plan Task 2), which this suite does not import and does
// not test, per the owner's binding resolution of PRD Open Question 4 and
// docs/context/methodology.md's "Browser-API work: split the logic out, then the glue
// is exempt" section.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): src/shared/
// token-store.ts does not exist yet, so this file is expected to be RED for the right
// reason (module-not-found / type error on createTokenStore and its two port
// interfaces) until plan Task 1 is implemented.
//
// Scope note (full per-AC-A outcome record in
// PRPs/reports/install-and-quick-capture/test-suite-phase-2.diff): this file covers
// the store's decidable logic — plan AC-A1 through AC-A5, plus the two Task-1
// behaviour rules (4 and 7) that have no dedicated AC-A number of their own but are
// explicitly part of Task 1's prescribed contract. It deliberately does NOT cover:
//   - AC-A6 (src/app/api.ts awaiting the store) and AC-A8 (src/app/App.tsx's
//     three-valued gate): both live in src/app, which tsconfig.test.json excludes
//     from this project, and both are Implementer work (plan Tasks 3-4) that has not
//     run yet under test-first ordering. The plan's own grep + `npm run check`
//     VALIDATE blocks and its Level 3 MANUAL steps 1, 2 and 5 are the verification
//     path for these.
//   - AC-A7 (navigator.storage.persist() + the IndexedDB adapter): the plan states
//     explicitly that no test may assert merely that persist() was called
//     (R-TRIVIAL-ASSERT); it is verified on the owner's Android phone and Windows PC
//     per the plan's Level 3 MANUAL steps 2-4.

import { describe, expect, it } from "vitest";
import { createTokenStore } from "../src/shared/token-store";
import type {
  DurableTokenStorage,
  LegacyTokenStorage,
  TokenStore,
} from "../src/shared/token-store";

/**
 * In-memory fake of DurableTokenStorage. `failNextReadWith` / `failNextWriteWith` /
 * `failNextClearWith` are one-shot: they make exactly the NEXT call to that method
 * reject, then reset — this is what lets a single test exercise both "the operation
 * fails" and "the operation later succeeds" (e.g. a migration retry) without a second
 * fake instance. `peek()` reads the fake's raw internal state directly, so tests
 * assert on the actual stored value rather than on whether a method was called.
 */
class FakeDurableStorage implements DurableTokenStorage {
  private value: string | null = null;
  private failRead = false;
  private failWrite = false;
  private failClear = false;

  seed(token: string | null): void {
    this.value = token;
  }
  peek(): string | null {
    return this.value;
  }
  failNextReadWith(): void {
    this.failRead = true;
  }
  failNextWriteWith(): void {
    this.failWrite = true;
  }
  failNextClearWith(): void {
    this.failClear = true;
  }

  async read(): Promise<string | null> {
    if (this.failRead) {
      this.failRead = false;
      throw new Error("fake durable read failure");
    }
    return this.value;
  }

  async write(token: string): Promise<void> {
    if (this.failWrite) {
      this.failWrite = false;
      throw new Error("fake durable write failure");
    }
    this.value = token;
  }

  async clear(): Promise<void> {
    if (this.failClear) {
      this.failClear = false;
      throw new Error("fake durable clear failure");
    }
    this.value = null;
  }
}

/**
 * In-memory fake of LegacyTokenStorage — synchronous, matching the real
 * `window.localStorage` surface the port models. Same one-shot failure-injection
 * shape as FakeDurableStorage.
 *
 * All three operations can be made to throw, because all three genuinely can:
 * a browser configured to block site data raises a SecurityError on any
 * `window.localStorage` access, not merely on writes.
 */
class FakeLegacyStorage implements LegacyTokenStorage {
  private value: string | null = null;
  private failRead = false;
  private failWrite = false;
  private failClear = false;

  seed(token: string | null): void {
    this.value = token;
  }
  peek(): string | null {
    return this.value;
  }
  failNextReadWith(): void {
    this.failRead = true;
  }
  failNextWriteWith(): void {
    this.failWrite = true;
  }
  failNextClearWith(): void {
    this.failClear = true;
  }

  read(): string | null {
    if (this.failRead) {
      this.failRead = false;
      throw new Error("fake legacy read failure");
    }
    return this.value;
  }

  write(token: string): void {
    if (this.failWrite) {
      this.failWrite = false;
      throw new Error("fake legacy write failure");
    }
    this.value = token;
  }

  clear(): void {
    if (this.failClear) {
      this.failClear = false;
      throw new Error("fake legacy clear failure");
    }
    this.value = null;
  }
}

function makeStore(): {
  durable: FakeDurableStorage;
  legacy: FakeLegacyStorage;
  store: TokenStore;
} {
  const durable = new FakeDurableStorage();
  const legacy = new FakeLegacyStorage();
  const store = createTokenStore({ durable, legacy });
  return { durable, legacy, store };
}

describe("createTokenStore().read() — prefers the durable store (PRD AC-2, plan AC-A1)", () => {
  it("returns the durable token and does not touch the legacy store when durable holds a non-blank value", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("durable-token");
    legacy.seed("legacy-token"); // deliberately different — proves legacy is not consulted

    const result = await store.read();

    expect(result).toBe("durable-token");
    expect(legacy.peek()).toBe("legacy-token"); // untouched
  });
});

describe("createTokenStore().read() — migrates a legacy-only token exactly once (PRD AC-2, plan AC-A2)", () => {
  it("copies the legacy token into durable storage, clears the legacy copy, and returns it", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("legacy-token");

    const result = await store.read();

    expect(result).toBe("legacy-token");
    expect(durable.peek()).toBe("legacy-token");
    expect(legacy.peek()).toBeNull();
  });

  it("serves a second read from durable storage alone, even if legacy is reseeded afterwards", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("legacy-token");

    const first = await store.read();
    expect(first).toBe("legacy-token");

    // Reseed legacy with a DIFFERENT, stale value. If the store still consulted
    // legacy on the second read, this stale value would resurface instead of the
    // already-migrated token.
    legacy.seed("stale-resurrected-token");
    const second = await store.read();

    expect(second).toBe("legacy-token");
    expect(durable.peek()).toBe("legacy-token");
  });

  it("also falls back to legacy and migrates when durable.read() rejects, not only when it resolves empty", async () => {
    const { durable, legacy, store } = makeStore();
    durable.failNextReadWith();
    legacy.seed("legacy-token");

    const result = await store.read();

    expect(result).toBe("legacy-token");
    expect(durable.peek()).toBe("legacy-token");
    expect(legacy.peek()).toBeNull();
  });
});

describe("createTokenStore().read() — migration never destroys the only copy (PRD AC-2, plan AC-A3)", () => {
  it("returns the legacy token and leaves it in place when the durable write during migration fails", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("legacy-token");
    durable.failNextWriteWith();

    const result = await store.read();

    expect(result).toBe("legacy-token");
    expect(legacy.peek()).toBe("legacy-token"); // left intact, not cleared
    expect(durable.peek()).toBeNull(); // failed write persisted nothing
  });

  it("retries the migration on the next read once the durable write no longer fails", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("legacy-token");
    durable.failNextWriteWith();

    const first = await store.read();
    expect(first).toBe("legacy-token");
    expect(durable.peek()).toBeNull();

    const second = await store.read();

    expect(second).toBe("legacy-token");
    expect(durable.peek()).toBe("legacy-token");
    expect(legacy.peek()).toBeNull();
  });
});

describe("createTokenStore().save() — degrades to the legacy store when durable is unavailable (PRD AC-2, plan AC-A4)", () => {
  it("writes the token to the legacy store, without rejecting, when durable.write() rejects", async () => {
    const { durable, legacy, store } = makeStore();
    durable.failNextWriteWith();

    await expect(store.save("new-token")).resolves.toBeUndefined();

    expect(legacy.peek()).toBe("new-token");
    expect(durable.peek()).toBeNull();
  });
});

describe("createTokenStore().save() — writes durably and drops a stale legacy copy on success (PRD AC-2, plan Task 1 rule 4)", () => {
  it("writes the token to the durable store and clears any stale legacy copy so it cannot shadow the new token later", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("old-token");

    await store.save("new-token");

    expect(durable.peek()).toBe("new-token");
    expect(legacy.peek()).toBeNull();

    // Confirm the drop is real, not merely internal bookkeeping: a subsequent
    // read must return the new token, never the stale legacy one.
    const readBack = await store.read();
    expect(readBack).toBe("new-token");
  });
});

describe("createTokenStore().clear() — clears BOTH stores and never rejects (PRD AC-2, plan AC-A5)", () => {
  it("clears both the durable and legacy stores", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("durable-token");
    legacy.seed("legacy-token");

    await store.clear();

    expect(durable.peek()).toBeNull();
    expect(legacy.peek()).toBeNull();
  });

  it("does not reject, and still clears the legacy store, when the durable store's clear throws", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("durable-token");
    legacy.seed("legacy-token");
    durable.failNextClearWith();

    await expect(store.clear()).resolves.toBeUndefined();

    expect(legacy.peek()).toBeNull();
  });

  it("does not reject, and still clears the durable store, when the legacy store's clear throws", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("durable-token");
    legacy.seed("legacy-token");
    legacy.failNextClearWith();

    await expect(store.clear()).resolves.toBeUndefined();

    expect(durable.peek()).toBeNull();
  });

  it("prevents a stale legacy token from resurrecting via migration after a clear (clear-both is load-bearing, not tidiness)", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("current-token");
    legacy.seed("stale-token");

    await store.clear();
    const afterClear = await store.read();

    // If clear() had cleared only the durable copy, this read would trigger
    // AC-A2's migration path and resurrect "stale-token" instead of finding
    // nothing — exactly the "token screen keeps coming back" symptom AC-2
    // exists to remove.
    expect(afterClear).toBeNull();
  });
});

describe("createTokenStore().read() — a blank stored value is not a token (PRD AC-2, plan Task 1 rule 7)", () => {
  it("treats an empty-string durable value as absent and falls back to legacy", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("");
    legacy.seed("real-token");

    const result = await store.read();

    expect(result).toBe("real-token");
  });

  it("treats a whitespace-only durable value as absent and falls back to legacy", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("   ");
    legacy.seed("real-token");

    const result = await store.read();

    expect(result).toBe("real-token");
  });

  it("treats a blank legacy value as absent and does not migrate it when durable is also empty", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("   ");

    const result = await store.read();

    expect(result).toBeNull();
    expect(durable.peek()).toBeNull(); // nothing migrated — blank is not a token
  });

  it("returns null, without migrating anything, when neither store holds a token", async () => {
    const { durable, legacy, store } = makeStore();

    const result = await store.read();

    expect(result).toBeNull();
    expect(durable.peek()).toBeNull();
    expect(legacy.peek()).toBeNull();
  });
});

// The cases below were added after the phase-2 code review flagged that every
// `durable.*` call was guarded while two `legacy.*` calls were not. A browser
// configured to block site data raises a SecurityError on any
// `window.localStorage` access, so the legacy port can throw on read and write
// exactly as it can on clear. They pin two distinct honesty properties:
// `read()` must never reject (its caller, src/app/App.tsx's mount effect, has
// nowhere to route a rejection but the permanent "Loading…" placeholder), and
// `save()` must reject when — and ONLY when — the token reached no store at all.

describe("createTokenStore().read() — never rejects, whichever store fails", () => {
  it("returns null instead of rejecting when the legacy read throws and durable is empty", async () => {
    const { legacy, store } = makeStore();
    legacy.failNextReadWith();

    // Null is the honest answer: no token could be found, so the app reaches
    // the token screen — the recovery path — rather than hanging on "Loading…".
    await expect(store.read()).resolves.toBeNull();
  });

  it("returns null instead of rejecting when BOTH the durable and legacy reads throw", async () => {
    const { durable, legacy, store } = makeStore();
    durable.seed("unreachable-token");
    legacy.seed("unreachable-token");
    durable.failNextReadWith();
    legacy.failNextReadWith();

    await expect(store.read()).resolves.toBeNull();
  });

  it("completes the migration when the durable write succeeds but the legacy cleanup throws", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("legacy-token");
    legacy.failNextClearWith();

    const first = await store.read();

    // The durable copy is what matters: dropping the stale legacy copy is
    // hygiene, and failing at it must not be mistaken for a failed migration.
    expect(first).toBe("legacy-token");
    expect(durable.peek()).toBe("legacy-token");

    // Prove the migration really took: reseed legacy with a different value
    // and confirm the next read is served by the durable store alone.
    legacy.seed("stale-token");
    await expect(store.read()).resolves.toBe("legacy-token");
  });
});

describe("createTokenStore().save() — reports failure only when nothing was stored", () => {
  it("resolves when the durable write succeeded and the legacy store is entirely unusable", async () => {
    const { durable, legacy, store } = makeStore();
    legacy.seed("old-token");
    // A blocked-site-data browser fails EVERY localStorage operation, not just
    // one, so failing the cleanup alone would not reproduce the real condition:
    // the fallback write that follows it must fail too.
    legacy.failNextClearWith();
    legacy.failNextWriteWith();

    // The token IS durably stored, so reporting failure here would be a lie
    // that sends the owner back to re-paste a token that already saved.
    await expect(store.save("new-token")).resolves.toBeUndefined();
    expect(durable.peek()).toBe("new-token");
    await expect(store.read()).resolves.toBe("new-token");
  });

  it("rejects with an actionable message when neither store could take the token", async () => {
    const { durable, legacy, store } = makeStore();
    durable.failNextWriteWith();
    legacy.failNextWriteWith();

    // Nothing was persisted anywhere. Swallowing this would leave the owner
    // looking at a Save button that silently did nothing. The wording is pinned
    // in Portuguese since ui-design-pass phase 1 (PRPs/prds/ui-design-pass.prd.md
    // AC-4 pt-br-shared-messages, ADR-0009) — the full sentence, so a paraphrase
    // or a stray English fallback fails here.
    await expect(store.save("new-token")).rejects.toThrow(
      "Não foi possível guardar o token neste dispositivo. O navegador recusou IndexedDB e o armazenamento local — verifique se ele está bloqueando dados do site.",
    );
    expect(durable.peek()).toBeNull();
    expect(legacy.peek()).toBeNull();
  });
});
