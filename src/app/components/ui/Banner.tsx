// Owned component (ADR-0011): the offline / unreachable banner (guidelines
// §8) — icon + text, directly under the header, never dismissible.

import { WifiOff } from "lucide-react";

export function Banner({ lead, body }: { lead: string; body: string }) {
  return (
    <div
      role="status"
      className="flex min-h-12 items-center gap-3 border-b border-line bg-surface-1 px-4 text-t2 text-ink"
    >
      <WifiOff className="size-5 flex-none text-muted" aria-hidden="true" />
      <span>
        <strong>{lead}</strong> {body}
      </span>
    </div>
  );
}
