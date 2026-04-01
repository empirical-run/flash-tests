import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Click the three-dot menu button next to the user email at the bottom of the sidebar
    // It is the sibling button right after the email button's wrapper div
    await page.getByRole('button', { name: 'automation-test@example.com' }).locator('xpath=../../button').click();

    // Collapse the sidebar
    await page.getByRole('menuitem', { name: 'Collapse sidebar' }).click();
    
    // Click the More/three-dot button again (now in collapsed sidebar state)
    await page.getByRole('button', { name: 'More' }).click();

    // Expand the sidebar
    await page.getByRole('menuitem', { name: 'Expand sidebar' }).click();
    
    // Verify that the sidebar is expanded by checking if settings link is visible
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    
    // Click on Settings to navigate
    await page.getByRole('link', { name: 'Settings' }).click();
    
    // Verify Settings page loaded with General sub-link visible
    await expect(page.getByRole('link', { name: 'General' })).toBeVisible();
  });
});
