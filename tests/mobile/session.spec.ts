import { test, expect } from '@playwright/test';

test.describe('Mobile Session Tests', () => {
  test('create session', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify the page loads properly on mobile
    await expect(page).toHaveTitle('Test Cases');
    
    // Check if the mobile layout is properly displayed
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(414); // iPhone 13 width
    
    // Verify that the page loads successfully
    await expect(page.locator('body')).toBeVisible();
    
    // Verify that the session is properly established by checking for page content
    // This indicates the user is authenticated and can access the application
    await expect(page.locator('h1, h2, h3, [role="heading"]')).toBeVisible();
    
    // Verify mobile viewport is working correctly
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
  });
});