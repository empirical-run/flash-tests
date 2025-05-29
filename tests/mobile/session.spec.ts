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
    
    // Generate unique title and description for the test
    const timestamp = Date.now();
    const requestTitle = `Mobile Test Request ${timestamp}`;
    const requestDescription = `Mobile test description ${timestamp}`;
    
    // TODO(agent on page): Navigate to Requests section - this could be through a hamburger menu, navigation button, or direct URL navigation
    
    // TODO(agent on page): Find and click the "New Request" button to create a new request
    
    // TODO(agent on page): Fill the title field with requestTitle and description field with requestDescription
    
    // TODO(agent on page): Click the Create or Submit button to create the request
    
    // TODO(agent on page): Find and click on the newly created session/request to open it in a chat session
    
    // Verify we're in the chat session by checking the URL contains "sessions"
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Verify mobile viewport is working correctly  
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
    
    // Verify the session interface is loaded and shows our request content
    await expect(page.getByText(requestTitle)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(requestDescription)).toBeVisible({ timeout: 10000 });
  });
});