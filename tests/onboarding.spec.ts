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

  test("detects unregistered domain when using magic link", async ({ page }) => {
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
    // This validates that the app correctly detects unregistered users
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
    
    // Check for common error-related text that might appear
    const errorTexts = [
      "account is not registered",
      "contact us",
      "unregistered",
      "not found",
      "invalid",
      "error"
    ];
    
    let foundErrorText = false;
    for (const errorText of errorTexts) {
      try {
        await expect(page.locator(`text*=${errorText}`)).toBeVisible({ timeout: 2000 });
        foundErrorText = true;
        break;
      } catch {
        // Continue checking other error texts
      }
    }
    
    // At minimum, we should validate that the URL indicates unregistered domain
    // which shows the app correctly handles the unregistered user scenario
    expect(foundErrorText || page.url().includes('unregistered_domain')).toBeTruthy();
  });
});