import { test, expect } from '../fixtures';

test.describe('Mobile Command Bar', () => {
  test('open command bar on mobile', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Wait for page to load - Sessions page should be visible
    await expect(page.getByText('Sessions')).toBeVisible();
    
    // TODO(agent on page): Click on profile icon (top right) and then click on "Command Bar" option
    
    // Wait for command bar to be visible (combobox with search input)
    const commandBarInput = page.locator('[role="combobox"]');
    await expect(commandBarInput).toBeVisible({ timeout: 5000 });
    
    // Click on the input to ensure it's focused
    await commandBarInput.click();
    
    // Verify command bar is functional by checking that it has the search placeholder or similar
    await expect(commandBarInput).toBeFocused();
  });
});
