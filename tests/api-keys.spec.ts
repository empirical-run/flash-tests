import { test, expect } from "./fixtures";

test.describe("API Keys", () => {
  test("create new api key and make API request", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
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



  test("verify empty string validation blocks API key creation", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
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
    await page.getByRole('link', { name: 'Settings' }).click();
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
    
    // Check for the specific error message that tells user to fill the name
    await expect(page.getByText('Please enter a name for the new API key.')).toBeVisible();
    
    // Verify that API key creation was blocked
    const copyButton = page.getByRole('button', { name: 'Copy to Clipboard' });
    await expect(copyButton).not.toBeVisible();
    
    // Modal should still be open
    const generateButton = page.getByRole('button', { name: 'Generate' });
    await expect(generateButton).toBeVisible();
    
    // Close the modal using the cross (X) button
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Verify the modal is closed by checking that the modal content is no longer visible
    await expect(page.getByText('Generate new API key')).not.toBeVisible();
    
    console.log('✅ Name field validation working - API key creation blocked when name is empty, modal closed successfully');
  });

  test("verify initial status of new API key is 'Enabled'", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name with a unique name
    const apiKeyName = `Test-Status-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key and verify the status is 'Enabled'
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    console.log('✅ New API key status is correctly set to "Enabled"');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion by typing the API key name in the confirmation field
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test API key cleaned up successfully');
  });

  test("verify delete confirmation message shows correct API key name", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key with a unique name
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Delete-Confirmation-Test-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key and capture the name displayed in UI
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow).toBeVisible();
    
    // Capture the API key name as displayed in the UI table
    const displayedName = await keyRow.locator('td').first().textContent();
    expect(displayedName).toBe(apiKeyName);
    console.log(`UI displays API key name: "${displayedName}"`);
    
    // Click the delete button to trigger confirmation dialog
    await keyRow.getByRole('button').last().click();
    
    // Wait for the confirmation dialog to appear
    await page.waitForTimeout(1000);
    
    // Capture the API key name from the confirmation input placeholder
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await expect(confirmationField).toBeVisible();
    
    const placeholderText = await confirmationField.getAttribute('placeholder');
    console.log(`Confirmation placeholder text: "${placeholderText}"`);
    
    // Verify that the placeholder contains the exact API key name
    expect(placeholderText).toContain(apiKeyName);
    
    // Verify the confirmation message "To confirm deletion, type the API key name: [API_KEY_NAME]"
    const confirmationMessage = page.getByText(`To confirm deletion, type the API key name: ${apiKeyName}`);
    await expect(confirmationMessage).toBeVisible();
    
    const messageText = await confirmationMessage.textContent();
    console.log(`Confirmation message text: "${messageText}"`);
    
    // Verify the message contains the exact API key name
    expect(messageText).toBe(`To confirm deletion, type the API key name: ${apiKeyName}`);
    
    // Verify confirmation elements contain the exact API key name
    expect(placeholderText).toContain(apiKeyName);
    expect(messageText).toContain(apiKeyName);
    
    console.log('✅ API key name matches in UI, confirmation message, and placeholder text');
    
    // Complete the deletion for cleanup
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Delete confirmation name verification test completed successfully');
  });

  test("verify API request fails with disabled API key", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name with a unique name
    const apiKeyName = `Disabled-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Copy the API key to clipboard for later use
    await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
    
    // Get the API key from clipboard
    const apiKey = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    
    // Verify we got a valid API key
    expect(apiKey).toBeTruthy();
    expect(typeof apiKey).toBe('string');
    expect(apiKey.length).toBeGreaterThan(0);
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Verify the key is initially enabled
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // First, test that the API key works when enabled
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
    const enabledResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Verify the API key works when enabled
    expect(enabledResponse.ok()).toBeTruthy();
    expect(enabledResponse.status()).toBe(200);
    console.log('✅ API key works correctly when enabled');
    
    // Now disable the API key - click the disable button (first button in the row)
    await keyRow.getByRole('button').first().click();
    
    // Confirm the disable action in the confirmation dialog
    await page.getByRole('button', { name: 'Disable' }).click();
    
    // Wait for the status to update and verify the key is now disabled
    // Use a more specific selector to avoid matching the key name that contains "Disabled-Test-Key"
    await expect(keyRow.locator('span').filter({ hasText: /^Disabled$/ })).toBeVisible();
    console.log('✅ API key successfully disabled');
    
    // Wait a moment for the disable action to propagate
    await page.waitForTimeout(2000);
    
    // Now test that the API request fails with the disabled API key
    const disabledResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Log the actual response for debugging
    console.log('Response with disabled API key:', {
      status: disabledResponse.status(),
      ok: disabledResponse.ok(),
      statusText: disabledResponse.statusText()
    });
    
    // Assert that the response is now unauthorized (401) - the key should be rejected
    expect(disabledResponse.ok()).toBeFalsy();
    expect(disabledResponse.status()).toBe(401);
    console.log('✅ API request correctly failed with disabled API key (401 Unauthorized)');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion by typing the API key name in the confirmation field
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test completed: Disabled API key correctly returns 401 Unauthorized');
  });

  test("verify Cancel button is disabled when user clicks disable button", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Cancel-Disable-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // Click the disable button (first button in the row)
    await keyRow.getByRole('button').first().click();
    
    // Verify that the Cancel button exists and is initially enabled (Playwright auto-waits)
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).not.toBeDisabled();
    console.log('✅ Cancel button is initially enabled');
    
    // Click the Disable button to start the disabling process
    const disableButton = page.getByRole('button', { name: 'Disable' });
    await disableButton.click();
    
    // Immediately check if Cancel button is disabled during the disabling process
    // Note: This needs to be checked quickly as the process might be fast
    await expect(cancelButton).toBeDisabled();
    console.log('✅ Cancel button is correctly disabled during disabling process');
    
    // Wait for the process to complete and verify the key is disabled
    await expect(keyRow.locator('span').filter({ hasText: /^Disabled$/ })).toBeVisible();
    console.log('✅ API key successfully disabled');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test completed: Cancel button correctly disabled during disable process');
  });

  test("verify button text changes to 'Disabling' during disable process", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Button-Text-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // Click the disable button (first button in the row)
    await keyRow.getByRole('button').first().click();
    
    // Verify that the Disable button exists with correct initial text (Playwright auto-waits)
    const disableButton = page.getByRole('button', { name: 'Disable' });
    await expect(disableButton).toBeVisible();
    await expect(disableButton).toHaveText('Disable');
    console.log('✅ Disable button shows correct initial text: "Disable"');
    
    // Click the Disable button to start the disabling process
    await disableButton.click();
    
    // Immediately check if button text changes to "Disabling"
    // Note: This needs to be checked quickly as the process might be fast
    await expect(page.getByRole('button', { name: 'Disabling' })).toBeVisible();
    console.log('✅ Button text correctly changes to "Disabling" during process');
    
    // Wait for the process to complete and verify the key is disabled
    await expect(keyRow.locator('span').filter({ hasText: /^Disabled$/ })).toBeVisible();
    console.log('✅ API key successfully disabled');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test completed: Button text correctly changes to "Disabling" during disable process');
  });

  test("verify disable API key modal is closed when user clicks X or Cancel button", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Modal-Close-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key and verify it's enabled
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // Test 1: Close modal with X button
    console.log('Testing modal close with X button...');
    
    // Click the disable button to open the modal
    await keyRow.getByRole('button').first().click();
    
    // Verify the disable confirmation modal is open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Disable API Key' })).toBeVisible();
    console.log('✅ Disable modal is open');
    
    // Click the X (Close) button to close the modal
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Verify the modal is closed
    await expect(page.getByRole('dialog')).not.toBeVisible();
    console.log('✅ Modal successfully closed with X button');
    
    // Verify user is back to the API Keys page and page is functional
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
    await expect(page).toHaveURL(/api-keys/);
    console.log('✅ User is back to functional API Keys page');
    
    // Verify the API key is still enabled (not disabled)
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    console.log('✅ API key remains enabled after modal close with X button');
    
    // Test 2: Close modal with Cancel button
    console.log('Testing modal close with Cancel button...');
    
    // Click the disable button again to open the modal
    await keyRow.getByRole('button').first().click();
    
    // Verify the disable confirmation modal is open again
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Disable API Key' })).toBeVisible();
    console.log('✅ Disable modal is open again');
    
    // Click the Cancel button to close the modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Verify the modal is closed
    await expect(page.getByRole('dialog')).not.toBeVisible();
    console.log('✅ Modal successfully closed with Cancel button');
    
    // Verify user is back to the API Keys page and page is functional
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
    await expect(page).toHaveURL(/api-keys/);
    console.log('✅ User is back to functional API Keys page');
    
    // Verify the API key is still enabled (not disabled)
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    console.log('✅ API key remains enabled after modal close with Cancel button');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test completed: Disable modal correctly closes with both X and Cancel buttons, API key remains enabled');
  });

  test("verify Cancel button is disabled when user clicks Enable button", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Cancel-Enable-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // First disable the key so we can test enabling it
    await keyRow.getByRole('button').first().click();
    await page.getByRole('button', { name: 'Disable' }).click();
    
    // Wait for the key to be disabled
    await expect(keyRow.locator('span').filter({ hasText: /^Disabled$/ })).toBeVisible();
    console.log('✅ API key is now disabled, ready for enable test');
    
    // Now click the enable button (first button in the row when disabled)
    await keyRow.getByRole('button').first().click();
    
    // Verify that the Cancel button exists and is initially enabled
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).not.toBeDisabled();
    console.log('✅ Cancel button is initially enabled');
    
    // Click the Enable button to start the enabling process
    const enableButton = page.getByRole('button', { name: 'Enable' });
    await enableButton.click();
    
    // Immediately check if Cancel button is disabled during the enabling process
    await expect(cancelButton).toBeDisabled();
    console.log('✅ Cancel button is correctly disabled during enabling process');
    
    // Wait for the process to complete and verify the key is enabled
    await expect(keyRow.locator('span').filter({ hasText: /^Enabled$/ })).toBeVisible();
    console.log('✅ API key successfully enabled');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test completed: Cancel button correctly disabled during enable process');
  });

  test("verify button text changes to 'Enabling' during enable process", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Button-Text-Enable-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // First disable the key so we can test enabling it
    await keyRow.getByRole('button').first().click();
    await page.getByRole('button', { name: 'Disable' }).click();
    
    // Wait for the key to be disabled
    await expect(keyRow.locator('span').filter({ hasText: /^Disabled$/ })).toBeVisible();
    console.log('✅ API key is now disabled, ready for enable test');
    
    // Now click the enable button (first button in the row when disabled)
    await keyRow.getByRole('button').first().click();
    
    // Verify that the Enable button exists with correct initial text
    const enableButton = page.getByRole('button', { name: 'Enable' });
    await expect(enableButton).toBeVisible();
    await expect(enableButton).toHaveText('Enable');
    console.log('✅ Enable button shows correct initial text: "Enable"');
    
    // Click the Enable button to start the enabling process
    await enableButton.click();
    
    // Immediately check if button text changes to "Enabling"
    await expect(page.getByRole('button', { name: 'Enabling' })).toBeVisible();
    console.log('✅ Button text correctly changes to "Enabling" during process');
    
    // Wait for the process to complete and verify the key is enabled
    await expect(keyRow.locator('span').filter({ hasText: /^Enabled$/ })).toBeVisible();
    console.log('✅ API key successfully enabled');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Test completed: Button text correctly changes to "Enabling" during enable process');
  });

  test("create API key, disable it, re-enable it, and send successful API request", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Step 1: Create a new API key
    console.log('Step 1: Creating new API key...');
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name with a unique name
    const apiKeyName = `E2E-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Copy the API key to clipboard for later use
    await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
    
    // Get the API key from clipboard
    const apiKey = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    
    // Verify we got a valid API key
    expect(apiKey).toBeTruthy();
    expect(typeof apiKey).toBe('string');
    expect(apiKey.length).toBeGreaterThan(0);
    console.log('✅ API key created successfully');
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key and verify initial status
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    console.log('✅ API key initial status: Enabled');
    
    // Test that the API key works when enabled
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
    const initialResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    expect(initialResponse.ok()).toBeTruthy();
    expect(initialResponse.status()).toBe(200);
    console.log('✅ API request successful with enabled key (200 OK)');
    
    // Step 2: Disable the API key
    console.log('Step 2: Disabling API key...');
    await keyRow.getByRole('button').first().click();
    
    // Confirm the disable action in the confirmation dialog
    await page.getByRole('button', { name: 'Disable' }).click();
    
    // Wait for the status to update and verify the key is now disabled
    await expect(keyRow.locator('span').filter({ hasText: /^Disabled$/ })).toBeVisible();
    console.log('✅ API key successfully disabled');
    
    // Wait a moment for the disable action to propagate
    await page.waitForTimeout(2000);
    
    // Test that the API request fails with the disabled API key
    const disabledResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    expect(disabledResponse.ok()).toBeFalsy();
    expect(disabledResponse.status()).toBe(401);
    console.log('✅ API request correctly failed with disabled key (401 Unauthorized)');
    
    // Step 3: Re-enable the API key
    console.log('Step 3: Re-enabling API key...');
    await keyRow.getByRole('button').first().click();
    
    // Confirm the enable action in the confirmation dialog
    await page.getByRole('button', { name: 'Enable' }).click();
    
    // Wait for the status to update and verify the key is now enabled again
    await expect(keyRow.locator('span').filter({ hasText: /^Enabled$/ })).toBeVisible();
    console.log('✅ API key successfully re-enabled');
    
    // Wait a moment for the enable action to propagate
    await page.waitForTimeout(2000);
    
    // Step 4: Send successful API request with re-enabled key
    console.log('Step 4: Testing API request with re-enabled key...');
    const reenabledResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    expect(reenabledResponse.ok()).toBeTruthy();
    expect(reenabledResponse.status()).toBe(200);
    console.log('✅ API request successful with re-enabled key (200 OK)');
    
    // Clean up: Delete the API key that was created
    console.log('Cleaning up: Deleting test API key...');
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion by typing the API key name in the confirmation field
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    console.log('✅ Test API key cleaned up successfully');
    
    // Final verification: Test that the deleted API key no longer works
    await page.waitForTimeout(2000); // Wait for deletion to propagate
    
    const deletedResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    expect(deletedResponse.ok()).toBeFalsy();
    expect(deletedResponse.status()).toBe(401);
    console.log('✅ Deleted API key correctly returns 401 Unauthorized');
    
    console.log('🎉 E2E Test completed successfully! API key lifecycle tested: Create → Disable → Re-enable → Success → Delete');
  });

  test("verify Delete Permanently button is disabled until exact API key name is typed", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Delete-Button-Disabled-Test-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key and click delete button
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await keyRow.getByRole('button').last().click();
    
    // Verify the delete confirmation modal is open
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await expect(confirmationField).toBeVisible();
    
    // Verify Delete Permanently button exists and is initially disabled
    const deletePermanentlyButton = page.getByRole('button', { name: 'Delete Permanently' });
    await expect(deletePermanentlyButton).toBeVisible();
    await expect(deletePermanentlyButton).toBeDisabled();
    console.log('✅ Delete Permanently button is initially disabled when confirmation field is empty');
    
    // Test with partial/incorrect API key names - button should remain disabled
    const incorrectInputs = [
      '',                          // Empty string
      ' ',                         // Just a space
      apiKeyName.substring(0, 5),  // Partial name
      apiKeyName.toLowerCase(),    // Wrong case
      apiKeyName.toUpperCase(),    // Wrong case
      `${apiKeyName} `,           // Extra space at end
      ` ${apiKeyName}`,           // Extra space at start
      'wrong-name',               // Completely wrong name
      apiKeyName.substring(1),    // Missing first character
      apiKeyName.slice(0, -1),    // Missing last character
    ];
    
    for (const incorrectInput of incorrectInputs) {
      console.log(`Testing with input: "${incorrectInput}"`);
      
      // Clear and fill with incorrect input
      await confirmationField.clear();
      await confirmationField.fill(incorrectInput);
      
      // Verify Delete Permanently button remains disabled
      await expect(deletePermanentlyButton).toBeDisabled();
      console.log(`✅ Delete Permanently button correctly remains disabled with input: "${incorrectInput}"`);
      
      // Small delay to ensure state is stable
      await page.waitForTimeout(100);
    }
    
    // Cancel the deletion to clean up without deleting
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Verify we're back to the main page and the API key still exists
    await expect(page.getByText(apiKeyName)).toBeVisible();
    console.log('✅ API key still exists after canceling deletion');
    
    // Final cleanup: Actually delete the API key
    await keyRow.getByRole('button').last().click();
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    console.log('✅ Test completed: Delete Permanently button correctly stays disabled until exact name is typed');
  });

  test("verify Delete Permanently button is enabled when exact API key name is typed", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to the API keys section
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for testing
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    const apiKeyName = `Delete-Button-Enabled-Test-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Find the row containing our API key and click delete button
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await keyRow.getByRole('button').last().click();
    
    // Verify the delete confirmation modal is open
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await expect(confirmationField).toBeVisible();
    
    // Verify Delete Permanently button is initially disabled
    const deletePermanentlyButton = page.getByRole('button', { name: 'Delete Permanently' });
    await expect(deletePermanentlyButton).toBeDisabled();
    console.log('✅ Delete Permanently button is initially disabled');
    
    // Type the exact API key name character by character and verify button state
    console.log('Testing character-by-character input...');
    
    // Clear the field first
    await confirmationField.clear();
    
    // Type each character and check button state
    for (let i = 1; i <= apiKeyName.length; i++) {
      const partialName = apiKeyName.substring(0, i);
      await confirmationField.clear();
      await confirmationField.fill(partialName);
      
      if (partialName === apiKeyName) {
        // When we have the exact match, button should be enabled
        await expect(deletePermanentlyButton).not.toBeDisabled();
        console.log(`✅ Delete Permanently button is enabled when exact name "${partialName}" is typed`);
      } else {
        // When we don't have exact match, button should be disabled
        await expect(deletePermanentlyButton).toBeDisabled();
        console.log(`✅ Delete Permanently button correctly remains disabled with partial input: "${partialName}"`);
      }
      
      // Small delay to ensure state is stable
      await page.waitForTimeout(50);
    }
    
    // Test that the button becomes disabled again if we modify the exact name
    console.log('Testing button becomes disabled when exact name is modified...');
    
    // Add extra character
    await confirmationField.fill(`${apiKeyName}x`);
    await expect(deletePermanentlyButton).toBeDisabled();
    console.log('✅ Button correctly disabled when extra character added');
    
    // Remove character from end
    await confirmationField.fill(apiKeyName.slice(0, -1));
    await expect(deletePermanentlyButton).toBeDisabled();
    console.log('✅ Button correctly disabled when character removed');
    
    // Add space at beginning
    await confirmationField.fill(` ${apiKeyName}`);
    await expect(deletePermanentlyButton).toBeDisabled();
    console.log('✅ Button correctly disabled when space added at beginning');
    
    // Add space at end
    await confirmationField.fill(`${apiKeyName} `);
    await expect(deletePermanentlyButton).toBeDisabled();
    console.log('✅ Button correctly disabled when space added at end');
    
    // Type exact name again to re-enable the button
    await confirmationField.clear();
    await confirmationField.fill(apiKeyName);
    await expect(deletePermanentlyButton).not.toBeDisabled();
    console.log('✅ Delete Permanently button is enabled again with exact name');
    
    // Verify the button works - click it to delete
    await deletePermanentlyButton.click();
    
    // Verify button text changes to "Deleting" during deletion process
    await expect(page.getByRole('button', { name: 'Deleting' })).toBeVisible();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    console.log('✅ API key successfully deleted when Delete Permanently button was enabled');
    
    console.log('✅ Test completed: Delete Permanently button correctly enabled only with exact API key name');
  });

  test.skip("TEMP: delete all existing API keys for cleanup", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    console.log('Starting cleanup of all API keys...');
    
    // Wait for the page to load and the table to be visible
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    
    // Wait a bit longer for the API keys to load from the server
    await page.waitForTimeout(3000);
    console.log('Waited for API keys to load...');
    
    // Get all rows in the API keys table (excluding header)
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    
    console.log(`Found ${rowCount} rows in the table`);
    
    if (rowCount === 0) {
      console.log('✅ No API keys found to clean up');
      return;
    }
    
    console.log(`Found ${rowCount} API keys to delete`);
    
    // Delete all keys one by one
    for (let i = 0; i < rowCount; i++) {
      // Always get the first row since we're deleting them and the list changes
      const firstRow = rows.first();
      
      // Get the API key name from the first column before deleting
      const keyName = await firstRow.locator('td').first().textContent();
      console.log(`Deleting API key: ${keyName}`);
      
      // Click the delete button (last button in the row)
      await firstRow.getByRole('button').last().click();
      
      // Wait for the confirmation modal to appear
      await page.waitForTimeout(2000);
      console.log(`Waiting for confirmation modal for key: ${keyName}`);
      
      // Try the approach that works in other tests - find confirmation field by placeholder
      const confirmationField = page.locator('input').first();
      await confirmationField.fill(keyName);
      
      // Click Delete Permanently
      await page.getByRole('button', { name: 'Delete Permanently' }).click();
      
      console.log(`✅ Deleted: ${keyName}`);
      
      // Reload the page to reset state and avoid validation issues
      await page.reload();
      await page.waitForTimeout(1000);
      console.log('🔄 Page reloaded for next deletion');
    }
    
    // Verify all keys are deleted
    const remainingRows = await page.locator('tbody tr').count();
    expect(remainingRows).toBe(0);
    
    console.log(`✅ Cleanup completed: Deleted ${rowCount} API keys`);
  });

});