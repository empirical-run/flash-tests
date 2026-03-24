import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for the main content to be fully loaded
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Open the command bar via the user menu (same approach as mobile)
    await page.getByRole('button', { name: 'Toggle user menu' }).click();
    await page.getByRole('menuitem', { name: 'Command Bar' }).click();
    
    // Wait for command bar to be visible
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
