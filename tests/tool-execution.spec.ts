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
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Assert that tool execution is visible (the specific tool being used)
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 15000 });
    
    // Wait for tool execution to complete and assert "used" text appears
    // TODO(agent on page): Find the exact text that appears when the tool execution is complete (instead of "Running")
    
    // TODO(agent on page): Click on the completed tool text to open the right panel
    
    // TODO(agent on page): Assert that the tool result panel is open and shows file listing including package.json
  });
});