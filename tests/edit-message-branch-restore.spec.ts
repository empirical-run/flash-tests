import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { createSessionWithBranch, mergePrFromSession, waitForFirstMessage } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Edit Message Branch Restore Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    // Generate a unique branch name with timestamp
    const randomString = Math.random().toString(36).substring(2, 8);
    branchName = `branch-restore-test-${randomString}`;
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    await deleteBranch(page, branchName, buildUrl);
  });

  test('verify branch restore and re-execution when editing message after PR merge', async ({ page, customContextPageProvider, trackCurrentSession }) => {
    // Step 1: Create a new branch via GitHub proxy API
    await createBranchFromStaging(page, branchName);
    
    // Step 2: Navigate to homepage and create session 1
    await page.goto('/');
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Set video label for session 1
    setVideoLabel(page, 'session-1');
    
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(page).toHaveURL(/sessions$/);
    
    // Create session 1 with base branch
    const message1 = 'grep for playwright';
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
    const message2 = 'delete the file example.spec.ts and create a pull request';
    await createSessionWithBranch(page2, message2, branchName);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page2);
    
    // Step 4: Wait for session 1 to complete grep - new UI shows result text instead of "Used grep"
    await expect(page.getByText(/Found \d+ results? for/)).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: grep tool used');
    
    // Step 5: In session 2, wait for file deletion and PR creation
    await expect(page2.getByText("Used deleteFile")).toBeVisible({ timeout: 90000 });
    console.log('✅ Session 2: File deleted');
    
    await expect(page2.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 2: PR created');
    
    // Step 6: Merge the PR from session 2
    await mergePrFromSession(page2);
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
    // New UI shows "Searching for ..." instead of "Running grep"
    await expect(page.getByText(/Searching for "login"/)).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: grep tool running');
    
    // The edited message is "grep for login" so look for "login" in the result text
    // New UI shows result text instead of "Used grep"
    await expect(page.getByText(/Found \d+ results? for "login"/)).toBeVisible({ timeout: 300000 });
    console.log('✅ Session 1: grep tool completed after edit');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Branch restore test completed successfully');
  });
});
