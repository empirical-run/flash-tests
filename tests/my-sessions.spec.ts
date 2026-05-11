import { test, expect } from "./fixtures";
import { navigateToSessions, createSession, openReviewPanel, waitForPRButton } from "./pages/sessions";

test('create pull request and verify PR link is visible in session info panel', async ({ page, trackCurrentSession }) => {
  await navigateToSessions(page);

  const pullRequestMessage = "Create a Pull request just to add a test comment in tests/login.spec.ts file";
  await createSession(page, pullRequestMessage);
  
  // Track the session for automatic cleanup
  trackCurrentSession(page);
  
  // First, AI will examine the file using read tool (sandbox mode uses generic "read" tool instead of "Viewed FILE")
  await expect(page.getByText(/Used read tool/).first()).toBeVisible({ timeout: 60000 });
  
  // The agent creates PRs via bash tool (curl to GitHub API proxy) — wait for the PR button
  // to appear in the session header, which is the reliable signal the PR was created
  await waitForPRButton(page, 300000);

  // Also verify PR is shown inside the session info panel
  await page.getByRole('button', { name: 'Show session info' }).click();
  await expect(page.getByText('Branch details')).toBeVisible();
  await expect(page.getByText(/PR #\d+/).first()).toBeVisible();
  
  // Assert that a GitHub PR link is visible in the session info panel
  // Scope to /pull/ URLs to avoid false positives from nav or footer GitHub links
  await expect(page.locator('a[href*="github.com"][href*="/pull/"]').first()).toBeVisible();
  
  // Assert that code review dot is visible
  await expect(page.getByTestId('code-review-dot').filter({ visible: true })).toBeVisible({ timeout: 60000 });
  
  // Click on the Review button
  await openReviewPanel(page);
  
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
