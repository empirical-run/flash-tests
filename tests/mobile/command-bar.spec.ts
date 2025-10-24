import { test, expect } from '../fixtures';

test.describe('Mobile Command Bar', () => {
  test('open command bar on mobile', async ({ page }) => {
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
    
    // Wait for command bar to be visible (combobox with search input)
    const commandBarInput = page.getByPlaceholder('Type a command or search…');
    await expect(commandBarInput).toBeVisible({ timeout: 5000 });
    
    // Click on the input to ensure it's focused
    await commandBarInput.click();
    
    // Verify command bar is functional by checking that it's focused
    await expect(commandBarInput).toBeFocused();
  });
});
