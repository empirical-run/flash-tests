import { test, expect } from "./fixtures";

test.describe('Test Cases Tests', () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({ page }) => {
    // This test documents a current issue:
    // When user clicks "Edit" on a test case detail view, it currently shows "Session not found" error
    // Expected behavior: Should create/redirect to a new session where user can send messages
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Test Cases page from sidebar
    await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
    
    // Wait for test cases page to load
    await expect(page).toHaveURL(/test-cases$/, { timeout: 10000 });
    
    // Wait for test cases to load (ensure the table content is available)
    await expect(page.getByRole('row')).toHaveCount({ gte: 1 }, { timeout: 10000 });
    
    // Click on the first test case link in the table (generalized approach)
    await page.getByRole('row').getByRole('link').first().click();
    
    // Wait for test case detail view to load
    await expect(page).toHaveURL(/test-cases\/.*$/, { timeout: 10000 });
    
    // Click the Edit button
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    
    // EXPECTED BEHAVIOR: Should redirect to a new session where user can send messages
    // Currently this fails because it shows "Session not found" instead
    
    // Check that we get redirected to a session URL (not an error page)
    await expect(page).toHaveURL(/sessions\/.*$/, { timeout: 10000 });
    
    // Check that the session interface is available (message input field)
    await expect(page.getByPlaceholder('Type your message')).toBeVisible({ timeout: 10000 });
    
    // Check that the Send button is available
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    
    // Verify that we can actually type in the message field (not disabled)
    await expect(page.getByPlaceholder('Type your message')).toBeEnabled();
  });
});