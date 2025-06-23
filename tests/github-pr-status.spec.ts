import { test, expect } from "./fixtures";

test.describe('GitHub PR Status Tests', () => {
  test('create session, send message, detect branch, create PR, and verify PR status in UI', async ({ page }) => {
    // Step 1: Create a new session
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Step 2: Send a message that will trigger both view and str_replace tools
    const message = "update the README.md file to include today's date at the top - do this change without asking me for anything else - you need to give me the edited file quickly";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(message);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent
    await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
    
    // Now extract session ID from URL (after the session is created and we're in it)
    const sessionUrl = page.url();
    const urlParts = sessionUrl.split('/sessions/');
    const sessionIdPart = urlParts[1];
    const sessionId = sessionIdPart ? sessionIdPart.split('/')[0] : null;
    
    expect(sessionId).toBeTruthy();
    
    // Assert that the first tool (view) execution is visible
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Wait for the view tool execution to complete
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Assert that the second tool (str_replace or insert) execution is visible
    await expect(page.getByText(/Running str_replace_based_edit_tool: (str_replace|insert) tool/)).toBeVisible({ timeout: 45000 });
    
    // Wait for the str_replace/insert tool execution to complete
    await expect(page.getByText(/Used str_replace_based_edit_tool: (str_replace|insert) tool/)).toBeVisible({ timeout: 45000 });
    
    // Wait for the session to be fully established and branch to be created
    // Navigate to Details tab to see the branch name
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for and extract the branch name
    const branchNameElement = await page.getByText(/chat-session_\w+/);
    await expect(branchNameElement).toBeVisible({ timeout: 10000 });
    const branchName = await branchNameElement.textContent();
    
    // Ensure we have a valid branch name
    expect(branchName).toMatch(/chat-session_\w+/);
    
    // Step 4: Use server-side fetch call to create a PR for this branch
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    
    // Create PR via GitHub proxy API using page.request (using cookie-based auth)
    const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        method: 'POST',
        url: '/repos/empirical-run/lorem-ipsum-tests/pulls',
        body: {
          title: `PR for ${branchName}`,
          head: branchName,
          base: 'main',
          body: 'Auto-generated PR from chat session'
        }
      }
    });
    
    // Log response for debugging
    if (!response.ok()) {
      console.log('PR creation response:', {
        status: response.status(),
        ok: response.ok(),
        statusText: response.statusText()
      });
    }
    
    // Verify PR was created successfully
    expect(response.status()).toBe(200);
    
    // Step 5: Navigate back to sessions page and assert PR status is visible
    // Go back to the sessions list page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Reload the page to ensure we get the latest PR status
    await page.reload();
    await page.waitForTimeout(3000); // Wait a few seconds for PR status to update
    
    // Sort by ID in descending order to find our most recent session
    await page.getByRole('cell', { name: 'ID' }).getByRole('img').click();
    
    // Look for our session using the session ID
    const sessionRow = page.getByRole('row').filter({ hasText: sessionId }).first();
    await expect(sessionRow).toBeVisible({ timeout: 10000 });
    
    // Assert that the PR status shows "Open" (exact match)
    await expect(sessionRow.getByText('Open', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});