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

  test("sync playwright config shows projects and persists after reload", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Navigate to settings > general
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Click on sync config
    await page.getByRole('button', { name: 'Sync Config' }).click();

    // Assert that 2 projects are visible (can take 45 seconds)
    await expect(page.getByText("setup")).toBeVisible({ timeout: 45000 });
    await expect(page.getByText("chromium")).toBeVisible({ timeout: 45000 });

    // Reload the page
    await page.reload();

    // Assert that the projects should still be visible (this will currently fail)
    await expect(page.getByText("setup")).toBeVisible();
    await expect(page.getByText("chromium")).toBeVisible();
  });
});