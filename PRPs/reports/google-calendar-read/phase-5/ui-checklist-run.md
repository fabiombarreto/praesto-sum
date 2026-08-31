# UI/UX review checklist — unit 4, phase 5 "Consent, made visible"

Run 2026-08-30 against `documentation/40-engineering/ui-ux-guidelines.md` §"Review checklist".
Surface under review: the new `/settings` route (`SettingsScreen`, `GoogleConnectionCard`), the new
settings entry point in `TodayHeader`, and the navigation seam (`useRoute`, `app-route`).

Single-assertion items; ✔/✘ with one line per ✘. **Two ✘ were real defects; both are fixed below.**

## Tier A — every interface change

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ one primary per state — *Conectar* when disconnected, *Salvar* when connected; disconnect is a `ghost`, retry a `secondary`. The screen carries one card, per the plan's `## NOT Building` |
| 2 | Every tappable control ≥ 48 × 48 px and ≥ 8 px from neighbours | ✔ *by class contract, not by DevTools measurement* — `Button` is `min-h-12` with the icon variant at `size-12` (48 px); calendar rows are `<label class="min-h-12 …px-4">`; list gap is `gap-2` (8 px). See "Not verifiable without the owner's token" |
| 3 | No meaning carried by colour alone | ✔ every error is `role="alert"` plus words; `ConfirmView` keeps the destructive button a neutral `secondary` with an icon, never `text-overdue`/`bg-live` |
| 4 | Copy pt-BR, sentence case, infinitive buttons, "você", `Intl`, zero special-cased | ✔ *Conectar*, *Salvar*, *Cancelar*, *Desconectar*, *Tentar de novo*; "Conecte sua conta…", "Você vai precisar…"; no dates or numbers on this screen |
| 5 | Tab / Enter / Esc work, focus visible, focus returns to the opener | **✘ → fixed.** `Esc` did nothing. Plan Task 5 argued "Android back and `Esc` must also return, which they do because Task 3 pushed a real history entry" — that reasoning is wrong: a history entry gives the back gesture, not `Esc`. `SettingsScreen` is a route shell, not a `<dialog>`, so no native `Esc` applies, and the only `Escape` handler in `src/app/` was the unrelated one in `InlineTitle.tsx`. Fixed by a `keydown` listener on the screen calling `back()`. AC-A6 names `Esc` explicitly, so this was an unmet acceptance criterion, not a nicety |
| 6 | Icon-only controls have `aria-label`; inputs have visible labels; `lang` and `<title>` right | ✔ all three icon buttons labelled (*Voltar*, *Configurações*, and the pre-existing filter button); each calendar checkbox sits inside its own `<label>`; `document.title` set to "Configurações · Praesto Sum" on mount |
| 7 | Tokens only (or the pre-token inline scale, §3.5); durations from the bands; reduced motion | ✔ no hex, no `rgb()`, no raw px beyond `size-[22px]` (§3.5 inline scale) and `max-w-[640px]`, which is byte-identical to the shipped *Hoje* shell (`TodayScreen.tsx:579`) rather than a new value. No new animation |
| 8 | Destructive actions follow §8 | ✔ disconnect opens `ConfirmView` — *Desconectar do Google?* repeating the verb, *Cancelar* focused by default, destructive second and neutral-coloured |
| 9 | No request to another origin | ✔ every request goes through `request<T>()` against same-origin `/api/*`. The two Google URLs are an OAuth consent navigation and an `<a href>` to the account permissions page — user-initiated navigations, not page requests |

## Tier B — once per shipped screen

