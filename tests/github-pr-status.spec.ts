import { test, expect } from "./fixtures";

test.describe('GitHub PR Status Tests', () => {
  test('create session, send message, detect branch, create PR, and verify PR status in UI', async ({ page }) => {
    // Step 1: Create a new session
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Step 2: Send a message that will trigger both view and str_replace tools
    // Generate a specific timestamp down to milliseconds for human readability
    const timestamp = new Date().toISOString().replace('T', ' at ').replace('Z', ' UTC').replace(/\.\d{3}/, (match) => match);
    const formattedDate = `Updated on: ${timestamp}`;
    const message = `update the README.md file to include this exact text at the top: "${formattedDate}" - do this change without asking me for anything else - you need to give me the edited file quickly`;
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(message);
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
    
    // Get PR response data to verify it contains our timestamp
    const prData = await response.json();
    
    // Extract the PR body or check for the timestamp in diff/files
    // For this test, we'll verify the PR was created with our specific timestamp reference
    expect(prData.title).toContain(branchName);
    expect(prData.state).toBe('open');
    
    // Step 5: Wait for the PR status to be automatically updated and verify it shows "Open"
    // The PR status is now updated automatically, no refresh button needed
    // Wait 10-15 seconds for the PR status link to appear with "Open" status
    await expect(page.getByRole('link', { name: /Pull Request #\d+ Open/ })).toBeVisible({ timeout: 15000 });
    
    // Step 6: Close the PR via UI
    // Click on Review 
    await page.getByText('Review').click();
    
    // Click the Close PR button
    await page.getByRole('button', { name: 'Close PR' }).click();
    
    // Handle the confirmation dialog - click the "Close PR" button to confirm
    await page.getByRole('button', { name: 'Close PR' }).click();
    
    // Step 7: Verify PR was closed successfully
    await expect(page.getByText('Pull request closed successfully').first()).toBeVisible({ timeout: 10000 });
    
    // Step 8: Verify PR status via API to confirm it's closed
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

  test('investigate PR status UI elements', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Navigate to sessions, create a new session, go to details tab and look for any PR-related elements, links, or status indicators - take screenshot and report what you find
  });
});