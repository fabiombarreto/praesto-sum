/**
 * Triggers a browser file download for an already-fetched `Blob`.
 *
 * Exempt glue (`docs/context/methodology.md`, "Browser-API work" split) —
 * verified manually, not test-first. A plain `<a href download>` cannot be
 * used for the export routes: both require an `Authorization: Bearer`
 * header, which an anchor has no way to send, so the file must be fetched
 * as a `Blob` first (see `fetchExportFile` in `./api`) and then handed to
 * the browser through a short-lived object URL instead.
 *
 * Per MDN (`URL.createObjectURL`): "the browser holds a strong reference to
 * the Blob for as long as the object URL lives" — so the object URL is
 * revoked synchronously, immediately after the click, rather than deferred
 * to a timeout or left for garbage collection, to avoid leaking the blob's
 * memory for the rest of the page's lifetime across repeated downloads.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