| # | Item | Result |
|---|---|---|
| 10 | Contrast measured for the five pairs of §4.3 and recorded | ✘ **not done** — needs the rendered authenticated screen. See below |
| 11 | The §8 states the screen can reach were simulated and read right | ◐ partial — all four connection kinds (`loading`/`disconnected`/`connected`/`failed`) plus the offline banner, empty-draft, save-error and disconnect-error branches are present and were read in source; **not simulated live** |
| 12 | Checked at 375 px and 1280 px; safe areas, keyboard overlap, `overscroll-behavior`; back gesture | **✘ → fixed (back gesture); viewport checks open.** The back-gesture half found the phase's most serious defect — see "Defect 2" below. `overscroll-contain` is present on the scrolling region. The 375/1280 and safe-area checks need the authenticated screen |
| 13 | `vite build` size report read against §11 | ✔ first-load JS **97.56 KB gzip** ≤ 170; CSS **6.14 KB gzip** ≤ 30; fonts **2 WOFF2, 68.4 KB together** ≤ 100 (`inter-latin-var` 48256 B + `unbounded-latin-800` 21828 B). Lighthouse not run (needs the authenticated screen) |
| 14 | Screenshots filed under `PRPs/reports/<activity>/` — or the reason written down | ✘ **none filed.** Reason recorded here: the screen sits behind the API-token gate, and the token is a credential the assistant does not enter into a form. Screenshots belong to the owner's device pass |

## The two defects this run found

**Defect 1 — `Esc` did not leave the screen (item 5).** Described in the item 5 row above.
Fixed in `src/app/components/SettingsScreen.tsx` (a `keydown` effect calling `back()`).

