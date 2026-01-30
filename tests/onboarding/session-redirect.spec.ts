import { test, expect } from "../fixtures";

test.describe("Session Redirect After Login", () => {
  test("navigate to protected session URL as non-logged user and redirect after login", async ({ page }) => {
    test.skip(process.env.TEST_RUN_ENVIRONMENT !== 'preview', 'This test only runs on preview environments');
    
    // Navigate directly to a protected session URL without being logged in
    await page.goto("/lorem-ipsum/sessions/59027");
    
    // Should be redirected to login page since user is not authenticated
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
    
    // Login with email and password
    await page.getByRole('button', { name: 'Login with password' }).click();
    await page.locator('#email-password').click();
    await page.locator('#email-password').fill(process.env.AUTOMATED_USER_EMAIL!);
    await page.getByPlaceholder('●●●●●●●●').click();
    await page.getByPlaceholder('●●●●●●●●').fill(process.env.AUTOMATED_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Submit' }).click();
    
    // After successful login, should be redirected back to the original session URL
    await expect(page).toHaveURL("/lorem-ipsum/sessions/59027", { timeout: 10000 });
    
    // Verify we're actually on the session page by checking for session-specific elements
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10000 });
    
    // The "Close Session" option is now inside a dropdown menu next to "Review"
    // Click on the dropdown button (the chevron next to "Review") to open it
    await page.locator('button:has(svg.lucide-chevron-down)').first().click();
    
    // Verify "Close Session" option is visible in the dropdown menu
    await expect(page.getByRole('menuitem', { name: 'Close Session' })).toBeVisible({ timeout: 10000 });
    
    // Also verify the session number is correct in the page title or heading
    await expect(page.getByText('#59027')).toBeVisible({ timeout: 10000 });
  });
});