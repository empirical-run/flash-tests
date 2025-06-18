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
    
    // Create a new session instead of opening an existing one
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send a test message
    const testMessage = "Hello, this is a test message for text selection.";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(testMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for the message to appear
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Find the first chat message bubble using the data attribute
    // First wait for the page to load and check if there are any messages
    await page.waitForLoadState('networkidle');
    
    // Check if there are any message bubbles with data-message-id
    const allMessages = page.locator('[data-message-id]');
    const messageCount = await allMessages.count();
    console.log('Total messages found:', messageCount);
    
    if (messageCount === 0) {
      throw new Error('No messages found in the session after sending a message.');
    }
    
    // Use the first available message (should be our test message)
    const firstChatBubble = allMessages.first();
    
    // Wait for the message to be visible
    await expect(firstChatBubble).toBeVisible({ timeout: 10000 });
    
    // First let's see what the structure looks like
    const bubbleHTML = await firstChatBubble.innerHTML();
    console.log('Message bubble HTML:', bubbleHTML);
    
    // Try different selectors for the message content
    // Try p first, then div, then span, then any text content
    let messageTextElement;
    let messageText;
    
    try {
      messageTextElement = firstChatBubble.locator('p');
      messageText = await messageTextElement.textContent({ timeout: 5000 });
      console.log('Found message text in p element:', messageText);
    } catch {
      try {
        messageTextElement = firstChatBubble.locator('div').last(); // Try the last div (likely contains message)
        messageText = await messageTextElement.textContent({ timeout: 5000 });
        console.log('Found message text in div element:', messageText);
      } catch {
        // Fall back to selecting the whole bubble
        messageTextElement = firstChatBubble;
        messageText = await messageTextElement.textContent({ timeout: 5000 });
        console.log('Found message text in full bubble:', messageText);
      }
    }
    
    // Select the text in the paragraph element
    await messageTextElement.selectText();
    
    // Wait for 5 seconds
    await page.waitForTimeout(5000);
    
    // Press Ctrl+C to copy
    await page.keyboard.press('Control+c');
    
    // Get the selected message text content to assert it was copied to clipboard
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
    
    // Assert that clipboard and selection contain only the message text (no user/timestamp)
    expect(clipboardText.length).toBeGreaterThan(0);
    expect(selectedText.length).toBeGreaterThan(0);
    
    // Assert that the clipboard contains the message text
    if (messageText) {
      expect(clipboardText.trim()).toBe(messageText.trim());
      expect(selectedText.trim()).toBe(messageText.trim());
    }
    
    // Verify that clipboard does NOT contain user info or timestamp (since we selected only the p element)
    expect(clipboardText.toLowerCase()).not.toContain('user');
    expect(clipboardText).not.toMatch(/\w{3} \d{1,2}/); // Should not contain timestamp pattern like "Jun 18"
  });
});