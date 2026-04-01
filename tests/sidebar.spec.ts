import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Click the three-dot menu button at the bottom of the sidebar (next to user email)
    // The button is a sibling of the user email button's wrapper div
    await page.getByRole('button', { name: 'automation-test@example.com' }).locator('xpath=../../button').click();

    // Collapse the sidebar
    await page.getByRole('menuitem', { name: 'Collapse sidebar' }).click();

    // In collapsed state the user button is labelled 'Toggle user menu' — click three-dot again
    await page.getByRole('button', { name: 'Toggle user menu' }).locator('xpath=../../button').click();

    // Expand the sidebar
    await page.getByRole('menuitem', { name: 'Expand sidebar' }).click();
    
    // Verify that the sidebar is expanded by checking Settings link is visible
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    
    // Click on Settings to navigate
    await page.getByRole('link', { name: 'Settings' }).click();
    
    // Verify Settings page loaded with General sub-link visible
    await expect(page.getByRole('link', { name: 'General' })).toBeVisible();
  });
});
