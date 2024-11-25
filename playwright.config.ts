import { defineConfig, devices } from "@playwright/test";
import { baseConfig } from "@empiricalrun/playwright-utils";

export default defineConfig({
  ...baseConfig,
  workers: 2,
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
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "safari",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
