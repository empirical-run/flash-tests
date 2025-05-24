import { defineConfig, devices } from "@playwright/test";
import { baseConfig } from "@empiricalrun/playwright-utils";

export default defineConfig({
  ...baseConfig,
  workers: 2,
  use: {
    ...baseConfig.use,
    baseURL: process.env.BUILD_URL || "https://dash.empirical.run",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-web-security",
            "--disable-site-isolation-trials", // Required to bypass strict site isolation
            "--disable-features=IsolateOrigins,site-per-process", // Complements the above
          ],
        },
        viewport: {
          width: 1366,
          height: 768,
        },
      },
      teardown: "teardown",
    },
    {
      name: "teardown",
      testMatch: /teardown\.ts/,
    },
  ],
});
