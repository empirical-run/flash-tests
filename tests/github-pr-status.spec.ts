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
      
      // Log the response body for more details
      const errorBody = await response.text();
      console.log('PR creation error body:', errorBody);
      
      // Log the branch name we're trying to use
      console.log('Branch name being used:', branchName);
    }
    
    let prData;
    // If we get a 422, it might be because a PR already exists for this branch
    // Let's check if this is the case and handle it gracefully
    if (response.status() === 422) {
      const errorBody = await response.text();
      if (errorBody.includes('already exists') || errorBody.includes('A pull request already exists')) {
        console.log('PR already exists for this branch, continuing with test...');
        // Try to get the existing PR for this branch
        const existingPrResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            method: 'GET',
            url: `/repos/empirical-run/lorem-ipsum-tests/pulls?head=empirical-run:${branchName}&state=open`
          }
        });
        
        if (existingPrResponse.status() === 200) {
          const existingPrs = await existingPrResponse.json();
          if (existingPrs.length > 0) {
            prData = existingPrs[0]; // Use the first (most recent) PR
            console.log('Found existing PR:', prData.number);
          }
        }
      } else {
        // If it's a different 422 error, fail the test
        expect(response.status()).toBe(200);
      }
    } else {
      // Verify PR was created successfully
      expect(response.status()).toBe(200);
      // Get PR response data to verify it contains our timestamp
      prData = await response.json();
    }
    
    // Verify we have PR data (either from creation or existing PR)
    expect(prData).toBeTruthy();
    if (prData) {
      // Extract the PR body or check for the timestamp in diff/files
      // For this test, we'll verify the PR contains our branch name
      expect(prData.title).toContain(branchName);
      expect(prData.state).toBe('open');
    }
    
    // Step 5: Wait for the PR status to be automatically updated and verify it shows the PR button
    // The PR status is now updated automatically, no refresh button needed
    // Wait 10-15 seconds for the PR button to appear with the new format "PR #<number>"
    await expect(page.getByRole('button', { name: /PR #\d+/ })).toBeVisible({ timeout: 15000 });
    
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
});