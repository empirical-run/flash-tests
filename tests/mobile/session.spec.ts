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
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Generate unique session identifier for this test
    const timestamp = Date.now();
    const chatMessage = "hi there";
    
    // Send the chat message "hi there"
    await page.getByPlaceholder('Type your message...').click();
    await page.getByPlaceholder('Type your message...').fill(chatMessage);
    await page.locator('div').filter({ hasText: new RegExp(`^${chatMessage}$`) }).getByRole('button').click();
    
    // Verify the chat message was sent and appears in the conversation
    await expect(page.getByText(chatMessage)).toBeVisible({ timeout: 10000 });
    
    // Verify we're still in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 5000 });
    
    // TODO(agent on page): Look for a Details tab and try to access session management options like Close Session
  });
});