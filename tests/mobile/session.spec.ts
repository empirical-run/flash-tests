import { test, expect } from '@playwright/test';

test.describe('Mobile Session Tests', () => {
  test('create session', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Check if the mobile layout is properly displayed
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(414); // iPhone 13 width
    
    // TODO(agent on page): Navigate to Sessions by clicking on Sessions link in the sidebar
    
    // TODO(agent on page): Click on "New Session" or similar button to start creating a new session
    
    // Verify we're successfully in the new session flow
    await expect(page).toHaveURL(/sessions/);
    
    // Verify mobile viewport is working correctly
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
  });
});