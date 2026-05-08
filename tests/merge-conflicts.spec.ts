import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSessionWithBranch, expandToolOutput, mergePrFromSession, navigateToSessions, sendMessage, waitForFirstMessage } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Merge Conflicts Tool Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('merge-test');
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    await deleteBranch(page, branchName, buildUrl);
  });

  test.skip('create conflicting changes in two sessions and verify checkForMergeConflicts tool', // skipped: edit tool not supported in sandbox mode async ({ page, customContextPageProvider, trackCurrentSession }) => {
    // Step 1: Create a new branch via GitHub proxy API
    await createBranchFromStaging(page, branchName);
    
    // Step 2: Navigate to homepage and create session 1
    setVideoLabel(page, 'session-1');
    await navigateToSessions(page);
    
    // Create session 1 with base branch
    const message1 = 'change title of example.spec.ts to "has [playwright.dev](http://playwright.dev) title" and create a pr';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);
    
    // Step 3: Create session 2 in a new tab with the same base branch
    const { page: page2, context: context2 } = await customContextPageProvider();
    
    // Set video label for session 2
    setVideoLabel(page2, 'session-2');
    await navigateToSessions(page2);
    
    // Create session 2 with the same base branch
    const message2 = 'change title of example.spec.ts to "has playwright website title" but don\'t create pr';
    await createSessionWithBranch(page2, message2, branchName);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page2);
    
    // Step 4: In session 1, wait for edited tool to finish and createPullRequest
    await expect(page.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 1: File edited');
    
    await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: PR created');
    
    // Step 5: In session 2, wait for edited tool to finish
    await expect(page2.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: File edited');
    
    // Step 6: Merge the PR from session 1
    await mergePrFromSession(page);
    console.log('✅ Session 1: PR merged');
    
    // Step 7: In session 2, send a new message to create PR and resolve conflicts
    await sendMessage(page2, 'create pr now and resolve any conflicts if found');
    
    // Step 8: Assert for "Used createPullRequest tool" in session 2
    await expect(page2.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 2: createPullRequest tool used');
    
    // Step 9: Assert for "Used checkForMergeConflicts tool" in session 2
    await expect(page2.getByText("Used checkForMergeConflicts")).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: checkForMergeConflicts tool used');
    
    // Step 10: Click on "Used checkForMergeConflicts tool" and verify the message
    await page2.getByText("Used checkForMergeConflicts").click();
    
    // Wait a moment for the panel to open and render
    await page2.waitForTimeout(500);
    
    // Expand the "Tool Output" section and scope assertions to it
    const toolOutput = await expandToolOutput(page2);
    await expect(toolOutput.getByText(/Merge from .+ is committed, with conflicts\. Use text edit tools to resolve them\./)).toBeVisible();
    console.log('✅ Session 2: Merge conflict message verified');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Merge conflicts test completed successfully');
  });
});
