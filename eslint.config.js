// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "dist/**",
    "coverage/**",
    "node_modules/**",
    ".wrangler/**",
    "migrations/**",
    "worker-configuration.d.ts",
    // Agent worktrees are full copies of this repository living INSIDE it.
    // Without this, `npm run check` lints the duplicate tree and fails with
    // "multiple candidate TSConfigRootDirs" for every file in it — the gate
    // breaks for as long as any worktree exists, which is exactly when the
    // developer least wants a false alarm.
    ".claude/**",
    ".worktrees/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    // Syntax-only rules: no `projectService`, so no slow program construction.
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        // disallowTypeAnnotations MUST stay false: `import("cloudflare:test").D1Migration[]`
        // is the shape wrangler and the Cloudflare fixtures generate.
        { prefer: "type-imports", fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
    },
  },
  { files: ["src/app/**/*.{ts,tsx}", "src/sw.ts"], languageOptions: { globals: globals.browser } },
  {
    files: ["*.{js,ts}", "scripts/**/*.{js,ts}"],
    languageOptions: { globals: globals.nodeBuiltin },
  },
  // MUST stay last: turns off every rule Prettier owns.
  prettier,
);
