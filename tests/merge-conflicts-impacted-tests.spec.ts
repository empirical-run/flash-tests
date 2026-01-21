import { test, expect } from "./fixtures";
import { getBranchSha, createBranch, deleteBranch } from "./pages/github";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Merge Conflicts with Impacted Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    // Generate a unique branch name with timestamp
    const randomString = Math.random().toString(36).substring(2, 8);
    branchName = `merge-impacted-${randomString}`;
  });

  test.afterEach(async ({ page }) => {
    // Clean up: Delete the branch we created
    if (branchName) {
      try {
        const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
        await deleteBranch(page, branchName, buildUrl);
        console.log(`✅ Successfully deleted branch: ${branchName}`);
      } catch (error) {
        console.warn(`⚠️ Error deleting branch ${branchName}:`, error);
      }
    }
  });

  test('merge conflicts resolution should show correct impacted tests count', async ({ page, customContextPageProvider, trackCurrentSession }) => {
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
    setVideoLabel(page, 'session-1-copy-test');
    
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create session 1 with base branch - add a copy of the title test
    await page.getByRole('button', { name: 'New' }).click();
    
    // Open advanced settings
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the base branch
    await page.getByLabel('Base Branch').fill(branchName);
    
    // Enter the first message - add a copy of the title test
    const message1 = 'add a copy of the "has title" test in example.spec.ts, name it "has title copy" and create a pr';
    await page.getByPlaceholder('Enter an initial prompt').fill(message1);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in session 1
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Step 3: Create session 2 in a new tab with the same base branch
    const { page: page2, context: context2 } = await customContextPageProvider();
    
    await page2.goto('/');
    await expect(page2.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Set video label for session 2
    setVideoLabel(page2, 'session-2-google-test');
    
    await page2.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    await expect(page2).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create session 2 with the same base branch - add google.com test
    await page2.getByRole('button', { name: 'New' }).click();
    
    // Open advanced settings
    await page2.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the same base branch
    await page2.getByLabel('Base Branch').fill(branchName);
    
    // Enter the second message - create a google.com title test
    const message2 = 'add a new test in example.spec.ts that goes to google.com and asserts title contains "Google", name it "google has title" but don\'t create pr yet';
    await page2.getByPlaceholder('Enter an initial prompt').fill(message2);
    await page2.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in session 2
    await expect(page2).toHaveURL(/sessions\//, { timeout: 10000 });
    
    // Wait for the session chat page to load
    await expect(page2.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Step 4: In session 1, wait for edited tool to finish and createPullRequest
    await expect(page.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 90000 });
    console.log('✅ Session 1: File edited');
    
    await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: PR created');
    
    // Step 5: In session 2, wait for edited tool to finish
    await expect(page2.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 90000 });
    console.log('✅ Session 2: File edited');
    
    // Step 6: Merge the PR from session 1
    // Navigate to Details tab to get PR number
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for PR button to appear
    await expect(page.getByRole('button', { name: /^PR #\d+$/ })).toBeVisible({ timeout: 15000 });
    
    // Extract PR number from the button
    const prButton = page.getByRole('button', { name: /^PR #\d+$/ });
    const prButtonText = await prButton.textContent();
    const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
    expect(prNumber).toBeTruthy();
    console.log(`PR Number: ${prNumber}`);
    
    // Merge the PR via Review > Merge UI
    await page.getByRole('button', { name: 'Review' }).click();
    
    // Click the Merge PR button
    await page.getByRole('button', { name: 'Merge PR' }).click();
    
    // Handle the confirmation dialog - click "Merge PR" to confirm
    await page.getByRole('button', { name: 'Merge PR' }).click();
    
    // Wait for the merge to complete
    await page.waitForTimeout(3000);
    console.log('✅ Session 1: PR merged');
    
    // Step 7: In session 2, send a new message to create PR and resolve conflicts - explicitly keep both tests
    await page2.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page2.getByRole('textbox', { name: 'Type your message here...' }).fill('create pr now. if there are merge conflicts, resolve them and keep both tests');
    await page2.getByRole('button', { name: 'Send' }).click();
    
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
    await page2.getByRole('button', { name: 'Review' }).first().click();
    
    // Get the Review dialog/sheet
    const reviewDialog = page2.getByRole('dialog');
    
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
    await expect(reviewDialog.getByRole('tab', { name: /Impacted Tests \(1\)/ })).toBeVisible({ timeout: 10000 });
    console.log('✅ Session 2: Impacted tests count is correct (1)');
    
    // Step 15: Switch to Impacted Tests tab and verify the correct test is shown
    await impactedTestsTab.click();
    
    // Verify the google test is shown in impacted tests
    await expect(reviewDialog.getByText("google has title")).toBeVisible({ timeout: 10000 });
    console.log('✅ Session 2: Google test is visible in impacted tests');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Merge conflicts impacted tests verification completed successfully');
  });
});
