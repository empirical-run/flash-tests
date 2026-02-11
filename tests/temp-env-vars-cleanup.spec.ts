import { test, expect } from "./fixtures";

test.describe("Environment Variables Cleanup", () => {
  test("delete all TEST_VAR_* environment variables", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > Environments
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();

    // Scroll down to the Environment Variables section
    const envVarsSection = page.getByRole('heading', { name: 'Environment Variables' });
    await envVarsSection.scrollIntoViewIfNeeded();

    // Find all TEST_VAR_* environment variables and delete them
    let continueDeleting = true;
    let deletedCount = 0;
    while (continueDeleting) {
      // Get all rows in the page
      const allRows = page.getByRole('row');
      
      // Find rows that contain TEST_VAR_ and also have a delete button
      let foundTestVar = false;
      const rowCount = await allRows.count();
      
      for (let i = 0; i < rowCount; i++) {
        const row = allRows.nth(i);
        const rowText = await row.textContent();
        
        // Check if this row contains TEST_VAR_
        if (rowText && rowText.match(/TEST_VAR_\d+/)) {
          // Check if this row has a delete button (environment variable rows have two action buttons)
          const buttons = row.getByRole('button');
          const buttonCount = await buttons.count();
          
          // Environment variable rows have exactly 2 buttons (reveal and delete)
          if (buttonCount === 2) {
            foundTestVar = true;
            await expect(row).toBeVisible();
            
            // Click the delete button (last button in the row)
            await buttons.last().click();
            
            // Wait for the confirmation dialog to appear
            await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
            
            // Confirm the deletion by clicking the confirmation button
            await page.getByRole('button', { name: 'Delete' }).click();
            
            // Wait for the confirmation dialog to disappear
            await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();
            
            // Wait a moment for the UI to update
            await page.waitForTimeout(500);
            
            deletedCount++;
            break;
          }
        }
      }
      
      if (!foundTestVar) {
        continueDeleting = false;
      }
    }

    console.log(`Finished deleting ${deletedCount} TEST_VAR_* environment variables`);
  });

  test("delete all PROD_VAR_* from production environment", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > Environments
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();

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