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
    
    // Create a quick request to get to sessions (following the pattern from request.spec.ts)
    // First navigate to Requests
    // TODO(agent on page): Click on "Requests" link in the sidebar to access the requests page
    
    // Create a new request to access sessions
    // TODO(agent on page): Click on "New Request" button to create a new request
    
    // Generate unique title and description for the test
    const timestamp = Date.now();
    const requestTitle = `Mobile Test Request ${timestamp}`;
    const requestDescription = `Mobile test description ${timestamp}`;
    
    // TODO(agent on page): Fill the title field with the requestTitle and description field with requestDescription, then click Create button
    
    // TODO(agent on page): Click on the newly created request session to open the chat session
    
    // Verify we're successfully in a session (URL should contain sessions)
    await expect(page).toHaveURL(/sessions/);
    
    // Verify mobile viewport is working correctly  
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
    
    // Verify the session interface is loaded and shows our request content
    await expect(page.getByText(requestTitle)).toBeVisible();
    await expect(page.getByText(requestDescription)).toBeVisible();
  });
});