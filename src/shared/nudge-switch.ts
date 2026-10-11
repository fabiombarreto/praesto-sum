/**
 * Pure content of the repeated-miss nudge switch (repeated-miss-nudge phase 4,
 * PRD D-E): when the control exists, what it says, and the body it persists.
 *
 * It is DOM-free, Worker-free and clock-free; the React glue only renders it.
 */
import type { SeriesDto, UpdateSeriesInput } from "./api";
import { NUDGE_THRESHOLD } from "./nudge";

/** The wording of a silenced series, on the sheet's status line and the *Aderência* row. */
export const NUDGE_MUTED_LABEL = "Avisos silenciados";

/** What the switch shows: its label, whether it is on, and the line under it. */
export interface NudgeSwitchView {
  label: string;
  checked: boolean;
  statusText: string;
}

/**
 * The switch's view for a series, or `null` when it must not exist (series not
 * loaded, or ended). The switch reads "notify me": on means the nudge is active.
 */
export function nudgeSwitchView(
  series: Pick<SeriesDto, "status" | "nudgeMuted"> | null,
): NudgeSwitchView | null {
  if (series === null || series.status !== "active") return null;
  const checked = !series.nudgeMuted;
  return {
    label: `Avisar após ${NUDGE_THRESHOLD} não concluídas seguidas`,
    checked,
    statusText: checked
      ? "Avisos ativos para esta série."
      : `${NUDGE_MUTED_LABEL}. Seus lembretes continuam normais.`,
  };
}

/** The series PATCH body for a switch position: exactly `{ nudgeMuted }`, nothing else. */
export function nudgePatch(enabled: boolean): UpdateSeriesInput {
  return { nudgeMuted: !enabled };
}
