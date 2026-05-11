import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSessionWithBranch, mergePrFromSession, navigateToSessions, openReviewPanel, sendMessage, waitForFirstMessage, waitForPRButton } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Merge Conflicts with Impacted Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('merge-impacted');
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
    
    // Create session 1 with base branch - add a copy of the login test
    // Uses login.spec.ts which exists in staging (example.spec.ts no longer exists there)
    const message1 = 'add a copy of the "click login button and input dummy email" test in tests/login.spec.ts, name it "click login button copy" and create a pr';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);
    
    // Step 3: Create session 2 in a new tab with the same base branch
    const { page: page2, context: context2 } = await customContextPageProvider();
    
    // Set video label for session 2
    setVideoLabel(page2, 'session-2-google-test');
    await navigateToSessions(page2);
    
    // Create session 2 with the same base branch - add a new test
    // Uses login.spec.ts; adding different tests to same file creates the conflict
    const message2 = 'add a new test in tests/login.spec.ts that navigates to "/about" and checks that a heading is visible on the page, name it "about page has heading" but don\'t create pr yet';
    await createSessionWithBranch(page2, message2, branchName);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page2);
    
    // Step 4: In session 1, wait for PR creation (agent may use edit tool or bash to edit the file)
    // App creates PRs via bash tool (curl to GitHub API proxy) — wait for PR button in header
    await waitForPRButton(page, 300000);
    console.log('✅ Session 1: PR created');
    
    // Step 5: In session 2, wait for the agent to edit the file (via edit tool or bash)
    await expect(page2.getByText(/Used edit tool|Used bash:/i).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: File edited');
    
    // Step 6: Merge the PR from session 1
    await mergePrFromSession(page);
    console.log('✅ Session 1: PR merged');
    
    // Step 7: Explicitly request conflict resolution against the updated base
    // The base branch was just merged with conflicting changes, so the agent must fetch
    // the latest base, detect conflicts, resolve them keeping both tests, and update/create the PR
    await sendMessage(page2, `the base branch ${branchName} was just updated with new commits that conflict with your changes. fetch the latest base branch, resolve any merge conflicts keeping both tests, and create or update the PR`);
    
    // Step 8: Wait for PR creation/update in session 2 (via bash tool — curl to GitHub API proxy)
    await waitForPRButton(page2, 300000);
    console.log('✅ Session 2: PR created/updated');
    
    // Step 9: Verify the agent fetched the updated base branch to detect conflicts
    // App uses bash git commands for conflict detection instead of the deprecated checkForMergeConflicts tool
    await expect(page2.getByText(/Used bash.*(git fetch|git pull|git merge|git rebase)/i).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: Conflict resolution via bash git commands verified');
    
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
