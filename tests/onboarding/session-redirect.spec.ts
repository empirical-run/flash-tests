import { test, expect } from "../fixtures";
import { waitForFirstMessage } from "../pages/sessions";
import { loginWithPassword } from "../pages/login";

test.describe("Session Redirect After Login", () => {
  test("navigate to protected session URL as non-logged user and redirect after login", async ({ page }) => {
    test.skip(process.env.TEST_RUN_ENVIRONMENT !== 'preview', 'This test only runs on preview environments');
    
    // Navigate directly to a protected session URL without being logged in
    await page.goto("/sessions/59027");
    
    // Should be redirected to login page since user is not authenticated
    await expect(page).toHaveURL(/login/);
    
    // Login with email and password
    await loginWithPassword(page);
    
    // After successful login, should be redirected back to the original session URL
    await expect(page).toHaveURL("/sessions/59027");
    
    // Verify we're actually on the session page by checking for session-specific elements
    await waitForFirstMessage(page);
    
    // The "Close Session" option is now inside a dropdown menu next to "Review"
    // Click on the dropdown button (the chevron next to "Review") to open it
    await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
    
    // Verify "Close Session" option is visible in the dropdown menu
    await expect(page.getByRole('menuitem', { name: 'Close Session' })).toBeVisible();
    
    // Also verify the session number is correct in the page title
    await expect(page).toHaveTitle(/59027/);
  });
});