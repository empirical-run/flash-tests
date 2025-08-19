
import { test, expect } from "./fixtures";

test("has title", async ({ page }) => {
  await page.goto("https://playwright.dev/");
  await expect(page).toHaveTitle(/Playwright/);
});

test('investigate str_replace tool execution', async ({ page }) => {
  await page.goto('/');
  // TODO(agent on page): Create new session, send message asking to modify a file with str_replace, check what actually happens and what tools are executed
});
