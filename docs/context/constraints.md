# Constraints

> Derived from `documentation/20-requirements/constraints.md` and `quality-attributes.md` (authoritative, owner-validated 2026-08-03). Update both together.

## Hard constraints (CON)

| ID | Constraint | Consequence |
|---|---|---|
| CON-001 | Windows 11 is the dev environment | Everything must be first-class on Windows (keep MS VC++ Redistributable current for workerd) |
| CON-002 | Exactly one developer (the owner) | No tech whose learning curve or ops load exceeds one person |
| CON-003 | Time budget: ~1 hour/day (declared 2026-08-03) | Slice plans and phases to fit ~7 h/week of solo work |
| CON-004 | Money: effectively ~zero | Owner declined hardware and VPS; free plan is the baseline; recurring cost needs an ADR |
| CON-005 | Data under owner control | Provider-readable D1 accepted by explicit revocable consent (ADR-0003) ONLY with the local-snapshot safeguards |
| CON-006 | No operational babysitting | Nothing that needs patching, renewal rituals, or a server to nurse |

## Quality attribute scenarios (every decision is tested against these)

- **QA-001** — 100% of data exportable to open formats; no third party reads without revocable consent.
- **QA-002** — works after 4 untouched weeks; resume in ≤ 1 action.
- **QA-003** — zero recurring cost baseline; exceptions need an ADR with the amount.
- **QA-004** — clean machine → running dev env in ≤ 1 hour; a small change shippable alone after months away.

## Platform limits (accepted, ADR-0003/0005)

- Cloudflare free plan: 100k requests/day, 5 cron triggers, D1 free storage — orders of magnitude above one person's scale.
- Offline = read-only at best (PWA shell cache). Nothing can be captured without connectivity — accepted; revisit trigger declared in ADR-0003.
- Web Push: the owner's phone is **Android**, where Chrome delivers push without the PWA being installed — installing only buys the home-screen icon and the standalone window. ADR-0004's "iOS requires home-screen install and is less dependable" consequence was written assuming an iPhone and does not apply to the owner's device; its iOS-unreliability revisit trigger is moot in practice. Fallback channels remain allowed without a new ADR.

## What NOT to do

See `docs/anti-patterns.md` — notably: no offline write queue, no live-DB file sync, no SSR/meta-framework, no version ranges, no hand-duplicated entity types.
