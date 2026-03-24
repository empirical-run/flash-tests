import { test, expect } from '../fixtures';

test.describe('Mobile Command Bar', () => {
  test('Open command bar and navigate to settings on mobile', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Wait for page to load - Sessions page should be visible
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    
    // Click on profile icon in the top right corner
    await page.getByRole('button', { name: 'Toggle user menu' }).click();
    
    // Click on "Command Bar" option from the menu
    await page.getByRole('menuitem', { name: 'Command Bar' }).click();
    
    // TODO(agent on page): The command bar should now be open. Find the search input for the command bar (check placeholder text, role, etc.) and type "settings", then wait for a result containing "Settings" to appear and press Enter to navigate to it.
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});
