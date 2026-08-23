# Records of the A5 design pass (`ui-design-pass`)

One directory per phase, plus the feature-level `run.json`, `test-review.json`,
`docs-update.md` and `docs-review.jsonl` that always hold the **latest** phase's
state (each phase also keeps its own byte-identical copy under `phase-N/`).

| File | What it is |
|---|---|
| `phase-N/build-report.md` | The phase record: gates, `vite build` size table, §11 budget probe, structural gate, and the browser-pane Tier A / Tier B check the main session ran |
| `phase-N/test-suite.diff` | The test pair's manifest for that phase (AC outcomes, lifecycle ledger, why the suite was legitimately RED, or why no test file was required) |
| `phase-N/run.json`, `phase-N/test-review.json` | The suite run and the post-green review of that phase |
| `phase-N/attempts/<i>/diff.implementer.patch` | **The implementer's own delta for that attempt** — the audit artefact that matters, because git cannot reconstruct a mid-attempt slice |
| `phase-N/attempts/<i>/record.json`, `pre-state.txt` | The attempt's verdict and validation, and the staged snapshot taken immediately before the implementer ran (the R-X provenance) |
| `phase-4/level-a-walk.md` | The WCAG 2.2 Level A walk: 31 criteria × 3 screens, with evidence |
| `phase-4/owner-runbook.md` | The only pt-BR file here — the owner's deploy and two-device checklist |

## The cumulative `diff.patch` files are deliberately not committed

Each attempt also produced `attempts/<i>/diff.patch`: the **whole branch vs the
base commit**, which the code-reviewer used as its `diff_target`. Those are not
in git, for two reasons: they are exactly reproducible from the history, and
they nest (phase 4's contained five earlier ones, 15 MB for this feature alone).

To regenerate the one a review cites:

```bash
git diff 0c306f153853b38e0bbb62114d38731d966ebd59..<the commit that landed the phase> > diff.patch
```

`.gitignore` carries the rule so a future run does not re-add them.
