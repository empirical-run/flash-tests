import { test, expect } from "./fixtures";

test.describe("Queued Messages", () => {
  test("investigate queued messages status", async ({ page }) => {
    await page.goto("/");
    // TODO(agent on page): Navigate to sessions, create a new session, send message "list all files in the root dir of the repo. no need to do anything else", wait to see if any tool execution starts, then quickly send second message "also read the readme" using Ctrl+Shift+Enter and check for any queue indicators
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
    
    // Send first message that will trigger tool execution
    const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Immediately send second message with Ctrl+Shift+Enter to queue it
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill('also read the readme');
    await page.keyboard.press('ControlOrMeta+Shift+Enter');
    
    // Assert that "Queued" status is visible for the second message
    await expect(page.getByText("Queued")).toBeVisible({ timeout: 10000 });
  });
});