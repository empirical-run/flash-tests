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
    
    // Click on the "Requests" on the sidebar (copying pattern from request.spec.ts)
    await page.getByRole('link', { name: 'Requests' }).click();
    
    // Click on the "New Request" button
    await page.getByRole('button', { name: 'New Request' }).click();
    
    // Fill the form with title and description
    await page.getByLabel('Title').click();
    await page.getByLabel('Title').fill(requestTitle);
    await page.getByLabel('Description').click();
    await page.getByLabel('Description').fill(requestDescription);
    
    // Click the Create button to submit the form
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify the chat session with the title is created and visible
    await expect(page.locator('.text-sm').filter({ hasText: requestTitle }).first()).toBeVisible();
    
    // Open the session by clicking on the specific session row for our request
    await page.getByRole('cell', { name: requestTitle }).click();
    
    // Now click on the session link that contains our request title to open the chat
    await page.getByRole('link').filter({ hasText: requestTitle }).click();
    
    // Verify we're in the chat session by checking the URL contains "sessions"
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Verify mobile viewport is working correctly  
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
    
    // Check that both the title and description are visible in the first chat bubble
    const firstChatBubble = page.locator('[data-message-id="1"]');
    await expect(firstChatBubble.getByText(requestTitle)).toBeVisible({ timeout: 10000 });
    await expect(firstChatBubble.getByText(requestDescription)).toBeVisible({ timeout: 10000 });
  });
});