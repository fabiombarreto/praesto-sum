/**
 * The *Áreas* screen's copy and failure mapping (life-areas PRD AC-19, plan
 * AC-A2, AC-A3, AC-A5, AC-A6): every string a function chooses, kept here so it
 * is tested in Portuguese (ADR-0009, guidelines §12.3) instead of re-typed in
 * the component.
 *
 * Counts are always a count and never a ratio, and zero is special-cased
 * because CLDR puts zero in the singular (guidelines §9.4), as in
 * `adherence-view.ts`. Like `request-failure.ts` it duck-types a numeric
 * `status` rather than importing `ApiError`, which `src/shared` cannot see.
 * Compiled into every target: no DOM globals and no Worker globals. It imports
 * only its siblings `./life-areas`, `./life-areas-list` (a type) and
 * `./request-failure`.
 */

import { LIFE_AREA_LIMIT, LIFE_AREA_NAME_MAX } from "./life-areas";
import type { LifeAreaNameProblem } from "./life-areas-list";
import { classifyRequestFailure } from "./request-failure";

/** The read-only count row for open Tasks that carry no area (D-O). */
export const NO_AREA_LABEL = "Sem área";

/** `<n> tarefas abertas`, with zero and one special-cased — a count, never a ratio. */
export function formatOpenTaskCount(count: number): string {
  if (count === 0) return "Nenhuma tarefa aberta";
  if (count === 1) return "1 tarefa aberta";
  return `${count} tarefas abertas`;
}

/** The empty state's title and the one cue that invites the first area (plan AC-A6). */
export const LIFE_AREAS_EMPTY_TITLE = "Nenhuma área ainda.";
export const LIFE_AREAS_EMPTY_BODY = "Crie a primeira, como Casa ou Saúde, e agrupe suas tarefas.";

/** Replaces the add form once the owner holds the most areas he may (plan AC-A3). */
export const LIFE_AREA_LIMIT_NOTICE = `Você já tem ${LIFE_AREA_LIMIT} áreas. Exclua uma para criar outra.`;

const NONE_DELETED = "Nenhuma é excluída.";
const NOT_UNDOABLE = "Não dá para desfazer.";
const LIST_REFRESHED = "A lista foi atualizada.";

/** The confirmation's question: the verb repeated, the name in curved quotes (plan AC-A5). */
export function formatLifeAreaDeleteTitle(name: string): string {
  return `Excluir a área “${name}”?`;
}

/**
 * Says how many Tarefas and séries lose the area, that none is deleted, and
 * that it cannot be undone (plan AC-A5, PRD D-J). The counts are the area's own
 * `taskCount` (Tasks of every status) and `seriesCount`.
 */
export function formatLifeAreaDeleteBody(counts: {
  taskCount: number;
  seriesCount: number;
}): string {
  const { taskCount, seriesCount } = counts;
  if (taskCount === 0 && seriesCount === 0) {
    return `Nenhuma tarefa ou série tem esta área. ${NOT_UNDOABLE}`;
  }
  const subjects: string[] = [];
  if (taskCount > 0) subjects.push(taskCount === 1 ? "1 tarefa" : `${taskCount} tarefas`);
  if (seriesCount > 0) subjects.push(seriesCount === 1 ? "1 série" : `${seriesCount} séries`);
  const verb = taskCount + seriesCount === 1 ? "fica" : "ficam";
  return `${subjects.join(" e ")} ${verb} sem área. ${NONE_DELETED} ${NOT_UNDOABLE}`;
}

/** The announcement after a delete succeeds (plan AC-A5). */
export function formatLifeAreaDeletedNotice(name: string): string {
  return `Área “${name}” excluída.`;
}

/**
 * The field message for a name the screen refused before sending (plan AC-A3,
 * AC-A4): what happened, then what to do, never blaming the owner.
 */
export function lifeAreaNameProblemMessage(problem: LifeAreaNameProblem): string {
  switch (problem) {
    case "blank":
      return "O nome está em branco. Escreva um nome para a área.";
    case "too_long":
      return `O nome passa de ${LIFE_AREA_NAME_MAX} caracteres. Use um nome mais curto.`;
    case "duplicate":
      return "Já existe uma área com esse nome. Escolha outro nome.";
  }
}

/** The numeric `status` of a caught cause, duck-typed exactly as `classifyRequestFailure` does. */
function statusOf(cause: unknown): number | null {
  if (typeof cause !== "object" || cause === null || !("status" in cause)) return null;
  const { status } = cause as { status: unknown };
  return typeof status === "number" ? status : null;
}

/**
 * Maps a failed create, rename or delete to a fixed pt-BR sentence and says
 * whether the list on screen can no longer be trusted (plan AC-A6). The
 * server's own error text carries a field marker meant for tools, so it is
 * never shown. 404 and 409 mean another device changed the areas first, hence
 * `staleList`: the screen shows the message and refetches. A 401 never reaches
 * this function — the screen routes it to the token gate first.
 */
export function lifeAreaWriteFailure(cause: unknown): { message: string; staleList: boolean } {
  switch (statusOf(cause)) {
    case 400:
      return {
        message: "O nome não foi aceito. Confira o nome e tente de novo.",
        staleList: false,
      };
    case 404:
      return { message: `Essa área não existe mais. ${LIST_REFRESHED}`, staleList: true };
    case 409:
      return {
        message: `Esse nome já existe ou o limite de ${LIFE_AREA_LIMIT} áreas foi atingido. ${LIST_REFRESHED}`,
        staleList: true,
      };
    default:
      return { message: classifyRequestFailure(cause).message, staleList: false };
  }
}
