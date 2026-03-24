import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for the main content to be fully loaded (ensures React is hydrated and keyboard shortcuts are registered)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Click on the page to ensure keyboard focus before pressing the shortcut
    await page.locator('body').click();
    
    // Press Ctrl/Cmd + K to open the command bar
    await page.keyboard.press('ControlOrMeta+K');
    
    // Wait for command bar to be visible
    const commandBarInput = page.getByPlaceholder('Type a command or search...');
    await expect(commandBarInput).toBeVisible();
    
    // Type "settings" in the command bar
    await commandBarInput.fill('settings');
    
    // Wait for the settings option to be visible
    await expect(page.getByText('Lorem Ipsum › Settings')).toBeVisible();
    
    // Press Enter to select the first result
    await commandBarInput.press('Enter');
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});
