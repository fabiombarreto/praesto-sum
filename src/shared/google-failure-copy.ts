/**
 * The one mapping from a Google failure `reason` to the words the owner reads.
 *
 * `TodayScreen`'s agenda notice and `GoogleConnectionCard`'s status line
 * describe the SAME three conditions, and phase 5's AC-A7 requires they "name
 * the condition with the same words and offer the same next step — one
 * condition, one vocabulary". Both halves of that were duplicated: first the
 * three strings (extracted 2026-08-30), then the branch that picks among them,
 * which is what this module finally makes single-source. Either duplicate left
 * the agreement a coincidence the next edit could end, with nothing to catch
 * the drift.
 *
 * It lives in `src/shared` rather than the app layer because it is decidable
 * logic, not loose copy. `docs/context/methodology.md` names "the error
 * mapping" as exactly the part to extract here, citing `request-failure.ts` —
 * which this module deliberately mirrors: a failure signal in, a pt-BR message
 * out, literals inline. The app layer is not in `tsconfig.test.json`'s project
 * at all, so a mapping kept there could only ever be verified by eye. UI/UX
 * guidelines §12.3 reaches the same place by its older clause: wording a module
 * PRODUCES lives here and is pinned by that module's test.
 *
 * Like every module in `src/shared`, this compiles into both the browser and
 * the Worker targets, so it stays environment-agnostic: no DOM globals, no
 * runtime dependencies.
 *
 * `reason` is deliberately `string | null` and not a union. It arrives from the
 * wire (`ApiError.reason`, parsed in `src/app/api.ts`), and the server can name
 * a failure this screen has never heard of — `not_configured`, `network`,
 * `http_500`, `malformed_response`. Every one of those is transient or not the
 * owner's to fix, so they share the third message. Narrowing the parameter
 * would only move that decision somewhere less honest.
 *
 * Every string is an owner approval (2026-08-28), not an invention; the wording
 * is pinned by `test/google-failure-copy.test.ts` (ADR-0009).
 */
export function googleFailureMessage(reason: string | null): string {
  switch (reason) {
    // No credential is stored. Routine on *Hoje*, where it is simply the state
    // before the owner ever connects.
    case "not_connected":
      return "Google não conectado.";
    // A credential existed and Google refused it — only the owner can fix that,
    // and reconnecting is how.
    case "invalid_grant":
      return "A conexão com o Google expirou. Reconecte para ver a agenda.";
    // Everything else: nothing for the owner to do right now.
    default:
      return "Não foi possível carregar a agenda agora. Tente novamente mais tarde.";
  }
}
