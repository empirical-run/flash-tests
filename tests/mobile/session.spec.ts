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
    
    // Navigate directly to sessions page
    await page.goto('/sessions');
    
    // Verify we're on the sessions page
    await expect(page).toHaveURL(/sessions/);
    
    // TODO(agent on page): Click on "New Chat" or "New Session" or "+" button or similar to start creating a new session
    
    // Verify we're successfully in a new session (URL should contain sessions and possibly an ID)
    await expect(page).toHaveURL(/sessions/);
    
    // Verify mobile viewport is working correctly
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
  });
});