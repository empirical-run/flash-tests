import { test, expect } from "@playwright/test";

test.use({
  extraHTTPHeaders: {
    "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "",
    "x-vercel-set-bypass-cookie": "true",
  },
});

test("debug request preservation issue", async ({ page }) => {
  // Navigate directly to the app
  await page.goto("https://test-generator-dashboard-r1r4ssnf8-empirical.vercel.app");
  
  // TODO(agent on page): Investigate the current state of the app and see if we can reproduce the issue described in the failing test
});