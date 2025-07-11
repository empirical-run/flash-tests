import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('link', { name: 'Settings' }).click();

    // Assert that repository exists message is visible
    await expect(page.getByText("Repository exists on GitHub")).toBeVisible();
  });
});