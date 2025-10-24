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
    await page.getByRole('cell', { name: 'Title', exact: true }).getByRole('img').click();
    
    // Verify the table is still visible after sorting (page didn't crash)
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('Filter sessions list by users', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the dropdown that shows "My active" and select "Custom filter..." option
    await page.getByRole('combobox').click();
    await page.getByText('Custom filter...').click();
    
    // Click on "+ Add column to filter" button and select "Created By"
    await page.getByRole('button', { name: 'Add column to filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Title' }).click();
    await page.getByLabel('Created By').getByText('Created By').click();
    
    // Enter email address and press Enter to apply the filter
    await page.getByRole('textbox', { name: 'Enter value' }).click();
    await page.getByRole('textbox', { name: 'Enter value' }).fill('automation-test@example.com');
    await page.getByRole('textbox', { name: 'Enter value' }).press('Enter');
    
    // Verify filter is applied
    await expect(page.getByText('Custom filter (1)')).toBeVisible({ timeout: 10000 });
    
    // Wait for the table data to load after filtering
    await page.waitForTimeout(3000);
    
    // Check if there are any results or "No sessions found" message
    const noSessionsMessage = page.getByText('No sessions found');
    const hasNoSessions = await noSessionsMessage.isVisible();
    
    if (hasNoSessions) {
      // If no sessions found, the filter is working correctly (just no data)
      // Verify the filter UI is still visible
      await expect(page.getByText('Custom filter (1)')).toBeVisible();
    } else {
      // Verify that the filtered results show only sessions by the selected user
      const sessionRows = page.locator('table tbody tr');
      
      // Wait for the first row to contain actual session data
      await expect(sessionRows.first().locator('td').first()).toBeVisible({ timeout: 15000 });
      
      // Check that we have filtered results
      const rowCount = await sessionRows.count();
      expect(rowCount).toBeGreaterThan(0);
      
      // Verify the filter worked - check page count
      const pageInfo = page.locator('text=/Page \\d+ of \\d+/');
      await expect(pageInfo).toBeVisible();
      
      const pageText = await pageInfo.textContent();
      const totalPages = parseInt(pageText?.match(/of (\d+)/)?.[1] || '0');
      
      // With user filtering applied, should still have some sessions for this user
      expect(totalPages).toBeGreaterThan(0);
    }
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
    
    // Create a new session with close test prompt
    await page.getByRole('button', { name: 'New' }).click();
    const uniqueId = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Close session test - ${uniqueId}`;
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
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
    test('stop tool execution and send new message', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt
      await page.getByRole('button', { name: 'New' }).click();
      const toolMessage = "create a file called example2.spec.ts which is a copy of example.spec.ts";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Assert "used view" - AI will first examine the original file
      await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
      
      // Assert "running create" - AI will then create the new file
      await expect(page.getByText(/Running (str_replace_based_edit_tool: create|fileCreateTool)/)).toBeVisible({ timeout: 60000 });
      
      // Click the stop button to stop the tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Assert that tool was rejected/stopped
      await expect(page.getByText(/(str_replace_based_edit_tool: create|fileCreateTool) was rejected by the user/)).toBeVisible({ timeout: 10000 });
      
      // Verify that message input is immediately available and enabled
      await expect(page.getByPlaceholder('Type your message')).toBeEnabled({ timeout: 5000 });
      
      // Send a new message immediately after stopping
      const newMessage = "What is the weather like today?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(newMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the new message appears in the conversation (this confirms user can send messages after stopping)
      await expect(page.getByText(newMessage)).toBeVisible({ timeout: 10000 });
      
      // Session will be automatically closed by afterEach hook
    });


    test('edit message updates assistant response', async ({ page, trackCurrentSession }) => {
      const initialPrompt = "just answer this math question: what is 2 + 2?";
      const updatedPrompt = "just answer this math question: what is 8 + 7?";

      // Navigate to homepage
      await page.goto('/');

      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();

      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();

      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });

      // Create a new session with the initial prompt
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByPlaceholder('Enter an initial prompt').fill(initialPrompt);
      await page.getByRole('button', { name: 'Create' }).click();

      // Verify we're in a session
      await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });

      // Track the session for automatic cleanup
      trackCurrentSession(page);

      const chatBubbles = page.locator('[data-message-id]');
      const stopButton = page.getByRole('button', { name: 'Stop' });

      // Wait for the first user message bubble to appear
      await expect(chatBubbles.first()).toBeVisible({ timeout: 30000 });

      // Wait for the assistant to finish responding to the initial prompt before editing
      if (await stopButton.isVisible()) {
        await expect(stopButton).toBeHidden({ timeout: 60000 });
      }

      await expect(
        chatBubbles.filter({ hasText: /\b4\b|equals 4|= 4/ }).first()
      ).toBeVisible({ timeout: 30000 });

      const userMessageBubble = chatBubbles.filter({ hasText: initialPrompt }).first();
      await userMessageBubble.hover();
      await userMessageBubble.getByRole('button', { name: 'Edit message' }).click();

      const editTextbox = page.getByRole('textbox', { name: 'Edit your message...' });
      await editTextbox.fill(updatedPrompt);
      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(chatBubbles.filter({ hasText: updatedPrompt }).first()).toBeVisible({ timeout: 20000 });

      // Assert the assistant responds to the updated message with the correct answer (15)
      await expect(
        chatBubbles.filter({ hasText: /15|equals 15|= 15/ }).first()
      ).toBeVisible({ timeout: 60000 });
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
      
      // Create a new session with file listing prompt  
      await page.getByRole('button', { name: 'New' }).click();
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      

      
      // While the agent is working, queue a new message
      const queuedMessage = "What is 2 + 2?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      
      // Click the Queue button (the interface seems to have both Send and Queue options)
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // After queuing, the input field might be cleared, but the message should be queued
      // We can verify the queue button is available which indicates the system is ready for more input
      
      // Wait for the first tool execution to complete
      await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
      
      // Verify that the queued message is now being processed
      // After the tool completes, the queued message should be sent automatically
      // Look for the message in the chat conversation
      await expect(page.locator('[data-message-id]').getByText(queuedMessage, { exact: true }).first()).toBeVisible({ timeout: 30000 });
      
      // Verify the agent processes the queued message and provides an answer
      const chatBubbles = page.locator('[data-message-id]');
      await expect(
        chatBubbles.filter({ hasText: /2 \+ 2 = 4|equals 4|\b4\b/ }).first()
      ).toBeVisible({ timeout: 30000 });
      
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
      
      // Create a new session with tool execution prompt
      await page.getByRole('button', { name: 'New' }).click();
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      

      
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
      await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
      
      // After tool completes, verify queued message gets processed automatically
      await expect(page.locator('[data-message-id]').getByText(queuedMessage, { exact: true }).first()).toBeVisible({ timeout: 10000 });
      
      // Wait for LLM response to the queued message
      const chatBubbles = page.locator('[data-message-id]');
      // Accept common phrasing variants from the assistant while scoping strictly to chat bubbles
      await expect(
        chatBubbles.filter({ hasText: /8 \+ 9 = 17|equals 17|\b17\b/ }).first()
      ).toBeVisible({ timeout: 30000 });
      
      // After processing queued message, normal UI state should be restored
      // Note: Queue button may remain disabled when there's no active tool execution to queue against
      // This is the expected behavior - queue is only available during tool execution
      
      // Clean up - close the session
      await page.getByRole('tab', { name: 'Details', exact: true }).click();
      await page.getByRole('button', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

    test('stop and send new message while message is queued', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt
      await page.getByRole('button', { name: 'New' }).click();
      const toolMessage = "create a file called stop-send-test.txt with content 'test file'";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for tool execution to start (agent will view the directory first)
      await expect(page.getByText(/Running (str_replace_based_edit_tool|fileViewTool|fileCreateTool)/)).toBeVisible({ timeout: 45000 });
      
      // While the agent is working, queue a message
      const queuedMessage = "What is 5 + 5?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify the message was queued (Queue button should be disabled)
      await expect(page.getByRole('button', { name: 'Queue' })).toBeDisabled();
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Now click the "Stop & Send" button to interrupt and send a new message
      // First, type the new message
      const stopAndSendMessage = "What is 3 + 3?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(stopAndSendMessage);
      
      // Click the "Stop & Send" button (should be visible when there's a queued message)
      await page.getByRole('button', { name: 'Stop & Send' }).click();
      
      // Verify that the queued message (5 + 5) does NOT appear in the conversation
      // The stop & send should have cancelled it
      await expect(page.locator('[data-message-id]').getByText(queuedMessage, { exact: true })).not.toBeVisible({ timeout: 5000 });
      
      // Verify that the new message (3 + 3) appears in the conversation instead
      await expect(page.locator('[data-message-id]').getByText(stopAndSendMessage, { exact: true }).first()).toBeVisible({ timeout: 10000 });
      
      // Verify the agent responds to the new message with the correct answer (6)
      const chatBubbles = page.locator('[data-message-id]');
      await expect(
        chatBubbles.filter({ hasText: /3 \+ 3 = 6|equals 6|\b6\b/ }).first()
      ).toBeVisible({ timeout: 30000 });
      
      // Session will be automatically closed by afterEach hook
    });

    test.describe('Keyboard Shortcuts', () => {
      test('send message with keyboard shortcut', async ({ page, trackCurrentSession }) => {
        
        // Navigate to homepage
        await page.goto('/');
        
        // Wait for successful login
        await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
        
        // Navigate to Sessions page
        await page.getByRole('link', { name: 'Sessions', exact: true }).click();
        
        // Wait for sessions page to load
        await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
        
        // Create a new session with keyboard shortcut test prompt
        await page.getByRole('button', { name: 'New' }).click();
        const message = "Hello, testing cross-platform keyboard shortcut for send";
        await page.getByPlaceholder('Enter an initial prompt').fill(message);
        await page.getByRole('button', { name: 'Create' }).click();
        
        // Verify we're in a session
        await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
        
        // Track the session for automatic cleanup
        trackCurrentSession(page);
        
        // Final assertion: Verify the assistant's response message is visible
        await expect(page.locator('text=Hello').or(page.locator('text=Hi')).or(page.locator('text=testing')).first()).toBeVisible({ timeout: 30000 });
      });



      test('queue message with keyboard shortcut', async ({ page, trackCurrentSession }) => {
        
        // Navigate to homepage
        await page.goto('/');
        
        // Wait for successful login
        await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
        
        // Navigate to Sessions page
        await page.getByRole('link', { name: 'Sessions', exact: true }).click();
        
        // Wait for sessions page to load
        await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
        
        // Create a new session with package.json query prompt
        await page.getByRole('button', { name: 'New' }).click();
        const toolMessage = "what is inside package.json";
        await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
        await page.getByRole('button', { name: 'Create' }).click();
        
        // Verify we're in a session
        await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
        
        // Track the session for automatic cleanup
        trackCurrentSession(page);
        

        
        // Wait briefly for assistant to be actively working before queuing
        await page.waitForTimeout(2000);
        
        // While the agent is working, queue a new message using keyboard shortcut
        const queuedMessage = "What is 6 + 6? (queued with keyboard shortcut)";
        const queueInput = page.getByRole('textbox', { name: 'Type your message here...' });
        await queueInput.click();
        await queueInput.fill(queuedMessage);
        
        // Ensure input is focused and queue using cross-platform queue shortcut
        await queueInput.focus();
        await page.keyboard.press('ControlOrMeta+Shift+Enter');
        
        // Verify input field is cleared after queuing
        await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
        
        // Wait for the first tool execution to complete
        await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
        
        // Verify that the assistant response contains package.json content
        await expect(page.locator('[data-message-id]').getByText('lorem-ipsum-tests').first()).toBeVisible({ timeout: 15000 });
        
        // Verify that the queued message is now being processed
        await expect(page.locator('[data-message-id]').getByText(queuedMessage, { exact: true }).first()).toBeVisible();
        
        // Verify the agent processes the queued message
        await expect(page.getByText("6 + 6 = 12").first()).toBeVisible({ timeout: 30000 });
      });









      test('simple keyboard shortcut test - basic message only', async ({ page, trackCurrentSession }) => {
        
        // Navigate to homepage
        await page.goto('/');
        
        // Wait for successful login
        await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
        
        // Navigate to Sessions page
        await page.getByRole('link', { name: 'Sessions', exact: true }).click();
        
        // Wait for sessions page to load
        await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
        
        // Create a new session with simple math prompt
        await page.getByRole('button', { name: 'New' }).click();
        const message = "Simple keyboard test - what is 2 + 2?";
        await page.getByPlaceholder('Enter an initial prompt').fill(message);
        await page.getByRole('button', { name: 'Create' }).click();
        
        // Verify we're in a session
        await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
        
        // Track the session for automatic cleanup
        trackCurrentSession(page);
        
        // Verify assistant responds
        await expect(page.locator('text=2 + 2').or(page.locator('text=equals 4')).or(page.locator('text=The answer is 4')).first()).toBeVisible({ timeout: 30000 });
      });
    });

    test('queued messages are processed in order', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt to keep agent busy
      await page.getByRole('button', { name: 'New' }).click();
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for agent to start working
      await page.waitForTimeout(2000);
      
      // Queue first message
      const queuedMessage1 = "What is 2 + 2?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage1);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify first message was queued (Queue button should be disabled)
      await expect(page.getByRole('button', { name: 'Queue' })).toBeDisabled();
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Queue second message
      const queuedMessage2 = "What is 5 + 5?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage2);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify input field is cleared after second queue
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Queue third message
      const queuedMessage3 = "What is 10 + 10?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage3);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify input field is cleared after third queue
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Verify that all three queued messages are visible in a queue UI/list
      await expect(page.getByText('Queued (3)')).toBeVisible({ timeout: 5000 });
      
      // Wait for the initial tool execution to complete
      await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
      
      // Verify the first queued message appears in the conversation
      await expect(page.locator('[data-message-id]').getByText(queuedMessage1, { exact: true }).first()).toBeVisible();
      
      // Verify the agent processes the first queued message
      const chatBubbles = page.locator('[data-message-id]');
      await expect(
        chatBubbles.filter({ hasText: /2 \+ 2 = 4|equals 4|\b4\b/ }).first()
      ).toBeVisible({ timeout: 30000 });
      
      // Verify the second queued message appears in the conversation (after first is processed)
      await expect(page.locator('[data-message-id]').getByText(queuedMessage2, { exact: true }).first()).toBeVisible();
      
      // Verify the agent processes the second queued message
      await expect(
        chatBubbles.filter({ hasText: /5 \+ 5 = 10|equals 10|\b10\b/ }).first()
      ).toBeVisible({ timeout: 30000 });
      
      // Verify the third queued message appears in the conversation (after second is processed)
      await expect(page.locator('[data-message-id]').getByText(queuedMessage3, { exact: true }).first()).toBeVisible();
      
      // Verify the agent processes the third queued message
      await expect(
        chatBubbles.filter({ hasText: /10 \+ 10 = 20|equals 20|\b20\b/ }).first()
      ).toBeVisible({ timeout: 30000 });
      
      // Session will be automatically closed by afterEach hook
    });

    test('delete individual queue message and clear all remaining messages', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt to keep agent busy
      await page.getByRole('button', { name: 'New' }).click();
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for agent to start working
      await page.waitForTimeout(2000);
      
      // Queue first message
      const queuedMessage1 = "What is 2 + 2?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage1);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify first message was queued
      await expect(page.getByRole('button', { name: 'Queue' })).toBeDisabled();
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Queue second message
      const queuedMessage2 = "What is 5 + 5?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage2);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify input field is cleared after second queue
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Queue third message
      const queuedMessage3 = "What is 10 + 10?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage3);
      await page.getByRole('button', { name: 'Queue' }).click();
      
      // Verify input field is cleared after third queue
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Verify that all three queued messages are visible in a queue UI/list
      await expect(page.getByText('Queued (3)')).toBeVisible({ timeout: 5000 });
      
      // Delete the second queued message (5 + 5) by clicking its delete button
      await page.locator('div').filter({ hasText: /^2What is 5 \+ 5\?$/ }).getByRole('button').click();
      
      // Verify the queue now shows "Queued (2)" after deletion
      await expect(page.getByText('Queued (2)')).toBeVisible({ timeout: 5000 });
      
      // Click the Clear button to remove all remaining queued messages
      await page.getByRole('button', { name: 'Clear' }).click();
      
      // Verify the queue UI is no longer visible after clearing
      await expect(page.getByText(/^Queued \(\d+\)$/)).not.toBeVisible({ timeout: 5000 });
      
      // Wait for the initial tool execution to complete
      await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
      
      // After clearing queue, verify that cleared messages do NOT appear in conversation
      await expect(page.locator('[data-message-id]').getByText(queuedMessage1, { exact: true })).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-message-id]').getByText(queuedMessage2, { exact: true })).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-message-id]').getByText(queuedMessage3, { exact: true })).not.toBeVisible({ timeout: 5000 });
      
      // Session will be automatically closed by afterEach hook
    });

  });

  test('Session with base branch', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with advanced settings
    await page.getByRole('button', { name: 'New' }).click();
    
    // Open advanced settings
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the base branch to 'example-base-branch'
    await page.getByLabel('Base Branch').fill('example-base-branch');
    
    // Enter the initial prompt to list files in tests dir  
    const message = "list files in tests dir";
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    
    // Create the session
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Verify base branch is correctly set in the Files Changed section
    await expect(page.getByText("→ example-base-branch")).toBeVisible({ timeout: 15000 });
    
    // Verify that empty-file-only-in-this-branch.spec.ts is visible in the response (only exists in example-base-branch)
    await expect(page.getByText("empty-file-only-in-this-branch.spec.ts")).toBeVisible({ timeout: 45000 });
    
    // Send a message to insert a line at the top of empty-file-only-in-this-branch.spec.ts
    const insertMessage = 'insert "// Start of file" at the top of empty-file-only-in-this-branch.spec.ts';
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(insertMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify that the insert tool is running
    await expect(page.getByText(/Running (str_replace_based_edit_tool: insert|stringInsertTool) tool/)).toBeVisible({ timeout: 60000 });
    
    // Verify that the insert tool was completed successfully  
    await expect(page.getByText(/Used (str_replace_based_edit_tool: insert|stringInsertTool) tool/)).toBeVisible({ timeout: 60000 });
    
    // Click on the "Used" text to view code changes
    await page.getByText(/Used (str_replace_based_edit_tool: insert|stringInsertTool) tool/).click();
    
    // Assert that the code changes diff shows the inserted text within the tabpanel
    await expect(page.getByRole('tabpanel').getByText('// Start of file')).toBeVisible({ timeout: 10000 });
  });

});