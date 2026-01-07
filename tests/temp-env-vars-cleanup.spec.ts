import { test, expect } from "./fixtures";

test.describe("Environment Variables Cleanup", () => {
  test("delete all TEST_VAR_* environment variables", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();

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

  test("delete all PROD_VAR_* from production environment", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > Environments
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Click on the edit icon for Production environment
    await page.getByRole('row').filter({ hasText: 'Production' }).filter({ hasText: 'production' }).getByRole('button').first().click();

    // Wait for the modal to open
    await expect(page.getByText('Edit Environment')).toBeVisible();

    // Click on the "Edit" button in the Environment Variables section
    await page.getByRole('button', { name: 'Edit' }).click();

    // Get the current content of the textarea
    const textarea = page.locator('textarea').first();
    let currentContent = await textarea.inputValue();

    // Remove all lines containing PROD_VAR_
    const lines = currentContent.split('\n');
    const cleanedLines = lines.filter(line => !line.includes('PROD_VAR_'));
    const cleanedContent = cleanedLines.join('\n');

    // Only update if there were PROD_VAR_ entries
    if (cleanedLines.length !== lines.length) {
      await textarea.fill(cleanedContent);
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('button', { name: 'Update' }).click();

      // Wait for the modal to close
      await expect(page.getByText('Edit Environment')).not.toBeVisible();

      console.log(`Removed ${lines.length - cleanedLines.length} PROD_VAR_* variables from production environment`);
    } else {
      // Close the edit mode without saving
      await page.getByRole('button', { name: 'Cancel' }).click();
      // Close the modal
      await page.locator('button[aria-label="Close"]').or(page.getByRole('button', { name: 'Close' })).click();
      console.log("No PROD_VAR_* variables found in production environment");
    }
  });
});