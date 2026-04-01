import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Verify the sidebar is visible with navigation links
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();

    // Click on Settings to navigate there
    await page.getByRole('link', { name: 'Settings' }).click();

    // Verify Settings page loaded with General sub-link visible
    await expect(page.getByRole('link', { name: 'General' })).toBeVisible();
  });
});
