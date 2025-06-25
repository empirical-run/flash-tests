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

  test('real-time session updates across multiple tabs', async ({ browser }) => {
    // Create two browser contexts for two separate tabs
    const context = await browser.newContext({
      storageState: 'playwright/.auth/user.json'
    });
    
    const firstTab = await context.newPage();
    const secondTab = await context.newPage();
    
    // First tab: Navigate to sessions list page
    await firstTab.goto('/');
    await expect(firstTab.getByText("Lorem Ipsum")).toBeVisible();
    await firstTab.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(firstTab).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Second tab: Navigate to sessions list page
    await secondTab.goto('/');
    await expect(secondTab.getByText("Lorem Ipsum")).toBeVisible();
    await secondTab.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(secondTab).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Second tab: Create a new session
    await secondTab.getByRole('button', { name: 'New' }).click();
    await secondTab.getByRole('button', { name: 'Create' }).click();
    await expect(secondTab).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Second tab: Send message with current time
    const currentTime = new Date().toLocaleTimeString();
    const message = `Current time is: ${currentTime}`;
    
    await secondTab.getByPlaceholder('Type your message...').click();
    await secondTab.getByPlaceholder('Type your message...').fill(message);
    await secondTab.getByRole('button', { name: 'Send' }).click();
    
    // Verify message appears in second tab
    await expect(secondTab.getByText(message)).toBeVisible({ timeout: 10000 });
    
    // First tab: Assert that the new session with the message is visible
    // The message should appear in the sessions list as a preview or in real-time updates
    await expect(firstTab.getByText(message, { exact: false })).toBeVisible({ timeout: 15000 });
    
    // Clean up: Close the session from second tab
    await secondTab.getByRole('tab', { name: 'Details', exact: true }).click();
    await secondTab.getByRole('button', { name: 'Close Session' }).click();
    await secondTab.getByRole('button', { name: 'Confirm' }).click();
    
    // Close the contexts
    await context.close();
  });
});