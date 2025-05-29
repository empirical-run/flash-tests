
import { defineConfig, devices } from "@playwright/test";
import { baseConfig } from "@empiricalrun/playwright-utils";

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: process.env.BUILD_URL || "https://dash.empirical.run",
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      "x-vercel-set-bypass-cookie": "true",
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: "mobile-web",
      use: {
        ...devices["iPhone 13"],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testDir: './tests/mobile',
    },
  ],
});
