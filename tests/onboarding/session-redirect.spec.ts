import { test, expect } from "../fixtures";

test.describe("Session Redirect After Login", () => {
  test("navigate to protected session URL as non-logged user and redirect after login", async ({ page }) => {
    // Navigate directly to a protected session URL without being logged in
    await page.goto("/lorem-ipsum-tests/sessions/65");
    
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
    await expect(page).toHaveURL("/lorem-ipsum-tests/sessions/65", { timeout: 10000 });
    
    // TODO(agent on page): Check what elements are visible on this session page and whether the session loads correctly
  });
});