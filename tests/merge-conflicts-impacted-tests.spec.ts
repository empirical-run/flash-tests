import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { createSessionWithBranch, mergePrFromSession, navigateToSessions, openReviewPanel, sendMessage, waitForFirstMessage } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Merge Conflicts with Impacted Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    // Generate a unique branch name with timestamp
    const randomString = Math.random().toString(36).substring(2, 8);
    branchName = `merge-impacted-${randomString}`;
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    await deleteBranch(page, branchName, buildUrl);
  });

  test('merge conflicts resolution should show correct impacted tests count', async ({ page, customContextPageProvider, trackCurrentSession }) => {
    // Step 1: Create a new branch via GitHub proxy API
    await createBranchFromStaging(page, branchName);
    
    // Step 2: Navigate to homepage and create session 1
    setVideoLabel(page, 'session-1-copy-test');
    await navigateToSessions(page);
    
    // Create session 1 with base branch - add a copy of the title test
    const message1 = 'add a copy of the "has title" test in example.spec.ts, name it "has title copy" and create a pr';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);
    
    // Step 3: Create session 2 in a new tab with the same base branch
    const { page: page2, context: context2 } = await customContextPageProvider();
    
    await page2.goto('/');
    await expect(page2.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Set video label for session 2
    setVideoLabel(page2, 'session-2-google-test');
    
    await page2.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(page2).toHaveURL(/sessions$/);
    
    // Create session 2 with the same base branch - add google.com test
    const message2 = 'add a new test in example.spec.ts that goes to google.com and asserts title contains "Google", name it "google has title" but don\'t create pr yet';
    await createSessionWithBranch(page2, message2, branchName);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page2);
    
    // Step 4: In session 1, wait for edited tool to finish and createPullRequest
    await expect(page.getByText(/Edited.*example\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 1: File edited');
    
    await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: PR created');
    
    // Step 5: In session 2, wait for edited tool to finish
    await expect(page2.getByText(/Edited.*example\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: File edited');
    
    // Step 6: Merge the PR from session 1
    await mergePrFromSession(page);
    console.log('✅ Session 1: PR merged');
    
    // Step 7: In session 2, send a new message to create PR and resolve conflicts - explicitly keep both tests
    await sendMessage(page2, 'create pr now. if there are merge conflicts, resolve them and keep both tests');
    
    // Step 8: Assert for "Used createPullRequest tool" in session 2
    await expect(page2.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 2: createPullRequest tool used');
    
    // Step 9: Assert for "Used checkForMergeConflicts tool" in session 2
    await expect(page2.getByText("Used checkForMergeConflicts")).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: checkForMergeConflicts tool used');
    
    // Step 10: Wait for conflict resolution to complete - look for another edit or PR update
    await page2.waitForTimeout(5000);
    
    // Step 11: Wait for impacted tests to be calculated
    await page2.waitForTimeout(10000);
    
    // Step 12: Reload the page to ensure fresh state
    await page2.reload();
    
    // Step 13: Open Review tab and check impacted tests
    const reviewDialog = await openReviewPanel(page2);
    
    // Step 14: Wait for the impacted tests tab to load and check the count
    // Expected: "Impacted Tests (1)" - only the google test from session 2
    // Bug scenario: "Impacted Tests (2)" - incorrectly counting both tests
    await expect(reviewDialog.getByRole('tab', { name: /Impacted Tests/ })).toBeVisible({ timeout: 30000 });
    
    // Get the impacted tests tab text to check the count
    const impactedTestsTab = reviewDialog.getByRole('tab', { name: /Impacted Tests/ });
    const tabText = await impactedTestsTab.textContent();
    console.log(`Impacted Tests tab text: ${tabText}`);
    
    // Assert that impacted tests count is 1 (only the google test added in session 2)
    // The "has title copy" test from session 1 was already merged and should not count
    await expect(reviewDialog.getByRole('tab', { name: /Impacted Tests \(1\)/ })).toBeVisible();
    console.log('✅ Session 2: Impacted tests count is correct (1)');
    
    // Step 15: Switch to Impacted Tests tab and verify the correct test is shown
    await impactedTestsTab.click();
    
    // Verify the google test is shown in impacted tests
    await expect(page2.getByLabel('Session Review').getByText('google has title', { exact: true }).first()).toBeVisible();
    console.log('✅ Session 2: Google test is visible in impacted tests');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Merge conflicts impacted tests verification completed successfully');
  });
});
