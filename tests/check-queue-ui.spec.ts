import { test, expect } from "./fixtures";

test.describe('Queue UI Investigation', () => {
  test('investigate UI elements for queue management', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();

    // Navigate to Sessions page and create session
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    trackCurrentSession(page);

    // Start a tool execution
    const messageInput = page.getByPlaceholder('Type your message');
    await messageInput.click();
    await messageInput.fill("what is inside package.json");
    await messageInput.press('Control+Enter');
    
    // Wait for tool to start
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 30000 });
    
    // Queue a message
    const queueInput = page.getByRole('textbox', { name: 'Type your message here...' });
    await queueInput.click();
    await queueInput.fill("test queue message");
    await queueInput.press('Control+Shift+Enter');
    
    // TODO(agent on page): Look for any UI buttons, icons, or elements that might allow clearing the queue. Check if there's a "Clear Queue", "Cancel Queue", or similar button. Also check if right-clicking shows context menu options for queue management.
  });
});