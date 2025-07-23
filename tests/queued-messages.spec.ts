import { test, expect } from "./fixtures";

test.describe("Queued Messages", () => {
  test("investigate queued messages status", async ({ page }) => {
    await page.goto("/");
    // TODO(agent on page): Navigate to sessions, create a new session, send message "list all files in tests dir" with Ctrl+Enter, wait and check current status and results, then send another message "also read the readme" with Ctrl+Shift+Enter and check for queue status
  });

  test("verify message queuing works when tool is running", async ({ page }) => {
    // Navigate to homepage
    await page.goto("/");
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send first message "list all files in tests dir" using regular send button like other tests
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill('list all files in tests dir');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Assert that tool call "Running" is visible (wait for tool execution to start)
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Send second message "also read the readme" with Ctrl+Shift+Enter while first tool is running
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill('also read the readme');
    await page.keyboard.press('ControlOrMeta+Shift+Enter');
    
    // Assert that "message queued" is visible
    await expect(page.getByText("Queued")).toBeVisible({ timeout: 10000 });
  });
});