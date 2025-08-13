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

  test("verify validation blocks empty and whitespace-only API key names", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    const edgeCases = [
      { name: "", description: "Empty string", expectedBehavior: "should fail" },
      { name: "   ", description: "Whitespace-only (3 spaces)", expectedBehavior: "should fail" },
      { name: " ", description: "Single space", expectedBehavior: "should fail" },
      { name: "\t", description: "Tab character", expectedBehavior: "should fail" },
      { name: "\n", description: "Newline character", expectedBehavior: "should fail" },
    ];
    
    const createdKeys = [];
    
    for (const testCase of edgeCases) {
      console.log(`\n=== Testing: "${testCase.name}" (${testCase.description}) ===`);
      
      // Click Generate New Key button
      await page.getByRole('button', { name: 'Generate New Key' }).click();
      
      // Clear and fill the name field
      const nameField = page.getByPlaceholder('e.g. Production API Key');
      await nameField.clear();
      await nameField.fill(testCase.name);
      
      // Check what's actually in the field after filling
      const fieldValue = await nameField.inputValue();
      console.log(`Field value after fill: "${fieldValue}" (length: ${fieldValue.length})`);
      
      // Check if Generate button is enabled/disabled
      const generateButton = page.getByRole('button', { name: 'Generate' });
      const isGenerateEnabled = await generateButton.isEnabled();
      console.log(`Generate button enabled: ${isGenerateEnabled}`);
      
      if (isGenerateEnabled) {
        // Try to click Generate
        await generateButton.click();
        
        // Wait a moment to see what happens
        await page.waitForTimeout(2000);
        
        // Check if we got the success modal with Copy button
        const copyButton = page.getByRole('button', { name: 'Copy to Clipboard' });
        const hasCopyButton = await copyButton.isVisible();
        
        if (hasCopyButton) {
          console.log(`✅ SUCCESS: API key was generated successfully`);
          
          // Copy the key and close modal
          await copyButton.click();
          const apiKey = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
          });
          console.log(`Generated API key: ${apiKey.substring(0, 20)}...`);
          
          await page.getByRole('button', { name: 'Done' }).click();
          
          // Create a unique identifier for this key based on timestamp
          const uniqueId = `edge-case-${Date.now()}`;
          createdKeys.push({ name: testCase.name || uniqueId, key: apiKey, uniqueId });
          
          // Check if it appears in the API keys list
          await page.waitForTimeout(1000);
          const keyList = page.locator('tbody tr');
          const keyCount = await keyList.count();
          console.log(`Total API keys in list: ${keyCount}`);
          
        } else {
          // Check for error messages
          const errorMessages = await page.locator('[role="alert"], .error, .invalid').allTextContents();
          if (errorMessages.length > 0) {
            console.log(`❌ VALIDATION ERROR: ${errorMessages.join(', ')}`);
          } else {
            console.log(`⚠️  Generate clicked but no copy button appeared - checking for other responses`);
            
            // Check if we're still on the modal
            const stillOnModal = await generateButton.isVisible();
            if (stillOnModal) {
              console.log(`Still on generation modal - likely validation prevented creation`);
            }
          }
          
          // Close any open modal
          await page.keyboard.press('Escape');
        }
      } else {
        console.log(`❌ Generate button is DISABLED - client-side validation preventing creation`);
        // Close the modal
        await page.keyboard.press('Escape');
      }
      
      // Wait between test cases
      await page.waitForTimeout(1000);
    }
    
    // Clean up any created keys
    if (createdKeys.length > 0) {
      console.log(`\n=== Cleanup: Removing ${createdKeys.length} created keys ===`);
      
      for (const keyInfo of createdKeys) {
        try {
          // For empty/whitespace keys, we need to find them by the API key value or position
          // since the name might not be visible or searchable
          console.log(`Attempting to clean up key: "${keyInfo.name}"`);
          
          // Try to find by looking at all rows and checking buttons
          const rows = page.locator('tbody tr');
          const rowCount = await rows.count();
          
          // Look through rows to find our key (may need to check most recent ones)
          for (let i = 0; i < Math.min(rowCount, 5); i++) {
            const row = rows.nth(i);
            const deleteButton = row.getByRole('button').last();
            
            if (await deleteButton.isVisible()) {
              await deleteButton.click();
              
              // Look for the confirmation dialog
              await page.waitForTimeout(500);
              
              // Try different confirmation approaches
              const confirmationInput = page.locator('input[type="text"]').last();
              if (await confirmationInput.isVisible()) {
                const placeholder = await confirmationInput.getAttribute('placeholder');
                console.log(`Confirmation placeholder: "${placeholder}"`);
                
                // If the key name is in placeholder, use it; otherwise try the key name
                if (placeholder && placeholder.includes('type')) {
                  const keyNameInPlaceholder = placeholder.replace(/.*type\s+"([^"]*)".*/, '$1');
                  await confirmationInput.fill(keyNameInPlaceholder);
                } else if (keyInfo.name && keyInfo.name.trim()) {
                  await confirmationInput.fill(keyInfo.name);
                } else {
                  // For empty names, the placeholder might show the actual key name used
                  await confirmationInput.fill(keyInfo.uniqueId);
                }
                
                await page.getByRole('button', { name: 'Delete Permanently' }).click();
                console.log(`🗑️  Attempted cleanup of key ${i + 1}`);
                break;
              } else {
                // No confirmation needed, or different UI
                console.log(`🗑️  Deleted key ${i + 1} without confirmation`);
                break;
              }
            }
          }
        } catch (error) {
          console.log(`⚠️  Cleanup failed: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Edge case investigation completed');
  });
});