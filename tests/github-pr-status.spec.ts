import { test, expect } from "./fixtures";

test.describe("GitHub PR Status", () => {
  test("create session, request README update, create PR, and verify PR status in UI", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");
    
    // Wait for successful login (handled by setup project)
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send a message asking to update README.md with today's date
    const updateMessage = "update README.md to have todays date";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(updateMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(updateMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for any tool execution to complete or stabilize the session
    await page.waitForTimeout(3000);
    
    // Get the current session URL to extract session ID/branch name
    const currentUrl = page.url();
    const sessionId = currentUrl.split('/sessions/')[1]?.split('?')[0];
    expect(sessionId).toBeTruthy();
    
    // The branch name should be in the format chat-session_{sessionId}
    const branchName = `chat-session_${sessionId}`;
    
    // Try to find session details or branch information in the current page
    // The session details might be in a sidebar, header, or dedicated section
    
    // Get the base URL and make an API request to create a PR using the GitHub proxy
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
    
    // Navigate to API Keys section to get or create an API key for this test
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // Create a new API key for this test
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name
    const apiKeyName = `GitHub-PR-Test-${Date.now()}`;
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
    
    // Navigate back to the session
    await page.goto(currentUrl);
    
    // Create a PR using the GitHub proxy API
    const prData = {
      method: "POST",
      url: "/repos/empirical-run/lorem-ipsum-tests/pulls",
      body: {
        title: `PR for ${branchName}`,
        head: branchName,
        base: "main",
        body: "Auto-generated PR from chat session"
      }
    };
    
    const prResponse = await page.request.post(`${baseURL}/api/github/proxy`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: prData
    });
    
    // Assert that PR creation was successful
    expect(prResponse.ok()).toBeTruthy();
    expect(prResponse.status()).toBe(200);
    
    const prResponseData = await prResponse.json();
    console.log('PR created:', prResponseData);
    
    // Refresh the page or navigate back to see if PR status is updated
    await page.reload();
    
    // TODO(agent on page): Look for PR status indicators in the session details UI such as badges, links, or other elements showing the open PR status
    
    // Wait a moment for the UI to potentially update with PR status
    await page.waitForTimeout(2000);
    
    // TODO(agent on page): Find and verify that the session shows PR status or branch information indicating an open PR
    
    // Clean up: Delete the API key that was created
    await page.getByRole('link', { name: 'API Keys' }).click();
    await page.getByRole('row').filter({ hasText: apiKeyName }).getByRole('button').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.getByText(apiKeyName)).not.toBeVisible();
  });
});