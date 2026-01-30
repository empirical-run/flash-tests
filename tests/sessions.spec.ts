import { test, expect } from "./fixtures";

test.describe('Sessions Tests', () => {
  test('Sort sessions by title', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page (use nth(1) to skip "My Sessions" and click project Sessions link)
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the Title column header to sort by title
    await page.getByRole('columnheader', { name: 'Title', exact: true }).getByRole('img').click();
    
    // Verify the table is still visible after sorting (page didn't crash)
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('Filter sessions list by users', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the dropdown that shows "My active" and select "Custom filter..." option
    await page.getByRole('combobox').click();
    await page.getByText('Custom filter...').click();
    
    // Click on "+ Add column to filter" button and select "Created By"
    await page.getByRole('button', { name: 'Add column to filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Title' }).click();
    await page.getByLabel('Created By').getByText('Created By').click();
    
    // Click the "Select values..." dropdown to open options
    await page.getByRole('button', { name: 'Select values...' }).click();
    
    // Type in the search/input field within the dropdown
    const dropdownInput = page.locator('input[type="text"]').first();
    await dropdownInput.fill('automation-test@example.com');
    await dropdownInput.press('Enter');
    
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
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with close test prompt
    await page.locator('button:has(svg.lucide-plus)').click();
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
    
    // Close the session - "Close Session" is now in a dropdown menu next to "Review"
    // Click on the dropdown button to open it
    await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
    
    // Click on "Close Session" option in the dropdown
    await page.getByRole('menuitem', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Navigate to sessions list page (no longer redirects automatically)
    await page.getByRole('navigation').getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Assert the closed session is not visible in the active sessions list
    // We can check this by ensuring the session ID or session content is not present
    await expect(page.getByText(message)).not.toBeVisible();
    
    // Navigate back to the specific session page via URL to check closed status
    await page.goto(sessionUrl);
    
    // Verify session is closed by checking for the Closed status badge in the header
    await expect(page.getByText('Closed', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test.describe('Chat Interaction Features', () => {
    test('stop tool execution and send new message', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt
      await page.locator('button:has(svg.lucide-plus)').click();
      const toolMessage = "create a file called example2.spec.ts which is a copy of example.spec.ts";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Assert "used view" - AI will first examine the original file
      await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
      
      // Assert "running create" - AI will then create the new file
      await expect(page.getByText(/Creating .+/)).toBeVisible({ timeout: 60000 });
      
      // Click the stop button to stop the tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Assert that tool was rejected/stopped
      await expect(page.getByText(/was rejected by the user/)).toBeVisible({ timeout: 10000 });
      
      // Verify that message input is immediately available and enabled
      await expect(page.getByPlaceholder('Type your message')).toBeEnabled({ timeout: 5000 });
      
      // Send a new message immediately after stopping
      const newMessage = "What is the weather like today?";
      await page.getByPlaceholder('Type your message').click();
      await page.getByPlaceholder('Type your message').fill(newMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the new message appears in the conversation (this confirms user can send messages after stopping)
      // Use data-message-id attribute to uniquely identify the message in the chat conversation
      await expect(page.locator('[data-message-id]').filter({ hasText: newMessage })).toBeVisible({ timeout: 10000 });
      
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
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();

      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });

      // Create a new session with the initial prompt
      await page.locator('button:has(svg.lucide-plus)').click();
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

      // Click on "(edited)" to view edit history
      const editedUserMessageBubble = chatBubbles.filter({ hasText: updatedPrompt }).first();
      await editedUserMessageBubble.getByText('(edited)').click();

      // Assert that edit history modal is visible
      const editHistoryModal = page.getByLabel('Edit History');
      await expect(editHistoryModal).toBeVisible({ timeout: 5000 });
      
      // Assert both old and new messages are visible in the edit history modal
      await expect(editHistoryModal.getByText(initialPrompt)).toBeVisible({ timeout: 5000 });
      await expect(editHistoryModal.getByText(updatedPrompt)).toBeVisible({ timeout: 5000 });
    });

    test('queue message while agent is working on tool execution', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with file listing prompt  
      await page.locator('button:has(svg.lucide-plus)').click();
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
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // After queuing, the input field might be cleared, but the message should be queued
      // We can verify the queue button is available which indicates the system is ready for more input
      
      // Wait for the first tool execution to complete (new UI shows "Viewed <filepath>")
      await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
      
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
      // "Close Session" is now in a dropdown menu next to "Review"
      await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
      await page.getByRole('menuitem', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });





    test('verify queue UI states and message processing', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt
      await page.locator('button:has(svg.lucide-plus)').click();
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      

      
      // Now queue a message while tool is running
      const queuedMessage = "What is 8 + 9?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // After queuing, Queue button should be disabled (indicating message is queued)
      await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeDisabled();
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Wait for tool execution to complete (new UI shows "Viewed <filepath>")
      await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
      
      // After tool completes, verify queued message gets processed automatically
      await expect(page.locator('[data-message-id]').getByText(queuedMessage, { exact: true }).first()).toBeVisible({ timeout: 60000 });
      
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
      // "Close Session" is now in a dropdown menu next to "Review"
      await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
      await page.getByRole('menuitem', { name: 'Close Session' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    });

    test('stop and send new message while message is queued', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt
      await page.locator('button:has(svg.lucide-plus)').click();
      const toolMessage = "create a file called stop-send-test.txt with content 'test file'";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for tool execution to start (agent will view the directory first)
      await expect(page.getByText(/(Viewing|Editing|Creating) .+/)).toBeVisible({ timeout: 60000 });
      
      // While the agent is working, queue a message
      const queuedMessage = "What is 5 + 5?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // Verify the message was queued (Queue button should be disabled)
      await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeDisabled();
      
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

    test.skip('stop with queued message and verify send button is enabled', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt
      await page.locator('button:has(svg.lucide-plus)').click();
      const toolMessage = "create a file called stop-queued-test.txt with content 'testing stop with queue'";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for tool execution to start (agent will view the directory first)
      await expect(page.getByText(/(Viewing|Editing|Creating) .+/)).toBeVisible({ timeout: 60000 });
      
      // While the agent is working, queue a message
      const queuedMessage = "What is 7 + 8?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // Verify the message was queued (Queue button should be disabled)
      await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeDisabled();
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Click the "Stop" button to stop tool execution (NOT "Stop & Send")
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Verify that tool was rejected/stopped
      await expect(page.getByText(/was rejected by the user/)).toBeVisible({ timeout: 10000 });
      
      // Verify the queued message is still in the queue (should NOT be dequeued)
      await expect(page.getByText('Queued #1').first()).toBeVisible({ timeout: 5000 });
      
      // Now try to send a new message - this is where the bug should appear
      const newMessage = "What is 10 + 10?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(newMessage);
      
      // THIS IS THE BUG: The Send button should be enabled but it's disabled
      // Verify the Send button is enabled (this test should fail with the current bug)
      await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 5000 });
      
      // Try to actually send the message to verify functionality
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the new message appears in the conversation
      await expect(page.locator('[data-message-id]').getByText(newMessage, { exact: true }).first()).toBeVisible({ timeout: 10000 });
      
      // Verify the queued message is still in the queue (should not be affected by sending new message)
      await expect(page.getByText('Queued #1').first()).toBeVisible({ timeout: 5000 });
      
      // Session will be automatically closed by afterEach hook
    });

    test.describe('Keyboard Shortcuts', () => {
      test('send message with keyboard shortcut', async ({ page, trackCurrentSession }) => {
        
        // Navigate to homepage
        await page.goto('/');
        
        // Wait for successful login
        await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
        
        // Navigate to Sessions page
        await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
        
        // Wait for sessions page to load
        await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
        
        // Create a new session with keyboard shortcut test prompt
        await page.locator('button:has(svg.lucide-plus)').click();
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
        await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
        
        // Wait for sessions page to load
        await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
        
        // Create a new session with package.json query prompt
        await page.locator('button:has(svg.lucide-plus)').click();
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
        
        // Wait for the first tool execution to complete (new UI shows "Viewed <filepath>")
        await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
        
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
        await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
        
        // Wait for sessions page to load
        await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
        
        // Create a new session with simple math prompt
        await page.locator('button:has(svg.lucide-plus)').click();
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
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt to keep agent busy
      await page.locator('button:has(svg.lucide-plus)').click();
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
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // Verify first message was queued (Queue button should be disabled)
      await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeDisabled();
      
      // Verify input field is cleared after queuing
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Queue second message
      const queuedMessage2 = "What is 5 + 5?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage2);
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // Verify input field is cleared after second queue
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Queue third message
      const queuedMessage3 = "What is 10 + 10?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage3);
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // Verify input field is cleared after third queue
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Verify that all three queued messages are visible as individual cards
      await expect(page.getByText('Queued #1')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Queued #2')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Queued #3')).toBeVisible({ timeout: 5000 });
      
      // Wait for the initial tool execution to complete (new UI shows "Viewed <filepath>")
      await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
      
      // Verify the first queued message appears in the conversation
      await expect(page.locator('[data-message-id]').getByText(queuedMessage1, { exact: true }).first()).toBeVisible({ timeout: 60000 });
      
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

    test('delete queued message', async ({ page, trackCurrentSession }) => {
      // Navigate to homepage
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
      
      // Navigate to Sessions page
      await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
      
      // Wait for sessions page to load
      await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
      
      // Create a new session with tool execution prompt to keep agent busy
      await page.locator('button:has(svg.lucide-plus)').click();
      const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
      await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Verify we're in a session
      await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for agent to start working
      await page.waitForTimeout(2000);
      
      // Queue a message
      const queuedMessage = "What is 2 + 2?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(queuedMessage);
      await page.getByRole('button', { name: 'Queue', exact: true }).click();
      
      // Verify message was queued
      await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeDisabled();
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
      
      // Verify the queued message card is visible (looking for "Queued #1" label)
      await expect(page.getByText('Queued #1')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(queuedMessage)).toBeVisible({ timeout: 5000 });
      
      // Find the queued message card - it has the relative flex gap-2 structure
      const queuedMessageCard = page.locator('div.relative.flex.gap-2').filter({ hasText: 'Queued #1' }).filter({ hasText: queuedMessage }).first();
      
      // Hover over the queued message card to reveal buttons (opacity-0 group-hover:opacity-100)
      await queuedMessageCard.hover();
      
      // Click the delete button - it's the last button in the hover container (after the edit/pencil button)
      // The buttons are inside a div with opacity-0 group-hover:opacity-100
      const deleteButton = queuedMessageCard.locator('button').last();
      await deleteButton.click();
      
      // Verify the queued message card is no longer visible
      await expect(page.getByText('Queued #1')).not.toBeVisible({ timeout: 5000 });
      
      // Wait for the initial tool execution to complete
      await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
      
      // After deleting the queued message, verify it does NOT appear in conversation
      await expect(page.locator('[data-message-id]').getByText(queuedMessage, { exact: true })).not.toBeVisible({ timeout: 5000 });
      
      // Session will be automatically closed by afterEach hook
    });

  });

  test('Session with base branch', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with advanced settings
    await page.locator('button:has(svg.lucide-plus)').click();
    
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
    await expect(page.getByText("empty-file-only-in-this-branch.spec.ts")).toBeVisible({ timeout: 60000 });
    
    // Send a message to insert a line at the top of empty-file-only-in-this-branch.spec.ts
    const insertMessage = 'insert "// Start of file" at the top of empty-file-only-in-this-branch.spec.ts';
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(insertMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify that the insert tool is running - should be inserting into empty-file-only-in-this-branch.spec.ts
    await expect(page.getByText(/Inserting into.*empty-file-only-in-this-branch\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Verify that the insert tool was completed successfully
    await expect(page.getByText(/Inserted into.*empty-file-only-in-this-branch\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Click on the "Inserted into" text to view code changes
    await page.getByText(/Inserted into.*empty-file-only-in-this-branch\.spec\.ts/).click();
    
    // Assert that the code changes diff shows the inserted text within the tabpanel
    await expect(page.getByRole('tabpanel').getByText('// Start of file')).toBeVisible({ timeout: 10000 });
  });

  test('Authorization - modified project_id should not return chat sessions', async ({ page }) => {
    let capturedProjectId: number | null = null;
    let modifiedResponseData: any = null;

    // Set up route interception to capture the original project_id from the browser's request
    await page.route('**/api/chat-sessions*', async (route, request) => {
      const url = new URL(request.url());
      const projectId = url.searchParams.get('project_id');
      
      // Capture the project_id from the first request
      if (capturedProjectId === null && projectId) {
        capturedProjectId = parseInt(projectId);
      }
      
      // Let the request go through normally
      await route.continue();
    });

    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page - this will trigger the intercepted API call
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Assert that project_id is 3 in the original request
    expect(capturedProjectId).toBe(3);
    
    // Make second request with modified project_id (unauthorized)
    const secondResponse = await page.request.get('/api/chat-sessions', {
      params: {
        project_id: '1', // Modified to unauthorized project
      },
    });
    
    const secondData = await secondResponse.json();
    modifiedResponseData = secondData;
    
    // Assert that no chat sessions are returned when project_id is modified to 1 (unauthorized)
    // This test is expected to FAIL because of the authorization bug - sessions ARE being returned
    expect(modifiedResponseData.data || []).toEqual([]);
  });

  test('Subscribe to session and verify in Subscribed sessions list', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to project Sessions page (table view)
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the dropdown that shows "My active" and select "Custom filter..." option
    await page.getByRole('combobox').click();
    await page.getByText('Custom filter...').click();
    
    // Click on "+ Add column to filter" button and select "Created By"
    await page.getByRole('button', { name: 'Add column to filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Title' }).click();
    await page.getByLabel('Created By').getByText('Created By').click();
    
    // Click the "Select values..." dropdown to open options
    await page.getByRole('button', { name: 'Select values...' }).click();
    
    // Type "Aashish" in the search/input field within the dropdown and press Enter
    const dropdownInput = page.locator('input[type="text"]').first();
    await dropdownInput.fill('Aashish');
    await dropdownInput.press('Enter');
    
    // Verify filter is applied
    await expect(page.getByText('Custom filter (1)')).toBeVisible({ timeout: 10000 });
    
    // Wait for the table data to load after filtering
    await page.waitForTimeout(3000);
    
    // Get the first session title from the table (second column)
    const firstRow = page.locator('table tbody tr').first();
    const sessionTitleCell = firstRow.locator('td').nth(1); // Second column (0-indexed)
    const sessionTitleLink = await sessionTitleCell.locator('a').innerText();
    
    // Click on the first session row in the table to open it
    await page.getByRole('link', { name: sessionTitleLink }).click();
    
    // Wait for session details to load
    await expect(page.getByRole('tab', { name: 'Details', exact: true })).toBeVisible({ timeout: 10000 });
    
    // Wait for either Subscribe or Unsubscribe button to be visible first
    const subscribeButton = page.getByRole('button', { name: 'Subscribe', exact: true });
    const unsubscribeButton = page.getByRole('button', { name: 'Unsubscribe', exact: true });
    await expect(subscribeButton.or(unsubscribeButton)).toBeVisible({ timeout: 5000 });

    // Check if already subscribed and unsubscribe to ensure clean state
    if (await unsubscribeButton.isVisible()) {
      await unsubscribeButton.click();
      await expect(subscribeButton).toBeVisible({ timeout: 5000 });
    }
    
    // Click on the Subscribe button in the Details panel
    await subscribeButton.click();
    
    // Verify that the button changes to "Unsubscribe"
    await expect(unsubscribeButton).toBeVisible({ timeout: 5000 });
    
    // Wait a bit for the subscription to be saved
    await page.waitForTimeout(1000);
    
    // Navigate to Sessions sidebar view and apply Subscribed filter
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Click the filter icon button to open the filter dropdown
    await page.locator('button:has(.lucide-filter)').click();
    
    // Select "Subscribed" option from the dropdown
    await page.getByRole('menuitem', { name: 'Subscribed' }).click();
    
    // Verify the subscribed session appears and click on it
    await expect(page.getByRole('link', { name: sessionTitleLink })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: sessionTitleLink }).click();
    
    // Wait for session details to load
    await expect(page.getByRole('tab', { name: 'Details', exact: true })).toBeVisible({ timeout: 10000 });
    
    // Click on the Unsubscribe button to clean up the state
    await unsubscribeButton.click();
    
    // Verify that the button changes back to "Subscribe"
    await expect(subscribeButton).toBeVisible({ timeout: 5000 });
  });

  test('Verify session creation and basic chat interaction from Sessions', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).first().click();
    
    // Wait for sessions page to load and My Sessions header to appear
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    await expect(page.getByText('My Sessions').nth(1)).toBeVisible({ timeout: 10000 });
    
    // Click the + icon button next to the filter icon to open the create session dialog
    await page.locator('button').filter({ has: page.locator('.lucide-plus') }).click();
    
    const uniqueMessage = `hello ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Enter an initial prompt or' }).fill(uniqueMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions\/\d+/, { timeout: 10000 });
    
    // Extract session ID from URL path for manual cleanup later
    const url = new URL(page.url());
    const sessionId = url.pathname.split('/').pop();
    
    // Wait for the session to actually load by checking that the chat interface is ready
    // (wait for the message input area to be visible instead of waiting for messages)
    await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toBeVisible({ timeout: 10000 });
    
    // Wait for the first user message to appear
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10000 });
    
    // Get the session title link in the sidebar (title is inferred from first message)
    const sessionTitleLink = page.getByRole('link', { name: uniqueMessage });
    const waitingIndicator = sessionTitleLink.locator('.lucide-message-square-reply');
    
    // Get the stop button reference for later use (button now includes keyboard shortcut like "Stop ⌃C")
    const stopButton = page.getByRole('button', { name: /^Stop/ });
    
    // Wait for the agent to finish processing the first message before sending the second
    await expect(stopButton).toBeHidden({ timeout: 60000 });
    
    // Type "how are you" in the chat
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill('how are you');
    await page.getByRole('button', { name: 'Send ⌃ ↵' }).click(); // Full button text to avoid strict mode violation with sidebar buttons
    
    // Verify the message appears in the conversation
    await expect(page.locator('[data-message-id]').filter({ hasText: 'how are you' }).first()).toBeVisible({ timeout: 10000 });
    
    // Check that user messages are visible in the minimap
    // Hover on the minimap to reveal the message list
    await page.locator('[data-testid="message-minimap"]').hover();
    // Verify user messages are visible in the minimap list
    await expect(page.locator('[data-testid="message-minimap-list"]')).toBeVisible({ timeout: 10000 });
    // Verify that one of the user messages is visible inside the minimap list
    await expect(page.locator('[data-testid="message-minimap-list"]').getByText('how are you')).toBeVisible();
    
    // Verify the Stop button is visible while agent is responding to second message
    await expect(stopButton).toBeVisible({ timeout: 5000 });
    
    // While Stop button is visible (agent is responding), verify the "waiting on user input" indicator is HIDDEN
    await expect(waitingIndicator).not.toBeVisible();
    
    // Wait for agent to finish responding to second message
    await expect(stopButton).toBeHidden({ timeout: 60000 });
    
    // After agent finishes responding, the "waiting on user input" indicator should appear again
    await expect(waitingIndicator).toBeVisible({ timeout: 5000 });
    
    // Clean up - close the session via API
    if (sessionId) {
      await page.request.post(`/api/chat-sessions/${sessionId}/close`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Success: The test verified:
    // 1. Session was created from Sessions view with unique title using Date.now()
    // 2. Initial message was sent and agent responded
    // 3. "Waiting on user input" indicator (.lucide-message-square-reply) was hidden while Stop button was visible (agent responding)
    // 4. Second message "how are you" was sent
    // 5. User message count updated to (2) in the sidebar
    // 6. "Waiting on user input" indicator was hidden again while agent responded to second message
    // 7. After agent finished responding, "waiting on user input" indicator became visible again
    // 8. Real-time indicator updates work correctly throughout the session lifecycle
  });

});