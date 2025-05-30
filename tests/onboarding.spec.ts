import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test("shows 'Check your email for a sign-in link' message after submitting valid email", async ({ page }) => {
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

  test("shows 'Invalid email address' error for invalid email format", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter an invalid email format to trigger the error
    await page.locator('#email-magic').fill("invalid-email");
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Assert that the invalid email error message is visible
    await expect(page.getByText("Invalid email address.")).toBeVisible();
  });

  test("redirects to unregistered domain status page for magic link with unregistered user", async ({ page }) => {
    // Create a dynamic email that should receive magic link
    const client = new EmailClient();
    const unregisteredEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Verify success message
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
    
    // Wait for the magic link email
    const email = await client.waitForEmail();
    
    // Find the magic link in the email
    const magicLink = email.links.find(link => 
      link.href.includes('/auth/') || 
      link.href.includes('/login') || 
      link.href.includes('/magic') ||
      link.href.includes('/verify') ||
      link.text?.toLowerCase().includes('sign') ||
      link.text?.toLowerCase().includes('login')
    );
    
    expect(magicLink).toBeTruthy();
    
    // Navigate to the magic link
    await page.goto(magicLink!.href);
    
    // Assert that we're redirected to the unregistered domain status page
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
    
    // Check for the actual error message that appears on this page
    // TODO(agent on page): Check what message appears on the unregistered domain status page
    
    // This should be the assertion for the actual error message shown
    await expect(page.getByText("account is not registered, contact us")).toBeVisible();
  });
});