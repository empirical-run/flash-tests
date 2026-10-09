import { defineConfig } from "@playwright/test";
import { baseConfig } from "@empiricalrun/playwright-utils";

// Helper-only controls: no browser, authentication or live application requests.
export default defineConfig({
  ...baseConfig,
  testDir: "./controls",
  timeout: 20_000,
  retries: 0,
  projects: [{ name: "snooze-cleanup-controls" }],
});
