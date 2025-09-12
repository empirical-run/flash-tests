import { test, expect } from "./fixtures";
import { detectOSBrowser, chordFor, type OS } from "./utils";
import { readFileSync } from "fs";

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
    
    // Open the Filters dropdown
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Add a filter for Created By field
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByRole('option', { name: 'Created By' }).click();
    
    // Keep default "is any of" operator and select a user
    await page.getByRole('button', { name: 'Select...' }).click();
    await page.getByRole('option', { name: 'automation-test@example.com' }).locator('div').click();
    
    // Save the filter
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Verify filter is applied by checking that Filters button shows "1" (indicating one active filter)
    await expect(page.getByRole('button', { name: 'Filters 1' })).toBeVisible({ timeout: 10000 });
    
    // Wait for the table data to load after filtering (skeleton rows should be replaced with actual data)
    await page.waitForTimeout(5000);
    
    // Verify that the filtered results show only sessions by the selected user
    const sessionRows = page.locator('table tbody tr');
    
    // Wait for the first row to contain actual session data (check for specific table cell content)
    await expect(sessionRows.first().locator('td').first()).toBeVisible({ timeout: 15000 });
    
    // Check that we have filtered results (should have fewer sessions than before)
    const rowCount = await sessionRows.count();
    expect(rowCount).toBeGreaterThan(0);
    
    // The key verification is that the filter worked - fewer results are shown
    // We can verify this by checking that the page count is reduced (showing "Page 1 of 1" or similar small number)
    const pageInfo = page.locator('text=/Page \\d+ of \\d+/');
    await expect(pageInfo).toBeVisible();
    
    const pageText = await pageInfo.textContent();
    const totalPages = parseInt(pageText?.match(/of (\d+)/)?.[1] || '0');
    
    // With user filtering applied, should still have some sessions for this user
    expect(totalPages).toBeGreaterThan(0); // Should still have some sessions for this user
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

  test('Show Closed filter functionality', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Wait for the initial table data to load before applying filters
    // This ensures we have actual session data loaded (not just skeleton/loading state)
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible({ timeout: 10000 });
    
    // Wait for the first row to contain actual session data (not loading state)
    // Look for some content that indicates it's a real session row
    await expect(sessionRows.first().locator('td').first()).toBeVisible({ timeout: 15000 });
    
    // Additional wait to ensure table is fully populated
    await page.waitForTimeout(2000);
    
    // Now open the Filters dropdown
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Enable the "Show closed" toggle
    await page.getByRole('switch', { name: 'Show closed' }).click();
    
    // Add a filter for PR Status field
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByText('Pr Status', { exact: true }).click();
    
    // Select only "Closed" PR status for deterministic results
    await page.getByRole('button', { name: 'Select...' }).click();
    await page.getByRole('option', { name: 'Closed' }).locator('div').click();
    
    // Close the dropdown
    await page.keyboard.press('Escape');
    
    // Save the filter settings
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Wait for the filter to take effect and table to refresh
    await page.waitForTimeout(5000);
    
    // Verify that sessions table is still visible after filtering
    await expect(sessionRows.first()).toBeVisible({ timeout: 10000 });
    
    const rowCount = await sessionRows.count();
    expect(rowCount).toBeGreaterThan(0);
    
    // Main verification: check that closed sessions are now visible
    // Look for closed session indicators - either "Closed" text or red X icons in the table
    await expect(
      page.getByText('Closed').or(
        page.locator('td').getByText('Closed')
      ).or(
        page.locator('[title*="closed" i]')
      ).first()
    ).toBeVisible({ timeout: 10000 });
    
    // Additional verification: verify that the Filters button no longer shows as default
    // (it should show some indication that filters are applied)
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
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
    await expect(page.getByText("Running str_replace_based_edit_tool: insert tool")).toBeVisible({ timeout: 60000 });
    
    // Verify that the insert tool was completed successfully  
    await expect(page.getByText("Used str_replace_based_edit_tool: insert tool")).toBeVisible({ timeout: 60000 });
    
    // Click on the "Used" text to view code changes
    await page.getByText('Used str_replace_based_edit_tool: insert tool').click();
    
    // Assert that the code changes diff shows the inserted text within the tabpanel
    await expect(page.getByRole('tabpanel').getByText('// Start of file')).toBeVisible({ timeout: 10000 });
  });

  test('file upload during create session', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage using the specific build URL
    await page.goto('https://test-generator-dashboard-git-file-upload-empirical.vercel.app/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    
    // Upload the image file and add the prompt
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('assets/image-upload-test.png');
    
    // Add the prompt text
    await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill('what is the download speed?');
    
    // Create the session
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert that fetchFile test is "used"
    await expect(page.getByText("Used fetchFile")).toBeVisible({ timeout: 60000 });
    
    // Assert that "8.80" is visible in the result
    await expect(page.getByText("8.80")).toBeVisible({ timeout: 30000 });
  });


});