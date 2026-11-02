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
];
