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
    
    // Send the message "list all files in the root dir of the repo. no need to do anything else"
    const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Assert that tool execution is visible (the specific tool being used)
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Click on "Running" to open the function details
    await page.getByText("Running str_replace_based_edit_tool: view tool").click();
    
    // Assert that the function details panel shows the common view command
    await expect(page.getByText('"command": "view"')).toBeVisible({ timeout: 10000 });
    
    // Wait for tool execution to complete and assert "used" text appears
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Function details should auto-update to show the tool result when execution completes
    // Assert that the tool result is visible in the function details panel
    await expect(page.getByText("package.json")).toBeVisible({ timeout: 10000 });
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  test('stop tool execution after seeing running and verify tool was rejected', async ({ page }) => {
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
    
    // Send a message that will trigger tool execution
    const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for "Running" status to appear
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Click the stop button to stop the tool execution
    await page.getByRole('button', { name: 'Stop' }).click();
    
    // Assert that tool was rejected/stopped
    await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
    
    // Verify that user can send a new message (message input should be enabled and available)
    await expect(page.getByPlaceholder('Type your message...')).toBeEnabled({ timeout: 5000 });
    
    // Send another message to verify functionality is restored
    const newMessage = "hello again";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(newMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the new message appears
    await expect(page.getByText(newMessage)).toBeVisible({ timeout: 10000 });
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  test('Text selection should work', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Open the first session in the table
    await page.locator('table tbody tr').first().click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Find the first chat message bubble using the data attribute
    const firstChatBubble = page.locator('[data-message-id="1"]');
    
    // Find the paragraph element within the message bubble (this should contain just the message text)
    const messageTextElement = firstChatBubble.locator('p');
    // Get the message text content before selection
    const messageText = await messageTextElement.textContent();
    console.log('Message text from p element:', messageText);
    
    // Find the message content part (excluding "User" and timestamp)
    // We'll look for text that comes after the timestamp
    const messageLines = fullMessageText?.split('\n').filter(line => line.trim() !== '') || [];
    const actualMessageText = messageLines.length > 2 ? messageLines[2].trim() : '';
    console.log('Extracted message text:', actualMessageText);
    
    // Select the entire message bubble first, then we'll copy and verify
    await firstChatBubble.selectText();
    
    // Wait for 5 seconds
    await page.waitForTimeout(5000);
    
    // Press Ctrl+C to copy
    await page.keyboard.press('Control+c');
    
    // Get the selected message text content to assert it was copied to clipboard
    // We'll get the selected text from the page instead since we selected it programmatically
    const selectedText = await page.evaluate(() => {
      const selection = window.getSelection();
      return selection ? selection.toString() : '';
    });
    
    // Assert that the text content is copied to the clipboard
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    
    console.log('Selected text:', selectedText);
    console.log('Clipboard text:', clipboardText);
    console.log('Expected message text:', messageText);
    
    // Assert that clipboard and selection are not empty and contain the message content
    expect(clipboardText.length).toBeGreaterThan(0);
    expect(selectedText.length).toBeGreaterThan(0);
    
    // Assert that the clipboard contains the actual message content
    if (actualMessageText) {
      expect(clipboardText).toContain(actualMessageText);
      expect(selectedText).toContain(actualMessageText);
    }
    
    // Verify that clipboard contains user info (since we selected the whole bubble)
    expect(clipboardText.toLowerCase()).toContain('user');
  });
});