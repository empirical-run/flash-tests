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

  test("checks magic link behavior for unregistered email", async ({ page }) => {
    // Use a simple test email
    const testEmail = "test-unregistered@example.com";
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address in the email field
    await page.locator('#email-magic').fill(testEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // TODO(agent on page): Check what message appears after submitting a regular email address
    
    // We'll update this assertion based on what we actually see
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
  });
});