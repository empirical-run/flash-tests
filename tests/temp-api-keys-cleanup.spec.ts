import { test, expect } from "./fixtures";

test.describe("TEMP: API Keys Cleanup", () => {
  test("cleanup accumulated test API keys", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Define the test name patterns that were used in the string combinations test
    const testPatterns = [
      "Production-API-Key-",
      "development_api_key-",
      "API Key with Spaces-",
      "TestKey123-",
      "A-",
      "AB-",
      "API-Key_2024-",
      "My API Key (Dev)-",
      "API.Key.v1-",
      "12345-",
      "@APIKey-",
      "API-Key!-",
      "Very-Long-API-Key-Name-For-Testing-Maximum-Length-Limits-And-UI-Behavior-",
      " Leading Space-",
      "Trailing Space -",
      " Both Spaces -",
      "API-Key-🔑-",
      "Clé-API-française-"
    ];
    
    // Also include other test patterns that might be present
    const additionalPatterns = [
      "Test-API-Key-",
      "Test-Status-Key-"
    ];
    
    const allPatterns = [...testPatterns, ...additionalPatterns];
    
    let deletedCount = 0;
    
    for (const pattern of allPatterns) {
      console.log(`Looking for API keys starting with: "${pattern}"`);
      
      // Find all rows that contain this pattern - use simple string matching
      const allRows = page.getByRole('row');
      const rowCount = await allRows.count();
      
      const matchingRows = [];
      
      // Check each row to see if it contains the pattern
      for (let i = 0; i < rowCount; i++) {
        const row = allRows.nth(i);
        const rowText = await row.textContent();
        if (rowText && rowText.includes(pattern)) {
          matchingRows.push(row);
        }
      }
      
      if (matchingRows.length > 0) {
        console.log(`Found ${matchingRows.length} API keys matching pattern: "${pattern}"`);
        
        // Delete each matching API key
        for (const row of matchingRows) {
          try {
            const keyNameElement = await row.locator('td').first().textContent();
            const keyName = keyNameElement?.trim() || 'unknown';
            
            console.log(`Deleting API key: "${keyName}"`);
            
            // Click the delete button (last button in the row)
            await row.getByRole('button').last().click();
            
            // Wait for the confirmation dialog
            await page.waitForTimeout(500);
            
            // Fill in the confirmation field with the exact key name
            const confirmationField = page.locator(`input[placeholder*="${keyName}"]`);
            await confirmationField.fill(keyName);
            
            // Click Delete Permanently
            await page.getByRole('button', { name: 'Delete Permanently' }).click();
            
            // Wait for deletion to complete
            await page.waitForTimeout(1000);
            
            // Verify the key is removed
            await expect(page.locator('tbody').getByText(keyName, { exact: true })).not.toBeVisible();
            
            deletedCount++;
            console.log(`✅ Successfully deleted: "${keyName}"`);
            
          } catch (error) {
            console.log(`❌ Failed to delete API key with pattern "${pattern}":`, error);
          }
        }
      } else {
        console.log(`No API keys found for pattern: "${pattern}"`);
      }
    }
    
    console.log(`\n✅ Cleanup completed. Total API keys deleted: ${deletedCount}`);
  });
});