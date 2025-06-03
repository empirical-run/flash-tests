import { test, expect } from "./fixtures";

test.describe('Tool Execution Tests', () => {
  test('create new session, send "list all files" message and verify tool execution', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send the message "list all files"
    const toolMessage = "list all files";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(toolMessage);
    // TODO(agent on page): Send the message by clicking the send button
    
    // TODO(agent on page): Wait for the tool execution to start and find the actual text that shows "running [tool name]" and assert it is visible
  });
});