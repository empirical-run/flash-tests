import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSessionWithBranch, getChatMessageByText, mergePrFromSession, navigateToSessions, waitForFirstMessage } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Edit Message Branch Restore Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('branch-restore-test');
  });

  test.afterEach(async ({ page }) => {
    await deleteBranch(page, branchName);
  });

  test.skip('verify branch restore and re-execution when editing message after PR merge', async ({ page, customContextPageProvider, trackCurrentSession }) => { // skipped: edit message button not supported in sandbox mode
    // Step 1: Create a new branch via GitHub proxy API
    await createBranchFromStaging(page, branchName);
    
    // Step 2: Navigate to homepage and create session 1
    setVideoLabel(page, 'session-1');
    await navigateToSessions(page);
    
    // Create session 1 with base branch
    const message1 = 'grep for playwright';
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
    const message2 = 'delete the file example.spec.ts and create a pull request';
    await createSessionWithBranch(page2, message2, branchName);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page2);
    
    // Step 4: Wait for session 1 to complete grep - new UI shows result text instead of "Used grep"
    await expect(page.getByText(/Found \d+ results? for/)).toBeVisible({ timeout: 300000 });
    
    // Step 5: In session 2, wait for file deletion and PR creation
    await expect(page2.getByText("Used deleteFile")).toBeVisible({ timeout: 90000 });
    
    await expect(page2.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    
    // Step 6: Merge the PR from session 2
    await mergePrFromSession(page2, branchName);
    
    // Step 7: In session 1, edit the message
    // Click on the first user message to edit it
    const userMessageBubble = getChatMessageByText(page, message1);
    await userMessageBubble.hover();
    await userMessageBubble.getByRole('button', { name: 'Edit message' }).click();
    
    // Fill in the edited message
    const editedMessage = 'grep for login';
    const editTextbox = page.getByRole('textbox', { name: 'Edit your message...' });
    await editTextbox.fill(editedMessage);
    
    // Click Save Changes button to submit the edited message
    await page.getByRole('button', { name: 'Save Changes' }).click();
    
    // Wait for the edited message to appear in the chat
    await expect(getChatMessageByText(page, editedMessage)).toBeVisible({ timeout: 20000 });
    
    // Step 8: Assert for grep tool execution after edit
    // The branch restore allows the edit to proceed successfully, and grep runs with the new message
    // New UI shows "Searching for ..." instead of "Running grep"
    await expect(page.getByText(/Searching for "login"/)).toBeVisible({ timeout: 300000 });
    
    // The edited message is "grep for login" so look for "login" in the result text
    // New UI shows result text instead of "Used grep"
    await expect(page.getByText(/Found \d+ results? for "login"/)).toBeVisible({ timeout: 300000 });
    
    // Close session 2 context
    await context2.close();
    
  });
});
