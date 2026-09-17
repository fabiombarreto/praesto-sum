// The build stamp is injected by `vite.config.ts` as `__APP_VERSION__` and read
// once, at the edge of the app, in `SettingsScreen`. Everything decidable about
// it — how a released, development, partial or missing stamp reads on screen —
// lives in `src/shared/app-version.ts` so it can be asserted here rather than
// only by looking at the running app (docs/context/methodology.md,
// "Browser-API work": the exemption is for glue, never for logic).
//
// The stamp's shape is `<version> · <commit>`, with ` · dev` appended under
// `vite dev`. The version comes from `package.json`, and the `v<version>` git
// tag is what makes it answerable later — `scripts/check-version-tag.mjs`
// refuses a deploy whose commit carries no matching tag.

import { describe, expect, it } from "vitest";
import { formatAppVersion } from "../src/shared/app-version";

describe("formatAppVersion", () => {
  it("labels a released build with its version and commit", () => {
    expect(formatAppVersion("0.8.0 · 3ba3413")).toBe("versão 0.8.0 · 3ba3413");
  });

  it("keeps the version and commit on a development build, marking it as one", () => {
    // The owner asked for this on 2026-09-16: a development build used to read
    // "versão de desenvolvimento" and nothing else, which hides the very number
    // the line exists to show.
    expect(formatAppVersion("0.8.0 · 3ba3413 · dev")).toBe(
      "versão 0.8.0 · 3ba3413 (desenvolvimento)",
    );
  });

  it("marks a development build that has no commit to show", () => {
    // Inside the dev container `git` cannot reach the repository: the worktree's
    // `.git` is a file pointing outside the bind mount. The version still shows.
    expect(formatAppVersion("0.8.0 · dev")).toBe("versão 0.8.0 (desenvolvimento)");
  });

  it("shows a commit alone when package.json could not be read", () => {
    expect(formatAppVersion("3ba3413")).toBe("versão 3ba3413");
    expect(formatAppVersion("3ba3413 · dev")).toBe("versão 3ba3413 (desenvolvimento)");
  });

  it("still understands a bare development stamp", () => {
    expect(formatAppVersion("dev")).toBe("versão de desenvolvimento");
  });

  it("says the version is unknown rather than rendering an empty label", () => {
    expect(formatAppVersion("")).toBe("versão desconhecida");
    expect(formatAppVersion("   ")).toBe("versão desconhecida");
  });

  it("survives a stamp the build could not resolve", () => {
    expect(formatAppVersion(null)).toBe("versão desconhecida");
  });

  it("trims the stamp without otherwise rewriting it", () => {
    expect(formatAppVersion("  0.8.0 · 3ba3413\n")).toBe("versão 0.8.0 · 3ba3413");
  });
});
