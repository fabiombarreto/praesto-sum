// Owned component (ADR-0011): the persistent condition banner (guidelines §8,
// layout standard §2.2) — icon + text, directly under the header, never
// dismissible.
//
// It serves TWO conditions since unit 4 phase 4: the device being offline, and
// the Google calendar being unreachable while the app itself is fine. The icon
// is therefore a prop rather than a fixture — a Google outage showing a
// wifi-off glyph would name the wrong culprit, which is the same defect that
// cost real debugging time in phase 2 when a certificate failure was reported
// as "Google refused".

import type { LucideIcon } from "lucide-react";
import { WifiOff } from "lucide-react";

export function Banner({
  lead,
  body,
  icon: Icon = WifiOff,
}: {
  lead: string;
  body: string;
  /** Defaults to `WifiOff`, so the offline call site is unchanged. */
  icon?: LucideIcon;
}) {
  return (
    <div
      role="status"
      className="flex min-h-12 items-center gap-3 border-b border-line bg-surface-1 px-4 text-t2 text-ink"
    >
      <Icon className="size-5 flex-none text-muted" aria-hidden="true" />
      <span>
        <strong>{lead}</strong> {body}
      </span>
    </div>
  );
}
