// PRPs/prds/push-channel-proven.prd.md AC-9 (via plan AC-A1) — the
// encode/decode pair `src/app/push-subscribe.ts` needs to actually call
// `pushManager.subscribe()` and report a subscription's keys back to the
// server.
//
// Source plan: PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 2 — src/shared/push-key-encode.ts: arrayBufferToBase64Url,
// base64UrlToUint8Array; plan AC-A1)
//
// Pure, DOM-free unit under test: only `ArrayBuffer`/`Uint8Array`/`btoa`/
// `atob`, all available in both the browser and workerd. The actual
// `PushManager.subscribe()`/`getKey()` calls are the exempt thin adapter in
// `src/app/push-subscribe.ts`, verified on the device — never here.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/push-key-encode.ts does not exist yet, so this file is RED for
// the right reason (module-not-found on the import below) until plan Task 2
// lands.
//
// Test vectors below are derived by hand from the base64/base64url alphabet
// (index 62 = '+'/'-', index 63 = '/'/'_'), not copied from the
// implementation, so a discriminative-but-wrong encoding (e.g. forgetting to
// strip padding, or forgetting to swap '+'/'/' for '-'/'_') fails these
// assertions:
//   - [0xff]              -> standard base64 "/w==" -> base64url "_w"
//   - [0xff, 0xff, 0xff]  -> standard base64 "////" -> base64url "____"
//   - [0xf8, 0x00, 0x00]  -> standard base64 "+AAA" -> base64url "-AAA"

import { describe, expect, it } from "vitest";
import { arrayBufferToBase64Url, base64UrlToUint8Array } from "../src/shared/push-key-encode";

function buffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("arrayBufferToBase64Url (PRD AC-9 infrastructure)", () => {
  it("encodes a single byte that needs padding stripped and '/' swapped for '_'", () => {
    expect(arrayBufferToBase64Url(buffer([0xff]))).toBe("_w");
  });

  it("encodes three 0xff bytes — every '/' in the standard alphabet becomes '_'", () => {
    expect(arrayBufferToBase64Url(buffer([0xff, 0xff, 0xff]))).toBe("____");
  });

  it("encodes bytes whose standard base64 leads with '+' — it becomes '-'", () => {
    expect(arrayBufferToBase64Url(buffer([0xf8, 0x00, 0x00]))).toBe("-AAA");
  });

  it("never emits a standard-base64-only character in its output", () => {
    for (const bytes of [
      [0xff],
      [0xff, 0xff, 0xff],
      [0xf8, 0x00, 0x00],
      [1, 2, 3, 4, 5, 255, 0, 128],
    ]) {
      const encoded = arrayBufferToBase64Url(buffer(bytes));
      expect(encoded).not.toMatch(/[+/=]/);
    }
  });
});

describe("base64UrlToUint8Array (PRD AC-9 infrastructure)", () => {
  it("decodes an unpadded, single-char-shy base64url string back to its raw byte", () => {
    expect(Array.from(base64UrlToUint8Array("_w"))).toEqual([0xff]);
  });

  it("decodes a string with no padding needed", () => {
    expect(Array.from(base64UrlToUint8Array("____"))).toEqual([0xff, 0xff, 0xff]);
  });

  it("decodes a string starting with '-' back to the bytes '+' would have encoded", () => {
    expect(Array.from(base64UrlToUint8Array("-AAA"))).toEqual([0xf8, 0x00, 0x00]);
  });
});

describe("round-tripping (PRD AC-9 infrastructure)", () => {
  it("recovers the original bytes for a subscription-key-shaped byte sequence", () => {
    const original = Array.from({ length: 65 }, (_, i) => (i * 4) % 256);
    const roundTripped = Array.from(
      base64UrlToUint8Array(arrayBufferToBase64Url(buffer(original))),
    );
    expect(roundTripped).toEqual(original);
  });

  it("round-trips every byte value 0-255 individually, including the padding-triggering ones", () => {
    for (let byte = 0; byte <= 255; byte++) {
      const roundTripped = Array.from(
        base64UrlToUint8Array(arrayBufferToBase64Url(buffer([byte]))),
      );
      expect(roundTripped).toEqual([byte]);
    }
  });

  it("round-trips a known VAPID-public-key-length (65-byte, uncompressed EC point) buffer", () => {
    const original = [0x04, ...Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 256)];
    const roundTripped = Array.from(
      base64UrlToUint8Array(arrayBufferToBase64Url(buffer(original))),
    );
    expect(roundTripped).toEqual(original);
  });
});
