import { test, expect } from "./fixtures";

test.describe("Settings", () => {
  test("open settings and assert that repo exists is shown", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();

    // Assert that repository-related text is visible in settings
    // Common variations could be "repo exists", "Repository exists", "Connected repository", etc.
    await expect(page.getByText(/repo.*exists/i)).toBeVisible();
  });
});