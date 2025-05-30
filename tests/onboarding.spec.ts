import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test("shows 'account is not registered, contact us' message for unregistered email", async ({ page }) => {
    // Create a dynamic email for testing
    const client = new EmailClient();
    const unregisteredEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address in the email field
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Assert that the message "account is not registered, contact us" is visible
    await expect(page.getByText("account is not registered, contact us")).toBeVisible();
  });
});