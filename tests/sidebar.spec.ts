import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking settings gear icon", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Collapse the sidebar
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    
    // TODO(agent on page): Click on the settings gear icon to expand the sidebar again
    
    // Verify that the sidebar is expanded by checking if settings navigation is visible
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});