// The build stamp is injected by `vite.config.ts` as `__APP_VERSION__` and read
// once, at the edge of the app, in `SettingsScreen`. Everything decidable about
// it — what a missing, empty or development stamp reads as on screen — lives in
// `src/shared/app-version.ts` so it can be asserted here rather than only by
// looking at the running app (docs/context/methodology.md, "Browser-API work":
// the exemption is for glue, never for logic).

import { describe, expect, it } from "vitest";
import { formatAppVersion } from "../src/shared/app-version";

describe("formatAppVersion", () => {
  it("labels a real build stamp with its date and commit", () => {
    expect(formatAppVersion("2026-09-16 · 85f109b")).toBe("versão 2026-09-16 · 85f109b");
  });

  it("keeps the date and commit on a development build, marking it as one", () => {
    // The owner asked for this on 2026-09-16: a development build used to read
    // "versão de desenvolvimento" and nothing else, which hides the very number
    // the line exists to show.
    expect(formatAppVersion("2026-09-16 · 85f109b · dev")).toBe(
      "versão 2026-09-16 · 85f109b (desenvolvimento)",
    );
  });

  it("marks a development build that has no commit to show", () => {
    // Inside the dev container `git` cannot reach the repository: the worktree's
    // `.git` is a file pointing outside the bind mount. The date still shows.
    expect(formatAppVersion("2026-09-16 · dev")).toBe("versão 2026-09-16 (desenvolvimento)");
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
    expect(formatAppVersion("  2026-09-16 · 85f109b\n")).toBe("versão 2026-09-16 · 85f109b");
  });
});
