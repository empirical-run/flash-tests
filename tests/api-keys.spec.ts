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
    
    // Validate that the API key name appears with EXACT match in the UI
    // The issue: UI visually collapses spaces but stores them correctly in text content
    
    // First, try to find a row with the exact text including multiple spaces
    const exactMatchRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(exactMatchRow).toBeVisible();
    
    // Now check if we can also find it with collapsed spaces (single space)
    const collapsedSpaceText = 'Foo bar'; // Single space version
    const collapsedMatchRow = page.getByRole('row').filter({ hasText: collapsedSpaceText });
    const isCollapsedVisible = await collapsedMatchRow.isVisible();
    
    console.log('Can find with exact spaces:', await exactMatchRow.isVisible());
    console.log('Can find with single space:', isCollapsedVisible);
    
    // This assertion should fail if the UI is properly preserving space formatting
    // We expect that if we create "Foo    bar", we should NOT be able to find it with "Foo bar"
    expect(isCollapsedVisible).toBe(false); // This will fail if spaces are visually collapsed
  });
});