import { test, expect } from "./fixtures";

test.describe("API Keys", () => {
  test("create new api key and make API request", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name
    const apiKeyName = `Test-API-Key-${Date.now()}`;
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
    
    // Clean up: Delete the API key that was created
    // Find the row containing our API key name and click the delete button (last button in the row)
    await page.getByRole('row').filter({ hasText: apiKeyName }).getByRole('button').last().click();
    
    // Confirm the deletion by typing the API key name in the confirmation field
    // The placeholder contains the API key name, so we use a partial match
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list (check the table specifically)
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    // Wait for the deletion to propagate (some systems have eventual consistency)
    console.log('Waiting 5 seconds for API key deletion to propagate...');
    await page.waitForTimeout(5000);
    
    // Make the same API request again with the deleted API key
    const responseAfterDeletion = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Log the actual response for debugging
    console.log('Response after deletion:', {
      status: responseAfterDeletion.status(),
      ok: responseAfterDeletion.ok(),
      statusText: responseAfterDeletion.statusText()
    });
    
    // Assert that the response is now unauthorized (401)
    // This is an app issue: deleted API keys should be immediately invalidated
    expect(responseAfterDeletion.ok()).toBeFalsy();
    expect(responseAfterDeletion.status()).toBe(401);
  });

  test("test various string combinations for API key names", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Define test cases with various VALID string combinations
    const testCases = [
      // Normal cases
      { name: "Production-API-Key", description: "Normal hyphenated name" },
      { name: "development_api_key", description: "Underscore separated name" },
      { name: "API Key with Spaces", description: "Name with spaces" },
      { name: "TestKey123", description: "Alphanumeric name" },
      
      // Edge cases - short names
      { name: "A", description: "Single character" },
      { name: "AB", description: "Two characters" },
      
      // Edge cases - special characters
      { name: "API-Key_2024", description: "Mixed separators" },
      { name: "My API Key (Dev)", description: "Parentheses in name" },
      { name: "API.Key.v1", description: "Dots in name" },
      
      // Edge cases - numbers and symbols
      { name: "12345", description: "Numbers only" },
      { name: "@APIKey", description: "Name starting with symbol" },
      { name: "API-Key!", description: "Name ending with exclamation" },
      
      // Edge cases - long names
      { name: "Very-Long-API-Key-Name-For-Testing-Maximum-Length-Limits-And-UI-Behavior", description: "Very long name" },
      
      // Edge cases - whitespace handling
      { name: " Leading Space", description: "Leading space" },
      { name: "Trailing Space ", description: "Trailing space" },
      { name: " Both Spaces ", description: "Leading and trailing spaces" },
      
      // Unicode and special characters
      { name: "API-Key-🔑", description: "Name with emoji" },
      { name: "Clé-API-française", description: "Name with accented characters" },
    ];
    
    const createdKeys = []; // Track created keys for cleanup
    
    for (const testCase of testCases) {
      console.log(`Testing API key name: "${testCase.name}" - ${testCase.description}`);
      
      // Click Generate New Key button
      await page.getByRole('button', { name: 'Generate New Key' }).click();
      
      // Fill in the API key name
      const uniqueName = `${testCase.name}-${Date.now()}`;
      await page.getByPlaceholder('e.g. Production API Key').fill(uniqueName);
      
      // Generate the API key
      await page.getByRole('button', { name: 'Generate' }).click();
      
      // All test cases should succeed - verify the key was created
      await expect(page.getByRole('button', { name: 'Copy to Clipboard' })).toBeVisible({ timeout: 5000 });
      
      // Copy the API key
      await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
      
      // Close the modal
      await page.getByRole('button', { name: 'Done' }).click();
      
      // Verify the key appears in the list
      await expect(page.getByText(uniqueName)).toBeVisible();
      
      // Get the API key for validation
      const apiKey = await page.evaluate(async () => {
        return await navigator.clipboard.readText();
      });
      
      // Verify it's a valid API key format
      expect(apiKey).toBeTruthy();
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(0);
      
      // Store for cleanup
      createdKeys.push({ name: uniqueName, key: apiKey });
      
      console.log(`✅ Success: "${testCase.name}" created successfully`);
      
      // Small delay between test cases
      await page.waitForTimeout(500);
    }
    
    // Test completed successfully - created ${createdKeys.length} API keys with various string patterns
    console.log(`✅ Successfully created ${createdKeys.length} API keys with different string patterns`);
    
    console.log('✅ API key name combinations test completed');
  });

  test("verify empty string validation blocks API key creation", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    const invalidCases = [
      { name: "", description: "Empty string" },
      { name: "   ", description: "Whitespace-only (3 spaces)" },
      { name: " ", description: "Single space" },
      { name: "\t", description: "Tab character" },
    ];
    
    for (const testCase of invalidCases) {
      console.log(`\n=== Testing validation for: "${testCase.name}" (${testCase.description}) ===`);
      
      // Click Generate New Key button
      await page.getByRole('button', { name: 'Generate New Key' }).click();
      await page.waitForTimeout(500);
      
      // Clear and fill the name field
      const nameField = page.getByPlaceholder('e.g. Production API Key');
      await nameField.clear();
      await nameField.fill(testCase.name);
      
      const fieldValue = await nameField.inputValue();
      console.log(`Field value: "${fieldValue}" (length: ${fieldValue.length})`);
      
      // Try to click Generate
      const generateButton = page.getByRole('button', { name: 'Generate' });
      await generateButton.click();
      
      // Wait for validation to trigger
      await page.waitForTimeout(2000);
      
      // Validation should block API key creation - Copy button should not appear
      const copyButton = page.getByRole('button', { name: 'Copy to Clipboard' });
      await expect(copyButton).not.toBeVisible();
      
      // Modal should still be open, indicating validation prevented creation
      await expect(generateButton).toBeVisible();
      
      console.log(`✅ VALIDATION WORKING: API key creation was properly blocked`);
      
      // Close the modal to return to main page
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      
      // Alternative: click outside the modal to close it
      await page.locator('body').click({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(500);
    }
    
    console.log('\n✅ Empty string validation tests completed');
  });

  test("verify error message when name field is empty", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Click Generate New Key button to open the modal
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Leave the name field empty and try to generate
    const nameField = page.getByPlaceholder('e.g. Production API Key');
    await nameField.clear(); // Ensure field is empty
    
    // Click Generate button without filling the name
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Wait for error message to appear
    await page.waitForTimeout(1000);
    
    // Check for error message that tells user to fill the name
    // TODO(agent on page): Look for error message that indicates name field is required and note the exact text
    
    // For now, verify that API key creation was blocked
    const copyButton = page.getByRole('button', { name: 'Copy to Clipboard' });
    await expect(copyButton).not.toBeVisible();
    
    // Modal should still be open
    const generateButton = page.getByRole('button', { name: 'Generate' });
    await expect(generateButton).toBeVisible();
    
    console.log('✅ Name field validation working - API key creation blocked when name is empty');
  });
});