---
status: accepted
last_updated: 2026-10-08
review_trigger: "a recurrence feature needs the occurrence's date to be visible, or reminders on dateless series"
---

# ADR-0014: A Task without a date can repeat — `dateMode: "none"`

> **Purpose:** Record why a recurrence series may carry no deadline and no scheduled date, and what the series does with the day it still needs internally.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-10-08
- **Related:** [ADR-0006](ADR-0006-recurrence-model.md) (the model this extends, not supersedes); `PRPs/prds/recurring-tasks.prd.md` (unit 9); the owner's 2026-09-30 choice to withdraw *Sem data* once a repetition was chosen, which this reverses

## Context

Unit 9 required a date for any repeating Task. The sheet withdrew the *Sem data* chip once a repetition was picked, but a draft already on `none` kept it, so choosing *Repetir → Diariamente → Nunca parar* on a new dateless Task left "Primeira vez em" with nothing selected and a disabled day field. *Salvar* did nothing and showed nothing: the refusal message sat at the end of the repeat block, off screen on a phone. The owner hit exactly this in production on 2026-10-08 and decided the rule was wrong, not the message: "a task with no date must repeat indefinitely; Save creates it without a deadline or scheduled date".

## Decision

A series may have `dateMode: "none"` (`'deadline' | 'scheduled' | 'none'`; `date_mode` has no SQL `CHECK`, so no migration). Its occurrences carry **neither `deadline` nor `scheduled_date`** but still carry `occurrence_date`, because the sweep, the successor spawn, the partial unique indexes and the adherence record all key on it.

- **First occurrence:** the sheet sends `dtstart` = today in the series' time zone; the day is internal, never shown.
- **Sweep and successor:** unchanged. A dateless occurrence left undone is recorded `missed` by the cron the next day, exactly like a dated one; completing it spawns the next day's occurrence, also dateless.
- **Sheet:** *Sem data* stays on offer whatever the repetition; the label reads *Data* (not *Primeira vez em*) while it is chosen.

## Consequences

- A dateless daily Task is a habit with no clock: it shows under *Sem data*, never *Atrasadas*, and its misses are counted in the adherence mirror.
- **Reminders** are relative to a date, so a dateless series carries none (the sheet's carry-over notice already covers a Reminder that cannot be copied).
- Rejected: auto-selecting *Fazer em* with today (it would invent a date the owner did not ask for); keeping the rule and only moving the error next to *Salvar* (it fixes the silence, not the dead end).
