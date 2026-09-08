/**
 * `ArrayBuffer <-> base64url` pair (PRD AC-9 infrastructure, plan AC-A1) the
 * client needs to send the VAPID key to `pushManager.subscribe()` and to
 * turn a returned subscription's keys into `SubscribePushInput`. Like
 * `cron-freshness.ts`, this module is DOM-free and has no runtime
 * dependency of its own — only the JS-builtin `ArrayBuffer`/`Uint8Array`/
 * `btoa`/`atob`, all available in both the browser and workerd. Never
 * `Buffer`, which does not exist in the browser target.
 */

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
