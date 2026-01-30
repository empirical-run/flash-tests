import { test, expect } from "./fixtures";
import { getBranchSha, createBranch, deleteBranch } from "./pages/github";

test.describe('Session with 2 PRs', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    // Generate a unique branch name with timestamp
    const randomString = Math.random().toString(36).substring(2, 8);
    branchName = `two-prs-test-${randomString}`;
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

  test('create session with 2 PRs from different messages', async ({ page, trackCurrentSession }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    
    // Step 1: Create a new branch via GitHub proxy API
    console.log(`Creating branch: ${branchName}`);
    
    // Get the SHA of the base branch (staging) and create the new branch
    const baseSha = await getBranchSha(page, 'staging', buildUrl);
    console.log(`Base branch SHA: ${baseSha}`);
    
    await createBranch(page, branchName, baseSha, buildUrl);
    console.log(`✅ Created branch: ${branchName}`);
    
    // Step 2: Navigate to homepage and create session
    await page.goto('/');
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create session with base branch
    await page.locator('button:has(svg.lucide-plus)').click();
    
    // Open advanced settings
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the base branch
    await page.getByLabel('Base Branch').fill(branchName);
    
    // Enter the first message
    const message1 = 'view tests/example.spec.ts, delete it, and create a pr - do these actions one by one, not in parallel';
    await page.getByPlaceholder('Enter an initial prompt').fill(message1);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in session
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Step 3: Wait for branch created message
    await expect(page.getByText("Branch created")).toBeVisible({ timeout: 120000 });
    console.log('✅ First branch created');
    
    // Step 4: Wait for file operations to complete
    await expect(page.getByText("Used deleteFile tool")).toBeVisible({ timeout: 90000 });
    console.log('✅ File deleted');
    
    // Step 5: Wait for first PR to be created
    await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    console.log('✅ First PR created');
    
    // Step 6: Navigate to Details tab to get first PR number
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for PR button to appear
    await expect(page.getByRole('button', { name: /^PR #\d+$/ })).toBeVisible({ timeout: 15000 });
    
    // Extract PR number from the button
    const prButton = page.getByRole('button', { name: /^PR #\d+$/ });
    const prButtonText = await prButton.textContent();
    const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
    expect(prNumber).toBeTruthy();
    console.log(`First PR Number: ${prNumber}`);
    
    // Step 7: Merge the first PR via Review > Merge UI
    await page.getByRole('button', { name: 'Review' }).click();
    
    // Click the Merge PR button
    await page.getByRole('button', { name: 'Merge PR' }).click();
    
    // Handle the confirmation dialog - click "Merge PR" to confirm
    await page.getByRole('button', { name: 'Merge PR' }).click();
    
    // Wait for the merge to complete
    await page.waitForTimeout(3000);
    console.log('✅ First PR merged');
    
    // Step 8: Close the review panel and navigate back to the chat
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    
    // Send second message to create another PR
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    const message2 = 'create example.spec.ts that goes to google.com and asserts title, and create a pr';
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(message2);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Step 9: Wait for second branch created message (nth 1 since first was nth 0)
    await expect(page.getByText("Branch created").nth(1)).toBeVisible({ timeout: 120000 });
    console.log('✅ Second branch created');
    
    // Step 10: Wait for second PR to be opened - should see "Used createPullRequest" again
    // We wait for timeout of 300 seconds as the file creation and PR creation can take time
    await expect(page.getByText("Used createPullRequest").nth(1)).toBeVisible({ timeout: 300000 });
    console.log('✅ Second PR opened');
    
    // Step 12: Navigate back to Details tab to verify second PR
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Verify there's at least one PR button visible (the second one, as first is merged)
    await expect(page.getByRole('button', { name: /^PR #\d+$/ }).first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Second PR visible in Details tab');
    
    console.log('✅ Session with 2 PRs test completed successfully');
  });
});
