import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
<<<<<<< HEAD
  test("collapse sidebar and expand it using expand button", async ({ page }) => {
=======
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
>>>>>>> origin/main
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Collapse the sidebar
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    
<<<<<<< HEAD
    // Click on the Expand sidebar button to expand the sidebar again
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    
    // Verify that the sidebar is expanded by checking if the Collapse sidebar button is visible again
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
=======
    // Click on the expand sidebar button to expand the sidebar again
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    
    // Verify that the sidebar is expanded by checking if settings link is visible
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    
    // Click on Settings to expand sub-menu and verify General link appears
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('link', { name: 'General' })).toBeVisible();
>>>>>>> origin/main
  });
});