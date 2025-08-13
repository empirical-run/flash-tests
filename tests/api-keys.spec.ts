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
    // This should fail if the UI is truncating spaces
    
    // First, find any row that contains our API key (to make sure it was created)
    const apiKeyRow = page.getByRole('row').filter({ hasText: 'Foo bar' }); // The UI shows "Foo bar"
    await expect(apiKeyRow).toBeVisible();
    
    // Now do exact text match - this will fail if spaces are truncated
    const nameCell = apiKeyRow.locator('td').first(); // Assuming name is in first column
    const actualText = await nameCell.textContent();
    
    // Debug: log what we actually got
    console.log('Expected:', JSON.stringify(apiKeyName));
    console.log('Actual:', JSON.stringify(actualText?.trim()));
    
    // This assertion should fail because actualText will be "Foo bar" but we expect "Foo    bar"
    expect(actualText?.trim()).toBe(apiKeyName); // This will fail: "Foo bar" !== "Foo    bar"
  });
});