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
    // Get the actual text content from the name cell
    const nameCell = page.getByRole('row').filter({ hasText: 'Foo' }).locator('td').first();
    const actualText = await nameCell.textContent();
    
    console.log('Actual cell text:', JSON.stringify(actualText));
    
    // Use regex to test the actual text content
    const exactSpacesRegex = /^Foo\s{4}bar$/; // Matches exactly "Foo" + 4 spaces + "bar"
    const singleSpaceRegex = /^Foo\s{1}bar$/; // Matches exactly "Foo" + 1 space + "bar"
    const collapsedSpaceRegex = /^Foo\s+bar$/; // Matches "Foo" + one or more spaces + "bar"
    
    const matchesExact4Spaces = exactSpacesRegex.test(actualText || '');
    const matchesSingle1Space = singleSpaceRegex.test(actualText || '');
    const matchesCollapsed = collapsedSpaceRegex.test(actualText || '');
    
    console.log('Matches exact 4 spaces:', matchesExact4Spaces);
    console.log('Matches single 1 space:', matchesSingle1Space);
    console.log('Matches collapsed (1+ spaces):', matchesCollapsed);
    
    // Count the actual number of spaces between "Foo" and "bar"
    const spaceMatch = actualText?.match(/Foo(\s+)bar/);
    const actualSpaceCount = spaceMatch ? spaceMatch[1].length : 0;
    console.log('Actual space count:', actualSpaceCount);
    
    // Verify the data integrity is maintained (spaces preserved in DOM)
    expect(actualSpaceCount).toBe(4); // Data is correctly preserved
    
    // Now test the visual rendering issue
    // Check if CSS white-space property allows multiple spaces to be visually preserved
    const cellComputedStyle = await nameCell.evaluate((el) => {
      return window.getComputedStyle(el).whiteSpace;
    });
    
    console.log('CSS white-space property:', cellComputedStyle);
    
    // This assertion should fail if the CSS doesn't preserve multiple spaces visually
    // For multiple spaces to show visually, white-space should be 'pre', 'pre-wrap', or 'pre-line'
    const preservesMultipleSpaces = ['pre', 'pre-wrap', 'pre-line'].includes(cellComputedStyle);
    expect(preservesMultipleSpaces).toBe(true); // This will fail if CSS collapses spaces visually
  });
});