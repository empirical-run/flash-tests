import { test, expect } from "./fixtures";

test.describe('Edit Message and GitHub Diff Tests', () => {
  test('edit message twice, wait for str_replace tool, and verify single commit via GitHub API', async ({ page, trackCurrentSession }) => {
    const initialPrompt = "edit title in example.spec.ts to 'playwright website has title'";
    const updatedPrompt = "edit title in example.spec.ts to '[playwright.dev](http://playwright.dev) has title'";

    // Navigate to homepage
    await page.goto('/');

    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();

    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();

    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });

    // TODO(agent on page): Click on the "New session" button (the "+" icon button in the My Sessions header)
    await page.getByPlaceholder('Enter an initial prompt').fill(initialPrompt);
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify we're in a session
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    const chatBubbles = page.locator('[data-message-id]');

    // Wait for the first user message bubble to appear
    await expect(chatBubbles.first()).toBeVisible({ timeout: 30000 });

    // Step 2: Wait for str_replace tool to be used (first message)
    // Wait for the file examination tool (view) to complete
    await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });

    // Wait for str_replace tool execution to start
    await expect(page.getByText(/Editing.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });

    // Wait for str_replace tool execution to complete
    await expect(page.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Click on the first "Edited" message to view details and verify type checks
    await page.getByText(/Edited.*example\.spec\.ts/).first().click();
    
    // Assert that type checks passed after the first edit
    const firstEditToolDetails = page.getByRole('tabpanel');
    await expect(firstEditToolDetails.getByText('Type checks passed')).toBeVisible({ timeout: 10000 });

    // Step 3: Edit the first message
    const userMessageBubble = chatBubbles.filter({ hasText: initialPrompt }).first();
    await userMessageBubble.hover();
    await userMessageBubble.getByRole('button', { name: 'Edit message' }).click();

    const editTextbox = page.getByRole('textbox', { name: 'Edit your message...' });
    await editTextbox.fill(updatedPrompt);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for the edited message to appear (checking for partial text since markdown links are rendered as HTML)
    await expect(chatBubbles.filter({ hasText: /playwright\.dev has title/ }).first()).toBeVisible({ timeout: 20000 });

    // Step 4: Wait for str_replace tool to be used (after editing message)
    // After editing a message, the conversation is regenerated from that point
    // Wait for the file examination tool (view) to complete
    await expect(page.getByText(/Viewed .+/).first()).toBeVisible({ timeout: 60000 });

    // Wait for str_replace tool execution to start
    await expect(page.getByText(/Editing.*example\.spec\.ts/).first()).toBeVisible({ timeout: 60000 });

    // Wait for str_replace tool execution to complete
    await expect(page.getByText(/Edited.*example\.spec\.ts/).first()).toBeVisible({ timeout: 60000 });

    // Step 5: Extract branch name from the UI
    // Navigate to Details tab to see the branch name
    await page.getByRole('tab', { name: 'Details', exact: true }).click();

    // Check if there's a PR link or compare link
    const prLink = page.locator('a[href*="/pull/"]').first();
    const compareLink = page.locator('a[href*="/compare/"]').first();
    
    let baseBranch: string | null = 'renamed-main'; // Default base branch for this repo
    let headBranch: string | null;

    if (await prLink.count() > 0 && await prLink.isVisible()) {
      // If PR exists, get PR details via GitHub API to extract branch name
      await expect(prLink).toBeVisible({ timeout: 10000 });
      const prHref = await prLink.getAttribute('href');
      const prNumber = prHref?.split('/pull/')[1];
      
      console.log('PR Number:', prNumber);
      
      const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
      
      // Get PR details via GitHub proxy
      const prDetailsResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          method: 'GET',
          url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}`
        }
      });
      
      expect(prDetailsResponse.ok()).toBeTruthy();
      const prData = await prDetailsResponse.json();
      
      baseBranch = prData.base.ref;
      headBranch = prData.head.ref;
    } else {
      // If no PR, extract from compare link
      await expect(compareLink).toBeVisible({ timeout: 10000 });
      const href = await compareLink.getAttribute('href');
      
      // Extract both base and head branch names from URL like: https://github.com/repo/compare/base...head
      const compareParams = href?.split('/compare/')[1];
      baseBranch = compareParams?.split('...')[0] || null;
      headBranch = compareParams?.split('...')[1] || null;
    }

    // Ensure we have valid branch names
    expect(baseBranch).toBeTruthy();
    expect(headBranch).toBeTruthy();
    expect(headBranch).toMatch(/^chat-session_\w+$/);

    console.log('Base branch:', baseBranch);
    console.log('Head branch:', headBranch);

    // Wait for GitHub to process the commit
    await page.waitForTimeout(5000);

    // Step 6: Use GitHub proxy to get diff between this branch and default branch
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";

    // Make API request to get comparison/diff via the GitHub proxy
    const compareResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        method: 'GET',
        url: `/repos/empirical-run/lorem-ipsum-tests/compare/${baseBranch}...${headBranch}`
      }
    });

    // Verify GitHub API call was successful
    expect(compareResponse.ok()).toBeTruthy();
    expect(compareResponse.status()).toBe(200);

    // Parse the comparison response
    const compareData = await compareResponse.json();

    // Log comparison data for debugging
    console.log('Comparison data:', {
      total_commits: compareData.total_commits,
      commits_count: compareData.commits?.length,
      ahead_by: compareData.ahead_by,
      behind_by: compareData.behind_by
    });

    // Step 6 (continued): Assert that the response has only 1 commit
    // The GitHub compare API returns a commits array
    expect(compareData.commits).toBeTruthy();
    expect(compareData.commits.length).toBe(1);
    expect(compareData.total_commits).toBe(1);
    
    console.log('✅ Successfully verified that only 1 commit exists in the branch');
    console.log('Commit message:', compareData.commits[0].commit.message);

    // Session will be automatically closed by afterEach hook
  });
});
