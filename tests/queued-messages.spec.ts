import { test, expect } from "./fixtures";

test.describe("Queued Messages", () => {
  test("investigate tool execution status", async ({ page }) => {
    await page.goto("/");
    // TODO(agent on page): Click Sessions link, click New button, click Create button, type "list all files in tests dir" in message box, press Ctrl+Enter, then observe and report what status text appears for the tool execution
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
    
    // Send first message "list all files in tests dir" with Ctrl+Enter
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill('list all files in tests dir');
    await page.keyboard.press('ControlOrMeta+Enter');
    
    // Assert that tool call "Running" is visible (wait for tool execution to start)
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Send second message "also read the readme" with Ctrl+Shift+Enter while first tool is running
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill('also read the readme');
    await page.keyboard.press('ControlOrMeta+Shift+Enter');
    
    // Assert that "message queued" is visible
    await expect(page.getByText("Queued")).toBeVisible({ timeout: 10000 });
  });
});