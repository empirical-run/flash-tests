import { test, expect } from "./fixtures";

test.describe("Environment Variables Cleanup", () => {
  test("delete all TEST_VAR_* environment variables", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > Environment variables (standalone page)
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environment variables' }).click();

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

    // Navigate to Settings > Environment variables (new dedicated page)
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environment variables' }).click();

    // Filter by name to find PROD_VAR_* variables
    await page.getByPlaceholder('Filter by name...').fill('PROD_VAR_');

    // Delete all PROD_VAR_* rows in a loop
    let deletedCount = 0;
    let continueDeleting = true;

    while (continueDeleting) {
      const rows = page.getByRole('row').filter({ hasText: 'PROD_VAR_' });
      const rowCount = await rows.count();

      if (rowCount === 0) {
        continueDeleting = false;
      } else {
        // Click delete (last action button) on the first matching row
        await rows.first().getByRole('button').last().click();

        // Confirm deletion
        await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();

        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`Removed ${deletedCount} PROD_VAR_* variables from production environment`);
    } else {
      console.log("No PROD_VAR_* variables found in production environment");
    }
  });
});