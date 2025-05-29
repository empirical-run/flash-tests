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
    
    // TODO(agent on page): Click on "Sessions" link in the sidebar navigation to access the sessions page
    
    // TODO(agent on page): Look for and click a button to create a new session - this could be "New Session", "New Chat", "+" button, or "Start Chat" button
    
    // Verify we're successfully in a new session (URL should contain sessions and possibly an ID)
    await expect(page).toHaveURL(/sessions/);
    
    // Verify mobile viewport is working correctly  
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
    
    // Verify the session interface is loaded
    await expect(page.locator('body')).toBeVisible();
  });
});