
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
        // Temporarily disable storageState to bypass auth
        // storageState: 'playwright/.auth/user.json',
      },
      // Temporarily disable setup dependency
      // dependencies: ['setup'],
      testIgnore: '**/mobile/**',
    },
    {
      name: "mobile-web",
      use: {
        ...devices["Pixel 7"],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testDir: './tests/mobile',
    },
  ],
});
