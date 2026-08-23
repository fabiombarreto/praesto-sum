/**
 * Classifier for a caught request failure, turning it into one of two
 * discriminated, stable, honest messages instead of a raw, browser-specific
 * error string.
 *
 * Like `src/shared/api.ts` and `src/shared/share-target.ts`, this module is
 * compiled into BOTH the browser and the Worker projects, so it must stay
 * environment-agnostic and free of runtime dependencies and DOM globals (no
 * `window`, no `document`). It duck-types `ApiError`'s shape
 * (`src/app/api.ts:25-33`) rather than importing the class, because
 * `src/shared/` cannot import from `src/app/` (`tsconfig.test.json`'s test
 * project `include`s `test`, `src/worker` and `src/shared`, but not
 * `src/app`) and `src/shared` also compiles into the Worker target, where no
 * `ApiError` class exists at all.
 *
 * Per MDN, `fetch()` only rejects on a genuine network failure (no
 * `Response` was ever received), never on an HTTP error status — so the
 * presence of a numeric `status` field is exactly the structural signal that
 * separates a received HTTP-level error from an unreachable server. Only
 * `typeof cause.status === "number"` counts; a `status` field of any other
 * type (e.g. a string) does not classify as an http-error.
 *
 * The two messages are pt-BR since the ui-design-pass phase 1 pass
 * (ADR-0009): the owner reads them, so they are written in his language, and
 * their exact wording is pinned by test/request-failure.test.ts.
 */

/** Result of classifying a caught request failure. */
export interface RequestFailure {
  kind: "server-unreachable" | "http-error";
  message: string;
}

/**
 * Classifies any caught request-failure `cause` into a stable, honest
 * message for the owner. Never throws, regardless of what `cause` is —
 * `null`, `undefined` and primitive causes are all handled safely.
 */
export function classifyRequestFailure(cause: unknown): RequestFailure {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    typeof (cause as { status: unknown }).status === "number"
  ) {
    const status = (cause as { status: number }).status;
    return {
      kind: "http-error",
      message: `O servidor recusou a operação (código ${status}). Tente de novo.`,
    };
  }

  return {
    kind: "server-unreachable",
    message: "Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.",
  };
}
