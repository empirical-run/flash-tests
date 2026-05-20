import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSessionWithBranch, mergePrFromSession, navigateToSessions, openSessionInfoPanel, waitForFirstMessage, waitForPRButton } from "./pages/sessions";

test.describe('Session with 2 PRs', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('two-prs-test');
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    await deleteBranch(page, branchName, buildUrl);
  });

  test('create session with 2 PRs from different messages', async ({ page, trackCurrentSession }) => {
    // Step 1: Create a new branch via GitHub proxy API
    await createBranchFromStaging(page, branchName);
    
    // Step 2: Navigate to homepage and create session
    await navigateToSessions(page);

    // Create session with base branch
    const message1 = 'view tests/example.spec.ts, delete it, and create a pr - do these actions one by one, not in parallel';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);
    
    // Step 3: In sandbox mode, "Branch created" is not shown; wait for the agent to start using tools
    await expect(page.getByText(/Used.*tool/).first()).toBeVisible({ timeout: 120000 });
    
    // Step 4: Wait for file deletion — sandbox uses bash (rm) instead of deleteFile tool
    await expect(page.getByText(/Used bash.*rm.*example\.spec\.ts/i).first()).toBeVisible({ timeout: 90000 });
    
    // Step 5: Wait for first PR to be created — use the PR button in the session header
    // which appears deterministically whenever a PR is created, regardless of which tool was used
    await waitForPRButton(page, 300000);
    
    // Steps 6-7: Navigate to Details tab and merge the first PR
    await mergePrFromSession(page);
    
    // Step 8: Close the review panel and navigate back to the chat
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    
    // Wait for the session to return to idle state (send button becomes enabled)
    // After merging, the agent may still be running. We need to wait for it to finish.
    // Note: the send button is visible but disabled while the session is running, so we
    // must wait for it to be enabled (not just visible).
    await expect(page.locator('button[name="send"]')).toBeEnabled({ timeout: 90000 });
    
    // Send second message to create another PR
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    const message2 = 'create example.spec.ts that goes to google.com and asserts title, and create a pr';
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(message2);
    await page.locator('button[name="send"]').click();
    
    // Step 9/10: Wait for the second PR button to appear in the session header.
    // After the first PR is merged its button changes state (no longer matches /PR #\d+/),
    // so waitForPRButton here reliably waits for the newly created second PR.
    await waitForPRButton(page, 300000);
    
    // Step 12: Open session info panel to verify second PR
    await openSessionInfoPanel(page);
    
    // Verify there's at least one PR button visible (the second one, as first is merged)
    await waitForPRButton(page, 15000);
    
  });
});
