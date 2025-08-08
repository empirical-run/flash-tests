import { test, expect } from "./fixtures";

test.describe('Test Cases Tests', () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Test Cases page from sidebar
    await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
    
    // Wait for test cases page to load
    await expect(page).toHaveURL(/test-cases$/, { timeout: 10000 });
    
    // TODO(agent on page): Click on the first test case in the list to open its detail view
    
    // Click the Edit button
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    
    // CURRENT ISSUE: This currently shows "session not found"
    // The test will fail here because we expect a new session screen but get an error instead
    
    // What we SHOULD see: A new session screen where user can send messages
    // Check that we get redirected to a session URL (not an error page)
    await expect(page).toHaveURL(/sessions\/.*$/, { timeout: 10000 });
    
    // Check that the session interface is available (message input field)
    await expect(page.getByPlaceholder('Type your message')).toBeVisible({ timeout: 10000 });
    
    // Check that the Send button is available
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    
    // Verify that we can actually type in the message field (not disabled)
    await expect(page.getByPlaceholder('Type your message')).toBeEnabled();
    
    // Optional: Send a test message to verify the session is fully functional
    const testMessage = "This is a test message to verify the session works";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(testMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message appears in the conversation
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
  });
});