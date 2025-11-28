import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Press Ctrl/Cmd + K to open the command bar
    await page.keyboard.press('ControlOrMeta+K');
    
    // Wait for command bar to be visible (combobox with search input)
    const commandBarInput = page.locator('[role="combobox"]');
    await expect(commandBarInput).toBeVisible({ timeout: 5000 });
    
    // Type "settings" in the command bar
    await commandBarInput.fill('settings');
    
    // Wait for search results to filter
    await page.waitForTimeout(500);
    
    // Wait for the settings option to be visible
    await expect(page.getByText('Lorem Ipsum › Settings')).toBeVisible({ timeout: 5000 });
    
    // Wait a bit more before pressing Enter
    await page.waitForTimeout(300);
    
    // Press Enter to select the first result
    await commandBarInput.press('Enter');
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/, { timeout: 10000 });
  });
});
