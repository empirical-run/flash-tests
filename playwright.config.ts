
import { defineConfig, devices } from "@playwright/test";
import { baseConfig, chromeStablePath } from "@empiricalrun/playwright-utils";
import * as dotenv from "dotenv";

const envSlug = process.env.ENV_SLUG?.toLowerCase();
dotenv.config({ path: envSlug ? `.env.${envSlug}` : ".env" });

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
      testIgnore: ['**/mobile/**', '**/onboarding/**', '**/tool-execution/**'],
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
      testDir: './tests/onboarding',
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
      name: "link-preview",
      use: { 
        ...devices["Desktop Chrome"],
        // No storageState - fresh browser context without authentication
        // No user context or storage state
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
      },
      testDir: './tests/link-preview',
    },
  ],
});
