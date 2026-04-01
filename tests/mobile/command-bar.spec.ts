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
    
    // Open the sidebar using the mobile hamburger button
    await page.getByRole('button', { name: 'Open sidebar' }).click();

    // Click on the user email button at the bottom of the sidebar to open user menu
    await page.getByRole('button', { name: 'automation-test@example.com' }).click();
    
    // Click on "Command Bar" option from the menu
    await page.getByRole('menuitem', { name: 'Command Bar' }).click();
    
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
