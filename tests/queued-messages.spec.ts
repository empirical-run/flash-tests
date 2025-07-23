import { test, expect } from "./fixtures";

test.describe("Queued Messages", () => {
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
    
    // Send first message "list all files in tests dir" with Ctrl/Meta + Enter
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill("list all files in tests dir");
    
    // Press Ctrl+Enter (or Meta+Enter on Mac)
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+Enter');
    } else {
      await page.keyboard.press('Control+Enter');
    }
    
    // Assert that tool call "running..." is visible
    await expect(page.getByText("running...")).toBeVisible({ timeout: 10000 });
    
    // Send second message "also read the readme" with Ctrl/Meta + Shift + Enter while first tool is running
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill("also read the readme");
    
    // Press Ctrl+Shift+Enter (or Meta+Shift+Enter on Mac)
    if (isMac) {
      await page.keyboard.press('Meta+Shift+Enter');
    } else {
      await page.keyboard.press('Control+Shift+Enter');
    }
    
    // Assert that "message queued" is visible
    await expect(page.getByText("message queued")).toBeVisible({ timeout: 10000 });
  });
});