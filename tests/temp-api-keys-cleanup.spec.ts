import { test, expect } from "./fixtures";

test.describe("TEMP: API Keys Cleanup", () => {
  test("cleanup accumulated test API keys", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section via Settings menu
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Wait for the page to load and show the API keys table
    // First wait for the table or at least one row to appear
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Wait a bit more for the data to load
    await page.waitForTimeout(2000);
    
    // Check if there are any rows in the table body (excluding header)
    const tableBody = page.locator('tbody');
    const allRowsInTable = tableBody.locator('tr');
    const totalRowCount = await allRowsInTable.count();
    
    console.log(`Total API keys found in table: ${totalRowCount}`);
    
    if (totalRowCount === 0) {
      console.log('No API keys found in the table. Table might be empty.');
      return;
    }
    
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
    
    // First, let's see what API keys are actually present
    console.log('\n=== Current API keys in table ===');
    for (let i = 0; i < totalRowCount; i++) {
      const row = allRowsInTable.nth(i);
      const rowText = await row.textContent();
      console.log(`Row ${i + 1}: ${rowText}`);
    }
    console.log('=== End of current API keys ===\n');
    
    for (const pattern of allPatterns) {
      console.log(`Looking for API keys starting with: "${pattern}"`);
      
      // Refresh the row count since rows get removed after deletion
      const currentRows = tableBody.locator('tr');
      const currentCount = await currentRows.count();
      
      const matchingRows = [];
      
      // Check each row to see if it contains the pattern
      for (let i = 0; i < currentCount; i++) {
        const row = currentRows.nth(i);
        const rowText = await row.textContent();
        if (rowText && rowText.includes(pattern)) {
          matchingRows.push({ row, text: rowText });
        }
      }
      
      if (matchingRows.length > 0) {
        console.log(`Found ${matchingRows.length} API keys matching pattern: "${pattern}"`);
        
        // Delete each matching API key
        for (const { row, text } of matchingRows) {
          try {
            // Extract the API key name (usually the first column)
            const keyNameElement = await row.locator('td').first().textContent();
            const keyName = keyNameElement?.trim() || 'unknown';
            
            console.log(`Deleting API key: "${keyName}"`);
            
            // Click the delete button (last button in the row)
            await row.getByRole('button').last().click();
            
            // Wait for the confirmation dialog
            await page.waitForTimeout(1000);
            
            // Fill in the confirmation field with the exact key name
            const confirmationField = page.locator(`input[placeholder*="${keyName}"]`);
            await confirmationField.fill(keyName);
            
            // Click Delete Permanently
            await page.getByRole('button', { name: 'Delete Permanently' }).click();
            
            // Wait for deletion to complete
            await page.waitForTimeout(2000);
            
            // Verify the key is removed
            await expect(page.locator('tbody').getByText(keyName, { exact: true })).not.toBeVisible();
            
            deletedCount++;
            console.log(`✅ Successfully deleted: "${keyName}"`);
            
            // Break after deleting one key with this pattern to avoid stale element references
            break;
            
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