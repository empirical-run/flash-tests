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
    await page.getByPlaceholder('Type your message here...').fill(promptText);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for the response and specifically for str_replace_based_edit_tool:str_replace to be executed
    // This indicates that existing code is being modified, not just created or viewed
    await expect(page.getByText('str_replace_based_edit_tool:str_replace', { exact: false })).toBeVisible({ timeout: 120000 });
    
    // Verify that code change diff is visible in tools tab
    // First, click on the tools tab if it's not already selected
    await page.getByRole('tab', { name: 'Tools' }).click();
    
    // Click specifically on the str_replace_based_edit_tool:str_replace execution to view the diff
    await page.getByText('str_replace_based_edit_tool:str_replace', { exact: false }).first().click();
    
    // Wait for and verify that the diff/code changes are visible
    // Look for common diff indicators like added/removed lines, or file content
    await expect(page.locator('code, pre, .diff, [class*="diff"], [data-testid*="diff"]')).toBeVisible({ timeout: 10000 });
    
    // Close the session via UI to test the close functionality
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Verify session is closed by checking we're back at the sessions list
    await expect(page).toHaveURL(/\/sessions$/, { timeout: 10000 });
    
    // Verify we can see the sessions list page heading
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  });
});