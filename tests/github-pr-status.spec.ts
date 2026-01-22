import { test, expect } from "./fixtures";

test.describe('GitHub PR Status Tests', () => {
  test('create session, send message, detect branch, create PR, and verify PR status in UI', async ({ page }) => {
    // Step 1: Create a new session
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with README update prompt
    await page.getByRole('button', { name: 'New' }).click();
    // Generate a specific timestamp down to milliseconds for human readability
    const timestamp = new Date().toISOString().replace('T', ' at ').replace('Z', ' UTC').replace(/\.\d{3}/, (match) => match);
    const formattedDate = `Updated on: ${timestamp}`;
    const message = `update the README.md file to include this exact text at the top: "${formattedDate}" - do this change without asking me for anything else - you need to give me the edited file quickly - use str replace (not insert) tool`;
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Now extract session ID from URL (after the session page has fully loaded)
    const sessionUrl = page.url();
    const urlParts = sessionUrl.split('/sessions/');
    const sessionIdPart = urlParts[1];
    const sessionId = sessionIdPart ? sessionIdPart.split('/')[0] : null;
    
    expect(sessionId).toBeTruthy();
    
    // Wait for the view tool execution to complete - should view README.md
    await expect(page.getByText(/Viewed.*README\.md/)).toBeVisible({ timeout: 60000 });
    
    // Wait for a file modification tool to complete on README.md
    // The AI might use different tools (str_replace, create, insert) depending on whether the file exists
    // We use a longer timeout to account for AI decision-making time
    await expect(page.getByText(/(Edited|Created|Inserted into).*README\.md/)).toBeVisible({ timeout: 90000 });
    
    // Wait for the session to be fully established and branch to be created
    // Navigate to Details tab to see the branch name
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for and extract the clean branch names from comparison URL
    const branchLink = await page.locator('a[href*="/compare/"]');
    await expect(branchLink).toBeVisible({ timeout: 10000 });
    const href = await branchLink.getAttribute('href');
    
    // Extract both base and head branch names from URL like: https://github.com/repo/compare/base...head
    const compareParams = href?.split('/compare/')[1];
    const baseBranch = compareParams?.split('...')[0];
    const headBranch = compareParams?.split('...')[1];
    
    // Ensure we have valid branch names
    expect(baseBranch).toBeTruthy();
    expect(headBranch).toBeTruthy();
    expect(headBranch).toMatch(/^chat-session_\w+$/);
    
    // Wait a bit for GitHub to fully sync the branch before creating PR
    await page.waitForTimeout(3000);
    
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
          title: `PR for ${headBranch}`,
          head: headBranch,
          base: baseBranch,
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
    
    // Get PR response data to verify it contains our timestamp
    const prData = await response.json();
    
    // Extract the PR body or check for the timestamp in diff/files
    // For this test, we'll verify the PR was created with our specific timestamp reference
    expect(prData.title).toContain(headBranch);
    expect(prData.state).toBe('open');
    
    // Step 5: Wait for the PR status to be automatically updated and verify it shows the PR link
    // The PR status is now updated automatically, no refresh button needed
    // Wait up to 25 seconds for the PR link to appear with the format "PR #<number> opened"
    await expect(page.getByRole('link', { name: /PR #\d+ opened/ })).toBeVisible({ timeout: 25000 });
    
    // Step 6: Close the PR via UI
    // Click on Review 
    await page.getByRole('button', { name: 'Review' }).first().click();
    
    // Click the Close PR button
    await page.getByRole('button', { name: 'Close PR' }).click();
    
    // Handle the confirmation dialog - click the "Close PR" button to confirm
    await page.getByRole('button', { name: 'Close PR' }).click();
    
    // Wait for the PR to be closed (give it a few seconds for the async operation to complete)
    await page.waitForTimeout(3000);
    
    // Step 7: Verify PR status via API to confirm it's closed
    const prStatusResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        method: 'GET',
        url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prData.number}`
      }
    });
    
    expect(prStatusResponse.status()).toBe(200);
    const updatedPrData = await prStatusResponse.json();
    expect(updatedPrData.state).toBe('closed');
  });
});