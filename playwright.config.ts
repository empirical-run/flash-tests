import { defineConfig, devices } from "@playwright/test";
import { baseConfig } from "@empiricalrun/playwright-utils";

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
