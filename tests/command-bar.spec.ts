import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for the main content to be fully loaded (ensures React is hydrated and keyboard shortcuts are registered)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // TODO(agent on page): Open the command bar. Try pressing Ctrl+K keyboard shortcut to open the command bar. If a combobox input with placeholder "Type a command or search..." appears, that means the command bar opened. Take note of any interactions needed before the keyboard shortcut (like clicking on a specific element first).
    const commandBarInput = page.getByPlaceholder('Type a command or search...');
    
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
