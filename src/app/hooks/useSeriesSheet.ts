import { useEffect, useState } from "react";
import type { SeriesDto, TaskDto } from "../../shared/api";
import {
  seriesRuleDraftFromSeries,
  type ApplyTo,
  type SeriesRuleDraft,
} from "../../shared/series-edit";
import { getSeries } from "../api";

/**
 * The series side of a Task sheet: when the open Task is an occurrence, load its
 * series so the sheet can show and edit the rule, and hold the two drafts that
 * belong to that surface (the rule, and where template edits go).
 *
 * Shared by *Hoje* and the search screen so the two sheets cannot drift — the
 * decisions themselves (what each save sends where) live in
 * `src/shared/series-edit.ts`, pure and tested; this is only the glue that fetches
 * and holds state (`docs/context/methodology.md`, "split the logic out, then the
 * glue is exempt").
 */
export function useSeriesSheet(sheetTask: TaskDto | null): {
  series: SeriesDto | null;
  /** Set when the series could not be loaded, so the sheet says so instead of going quiet. */
  seriesError: string | null;
  ruleDraft: SeriesRuleDraft | null;
  changeRuleDraft: (changes: Partial<SeriesRuleDraft>) => void;
  applyTo: ApplyTo;
  setApplyTo: (next: ApplyTo) => void;
  /** Replace the loaded series after a successful edit, so the drafts re-seed from the truth. */
  acceptSeries: (next: SeriesDto) => void;
} {
  const taskId = sheetTask?.id ?? null;
  const seriesId = sheetTask?.seriesId ?? null;
  const [series, setSeries] = useState<SeriesDto | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<SeriesRuleDraft | null>(null);
  // Default "toda a série": the defect the owner found was an occurrence silently
  // detaching on an ordinary edit, and a template field is series-wide by nature.
  const [applyTo, setApplyTo] = useState<ApplyTo>("series");

  // Keyed on the Task as well as the series: every time the sheet opens, the
  // drafts start from the stored rule, never from a previous Task's half-edit.
  useEffect(() => {
    setSeries(null);
    setSeriesError(null);
    setRuleDraft(null);
    setApplyTo("series");
    if (seriesId === null) return;

    let cancelled = false;
    getSeries(seriesId)
      .then((loaded) => {
        if (cancelled) return;
        setSeries(loaded);
        setRuleDraft(seriesRuleDraftFromSeries(loaded));
      })
      .catch(() => {
        // Not swallowed: the sheet shows this in place of the rule controls, and
        // the rest of the sheet keeps working on the occurrence itself.
        if (!cancelled) setSeriesError("Não foi possível carregar a repetição desta tarefa.");
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, seriesId]);

  return {
    series,
    seriesError,
    ruleDraft,
    changeRuleDraft: (changes) =>
      setRuleDraft((current) => (current === null ? current : { ...current, ...changes })),
    applyTo,
    setApplyTo,
    acceptSeries: (next) => {
      setSeries(next);
      setRuleDraft(seriesRuleDraftFromSeries(next));
    },
  };
}
