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
    
    // Step 2: Send a message saying "update README.md to have todays date"
    const message = "update README.md to have todays date";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(message);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent
    await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
    
    // Step 3: Detect branch name from session details
    // TODO(agent on page): Navigate to session details or find where the branch name is displayed in the UI. The branch name looks like chat-session_2312313. Extract this branch name for later use.
    
    // Step 4: Use server-side fetch call to create a PR for this branch
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const apiKey = process.env.EMPIRICALRUN_API_KEY;
    
    // Get the branch name from the UI (this will be replaced by browser agent)
    const branchName = "placeholder-branch-name"; // This will be detected by the agent
    
    // Create PR via GitHub proxy API
    const response = await page.evaluate(async ({ buildUrl, apiKey, branchName }) => {
      const response = await fetch(`${buildUrl}/api/github/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          method: 'POST',
          url: '/repos/empirical-run/lorem-ipsum-tests/pulls',
          body: {
            title: `PR for ${branchName}`,
            head: branchName,
            base: 'main',
            body: 'Auto-generated PR from chat session'
          }
        })
      });
      return {
        status: response.status,
        data: await response.json()
      };
    }, { buildUrl, apiKey, branchName });
    
    // Verify PR was created successfully
    expect(response.status).toBe(201);
    
    // Step 5: Assert that session details UI shows an open PR for the branch
    // TODO(agent on page): Verify that the session details UI now shows an open PR status for the branch. Look for PR indicators, links, or status text related to the GitHub PR.
  });
});