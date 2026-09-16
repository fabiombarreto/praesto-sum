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

  it("names a development build instead of showing a stamp it does not have", () => {
    expect(formatAppVersion("dev")).toBe("versão de desenvolvimento");
  });

  it("says the version is unknown rather than rendering an empty label", () => {
    expect(formatAppVersion("")).toBe("versão desconhecida");
    expect(formatAppVersion("   ")).toBe("versão desconhecida");
  });

  it("survives a stamp the build could not resolve", () => {
    // `git rev-parse` fails in a tarball checkout with no .git directory, and
    // the config falls back to null rather than breaking the build.
    expect(formatAppVersion(null)).toBe("versão desconhecida");
  });

  it("trims the stamp without otherwise rewriting it", () => {
    expect(formatAppVersion("  2026-09-16 · 85f109b\n")).toBe("versão 2026-09-16 · 85f109b");
  });
});
