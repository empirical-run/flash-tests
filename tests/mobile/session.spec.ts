import { test, expect } from '../fixtures';

test.describe('Mobile Session Tests', () => {
  test('create new session and send chat message', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Open the sidebar by clicking the hamburger menu button, then click on Sessions
    await page.getByLabel('Open sidebar').click();
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // TODO(agent on page): Create a new session by clicking the "New Session" or similar button
    
    // Generate unique session identifier for this test
    const timestamp = Date.now();
    const chatMessage = "hi there";
    
    // TODO(agent on page): Send the chat message "hi there" by typing in the message input field and clicking send or pressing enter
    
    // Verify the chat message was sent and appears in the conversation
    await expect(page.getByText(chatMessage)).toBeVisible({ timeout: 10000 });
    
    // Verify we're still in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 5000 });
  });
});