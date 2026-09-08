/**
 * Pure pt-BR formatting for the diagnostics screen and the *Notificações*
 * card's test-push result (PRD AC-7 via plan AC-A3, PRD AC-8 via plan
 * AC-A2). Like `cron-freshness.ts`, this module is total, DOM-free and has
 * no runtime dependency of its own beyond `Intl`. `now` is always an
 * argument, never read from the clock internally, mirroring
 * `src/shared/format.ts`'s own discipline for testability.
 */

import type { PushOutcome } from "./push-outcome";

export function formatAbsoluteInstant(epochSeconds: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    // Explicit, like `src/shared/format.ts`'s own default — never left to
    // the runtime's local zone, which is what made this non-deterministic
    // outside the worker runtime's own UTC clock.
    timeZone: "UTC",
  }).format(new Date(epochSeconds * 1000));
}

export function formatRelativeInstant(epochSeconds: number, now: Date): string {
  const diffMinutes = Math.round((now.getTime() - epochSeconds * 1000) / 60000);
  // The explicit zero/negative-diff special case guidelines §9.4 requires
  // for `Intl`-driven copy — never letting `Intl.RelativeTimeFormat` render
  // "há 0 minutos".
  if (diffMinutes <= 0) return "agora";
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (diffMinutes < 60) return rtf.format(-diffMinutes, "minute");
  return rtf.format(-Math.round(diffMinutes / 60), "hour");
}

export function deviceSubscriptionLabel(subscribed: boolean): string {
  return subscribed ? "Este dispositivo está inscrito." : "Este dispositivo não está inscrito.";
}

export function pushOutcomeLabel(outcome: PushOutcome): string {
  switch (outcome.kind) {
    case "delivered":
      return "Entregue";
    case "gone":
      return "Inscrição expirada";
    case "retryable":
      return "Falha temporária";
  }
}
