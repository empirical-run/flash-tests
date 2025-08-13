import { test, expect } from "./fixtures";

test.describe("API Keys", () => {
  let createdApiKeys: string[] = [];

  test.afterEach(async ({ page }) => {
    // Clean up any API keys created during the test
    for (const apiKeyName of createdApiKeys) {
      try {
        // Navigate to API keys page if not already there
        if (!page.url().includes('/api-keys')) {
          await page.goto("/");
          await page.getByRole('link', { name: 'API Keys' }).click();
        }

        // Find and delete the API key
        const apiKeyRow = page.getByRole('row').filter({ hasText: apiKeyName });
        if (await apiKeyRow.isVisible()) {
          await apiKeyRow.getByRole('button').last().click();
          
          // Confirm the deletion
          const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
          await confirmationField.fill(apiKeyName);
          await page.getByRole('button', { name: 'Delete Permanently' }).click();
          
          // Wait for deletion to complete
          await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
        }
      } catch (error) {
        console.log(`Failed to clean up API key "${apiKeyName}":`, error);
      }
    }
    // Reset the array for next test
    createdApiKeys = [];
  });

  test("create new api key and make API request", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name
    const apiKeyName = `Test-API-Key-${Date.now()}`;
    createdApiKeys.push(apiKeyName);
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Copy the API key to clipboard
    await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Get the API key from clipboard
    const apiKey = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    
    // Verify we got a valid API key
    expect(apiKey).toBeTruthy();
    expect(typeof apiKey).toBe('string');
    expect(apiKey.length).toBeGreaterThan(0);
    
    // Make an API request using the new API key
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
    const response = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Assert that the response is ok
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test("create API key with spaces in name and validate UI display", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name with spaces (like 'Foo    bar')
    const apiKeyName = 'Foo    bar';
    createdApiKeys.push(apiKeyName);
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Copy the API key to clipboard (to complete the creation process)
    await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Validate that the API key name appears with EXACT match using regex
    // Use regex to match exactly 4 spaces between "Foo" and "bar"
    const exactSpacesRegex = /Foo\s{4}bar/; // Matches "Foo" + exactly 4 spaces + "bar"
    const singleSpaceRegex = /Foo\s{1}bar/; // Matches "Foo" + exactly 1 space + "bar"
    
    // Check if we can find a row that matches the exact 4-space pattern
    const exactRegexRow = page.getByRole('row').locator('td').first().filter({ hasText: exactSpacesRegex });
    const isExactRegexVisible = await exactRegexRow.isVisible();
    
    // Check if we can find a row that matches the single-space pattern  
    const singleRegexRow = page.getByRole('row').locator('td').first().filter({ hasText: singleSpaceRegex });
    const isSingleRegexVisible = await singleRegexRow.isVisible();
    
    console.log('Can find with exact 4-space regex:', isExactRegexVisible);
    console.log('Can find with single-space regex:', isSingleRegexVisible);
    
    // Get the actual text content for debugging
    const nameCell = page.getByRole('row').filter({ hasText: 'Foo' }).locator('td').first();
    const actualText = await nameCell.textContent();
    console.log('Actual cell text:', JSON.stringify(actualText));
    
    // This assertion should fail if the UI collapses multiple spaces to single spaces
    // We expect to find the 4-space version, not the single-space version
    expect(isExactRegexVisible).toBe(true);
    expect(isSingleRegexVisible).toBe(false); // This should fail if spaces are collapsed
  });
});