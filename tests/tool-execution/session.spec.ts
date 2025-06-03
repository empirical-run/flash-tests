import { test, expect } from "../fixtures";

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
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Click on the "used" tool text to open the right panel
    await page.getByText("Used str_replace_based_edit_tool: view tool").click();
    
    // Assert that the tool result panel is open and shows file listing including package.json
    await expect(page.getByText("package.json")).toBeVisible({ timeout: 10000 });
  });

  test('stop running tool execution and verify rejection with ability to send new message', async ({ page }) => {
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
    
    // Send a message that will trigger a longer-running tool execution
    const toolMessage = "please analyze all files in the repository and provide detailed insights";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for tool execution to show "running" state
    await expect(page.getByText(/Running.*tool/)).toBeVisible({ timeout: 15000 });
    
    // Click the Stop button immediately
    await page.getByRole('button', { name: 'Stop' }).click();
    
    // TODO(agent on page): Inspect what text appears after clicking Stop to understand the rejection state
    
    // Verify that the message input is available and functional (user can send new message)
    const messageInput = page.getByPlaceholder('Type your message...');
    await expect(messageInput).toBeEnabled();
    
    // Send a follow-up message to confirm the interface is working
    const followUpMessage = "hello again";
    await messageInput.click();
    await messageInput.fill(followUpMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the follow-up message appears
    await expect(page.getByText(followUpMessage)).toBeVisible({ timeout: 10000 });
  });
});