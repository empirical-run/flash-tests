import { test, expect } from "./fixtures";

test.describe('GitHub PR Status Tests', () => {
  test('create session, send message, detect branch, create PR, and verify PR status in UI', async ({ page }) => {
    // Step 1: Create a new session
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Step 2: Send a message saying "update README.md to have todays date"
    const message = "update README.md to have todays date";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(message);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent
    await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
    
    // Step 3: Detect branch name from session details
    // TODO(agent on page): Navigate to session details to find the branch name that looks like chat-session_2312313
    
    // Step 4: Use server-side fetch call to create a PR for this branch
    // This will be done via evaluateInBrowser after we get the branch name
    
    // Step 5: Assert that session details UI shows an open PR for the branch
    // TODO(agent on page): Verify that the session details UI shows an open PR status for the detected branch
  });
});