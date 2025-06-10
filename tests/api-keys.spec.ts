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
    
    // Confirm the deletion
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.getByText(apiKeyName)).not.toBeVisible();
    
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
});