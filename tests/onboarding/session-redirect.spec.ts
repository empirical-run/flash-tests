import { test, expect } from "../fixtures";

test.describe("Session Redirect After Login", () => {
  test("navigate to protected session URL as non-logged user and redirect after login", async ({ 
    page, 
    trackCurrentSession, 
    customContextPageProvider 
  }) => {
    // First, create a new session while authenticated (using the default authenticated page)
    await page.goto('/');
    
    // Wait for successful login (should already be logged in via auth setup)
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible({ timeout: 10000 });
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(page).toHaveURL(/\/sessions$/, { timeout: 10000 });
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    const uniqueId = `redirect-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Test session for redirect flow - ${uniqueId}`;
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions/")
    await expect(page).toHaveURL(/\/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract the session ID from the current URL
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^?&#\/]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    
    if (!sessionId) {
      throw new Error('Failed to extract session ID from URL');
    }
    
    // Now create a new page context WITHOUT authentication to test the redirect flow
    const { page: unauthPage, context: unauthContext } = await customContextPageProvider({ 
      storageState: undefined 
    });
    
    try {
      // Navigate directly to the protected session URL without being logged in
      await unauthPage.goto(`/lorem-ipsum/sessions/${sessionId}`);
      
      // Should be redirected to login page since user is not authenticated
      await expect(unauthPage).toHaveURL(/login/, { timeout: 10000 });
      
      // Login with email and password
      await unauthPage.getByRole('button', { name: 'Login with password' }).click();
      await unauthPage.locator('#email-password').click();
      await unauthPage.locator('#email-password').fill(process.env.AUTOMATED_USER_EMAIL!);
      await unauthPage.getByPlaceholder('●●●●●●●●').click();
      await unauthPage.getByPlaceholder('●●●●●●●●').fill(process.env.AUTOMATED_USER_PASSWORD!);
      await unauthPage.getByRole('button', { name: 'Submit' }).click();
      
      // After successful login, should be redirected back to the original session URL
      await expect(unauthPage).toHaveURL(`/lorem-ipsum/sessions/${sessionId}`, { timeout: 10000 });
      
      // Verify we're actually on the session page by checking for session-specific elements
      await expect(unauthPage.getByRole('button', { name: 'Close Session' })).toBeVisible({ timeout: 10000 });
      
      // Also verify the session is displaying (check for session ID in the page)
      await expect(unauthPage.locator(`text=/#${sessionId}/`).or(unauthPage.getByText('Session')).first()).toBeVisible({ timeout: 10000 });
    } finally {
      // Clean up the unauthenticated context
      await unauthContext.close();
    }
  });
});