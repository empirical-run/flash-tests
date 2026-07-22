import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for the main content to be fully loaded
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Wait for keyboard shortcut listeners to fully register after React hydration
    await page.waitForTimeout(1500);
    
    // Dispatch Ctrl+K keyboard event to open the command bar
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    });
    
    // Wait for command bar to be visible
    const commandBarInput = page.getByPlaceholder('Type a command or search...');
    
    // Type "settings" in the command bar
    await commandBarInput.fill('settings');
    
    // Wait for the settings option to be visible. Use exact match because the
    // command bar now also lists nested settings sub-pages (e.g. "Lorem Ipsum ›
    // Settings › Profile"), which would otherwise trigger a strict-mode violation.
    await expect(page.getByText('Lorem Ipsum › Settings', { exact: true })).toBeVisible();
    
    // Press Enter to select the first result
    await commandBarInput.press('Enter');
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});
