import { test, expect } from "./fixtures";
import { navigateToSessions, createSession, openToolsTab } from "./pages/sessions";

test('create pull request and verify PR link is visible in tools tab', async ({ page, trackCurrentSession }) => {
  await navigateToSessions(page);

  const pullRequestMessage = "Create a Pull request just to add a Test comment in example.spec.ts file";
  await createSession(page, pullRequestMessage);
  
  // Track the session for automatic cleanup
  trackCurrentSession(page);
  
  // First, AI will examine the file using view tool
  await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
  
  // The agent may optionally use a code editing tool before creating the PR, so skip asserting on it
  // Finally, wait for createPullRequest tool execution to start
  await expect(page.getByText("Running createPullRequest")).toBeVisible({ timeout: 120000 });
  
  // Wait for createPullRequest tool execution to complete - PR creation can take several minutes
  await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
  
  // Assert that PR status icon shows up in the selected session (PR #<number> button)
  await expect(page.getByRole('button', { name: /^PR #\d+$/ })).toBeVisible({ timeout: 25000 });
  
  // Navigate to Tools tab to verify PR link is visible
  await page.getByRole('tab', { name: 'Tools', exact: true }).click();
  
  // Click on the "Used createPullRequest" to open the tool details
  await page.getByText("Used createPullRequest").click();
  
  // Assert that PR link is visible in the tools tab
  // Look for GitHub PR URL pattern (https://github.com/...)
  await expect(page.locator('a[href*="github.com"]').first()).toBeVisible();
  
  // Assert that code review dot is visible
  await expect(page.getByTestId('code-review-dot').filter({ visible: true })).toBeVisible({ timeout: 60000 });
  
  // Click on the Review button
  await page.getByRole('button', { name: 'Review' }).click();
  
  // Click on the Code Review tab to open the review section
  await page.getByRole('tab', { name: 'Code Review' }).click();
  
  // Assert that "QUEUED" status is visible initially (check for "Waiting for review..." as it's unique)
  await expect(page.getByText('Waiting for review...')).toBeVisible();
  
  // Wait for the review to complete and assert either "approved" or "rejected" status
  await expect(
    page.getByText('Approved', { exact: true }).or(
      page.getByText('Rejected', { exact: true })
    )
  ).toBeVisible({ timeout: 60000 });
  
  // Session will be automatically closed by afterEach hook
});
