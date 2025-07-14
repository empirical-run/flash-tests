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

  test('investigate browser agent status', async ({ page }) => {
    await page.goto('/');
    
    // TODO(agent on page): Navigate to Sessions, create new session, send message "write a new test that navigates to https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/ and clicks on the button. use browser agent to help here. Make sure to ask the browser agent to only click on the button on the page and do nothing else" and wait for completion, then check final status and results
  });

  test('Verify browser agent works', async ({ page }) => {
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
    
    // Send the message requesting browser agent assistance
    const toolMessage = "write a new test that navigates to https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/ and clicks on the button. use browser agent to help here";
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for "Running generateTestWithBrowserAgent" text - this can take up to 2 mins
    await expect(page.getByText("Running generateTestWithBrowserAgent")).toBeVisible({ timeout: 120000 });
    
    // Wait for completion - could be "Used" or other completion states
    await expect(page.locator('text=/Used generateTestWithBrowserAgent|generateTestWithBrowserAgent.*completed|generateTestWithBrowserAgent.*finished|generateTestWithBrowserAgent.*done/i')).toBeVisible({ timeout: 300000 });
    
    // Try to find and click on the completion text
    const completionText = await page.locator('text=/Used generateTestWithBrowserAgent|generateTestWithBrowserAgent.*completed|generateTestWithBrowserAgent.*finished|generateTestWithBrowserAgent.*done/i').first();
    await completionText.click();
    
    // Function details should be visible, and we should be able to assert for "popup" text
    await expect(page.getByText("popup")).toBeVisible({ timeout: 10000 });
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });
});