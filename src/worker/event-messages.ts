import type { DayRangeError } from "../shared/event-range";
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  type EventField,
  type EventValidationError,
} from "../shared/events";

/**
 * The API's pt-BR error text for Events (ADR-0009): the string VALUES are Portuguese,
 * every identifier and comment is English. Each sentence ENDS with the field or query
 * parameter it is about, in parentheses and spelled exactly as the key (`(title)`,
 * `(startAt)`, `(to)`), which is what lets a caller, and the suites, tell which input
 * was refused. Pure text mapping: no framework and no database.
 */

/** Each field as the owner would name it, lower-case with its article, ready to be a sentence's object. */
const FIELD_NOUNS: Record<EventField, string> = {
  title: "o título",
  description: "a descrição",
  location: "o local",
  allDay: "o indicador de dia inteiro",
  startAt: "o início",
  endAt: "o fim",
  startDate: "o dia de início",
  endDate: "o dia de término",
  timezone: "o fuso horário",
};

/** The longest each text field may be, for the `too_long` sentence. */
const FIELD_LIMITS: Partial<Record<EventField, number>> = {
  title: EVENT_TITLE_MAX,
  description: EVENT_DESCRIPTION_MAX,
  location: EVENT_LOCATION_MAX,
};

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The 400 text for a refusal by `validateEventInput`. Every field and code the
 * validator can return has a sentence; a new `EventErrorCode` stops this compiling.
 */
export function eventProblemMessage(error: EventValidationError): string {
  const { field, code } = error;
  const noun = FIELD_NOUNS[field];

  switch (code) {
    case "blank":
      return `${capitalized(noun)} não pode ficar em branco (${field})`;
    case "too_long": {
      const limit = FIELD_LIMITS[field];
      return limit === undefined
        ? `${capitalized(noun)} é longo demais (${field})`
        : `${capitalized(noun)} deve ter no máximo ${limit} caracteres (${field})`;
    }
    case "required":
      return `Informe ${noun} (${field})`;
    case "not_allowed":
      return `${capitalized(noun)} não se aplica a este tipo de compromisso (${field})`;
    case "invalid_date":
      return `${capitalized(noun)} informado não é válido (${field})`;
    case "unknown_zone":
      return `Fuso horário desconhecido (${field})`;
    case "end_before_start":
      return `O fim não pode ser antes do início (${field})`;
    case "end_not_after_start":
      return `O fim deve ser depois do início (${field})`;
    default: {
      const unreachable: never = code;
      throw new Error(`Unhandled event error code: ${String(unreachable)}`);
    }
  }
}

/**
 * The 400 text for a body value of the wrong JSON type, for the route's own typeof
 * checks (which run before the shared validator, because it takes typed input). One
 * sentence per field kind: text, boolean, whole number of seconds, local day.
 */
export function eventTypeMessage(field: EventField): string {
  switch (field) {
    case "title":
      return `Informe um texto válido (${field})`;
    case "description":
    case "location":
      return `Informe um texto válido ou nulo (${field})`;
    case "allDay":
      return `Informe verdadeiro ou falso (${field})`;
    case "startAt":
    case "endAt":
      return `Informe um número inteiro de segundos, ou nulo (${field})`;
    case "startDate":
    case "endDate":
      return `Informe um dia no formato AAAA-MM-DD, ou nulo (${field})`;
    case "timezone":
      return `Informe o nome de um fuso horário como texto (${field})`;
    default: {
      const unreachable: never = field;
      throw new Error(`Unhandled event field: ${String(unreachable)}`);
    }
  }
}

/**
 * The 400 text for a refused `from`/`to` pair, naming the parameter. `too_long`
 * takes no limit on purpose: the events route and the Google route cap the span at
 * different lengths, and the message must stay true for both.
 */
export function dayRangeProblemMessage(error: DayRangeError): string {
  const { param, code } = error;

  switch (code) {
    case "required":
      return param === "from"
        ? `Informe a data inicial (${param})`
        : `Informe a data final (${param})`;
    case "invalid_date":
      return `A data deve estar no formato AAAA-MM-DD (${param})`;
    case "to_before_from":
      return `A data final não pode ser anterior à inicial (${param})`;
    case "too_long":
      return `O período é mais longo do que o permitido (${param})`;
    default: {
      const unreachable: never = code;
      throw new Error(`Unhandled day range error code: ${String(unreachable)}`);
    }
  }
}
