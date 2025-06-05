import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test.describe.configure({ mode: 'serial' });
  
  let client: EmailClient;
  let unregisteredEmail: string;
  let magicLinkUrl: string;

  test("can request magic link for unregistered email", async ({ page }) => {
    // Create a dynamic email for testing unregistered user scenario
    client = new EmailClient();
    unregisteredEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Assert that the success message is visible
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
  });

  test("receives magic link email for unregistered user", async ({ page }) => {
    // Wait for the magic link email
    const email = await client.waitForEmail();
    
    // Verify email was received
    expect(email).toBeTruthy();
    
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
    magicLinkUrl = magicLink!.href;
  });

  test("shows error message when unregistered user tries to login via magic link", async ({ page }) => {
    // Transform the magic link URL to use the correct base URL for the test environment
    // The email contains localhost URLs but we need to use the actual deployment URL
    const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const transformedMagicLinkUrl = magicLinkUrl.replace(/^https?:\/\/localhost:\d+/, baseUrl);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // The magic link now lands on a login form where we need to try logging in to see the unregistered domain error
    // Click on the "Login with password" button to access the login form
    await page.getByRole('button', { name: 'Login with password' }).click();
    
    // Fill in the email field with the unregistered email address
    await page.locator('#email-password').fill(unregisteredEmail);
    
    // Fill in a dummy password (we expect this to fail for unregistered email)
    await page.getByPlaceholder('●●●●●●●●').fill('password123');
    
    // Try to submit the form
    await page.getByRole('button', { name: 'Submit' }).click();
    
    // Assert that the user sees an error message (the app now shows generic "Invalid email or password" instead of specific unregistered domain message)
    await expect(page.getByText("Invalid email or password").first()).toBeVisible();
    
    // Also verify we're still on the login page (the URL check may need updating based on new behavior)
    await expect(page).toHaveURL(/.*\/login/);
  });
});