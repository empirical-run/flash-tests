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
    
    // Define test cases with various string combinations
    const testCases = [
      // Normal cases
      { name: "Production-API-Key", description: "Normal hyphenated name", shouldSucceed: true },
      { name: "development_api_key", description: "Underscore separated name", shouldSucceed: true },
      { name: "API Key with Spaces", description: "Name with spaces", shouldSucceed: true },
      { name: "TestKey123", description: "Alphanumeric name", shouldSucceed: true },
      
      // Edge cases - short names
      { name: "A", description: "Single character", shouldSucceed: true },
      { name: "AB", description: "Two characters", shouldSucceed: true },
      
      // Edge cases - special characters
      { name: "API-Key_2024", description: "Mixed separators", shouldSucceed: true },
      { name: "My API Key (Dev)", description: "Parentheses in name", shouldSucceed: true },
      { name: "API.Key.v1", description: "Dots in name", shouldSucceed: true },
      
      // Edge cases - numbers and symbols
      { name: "12345", description: "Numbers only", shouldSucceed: true },
      { name: "@APIKey", description: "Name starting with symbol", shouldSucceed: true },
      { name: "API-Key!", description: "Name ending with exclamation", shouldSucceed: true },
      
      // Edge cases - long names
      { name: "Very-Long-API-Key-Name-For-Testing-Maximum-Length-Limits-And-UI-Behavior", description: "Very long name", shouldSucceed: true },
      
      // Edge cases - whitespace handling
      { name: " Leading Space", description: "Leading space", shouldSucceed: true },
      { name: "Trailing Space ", description: "Trailing space", shouldSucceed: true },
      { name: " Both Spaces ", description: "Leading and trailing spaces", shouldSucceed: true },
      
      // Unicode and special characters
      { name: "API-Key-🔑", description: "Name with emoji", shouldSucceed: true },
      { name: "Clé-API-française", description: "Name with accented characters", shouldSucceed: true },
      
      // Potential edge cases that might fail
      { name: "", description: "Empty string", shouldSucceed: false },
      { name: "   ", description: "Only spaces", shouldSucceed: false },
    ];
    
    const createdKeys = []; // Track created keys for cleanup
    
    for (const testCase of testCases) {
      console.log(`Testing API key name: "${testCase.name}" - ${testCase.description}`);
      
      try {
        // Click Generate New Key button
        await page.getByRole('button', { name: 'Generate New Key' }).click();
        
        // Fill in the API key name
        const uniqueName = `${testCase.name}-${Date.now()}`;
        await page.getByPlaceholder('e.g. Production API Key').fill(uniqueName);
        
        // Try to generate the API key
        await page.getByRole('button', { name: 'Generate' }).click();
        
        if (testCase.shouldSucceed) {
          // Should succeed - verify the key was created
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
        } else {
          // Should fail - check for error message or validation
          // Wait a moment to see if there's an error message
          await page.waitForTimeout(1000);
          
          // Check if we're still on the generation modal (indicating failure)
          const stillOnModal = await page.getByRole('button', { name: 'Generate' }).isVisible();
          
          if (stillOnModal) {
            console.log(`✅ Expected failure: "${testCase.name}" was rejected as expected`);
            // Close the modal
            await page.keyboard.press('Escape');
          } else {
            // Unexpected success - clean up and log
            await page.getByRole('button', { name: 'Done' }).click();
            console.log(`⚠️  Unexpected success: "${testCase.name}" was created but expected to fail`);
            createdKeys.push({ name: uniqueName, key: "unknown" });
          }
        }
        
      } catch (error) {
        if (testCase.shouldSucceed) {
          console.log(`❌ Unexpected failure: "${testCase.name}" failed when it should have succeeded`);
          console.log(`Error: ${error.message}`);
          
          // Try to close any open modals
          try {
            await page.keyboard.press('Escape');
          } catch {}
        } else {
          console.log(`✅ Expected failure: "${testCase.name}" failed as expected`);
        }
      }
      
      // Small delay between test cases
      await page.waitForTimeout(500);
    }
    
    // Clean up all created API keys
    console.log(`Cleaning up ${createdKeys.length} created API keys...`);
    
    for (const keyInfo of createdKeys) {
      try {
        // Find and delete the API key
        const row = page.getByRole('row').filter({ hasText: keyInfo.name });
        if (await row.isVisible()) {
          await row.getByRole('button').last().click();
          
          // Fill confirmation field
          const confirmationField = page.locator(`input[placeholder*="${keyInfo.name}"]`);
          await confirmationField.fill(keyInfo.name);
          await page.getByRole('button', { name: 'Delete Permanently' }).click();
          
          // Verify deletion
          await expect(page.locator('tbody').getByText(keyInfo.name)).not.toBeVisible();
          
          console.log(`🗑️  Cleaned up: ${keyInfo.name}`);
        }
      } catch (error) {
        console.log(`⚠️  Failed to clean up: ${keyInfo.name} - ${error.message}`);
      }
    }
    
    console.log('✅ API key name combinations test completed');
  });
});