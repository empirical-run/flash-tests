import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Assert that repository exists by checking the repo location and status
    await expect(page.getByText("empirical-run/lorem-ipsum-tests")).toBeVisible();
    await expect(page.getByText("exists")).toBeVisible();
    await expect(page.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
  });

  test("investigate sync config network calls", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // TODO(agent on page): Navigate to settings > general, monitor network traffic, click sync config button, and observe what API calls are made to understand the request pattern and where project_id can be found
  });
});