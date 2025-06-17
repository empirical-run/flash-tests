import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('link', { name: 'Settings' }).click();

    // TODO(agent on page): Take a screenshot and inspect the settings page content to see what text is actually available
  });
});