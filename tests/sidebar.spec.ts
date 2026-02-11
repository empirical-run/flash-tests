import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Collapse the sidebar
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    
    // Click on the expand sidebar button to expand the sidebar again
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    
    // Verify that the sidebar is expanded by checking if settings navigation and its sub-items are visible
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'General' })).toBeVisible();
  });
});