import { defineConfig, devices } from "@playwright/test";
import { baseConfig } from "@empiricalrun/playwright-utils";

export default defineConfig({
  ...baseConfig,
  workers: 2,
  use: {
    ...baseConfig.use,
    baseURL: process.env.BUILD_URL || "https://dash.empirical.run",
    extraHTTPHeaders: {
      // https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation#using-protection-bypass-for-automation
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      "x-vercel-set-bypass-cookie": "true",
    },
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
