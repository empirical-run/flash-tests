import { test, expect } from "./fixtures";

test.describe("Environment Variables Cleanup", () => {
  test("delete all TEST_VAR_* environment variables", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Find all TEST_VAR_* environment variables and delete them
    let continueDeleting = true;
    while (continueDeleting) {
      // Look for any environment variable that starts with TEST_VAR_
      const testVarRows = page.getByRole('row').filter({ hasText: /TEST_VAR_\d+/ });
      const count = await testVarRows.count();
      
      if (count === 0) {
        continueDeleting = false;
        break;
      }

      // Delete the first TEST_VAR_ found
      const firstTestVar = testVarRows.first();
      await expect(firstTestVar).toBeVisible();
      
      // Click the delete button (last button in the row)
      await firstTestVar.getByRole('button').last().click();
      
      // Wait for the confirmation dialog to appear
      await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
      
      // Confirm the deletion by clicking the confirmation button
      await page.getByRole('button', { name: 'Delete' }).click();
      
      // Wait for the confirmation dialog to disappear
      await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();
      
      // Wait a moment for the UI to update
      await page.waitForTimeout(500);
    }

    console.log("Finished deleting all TEST_VAR_* environment variables");
  });
});