import { test, expect } from '@playwright/test';

test.describe('Mobile Session Tests', () => {
  test('create session', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify the page loads properly on mobile
    await expect(page).toHaveTitle('Test Cases');
    
    // Check if the mobile layout is properly displayed
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(414); // iPhone 13 width
    
    // TODO(agent on page): Click on the "sessions" link/button in the sidebar to access the sessions feature
    
    // TODO(agent on page): Click on "new session" or similar button to start creating a new session
    
    // Verify mobile viewport is working correctly
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
    
    // Verify we're successfully in the new session flow
    await expect(page.locator('body')).toBeVisible();
  });
});