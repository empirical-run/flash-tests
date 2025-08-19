import { test, expect } from "./fixtures";

test.describe('Session Modification Tests', () => {
  test('modify session.spec.ts file and verify tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the specific prompt to modify session.spec.ts and add a testing comment
    const modifyMessage = "Modify the existing session.spec.ts and a testing comment";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(modifyMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(modifyMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for tool execution to start - look for str_replace_based_edit_tool execution
    await expect(page.getByText("Running str_replace_based_edit_tool").first()).toBeVisible({ timeout: 45000 });
    
    // Assert that str_replace_based_edit_tool:str_replace is successfully executed
    await expect(page.getByText("Used str_replace_based_edit_tool: str_replace tool")).toBeVisible({ timeout: 45000 });
    
    // Click on the Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the file modification results
    await expect(page.getByText("str_replace_based_edit_tool").first()).toBeVisible({ timeout: 10000 });
    
    // Verify that diff content is visible (look for file content or changes)
    await expect(page.locator('text=session.spec.ts').or(page.locator('text=testing comment')).first()).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });
});