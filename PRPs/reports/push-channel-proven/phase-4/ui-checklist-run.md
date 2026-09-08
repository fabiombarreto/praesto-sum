# UI/UX guidelines checklist — unit 6 phase 4 `notifications-settings`

Run 2026-09-07 against the live dev server for `feature/push-channel-proven`
(`npm --prefix .worktrees/push-channel-proven run dev`, port 5175), reading the
rendered, authenticated DOM. Chore **C17** is what makes this possible: with the
`TokenGate` removed in local dev, an automated pass reaches a real screen.

The plan recorded this checklist as a manual closing step. It was run rather than
filed, because chore **C15** has carried four owed checklist items since unit 4
precisely because a deferral without a mechanism is indistinguishable from a
skipped step.

## ✔ Passing

| Item | Evidence |
|---|---|
| §4.3 contrast — ink on surface-1 | **15.65:1** |
| §4.3 contrast — muted on surface-1 | **6.74:1** |
| §4.3 contrast — accent on surface-1 | **8.57:1** |
| §4.3 contrast — ink on bg | **16.82:1** |
| §4.3 contrast — muted on bg | **7.24:1** |
| All five pairs clear WCAG AA (4.5:1 normal, 3:1 large), and match the numbers chore C15 recorded for the settings card — the identity is applied consistently, not re-derived |
| §12 viewport 375 px | No horizontal overflow (`scrollWidth === innerWidth === 375`); the *Notificações* entry card renders "Notificações bloqueadas." + *Abrir* |
| §12 viewport 1280 px | No horizontal overflow; card sits in the settings column with the two existing cards |
| §9 copy language | Visible copy pt-BR throughout (*Notificações*, *Ver diagnóstico*, *Ativar notificações*, *Notificações bloqueadas neste navegador.*); identifiers and comments English (ADR-0009) |
| Identity | Renders in the Arcade palette with the shared card shape; no ad-hoc colour outside `src/app/tokens.css` |
| §3 routes not sheets | `/settings/notifications` and `/settings/notifications/diagnostics` are real routes with history entries |
| Screenshot filed | `settings-375.png` (a first attempt timed out — the pane composites no frames while hidden, the same limitation the roadmap cites for rejecting a browser test tier; it succeeded on retry) |

## ✘ Failing at first run — one defect, since FIXED and re-verified

**§8 "Loading a screen" and PRD AC-9, on `/settings/notifications`.**

The card renders a loading skeleton **indefinitely** (`aria-busy="true"`,
`aria-label="Carregando"`) and shows nothing else.

Root cause, confirmed in the page: there are zero service-worker registrations
and `navigator.serviceWorker.ready` never resolves (it lost a 3-second race).
`NotificationsCard`'s `load()` awaits `getCurrentDeviceEndpoint()` — which awaits
that promise — before dispatching any state, so the reducer never leaves
`loading`.

Three separate problems follow:

1. **The permission state is gated behind an unrelated await.** `Notification.permission`
   is synchronous. When it is `denied` there is no subscription to look up, yet
   AC-9's "bloqueadas" state — the one that screen exists to show — is the one
   that cannot render. The sibling entry card on `/settings` gets this right,
   which is what isolated the cause.
2. **A hang has no escape.** `navigator.serviceWorker.ready` never rejects, so
   there is no error path at all, against §8's rule that a failed request is
   shown inline and never left as a silent wait.
3. **§8's ~10-second rule is not honoured** — the skeleton never adds the
   "Ainda carregando…" line.

In production the service worker does register, so the common path works. The
failure mode is still real (registration slow or failing, service workers
disabled) and the §8 violations hold regardless.

## Not covered here — the owner's

- **PRD AC-10 device pass**: the phone rings with the app closed and tapping the
  notification opens Praesto on the payload's route. No tier automates this; the
  roadmap's browser-tier rejection records why.
- **Aesthetic judgement** — whether the screen *feels* right on the phone.

## Re-run after the fix (2026-09-07)

The defect above was fixed test-first. A new pure orchestrator
`src/shared/notifications-load.ts` (`loadNotificationsSettings`) dispatches the
permission state **before any await**, never consults the subscription port for
`denied`/`default`, still awaits and reflects it for `granted` so the
enabled/subscribed distinction stays correct, and routes a rejecting port through
the existing `toggle-failed` rather than a parallel event. `NotificationsCard`
keeps only the browser-API glue. Section 8's ~10-second "Ainda carregando..."
line was added in the same pass.

The contract was pinned by `test/notifications-load.test.ts` before any
production code existed, using a subscription port that **never settles** - an
assertion no type-level change can satisfy. Three earlier attempts at this test
were rejected, each for a different and correct reason: absent coverage, a
duplicate event, and an assertion that pinned the type rather than the await
ordering.

**Re-verified in the browser under the exact failing conditions** - zero
service-worker registrations, `Notification.permission === "denied"`:

| Before | After |
|---|---|
| `aria-busy="true"`, `aria-label="Carregando"`, indefinitely | no `aria-busy`, no skeleton |
| card region empty apart from *Ver diagnostico* | "Notificacoes bloqueadas neste navegador." + the way back |

That is AC-9's blocked state with the way back, rendering. Section 8's loading
item now passes; the checklist has no failing item left.

Suite 814/814 across 57 files, `npm run check` clean.
