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

  test("disable and re-enable api key controls access", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'API Keys' }).click();

    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();

    // Fill in the API key name
    const apiKeyName = `Toggle-API-Key-${Date.now()}`;
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

    // Make an API request using the new API key (should succeed)
    const { protocol, host } = new URL(page.url());
    const baseURL = `${protocol}//${host}`;
    const successResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(successResponse.ok()).toBeTruthy();
    expect(successResponse.status()).toBe(200);

    // Disable the API key from the table row corresponding to apiKeyName
    // TODO(agent on page): In the API Keys table row that contains the text apiKeyName, disable the API key via the UI (e.g., click a Disable action or toggle) and confirm if prompted. Verify the row indicates the key is Disabled.

    // Verify the same API request now fails (401/403)
    const disabledResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(disabledResponse.ok()).toBeFalsy();
    expect([401, 403]).toContain(disabledResponse.status());

    // Re-enable the API key from the same row
    // TODO(agent on page): In the same API Keys table row that contains apiKeyName, re-enable the API key via the UI (e.g., click Enable or toggle back). Verify the row indicates the key is Enabled/Active.

    // Verify the API request succeeds again
    const reenabledResponse = await page.request.get(`${baseURL}/api/environment-variables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(reenabledResponse.ok()).toBeTruthy();
    expect(reenabledResponse.status()).toBe(200);

    // Clean up: Delete the API key that was created
    await page.getByRole('row').filter({ hasText: apiKeyName }).getByRole('button').last().click();

    // Confirm the deletion by typing the API key name in the confirmation field
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();

    // Verify the API key is removed from the list (check the table specifically)
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
  });

});