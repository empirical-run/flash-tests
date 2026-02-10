import { test, expect } from "./fixtures";
import { getBranchSha, createBranch, deleteBranch } from "./pages/github";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Edit Message Branch Restore Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    // Generate a unique branch name with timestamp
    const randomString = Math.random().toString(36).substring(2, 8);
    branchName = `branch-restore-test-${randomString}`;
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

  test('verify branch restore and re-execution when editing message after PR merge', async ({ page, customContextPageProvider, trackCurrentSession }) => {
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
    
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create session 1 with base branch
    await page.locator('button:has(svg.lucide-plus)').click();
    
    // Open advanced settings
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the base branch
    await page.getByLabel('Base Branch').fill(branchName);
    
    // Enter the first message
    const message1 = 'grep for playwright';
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
    setVideoLabel(page2, 'session-2');
    
    await page2.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    await expect(page2).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create session 2 with the same base branch
    await page2.locator('button:has(svg.lucide-plus)').click();
    
    // Open advanced settings
    await page2.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the same base branch
    await page2.getByLabel('Base Branch').fill(branchName);
    
    // Enter the second message
    const message2 = 'delete the file example.spec.ts and create a pull request';
    await page2.getByPlaceholder('Enter an initial prompt').fill(message2);
    await page2.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in session 2
    await expect(page2).toHaveURL(/sessions\//, { timeout: 10000 });
    
    // Wait for the session chat page to load
    await expect(page2.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Step 4: Wait for session 1 to complete grep - new UI shows result summary
    await expect(page.getByText(/Found \d+ results? for/)).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: grep tool used');
    
    // Step 5: In session 2, wait for file deletion and PR creation
    await expect(page2.getByText("Used deleteFile")).toBeVisible({ timeout: 90000 });
    console.log('✅ Session 2: File deleted');
    
    await expect(page2.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 2: PR created');
    
    // Step 6: Merge the PR from session 2
    // Navigate to Details tab to get PR number
    await page2.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for PR button to appear
    await expect(page2.getByRole('button', { name: /^PR #\d+$/ })).toBeVisible({ timeout: 15000 });
    
    // Extract PR number from the button
    const prButton = page2.getByRole('button', { name: /^PR #\d+$/ });
    const prButtonText = await prButton.textContent();
    const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
    expect(prNumber).toBeTruthy();
    console.log(`PR Number: ${prNumber}`);
    
    // Merge the PR via Review > Merge UI
    await page2.getByRole('button', { name: 'Review' }).click();
    
    // Click the Merge PR button
    await page2.getByRole('button', { name: 'Merge PR' }).click();
    
    // Handle the confirmation dialog - click "Merge PR" to confirm
    await page2.getByRole('button', { name: 'Merge PR' }).click();
    
    // Wait for the merge to complete
    await page2.waitForTimeout(3000);
    console.log('✅ Session 2: PR merged');
    
    // Step 7: In session 1, edit the message
    // Click on the first user message to edit it
    const userMessageBubble = page.locator('[data-message-id]').filter({ hasText: message1 }).first();
    await userMessageBubble.hover();
    await userMessageBubble.getByRole('button', { name: 'Edit message' }).click();
    
    // Fill in the edited message
    const editedMessage = 'grep for login';
    const editTextbox = page.getByRole('textbox', { name: 'Edit your message...' });
    await editTextbox.fill(editedMessage);
    
    // Click Save Changes button to submit the edited message
    await page.getByRole('button', { name: 'Save Changes' }).click();
    
    // Wait for the edited message to appear in the chat
    await expect(page.locator('[data-message-id]').filter({ hasText: editedMessage }).first()).toBeVisible({ timeout: 20000 });
    console.log('✅ Session 1: Message edited');
    
    // Step 8: Assert for grep tool execution after edit
    // The branch restore allows the edit to proceed successfully, and grep runs with the new message
    await expect(page.getByText("Running grep")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: grep tool running');
    
    await expect(page.getByText("Used grep")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: grep tool completed after edit');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Branch restore test completed successfully');
  });
});
