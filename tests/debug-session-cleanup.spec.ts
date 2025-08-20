import { test, expect } from "./fixtures";

test.describe('Debug Session Cleanup', () => {
  test('debug session tracking and cleanup', async ({ page, trackCurrentSession, sessionTracker }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for session ID to appear in URL
    await expect(page).toHaveURL(/sessions\/\d+/, { timeout: 10000 });
    
    // Log the current URL before tracking
    const urlBeforeTracking = page.url();
    console.log('URL before tracking:', urlBeforeTracking);
    
    // Track the session
    trackCurrentSession(page);
    
    // Check what sessions were tracked
    const trackedSessions = sessionTracker.getSessionIds();
    console.log('Tracked sessions:', trackedSessions);
    
    // Extract session ID manually to compare
    const urlParts = urlBeforeTracking.split('/');
    const extractedSessionId = urlParts[urlParts.length - 1];
    console.log('Manually extracted session ID:', extractedSessionId);
    
    // Send a simple message to verify session is working
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill('test message');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message appears
    await expect(page.getByText('test message')).toBeVisible({ timeout: 10000 });
    
    // Log final URL
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
  });
});