import { test, expect } from '../fixtures';
import { openNewSessionDialog } from '../pages/sessions';

test.describe('Mobile Session Tests', () => {
  test('create new session and send chat message', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Navigate directly to Sessions. The new mobile shell no longer exposes the
    // old sidebar trigger; primary navigation is behind the Menu control.
    await page.goto('/sessions');
    await expect(page).toHaveURL(/sessions$/);
    
    // Create a new session with initial prompt
    await openNewSessionDialog(page);
    const chatMessage = "hi there";
    await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(chatMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify the initial chat message appears in the conversation
    await expect(page.getByText(chatMessage).first()).toBeVisible();
    
    // Verify we're still in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });
    
    // Note: Details tab and Close Session functionality not available in mobile interface
    // Mobile UI likely has different session management approach
  });
});