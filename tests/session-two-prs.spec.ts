import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSessionWithBranch, mergePrFromSession, navigateToSessions, waitForFirstMessage, waitForPRButton } from "./pages/sessions";

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
    console.log('✅ Agent started working');
    
    // Step 4: Wait for file deletion — sandbox uses bash (rm) instead of deleteFile tool
    await expect(page.getByText(/Used bash.*rm.*example\.spec\.ts/i).first()).toBeVisible({ timeout: 90000 });
    console.log('✅ File deleted');
    
    // Step 5: Wait for first PR to be created — use the PR button in the session header
    // which appears deterministically whenever a PR is created, regardless of which tool was used
    await waitForPRButton(page, 300000);
    console.log('✅ First PR created');
    
    // Steps 6-7: Navigate to Details tab and merge the first PR
    await mergePrFromSession(page);
    console.log('✅ First PR merged');
    
    // Step 8: Close the review panel and navigate back to the chat
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    
    // Send second message to create another PR
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    const message2 = 'create example.spec.ts that goes to google.com and asserts title, and create a pr';
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(message2);
    await page.locator('button[name="send"]').click();
    
    // Step 9: In sandbox mode, "Branch created" is not shown for the second message either.
    // The second task creates a new spec file, so the edit tool will appear (first task only used
    // read + bash rm, never edit), making this a reliable signal the second task has started.
    await expect(page.getByText(/Used edit tool/).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Agent started on second task');
    
    // Step 10: Wait for second PR to be opened — wait for PR button in session header
    await waitForPRButton(page, 300000);
    console.log('✅ Second PR opened');
    
    // Step 12: Open session info panel to verify second PR
    await page.getByRole('button', { name: 'Show session info' }).click();
    
    // Verify there's at least one PR button visible (the second one, as first is merged)
    await waitForPRButton(page, 15000);
    console.log('✅ Second PR visible in Details tab');
    
    console.log('✅ Session with 2 PRs test completed successfully');
  });
});
