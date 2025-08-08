import { test, expect } from "./fixtures";

test.describe('Sessions Tests', () => {
  test('Sort sessions by title', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the Title column header to sort by title
    // This is expected to crash the page currently
    await page.getByRole('cell', { name: 'Title' }).click();
    
    // If the page doesn't crash, we would expect to see the sessions sorted by title
    // This assertion will likely fail due to the crash
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('Close session and verify session state', async ({ page, trackCurrentSession }) => {
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
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send a message with unique identifier to make the session easily identifiable
    const uniqueId = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Close session test - ${uniqueId}`;
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(message);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
    
    // Get the session ID from the current URL before closing
    const sessionUrl = page.url();
    const sessionId = sessionUrl.split('/').pop();
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Assert redirection to sessions list page (check for New button)
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible({ timeout: 10000 });
    
    // Assert the closed session is not visible in the active sessions list
    // We can check this by ensuring the session ID or session content is not present
    await expect(page.getByText(message)).not.toBeVisible();
    
    // Navigate back to the specific session page via URL to check closed status
    await page.goto(sessionUrl);
    
    // Assert "Session Closed" button is visible
    await expect(page.getByRole('button', { name: 'Session Closed', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test.describe('Chat Interaction Features', () => {
    test('stop tool execution and send new message', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the message was sent and appears in the conversation
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start (Running status)
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Click the stop button to stop the tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Assert that tool was rejected/stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Verify that message input is immediately available and enabled
      await expect(page.getByPlaceholder('Type your message')).toBeEnabled({ timeout: 5000 });
      
      // Send a new message immediately after stopping
      const newMessage = "What is the weather like today?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(newMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the new message appears in the conversation
      await expect(page.getByText(newMessage)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the new message (should show some response)
      // The response should appear within reasonable time since it's not a tool execution
      await expect(page.locator('text=Today')).toBeVisible({ timeout: 30000 });
      
      // Clean up - close the session
      await page.getByRole('tab', { name: 'Details', exact: true }).click();
      await page.getByRole('button', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

    test('queue message while agent is working on tool execution', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Send a message that will trigger tool execution
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the message was sent and appears in the conversation
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start (Running status)
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // While the agent is working, queue a new message
      const queuedMessage = "What is 2 + 2?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      
      // Click the Queue button (the interface seems to have both Send and Queue options)
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // After queuing, the input field might be cleared, but the message should be queued
      // We can verify the queue button is available which indicates the system is ready for more input
      
      // Wait for the first tool execution to complete
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Verify that the queued message is now being processed
      // After the tool completes, the queued message should be sent automatically
      // Look for the message in the chat conversation
      await expect(page.getByText(queuedMessage)).toBeVisible({ timeout: 10000 });
      
      // Verify the agent processes the queued message and provides an answer
      await expect(page.getByText("2 + 2 = 4").or(page.getByText("The answer is 4")).or(page.getByText("equals 4"))).toBeVisible({ timeout: 30000 });
      
      // Clean up - close the session
      await page.getByRole('tab', { name: 'Details', exact: true }).click();
      await page.getByRole('button', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

    test('multiple stop and send cycles', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // First cycle: Send tool execution message, stop it, send new one
      const firstToolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(firstToolMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify first message sent
      await expect(page.getByText(firstToolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for first tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Stop the first tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Verify first tool was stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Send a regular message after stopping
      const firstRegularMessage = "Hello, how are you?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(firstRegularMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify regular message appears
      await expect(page.getByText(firstRegularMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for response to regular message
      await expect(page.locator('text=Hello').or(page.locator('text=good')).or(page.locator('text=fine'))).toBeVisible({ timeout: 30000 });
      
      // Second cycle: Send another tool execution message, stop it, send different one
      const secondToolMessage = "show me the package.json file contents";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(secondToolMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify second message sent
      await expect(page.getByText(secondToolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for second tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Stop the second tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Verify second tool was stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // Send final message
      const finalMessage = "What is 3 + 3?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(finalMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify final message appears and gets answered
      await expect(page.getByText(finalMessage)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=The answer to 3 + 3 is 6').or(page.locator('text=3 + 3 = 6')).or(page.locator('text=equals 6')).first()).toBeVisible({ timeout: 30000 });
      
      // Clean up - close the session
      await page.getByRole('tab', { name: 'Details', exact: true }).click();
      await page.getByRole('button', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

    test('verify button states and interactions work correctly', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Initial state: Input should be enabled
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toBeEnabled();
      
      // Send a simple message first to verify basic functionality
      const simpleMessage = "Hello, how are you?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(simpleMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the message was sent
      await expect(page.getByText(simpleMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for response to simple message
      await expect(page.locator('text=Hello').or(page.locator('text=Hi')).or(page.locator('text=good')).first()).toBeVisible({ timeout: 30000 });
      
      // Now test tool execution with stop functionality
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the tool message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // During tool execution: Stop and Queue buttons should be available
      await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Queue' })).toBeVisible();
      
      // Input should still be enabled for queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toBeEnabled();
      
      // Test that we can stop tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Verify tool was stopped
      await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
      
      // After stopping, should be able to send new messages
      const afterStopMessage = "What is 1 + 1?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(afterStopMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the after-stop message appears and gets answered
      await expect(page.getByText(afterStopMessage)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=2').or(page.locator('text=equals 2')).first()).toBeVisible({ timeout: 30000 });
      
      // Clean up - close the session
      await page.getByRole('tab', { name: 'Details', exact: true }).click();
      await page.getByRole('button', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

    test('verify queue UI states and message processing', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Send a message that will trigger tool execution (where queue is definitely available)
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(toolMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the message was sent
      await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for tool execution to start
      await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Now queue a message while tool is running
      const queuedMessage = "What is 8 + 9?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // After queuing, Queue button should be disabled (indicating message is queued)
      await expect(page.getByRole('button', { name: 'Queue' })).toBeDisabled();
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Wait for tool execution to complete
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // After tool completes, verify queued message gets processed automatically
      await expect(page.getByText(queuedMessage)).toBeVisible({ timeout: 10000 });
      
      // Wait for LLM response to the queued message
      await expect(page.locator('text=17').or(page.locator('text=equals 17')).or(page.locator('text=8 + 9 = 17')).first()).toBeVisible({ timeout: 30000 });
      
      // After processing queued message, normal UI state should be restored
      // Note: Queue button may remain disabled when there's no active tool execution to queue against
      // This is the expected behavior - queue is only available during tool execution
      
      // Clean up - close the session
      await page.getByRole('tab', { name: 'Details', exact: true }).click();
      await page.getByRole('button', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

  });
});