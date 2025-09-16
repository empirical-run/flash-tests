
import { test, expect } from "./fixtures";

test("has title", async ({ page }) => {
  console.log("Testing Playwright title verification - PR status tracking test");
  await page.goto("https://playwright.dev/");
  await expect(page).toHaveTitle(/Playwright/);
});
