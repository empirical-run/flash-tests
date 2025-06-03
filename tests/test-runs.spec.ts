import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // TODO(agent on page): Navigate to test runs page and trigger test run, then verify submit button is not disabled
  });
});