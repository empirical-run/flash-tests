import { test, expect } from './fixtures';

test.describe('API Key Test Generation', () => {
  test('create session, generate API key test, verify tool execution, and close session', async ({ page, trackCurrentSession }) => {
    // Navigate to the main page
    await page.goto('/');
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Give the specified prompt
    const promptText = "Add a test case which tests that an API key is generated successfully.";
    await page.getByRole('textbox', { name: 'Send a message' }).fill(promptText);
    await page.getByRole('button', { name: 'Send message' }).click();
    
    // Wait for the response and tool execution
    // We expect to see str_replace_based_edit_tool:str_replace being executed
    await expect(page.getByText('str_replace_based_edit_tool:str_replace', { exact: false })).toBeVisible({ timeout: 120000 });
    
    // Verify that code change diff is visible in tools tab
    // First, click on the tools tab if it's not already selected
    await page.getByRole('tab', { name: 'Tools' }).click();
    
    // Check that the diff/code changes are visible
    await expect(page.locator('[data-testid="tool-execution-diff"], .diff, [class*="diff"]')).toBeVisible({ timeout: 10000 });
    
    // Verify the tool execution was successful by looking for success indicators
    await expect(page.getByText('successfully', { exact: false }).or(
      page.getByText('completed', { exact: false })
    )).toBeVisible({ timeout: 10000 });
    
    // Close the session via UI to test the close functionality
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Verify session is closed
    await expect(page.getByRole('button', { name: 'Session Closed', exact: true })).toBeVisible({ timeout: 10000 });
  });
});