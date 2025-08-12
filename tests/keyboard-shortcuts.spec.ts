import { test, expect } from "./fixtures";

test.describe('Keyboard Shortcuts Tests', () => {
  
  test.describe('Message Sending Shortcuts', () => {
    test('send message with Cmd+Enter keyboard shortcut', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Type message and send with keyboard shortcut
      const message = "Hello, testing keyboard shortcut for send";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(message);
      
      // Send using Cmd+Enter (Meta+Enter on Mac, Control+Enter on other platforms)
      await page.keyboard.press('Meta+Enter');
      
      // Verify the message was sent and appears in the conversation
      await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the message
      await expect(page.locator('text=Hello').or(page.locator('text=Hi')).first()).toBeVisible({ timeout: 30000 });
    });

    test('send message with Control+Enter keyboard shortcut (cross-platform)', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Type message and send with Control+Enter
      const message = "Hello, testing Control+Enter shortcut";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(message);
      
      // Send using Control+Enter
      await page.keyboard.press('Control+Enter');
      
      // Verify the message was sent and appears in the conversation
      await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the message
      await expect(page.locator('text=Hello').or(page.locator('text=Hi')).first()).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Stop Shortcuts', () => {
    test('stop tool execution with Ctrl+C keyboard shortcut', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify the message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Stop using Ctrl+C keyboard shortcut
      await page.keyboard.press('Control+c');
      
      // Assert that tool was rejected/stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Verify that message input is immediately available and enabled
      await expect(page.getByPlaceholder('Type your message')).toBeEnabled({ timeout: 5000 });
    });

    test('stop and send new message with Cmd+Enter during tool execution', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify the message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Type a new message while tool is running
      const stopAndSendMessage = "Stop the current tool and process this message instead";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(stopAndSendMessage);
      
      // Use Cmd+Enter to stop current execution and send new message
      await page.keyboard.press('Meta+Enter');
      
      // Assert that original tool was rejected/stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Verify the new message appears in the conversation
      await expect(page.getByText(stopAndSendMessage)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the new message
      await expect(page.locator('text=Stop').or(page.locator('text=process')).first()).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Queue Shortcuts', () => {
    test('queue message with Cmd+Shift+Enter keyboard shortcut', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify the message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // While the agent is working, queue a new message using keyboard shortcut
      const queuedMessage = "What is 5 + 5?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      
      // Queue using Cmd+Shift+Enter keyboard shortcut
      await page.keyboard.press('Meta+Shift+Enter');
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Wait for the first tool execution to complete
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Verify that the queued message is now being processed
      await expect(page.getByText(queuedMessage)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the queued message
      await expect(page.getByText("5 + 5 = 10").or(page.getByText("The answer is 10")).or(page.getByText("equals 10"))).toBeVisible({ timeout: 30000 });
    });

    test('queue message with Control+Shift+Enter keyboard shortcut (cross-platform)', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.keyboard.press('Control+Enter');
      
      // Verify the message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // While the agent is working, queue a new message using Control+Shift+Enter
      const queuedMessage = "What is 7 + 8?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      
      // Queue using Control+Shift+Enter keyboard shortcut
      await page.keyboard.press('Control+Shift+Enter');
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Wait for the first tool execution to complete
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Verify that the queued message is now being processed
      await expect(page.getByText(queuedMessage)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the queued message
      await expect(page.getByText("7 + 8 = 15").or(page.getByText("The answer is 15")).or(page.getByText("equals 15"))).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Clear Queue Shortcuts', () => {
    test('clear queued messages with Ctrl+X keyboard shortcut', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL /sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify the message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Queue a message
      const queuedMessage = "This message should be cleared";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.keyboard.press('Meta+Shift+Enter');
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Clear the queue using Ctrl+X keyboard shortcut
      await page.keyboard.press('Control+x');
      
      // Wait for tool execution to complete
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Verify that the queued message was cleared and does NOT appear
      // We should wait a reasonable amount of time to ensure it would have appeared if not cleared
      await page.waitForTimeout(5000);
      await expect(page.getByText(queuedMessage)).not.toBeVisible();
      
      // Verify that the session is ready for new input (no queued messages processing)
      await expect(page.getByPlaceholder('Type your message')).toBeEnabled();
    });
  });

  test.describe('Complex Keyboard Workflow Tests', () => {
    test('multiple keyboard shortcut interactions in sequence', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // First: Send a regular message with keyboard shortcut
      const regularMessage = "Hello, testing keyboard workflow";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(regularMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify regular message sent
      await expect(page.getByText(regularMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for response
      await expect(page.locator('text=Hello').or(page.locator('text=Hi')).first()).toBeVisible({ timeout: 30000 });
      
      // Second: Send tool execution message with keyboard shortcut
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Third: Queue a message with keyboard shortcut
      const queuedMessage1 = "First queued message - what is 1 + 1?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage1);
      await page.keyboard.press('Meta+Shift+Enter');
      
      // Fourth: Queue another message
      const queuedMessage2 = "Second queued message - what is 2 + 2?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage2);
      await page.keyboard.press('Meta+Shift+Enter');
      
      // Fifth: Clear the queue using keyboard shortcut
      await page.keyboard.press('Control+x');
      
      // Wait for tool to complete
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Verify queued messages were cleared (should not appear)
      await page.waitForTimeout(5000);
      await expect(page.getByText(queuedMessage1)).not.toBeVisible();
      await expect(page.getByText(queuedMessage2)).not.toBeVisible();
      
      // Sixth: Send a final message to verify system is working
      const finalMessage = "Final test message";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(finalMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify final message appears
      await expect(page.getByText(finalMessage)).toBeVisible({ timeout: 10000 });
    });

    test('stop and send workflow using keyboard shortcuts only', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Cycle 1: Tool execution -> Stop with Ctrl+C -> Send new message
      const toolMessage1 = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage1);
      await page.keyboard.press('Meta+Enter');
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Stop with Ctrl+C
      await page.keyboard.press('Control+c');
      
      // Verify tool was stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Send new message after stopping
      const afterStopMessage1 = "First message after stop";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(afterStopMessage1);
      await page.keyboard.press('Meta+Enter');
      
      // Verify message appears
      await expect(page.getByText(afterStopMessage1)).toBeVisible({ timeout: 10000 });
      
      // Wait for response
      await expect(page.locator('text=First').or(page.locator('text=message')).first()).toBeVisible({ timeout: 30000 });
      
      // Cycle 2: Tool execution -> Stop & Send with Cmd+Enter
      const toolMessage2 = "show me the package.json file contents";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage2);
      await page.keyboard.press('Meta+Enter');
      
      // Wait for second tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Type new message while tool is running and use Cmd+Enter to stop & send
      const stopAndSendMessage = "Stop previous tool and answer: what is 10 + 10?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(stopAndSendMessage);
      await page.keyboard.press('Meta+Enter');
      
      // Verify previous tool was stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Verify new message appears and gets processed
      await expect(page.getByText(stopAndSendMessage)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=10 + 10 = 20').or(page.locator('text=equals 20')).first()).toBeVisible({ timeout: 30000 });
    });
  });
});