import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Collapse and expand the sidebar with the new app-shell trigger.
    await page.locator('button[data-sidebar="trigger"]').click();
    await page.locator('button[data-sidebar="trigger"]').click();
    
    // Verify that the sidebar is expanded by checking Settings link is visible
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    
    // Click on Settings to navigate
    await page.getByRole('link', { name: 'Settings' }).click();
    
    // Verify sidebar is expanded with Repository nav link visible
    await expect(page.getByRole('link', { name: 'Repository', exact: true })).toBeVisible();
  });
});
