import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Recent sessions in command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page from sidebar
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Wait for the first session row to be visible and get the session ID from the first cell
    const firstSessionRow = page.locator('table tbody tr').first();
    await expect(firstSessionRow).toBeVisible({ timeout: 10000 });
    
    // Get the session ID from the first cell of the row
    const sessionIdCell = firstSessionRow.locator('td').first();
    const sessionId = await sessionIdCell.textContent();
    expect(sessionId).toBeTruthy();
    
    // Click on the title cell (second cell) to open the session
    const titleCell = firstSessionRow.locator('td').nth(1);
    await titleCell.click();
    
    // Verify we're in a session page
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });
    
    // Wait for the first chat message to load so the session is properly recorded in recent sessions
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Navigate to Test Runs page from sidebar
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for test runs page to load
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Press Ctrl/Cmd + K to open the command bar
    await page.keyboard.press('ControlOrMeta+K');
    
    // Wait for command bar to be visible (combobox with search input)
    const commandBarInput = page.locator('[role="combobox"]');
    await expect(commandBarInput).toBeVisible({ timeout: 5000 });
    
    // Click on the input to ensure it's focused and trigger any dropdown content
    await commandBarInput.click();
    
    // Verify that the session ID is visible in the command bar (recent sessions section)
    // The command bar should show recently visited sessions
    await expect(page.getByText(sessionId!.trim())).toBeVisible({ timeout: 15000 });
  });
});
