import { test, expect } from "./fixtures";

test.describe("Cleanup", () => {
  test("delete all disabled API keys", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Find all rows with disabled API keys
    const rows = await page.locator('tbody tr').all();
    
    for (const row of rows) {
      // Check if this row contains a disabled key by looking for "Disabled" text or disabled state
      const rowText = await row.textContent();
      const isDisabled = rowText?.includes('Disabled') || rowText?.includes('disabled');
      
      if (isDisabled) {
        // Get the API key name from the row
        const keyNameElement = await row.locator('.font-medium').first();
        const keyName = await keyNameElement.textContent();
        
        if (keyName) {
          console.log(`Deleting disabled API key: ${keyName}`);
          
          // Click the delete button (last button in the row)
          await row.getByRole('button').last().click();
          
          // Type the API key name to confirm deletion
          const deleteInput = page.locator('input[placeholder*="Type"]').first();
          await deleteInput.fill(keyName.trim());
          
          // Confirm the deletion
          await page.getByRole('button', { name: 'Delete Permanently' }).click();
          
          // Wait for the deletion to complete
          await expect(page.locator('tbody').getByText(keyName.trim())).not.toBeVisible();
          
          console.log(`Successfully deleted: ${keyName}`);
        }
      }
    }
    
    console.log('Cleanup complete - all disabled API keys have been removed');
  });
});