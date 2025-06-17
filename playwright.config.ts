
import { defineConfig, devices } from "@playwright/test";
import { baseConfig, chromeStablePath } from "@empiricalrun/playwright-utils";

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: process.env.BUILD_URL || "https://dash.empirical.run",
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      "x-vercel-set-bypass-cookie": "true",
    },
    permissions: ['clipboard-read', 'clipboard-write'],
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
      testIgnore: ['**/mobile/**', '**/onboarding.spec.ts', '**/tool-execution/**'],
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
    {
      name: "onboarding",
      use: {
        ...devices["Desktop Chrome"],
        // No storageState - fresh browser context without authentication
        launchOptions: {
          executablePath: chromeStablePath(),
          headless: false,
          args: [
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
      testIgnore: ["**/mobile/**", "**/*.setup.ts", "**/tool-execution/**"],
      testMatch: "**/onboarding.spec.ts",
    },
    {
      name: "tool-execution",
      use: { 
        ...devices["Desktop Chrome"],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testDir: './tests/tool-execution',
    },
    {
      name: "external-apps",
      use: {
        ...devices["Desktop Chrome"],
        // No storageState - fresh browser context without authentication
      },
      testMatch: "**/v0-button-test.spec.ts",
    },
  ],
});
