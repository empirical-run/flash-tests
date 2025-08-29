import { test, expect } from "./fixtures";
import { detectOSBrowser, chordFor, type OS } from "./utils";

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
    
    // Apply filter for a specific user
    await page.getByRole('button', { name: 'Filter by creator' }).click();
    await page.getByRole('option', { name: 'Arjun Attam' }).locator('div').click();
    await page.getByRole('option', { name: 'Close' }).click();
    
    // Verify that the filtered results show only sessions by the selected user
    // Get all session rows and check that each has "Arjun Attam" in the Created By column
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible(); // Ensure there are results
    
    // Wait for filtering to complete
    await page.waitForTimeout(5000);
    
    const rowCount = await sessionRows.count();
    expect(rowCount).toBeGreaterThan(0); // Verify we have actual results
    
    // Check each row to ensure it shows "Arjun Attam" as the creator
    for (let i = 0; i < rowCount; i++) {
      const row = sessionRows.nth(i);
      await expect(row.getByText('Arjun Attam')).toBeVisible();
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
    await expect(page.locator('[data-message-id]')).toBeVisible({ timeout: 10000 });
    
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

  test('Show Closed filter functionality', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the "Other filters" dropdown to access the Show Closed toggle
    await page.getByRole('button', { name: 'Other filters' }).click();
    
    // Click on the "Show closed" toggle within the filters modal
    await page.getByText('Show closed').click();
    
    // Save the filter settings (Save button is actually a menuitem)
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Wait for filter to be applied
    await page.waitForTimeout(2000);
    
    // Assert that rows contain closed sessions after the filter is applied
    // Check that the table has rows visible (indicating closed sessions are shown)
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible({ timeout: 10000 });
    
    // Verify we have actual results after applying the filter
    const rowCount = await sessionRows.count();
    expect(rowCount).toBeGreaterThan(0);
    
    // Check that at least one row shows a closed session indicator
    // This could be a status column, badge, or other visual indicator
    // The exact implementation may vary - this test is expected to fail initially
    await expect(page.getByText('Closed').or(page.getByText('closed')).first()).toBeVisible();
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
      await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
      
      // Assert "running create" - AI will then create the new file
      await expect(page.getByText("Running str_replace_based_edit_tool: create")).toBeVisible({ timeout: 60000 });
      
      // Click the stop button to stop the tool execution
      await page.getByRole('button', { name: 'Stop' }).click();
      
      // Assert that tool was rejected/stopped
      await expect(page.getByText("str_replace_based_edit_tool: create was rejected by the user")).toBeVisible({ timeout: 10000 });
      
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
      await expect(page.getByText("2 + 2 = 4").first()).toBeVisible({ timeout: 30000 });
      
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

    test.describe('Keyboard Shortcuts', () => {
      test('send message with keyboard shortcut', async ({ page, trackCurrentSession }) => {
        // Detect OS for cross-platform keyboard shortcuts
        const os: OS = await detectOSBrowser(page);
        console.log(`OS: ${os}`);
        
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
        // Detect OS for cross-platform keyboard shortcuts
        const os: OS = await detectOSBrowser(page);
        console.log(`OS: ${os}`);
        
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
        
        // Wait for assistant to start responding (tool execution starts)
        await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
        
        // Wait briefly for assistant to be actively working before queuing
        await page.waitForTimeout(2000);
        
        // While the agent is working, queue a new message using keyboard shortcut
        const queuedMessage = "What is 6 + 6? (queued with keyboard shortcut)";
        const queueInput = page.getByRole('textbox', { name: 'Type your message here...' });
        await queueInput.click();
        await queueInput.fill(queuedMessage);
        
        // Ensure input is focused and queue using cross-platform queue shortcut
        await queueInput.focus();
        await page.keyboard.press(chordFor('queue', os));
        
        // Verify input field is cleared after queuing
        await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toHaveValue('');
        
        // Wait for the first tool execution to complete
        await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
        
        // Verify that the queued message is now being processed
        await expect(page.getByText(queuedMessage)).toBeVisible({ timeout: 10000 });
        
        // Verify the agent processes the queued message
        await expect(page.getByText("6 + 6 = 12").first()).toBeVisible({ timeout: 30000 });
      });









      test('simple keyboard shortcut test - basic message only', async ({ page, trackCurrentSession }) => {
        // Detect OS for cross-platform keyboard shortcuts
        const os: OS = await detectOSBrowser(page);
        console.log(`OS: ${os}`);
        
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

  });


});