**Defect 2 — the back affordance pushed instead of popping, trapping the owner (item 12, AC-A6).**
`goBack()` called `navigate("today")`, and `navigate` is `history.pushState`. So leaving `/settings`
by the arrow left the stack at `[/, /settings, /]`: the next back gesture from *Hoje* returned to
`/settings` instead of leaving the app — precisely what AC-A6 forbids ("pressing back again from
*Hoje* leaves the app rather than being trapped"), and the exact behaviour CON-007's device pass
exists to catch. Demonstrated empirically in the browser rather than argued: replaying the old call
sequence with history-state markers, the back gesture after the arrow landed on the `settings`
marker; replaying the fixed sequence, it lands on `origin` at `/`.

Fixed by adding `back()` to `useRoute`, which **pops** the entry `navigate` pushed. It falls back to
`replaceState` when the app did not push the current entry — a real and frequent path, because the
OAuth callback (Task 9) redirects *straight into* `/settings`, where `history.back()` would walk out
of the app into the consent flow.

Both fixes were re-formatted, re-type-checked and re-tested: `npm run check` exit 0,
`npm test` 584 passing / 0 failing.

## Not verifiable without the owner's token — carried into the device pass

Items 10, 14, the viewport half of 12, and the live half of 11 all need the screen rendered past the
API-token gate. Entering an API token into a form is outside what the assistant does, so these are
**not silently marked done** — they are handed to the CON-007 device verification the phase requires
anyway (Android + Windows), where the owner is already logged in. The device pass should therefore
cover, in addition to its own two behaviours:

- contrast for the five §4.3 pairs on the settings card (item 10);
- 375 px and 1280 px, safe areas and keyboard overlap (item 12);
- offline / throttled / empty / failed-request simulation on the card (item 11);
- screenshots filed under `PRPs/reports/google-calendar-read/phase-5/` (item 14).

## One risk recorded, not a checklist failure

`GoogleConnectionCard` re-declares the three failure strings (`FAILED_COPY`) rather than importing
them, because `TodayScreen`'s `AGENDA` constant is module-local and unexported — the same constraint
the plan already recorded for `AgendaState`. The strings are **byte-identical today**, so AC-A7 holds
where it is enforced (the words the owner reads), but the coupling is hand-kept and will drift the
first time one side is edited alone. Extracting the three strings into a shared module is the obvious
follow-up; it is out of this phase's `## Files to Change` and is left as a recorded risk rather than
an unreviewed edit.

---

## Follow-up run — 2026-08-30, the shared-copy extraction

The risk recorded directly above is **closed**. The three failure strings were extracted to
`src/app/google-connection-copy.ts` (`GOOGLE_FAILURE_COPY`), imported by both `TodayScreen.tsx` and
`GoogleConnectionCard.tsx`; `FAILED_COPY` and `AGENDA`'s three failure keys are deleted. `AGENDA`
keeps `name`, `empty` and `partial(n)` — the strings only *Hoje* says.

Checklist re-run because the change touches `src/app/` (`docs/context/ui-guidelines.md`: not waived,
"a single-component CSS tweak still runs the checklist").

**The rendered surface does not change, and that is verifiable rather than asserted:**

- the three literals are **byte-identical** to what shipped — `cmp` of the extracted lines against
  the same lines in the *staged* blobs of both components (`git show :<path>`) reports no difference;
- the selection logic is untouched: both call sites keep the same ternary over the same
  `not_connected` / `invalid_grant` / else reasons, with only the constant's name rewritten;
- no JSX, class string, DOM node or `aria-*` attribute is touched in either file.

### Tier A

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ unchanged — no control added or removed |
| 2 | Targets ≥ 48 × 48 px, ≥ 8 px apart | ✔ unchanged — no class string touched |
| 3 | No meaning carried by colour alone | ✔ unchanged — the notices are still words under `role="alert"` |
| 4 | Copy pt-BR, sentence case, infinitive buttons, "você", `Intl`, zero special-cased | ✔ **the point of the change** — same three pt-BR strings, now from one module, byte-verified above. This is the item the extraction protects: it can no longer be true on one screen and false on the other |
| 5 | Tab / Enter / Esc, focus visible, focus returns | ✔ unchanged — no focus or key handling touched |
| 6 | `aria-label` on icon-only controls, visible input labels, `lang`, `<title>` | ✔ unchanged |
| 7 | Tokens only; durations from the bands; reduced motion | ✔ unchanged — no style, no animation |
| 8 | Destructive actions follow §8 | ✔ unchanged — `ConfirmView` untouched |
| 9 | No request to another origin | ✔ unchanged — no request code touched |

### Tier B

Not re-triggered: no new screen, no token change, no rendered difference. Item 13 was cheap and was
run anyway — **first-load JS 97.62 KB gzip** (≤ 170) and **CSS 6.14 KB gzip** (≤ 30), both inside
§11. JS moved **+0.06 KB** from the phase-5 run's 97.56 KB: deduplicating the source literals does
not shrink the bundle, because the shared module survives as its own object rather than being
inlined twice. Recorded as measured, not as an improvement.

Items 10, 11, 12 and 14 remain owed to the owner's CON-007 device pass exactly as listed above — this
change neither adds to that debt nor discharges any of it.

### Gates

`npm run check` clean (wrangler types, `tsc -b`, ESLint, Prettier). `npm test` **584 passed / 33
files** — identical to the baseline measured before the change.

### Rule amended

Guidelines §12.3 had two homes for a pt-BR literal (the component; `src/shared/*` when the module
there produces the wording) and no answer for copy two screens must say identically — which is why
the phase-5 implementer duplicated rather than shared. It now names a third: a small app-layer copy
module both screens import. Amended in place with a History row, per the maintenance map; the same
sentence updated in `engineering-conventions.md` and the derived `docs/context/conventions.md`.

---

## Third run — 2026-08-30, the shared reason→copy mapping

The follow-up above shared the *words*. This one shares the **branch that picks among them**, which
is the half AC-A7 actually turns on. `src/app/google-connection-copy.ts` is gone; both the three
strings and the mapping now live in `src/shared/google-failure-copy.ts` as
`googleFailureMessage(reason: string | null): string`, called by `TodayScreen`'s `agendaNotice` and
by `GoogleConnectionCard`'s `failedMessage`. Both call sites collapse from a nested ternary to one
call.

### Why `src/shared`, against the previous run's own rule

The 2026-08-30 amendment to guidelines §12.3 sent shared copy to the app layer. That was right for
strings and wrong the moment a *function* selects among them, for two reasons:

- `docs/context/methodology.md:48` names **"the error mapping"** as precisely the decidable part to
  extract into `src/shared`, citing `src/shared/request-failure.ts` — which `googleFailureMessage`
  mirrors exactly: a failure signal in, a pt-BR message out.
- `src/app` is not in `tsconfig.test.json`'s project (`test`, `src/worker`, `src/shared` only), so a
  helper left there is unreachable from every test tier. The rule as first written would have
  produced a unit that could not be tested at all — the opposite of the point.

§12.3 has been corrected to split on whether anything *chooses* the string, with a History row
recording that the third case was fixed the same day it was written.

### The vocabulary check the task asked for — the two reasons are the same, verified

Before merging the branches, both `reason` values were traced to their producer:

| | `TodayScreen` | `GoogleConnectionCard` |
|---|---|---|
| Reads | `eventsState.reason` | `state.reason` (reducer, `src/shared/google-settings.ts:77`) |
| Set from | `cause instanceof ApiError ? cause.reason : null` | the same expression |
| Endpoint | `GET /api/google/events` | `GET /api/google/calendars` |
| Reason produced by | `accessTokenFor` (`src/worker/routes/google.ts:159-181`) | the same function |
| Parsed by | `request<T>()` → `ApiError.reason` (`src/app/api.ts:92`) | the same parser |

**One producer, one parser** — the vocabulary is identical by construction, not by convention, so the
merge is sound rather than forced.

One asymmetry is worth recording even though it does not block the merge: `GET /connection` never
emits a reason — no credential answers `200 {connection: null}`, which the card models as its own
`loaded-disconnected` state, not as `failed`. So on the card `not_connected` is reachable only by a
race (`/connection` sees a row, `/calendars` does not, because a disconnect landed between the two
requests), while on *Hoje* it is the routine never-connected case. Same reason, same meaning, very
different frequency. The card's branch is defensive, and correctly so.

### Tier A

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ unchanged — no control added or removed |
| 2 | Targets ≥ 48 × 48 px, ≥ 8 px apart | ✔ unchanged — no class string touched |
| 3 | No meaning carried by colour alone | ✔ unchanged — still words under `role="alert"` |
| 4 | Copy pt-BR, sentence case, infinitive buttons, "você", `Intl`, zero special-cased | ✔ same three pt-BR strings, byte-identical, now reachable only through one function — and, for the first time, **pinned by a test** (`test/google-failure-copy.test.ts`) rather than by eye |
| 5 | Tab / Enter / Esc, focus visible, focus returns | ✔ unchanged |
| 6 | `aria-label`, visible labels, `lang`, `<title>` | ✔ unchanged |
| 7 | Tokens only; durations from the bands; reduced motion | ✔ unchanged — no style, no animation |
| 8 | Destructive actions follow §8 | ✔ unchanged — `ConfirmView` untouched |
| 9 | No request to another origin | ✔ unchanged |

### Tier B

Not re-triggered — no rendered difference. Item 13 run anyway: **first-load JS 97.55 KB gzip**
(≤ 170), **CSS 6.14 KB** (≤ 30). JS is now **0.01 KB below** the phase-5 figure of 97.56 and 0.07 KB
below the strings-only run's 97.62: collapsing two nested ternaries into one call more than repaid
the shared module. Items 10, 11, 12 and 14 remain owed to the owner's CON-007 device pass, unchanged
by this work.

### Gates

`npm run check` clean. `npm test` **598 passed / 34 files** — the 584-test baseline held, plus the 14
new tests in `test/google-failure-copy.test.ts`.

The new suite was verified to fail for the right reason before being trusted: swapping which reason
returns which string turns it red on two independent assertions — the wording pin, and the
"three conditions, three distinct messages" partition check that is AC-A7 stated as an executable
invariant. What it cannot reach is the rendering — that both components call it and put the result on
screen — because `src/app` is outside the test project and there is no browser tier. That half stays
manual and is what the Tier A table above covers.
