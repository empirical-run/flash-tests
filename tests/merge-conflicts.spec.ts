import { test, expect } from "./fixtures";
import { getBranchSha, createBranch, deleteBranch } from "./pages/github";
import { createSessionWithBranch, mergePrFromSession, sendMessage, waitForFirstMessage } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Merge Conflicts Tool Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    // Generate a unique branch name with timestamp
    const randomString = Math.random().toString(36).substring(2, 8);
    branchName = `merge-test-${randomString}`;
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    await deleteBranch(page, branchName, buildUrl);
  });

  test('create conflicting changes in two sessions and verify checkForMergeConflicts tool', async ({ page, customContextPageProvider, trackCurrentSession }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    
    // Step 1: Create a new branch via GitHub proxy API
    console.log(`Creating branch: ${branchName}`);
    
    // Get the SHA of the base branch (staging) and create the new branch
    const baseSha = await getBranchSha(page, 'staging', buildUrl);
    console.log(`Base branch SHA: ${baseSha}`);
    
    await createBranch(page, branchName, baseSha, buildUrl);
    console.log(`✅ Created branch: ${branchName}`);
    
    // Step 2: Navigate to homepage and create session 1
    await page.goto('/');
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Set video label for session 1
    setVideoLabel(page, 'session-1');
    
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(page).toHaveURL(/sessions$/);
    
    // Create session 1 with base branch
    const message1 = 'change title of example.spec.ts to "has [playwright.dev](http://playwright.dev) title" and create a pr';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);
    
    // Step 3: Create session 2 in a new tab with the same base branch
    const { page: page2, context: context2 } = await customContextPageProvider();
    
    await page2.goto('/');
    await expect(page2.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Set video label for session 2
    setVideoLabel(page2, 'session-2');
    
    await page2.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(page2).toHaveURL(/sessions$/);
    
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
    
    // Expand the "Tool Output" section
    await page2.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert for the expected text in the tabpanel
    const tabpanel = page2.getByRole('tabpanel');
    await expect(tabpanel.getByText(/Merge from .+ is committed, with conflicts\. Use text edit tools to resolve them\./)).toBeVisible();
    console.log('✅ Session 2: Merge conflict message verified');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Merge conflicts test completed successfully');
  });
});
