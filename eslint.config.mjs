import empirical from "@empiricalrun/eslint-config/playwright";

import requireSessionCleanup from "./eslint-rules/require-session-cleanup.mjs";

export default [
  ...empirical,
  {
    files: ["tests/**/*.ts"],
    plugins: {
      flash: { rules: { "require-session-cleanup": requireSessionCleanup } },
    },
    rules: { "flash/require-session-cleanup": "error" },
  },
  // eslint-config 0.8.0 added repo-layout rules. This repo predates that layout
  // (tests/pages/, tests/fixtures.ts, helpers in specs), so they warn until the
  // layout migration lands in its own PR.
  {
    rules: {
      "empirical/repo-layout": "warn",
      "empirical/no-helpers-in-specs": "warn",
      "empirical/no-classes-in-pages": "warn",
    },
  },
];
