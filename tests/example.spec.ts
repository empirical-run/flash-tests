
// This test verifies that the Playwright homepage title contains "Playwright".

import { test, expect } from "./fixtures";

test("has title", async ({ page }) => {
  await page.goto("https://playwright.dev/");
  await expect(page).toHaveTitle(/Playwright/);
});
