import { test, expect } from '@playwright/test';

test.describe('Mobile Session Tests', () => {
  test('create session', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify the page loads properly on mobile
    await expect(page).toHaveTitle(/Empirical/);
    
    // Check if the mobile layout is properly displayed
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(414); // iPhone 13 width
    
    // Verify that the user session is established
    // This assumes the authentication setup has been completed
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Verify mobile-specific navigation or elements
    // Add more specific assertions based on your application's mobile UI
    await expect(page.locator('body')).toBeVisible();
  });
});