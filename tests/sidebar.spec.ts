import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it using expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Collapse the sidebar
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    
    // Click on the Expand sidebar button to expand the sidebar again
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    
    // Verify that the sidebar is expanded by checking if the Collapse sidebar button is visible again
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });
});