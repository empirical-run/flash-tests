import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test("shows 'Check your email for a sign-in link' message after submitting email", async ({ page }) => {
    // Create a dynamic email for testing
    const client = new EmailClient();
    const testEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the email address in the email field
    await page.locator('#email-magic').fill(testEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Assert that the success message is visible
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
  });

  test("shows 'account is not registered, contact us' message for invalid email format", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter an invalid email format to trigger the error
    await page.locator('#email-magic').fill("invalid-email");
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // TODO(agent on page): Check what error message appears for invalid email format
    
    // Assert that an error message is visible
    await expect(page.getByText("account is not registered, contact us")).toBeVisible();
  });
});