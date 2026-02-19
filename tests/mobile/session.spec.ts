import { test, expect } from '../fixtures';

test.describe('Mobile Session Tests', () => {
  test('create new session and send chat message', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Open the sidebar by clicking the hamburger menu button, then click on Sessions
    await page.getByLabel('Open sidebar').click();
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with initial prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const chatMessage = "hi there";
    await page.getByPlaceholder('Enter an initial prompt').fill(chatMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify the initial chat message appears in the conversation
    await expect(page.getByText(chatMessage).first()).toBeVisible({ timeout: 10000 });
    
    // Verify we're still in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 5000 });
    
    // Note: Details tab and Close Session functionality not available in mobile interface
    // Mobile UI likely has different session management approach
  });
});