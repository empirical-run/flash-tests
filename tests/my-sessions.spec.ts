import { test, expect } from "./fixtures";

test('create pull request and verify PR link is visible in tools tab', async ({ page, trackCurrentSession }) => {
  // Navigate to the application (already logged in via auth setup)
  await page.goto('/');
  
  // Wait for successful login
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  
  // Navigate to Sessions page (use first() to click "My Sessions" link)
  await page.getByRole('link', { name: 'Sessions', exact: true }).first().click();
  
  // TODO(agent on page): Click on the button to create a new session (likely a "+" button in the header)
  const pullRequestMessage = "Create a Pull request just to add a Test comment in example.spec.ts file";
  await page.getByPlaceholder('Enter an initial prompt').fill(pullRequestMessage);
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Verify we're in a session (URL should contain "sessions")
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  
  // Wait for navigation to the actual session URL with session ID
  await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
  
  // Track the session for automatic cleanup
  trackCurrentSession(page);
  
  // First, AI will examine the file using view tool
  await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
  
  // The agent may optionally use a code editing tool before creating the PR, so skip asserting on it
  // Finally, wait for createPullRequest tool execution to start
  await expect(page.getByText("Running createPullRequest")).toBeVisible({ timeout: 120000 });
  
  // Wait for createPullRequest tool execution to complete - PR creation can take several minutes
  await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
  
  // Navigate to Tools tab to verify PR link is visible
  await page.getByRole('tab', { name: 'Tools', exact: true }).click();
  
  // Click on the "Used createPullRequest" to open the tool details
  await page.getByText("Used createPullRequest").click();
  
  // Assert that PR link is visible in the tools tab
  // Look for GitHub PR URL pattern (https://github.com/...)
  await expect(page.locator('a[href*="github.com"]').first()).toBeVisible({ timeout: 10000 });
  
  // Assert that code review dot is visible
  await expect(page.getByTestId('code-review-dot').filter({ visible: true })).toBeVisible({ timeout: 60000 });
  
  // Click on the Review button
  await page.getByRole('button', { name: 'Review' }).click();
  
  // Click on the Code Review tab to open the review section
  await page.getByRole('tab', { name: 'Code Review' }).click();
  
  // Assert that "QUEUED" status is visible initially (check for "Waiting for review..." as it's unique)
  await expect(page.getByText('Waiting for review...')).toBeVisible({ timeout: 10000 });
  
  // Wait for the review to complete and assert either "approved" or "rejected" status
  await expect(
    page.getByText('Approved', { exact: true }).or(
      page.getByText('Rejected', { exact: true })
    )
  ).toBeVisible({ timeout: 60000 });
  
  // Session will be automatically closed by afterEach hook
});
